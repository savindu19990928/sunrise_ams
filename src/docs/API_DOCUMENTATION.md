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
1. **Room Structure & Types:**
   - Rooms contain only `room_number`, `room_type`, and `note` (plus system-managed `electricity_credit_balance`, `water_credit_balance`, and `created_at`). Rooms do **not** store rent fees, deposit amounts, monthly deposit deductions, or default electricity/water rates.
   - Rooms are strictly restricted to three categories: **`single`**, **`double`**, and **`annex`**.
   - Input validation enforces this on room creation and updates. Rooms can be filtered using `GET /api/rooms/?room_type=annex`.
2. **Deposit Deduction Stop Rule & Lease Data Ownership:**
   - Minimum deposit threshold, base rent fee, base deposit, rent fee, initial deposit, current deposit balance, monthly deposit deduction, and all room-fee payment data are recorded directly on the `Lease` model (neither `Room` nor `Customer` owns these fields).
   - Active leases deduct a set monthly amount (`monthly_deposit_deduction`) from the tenant's deposit each billing cycle.
   - While the tenant's remaining deposit (`current_deposit_balance`) is greater than the lease's `minimum_deposit_threshold`, the monthly deposit deduction is subtracted and capped so the deposit balance does not drop below this threshold.
   - When the remaining deposit is equal to or lower than `minimum_deposit_threshold`, monthly deposit deductions stop completely (`0.00` deducted), and the customer pays the full `rent_fee`.
3. **Supplier Bank Account Details (Separate Electricity & Water):**
   - The system maintains official bank account details for **Ceylon Electricity Board (CEB)** and **National Water Supply and Drainage Board (NWSDB)**.
   - Bank account numbers default to **`123456789`** for both electricity and water.
   - Staff/admin can retrieve and update electricity and water bank details separately via `GET/PUT/PATCH/POST /api/electricity-supplier-accounts/` (or `/api/electricity/supplier-bank-details/`) and `GET/PUT/PATCH/POST /api/water-supplier-accounts/` (or `/api/water/supplier-bank-details/`), or together via `/api/utility-supplier-accounts/`.
4. **Separate Meter-Reading Billing (Electricity & Water), Monthly Default Rates & Selected Room Overrides:**
   - Users **never enter raw electricity or water usage units**. Instead, users enter each room's **meter readings** separately for electricity (`electricity_meter_reading`) and water (`water_meter_reading`).
   - Usage units are calculated automatically by the backend as `this_month_meter_reading - previous_month_meter_reading`.
   - Admin submits the month's building electricity bill via `POST /api/electricity/building-bill/` (or `POST /api/building-electricity/`) and the building water bill separately via `POST /api/water/building-bill/` (or `POST /api/building-water/`).
   - The system independently calculates each month's default per-unit rate:
     - `default_electricity_unit_price = total_building_electricity_bill / sum(room_electricity_units)`
     - `default_water_unit_price = total_building_water_bill / sum(room_water_units)`
   - Usage discrepancies are tracked separately: `electricity_units_difference = supplier_electricity_units - sum(room_electricity_units)` and `water_units_difference = supplier_water_units - sum(room_water_units)`.
   - Custom rates for selected rooms can be overridden inline or via `POST /api/electricity/set-unit-prices/` (`/{id}/set-unit-prices/`) and `POST /api/water/set-unit-prices/` (`/{id}/set-unit-prices/`).
   - Previous months' meter readings can be fetched separately via `GET /api/electricity/previous-readings/` and `GET /api/water/previous-readings/` (or per room via `/api/rooms/{id}/previous-electricity-readings/` and `/api/rooms/{id}/previous-water-readings/`).
