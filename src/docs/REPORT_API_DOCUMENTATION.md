# ThirandaSystem Report API Documentation

This document covers all reporting endpoints exposed under `/api/reports/<report_type>/` and the audit log endpoint `/api/recorrection-logs/`.

> **Important Payment Separation Rule**
> - **Room Fee Payments** (`Payment`, `Lease.rent_credit_balance`) are paid to the **property owner** (`payment_recipient: "property_owner"`).
> - **Utility Bill Payments** (`UtilityPayment`, `Room.utility_credit_balance`) are paid to the **utility supplier** (`payment_recipient: "utility_supplier"`).
> - Room fee payments and utility bill payments are **never mixed**.

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
  "total_room_fee_paid": "25000.00",
  "payments_count": 1,
  "payments": [
    {
      "payment_id": 12,
      "bill_id": 8,
      "billing_month": "2026-04-01",
      "lease_id": 3,
      "room_number": "101",
      "room_type": "AC",
      "amount_paid": "25000.00",
      "payment_date": "2026-04-05",
      "receipt_reference": "RENT-001",
      "notes": null,
      "bill_total_due": "25000.00",
      "bill_is_paid": true
    }
  ]
}
```

---

## 2. Customer Utility Bill Payments (Paid to Utility Supplier)

`GET /api/reports/customer-utility-payments/?customer_id=<id>`

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
  "payment_recipient": "utility_supplier",
  "total_utility_paid": "6000.00",
  "payments_count": 1,
  "payments": [
    {
      "payment_id": 19,
      "utility_record_id": 14,
      "billing_month": "2026-04-01",
      "room_id": 2,
      "room_number": "101",
      "room_type": "AC",
      "amount_paid": "6000.00",
      "payment_date": "2026-04-10",
      "receipt_reference": "CEB-8812",
      "paid_to_supplier": true,
      "notes": "Paid directly to CEB",
      "utility_total_cost": "5000.00",
      "utility_is_paid": true
    }
  ]
}
```

---

## 3. All Customers Room Fee Payments (Paid to Property Owner)

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
      "room_type": "AC",
      "amount_paid": "25000.00",
      "payment_date": "2026-04-05",
      "receipt_reference": "RENT-001",
      "notes": null
    }
  ]
}
```

---

## 4. All Customers Utility Bill Payments (Paid to Utility Supplier)

`GET /api/reports/all-utility-payments/`  
*(Alias: `GET /api/reports/all-customers-utility-payments/`)*

*(Also see `GET /api/reports/utility-payments/` for the combined summary with `room_breakdown` and `unpaid_utility_records`.)*

### Sample Response (`200 OK`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "payment_recipient": "utility_supplier",
  "total_utility_paid": "12400.00",
  "payments_count": 2,
  "payments": [
    {
      "payment_id": 19,
      "utility_record_id": 14,
      "billing_month": "2026-04-01",
      "room_id": 2,
      "room_number": "101",
      "room_type": "AC",
      "customer_id": 1,
      "customer_name": "John Doe",
      "amount_paid": "6000.00",
      "payment_date": "2026-04-10",
      "receipt_reference": "CEB-8812",
      "paid_to_supplier": true,
      "notes": null
    }
  ]
}
```

---

## 5. All Unpaid Utility Bill Payments of All Customers

`GET /api/reports/unpaid-utility-bills/`  
*(Alias: `GET /api/reports/all-unpaid-utility-payments/`)*

Returns all unpaid `UtilityRecord` entries (`is_paid=False`) in the selected period along with `already_paid` (net applied), `remaining_balance`, and `room_utility_credit_balance`.

