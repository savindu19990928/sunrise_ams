import React from 'react';
import { AlertCircleIcon } from 'lucide-react';
import type { ApiError } from '../../utils/api';
import { Button } from './Button';
import { Modal } from './Modal';

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  error?: ApiError | null;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function FormModal({
  open,
  onClose,
  onSubmit,
  title,
  description,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  pending = false,
  error,
  size = 'md',
  children
}: FormModalProps) {
  const formId = `form-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
      <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {submitLabel}
          </Button>
        </>
      }>
      
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4">
        
        {error &&
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] leading-relaxed text-danger-700">
          
            <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>{error.message}</span>
          </div>
        }
        {children}
      </form>
    </Modal>);

}