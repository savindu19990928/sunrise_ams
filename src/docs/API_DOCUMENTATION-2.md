# Thiranda System API Documentation

Base URL: `https://thiranda-813344430767.asia-southeast1.run.app`

## Authentication
All endpoints (except obtaining tokens) require admin user permissions, hence require a valid JWT token in the `Authorization` header: 
`Authorization: Bearer <token>`.

---

## 1. Authentication Endpoints

### 1.1 Obtain JWT Token
- **Endpoint:** `POST /api/auth/token/`
- **Summary:** Obtain a new JWT access and refresh token pair using user credentials.
- **Example Request:**
  ```json
  {
    "username": "admin",
    "password": "yourpassword"
  }
  ```
- **Example Response:**
  ```json
  {
    "access": "eyJ0eXAi... (JWT token)",
    "refresh": "eyJ0eXAi... (JWT refresh token)"
  }
  ```

### 1.2 Refresh JWT Token
- **Endpoint:** `POST /api/auth/token/refresh/`
- **Summary:** Refresh an expired JWT access token using the refresh token.
- **Example Request:**
  ```json
  {
    "refresh": "eyJ0eXAi... (JWT refresh token)"
  }
  ```
- **Example Response:**
  ```json
  {
    "access": "eyJ0eXAi... (new JWT token)"
  }
  ```

---

## 2. Staff Management

### 2.1 Create Staff User
- **Endpoint:** `POST /api/staff/`
- **Summary:** Create a new staff account. Only superusers can access this endpoint.
- **Example Request:**
  ```json
  {
    "username": "new_staff",
    "password": "securepassword",
    "email": "staff@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
  ```
- **Example Response:**
  ```json
  {
    "message": "Staff user created successfully."
  }
  ```

---

## 3. Custom Business Endpoints

### 3.1 Terminate Lease
- **Endpoint:** `POST /api/leases/{id}/terminate/`
- **Summary:** Terminate an active lease. Optionally log a repair cost associated with moving out. This automatically recalculates the deposit refund.
- **Example Request:**
  ```json
  {
    "repair_cost": 500.0,
    "repair_description": "Wall painting"
  }
  ```
- **Example Response:**
  ```json
  {
    "message": "Lease terminated.",
    "final_deposit_refund": 1500.0
  }
  ```

### 3.2 Generate Monthly Bills
- **Endpoint:** `POST /api/bills/generate_monthly/`
- **Summary:** Generate bills for all active leases for a specified billing month. It calculates utility costs and deducts from the deposit if required.
- **Example Request:**
  ```json
  {
    "billing_month": "2026-08-01"
  }
  ```
- **Example Response:**
  ```json
  {
    "message": "Generated 5 bills.",
    "bill_ids": [1, 2, 3, 4, 5]
  }
  ```

### 3.3 Get Overdue Payments
- **Endpoint:** `GET /api/payments/overdue/`
- **Summary:** Retrieve a list of overdue bills and their outstanding balances.
- **Example Request:** (No body required)
- **Example Response:**
  ```json
  [
    {
      "bill_id": 10,
      "customer": "John Doe",
      "room": "101",
      "due_date": "2026-08-05",
      "days_overdue": 26,
      "owed": 250.0
    }
  ]
  ```

---

## 4. Reports

### 4.1 Generate Reports
- **Endpoint:** `GET /api/reports/{report_type}/`
- **Summary:** Generate various system reports based on date ranges.
- **Valid Report Types (`report_type`):**
  - `room-data`
  - `customer-details`
  - `customer-payments` (requires `customer_id` query param)
  - `all-payments`
  - `this-month-charges`
  - `room-repairs`
  - `profits`
- **Query Parameters:** 
  - `start_date` (Optional, Format: `YYYY-MM-DD`, Default: 1st of current month)
  - `end_date` (Optional, Format: `YYYY-MM-DD`, Default: current date)
  - `customer_id` (Required only for `customer-payments` report)
- **Example Request:** 
  `GET /api/reports/profits/?start_date=2026-08-01&end_date=2026-08-31`
- **Example Response:**
  ```json
  {
    "period": {
      "start": "2026-08-01",
      "end": "2026-08-31"
    },
    "total_profit": 5000.0,
    "room_profits": {
      "101": 1500.0,
      "102": 3500.0
    }
  }
  ```

---

## 5. Standard CRUD Endpoints
The following resources have standard CRUD operations implemented via Django Rest Framework ModelViewSets:

- **Rooms:** `/api/rooms/`
- **Customers:** `/api/customers/`
- **Immediate Contacts:** `/api/immediate-contacts/` (Filter by customer using `?customer_id=<id>`)
- **Leases:** `/api/leases/`
- **Utility Records:** `/api/utilities/`
- **Bills:** `/api/bills/`
- **Payments:** `/api/payments/`
- **Room Repairs:** `/api/repairs/`

**Supported HTTP Methods for CRUD:**
- `GET /api/{resource}/`: List all items
- `POST /api/{resource}/`: Create a new item
- `GET /api/{resource}/{id}/`: Retrieve a specific item
- `PUT /api/{resource}/{id}/`: Update a specific item completely
- `PATCH /api/{resource}/{id}/`: Update a specific item partially
- `DELETE /api/{resource}/{id}/`: Delete a specific item

### 5.1 Immediate Contacts
Customers can have optional, multiple immediate contact numbers.
- **Fields:** `customer` (ID), `name`, `relation` (e.g. Father, Mother, Friend, Spouse), `mobile_number`
- **Example Request:**
  `POST /api/immediate-contacts/`
  ```json
  {
    "customer": 1,
    "name": "Jane Doe",
    "relation": "Mother",
    "mobile_number": "0771234567"
  }
  ```
- **Note:** Customers listed at `/api/customers/` will also automatically include their `immediate_contacts` as a nested list.

### 5.2 Room Rates & Utilities
Each room has customized electricity and water rates:
- **Room fields:** `electricity_unit_price`, `water_unit_price`
- **Utility Record fields:** `electricity_units`, `water_units`, `electricity_cost`, `water_cost`. When entering `electricity_units` or `water_units`, costs are automatically calculated using the room's specific unit prices.

### 5.3 Monthly Rent & Deposit Deduction Rule
- Each month, bill amount is calculated as `(rent_fee - monthly_deposit_deduction) + electricity_cost + water_cost`.
- While `current_deposit_balance > 0`, the monthly deposit deduction is subtracted and deducted from the remaining deposit.
- When `current_deposit_balance` reaches `0`, the monthly deposit deduction stops completely (deduction becomes `0`) and the customer must pay the full `rent_fee`.