### Sample Response (`200 OK`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "payment_recipient": "utility_supplier",
  "unpaid_count": 1,
  "total_unpaid_amount": "2500.00",
  "unpaid_bills": [
    {
      "utility_record_id": 15,
      "room_id": 2,
      "room_number": "101",
      "room_type": "AC",
      "customer_id": 1,
      "customer_name": "John Doe",
      "billing_month": "2026-04-01",
      "electricity_cost": "5500.00",
      "water_cost": "2000.00",
      "total_cost": "7500.00",
      "already_paid": "5000.00",
      "remaining_balance": "2500.00",
      "due_date": "2026-04-10",
      "room_utility_credit_balance": "0.00"
    }
  ]
}
```

---

## 6. All Unpaid Room Fee Payments of All Customers

`GET /api/reports/unpaid-room-fee-bills/`  
*(Alias: `GET /api/reports/all-unpaid-room-fee-payments/`)*

Returns all unpaid room fee `Bill` entries (`is_paid=False`) in the selected period along with `already_paid` (net applied), `remaining_balance`, and `lease_rent_credit_balance`.

### Sample Response (`200 OK`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "payment_recipient": "property_owner",
  "unpaid_count": 1,
  "total_unpaid_amount": "2500.00",
  "unpaid_bills": [
    {
      "bill_id": 9,
      "lease_id": 3,
      "customer_id": 1,
      "customer_name": "John Doe",
      "room_id": 2,
      "room_number": "101",
      "room_type": "AC",
      "billing_month": "2026-04-01",
      "rent_fee": "7500.00",
      "deposit_deducted": "0.00",
      "total_amount_due": "7500.00",
      "already_paid": "5000.00",
      "remaining_balance": "2500.00",
      "due_date": "2026-04-05",
      "lease_rent_credit_balance": "0.00"
    }
  ]
}
```

---

## 7. Bill Recorrection Audit Logs

Two endpoints expose `BillRecorrectionAuditLog` records created whenever utility bills or room fee bills are regenerated/recorrected:

1. **Report Endpoint**: `GET /api/reports/recorrection-logs/`
   - Supports `month` / `start_date` & `end_date` (filters `created_at__date`).
   - Optional filters: `bill_category` (`utility` or `room_fee`), `customer_id`, `room_id`, `billing_month` (`YYYY-MM`).
2. **Resource Endpoint**: `GET /api/recorrection-logs/` and `GET /api/recorrection-logs/<id>/`
   - Supports `bill_category`, `customer_id`, `room_id`, `billing_month`.

### Sample Response (`GET /api/reports/recorrection-logs/`)
```json
{
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "logs_count": 1,
  "logs": [
    {
      "id": 1,
      "room_number": "101",
      "customer_name": "John Doe",
      "bill_category": "utility",
      "billing_month": "2026-04-01",
      "room": 2,
      "lease": 3,
      "customer": 1,
      "utility_record": 15,
      "bill": null,
      "previous_amount": "7500.00",
      "new_amount": "2000.00",
      "amount_difference": "-5500.00",
      "already_paid_amount": "5000.00",
      "previous_remaining_due": "2500.00",
      "new_remaining_due": "0.00",
      "credit_adjustment": "3000.00",
      "resulting_credit_balance": "3000.00",
      "previous_snapshot": { "total_cost": "7500.00", "is_paid": false },
      "new_snapshot": { "total_cost": "2000.00", "is_paid": true },
      "reason": "Corrected building utility bill total",
      "performed_by": "admin",
      "created_at": "2026-04-12T10:15:00Z"
    }
  ]
}
```

---

## 8. Other Existing Report Endpoints

- `GET /api/reports/room-data/` — List of all rooms (`room_number`, `room_type`, `note`, `utility_credit_balance`).
- `GET /api/reports/customer-details/` — All customers with their lease summaries and total room-fee payments.
- `GET /api/reports/this-month-charges/` — Room fee `Bill` records in the period.
- `GET /api/reports/room-repairs/` — `RoomRepair` logs in the period.
- `GET /api/reports/utility-payments/` — Combined utility supplier payments summary + `room_breakdown` + `unpaid_utility_records`.
- `GET /api/reports/profits/` — Accommodation revenue (room fee payments minus repair costs; utility supplier payments are excluded).

