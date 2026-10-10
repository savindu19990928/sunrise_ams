import React from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import type { ImmediateContactDraft } from '../../types';
import { contactRelations, isBlankContact, newContactDraft } from '../../utils/contacts';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';

interface ImmediateContactsEditorProps {
  contacts: ImmediateContactDraft[];
  touched: boolean;
  onChange: (contacts: ImmediateContactDraft[]) => void;
}

type ContactField = 'name' | 'relation' | 'mobile_number';

/** A contact row is either fully blank (ignored) or needs all three fields. */
export function contactRowErrors(draft: ImmediateContactDraft): Partial<Record<ContactField, boolean>> {
  if (isBlankContact(draft)) return {};
  return {
    name: !draft.name.trim(),
    relation: !draft.relation.trim(),
    mobile_number: !draft.mobile_number.trim()
  };
}

export function ImmediateContactsEditor({ contacts, touched, onChange }: ImmediateContactsEditorProps) {
  const update = (key: string, field: ContactField, value: string) =>
  onChange(contacts.map((draft) => draft.key === key ? { ...draft, [field]: value } : draft));

  const remove = (key: string) => onChange(contacts.filter((draft) => draft.key !== key));

  const add = () => onChange([...contacts, newContactDraft()]);

  const errorClass = 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20';

  return (
    <section aria-labelledby="immediate-contacts-heading" className="border-t border-line pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="immediate-contacts-heading" className="text-[13px] font-medium text-ink">
            Immediate contacts
          </h3>
          <p className="mt-0.5 text-[12px] text-ink-soft">Optional — people to call in an emergency. Add as many as needed.</p>
        </div>
        <Button variant="secondary" size="sm" icon={PlusIcon} onClick={add}>
          Add contact
        </Button>
      </div>

      {contacts.length === 0 ?
      <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-3 text-[13px] text-ink-muted">
          No immediate contacts added.
        </p> :

      <div className="mt-3">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_36px] gap-2 pb-1.5 text-[12px] font-medium text-ink-muted sm:grid">
            <span>Name</span>
            <span>Relation</span>
            <span>Mobile number</span>
            <span className="sr-only">Remove</span>
          </div>
          <ul className="space-y-3 sm:space-y-2">
            {contacts.map((draft, index) => {
            const errors = touched ? contactRowErrors(draft) : {};
            const position = index + 1;
            return (
              <li
                key={draft.key}
                className="grid grid-cols-[1fr_36px] gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[1.2fr_1fr_1fr_36px] sm:border-0 sm:p-0">
                
                  <Input
                  aria-label={`Contact ${position} name`}
                  value={draft.name}
                  onChange={(event) => update(draft.key, 'name', event.target.value)}
                  placeholder="Kamala Perera"
                  className={errors.name ? errorClass : undefined} />
                
                  <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove contact ${position}`}
                  className="h-10 w-9 px-0 text-ink-soft hover:text-danger-600 sm:order-last"
                  onClick={() => remove(draft.key)}>
                  
                    <XIcon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Input
                  aria-label={`Contact ${position} relation`}
                  list="contact-relations"
                  value={draft.relation}
                  onChange={(event) => update(draft.key, 'relation', event.target.value)}
                  placeholder="Mother"
                  className={errors.relation ? `col-span-2 sm:col-span-1 ${errorClass}` : 'col-span-2 sm:col-span-1'} />
                
                  <Input
                  aria-label={`Contact ${position} mobile number`}
                  type="tel"
                  value={draft.mobile_number}
                  onChange={(event) => update(draft.key, 'mobile_number', event.target.value)}
                  placeholder="077 845 1123"
                  className={errors.mobile_number ? `col-span-2 sm:col-span-1 ${errorClass}` : 'col-span-2 sm:col-span-1'} />
                
                </li>);

          })}
          </ul>
          {touched && contacts.some((draft) => Object.values(contactRowErrors(draft)).some(Boolean)) &&
        <p className="mt-2 text-[12px] text-danger-600">Each contact needs a name, relation and mobile number.</p>
        }
        </div>
      }

      <datalist id="contact-relations">
        {contactRelations.map((relation) =>
        <option key={relation} value={relation} />
        )}
      </datalist>
    </section>);

}