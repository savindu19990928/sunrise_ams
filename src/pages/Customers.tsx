import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import type { Customer, Lease } from '../types';
import { useCollection } from '../hooks/useResource';
import { useCrud } from '../hooks/useCrud';
import { useCustomerSave } from '../hooks/useCustomerSave';
import { CustomerForm } from '../components/customers/CustomerForm';
import { ApiErrorState } from '../components/ui/ApiErrorState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { type Column, DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { formatCurrency } from '../utils/format';

export function Customers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: customers, loading, error, reload } = useCollection<Customer>('/api/customers/');
  const { data: leases } = useCollection<Lease>('/api/leases/');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [query, setQuery] = useState('');

  const handleDone = useCallback(() => {
    reload();
    setFormOpen(false);
    setEditing(null);
    setDeleting(null);
  }, [reload]);

  const crud = useCrud<Customer>('customers', { label: 'Customer', onDone: handleDone });
  const saver = useCustomerSave(handleDone);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null);
      setFormOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activeRoomByCustomer = useMemo(() => {
    const map = new Map<number, string>();
    for (const lease of leases) {
      if (lease.is_active) map.set(lease.customer, lease.room_number ?? `#${lease.room}`);
    }
    return map;
  }, [leases]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) =>
    [
    customer.first_name,
    customer.last_name,
    customer.email,
    customer.phone,
    customer.nic_number,
    ...(customer.immediate_contacts ?? []).flatMap((contact) => [contact.name, contact.mobile_number])].

    join(' ').
    toLowerCase().
    includes(needle)
    );
  }, [customers, query]);

  const columns: Column<Customer>[] = [
  {
    key: 'name',
    header: 'Customer',
    primary: true,
    render: (customer) =>
    <span className="font-medium text-ink">
          {customer.first_name} {customer.last_name}
        </span>

  },
  { key: 'nic', header: 'NIC', render: (customer) => <span className="text-ink-muted">{customer.nic_number || '—'}</span> },
  { key: 'phone', header: 'Phone', render: (customer) => <span className="text-ink-muted">{customer.phone || '—'}</span> },
  {
    key: 'email',
    header: 'Email',
    render: (customer) => <span className="break-all text-ink-muted">{customer.email || '—'}</span>
  },
  {
    key: 'contacts',
    header: 'Immediate contact',
    render: (customer) => {
      const list = customer.immediate_contacts ?? [];
      if (!list.length) return <span className="text-ink-soft">None added</span>;
      const [first] = list;
      return (
        <div className="min-w-0">
            <p className="whitespace-nowrap text-ink">
              {first.name}
              <span className="ml-1.5 text-[12px] text-ink-soft">{first.relation}</span>
            </p>
            <p className="whitespace-nowrap text-[12px] text-ink-muted">
              {first.mobile_number}
              {list.length > 1 && <span className="ml-1.5 text-ink-soft">+{list.length - 1} more</span>}
            </p>
          </div>);

    }
  },
  {
    key: 'threshold',
    header: 'Deposit threshold',
    align: 'right',
    render: (customer) =>
    customer.minimum_deposit_threshold === undefined || customer.minimum_deposit_threshold === null ?
    <Badge tone="warn">Not set</Badge> :

    <span className="whitespace-nowrap text-ink">{formatCurrency(customer.minimum_deposit_threshold)}</span>

  },
  {
    key: 'room',
    header: 'Current room',
    render: (customer) =>
    activeRoomByCustomer.has(customer.id) ?
    <Badge tone="brand">Room {activeRoomByCustomer.get(customer.id)}</Badge> :

    <Badge>No active lease</Badge>

  }];


  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Tenant records used for leases, consolidated bills and payment history."
        actions={
        <Button
          icon={PlusIcon}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}>
          
            Add customer
          </Button>
        } />
      

      <Card>
        <CardHeader
          title={`${filtered.length} ${filtered.length === 1 ? 'customer' : 'customers'}`}
          description="Search by name, NIC, phone, email or immediate contact."
          actions={<SearchInput value={query} onChange={setQuery} placeholder="Search customers" />} />
        
        {error ?
        <ApiErrorState error={error} onRetry={reload} /> :

        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={(customer) => customer.id}
          loading={loading}
          emptyTitle={customers.length ? 'No customers match your search' : 'No customers yet'}
          emptyDescription={
          customers.length ?
          'Try a different name, NIC or phone number.' :
          'Add a customer before assigning them to a room.'
          }
          emptyAction={
          customers.length ? undefined :
          <Button icon={UsersIcon} onClick={() => setFormOpen(true)}>
                  Add customer
                </Button>

          }
          rowActions={(customer) =>
          <>
                <Button
              variant="secondary"
              size="sm"
              icon={PencilIcon}
              onClick={() => {
                setEditing(customer);
                setFormOpen(true);
              }}>
              
                  Edit
                </Button>
                <Button
              variant="ghost"
              size="sm"
              icon={Trash2Icon}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              onClick={() => setDeleting(customer)}>
              
                  Delete
                </Button>
              </>
          } />

        }
      </Card>

      <CustomerForm
        open={formOpen}
        customer={editing}
        pending={saver.pending}
        error={saver.error}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          saver.setError(null);
        }}
        onSubmit={(payload, contacts) => saver.save(editing, payload, contacts)} />
      

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.first_name ?? ''} ${deleting?.last_name ?? ''}?`}
        message="The customer record will be removed. Existing leases and bills may block deletion on the server."
        confirmLabel="Delete customer"
        danger
        pending={crud.pending}
        onConfirm={() => deleting && crud.remove(deleting.id)}
        onClose={() => setDeleting(null)} />
      
    </div>);

}