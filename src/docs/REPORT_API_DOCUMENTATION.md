# ThirandaSystem Report API Documentation

This document covers all reporting endpoints exposed under `/api/reports/<report_type>/` and the audit log endpoint `/api/recorrection-logs/`.

> **Important Three-Way Payment Separation Rule**
> - **Room Fee Payments** (`Payment`, `Lease.rent_credit_balance`) are paid to the **property owner / property manager** (`payment_recipient: "property_owner"`).
> - **Electricity Bill Payments** (`ElectricityPayment`, `Room.electricity_credit_balance`) are paid directly to the **electricity supplier** (`payment_recipient: "electricity_supplier"`).
> - **Water Bill Payments** (`WaterPayment`, `Room.water_credit_balance`) are paid directly to the **water supplier** (`payment_recipient: "water_supplier"`).
> - Room fee, electricity, and water payments and advance credit balances are **never mixed**. Overpaying a water bill creates `Room.water_credit_balance` and only deducts from future water bills; overpaying an electricity bill creates `Room.electricity_credit_balance` and only deducts from future electricity bills.

---

## Authentication & Common Query Parameters

All report endpoints require Staff/Admin JWT authentication:
```http
Authorization: Bearer <access_token>
```

### Common Date Filtering Query Parameters
Every `/api/reports/<report_type>/` endpoint supports:
- `start_date` (`YYYY-MM-DD`) and `end_date` (`YYYY-MM-DD`): Custom date range.
- `month` (`YYYY-MM` or `YYYY-MM-DD`): Filters to the specified month (first day through last day of that month).
- If neither is provided, defaults to the **current month** (1st of the current month to today).

---

## 1. Customer Room Fee Payments (Paid to Property Owner)

`GET /api/reports/customer-room-fee-payments/?customer_id=<id>`

*(Legacy alias: `GET /api/reports/customer-payments/?customer_id=<id>` returns the raw `Payment` array.)*

### Query Parameters
| Parameter | Required | Description |
| :--- | :---: | :--- |
| `customer_id` | Yes | Customer ID |
| `month` / `start_date` & `end_date` | No | Period filter |

### Sample Response (`200 OK`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "customer_id": 1,
  "customer_name": "John Doe",
  "payment_recipient": "property_owner",
  "total_room_fee_paid": "30000.00",
  "payments_count": 1,
  "payments": [
    {
      "payment_id": 12,
      "bill_id": 8,
      "billing_month": "2026-04-01",
      "lease_id": 3,
      "room_number": "101",
      "room_type": "single",
      "amount_paid": "30000.00",
      "payment_date": "2026-04-05",
      "receipt_reference": "RENT-001",
      "notes": null,
      "bill_total_due": "30000.00",
      "bill_is_paid": true
    }
  ]
}
```

---

## 2. Customer Electricity Bill Payments (Paid to Electricity Supplier)

`GET /api/reports/customer-electricity-payments/?customer_id=<id>`

### Query Parameters
| Parameter | Required | Description |
| :--- | :---: | :--- |
| `customer_id` | Yes | Customer ID |
| `month` / `start_date` & `end_date` | No | Period filter |

### Sample Response (`200 OK`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "customer_id": 1,
  "customer_name": "John Doe",
  "payment_recipient": "electricity_supplier",
  "total_electricity_paid": "10000.00",
  "payments_count": 1,
  "payments": [
    {
      "payment_id": 19,
      "electricity_record_id": 14,
      "billing_month": "2026-04-01",
      "room_id": 2,
      "room_number": "101",
      "room_type": "single",
      "amount_paid": "10000.00",
      "payment_date": "2026-04-10",
      "receipt_reference": "CEB-8812",
      "paid_to_supplier": true,
      "notes": "Paid directly to CEB",
      "electricity_total_cost": "10000.00",
      "electricity_is_paid": true
    }
  ]
}
```

---

## 3. Customer Water Bill Payments (Paid to Water Supplier)

`GET /api/reports/customer-water-payments/?customer_id=<id>`

### Query Parameters
| Parameter | Required | Description |
| :--- | :---: | :--- |
| `customer_id` | Yes | Customer ID |
| `month` / `start_date` & `end_date` | No | Period filter |

