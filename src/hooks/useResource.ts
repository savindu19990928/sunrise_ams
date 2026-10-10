import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiList, apiRequest } from '../utils/api';

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/** Fetches a single object (or custom endpoint payload). */
export function useResource<T>(path: string | null, deps: unknown[] = []): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    apiRequest<T>(path).
    then((result) => {
      if (active && mounted.current) setData(result);
    }).
    catch((err: unknown) => {
      if (!active || !mounted.current) return;
      setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http'));
      setData(null);
    }).
    finally(() => {
      if (active && mounted.current) setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, loading, error, reload };
}

/** Fetches a list resource, normalizing DRF pagination. */
export function useCollection<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    apiList<T>(path).
    then((result) => {
      if (active) setData(result);
    }).
    catch((err: unknown) => {
      if (!active) return;
      setError(err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http'));
      setData([]);
    }).
    finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, loading, error, reload, setData };
}