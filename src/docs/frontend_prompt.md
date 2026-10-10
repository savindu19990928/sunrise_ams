# Frontend Generation Prompt: Accommodation Management System (AMS)

You are an expert Frontend Developer. Your task is to build the frontend for the **Accommodation Management System (AMS)**, an admin-only web portal for a room renting business. 

The backend is built with Django REST Framework (DRF) and provides a comprehensive API. The system handles long-term rentals with complex deposit deduction logic, utility billing, and comprehensive reporting.

## System Overview & Business Logic
- **Admin Only**: There is no customer portal and no online payments. This system is strictly for management by admins/staff.
- **Authentication**: The API uses JWT authentication. You need to implement a login screen and include the Bearer token in the `Authorization` header for all API requests.
- **Lease & Deposit Logic**: Customers pay a deposit before starting rent. Each month, a fixed amount (specific to the room) is deducted from the deposit. If a customer permanently leaves, the remaining deposit is refunded after deducting any room repair costs.
- **Utility Billing**: The admin receives whole-building utility bills but inputs specific water and electricity costs for each room into the system per month.
- **Consolidated Billing**: Instead of separate bills, the system generates one monthly bill per lease encompassing rent, electricity, water, and noting the deposit deduction and remaining deposit.

## Required Features & Pages

### 1. Dashboard
- Overview of key metrics (e.g., active leases, total overdue amount, this month's generated bills).
- Quick links to common actions (Add Customer, Generate Bills).

### 2. Room Management
- **List/Grid View**: Display all rooms.
- **CRUD Operations**: Admins must be able to add, edit, and delete rooms.
- **Fields**: Room Number, Base Rent Fee, Base Deposit Amount, Monthly Deposit Deduction.

### 3. Customer Management
- **List View**: Display all customers.
- **CRUD Operations**: Manage customer details (First Name, Last Name, Email, Phone, NIC Number, Address).

### 4. Lease Management (Assignments)
- **Assign Room**: Interface to assign a customer to a room (creating a Lease). Set the initial deposit, rent fee, and deduction amount.
- **Terminate Lease**: A specific action to end a lease. Must include a form to input `repair_cost` and `repair_description`. The backend will calculate and return the final deposit refund amount.

### 5. Utilities & Billing
- **Utility Input**: Form to input electricity and water costs for specific rooms for a specific billing month (`YYYY-MM-DD`).
- **Generate Monthly Bills**: A button/action to trigger the backend to generate all bills for a given month.
- **Bill View**: View consolidated bills. The UI must clearly show the rent, utilities, deposit deduction, remaining deposit, and total amount due.

### 6. Payments & Overdue Tracking
- **Record Payment**: Form to record manual payments against specific bills.
- **Overdue Check**: A dedicated page/section to display overdue payments. It should show the customer, room, due date, days overdue, and the amount owed.

### 7. Reports
The backend provides several JSON-based report endpoints. You need to build UI tables/charts to display this data. The default date range is the current month, but you must provide a date picker (Start Date & End Date) to filter.
- **Room Data Report**: Current configurations of all rooms.
- **Customer Details Report**: Includes customer info, their deposit paid, and total payments.
- **Customer Payments Report**: Search/filter payments by a specific customer.
- **All Customer Payments Report**: View all payments across the system.
- **This Month's Charges Report**: Overview of all bills generated in a time period.
- **Room Repair Cost Report**: Repair costs broken down by room.
- **Profit Report**: Displays total revenue minus repair costs, and a breakdown of profit per room.

### 8. Staff Management (Superuser Only)
- UI to create new staff accounts (Username, Email, Password). This should only be visible/accessible if the logged-in user is a superuser.

## Technical Requirements
- **Framework**: Please use a modern frontend framework like React (Next.js/Vite), Vue, or Angular.
- **Styling**: Use a component library (like Tailwind CSS, Material-UI, or Shadcn) to create a clean, professional, and responsive admin dashboard.
- **State Management & Data Fetching**: Use standard tools (e.g., React Query, Redux, or Context API) to manage state and fetch data from the API smoothly.
- **No PDF Generation**: All reports and bills must be displayed in the UI grid/table format. Do not implement PDF generation as it is not required.

Please provide the project initialization commands, folder structure, and the code for the main components (Dashboard, API service, Routing, and at least one core management page like Rooms or Leases) to get started.