### Sample Response (`200 OK`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "customer_id": 1,
  "customer_name": "John Doe",
  "payment_recipient": "water_supplier",
  "total_water_paid": "10000.00",
  "payments_count": 1,
  "payments": [
    {
      "payment_id": 22,
      "water_record_id": 9,
      "billing_month": "2026-04-01",
      "room_id": 2,
      "room_number": "101",
      "room_type": "single",
      "amount_paid": "10000.00",
      "payment_date": "2026-04-10",
      "receipt_reference": "NWSDB-4410",
      "paid_to_supplier": true,
      "notes": "Includes 5000 advance water payment",
      "water_total_cost": "5000.00",
      "water_is_paid": true
    }
  ]
}
```

---

## 4. All Customers Room Fee Payments (Paid to Property Owner)

`GET /api/reports/all-room-fee-payments/`  
*(Alias: `GET /api/reports/all-customers-room-fee-payments/`)*

*(Legacy endpoint `GET /api/reports/all-payments/` remains available for backward compatibility.)*

### Sample Response (`200 OK`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "payment_recipient": "property_owner",
  "total_room_fee_paid": "55000.00",
  "payments_count": 2,
  "payments": [
    {
      "payment_id": 12,
      "bill_id": 8,
      "billing_month": "2026-04-01",
      "lease_id": 3,
      "customer_id": 1,
      "customer_name": "John Doe",
      "room_number": "101",
      "room_type": "single",
      "amount_paid": "30000.00",
      "payment_date": "2026-04-05",
      "receipt_reference": "RENT-001",
      "notes": null
    }
  ]
}
```

---

## 5. All Customers Electricity Bill Payments (Paid to Electricity Supplier)

`GET /api/reports/all-electricity-payments/`  
*(Alias: `GET /api/reports/all-customers-electricity-payments/`)*

*(Also see `GET /api/reports/electricity-payments/` for the combined summary with `room_breakdown` and `unpaid_electricity_records`.)*

---

## 6. All Customers Water Bill Payments (Paid to Water Supplier)

`GET /api/reports/all-water-payments/`  
*(Alias: `GET /api/reports/all-customers-water-payments/`)*

*(Also see `GET /api/reports/water-payments/` for the combined summary with `room_breakdown` and `unpaid_water_records`.)*

---

## 7. All Unpaid Electricity Bills

`GET /api/reports/unpaid-electricity-bills/`  
*(Alias: `GET /api/reports/all-unpaid-electricity-payments/`)*

Returns all unpaid `ElectricityRecord` entries (`is_paid=False`) in the selected period along with `billing_date` (exact `YYYY-MM-DD`, no due date), `already_paid` (net applied), `remaining_balance`, and `room_electricity_credit_balance`.

---

## 8. All Unpaid Water Bills

`GET /api/reports/unpaid-water-bills/`  
*(Alias: `GET /api/reports/all-unpaid-water-payments/`)*

Returns all unpaid `WaterRecord` entries (`is_paid=False`) in the selected period along with `billing_date` (exact `YYYY-MM-DD`, no due date), `already_paid` (net applied), `remaining_balance`, and `room_water_credit_balance`.

---

## 9. All Unpaid Room Fee Payments of All Customers

`GET /api/reports/unpaid-room-fee-bills/`  
*(Alias: `GET /api/reports/all-unpaid-room-fee-payments/`)*

Returns all unpaid room fee `Bill` entries (`is_paid=False`) in the selected period along with `room_payment_due_date` / `due_date` (derived from `lease.start_date`), `lease_start_date`, `lease_end_date`, `is_overdue`, `days_overdue`, `payment_status`, `already_paid` (net applied), `remaining_balance`, `deposit_refund_at_end_date`, and `lease_rent_credit_balance`. Late payments after the due date remain allowed.

---

## 10. Bill Recorrection Audit Logs

Two endpoints expose `BillRecorrectionAuditLog` records created whenever electricity bills, water bills, or room fee bills are regenerated/recorrected:

1. **Report Endpoint**: `GET /api/reports/recorrection-logs/`
   - Supports `month` / `start_date` & `end_date` (filters `created_at__date`).
   - Optional filters: `bill_category` (`electricity`, `water`, or `room_fee`), `customer_id`, `room_id`, `billing_month` (`YYYY-MM`).
2. **Resource Endpoint**: `GET /api/recorrection-logs/` and `GET /api/recorrection-logs/<id>/`
   - Supports `bill_category`, `customer_id`, `room_id`, `billing_month`.

---

## 11. Other Existing Report Endpoints

- `GET /api/reports/room-data/` — List of all rooms (`room_number`, `room_type`, `note`, `electricity_credit_balance`, `water_credit_balance`).
- `GET /api/reports/customer-details/` — All customers with their lease summaries and total room-fee payments.
- `GET /api/reports/this-month-charges/` — Room fee `Bill` records in the period.
- `GET /api/reports/room-repairs/` — Regular tenancy `RoomRepair` logs in the period.
- `GET /api/reports/move-out-repairs/` — Separate move-out special room repair (`MoveOutRepair`) records in the period (`total_move_out_repair_cost`, `repairs_count`, `move_out_repairs`).
- `GET /api/reports/electricity-payments/` — Electricity supplier payments summary + `room_breakdown` + `unpaid_electricity_records`.
- `GET /api/reports/water-payments/` — Water supplier payments summary + `room_breakdown` + `unpaid_water_records`.
- `GET /api/reports/profits/` — Accommodation revenue (room fee payments minus repair costs; electricity and water supplier payments are tracked separately under `electricity_payments_to_supplier_excluded` and `water_payments_to_supplier_excluded`).
