import type { ID } from './index';

export type ReminderType = 'payments' | 'repairs' | 'utilities';

export interface ReminderContact {
  name: string;
  relation: string;
  mobile_number: string;
}

export interface PaymentReminder {
  bill_id: ID;
  lease_id: ID;
  room_number: string;
  customer_id: ID;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  immediate_contacts?: ReminderContact[];
  billing_month: string;
  due_date: string;
  total_amount_due: string | number;
  paid_amount: string | number;
  outstanding_amount: string | number;
  is_overdue: boolean;
  days_overdue: number;
  days_until_due: number;
  status: string;
}

export interface RepairReminder {
  repair_id: ID;
  lease_id?: ID | null;
  room_number: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  description: string;
  cost: string | number;
  status: string;
  date_logged: string;
  days_pending: number;
}

export interface UtilityBillReminder {
  utility_record_id: ID;
  room_number: string;
  billing_month: string;
  electricity_cost: string | number;
  water_cost: string | number;
  total_cost: string | number;
  due_date?: string | null;
  is_paid: boolean;
  is_overdue: boolean;
  days_overdue: number;
}

export interface MissingUtilityReminder {
  room_number: string;
  customer_name?: string | null;
  billing_month: string;
  message: string;
}

export interface NotificationSummary {
  total_action_items: number;
  payments_to_collect_count: number;
  overdue_payments_count: number;
  total_payment_amount_to_collect: string | number;
  repairs_pending_count: number;
  total_estimated_repair_cost: string | number;
  unpaid_utility_bills_count: number;
  total_utility_bills_to_pay: string | number;
  missing_utility_records_count: number;
}

export interface NotificationsResponse {
  summary: NotificationSummary;
  payments_to_collect?: PaymentReminder[];
  repairs_to_do?: RepairReminder[];
  utility_bills_to_pay?: UtilityBillReminder[];
  missing_utility_records?: MissingUtilityReminder[];
}