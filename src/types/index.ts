export type ID = number;

/** The API restricts rooms to these three categories. */
export type RoomType = 'single' | 'double' | 'annex';

export interface Room {
  id: ID;
  room_number: string;
  room_type: RoomType | string;
  base_rent_fee: number;
  base_deposit: number;
  monthly_deposit_deduction: number;
  /** Price charged per electricity unit for this specific room. */
  electricity_unit_price?: number;
  /** Price charged per water unit for this specific room. */
  water_unit_price?: number;
  /**
   * The API does not provide a status field for rooms.
   * In the UI, status is derived from whether the room has an active lease.
   */
  status?: RoomStatus;
  notes?: string;
}

export type RoomStatus = 'vacant' | 'occupied';

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
  room_type?: string;
  start_date: string;
  end_date: string | null;
  /** Baseline agreement values recorded on the lease itself. */
  base_rent_fee?: number | string;
  base_deposit?: number | string;
  /** Deductions stop once the deposit balance is at or below this amount. */
  minimum_deposit_threshold?: number | string;
  /** Sum of all rent payments collected for this lease (excludes utility payments). */
  total_payments_received?: number | string;
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
  room_type?: string;
  billing_month: string;
  electricity_units?: number | string;
  water_units?: number | string;
  /** Month-specific rate. Optional — the API falls back to the room's default rate. */
  electricity_unit_price?: number | string | null;
  water_unit_price?: number | string | null;
  /** Calculated by the API from units × unit price. */
  electricity_cost: number | string;
  water_cost: number | string;
  total_cost?: number | string;
  /** Settled with the utility supplier (paid by the tenant directly). */
  is_paid?: boolean;
  total_utility_paid?: number | string;
  remaining_balance?: number | string;
  /** Room's advance credit from earlier supplier overpayments. */
  room_credit_balance?: number | string;
  customer_name?: string | null;
  due_date?: string | null;
}

/** Building-level bill received from the utility supplier for one month. */
export interface BuildingUtilityBill {
  id: ID;
  billing_month: string;
  total_electricity_bill: number | string;
  total_water_bill: number | string;
  /** Sum of the room meters. */
  total_electricity_units: number | string;
  total_water_units: number | string;
  /** Building usage as stated on the supplier's bill. */
  supplier_electricity_units?: number | string | null;
  supplier_water_units?: number | string | null;
  electricity_unit_price: number | string;
  water_unit_price: number | string;
  due_date?: string | null;
}

/** One room's row in GET /api/utilities/monthly-summary/. */
export interface MonthlyUtilityRow {
  utility_record_id: ID;
  room_id: ID;
  room_number: string;
  room_type?: string;
  customer_name?: string | null;
  electricity_units: number | string;
  electricity_unit_price: number | string;
  electricity_cost: number | string;
  water_units: number | string;
  water_unit_price: number | string;
  water_cost: number | string;
  total_bill?: number | string;
  total_cost: number | string;
  total_utility_paid?: number | string;
  remaining_balance?: number | string;
  room_credit_balance?: number | string;
  is_paid: boolean;
  due_date?: string | null;
}

export interface MonthlyUtilitySummary {
  billing_month: string;
  building_utility_bill: BuildingUtilityBill | null;
  rooms_count?: number;
  total_rooms_utility_cost?: number | string;
  rooms_utility_data: MonthlyUtilityRow[];
}

export interface RoomUtilityHistory {
  room_id: ID;
  room_number: string;
  room_type?: string;
  records_count?: number;
  utility_records: UtilityRecord[];
}

/** Payment made by the tenant directly to the utility supplier — never business income. */
export interface UtilityPayment {
  id: ID;
  utility_record: ID;
  room_number?: string;
  billing_month?: string;
  amount_paid: number | string;
  payment_date: string;
  paid_to_supplier?: boolean;
  receipt_reference?: string;
  notes?: string;
  created_at?: string;
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
  /** Rent less deposit deduction — the only amount the tenant pays the business. */
  net_rent?: number | string;
  /** API total including utilities. Utilities are paid to the supplier, so use billRentDue(). */
  total_due: number;
  /** Rent collected — summed from lease payments. */
  amount_paid: number;
  is_paid?: boolean;
  /** Optional — derive it with billStatus() instead of reading it directly. */
  status?: BillStatus;
}

/** Lease rent payment. Never used for utilities. */
export interface Payment {
  id: ID;
  bill: ID;
  lease?: ID;
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
'profits' |
'utility-payments';

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