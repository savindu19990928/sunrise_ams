# Sunrise AMS API Documentation

**Base URL:** `https://thiranda-813344430767.asia-southeast1.run.app`

---

## Architecture & Authentication Overview

### Authentication Header
All endpoints (except obtaining and refreshing tokens) require active staff/admin user privileges. Requests must include a valid JWT access token in the `Authorization` header:
```http
Authorization: Bearer <access_token>
```

### Standard Response Codes
- `200 OK`: Request succeeded (GET, PUT, PATCH, custom POST actions).
- `201 Created`: Resource successfully created (POST).
- `204 No Content`: Resource successfully deleted (DELETE).
- `400 Bad Request`: Validation failure or missing required fields.
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Insufficient permissions (e.g. non-superuser attempting to create staff).
- `404 Not Found`: Requested resource ID or report type does not exist.

### Core Business Rules
1. **Room Types:**
   - Rooms are strictly restricted to three categories: **`single`**, **`double`**, and **`annex`**.
   - Input validation enforces this on room creation and updates. Rooms can be filtered using `GET /api/rooms/?room_type=annex`.
2. **Deposit Deduction Stop Rule & Lease Data Ownership:**
   - Minimum deposit threshold, base rent fee, base deposit, and all payment data (excluding utilities) are recorded directly on the `Lease` model.
   - Active leases deduct a set monthly amount (`monthly_deposit_deduction`) from the tenant's deposit each billing cycle.
   - While the tenant's remaining deposit (`current_deposit_balance`) is greater than `minimum_deposit_threshold`, the monthly deposit deduction is subtracted and capped so the deposit balance does not drop below this threshold.
   - When the remaining deposit is equal to or lower than `minimum_deposit_threshold`, monthly deposit deductions stop completely (`0.00` deducted), and the customer pays the full `rent_fee`.
3. **Utility Supplier Bank Account Details:**
   - The entire system / building maintains official utility supplier bank account details (for Ceylon Electricity Board and National Water Supply and Drainage Board).
   - Bank account numbers default to **`123456789`** for both electricity and water.
   - Staff/admin can retrieve and update these bank details at any time via `GET/PUT/PATCH/POST /api/utility-supplier-accounts/` or alias `GET/PUT/PATCH/POST /api/utilities/supplier-bank-details/`.
4. **Monthly Building Utility Calculation & Supplier Usage Difference:**
   - Admin inputs the month's total building electricity and water bills alongside each room's consumed electricity and water units via `POST /api/utilities/building-bill/`.
   - Admin also enters the building's total usage according to the supplier bills: `supplier_electricity_units` and `supplier_water_units`.
   - The system automatically calculates:
     - Per-unit prices: `electricity_unit_price = total_building_electricity_bill / sum(room_electricity_usages)` and `water_unit_price = total_building_water_bill / sum(room_water_usages)`.
     - Usage discrepancies: `electricity_units_difference = supplier_electricity_units - sum(room_electricity_usages)` and `water_units_difference = supplier_water_units - sum(room_water_usages)`.
   - All rooms initially receive this identical per-unit price for the month.
   - **Changing Room Unit Prices**: Admin can customize or override the unit price for any individual room via `POST /api/utilities/{id}/set-unit-prices/`, which automatically recalculates that room's costs.
   - **Room Utility History**: The multi-month utility history of any room is queryable via `GET /api/rooms/{id}/utility-history/` or `GET /api/utilities/room-history/?room_id={id}`.
   - **Monthly All-Rooms Summary**: Complete room-by-room utility metrics and bills for a selected month are queryable via `GET /api/utilities/monthly-summary/?billing_month=YYYY-MM`.
5. **Strict Separation of Utility Payments & Lease Payments:**
   - Utility payments and lease rent payments **must NEVER be mixed**:
     - **Lease Payments:** Recorded via `POST /api/payments/` (`Payment` model with foreign key `lease`, `bill`). These represent rental income for the accommodation business.
     - **Utility Payments:** Recorded via `POST /api/utilities/{id}/record-payment/` or `POST /api/utility-payments/` (`UtilityPayment` model with foreign key `utility_record`).
   - Tenants pay utility bills directly to utility suppliers. When a customer notifies staff that their utility bills are paid (or provides a bank transfer/counter receipt reference), staff records it via the utility payment endpoint.
   - Utility payments are completely pass-through and **must NOT be recorded as business or accommodation income**. In financial reports (`GET /api/reports/profits/`), utility payments are explicitly excluded from `total_revenue`. A dedicated report (`GET /api/reports/utility-payments/`) tracks supplier payments and unpaid records.
6. **Customer Overpayments & Advance Utility Credit Balance:**
   - Customers may pay more than their billed utility amount to the supplier (e.g. paying advance or rounding up).
   - When an overpayment is recorded via `POST /api/utilities/{id}/record-payment/` or `POST /api/utility-payments/` (`amount_paid > remaining_cost`), the excess amount is automatically credited to the room's advance utility credit balance (`room.utility_credit_balance`).
   - When subsequent monthly utility bills are generated via `POST /api/utilities/building-bill/`, any available `room.utility_credit_balance` is **automatically applied to cover or reduce the new month's bill**:
     - If `credit >= new_bill`: bill is marked fully paid (`is_paid = True`), an auto-payment record with `receipt_reference="ADVANCE-CREDIT"` is created, and credit is decremented.
     - If `credit < new_bill`: credit is applied as a partial payment, credit drops to `0.00`, and remaining balance is left due.
   - Staff can also manually apply credit at any time via `POST /api/utilities/{id}/apply-credit/` or check credit via `GET /api/rooms/{id}/utility-credit/`.
7. **Leaving Room & Repair Deduction:**
   - When a customer is leaving the room (`POST /api/leases/{id}/terminate/`, `POST /api/leases/{id}/leave-room/`, or `POST /api/customers/{id}/leave-room/`), the system automatically deducts all repair costs from their remaining deposit balance:
     - All pre-existing undeducted repairs recorded for the lease (`RoomRepair` records with `deducted_from_deposit=False`).
     - Any new move-out repairs passed in the termination request payload (either via `repair_cost` or `repairs` list).
   - All deducted repairs are marked as `deducted_from_deposit=True` and `completed`.
   - The remaining deposit refund is calculated and returned (`final_deposit_refund`). If repair costs exceed the deposit, `final_deposit_refund` is `0.00` and the outstanding damage cost is returned in `amount_owed_by_customer`.
8. **Auto-clearing Bills on Payment:**
   - Recording lease rent payments accumulates against the bill's `total_amount_due`. When fully paid, the bill's `is_paid` status automatically flips to `true`.
   - Utility payments made to suppliers accumulate against the utility record's `total_cost`. When fully settled, `utility_record.is_paid` automatically flips to `true`.

---