5. **Strict Three-Way Separation (Property Manager vs. Electricity Supplier vs. Water Supplier):**
   - Monthly payments and records are handled across **three completely separate streams**:
     - **Room Fee Payments** (`Payment`, `Lease.rent_credit_balance`, `POST /api/payments/`): Paid to the **Property Owner / Property Manager** and counted as accommodation income (`total_amount_due = rent_fee - deposit_deducted`).
     - **Electricity Payments** (`ElectricityPayment`, `Room.electricity_credit_balance`, `POST /api/electricity/{id}/record-payment/` or `POST /api/electricity-payments/`): Paid directly to the **Electricity Supplier** and excluded from accommodation income.
     - **Water Payments** (`WaterPayment`, `Room.water_credit_balance`, `POST /api/water/{id}/record-payment/` or `POST /api/water-payments/`): Paid directly to the **Water Supplier** and excluded from accommodation income.
   - **Example:** If a customer has `30,000.00` rent fee, `10,000.00` electricity bill, and `5,000.00` water bill, the gross total across all three is `45,000.00` (`30,000` to property manager, `10,000` directly to electricity supplier, `5,000` directly to water supplier). If ONLY the water bill is paid with an extra `5,000.00` (`10,000.00` paid to water supplier), this month's remaining `total_fee` becomes `40,000.00`, and the extra `5,000.00` is stored in `room.water_credit_balance` and automatically deducted **only** from next month's water bill (leaving electricity and rent unaffected).
6. **Bill Regeneration, Overpayment Reconciliation & Recorrection Audit Logs:**
   - Regenerating electricity bills (`POST /api/electricity/building-bill/`, `/api/building-electricity/`, `/api/electricity/set-unit-prices/`), water bills (`POST /api/water/building-bill/`, `/api/building-water/`, `/api/water/set-unit-prices/`), or room fee bills (`POST /api/bills/regenerate-monthly/` or `POST /api/bills/generate_monthly/` with `regenerate: true`) automatically reconciles existing payments and respective advance credit balances (`Room.electricity_credit_balance`, `Room.water_credit_balance`, `Lease.rent_credit_balance`).
   - Every recorrection creates an immutable `BillRecorrectionAuditLog` entry (`bill_category`: `electricity`, `water`, or `room_fee`) accessible via `GET /api/recorrection-logs/` and `GET /api/reports/recorrection-logs/`.
7. **Report Endpoints Documentation:**
   - Full details and sample payloads for all reporting endpoints are documented in [REPORT_API_DOCUMENTATION.md](REPORT_API_DOCUMENTATION.md).
8. **Leaving Room & Repair Deduction:**
   - When a customer is leaving the room (`POST /api/leases/{id}/terminate/`, `POST /api/leases/{id}/leave-room/`, or `POST /api/customers/{id}/leave-room/`), the system automatically deducts all undeducted repair costs (`RoomRepair` records with `deducted_from_deposit=False`) plus any new move-out repairs from their remaining deposit balance and returns `final_deposit_refund` (or `amount_owed_by_customer`).
9. **Auto-clearing Bills on Payment:**
   - Room fee, electricity, and water payments accumulate independently against `Bill.total_amount_due`, `ElectricityRecord.electricity_cost`, and `WaterRecord.water_cost`, setting each record's `is_paid` to `true` when settled.

---

