import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '../utils/api';

/** Runs a custom POST action (e.g. building-bill, set-unit-prices) with toasts and error state. */
export function useAction(onDone?: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async <R,>(path: string, body: Record<string, unknown>, successMessage: string): Promise<R | null> => {
      setPending(true);
      setError(null);
      try {
        const result = await apiRequest<R>(path, { method: 'POST', body });
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

  return { run, pending, error, setError };
}