## Table of Contents
1. [Authentication Endpoints](#1-authentication-endpoints)
2. [Staff Management](#2-staff-management)
3. [Rooms API](#3-rooms-api)
4. [Customers API](#4-customers-api)
5. [Immediate Contacts API](#5-immediate-contacts-api)
6. [Leases API](#6-leases-api)
7. [Utility Supplier Bank Accounts API](#7-utility-supplier-bank-accounts-api)
8. [Utility Records & Building Utilities API](#8-utility-records--building-utilities-api)
9. [Utility Payments to Suppliers & Overpayment Credits API](#9-utility-payments-to-suppliers--overpayment-credits-api)
10. [Bills API](#10-bills-api)
11. [Payments API (Lease Rent)](#11-payments-api-lease-rent)
12. [Room Repairs API](#12-room-repairs-api)
13. [Notifications & Action Items API](#13-notifications--action-items-api)
14. [Reports API](#14-reports-api)
15. [Common Error Responses](#15-common-error-responses)

---

## 1. Authentication Endpoints

### 1.1 Obtain JWT Token
- **Endpoint:** `POST /api/auth/token/`
- **Summary:** Authenticates a staff or superuser with username and password, returning a JWT access token (valid 1 day) and refresh token (valid 7 days).
- **Example Request:**
  ```http
  POST /api/auth/token/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Content-Type: application/json

  {
    "username": "admin",
    "password": "yourpassword"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzYwMjgxNjAwLCJqdGkiOiJmOGE2OTI1NyIsInVzZXJfaWQiOjF9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIiLCJleHAiOjE3NjA4ODY0MDAsImp0aSI6ImIzOWM4MTI4IiwidXNlcl9pZCI6MX0..."
  }
  ```

### 1.2 Refresh JWT Token
- **Endpoint:** `POST /api/auth/token/refresh/`
- **Summary:** Refreshes an expired access token using an unexpired refresh token.
- **Example Request:**
  ```http
  POST /api/auth/token/refresh/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Content-Type: application/json

  {
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIiLCJleHAiOjE3NjA4ODY0MDAsImp0aSI6ImIzOWM4MTI4IiwidXNlcl9pZCI6MX0..."
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzYwMjg1MjAwLCJqdGkiOiJjNzM4NzgxYSIsInVzZXJfaWQiOjF9..."
  }
  ```

---

## 2. Staff Management

### 2.1 Create Staff User
- **Endpoint:** `POST /api/staff/`
- **Summary:** Creates a new staff member account with `is_staff=True`. This endpoint is strictly restricted to superusers (`request.user.is_superuser`). Non-superusers receive a `403 Forbidden` response.
- **Example Request:**
  ```http
  POST /api/staff/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <superuser_jwt_token>
  Content-Type: application/json

  {
    "username": "sarath_staff",
    "email": "sarath@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "message": "Staff user created successfully."
  }
  ```

---

## 3. Rooms API

### 3.1 List Rooms
- **Endpoint:** `GET /api/rooms/`
- **Query Parameters:**
  - `room_type` *(optional)*: Filter rooms strictly by type (`single`, `double`, or `annex`). Example: `GET /api/rooms/?room_type=annex`
- **Summary:** Retrieves a complete list of all rental rooms configured in the system, including room numbers, room types (`single`, `double`, `annex`), baseline rent/deposit amounts, and unit rates for electricity and water.
- **Example Request:**
  ```http
  GET /api/rooms/?room_type=annex HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "room_number": "101",
      "room_type": "single",
      "base_rent_fee": "15000.00",
      "base_deposit_amount": "50000.00",
      "monthly_deposit_deduction": "1000.00",
      "electricity_unit_price": "50.00",
      "water_unit_price": "25.00",
      "created_at": "2026-10-10T09:30:00Z"
    },
    {
      "id": 2,
      "room_number": "A201",
      "room_type": "annex",
      "base_rent_fee": "45000.00",
      "base_deposit_amount": "90000.00",
      "monthly_deposit_deduction": "2500.00",
      "electricity_unit_price": "55.00",
      "water_unit_price": "30.00",
      "created_at": "2026-10-10T09:35:00Z"
    }
  ]
  ```

### 3.2 Create Room
- **Endpoint:** `POST /api/rooms/`
- **Summary:** Creates a new rental room. Room numbers must be unique across the system. `room_type` is restricted strictly to `single`, `double`, or `annex` (defaults to `single` if omitted).
- **Example Request:**
  ```http
  POST /api/rooms/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "room_number": "103",
    "room_type": "double",
    "base_rent_fee": "25000.00",
    "base_deposit_amount": "55000.00",
    "monthly_deposit_deduction": "1000.00",
    "electricity_unit_price": "52.00",
    "water_unit_price": "28.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 3,
    "room_number": "103",
    "room_type": "double",
    "base_rent_fee": "25000.00",
    "base_deposit_amount": "55000.00",
    "monthly_deposit_deduction": "1000.00",
    "electricity_unit_price": "52.00",
    "water_unit_price": "28.00",
    "created_at": "2026-10-11T14:10:00Z"
  }
  ```

### 3.3 Retrieve Room
- **Endpoint:** `GET /api/rooms/{id}/`
- **Summary:** Retrieves details of a specific room by its primary key ID.
- **Example Request:**
  ```http
  GET /api/rooms/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "room_number": "101",
    "base_rent_fee": "15000.00",
    "base_deposit_amount": "50000.00",
    "monthly_deposit_deduction": "1000.00",
    "electricity_unit_price": "50.00",
    "water_unit_price": "25.00",
    "created_at": "2026-10-10T09:30:00Z"
  }
  ```

### 3.4 Update Room (Full)
- **Endpoint:** `PUT /api/rooms/{id}/`
- **Summary:** Updates all fields of a specific room. All required fields must be supplied.
- **Example Request:**
  ```http
  PUT /api/rooms/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "room_number": "101",
    "base_rent_fee": "16000.00",
    "base_deposit_amount": "50000.00",
    "monthly_deposit_deduction": "1000.00",
    "electricity_unit_price": "52.00",
    "water_unit_price": "26.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "room_number": "101",
    "base_rent_fee": "16000.00",
    "base_deposit_amount": "50000.00",
    "monthly_deposit_deduction": "1000.00",
    "electricity_unit_price": "52.00",
    "water_unit_price": "26.00",
    "created_at": "2026-10-10T09:30:00Z"
  }
  ```

### 3.5 Partial Update Room
- **Endpoint:** `PATCH /api/rooms/{id}/`
- **Summary:** Modifies one or more specific fields of a room without replacing the entire entity.
- **Example Request:**
  ```http
  PATCH /api/rooms/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "base_rent_fee": "16500.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "room_number": "101",
    "base_rent_fee": "16500.00",
    "base_deposit_amount": "50000.00",
    "monthly_deposit_deduction": "1000.00",
    "electricity_unit_price": "52.00",
    "water_unit_price": "26.00",
    "created_at": "2026-10-10T09:30:00Z"
  }
  ```

### 3.6 Delete Room
- **Endpoint:** `DELETE /api/rooms/{id}/`
- **Summary:** Deletes a room from the system. Caution: Ensure no active leases reference this room.
- **Example Request:**
  ```http
  DELETE /api/rooms/3/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 204 No Content
  ```

### 3.7 View Room Utility History
- **Endpoint:** `GET /api/rooms/{id}/utility-history/` (also aliased at `GET /api/rooms/{id}/utilities/`)
- **Summary:** Retrieves the multi-month utility history for the selected room, ordered from newest to oldest month. Shows electricity and water units, applied per-unit rates, total bills, and supplier payment statuses.
- **Example Request:**
  ```http
  GET /api/rooms/1/utility-history/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 14,
      "room": 1,
      "room_number": "101",
      "room_type": "single",
      "billing_month": "2026-10-01",
      "electricity_units": "45.00",
      "electricity_unit_price": "120.00",
      "electricity_cost": "5400.00",
      "water_units": "18.00",
      "water_unit_price": "85.00",
      "water_cost": "1530.00",
      "total_cost": "6930.00",
      "is_paid": false,
      "total_utility_paid": "0.00",
      "due_date": "2026-10-25"
    },
    {
      "id": 4,
      "room": 1,
      "room_number": "101",
      "room_type": "single",
      "billing_month": "2026-09-01",
      "electricity_units": "40.00",
      "electricity_unit_price": "115.00",
      "electricity_cost": "4600.00",
      "water_units": "15.00",
      "water_unit_price": "80.00",
      "water_cost": "1200.00",
      "total_cost": "5800.00",
      "is_paid": true,
      "total_utility_paid": "5800.00",
      "due_date": "2026-09-25"
    }
  ]
  ```

---

## 4. Customers API

### 4.1 List Customers
- **Endpoint:** `GET /api/customers/`
- **Summary:** Retrieves all customer records. Each customer automatically includes their nested list of `immediate_contacts`.
- **Example Request:**
  ```http
  GET /api/customers/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "immediate_contacts": [
        {
          "id": 1,
          "customer": 1,
          "name": "Mary Doe",
          "relation": "Mother",
          "mobile_number": "0719876543",
          "created_at": "2026-10-10T10:00:00Z"
        },
        {
          "id": 2,
          "customer": 1,
          "name": "Peter Doe",
          "relation": "Brother",
          "mobile_number": "0771122334",
          "created_at": "2026-10-10T10:05:00Z"
        }
      ],
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "0712345678",
      "nic_number": "901234567V",
      "address": "123 Main St, Colombo 01",
      "created_at": "2026-10-10T09:50:00Z"
    }
  ]
  ```

### 4.2 Create Customer
- **Endpoint:** `POST /api/customers/`
- **Summary:** Registers a new customer in the system. `nic_number` must be unique. `minimum_deposit_threshold` is required (aliases `deposit_threshold` and `min_deposit_amount` are also accepted). When deposit balance falls to or below this threshold, monthly deposit deductions stop. Immediate contacts can be added subsequently via the Immediate Contacts API.
- **Example Request:**
  ```http
  POST /api/customers/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "first_name": "Kamal",
    "last_name": "Perera",
    "email": "kamal.perera@example.com",
    "phone": "0771234567",
    "nic_number": "951234567V",
    "address": "78 Temple Rd, Kandy",
    "minimum_deposit_threshold": "10000.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 3,
    "immediate_contacts": [],
    "first_name": "Kamal",
    "last_name": "Perera",
    "email": "kamal.perera@example.com",
    "phone": "0771234567",
    "nic_number": "951234567V",
    "address": "78 Temple Rd, Kandy",
    "minimum_deposit_threshold": "10000.00",
    "created_at": "2026-10-11T14:20:00Z"
  }
  ```

### 4.3 Retrieve Customer
- **Endpoint:** `GET /api/customers/{id}/`
- **Summary:** Retrieves details for a specific customer, including all associated immediate contact details and deposit threshold.
- **Example Request:**
  ```http
  GET /api/customers/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "immediate_contacts": [
      {
        "id": 1,
        "customer": 1,
        "name": "Mary Doe",
        "relation": "Mother",
        "mobile_number": "0719876543",
        "created_at": "2026-10-10T10:00:00Z"
      }
    ],
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "0712345678",
    "nic_number": "901234567V",
    "address": "123 Main St, Colombo 01",
    "minimum_deposit_threshold": "10000.00",
    "created_at": "2026-10-10T09:50:00Z"
  }
  ```

### 4.4 Update Customer (Full)
- **Endpoint:** `PUT /api/customers/{id}/`
- **Summary:** Replaces all customer personal details including minimum deposit threshold.
- **Example Request:**
  ```http
  PUT /api/customers/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "first_name": "John",
    "last_name": "Doe",
    "email": "johndoe.new@example.com",
    "phone": "0712345678",
    "nic_number": "901234567V",
    "address": "123 Main St, Apt 4B, Colombo 01",
    "minimum_deposit_threshold": "12000.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "immediate_contacts": [
      {
        "id": 1,
        "customer": 1,
        "name": "Mary Doe",
        "relation": "Mother",
        "mobile_number": "0719876543",
        "created_at": "2026-10-10T10:00:00Z"
      }
    ],
    "first_name": "John",
    "last_name": "Doe",
    "email": "johndoe.new@example.com",
    "phone": "0712345678",
    "nic_number": "901234567V",
    "address": "123 Main St, Apt 4B, Colombo 01",
    "minimum_deposit_threshold": "12000.00",
    "created_at": "2026-10-10T09:50:00Z"
  }
  ```

### 4.5 Partial Update Customer
- **Endpoint:** `PATCH /api/customers/{id}/`
- **Summary:** Modifies specific fields of a customer profile (e.g. phone, address, or minimum_deposit_threshold).
- **Example Request:**
  ```http
  PATCH /api/customers/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "minimum_deposit_threshold": "15000.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "immediate_contacts": [
      {
        "id": 1,
        "customer": 1,
        "name": "Mary Doe",
        "relation": "Mother",
        "mobile_number": "0719876543",
        "created_at": "2026-10-10T10:00:00Z"
      }
    ],
    "first_name": "John",
    "last_name": "Doe",
    "email": "johndoe.new@example.com",
    "phone": "0712345678",
    "nic_number": "901234567V",
    "address": "123 Main St, Apt 4B, Colombo 01",
    "minimum_deposit_threshold": "15000.00",
    "created_at": "2026-10-10T09:50:00Z"
  }
  ```

### 4.6 Delete Customer
- **Endpoint:** `DELETE /api/customers/{id}/`
- **Summary:** Deletes a customer profile and associated records.
- **Example Request:**
  ```http
  DELETE /api/customers/3/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 204 No Content
  ```

### 4.7 Customer Leave Room
- **Endpoint:** `POST /api/customers/{id}/leave-room/`
- **Summary:** Action when a customer is leaving their rented room. Automatically finds their active lease, ends it (`active=False`, `end_date=today`), deducts all undeducted repairs (plus any optional move-out repair submitted in request body) from their remaining deposit balance, and calculates the final refund.
- **Example Request:**
  ```http
  POST /api/customers/1/leave-room/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "repair_cost": 2500.00,
    "repair_description": "Wall touchup and tap replacement"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Lease terminated.",
    "lease_id": 1,
    "room_number": "101",
    "customer_id": 1,
    "customer_name": "John Doe",
    "deposit_before_repairs": "45000.00",
    "total_repairs_deducted": "2500.00",
    "final_deposit_refund": "42500.00",
    "amount_owed_by_customer": "0.00",
    "current_deposit_balance": "42500.00",
    "deducted_repairs": [
      {
        "id": 5,
        "description": "Wall touchup and tap replacement",
        "cost": "2500.00",
        "date_logged": "2026-10-11",
        "status": "completed"
      }
    ]
  }
  ```
  ```

---

## 5. Immediate Contacts API

### 5.1 List Immediate Contacts
- **Endpoint:** `GET /api/immediate-contacts/`
- **Summary:** Retrieves all immediate contacts across customers. Optionally filter by customer ID via query parameter `?customer_id=<id>`.
- **Query Parameters:**
  - `customer_id` *(optional, integer)*: Filter contacts belonging to a specific customer.
- **Example Request:**
  ```http
  GET /api/immediate-contacts/?customer_id=1 HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "customer": 1,
      "name": "Mary Doe",
      "relation": "Mother",
      "mobile_number": "0719876543",
      "created_at": "2026-10-10T10:00:00Z"
    },
    {
      "id": 2,
      "customer": 1,
      "name": "Peter Doe",
      "relation": "Brother",
      "mobile_number": "0771122334",
      "created_at": "2026-10-10T10:05:00Z"
    }
  ]
  ```

### 5.2 Create Immediate Contact
- **Endpoint:** `POST /api/immediate-contacts/`
- **Summary:** Adds an immediate emergency/family contact for an existing customer.
- **Example Request:**
  ```http
  POST /api/immediate-contacts/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "customer": 1,
    "name": "Sunil Doe",
    "relation": "Father",
    "mobile_number": "0715566778"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 3,
    "customer": 1,
    "name": "Sunil Doe",
    "relation": "Father",
    "mobile_number": "0715566778",
    "created_at": "2026-10-11T14:25:00Z"
  }
  ```

### 5.3 Retrieve Immediate Contact
- **Endpoint:** `GET /api/immediate-contacts/{id}/`
- **Summary:** Retrieves details of a specific immediate contact entry.
- **Example Request:**
  ```http
  GET /api/immediate-contacts/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "customer": 1,
    "name": "Mary Doe",
    "relation": "Mother",
    "mobile_number": "0719876543",
    "created_at": "2026-10-10T10:00:00Z"
  }
  ```

### 5.4 Update Immediate Contact (Full)
- **Endpoint:** `PUT /api/immediate-contacts/{id}/`
- **Summary:** Updates all fields of an immediate contact record.
- **Example Request:**
  ```http
  PUT /api/immediate-contacts/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "customer": 1,
    "name": "Mary Doe",
    "relation": "Mother",
    "mobile_number": "0719876000"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "customer": 1,
    "name": "Mary Doe",
    "relation": "Mother",
    "mobile_number": "0719876000",
    "created_at": "2026-10-10T10:00:00Z"
  }
  ```

### 5.5 Partial Update Immediate Contact
- **Endpoint:** `PATCH /api/immediate-contacts/{id}/`
- **Summary:** Partially updates fields such as name, relation, or mobile number of an immediate contact.
- **Example Request:**
  ```http
  PATCH /api/immediate-contacts/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "mobile_number": "0719876111"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "customer": 1,
    "name": "Mary Doe",
    "relation": "Mother",
    "mobile_number": "0719876111",
    "created_at": "2026-10-10T10:00:00Z"
  }
  ```

### 5.6 Delete Immediate Contact
- **Endpoint:** `DELETE /api/immediate-contacts/{id}/`
- **Summary:** Permanently removes an immediate contact record.
- **Example Request:**
  ```http
  DELETE /api/immediate-contacts/3/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 204 No Content
  ```

---

## 6. Leases API

### 6.1 List Leases
- **Endpoint:** `GET /api/leases/`
- **Summary:** Retrieves all leases. Responses automatically include agreement parameters, customer/room metadata, and dynamic calculations:
  - `minimum_deposit_threshold`: Threshold below which deposit deductions stop for this lease.
  - `base_rent_fee` & `base_deposit`: Baseline rent and deposit recorded on the lease agreement.
  - `total_payments_received`: Sum of all lease rent payments collected for this lease.
  - `current_applicable_deposit_deduction`: Amount to be deducted this month (capped at remaining deposit balance, 0 if deposit is at or below threshold).
  - `effective_rent_fee`: Net rent fee payable by the tenant (`rent_fee - current_applicable_deposit_deduction`).
- **Example Request:**
  ```http
  GET /api/leases/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "room": 1,
      "room_number": "101",
      "room_type": "single",
      "customer": 1,
      "customer_name": "Kasun Perera",
      "start_date": "2026-01-01",
      "end_date": null,
      "active": true,
      "base_rent_fee": "15000.00",
      "base_deposit": "50000.00",
      "minimum_deposit_threshold": "10000.00",
      "rent_fee": "15000.00",
      "initial_deposit": "50000.00",
      "current_deposit_balance": "49000.00",
      "monthly_deposit_deduction": "1000.00",
      "current_applicable_deposit_deduction": "1000.00",
      "effective_rent_fee": "14000.00",
      "total_payments_received": "30000.00",
      "created_at": "2026-01-01T08:00:00Z"
    }
  ]
  ```

### 6.2 Create Lease
- **Endpoint:** `POST /api/leases/`
- **Summary:** Creates a new lease agreement assigning a customer to a room. Accepts `base_rent_fee`, `base_deposit`, and `minimum_deposit_threshold` (falls back automatically to room/customer values if omitted).
- **Example Request:**
  ```http
  POST /api/leases/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "customer": 2,
    "room": 2,
    "start_date": "2026-11-01",
    "active": true,
    "base_rent_fee": "20000.00",
    "base_deposit": "60000.00",
    "minimum_deposit_threshold": "12000.00",
    "rent_fee": "20000.00",
    "initial_deposit": "60000.00",
    "current_deposit_balance": "60000.00",
    "monthly_deposit_deduction": "1200.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 2,
    "room": 2,
    "room_number": "102",
    "room_type": "double",
    "customer": 2,
    "customer_name": "Jane Silva",
    "start_date": "2026-11-01",
    "end_date": null,
    "active": true,
    "base_rent_fee": "20000.00",
    "base_deposit": "60000.00",
    "minimum_deposit_threshold": "12000.00",
    "rent_fee": "20000.00",
    "initial_deposit": "60000.00",
    "current_deposit_balance": "60000.00",
    "monthly_deposit_deduction": "1200.00",
    "current_applicable_deposit_deduction": "1200.00",
    "effective_rent_fee": "18800.00",
    "total_payments_received": "0.00",
    "created_at": "2026-10-11T14:30:00Z"
  }
  ```

### 6.3 Retrieve Lease
- **Endpoint:** `GET /api/leases/{id}/`
- **Summary:** Retrieves details of a specific lease including live calculated deposit deductions.
- **Example Request:**
  ```http
  GET /api/leases/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "current_applicable_deposit_deduction": "1000.00",
    "effective_rent_fee": "14000.00",
    "customer": 1,
    "room": 1,
    "start_date": "2026-01-01",
    "end_date": null,
    "active": true,
    "rent_fee": "15000.00",
    "initial_deposit": "50000.00",
    "current_deposit_balance": "49000.00",
    "monthly_deposit_deduction": "1000.00",
    "created_at": "2026-01-01T08:00:00Z"
  }
  ```

### 6.4 Update Lease (Full)
- **Endpoint:** `PUT /api/leases/{id}/`
- **Summary:** Completely updates an existing lease agreement.
- **Example Request:**
  ```http
  PUT /api/leases/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "customer": 1,
    "room": 1,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "active": true,
    "rent_fee": "15500.00",
    "initial_deposit": "50000.00",
    "current_deposit_balance": "45000.00",
    "monthly_deposit_deduction": "1000.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "current_applicable_deposit_deduction": "1000.00",
    "effective_rent_fee": "14500.00",
    "customer": 1,
    "room": 1,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "active": true,
    "rent_fee": "15500.00",
    "initial_deposit": "50000.00",
    "current_deposit_balance": "45000.00",
    "monthly_deposit_deduction": "1000.00",
    "created_at": "2026-01-01T08:00:00Z"
  }
  ```

### 6.5 Partial Update Lease
- **Endpoint:** `PATCH /api/leases/{id}/`
- **Summary:** Modifies specific fields of a lease agreement.
- **Example Request:**
  ```http
  PATCH /api/leases/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "monthly_deposit_deduction": "1500.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "current_applicable_deposit_deduction": "1500.00",
    "effective_rent_fee": "14000.00",
    "customer": 1,
    "room": 1,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "active": true,
    "rent_fee": "15500.00",
    "initial_deposit": "50000.00",
    "current_deposit_balance": "45000.00",
    "monthly_deposit_deduction": "1500.00",
    "created_at": "2026-01-01T08:00:00Z"
  }
  ```

### 6.6 Delete Lease
- **Endpoint:** `DELETE /api/leases/{id}/`
- **Summary:** Removes a lease record from the system.
- **Example Request:**
  ```http
  DELETE /api/leases/2/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 204 No Content
  ```

### 6.7 Terminate Lease (Customer Leaving Room)
- **Endpoint:** `POST /api/leases/{id}/terminate/` (also available via `POST /api/leases/{id}/leave-room/`)
- **Summary:** Ends an active lease when a tenant vacates. Automatically sets `active=False` and `end_date=today`. Automatically gathers all pending and completed undeducted repair costs logged during the tenancy, plus any new move-out repairs submitted in the request payload (`repair_cost` or `repairs` array). Deducts all repairs directly from the remaining deposit (`current_deposit_balance`), marks the repairs as `deducted_from_deposit=True`, and calculates the net deposit refund (`final_deposit_refund`) and any outstanding balance owed (`amount_owed_by_customer`).
- **Example Request:**
  ```http
  POST /api/leases/1/terminate/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "repair_cost": 2500.00,
    "repair_description": "Wall repainting and lock replacement"
  }
  ```
- **Example Request with multiple repairs:**
  ```http
  POST /api/leases/1/terminate/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "repairs": [
      { "cost": 1500.00, "description": "Door latch repair" },
      { "cost": 2000.00, "description": "Balcony cleaning and painting" }
    ]
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Lease terminated.",
    "lease_id": 1,
    "room_number": "101",
    "customer_id": 1,
    "customer_name": "John Doe",
    "deposit_before_repairs": "45000.00",
    "total_repairs_deducted": "2500.00",
    "final_deposit_refund": "42500.00",
    "amount_owed_by_customer": "0.00",
    "current_deposit_balance": "42500.00",
    "deducted_repairs": [
      {
        "id": 1,
        "description": "Fix leaking bathroom faucet",
        "cost": "1200.00",
        "date_logged": "2026-10-05",
        "status": "completed"
      },
      {
        "id": 2,
        "description": "Wall repainting and lock replacement",
        "cost": "1300.00",
        "date_logged": "2026-10-11",
        "status": "completed"
      }
    ]
  }
  ```

---

## 7. Utility Supplier Bank Accounts API

The entire building / system maintains centralized bank account records for utility providers (electricity and water). Customers transfer or deposit their utility bill payments directly into these accounts and provide payment receipts or references to staff.

### 7.1 Retrieve Utility Supplier Bank Details
- **Endpoints:**
  - `GET /api/utility-supplier-accounts/` (Primary)
  - `GET /api/utilities/supplier-bank-details/` (Convenience Alias)
- **Summary:** Retrieves official bank account information for electricity and water utility suppliers. Account numbers default to **`123456789`** for both electricity and water upon first query if not previously configured.
- **Example Request:**
  ```http
  GET /api/utility-supplier-accounts/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "electricity_supplier_name": "Ceylon Electricity Board (CEB)",
    "electricity_bank_name": "Bank of Ceylon",
    "electricity_branch": "Main Branch",
    "electricity_account_name": "Ceylon Electricity Board",
    "electricity_account_number": "123456789",
    "water_supplier_name": "National Water Supply and Drainage Board (NWSDB)",
    "water_bank_name": "Bank of Ceylon",
    "water_branch": "Main Branch",
    "water_account_name": "National Water Supply and Drainage Board",
    "water_account_number": "123456789",
    "notes": "Please transfer utility payments to the respective supplier bank account and provide the transaction receipt reference.",
    "updated_at": "2026-10-16T18:30:00Z"
  }
  ```

### 7.2 Update Utility Supplier Bank Details
- **Endpoints:**
  - `POST /api/utility-supplier-accounts/` or `PUT /api/utility-supplier-accounts/current/` or `PATCH /api/utility-supplier-accounts/current/`
  - `POST /api/utilities/supplier-bank-details/` or `PUT /api/utilities/supplier-bank-details/`
- **Summary:** Updates official supplier bank accounts, branches, or reference instructions for electricity and water. Updates persist in the database singleton.
- **Example Request:**
  ```http
  POST /api/utility-supplier-accounts/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "electricity_bank_name": "Commercial Bank",
    "electricity_branch": "Kollupitiya Branch",
    "electricity_account_name": "Ceylon Electricity Board",
    "electricity_account_number": "123456789",
    "water_bank_name": "Bank of Ceylon",
    "water_branch": "Main Branch",
    "water_account_name": "National Water Supply and Drainage Board",
    "water_account_number": "123456789",
    "notes": "Include your Room Number as payment reference on bank deposit slip or online transfer."
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "electricity_supplier_name": "Ceylon Electricity Board (CEB)",
    "electricity_bank_name": "Commercial Bank",
    "electricity_branch": "Kollupitiya Branch",
    "electricity_account_name": "Ceylon Electricity Board",
    "electricity_account_number": "123456789",
    "water_supplier_name": "National Water Supply and Drainage Board (NWSDB)",
    "water_bank_name": "Bank of Ceylon",
    "water_branch": "Main Branch",
    "water_account_name": "National Water Supply and Drainage Board",
    "water_account_number": "123456789",
    "notes": "Include your Room Number as payment reference on bank deposit slip or online transfer.",
    "updated_at": "2026-10-16T18:35:00Z"
  }
  ```

---

## 8. Utility Records & Building Utilities API

### 8.1 List Utility Records
- **Endpoint:** `GET /api/utilities/`
- **Summary:** Retrieves monthly utility records recorded for rooms. Each record includes unit rates, costs, payments made, remaining balance, and the room's current credit balance.
- **Example Request:**
  ```http
  GET /api/utilities/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "room": 1,
      "room_number": "101",
      "room_type": "single",
      "customer_name": "Kasun Perera",
      "billing_month": "2026-10-01",
      "electricity_units": "60.00",
      "electricity_unit_price": "120.00",
      "electricity_cost": "7200.00",
      "water_units": "30.00",
      "water_unit_price": "120.00",
      "water_cost": "3600.00",
      "total_cost": "10800.00",
      "total_utility_paid": "10800.00",
      "remaining_balance": "0.00",
      "room_credit_balance": "0.00",
      "is_paid": true,
      "due_date": "2026-10-28",
      "created_at": "2026-10-05T09:00:00Z"
    }
  ]
  ```

### 8.2 Create Utility Record
- **Endpoint:** `POST /api/utilities/`
- **Summary:** Records monthly electricity and water metrics for an individual room.
- **Example Request:**
  ```http
  POST /api/utilities/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "room": 1,
    "billing_month": "2026-11-01",
    "electricity_units": "40.00",
    "electricity_unit_price": "60.00",
    "water_units": "25.00",
    "water_unit_price": "35.00",
    "due_date": "2026-11-25"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 2,
    "room": 1,
    "room_number": "101",
    "room_type": "single",
    "billing_month": "2026-11-01",
    "electricity_units": "40.00",
    "electricity_unit_price": "60.00",
    "electricity_cost": "2400.00",
    "water_units": "25.00",
    "water_unit_price": "35.00",
    "water_cost": "875.00",
    "total_cost": "3275.00",
    "total_utility_paid": "0.00",
    "remaining_balance": "3275.00",
    "room_credit_balance": "0.00",
    "is_paid": false,
    "due_date": "2026-11-25",
    "created_at": "2026-10-16T14:40:00Z"
  }
  ```

### 8.3 Retrieve Utility Record
- **Endpoint:** `GET /api/utilities/{id}/`
- **Summary:** Retrieves details of a specific utility record, including payment receipts, remaining amount due, and room credit balance.

### 8.4 Update Utility Record (Full)
- **Endpoint:** `PUT /api/utilities/{id}/`
- **Summary:** Fully updates a utility record and recalculates costs.

### 8.5 Partial Update Utility Record
- **Endpoint:** `PATCH /api/utilities/{id}/`
- **Summary:** Partially updates fields in a utility record.

### 8.6 Delete Utility Record
- **Endpoint:** `DELETE /api/utilities/{id}/`
- **Summary:** Deletes a utility record.

### 8.7 Mark Utility Bill Paid
- **Endpoint:** `POST /api/utilities/{id}/mark_paid/`
- **Summary:** Sets `is_paid=True` on a utility record.

### 8.8 Enter Monthly Building Utility Bill & Calculate Room Rates
- **Endpoint:** `POST /api/utilities/building-bill/`
- **Summary:** Enters each month's total building electricity and water bills, **supplier usage readings** (`supplier_electricity_units`, `supplier_water_units`), and each room's individual meter readings.
  - Computes per-unit prices: `electricity_unit_price = total_electricity_bill / sum(room_electricity_units)` and `water_unit_price = total_water_bill / sum(room_water_units)`.
  - Records supplier usage so frontend can compare supplier data with the sum of room meters (`electricity_units_difference` = `supplier_units - room_sum`, `water_units_difference` = `supplier_units - room_sum`).
  - **Advance Credit Handling:** If any room has an existing `utility_credit_balance > 0` from past customer overpayments, the backend **automatically applies that credit toward this new month's bill** (`receipt_reference="ADVANCE-CREDIT"`), reducing the room credit balance and auto-clearing the bill if fully covered.
- **Example Request:**
  ```http
  POST /api/utilities/building-bill/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "billing_month": "2026-10-01",
    "total_electricity_bill": 24000.00,
    "total_water_bill": 12000.00,
    "supplier_electricity_units": 215.00,
    "supplier_water_units": 108.00,
    "due_date": "2026-10-28",
    "room_usages": [
      {
        "room_number": "101",
        "electricity_units": 60.00,
        "water_units": 30.00
      },
      {
        "room_number": "102",
        "electricity_units": 80.00,
        "water_units": 40.00
      },
      {
        "room_number": "A201",
        "electricity_units": 60.00,
        "water_units": 30.00
      }
    ]
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "message": "Successfully calculated monthly utilities for 2026-10.",
    "billing_month": "2026-10-01",
    "building_utility_bill": {
      "id": 1,
      "billing_month": "2026-10-01",
      "total_electricity_bill": "24000.00",
      "total_water_bill": "12000.00",
      "total_electricity_units": "200.00",
      "total_water_units": "100.00",
      "supplier_electricity_units": "215.00",
      "supplier_water_units": "108.00",
      "electricity_units_difference": "15.00",
      "water_units_difference": "8.00",
      "electricity_unit_price": "120.00",
      "water_unit_price": "120.00",
      "due_date": "2026-10-28"
    },
    "electricity_unit_price": "120.00",
    "water_unit_price": "120.00",
    "total_electricity_units": "200.00",
    "total_water_units": "100.00",
    "supplier_electricity_units": "215.00",
    "supplier_water_units": "108.00",
    "electricity_units_difference": "15.00",
    "water_units_difference": "8.00",
    "total_building_usage": {
      "electricity_units": "200.00",
      "water_units": "100.00"
    },
    "supplier_usage": {
      "electricity_units": "215.00",
      "water_units": "108.00"
    },
    "usage_difference": {
      "electricity_units_difference": "15.00",
      "water_units_difference": "8.00"
    },
    "rooms_utility_records": [
      {
        "id": 10,
        "room": 1,
        "room_number": "101",
        "room_type": "single",
        "billing_month": "2026-10-01",
        "electricity_units": "60.00",
        "electricity_unit_price": "120.00",
        "electricity_cost": "7200.00",
        "water_units": "30.00",
        "water_unit_price": "120.00",
        "water_cost": "3600.00",
        "total_cost": "10800.00",
        "room_credit_balance": "0.00",
        "is_paid": false,
        "due_date": "2026-10-28"
      }
    ]
  }
  ```

### 8.9 View Monthly All-Rooms Utility Summary
- **Endpoint:** `GET /api/utilities/monthly-summary/`
- **Query Parameters:**
  - `billing_month` *(required)*: Month in `YYYY-MM` or `YYYY-MM-DD` format (e.g., `?billing_month=2026-10`).
- **Summary:** Returns the selected month's utility data for all rooms, room usages, per-unit rates, total bills, and supplier discrepancies (`supplier_electricity_units`, `electricity_units_difference`, `supplier_water_units`, `water_units_difference`).
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "billing_month": "2026-10-01",
    "building_utility_bill": {
      "id": 1,
      "billing_month": "2026-10-01",
      "total_electricity_bill": "24000.00",
      "total_water_bill": "12000.00",
      "total_electricity_units": "200.00",
      "total_water_units": "100.00",
      "supplier_electricity_units": "215.00",
      "supplier_water_units": "108.00",
      "electricity_units_difference": "15.00",
      "water_units_difference": "8.00",
      "electricity_unit_price": "120.00",
      "water_unit_price": "120.00",
      "due_date": "2026-10-28"
    },
    "rooms_count": 3,
    "total_rooms_utility_cost": "36000.00",
    "supplier_electricity_units": "215.00",
    "supplier_water_units": "108.00",
    "electricity_units_difference": "15.00",
    "water_units_difference": "8.00",
    "rooms_utility_data": [
      {
        "utility_record_id": 10,
        "room_id": 1,
        "room_number": "101",
        "room_type": "single",
        "customer_name": "Kasun Perera",
        "electricity_units": "60.00",
        "electricity_unit_price": "120.00",
        "electricity_cost": "7200.00",
        "water_units": "30.00",
        "water_unit_price": "120.00",
        "water_cost": "3600.00",
        "total_bill": "10800.00",
        "total_cost": "10800.00",
        "is_paid": false,
        "due_date": "2026-10-28",
        "room_credit_balance": "0.00"
      }
    ]
  }
  ```