## Table of Contents
1. [Authentication Endpoints](#1-authentication-endpoints)
2. [Staff Management](#2-staff-management)
3. [Rooms API](#3-rooms-api)
4. [Customers API](#4-customers-api)
5. [Immediate Contacts API](#5-immediate-contacts-api)
6. [Leases API](#6-leases-api)
7. [Supplier Bank Accounts API (Electricity & Water)](#7-supplier-bank-accounts-api-electricity--water)
8. [Electricity & Water Records API (Separate Building & Room Endpoints)](#8-electricity--water-records-api-separate-building--room-endpoints)
9. [Electricity & Water Supplier Payments & Overpayment Credits API](#9-electricity--water-supplier-payments--overpayment-credits-api)
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
- **Summary:** Retrieves all rental rooms configured in the system. Rooms store `room_number`, `room_type` (`single`, `double`, `annex`), `note`, and separate system-managed `electricity_credit_balance`, `water_credit_balance`, and `created_at` (rent, deposit, and monthly unit rates live on leases and monthly electricity/water records).
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
      "note": "Ground floor single room",
      "electricity_credit_balance": "0.00",
      "water_credit_balance": "0.00",
      "created_at": "2026-10-10T09:30:00Z"
    },
    {
      "id": 2,
      "room_number": "A201",
      "room_type": "annex",
      "note": "Private annex with separate entrance",
      "electricity_credit_balance": "500.00",
      "water_credit_balance": "200.00",
      "created_at": "2026-10-10T09:35:00Z"
    }
  ]
  ```

### 3.2 Create Room
- **Endpoint:** `POST /api/rooms/`
- **Summary:** Creates a new rental room. Room numbers must be unique across the system. `room_type` is restricted strictly to `single`, `double`, or `annex` (defaults to `single` if omitted), and `note` is optional.
- **Example Request:**
  ```http
  POST /api/rooms/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "room_number": "103",
    "room_type": "double",
    "note": "Second floor double room with balcony"
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
    "note": "Second floor double room with balcony",
    "electricity_credit_balance": "0.00",
    "water_credit_balance": "0.00",
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
    "room_type": "single",
    "note": "Ground floor single room",
    "electricity_credit_balance": "0.00",
    "water_credit_balance": "0.00",
    "created_at": "2026-10-10T09:30:00Z"
  }
  ```

### 3.4 Update Room (Full)
- **Endpoint:** `PUT /api/rooms/{id}/`
- **Summary:** Updates all editable fields of a specific room (`room_number`, `room_type`, `note`).
- **Example Request:**
  ```http
  PUT /api/rooms/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "room_number": "101",
    "room_type": "single",
    "note": "Newly painted single room"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "room_number": "101",
    "room_type": "single",
    "note": "Newly painted single room",
    "electricity_credit_balance": "0.00",
    "water_credit_balance": "0.00",
    "created_at": "2026-10-10T09:30:00Z"
  }
  ```

### 3.5 Partial Update Room
- **Endpoint:** `PATCH /api/rooms/{id}/`
- **Summary:** Modifies one or more specific fields of a room (`room_number`, `room_type`, `note`).
- **Example Request:**
  ```http
  PATCH /api/rooms/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "note": "AC unit serviced in Oct 2026"
  }
  ```
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  {
    "id": 1,
    "room_number": "101",
    "room_type": "single",
    "note": "AC unit serviced in Oct 2026",
    "electricity_credit_balance": "0.00",
    "water_credit_balance": "0.00",
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

### 3.7 View Room Electricity & Water History
- **Electricity History Endpoint:** `GET /api/rooms/{id}/electricity-history/` (alias `GET /api/rooms/{id}/electricity/`)
- **Water History Endpoint:** `GET /api/rooms/{id}/water-history/` (alias `GET /api/rooms/{id}/water/`)
- **Previous Meter Readings Endpoints:**
  - `GET /api/rooms/{id}/previous-electricity-readings/` (alias `previous-electricity-meter-readings`)
  - `GET /api/rooms/{id}/previous-water-readings/` (alias `previous-water-meter-readings`)
- **Advance Credit Endpoints:**
  - `GET /api/rooms/{id}/electricity-credit/`
  - `GET /api/rooms/{id}/water-credit/`
- **Summary:** Retrieves separate multi-month electricity and water history, previous meter readings, and advance credit balances for the selected room.

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
- **Summary:** Registers a new customer profile in the system (`nic_number` must be unique). Deposit thresholds and financial terms belong on `Lease` agreements rather than on `Customer`. Immediate contacts can be added subsequently via the Immediate Contacts API.
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
    "address": "78 Temple Rd, Kandy"
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
    "created_at": "2026-10-11T14:20:00Z"
  }
  ```

### 4.3 Retrieve Customer
- **Endpoint:** `GET /api/customers/{id}/`
- **Summary:** Retrieves profile details for a specific customer, including all associated immediate contact details.
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
    "created_at": "2026-10-10T09:50:00Z"
  }
  ```

### 4.4 Update Customer (Full)
- **Endpoint:** `PUT /api/customers/{id}/`
- **Summary:** Replaces all customer personal profile details.
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
    "address": "123 Main St, Apt 4B, Colombo 01"
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
    "created_at": "2026-10-10T09:50:00Z"
  }
  ```

### 4.5 Partial Update Customer
- **Endpoint:** `PATCH /api/customers/{id}/`
- **Summary:** Modifies specific fields of a customer profile (e.g. phone or address).
- **Example Request:**
  ```http
  PATCH /api/customers/1/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "phone": "0719998888"
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
    "phone": "0719998888",
    "nic_number": "901234567V",
    "address": "123 Main St, Apt 4B, Colombo 01",
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
- **Summary:** Creates a new lease agreement assigning a customer to a room. All financial terms (`base_rent_fee`, `base_deposit`, `rent_fee`, `initial_deposit`, `current_deposit_balance`, `monthly_deposit_deduction`, `minimum_deposit_threshold`) are owned by the lease itself (`base_rent_fee`/`rent_fee` and `base_deposit`/`initial_deposit` sync with each other if only one pair is supplied, and `current_deposit_balance` defaults to `initial_deposit` if omitted).
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

## 7. Supplier Bank Accounts API (Electricity & Water)

The building maintains official bank account records for the electricity supplier (CEB) and water supplier (NWSDB). Customers pay each supplier directly and provide payment receipt references to staff.

### 7.1 Retrieve Supplier Bank Details
- **Electricity Supplier Endpoints:**
  - `GET /api/electricity-supplier-accounts/`
  - `GET /api/electricity/supplier-bank-details/`
- **Water Supplier Endpoints:**
  - `GET /api/water-supplier-accounts/`
  - `GET /api/water/supplier-bank-details/`
- **Combined Utility Supplier Endpoint:**
  - `GET /api/utility-supplier-accounts/`
- **Summary:** Account numbers default to **`123456789`** for both electricity and water upon first query.

### 7.2 Update Supplier Bank Details
- **Electricity:** `POST/PUT/PATCH /api/electricity-supplier-accounts/` (or `/api/electricity-supplier-accounts/current/` or `/api/electricity/supplier-bank-details/`)
- **Water:** `POST/PUT/PATCH /api/water-supplier-accounts/` (or `/api/water-supplier-accounts/current/` or `/api/water/supplier-bank-details/`)
- **Combined:** `POST /api/utility-supplier-accounts/` or `PUT/PATCH /api/utility-supplier-accounts/current/`

---

## 8. Electricity & Water Records API (Separate Building & Room Endpoints)

Electricity and water records are completely separate resources with independent meter readings, per-unit rates, bills, and advance credits.

### 8.1 Electricity Records CRUD
- `GET /api/electricity/` (supports `?room_id=&billing_month=&is_paid=`)
- `POST /api/electricity/` — Records monthly `electricity_meter_reading` (rejects raw `electricity_units`).
- `GET/PUT/PATCH/DELETE /api/electricity/{id}/`
- `POST /api/electricity/{id}/mark_paid/`

### 8.2 Water Records CRUD
- `GET /api/water/` (supports `?room_id=&billing_month=&is_paid=`)
- `POST /api/water/` — Records monthly `water_meter_reading` (rejects raw `water_units`).
- `GET/PUT/PATCH/DELETE /api/water/{id}/`
- `POST /api/water/{id}/mark_paid/`

### 8.3 Get Previous Months' Meter Readings (Separate)
- **Electricity:**
  - `GET /api/electricity/previous-readings/` (aliases: `previous-meter-readings`, `latest-readings`)
  - `GET /api/rooms/{id}/previous-electricity-readings/` (alias: `previous-electricity-meter-readings`)
- **Water:**
  - `GET /api/water/previous-readings/` (aliases: `previous-meter-readings`, `latest-readings`)
  - `GET /api/rooms/{id}/previous-water-readings/` (alias: `previous-water-meter-readings`)
- **Query Parameters:** `?billing_month=YYYY-MM&room_id=<id>&months=<n>`

### 8.4 Enter Monthly Building Electricity Bill & Calculate Room Rates
- **Endpoint:** `POST /api/electricity/building-bill/` (and `POST /api/building-electricity/`)
- **Summary:** Enters `total_electricity_bill`, optional `supplier_electricity_units`, each room's `electricity_meter_reading` in `room_readings`, and optional `custom_rates`.
  - Automatically calculates `default_electricity_unit_price = total_electricity_bill / sum(room_electricity_units)` and `electricity_units_difference = supplier_electricity_units - total_electricity_units`.
  - Automatically applies `room.electricity_credit_balance` only (`receipt_reference="ADVANCE-ELECTRICITY-CREDIT"`).
- **Example Request:**
  ```http
  POST /api/electricity/building-bill/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "billing_month": "2026-10-01",
    "total_electricity_bill": 24000.00,
    "supplier_electricity_units": 215.00,
    "due_date": "2026-10-28",
    "room_readings": [
      { "room_number": "101", "electricity_meter_reading": 1060.00 },
      { "room_number": "102", "electricity_meter_reading": 2080.00, "electricity_unit_price": 135.00 }
    ]
  }
  ```

### 8.5 Enter Monthly Building Water Bill & Calculate Room Rates
- **Endpoint:** `POST /api/water/building-bill/` (and `POST /api/building-water/`)
- **Summary:** Enters `total_water_bill`, optional `supplier_water_units`, each room's `water_meter_reading` in `room_readings`, and optional `custom_rates`.
  - Automatically calculates `default_water_unit_price = total_water_bill / sum(room_water_units)` and `water_units_difference = supplier_water_units - total_water_units`.
  - Automatically applies `room.water_credit_balance` only (`receipt_reference="ADVANCE-WATER-CREDIT"`).
- **Example Request:**
  ```http
  POST /api/water/building-bill/ HTTP/1.1
  Host: thiranda-813344430767.asia-southeast1.run.app
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

  {
    "billing_month": "2026-10-01",
    "total_water_bill": 12000.00,
    "supplier_water_units": 108.00,
    "due_date": "2026-10-28",
    "room_readings": [
      { "room_number": "101", "water_meter_reading": 530.00 },
      { "room_number": "102", "water_meter_reading": 840.00 }
    ]
  }
  ```

### 8.6 Monthly Summaries, Room Histories & Unit Price Overrides
- **Monthly Summaries:**
  - `GET /api/electricity/monthly-summary/?billing_month=YYYY-MM` (and `/api/building-electricity/monthly-summary/`)
  - `GET /api/water/monthly-summary/?billing_month=YYYY-MM` (and `/api/building-water/monthly-summary/`)
- **Room Histories:**
  - `GET /api/electricity/room-history/?room_id={id}` and `GET /api/rooms/{id}/electricity-history/`
  - `GET /api/water/room-history/?room_id={id}` and `GET /api/rooms/{id}/water-history/`
- **Customize / Override Per-Unit Prices:**
  - Electricity: `POST /api/electricity/{id}/set-unit-prices/` and `POST /api/electricity/set-unit-prices/`
  - Water: `POST /api/water/{id}/set-unit-prices/` and `POST /api/water/set-unit-prices/`
- **Room Advance Credit Balances:**
  - Electricity: `GET /api/rooms/{id}/electricity-credit/` and `GET /api/electricity/room-credit/?room_id={id}`
  - Water: `GET /api/rooms/{id}/water-credit/` and `GET /api/water/room-credit/?room_id={id}`

---

## 9. Electricity & Water Supplier Payments & Overpayment Credits API

All three payment streams are strictly separate:
- **Lease Rent Payments (Property Manager):** `POST /api/payments/` (`Payment`, `Lease.rent_credit_balance`)
- **Electricity Payments (Electricity Supplier):** `POST /api/electricity/{id}/record-payment/` or `POST /api/electricity-payments/` (`ElectricityPayment`, `Room.electricity_credit_balance`)
- **Water Payments (Water Supplier):** `POST /api/water/{id}/record-payment/` or `POST /api/water-payments/` (`WaterPayment`, `Room.water_credit_balance`)

### 9.1 Record Electricity Payment & Overpayment Credit
- **Endpoint:** `POST /api/electricity/{id}/record-payment/` (and `GET/POST /api/electricity-payments/`)
- **Summary:** Records a payment made directly to the electricity supplier. Any excess above the remaining electricity bill is added strictly to `room.electricity_credit_balance` and automatically deducts from future electricity bills only.

### 9.2 Record Water Payment & Overpayment Credit
- **Endpoint:** `POST /api/water/{id}/record-payment/` (and `GET/POST /api/water-payments/`)
- **Summary:** Records a payment made directly to the water supplier. Any excess above the remaining water bill is added strictly to `room.water_credit_balance` and automatically deducts from future water bills only.
- **Example (Overpaying Water Bill):**
  - If Rent = `30,000.00`, Electricity = `10,000.00`, Water = `5,000.00` (`gross_total_fee = 45,000.00`), and customer pays `10,000.00` on the water bill:
  - `excess_credit_added = 5000.00` goes to `room.water_credit_balance`.
  - Current month `total_fee` remaining across all 3 recipients becomes `40,000.00` (`30,000` rent + `10,000` electricity + `0` water).
  - Next month's `5,000.00` water bill is automatically paid from `room.water_credit_balance`, leaving `10,000.00` electricity and `30,000.00` rent unaffected.

### 9.3 Manually Apply Advance Credit
- **Electricity:** `POST /api/electricity/{id}/apply-credit/`
- **Water:** `POST /api/water/{id}/apply-credit/`

### 9.4 Building Bills Overview
- **Electricity:** `GET /api/building-electricity/`
- **Water:** `GET /api/building-water/`

---

## 10. Bills API

### 10.1 List Bills
- **Endpoint:** `GET /api/bills/`
- **Summary:** Retrieves all monthly bills. `total_amount_due` represents the net room fee payable to the property manager (`rent_fee - deposit_deducted`). Each bill also surfaces the separate electricity and water obligations (`payable_to_electricity_supplier`, `payable_to_water_supplier`), `gross_total_fee`, and remaining `total_fee` across all three recipients.
- **Example Response:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/json

  [
    {
      "id": 1,
      "net_rent": "30000.00",
      "net_paid": "0.00",
      "remaining_balance": "30000.00",
      "payable_to_property_manager": "30000.00",
      "electricity_paid": "0.00",
      "electricity_remaining_balance": "10000.00",
      "payable_to_electricity_supplier": "10000.00",
      "water_paid": "5000.00",
      "water_remaining_balance": "0.00",
      "payable_to_water_supplier": "0.00",
      "gross_total_fee": "45000.00",
      "total_fee": "40000.00",
      "lease": 1,
      "billing_month": "2026-10-01",
      "rent_fee": "30000.00",
      "electricity_cost": "10000.00",
      "water_cost": "5000.00",
      "deposit_deducted": "0.00",
      "deposit_remaining": "50000.00",
      "total_amount_due": "30000.00",
      "overpayment_credited": "0.00",
      "due_date": "2026-10-05",
      "is_paid": false,
      "created_at": "2026-10-01T06:00:00Z"
    }
  ]
  ```

### 10.2 Create Manual Bill
- **Endpoint:** `POST /api/bills/`
- **Summary:** Manually creates a bill for a lease. Usually use `POST /api/bills/generate_monthly/` instead.

### 10.3 Retrieve Bill Details
- **Endpoint:** `GET /api/bills/{id}/`
- **Summary:** Retrieves comprehensive bill details (using `BillDetailSerializer`). Automatically embeds:
  - `customer`: Full customer profile and contact numbers.
  - `room`: Room configuration details (including separate `electricity_credit_balance` and `water_credit_balance`).
  - `previous_electricity_records`: `ElectricityRecord` entries from the previous 2 billing months.
  - `previous_water_records`: `WaterRecord` entries from the previous 2 billing months.

### 10.4 Update / Delete Bill
- `PUT /api/bills/{id}/`, `PATCH /api/bills/{id}/`, `DELETE /api/bills/{id}/`.

### 10.5 Generate / Regenerate Monthly Bills (Batch)
- **Endpoints:** `POST /api/bills/generate_monthly/` and `POST /api/bills/regenerate-monthly/`
- **Summary:** Generates (or regenerates) monthly room-fee bills for all active leases:
  - `total_amount_due` is set strictly to `lease.rent_fee - deposit_deducted` (room fee payable to the property manager).
  - Pulls `electricity_cost` from `ElectricityRecord` and `water_cost` from `WaterRecord` for informational display and `gross_total_fee` / `total_fee` calculation.
  - Automatically applies `lease.rent_credit_balance` strictly to the room fee.
  - Sets `due_date` automatically to the 5th of that month.

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
- **Summary:** Operational dashboard action center providing:
  1. `payments_to_collect`: Unpaid/partially-paid room fee bills due to the property manager.
  2. `repairs_to_do`: Uncompleted room repairs.
  3. `electricity_bills_to_pay`: Unpaid `ElectricityRecord` bills due to electricity supplier.
  4. `water_bills_to_pay`: Unpaid `WaterRecord` bills due to water supplier.
  5. `missing_electricity_records` & `missing_water_records`: Active leases missing electricity or water readings for the current calendar month.
- **Query Parameters:**
  - `type` *(optional, string)*: Filter notifications by `payments`, `repairs`, `electricity`, or `water`.

---

## 14. Reports API

All reporting endpoints accept optional `start_date` and `end_date` (`YYYY-MM-DD`) or `month` (`YYYY-MM`). See [REPORT_API_DOCUMENTATION.md](REPORT_API_DOCUMENTATION.md) for full details on:
- `GET /api/reports/room-data/`
- `GET /api/reports/customer-details/`
- `GET /api/reports/customer-room-fee-payments/?customer_id=<id>`
- `GET /api/reports/customer-electricity-payments/?customer_id=<id>`
- `GET /api/reports/customer-water-payments/?customer_id=<id>`
- `GET /api/reports/all-room-fee-payments/`
- `GET /api/reports/all-electricity-payments/`
- `GET /api/reports/all-water-payments/`
- `GET /api/reports/electricity-payments/`
- `GET /api/reports/water-payments/`
- `GET /api/reports/unpaid-room-fee-bills/`
- `GET /api/reports/unpaid-electricity-bills/`
- `GET /api/reports/unpaid-water-bills/`
- `GET /api/reports/profits/` (excludes both `electricity_payments_to_supplier_excluded` and `water_payments_to_supplier_excluded` from accommodation revenue)
- `GET /api/reports/recorrection-logs/`

---

## 14A. Bill Regeneration, Overpayment Reconciliation & Recorrection Audit Logs

### Room Fee Bill Regeneration
- **Endpoint:** `POST /api/bills/regenerate-monthly/` (or `POST /api/bills/generate_monthly/` with `"regenerate": true`)
- **Behavior:** Restores prior `deposit_deducted` to `lease.current_deposit_balance` before recomputing deposit deduction, updates `Bill.total_amount_due` (room fee due to property manager), and reconciles existing `Payment`s + `Lease.rent_credit_balance`.

### Electricity & Water Bill Regeneration (Separate)
- **Electricity Endpoints:** `POST /api/electricity/building-bill/`, `POST /api/building-electricity/`, `POST /api/electricity/set-unit-prices/`, `POST /api/electricity/<id>/set-unit-prices/`
- **Water Endpoints:** `POST /api/water/building-bill/`, `POST /api/building-water/`, `POST /api/water/set-unit-prices/`, `POST /api/water/<id>/set-unit-prices/`
- **Behavior:** Updates `ElectricityRecord` or `WaterRecord` amounts independently and reconciles existing `ElectricityPayment`s + `Room.electricity_credit_balance` or `WaterPayment`s + `Room.water_credit_balance` separately.

### Recorrection Audit Log Endpoints
- `GET /api/recorrection-logs/` (supports `?bill_category=electricity|water|room_fee&customer_id=&room_id=&billing_month=YYYY-MM`)
- `GET /api/reports/recorrection-logs/`

> **Full Report API Documentation:** See [REPORT_API_DOCUMENTATION.md](REPORT_API_DOCUMENTATION.md).

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
