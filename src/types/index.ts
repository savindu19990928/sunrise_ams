export type ID = number;

export type ServiceKind = 'electricity' | 'water';

/** The API restricts rooms to these three categories. */
export type RoomType = 'single' | 'double' | 'annex';

export interface Room {
  id: ID;
  room_number: string;
  room_type: RoomType | string;
  note?: string;
  /** Alias populated by normalize.ts for backward compatibility. */
  notes?: string;
  electricity_credit_balance?: number | string;
  water_credit_balance?: number | string;
  created_at?: string;
  /**
   * The API does not provide a status field for rooms.
   * In the UI, status is derived from whether the room has an active lease.
   */
  status?: RoomStatus;
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
  created_at?: string;
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
  /** Sum of all rent payments collected for this lease (excludes supplier payments). */
  total_payments_received?: number | string;
  rent_credit_balance?: number | string;
  deposit_paid: number;
  /** Deposit still held. Deductions stop once this is at or below the threshold. */
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

export interface ElectricityRecord {
  id: ID;
  room: ID;
  room_number?: string;
  room_type?: string;
  customer_name?: string | null;
  billing_month: string;
  previous_electricity_meter_reading?: number | string;
  electricity_meter_reading?: number | string;
  electricity_units?: number | string;
  /** Month-specific rate. Defaults to that month's calculated building electricity rate. */
  electricity_unit_price?: number | string | null;
  /** Calculated by the API from units × unit price. */
  electricity_cost: number | string;
  total_electricity_paid?: number | string;
  electricity_paid?: number | string;
  total_paid?: number | string;
  remaining_balance?: number | string;
  room_electricity_credit_balance?: number | string;
  electricity_credit_balance?: number | string;
  room_credit_balance?: number | string;
  is_paid?: boolean;
  due_date?: string | null;
  created_at?: string;
}

export interface WaterRecord {
  id: ID;
  room: ID;
  room_number?: string;
  room_type?: string;
  customer_name?: string | null;
  billing_month: string;
  previous_water_meter_reading?: number | string;
  water_meter_reading?: number | string;
  water_units?: number | string;
  /** Month-specific rate. Defaults to that month's calculated building water rate. */
  water_unit_price?: number | string | null;
  /** Calculated by the API from units × unit price. */
  water_cost: number | string;
  total_water_paid?: number | string;
  water_paid?: number | string;
  total_paid?: number | string;
  remaining_balance?: number | string;
  room_water_credit_balance?: number | string;
  water_credit_balance?: number | string;
  room_credit_balance?: number | string;
  is_paid?: boolean;
  due_date?: string | null;
  created_at?: string;
}

export interface BuildingElectricityBill {
  id: ID;
  billing_month: string;
  total_electricity_bill: number | string;
  total_electricity_units: number | string;
  supplier_electricity_units?: number | string | null;
  electricity_units_difference?: number | string | null;
  electricity_unit_price: number | string;
  due_date?: string | null;
}

export interface BuildingWaterBill {
  id: ID;
  billing_month: string;
  total_water_bill: number | string;
  total_water_units: number | string;
  supplier_water_units?: number | string | null;
  water_units_difference?: number | string | null;
  water_unit_price: number | string;
  due_date?: string | null;
}

/** Payment made by the tenant directly to the electricity supplier (CEB) — never business income. */
export interface ElectricityPayment {
  id: ID;
  payment_id?: ID;
  electricity_record?: ID;
  electricity_record_id?: ID;
  room_id?: ID;
  room_number?: string;
  billing_month?: string;
  amount_paid: number | string;
  payment_date: string;
  paid_to_supplier?: boolean;
  receipt_reference?: string;
  notes?: string;
  created_at?: string;
}

/** Payment made by the tenant directly to the water supplier (NWSDB) — never business income. */
export interface WaterPayment {
  id: ID;
  payment_id?: ID;
  water_record?: ID;
  water_record_id?: ID;
  room_id?: ID;
  room_number?: string;
  billing_month?: string;
  amount_paid: number | string;
  payment_date: string;
  paid_to_supplier?: boolean;
  receipt_reference?: string;
  notes?: string;
  created_at?: string;
}

/* ---------- Normalized internal service view types ---------- */

export interface NormalizedBuildingServiceBill {
  id: ID;
  billing_month: string;
  total_bill: number | string;
  total_units: number | string;
  supplier_units?: number | string | null;
  units_difference?: number | string | null;
  unit_price: number | string;
  due_date?: string | null;
}

export interface NormalizedServiceRow {
  record_id: ID;
  room_id: ID;
  room_number: string;
  room_type?: string;
  customer_name?: string | null;
  billing_month: string;
  previous_meter_reading?: number | string;
  meter_reading?: number | string;
  units: number | string;
  unit_price: number | string | null;
  cost: number | string;
  total_paid?: number | string;
  remaining_balance?: number | string;
  room_credit_balance?: number | string;
  is_paid: boolean;
  due_date?: string | null;
}

export interface NormalizedMonthlyServiceSummary {
  billing_month: string;
  building_bill: NormalizedBuildingServiceBill | null;
  rooms_count?: number;
  total_rooms_cost?: number | string;
  rows: NormalizedServiceRow[];
}

export interface NormalizedPreviousMonthItem {
  record_id?: ID;
  billing_month: string;
  previous_meter_reading: number | string;
  meter_reading: number | string;
  units: number | string;
}

export interface NormalizedPreviousReading {
  room_id: ID;
  room_number: string;
  room_type?: string;
  billing_month?: string;
  last_billing_month?: string | null;
  previous_meter_reading?: number | string | null;
  previous_months?: NormalizedPreviousMonthItem[];
}

export interface NormalizedServicePayment {
  id: ID;
  record_id?: ID;
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
  /** Rent less deposit deduction — the only amount the tenant pays the property manager. */
  net_rent?: number | string;
  net_paid?: number | string;
  remaining_balance?: number | string;
  payable_to_property_manager?: number | string;
  electricity_paid?: number | string;
  electricity_remaining_balance?: number | string;
  payable_to_electricity_supplier?: number | string;
  water_paid?: number | string;
  water_remaining_balance?: number | string;
  payable_to_water_supplier?: number | string;
  gross_total_fee?: number | string;
  total_fee?: number | string;
  overpayment_credited?: number | string;
  /** API total_amount_due — net room fee payable to the property manager. */
  total_due: number;
  /** Rent collected — summed from lease payments. */
  amount_paid: number;
  is_paid?: boolean;
  /** Optional — derive it with billStatus() instead of reading it directly. */
  status?: BillStatus;
}

/** Lease rent payment. Never used for electricity or water. */
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
  deducted_repairs?: { id: ID; description: string; cost: number | string; date_logged?: string; status?: string; }[];
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
  'customer-room-fee-payments' |
  'customer-electricity-payments' |
  'customer-water-payments' |
  'all-room-fee-payments' |
  'all-electricity-payments' |
  'all-water-payments' |
  'unpaid-electricity-bills' |
  'unpaid-water-bills' |
  'unpaid-room-fee-bills' |
  'recorrection-logs' |
  'customer-payments' |
  'all-payments' |
  'this-month-charges' |
  'room-repairs' |
  'profits' |
  'electricity-payments' |
  'water-payments';

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
