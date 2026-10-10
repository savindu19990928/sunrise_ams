import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { ID } from '../types';
import { ApiError, apiRequest } from '../utils/api';

interface CrudOptions {
  label: string;
  onDone?: () => void;
}

/** Standard create / update / delete against a DRF ModelViewSet resource. */
export function useCrud<T>(resource: string, { label, onDone }: CrudOptions) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async <R,>(task: () => Promise<R>, successMessage: string): Promise<R | null> => {
      setPending(true);
      setError(null);
      try {
        const result = await task();
        toast.success(successMessage);
        onDone?.();
        return result;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http');
        setError(apiError);
        toast.error(apiError.message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [onDone]
  );

  const create = useCallback(
    (body: Record<string, unknown>) =>
    run<T>(() => apiRequest<T>(`/api/${resource}/`, { method: 'POST', body }), `${label} created.`),
    [resource, label, run]
  );

  const update = useCallback(
    (id: ID, body: Record<string, unknown>) =>
    run<T>(() => apiRequest<T>(`/api/${resource}/${id}/`, { method: 'PATCH', body }), `${label} updated.`),
    [resource, label, run]
  );

  const remove = useCallback(
    (id: ID) =>
    run<null>(() => apiRequest<null>(`/api/${resource}/${id}/`, { method: 'DELETE' }), `${label} deleted.`),
    [resource, label, run]
  );

  return { create, update, remove, pending, error, setError };
}