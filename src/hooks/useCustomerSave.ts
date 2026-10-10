import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Customer, ImmediateContactDraft } from '../types';
import { ApiError, apiRequest } from '../utils/api';
import { syncImmediateContacts } from '../utils/contacts';

/** Saves a customer and then their immediate contacts as one user action. */
export function useCustomerSave(onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const save = useCallback(
    async (existing: Customer | null, payload: Record<string, unknown>, contacts: ImmediateContactDraft[]) => {
      setPending(true);
      setError(null);
      try {
        const saved = existing ?
        await apiRequest<Customer>(`/api/customers/${existing.id}/`, { method: 'PATCH', body: payload }) :
        await apiRequest<Customer>('/api/customers/', { method: 'POST', body: payload });
        const customerId = saved?.id ?? existing?.id;
        if (customerId !== undefined) {
          try {
            await syncImmediateContacts(customerId, existing?.immediate_contacts ?? [], contacts);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            throw new ApiError(`Customer saved, but immediate contacts could not be updated: ${message}`, 0, 'http');
          }
        }
        toast.success(existing ? 'Customer updated.' : 'Customer created.');
        onDone();
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError((err as Error).message, 0, 'http');
        setError(apiError);
        toast.error(apiError.message);
      } finally {
        setPending(false);
      }
    },
    [onDone]
  );

  return { save, pending, error, setError };
}