### 8.10 View Room Utility History
- **Endpoints:**
  - `GET /api/utilities/room-history/?room_id={id}`
  - `GET /api/rooms/{id}/utility-history/`
- **Summary:** Retrieves chronological utility history, usage trends, and costs across all months for a specific room.

### 8.11 Customize / Override Per-Unit Price for Selected Room
- **Endpoint:** `POST /api/utilities/{id}/set-unit-prices/`
- **Summary:** Allows user to change or override the per-unit electricity or water rate for a specific room's utility record. Automatically recalculates `electricity_cost`, `water_cost`, and `total_cost` for that room.
- **Example Request:**
  ```http
  POST /api/utilities/10/set-unit-prices/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "electricity_unit_price": "130.00",
    "water_unit_price": "125.00"
  }
  ```

### 8.12 View Room Utility Credit Balance
- **Endpoints:**
  - `GET /api/rooms/{id}/utility-credit/`
  - `GET /api/utilities/room-credit/?room_id={id}`
- **Summary:** Returns the current advance utility credit balance available for a room accumulated from customer overpayments to utility suppliers.
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "room_id": 1,
    "room_number": "101",
    "room_type": "single",
    "utility_credit_balance": "2000.00"
  }
  ```

---

## 9. Utility Payments to Suppliers & Overpayment Credits API

Utility payments and lease rent payments **must NEVER be mixed up**:
- **Lease Rent Payments:** Handled by `POST /api/payments/` (`Payment` model, recorded as business income).
- **Utility Supplier Payments:** Handled by `POST /api/utilities/{id}/record-payment/` or `POST /api/utility-payments/` (`UtilityPayment` model, paid directly to supplier, **excluded from business income**).

### 9.1 Record Utility Payment & Handle Overpayments
- **Endpoint:** `POST /api/utilities/{id}/record-payment/`
- **Summary:** Records that a customer has paid their utility bill directly to the supplier.
  - Takes `amount_paid`, `receipt_reference` (e.g. CEB / NWSDB transaction ID), and optional `payment_date` and `notes`.
  - **Overpayment Handling:** If a customer pays **more than the bill amount** (e.g., bill is Rs. 6,000.00 and customer paid Rs. 8,000.00 to the supplier), the system marks the bill paid (`is_paid = true`) and automatically adds the excess Rs. 2,000.00 to the room's advance utility credit balance (`room.utility_credit_balance`).
  - **Future Bill Integration:** In subsequent months when building utility bills are entered (`POST /api/utilities/building-bill/`), this advance credit is automatically deducted to cover or reduce the tenant's new bill!
- **Example Request (With Overpayment):**
  ```http
  POST /api/utilities/10/record-payment/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "amount_paid": 8000.00,
    "payment_date": "2026-10-20",
    "receipt_reference": "CEB-ONLINE-TXN-998822",
    "notes": "Customer transferred 8000 to CEB account (includes 2000 advance payment)"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "message": "Utility payment of 8000.00 recorded directly to utility supplier. Overpayment of 2000.00 credited to Room 101 (current utility credit balance: 2000.00).",
    "payment": {
      "id": 5,
      "utility_record": 10,
      "room_number": "101",
      "billing_month": "2026-10-01",
      "amount_paid": "8000.00",
      "payment_date": "2026-10-20",
      "paid_to_supplier": true,
      "receipt_reference": "CEB-ONLINE-TXN-998822",
      "notes": "Customer transferred 8000 to CEB account (includes 2000 advance payment)"
    },
    "utility_record": {
      "id": 10,
      "room": 1,
      "room_number": "101",
      "total_cost": "6000.00",
      "total_utility_paid": "8000.00",
      "remaining_balance": "0.00",
      "room_credit_balance": "2000.00",
      "is_paid": true
    },
    "amount_paid": "8000.00",
    "excess_credit_added": "2000.00",
    "room_utility_credit_balance": "2000.00",
    "room_number": "101",
    "paid_to_supplier": true
  }
  ```

### 9.2 Manually Apply Advance Utility Credit to Unpaid Bill
- **Endpoint:** `POST /api/utilities/{id}/apply-credit/`
- **Summary:** Manually applies available room utility credit balance towards an unpaid utility record. If `amount` is omitted in the request body, automatically applies `min(room.utility_credit_balance, remaining_balance)`.
- **Example Request:**
  ```http
  POST /api/utilities/11/apply-credit/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "amount": "1500.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Successfully applied 1500.00 credit to Room 101 utility bill.",
    "credit_applied": "1500.00",
    "remaining_room_credit": "500.00",
    "utility_record": {
      "id": 11,
      "room": 1,
      "room_number": "101",
      "total_cost": "1500.00",
      "total_utility_paid": "1500.00",
      "remaining_balance": "0.00",
      "room_credit_balance": "500.00",
      "is_paid": true
    },
    "payment": {
      "id": 6,
      "utility_record": 11,
      "amount_paid": "1500.00",
      "receipt_reference": "CREDIT-APPLIED",
      "paid_to_supplier": true
    }
  }
  ```

### 9.3 List All Utility Payments to Suppliers
- **Endpoint:** `GET /api/utility-payments/`
- **Summary:** Retrieves all payments made to utility suppliers across all rooms. Supports query filters:
  - `?room_id=<id>`: Filter by room.
  - `?billing_month=YYYY-MM`: Filter by billing month.

### 9.4 Create Utility Payment Record Directly
- **Endpoint:** `POST /api/utility-payments/`
- **Summary:** Creates a `UtilityPayment` record directly. If `amount_paid` exceeds the bill's remaining amount due, the excess is automatically deposited into `room.utility_credit_balance`.

### 9.5 Building Utilities Overview
- **Endpoint:** `GET /api/building-utilities/`
- **Summary:** Lists all building-level monthly utility bills received from suppliers, including `supplier_electricity_units`, `supplier_water_units`, and discrepancies with room meter sums.

---

## 10. Bills API

### 10.1 List Bills
- **Endpoint:** `GET /api/bills/`
- **Summary:** Retrieves all bills. Includes `net_rent` (`rent_fee - deposit_deducted`), rent, utilities, deposit deductions, and payment status.
- **Example Request:**
  ```http
  GET /api/bills/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "net_rent": "14000.00",
      "lease": 1,
      "billing_month": "2026-10-01",
      "rent_fee": "15000.00",
      "electricity_cost": "1500.00",
      "water_cost": "500.00",
      "deposit_deducted": "1000.00",
      "deposit_remaining": "49000.00",
      "total_amount_due": "16000.00",
      "due_date": "2026-10-05",
      "is_paid": false,
      "created_at": "2026-10-01T06:00:00Z"
    }
  ]
  ```

### 10.2 Create Manual Bill
- **Endpoint:** `POST /api/bills/`
- **Summary:** Manually creates a bill for a lease. Note: It is usually recommended to use `POST /api/bills/generate_monthly/` to auto-calculate and deduct deposit balances according to system rules.
- **Example Request:**
  ```http
  POST /api/bills/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "lease": 1,
    "billing_month": "2026-11-01",
    "rent_fee": "15000.00",
    "electricity_cost": "2000.00",
    "water_cost": "600.00",
    "deposit_deducted": "1000.00",
    "deposit_remaining": "48000.00",
    "total_amount_due": "16600.00",
    "due_date": "2026-11-05",
    "is_paid": false
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 2,
    "net_rent": "14000.00",
    "lease": 1,
    "billing_month": "2026-11-01",
    "rent_fee": "15000.00",
    "electricity_cost": "2000.00",
    "water_cost": "600.00",
    "deposit_deducted": "1000.00",
    "deposit_remaining": "48000.00",
    "total_amount_due": "16600.00",
    "due_date": "2026-11-05",
    "is_paid": false,
    "created_at": "2026-10-11T14:45:00Z"
  }
  ```

### 10.3 Retrieve Bill Details
- **Endpoint:** `GET /api/bills/{id}/`
- **Summary:** Retrieves comprehensive bill details (using `BillDetailSerializer`). Automatically embeds:
  - `customer`: Full customer profile and contact numbers.
  - `room`: Room configuration details.
  - `previous_utilities`: Utility records from the previous 2 billing months for trend comparison.
- **Example Request:**
  ```http
  GET /api/bills/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "customer": {
      "id": 1,
      "immediate_contacts": [
        {
          "id": 1,
          "customer": 1,
          "name": "Mary Doe",
          "relation": "Mother",
          "mobile_number": "0719876543",
          "created_at": "2026-10-10T10:00:00Z"
        }
      ],
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "0712345678",
      "nic_number": "901234567V",
      "address": "123 Main St, Colombo 01",
      "created_at": "2026-10-10T09:50:00Z"
    },
    "room": {
      "id": 1,
      "room_number": "101",
      "base_rent_fee": "15000.00",
      "base_deposit_amount": "50000.00",
      "monthly_deposit_deduction": "1000.00",
      "electricity_unit_price": "50.00",
      "water_unit_price": "25.00",
      "created_at": "2026-10-10T09:30:00Z"
    },
    "previous_utilities": [
      {
        "id": 10,
        "electricity_unit_price": "50.00",
        "water_unit_price": "25.00",
        "total_cost": "1800.00",
        "room": 1,
        "billing_month": "2026-09-01",
        "electricity_units": "28.00",
        "water_units": "16.00",
        "electricity_cost": "1400.00",
        "water_cost": "400.00",
        "is_paid": true,
        "due_date": "2026-09-25",
        "created_at": "2026-09-05T08:00:00Z"
      },
      {
        "id": 5,
        "electricity_unit_price": "50.00",
        "water_unit_price": "25.00",
        "total_cost": "1950.00",
        "room": 1,
        "billing_month": "2026-08-01",
        "electricity_units": "30.00",
        "water_units": "18.00",
        "electricity_cost": "1500.00",
        "water_cost": "450.00",
        "is_paid": true,
        "due_date": "2026-08-25",
        "created_at": "2026-08-05T08:00:00Z"
      }
    ],
    "net_rent": "14000.00",
    "lease": 1,
    "billing_month": "2026-10-01",
    "rent_fee": "15000.00",
    "electricity_cost": "1500.00",
    "water_cost": "500.00",
    "deposit_deducted": "1000.00",
    "deposit_remaining": "49000.00",
    "total_amount_due": "16000.00",
    "due_date": "2026-10-05",
    "is_paid": false,
    "created_at": "2026-10-01T06:00:00Z"
  }
  ```

### 10.4 Update Bill (Full)
- **Endpoint:** `PUT /api/bills/{id}/`
- **Summary:** Completely updates an existing bill's fields.
- **Example Request:**
  ```http
  PUT /api/bills/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "lease": 1,
    "billing_month": "2026-10-01",
    "rent_fee": "15000.00",
    "electricity_cost": "1500.00",
    "water_cost": "500.00",
    "deposit_deducted": "1000.00",
    "deposit_remaining": "49000.00",
    "total_amount_due": "16000.00",
    "due_date": "2026-10-10",
    "is_paid": false
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "net_rent": "14000.00",
    "lease": 1,
    "billing_month": "2026-10-01",
    "rent_fee": "15000.00",
    "electricity_cost": "1500.00",
    "water_cost": "500.00",
    "deposit_deducted": "1000.00",
    "deposit_remaining": "49000.00",
    "total_amount_due": "16000.00",
    "due_date": "2026-10-10",
    "is_paid": false,
    "created_at": "2026-10-01T06:00:00Z"
  }
  ```

### 10.5 Partial Update Bill
- **Endpoint:** `PATCH /api/bills/{id}/`
- **Summary:** Updates specific fields of a bill (e.g. extending the due date or toggling paid status).
- **Example Request:**
  ```http
  PATCH /api/bills/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "due_date": "2026-10-15"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "net_rent": "14000.00",
    "lease": 1,
    "billing_month": "2026-10-01",
    "rent_fee": "15000.00",
    "electricity_cost": "1500.00",
    "water_cost": "500.00",
    "deposit_deducted": "1000.00",
    "deposit_remaining": "49000.00",
    "total_amount_due": "16000.00",
    "due_date": "2026-10-15",
    "is_paid": false,
    "created_at": "2026-10-01T06:00:00Z"
  }
  ```

### 10.6 Delete Bill
- **Endpoint:** `DELETE /api/bills/{id}/`
- **Summary:** Deletes a bill from the system.
- **Example Request:**
  ```http
  DELETE /api/bills/2/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 204 No Content
  ```

### 10.7 Generate Monthly Bills (Batch)
- **Endpoint:** `POST /api/bills/generate_monthly/`
- **Summary:** Automatically generates consolidated monthly bills for all active leases for a specified month:
  - Takes any date in the target month (normalizes to 1st of month).
  - Skips leases that already have a bill generated for that month.
  - Pulls electricity and water costs from the room's `UtilityRecord` for that month (defaults to 0.00 if missing).
  - Deducts `monthly_deposit_deduction` from `lease.current_deposit_balance` (deduction stops completely when remaining deposit balance is at or below `lease.minimum_deposit_threshold`).
  - Sets `due_date` automatically to the 5th of that month.
- **Example Request:**
  ```http
  POST /api/bills/generate_monthly/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "billing_month": "2026-11-01"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Generated 2 bills.",
    "bill_ids": [3, 4]
  }
  ```

---

## 11. Payments API (Lease Rent)

### 11.1 List Payments
- **Endpoint:** `GET /api/payments/`
- **Summary:** Retrieves all customer lease payment receipts recorded in the system. Each payment is directly linked to both the `bill` and the corresponding `lease`.
- **Example Request:**
  ```http
  GET /api/payments/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "bill": 1,
      "lease": 1,
      "amount_paid": "10000.00",
      "payment_date": "2026-10-10",
      "created_at": "2026-10-10T11:00:00Z"
    }
  ]
  ```

### 11.2 Record Payment
- **Endpoint:** `POST /api/payments/`
- **Summary:** Records a payment against a bill. Automatically links `payment.lease` to `bill.lease`.
  - Automatically calculates cumulative payments for the bill.
  - If cumulative payments meet or exceed `bill.total_amount_due`, automatically updates `bill.is_paid = True`.
- **Example Request:**
  ```http
  POST /api/payments/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "bill": 1,
    "amount_paid": "6000.00",
    "payment_date": "2026-10-12"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 2,
    "bill": 1,
    "amount_paid": "6000.00",
    "payment_date": "2026-10-12",
    "created_at": "2026-10-12T04:15:00Z"
  }
  ```

### 11.3 Retrieve Payment
- **Endpoint:** `GET /api/payments/{id}/`
- **Summary:** Retrieves details of a specific payment transaction.
- **Example Request:**
  ```http
  GET /api/payments/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "bill": 1,
    "amount_paid": "10000.00",
    "payment_date": "2026-10-10",
    "created_at": "2026-10-10T11:00:00Z"
  }
  ```

### 11.4 Update Payment (Full)
- **Endpoint:** `PUT /api/payments/{id}/`
- **Summary:** Updates all fields of a payment record.
- **Example Request:**
  ```http
  PUT /api/payments/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "bill": 1,
    "amount_paid": "11000.00",
    "payment_date": "2026-10-10"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "bill": 1,
    "amount_paid": "11000.00",
    "payment_date": "2026-10-10",
    "created_at": "2026-10-10T11:00:00Z"
  }
  ```

### 11.5 Partial Update Payment
- **Endpoint:** `PATCH /api/payments/{id}/`
- **Summary:** Partially updates fields of a payment record.
- **Example Request:**
  ```http
  PATCH /api/payments/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "amount_paid": "10500.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "bill": 1,
    "amount_paid": "10500.00",
    "payment_date": "2026-10-10",
    "created_at": "2026-10-10T11:00:00Z"
  }
  ```

### 11.6 Delete Payment
- **Endpoint:** `DELETE /api/payments/{id}/`
- **Summary:** Deletes a payment record.
- **Example Request:**
  ```http
  DELETE /api/payments/2/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 204 No Content
  ```

### 11.7 Get Overdue Payments
- **Endpoint:** `GET /api/payments/overdue/`
- **Summary:** Scans all unpaid bills where `due_date < today`. Returns customer name, room number, due date, number of days overdue, and outstanding owed amount.
- **Example Request:**
  ```http
  GET /api/payments/overdue/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "bill_id": 1,
      "customer": "John Doe",
      "room": "101",
      "due_date": "2026-10-05",
      "days_overdue": 6,
      "owed": "6000.00"
    }
  ]
  ```

---

## 12. Room Repairs API

### 12.1 List Repairs
- **Endpoint:** `GET /api/repairs/`
- **Summary:** Retrieves all room maintenance and repair tasks logged across leases.
- **Example Request:**
  ```http
  GET /api/repairs/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "lease": 1,
      "description": "Fix leaking bathroom faucet",
      "cost": "1200.00",
      "status": "pending",
      "is_completed": false,
      "date_logged": "2026-10-05",
      "completed_date": null,
      "created_at": "2026-10-05T08:30:00Z"
    },
    {
      "id": 2,
      "lease": 2,
      "description": "Repaint bedroom door frame",
      "cost": "2500.00",
      "status": "completed",
      "is_completed": true,
      "date_logged": "2026-09-10",
      "completed_date": "2026-09-12",
      "created_at": "2026-09-10T10:00:00Z"
    }
  ]
  ```

### 12.2 Create Repair
- **Endpoint:** `POST /api/repairs/`
- **Summary:** Logs a new repair requirement for a lease. Valid statuses: `pending`, `in_progress`, `completed`.
- **Example Request:**
  ```http
  POST /api/repairs/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "lease": 1,
    "description": "Replace ceiling fan switch",
    "cost": "1500.00",
    "status": "pending",
    "date_logged": "2026-10-11"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 201 Created
  Content-Type: application/json

  {
    "id": 3,
    "lease": 1,
    "description": "Replace ceiling fan switch",
    "cost": "1500.00",
    "status": "pending",
    "is_completed": false,
    "date_logged": "2026-10-11",
    "completed_date": null,
    "created_at": "2026-10-11T14:50:00Z"
  }
  ```

### 12.3 Retrieve Repair
- **Endpoint:** `GET /api/repairs/{id}/`
- **Summary:** Retrieves details of a specific repair entry.
- **Example Request:**
  ```http
  GET /api/repairs/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "lease": 1,
    "description": "Fix leaking bathroom faucet",
    "cost": "1200.00",
    "status": "pending",
    "is_completed": false,
    "date_logged": "2026-10-05",
    "completed_date": null,
    "created_at": "2026-10-05T08:30:00Z"
  }
  ```

### 12.4 Update Repair (Full)
- **Endpoint:** `PUT /api/repairs/{id}/`
- **Summary:** Fully updates a repair task's details. If `status` is set to `completed` or `is_completed` is set to `true`, the completion date is automatically assigned today's date if not already provided.
- **Example Request:**
  ```http
  PUT /api/repairs/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "lease": 1,
    "description": "Fix leaking bathroom faucet and replace washer",
    "cost": "1400.00",
    "status": "in_progress",
    "is_completed": false,
    "date_logged": "2026-10-05"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "lease": 1,
    "description": "Fix leaking bathroom faucet and replace washer",
    "cost": "1400.00",
    "status": "in_progress",
    "is_completed": false,
    "date_logged": "2026-10-05",
    "completed_date": null,
    "created_at": "2026-10-05T08:30:00Z"
  }
  ```

### 12.5 Partial Update Repair
- **Endpoint:** `PATCH /api/repairs/{id}/`
- **Summary:** Updates individual fields of a repair ticket.
- **Example Request:**
  ```http
  PATCH /api/repairs/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "cost": "1350.00"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "lease": 1,
    "description": "Fix leaking bathroom faucet and replace washer",
    "cost": "1350.00",
    "status": "in_progress",
    "is_completed": false,
    "date_logged": "2026-10-05",
    "completed_date": null,
    "created_at": "2026-10-05T08:30:00Z"
  }
  ```

### 12.6 Delete Repair
- **Endpoint:** `DELETE /api/repairs/{id}/`
- **Summary:** Permanently removes a repair ticket.
- **Example Request:**
  ```http
  DELETE /api/repairs/3/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 204 No Content
  ```

### 12.7 Mark Repair Completed
- **Endpoint:** `POST /api/repairs/{id}/complete/`
- **Summary:** Quick-action endpoint that marks a pending/in-progress repair ticket as completed: sets `status="completed"`, `is_completed=True`, and `completed_date=today`.
- **Example Request:**
  ```http
  POST /api/repairs/1/complete/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {}
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "message": "Repair 1 marked as completed.",
    "status": "completed",
    "is_completed": true
  }
  ```

---

## 13. Notifications & Action Items API

### 13.1 Get Consolidated Notifications
- **Endpoint:** `GET /api/notifications/`
- **Summary:** Comprehensive operational dashboard action center providing 4 key operational sections and a top-level summary:
  1. `payments_to_collect`: Unpaid/partially-paid bills sorted by overdue urgency, including customer contact numbers and immediate family/emergency contacts.
  2. `repairs_to_do`: Uncompleted room repairs with elapsed days pending.
  3. `utility_bills_to_pay`: Unpaid room utility records due to utility providers.
  4. `missing_utility_records`: Active leases missing utility readings for the current calendar month.
- **Query Parameters:**
  - `type` *(optional, string)*: Filter notifications by category. Valid values: `payments`, `repairs`, `utilities`. If omitted, returns all sections.
- **Example Request:**
  ```http
  GET /api/notifications/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "summary": {
      "total_action_items": 4,
      "payments_to_collect_count": 1,
      "overdue_payments_count": 1,
      "total_payment_amount_to_collect": "6000.00",
      "repairs_pending_count": 1,
      "total_estimated_repair_cost": "1200.00",
      "unpaid_utility_bills_count": 1,
      "total_utility_bills_to_pay": "2000.00",
      "missing_utility_records_count": 1
    },
    "payments_to_collect": [
      {
        "bill_id": 1,
        "lease_id": 1,
        "room_number": "101",
        "customer_id": 1,
        "customer_name": "John Doe",
        "customer_phone": "0712345678",
        "customer_email": "john.doe@example.com",
        "immediate_contacts": [
          {
            "name": "Mary Doe",
            "relation": "Mother",
            "mobile_number": "0719876543"
          }
        ],
        "billing_month": "2026-10-01",
        "due_date": "2026-10-05",
        "total_amount_due": "16000.00",
        "paid_amount": "10000.00",
        "outstanding_amount": "6000.00",
        "is_overdue": true,
        "days_overdue": 6,
        "days_until_due": 0,
        "status": "OVERDUE"
      }
    ],
    "repairs_to_do": [
      {
        "repair_id": 1,
        "lease_id": 1,
        "room_number": "101",
        "customer_name": "John Doe",
        "customer_phone": "0712345678",
        "description": "Fix leaking bathroom faucet",
        "cost": "1200.00",
        "status": "pending",
        "date_logged": "2026-10-05",
        "days_pending": 6
      }
    ],
    "utility_bills_to_pay": [
      {
        "utility_record_id": 1,
        "room_number": "101",
        "billing_month": "2026-10-01",
        "electricity_cost": "1500.00",
        "water_cost": "500.00",
        "total_cost": "2000.00",
        "due_date": "2026-10-25",
        "is_paid": false,
        "is_overdue": false,
        "days_overdue": 0
      }
    ],
    "missing_utility_records": [
      {
        "room_number": "102",
        "customer_name": "Jane Smith",
        "billing_month": "2026-10-01",
        "message": "Utility readings for Room 102 have not been recorded for 2026-10."
      }
    ]
  }
  ```

### 13.2 Filter Notifications by Category
- **Endpoint:** `GET /api/notifications/?type=payments` (or `?type=repairs`, `?type=utilities`)
- **Summary:** Returns only the summary plus the requested action category array.
- **Example Request:**
  ```http
  GET /api/notifications/?type=repairs HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "summary": {
      "total_action_items": 4,
      "payments_to_collect_count": 1,
      "overdue_payments_count": 1,
      "total_payment_amount_to_collect": "6000.00",
      "repairs_pending_count": 1,
      "total_estimated_repair_cost": "1200.00",
      "unpaid_utility_bills_count": 1,
      "total_utility_bills_to_pay": "2000.00",
      "missing_utility_records_count": 1
    },
    "repairs_to_do": [
      {
        "repair_id": 1,
        "lease_id": 1,
        "room_number": "101",
        "customer_name": "John Doe",
        "customer_phone": "0712345678",
        "description": "Fix leaking bathroom faucet",
        "cost": "1200.00",
        "status": "pending",
        "date_logged": "2026-10-05",
        "days_pending": 6
      }
    ]
  }
  ```

---

## 14. Reports API

All reporting endpoints accept optional `start_date` and `end_date` parameters formatted as `YYYY-MM-DD`. If omitted, default date range spans from the 1st day of the current calendar month to the current date.

### 14.1 Room Data Report
- **Endpoint:** `GET /api/reports/room-data/`
- **Summary:** Generates an overview of all rooms and their baseline rental and utility rate metrics.
- **Example Request:**
  ```http
  GET /api/reports/room-data/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "room_number": "101",
      "base_rent_fee": "15000.00",
      "base_deposit_amount": "50000.00",
      "monthly_deposit_deduction": "1000.00",
      "electricity_unit_price": "50.00",
      "water_unit_price": "25.00",
      "created_at": "2026-10-10T09:30:00Z"
    },
    {
      "id": 2,
      "room_number": "102",
      "base_rent_fee": "20000.00",
      "base_deposit_amount": "60000.00",
      "monthly_deposit_deduction": "1200.00",
      "electricity_unit_price": "55.00",
      "water_unit_price": "30.00",
      "created_at": "2026-10-10T09:35:00Z"
    }
  ]
  ```

### 14.2 Customer Details Report
- **Endpoint:** `GET /api/reports/customer-details/`
- **Summary:** Generates a comprehensive customer report including profile data, assigned rooms, room type (`single`, `double`, `annex`), lease baseline rent & deposit, minimum deposit threshold, deposit paid, current remaining deposit, and total payments made.
- **Example Request:**
  ```http
  GET /api/reports/customer-details/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "customer": {
        "id": 1,
        "immediate_contacts": [
          {
            "id": 1,
            "customer": 1,
            "name": "Mary Doe",
            "relation": "Mother",
            "mobile_number": "0719876543",
            "created_at": "2026-10-10T10:00:00Z"
          }
        ],
        "first_name": "Kasun",
        "last_name": "Perera",
        "email": "kasun.p@example.com",
        "phone": "0712345678",
        "nic_number": "901234567V",
        "address": "123 Main St, Colombo 01",
        "minimum_deposit_threshold": "10000.00",
        "created_at": "2026-10-10T09:50:00Z"
      },
      "leases": [
        {
          "lease_id": 1,
          "room": "101",
          "room_type": "single",
          "base_rent_fee": "15000.00",
          "base_deposit": "50000.00",
          "minimum_deposit_threshold": "10000.00",
          "deposit_paid": "50000.00",
          "current_deposit": "49000.00",
          "total_payments": 30000.00
        }
      ]
    }
  ]
  ```

### 14.3 Customer Payments Report
- **Endpoint:** `GET /api/reports/customer-payments/`
- **Summary:** Retrieves all accommodation rent payments made by a specific customer within a date range. `customer_id` query parameter is required.
- **Query Parameters:**
  - `customer_id` *(required, integer)*: Target customer ID.
  - `start_date` *(optional, string YYYY-MM-DD)*: Filter start date.
  - `end_date` *(optional, string YYYY-MM-DD)*: Filter end date.
- **Example Request:**
  ```http
  GET /api/reports/customer-payments/?customer_id=1&start_date=2026-10-01&end_date=2026-10-31 HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "bill": 1,
      "amount_paid": "10000.00",
      "payment_date": "2026-10-10",
      "created_at": "2026-10-10T11:00:00Z"
    }
  ]
  ```

### 14.4 All Payments Report
- **Endpoint:** `GET /api/reports/all-payments/`
- **Summary:** Lists all payment transactions received across all rooms and customers within the given date range.
- **Query Parameters:**
  - `start_date` *(optional, string YYYY-MM-DD)*: Defaults to 1st of current month.
  - `end_date` *(optional, string YYYY-MM-DD)*: Defaults to current date.
- **Example Request:**
  ```http
  GET /api/reports/all-payments/?start_date=2026-10-01&end_date=2026-10-31 HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "payment_id": 1,
      "amount": "10000.00",
      "date": "2026-10-10",
      "customer": "John",
      "room": "101"
    }
  ]
  ```

### 14.5 This Month Charges Report
- **Endpoint:** `GET /api/reports/this-month-charges/`
- **Summary:** Retrieves all bills whose `billing_month` falls within the specified date interval.
- **Query Parameters:**
  - `start_date` *(optional, string YYYY-MM-DD)*
  - `end_date` *(optional, string YYYY-MM-DD)*
- **Example Request:**
  ```http
  GET /api/reports/this-month-charges/?start_date=2026-10-01&end_date=2026-10-31 HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "net_rent": "14000.00",
      "lease": 1,
      "billing_month": "2026-10-01",
      "rent_fee": "15000.00",
      "electricity_cost": "1500.00",
      "water_cost": "500.00",
      "deposit_deducted": "1000.00",
      "deposit_remaining": "49000.00",
      "total_amount_due": "16000.00",
      "due_date": "2026-10-05",
      "is_paid": false,
      "created_at": "2026-10-01T06:00:00Z"
    }
  ]
  ```

### 14.6 Room Repairs Report
- **Endpoint:** `GET /api/reports/room-repairs/`
- **Summary:** Lists all room repairs logged within the specified date range, with costs and room identifiers.
- **Query Parameters:**
  - `start_date` *(optional, string YYYY-MM-DD)*
  - `end_date` *(optional, string YYYY-MM-DD)*
- **Example Request:**
  ```http
  GET /api/reports/room-repairs/?start_date=2026-10-01&end_date=2026-10-31 HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "repair_id": 1,
      "room": "101",
      "cost": "1200.00",
      "date": "2026-10-05",
      "description": "Fix leaking bathroom faucet"
    }
  ]
  ```

### 14.7 Profits Report (Excludes Utility Payments)
- **Endpoint:** `GET /api/reports/profits/`
- **Summary:** Calculates net operating profit across the accommodation business for the given date range:
  - `total_revenue`: Sum of all lease rent payments collected (`lease_revenue`).
  - `total_expenses`: Sum of all maintenance and repair costs (`total_repair_costs`).
  - `net_profit`: `total_revenue - total_expenses`.
  - `utility_payments_to_suppliers_excluded`: Displays utility payments paid to suppliers for audit transparency, verifying they are strictly excluded from business income.
  - `room_profits`: Net profit breakdown by room.
- **Query Parameters:**
  - `start_date` *(optional, string YYYY-MM-DD)*
  - `end_date` *(optional, string YYYY-MM-DD)*
- **Example Request:**
  ```http
  GET /api/reports/profits/?start_date=2026-10-01&end_date=2026-10-31 HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "period": {
      "start": "2026-10-01",
      "end": "2026-10-31"
    },
    "total_revenue": "45000.00",
    "lease_revenue": "45000.00",
    "total_expenses": "3500.00",
    "total_repair_costs": "3500.00",
    "total_profit": "41500.00",
    "net_profit": "41500.00",
    "utility_payments_to_suppliers_excluded": "18000.00",
    "room_profits": {
      "101": 21500.0,
      "102": 20000.0
    },
    "note": "Utility bills are paid by customers to utility suppliers directly and are not recorded as accommodation income."
  }
  ```

### 14.8 Utility Payments to Suppliers Report
- **Endpoint:** `GET /api/reports/utility-payments/`
- **Summary:** Dedicated financial report listing all utility payments made directly to utility suppliers (CEB, Water Board) within the selected date range. Shows room breakdowns, supplier receipt references, total amounts paid, and currently unpaid utility records.
- **Query Parameters:**
  - `start_date` *(optional, string YYYY-MM-DD)*: Start of date filter.
  - `end_date` *(optional, string YYYY-MM-DD)*: End of date filter.
- **Example Request:**
  ```http
  GET /api/reports/utility-payments/?start_date=2026-10-01&end_date=2026-10-31 HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "period": {
      "start": "2026-10-01",
      "end": "2026-10-31"
    },
    "total_paid_to_suppliers": "18000.00",
    "total_utility_payments_to_suppliers": "18000.00",
    "payments_count": 2,
    "room_breakdown": {
      "101": 10800.0,
      "102": 7200.0
    },
    "payments": [
      {
        "payment_id": 1,
        "utility_record_id": 10,
        "room_number": "101",
        "room_type": "single",
        "customer_name": "Kasun Perera",
        "billing_month": "2026-10-01",
        "amount_paid": "10800.00",
        "payment_date": "2026-10-20",
        "paid_to_supplier": true,
        "receipt_reference": "CEB-REC-202610-8844",
        "notes": "Paid directly at CEB bill counter"
      }
    ],
    "unpaid_utility_records": [
      {
        "utility_record_id": 12,
        "room_number": "A201",
        "room_type": "annex",
        "billing_month": "2026-10-01",
        "total_cost": "10800.00",
        "due_date": "2026-10-28"
      }
    ],
    "note": "Utility bills are paid directly to the utility supplier by customers and are not recorded as accommodation income."
  }
  ```

---

## 15. Common Error Responses

### 15.1 Missing or Expired Token (401 Unauthorized)
- **Status:** `401 Unauthorized`
- **Response:**
  ```json
  {
    "detail": "Given token not valid for any token type",
    "code": "token_not_valid",
    "messages": [
      {
        "token_class": "AccessToken",
        "token_type": "access",
        "message": "Token is invalid or expired"
      }
    ]
  }
  ```

### 15.2 Insufficient Permissions (403 Forbidden)
- **Status:** `403 Forbidden`
- **Response:**
  ```json
  {
    "error": "Only superusers can create staff accounts."
  }
  ```

### 15.3 Validation Error (400 Bad Request)
- **Status:** `400 Bad Request`
- **Response:**
  ```json
  {
    "room_number": [
      "room with this room number already exists."
    ]
  }
  ```

### 15.4 Resource Not Found (404 Not Found)
- **Status:** `404 Not Found`
- **Response:**
  ```json
  {
    "detail": "No Room matches the given query."
  }
  ```
