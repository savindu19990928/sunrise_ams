import type { ID, ImmediateContact, ImmediateContactDraft } from '../types';
import { apiRequest } from './api';

export const contactRelations = ['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Son', 'Daughter', 'Guardian', 'Friend', 'Relative', 'Colleague'];

let draftSeq = 0;

export function newContactDraft(contact?: ImmediateContact): ImmediateContactDraft {
  draftSeq += 1;
  return {
    key: contact ? `contact-${contact.id}` : `draft-${draftSeq}`,
    id: contact?.id,
    name: contact?.name ?? '',
    relation: contact?.relation ?? '',
    mobile_number: contact?.mobile_number ?? ''
  };
}

export function isBlankContact(draft: ImmediateContactDraft): boolean {
  return !draft.name.trim() && !draft.relation.trim() && !draft.mobile_number.trim();
}

export function contactLabel(contact: Pick<ImmediateContact, 'name' | 'relation'>): string {
  return contact.relation ? `${contact.name} (${contact.relation})` : contact.name;
}

/**
 * Brings a customer's immediate contacts in line with the edited list:
 * new rows are created, changed rows patched, removed rows deleted.
 */
export async function syncImmediateContacts(
customerId: ID,
original: ImmediateContact[],
drafts: ImmediateContactDraft[])
: Promise<void> {
  const kept = drafts.filter((draft) => !isBlankContact(draft));
  const keptIds = new Set(kept.filter((draft) => draft.id !== undefined).map((draft) => draft.id));

  const removals = original.
  filter((contact) => !keptIds.has(contact.id)).
  map((contact) => apiRequest<null>(`/api/immediate-contacts/${contact.id}/`, { method: 'DELETE' }));

  const writes = kept.map((draft) => {
    const body = {
      customer: customerId,
      name: draft.name.trim(),
      relation: draft.relation.trim(),
      mobile_number: draft.mobile_number.trim()
    };
    if (draft.id === undefined) {
      return apiRequest<ImmediateContact>('/api/immediate-contacts/', { method: 'POST', body });
    }
    const before = original.find((contact) => contact.id === draft.id);
    const unchanged =
    before &&
    before.name === body.name &&
    before.relation === body.relation &&
    before.mobile_number === body.mobile_number;
    if (unchanged) return Promise.resolve(null);
    return apiRequest<ImmediateContact>(`/api/immediate-contacts/${draft.id}/`, { method: 'PATCH', body });
  });

  await Promise.all([...removals, ...writes]);
}