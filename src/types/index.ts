export type ID = number;

export interface Room {
  id: ID;
  room_number: string;
  room_type: string;
  base_rent_fee: number;
  base_deposit: number;
  monthly_deposit_deduction: number;
  /** Price charged per electricity unit for this specific room. */
  electricity_unit_price?: number;
  /** Price charged per water unit for this specific room. */
  water_unit_price?: number;
  /** Optional — the API may omit it, so always guard before reading. */
  status?: RoomStatus;
  notes?: string;
}

export type RoomStatus = 'vacant' | 'occupied' | 'maintenance';

export interface ImmediateContact {
  id: ID;
  customer: ID;
  name: string;
  relation: string;
  mobile_number: string;
}

/** Editable contact row in the customer form — `id` is absent until saved. */
export interface ImmediateContactDraft {
  key: string;
  id?: ID;
  name: string;
  relation: string;
  mobile_number: string;
}

export interface Customer {
  id: ID;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  nic_number: string;
  address: string;
  /** Nested by the API on /api/customers/ — optional, may be empty. */
  immediate_contacts?: ImmediateContact[];
  /** Monthly deposit deductions stop once the deposit balance is at or below this amount. */
  minimum_deposit_threshold?: number | string;
}

export interface Lease {
  id: ID;
  customer: ID;
  room: ID;
  customer_name?: string;
  room_number?: string;
  start_date: string;
  end_date: string | null;
  deposit_paid: number;
  /** Deposit still held. Deductions stop once this is at or below the customer's threshold. */
  current_deposit_balance: number;
  /** Legacy field name — read through depositBalance() instead. */
  remaining_deposit?: number;
  rent_fee: number;
  monthly_deposit_deduction: number;
  /** Calculated by the API: what the next bill will deduct (0 once the threshold is reached). */
  current_applicable_deposit_deduction?: number | string;
  /** Calculated by the API: rent_fee − current_applicable_deposit_deduction. */
  effective_rent_fee?: number | string;
  is_active: boolean;
  final_deposit_refund?: number | string | null;
}

export interface UtilityRecord {
  id: ID;
  room: ID;
  room_number?: string;
  billing_month: string;
  electricity_units?: number;
  water_units?: number;
  /** Calculated by the API from units × the room's unit price. */
  electricity_cost: number;
  water_cost: number;
}

export type BillStatus = 'unpaid' | 'partial' | 'paid';

export interface Bill {
  id: ID;
  lease: ID;
  customer_name?: string;
  room_number?: string;
  billing_month: string;
  due_date: string;
  rent: number;
  electricity: number;
  water: number;
  deposit_deduction: number;
  remaining_deposit: number;
  total_due: number;
  amount_paid: number;
  /** Optional — derive it with billStatus() instead of reading it directly. */
  status?: BillStatus;
}

export interface Payment {
  id: ID;
  bill: ID;
  customer_name?: string;
  room_number?: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  reference?: string;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card';

export type RepairStatus = 'pending' | 'in_progress' | 'completed';

export interface RoomRepair {
  id: ID;
  /** Repairs are logged against a lease; the room is derived from it. */
  lease?: ID;
  room?: ID;
  room_number?: string;
  customer_name?: string;
  repair_cost: number;
  repair_description: string;
  repair_date: string;
  status?: RepairStatus;
  /** Set by the API once the cost has been taken from the tenant's deposit at move-out. */
  deducted_from_deposit?: boolean;
}

/** Response of POST /api/leases/{id}/terminate/ and the leave-room actions. */
export interface LeaveRoomResult {
  message?: string;
  lease_id?: ID;
  room_number?: string;
  customer_name?: string;
  deposit_before_repairs?: number | string;
  total_repairs_deducted?: number | string;
  final_deposit_refund?: number | string;
  amount_owed_by_customer?: number | string;
  current_deposit_balance?: number | string;
  deducted_repairs?: {id: ID;description: string;cost: number | string;date_logged?: string;status?: string;}[];
}

export interface OverduePayment {
  bill_id: ID;
  customer: string;
  room: string;
  due_date: string;
  days_overdue: number;
  owed: number;
}

export interface StaffPayload {
  username: string;
  password: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface AuthUser {
  username: string;
  is_superuser: boolean;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/* ---------- Reports ---------- */

export type ReportType =
'room-data' |
'customer-details' |
'customer-payments' |
'all-payments' |
'this-month-charges' |
'room-repairs' |
'profits';

export interface ReportPeriod {
  start: string;
  end: string;
}

export interface ProfitReport {
  period: ReportPeriod;
  total_profit: number;
  total_revenue?: number;
  total_repairs?: number;
  room_profits: Record<string, number>;
}

export interface GenericReport {
  period?: ReportPeriod;
  results?: Record<string, unknown>[];
  [key: string]: unknown;
}