# AutoParts ERP

## A. Project Overview
This is an automobile spare-parts ERP workflow application that digitizes the entire lifecycle of a sales order. The application strictly implements the following business flow:

**Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**

## B. Technology Stack
- **Database:** PostgreSQL
- **Backend:** Node.js, Express.js
- **ORM:** Prisma
- **Auth:** JWT, bcrypt
- **Validation:** Zod
- **Testing:** Jest, Supertest
- **Frontend:** React, Vite, Tailwind CSS
- **HTTP Client:** Axios

## C. Features
- **Authentication & RBAC**: Secure login with stateless JWT mapping to user roles.
- **Customer Management**: Create and track B2B customers.
- **Enquiries**: Capture multi-item customer requests.
- **Quotations**: Pricing calculation engines natively on the backend (handling unit price, discount, and GST securely with precision Decimals).
- **Sales Orders**: Secure conversion from ACCEPTED quotations.
- **Inventory Reservation**: Atomic, concurrency-protected stock reservation.
- **Dispatch operations**: Finalizing orders and decrementing physical stock safely.

## D. Roles
**ADMIN**:
- View all workflow data.
- Confirm Sales Orders (triggers inventory reservation).
- Manage inventory-related operations.
- Dispatch Sales Orders.

**SALES_USER**:
- Create customers.
- Create enquiries.
- Create quotations.
- Convert accepted quotations to Sales Orders.
- View inventory/order information (Cannot confirm or dispatch).

## E. Project Structure
```text
Automobile erp/
├── backend/
│   ├── prisma/
│   │   ├── migrations/      # 4 database migrations capturing schema timeline
│   │   ├── schema.prisma    # ER definitions
│   │   └── seed.js          # Default credential seeder
│   ├── src/
│   │   ├── controllers/     # Route logic for Enquiries, Quotations, Sales Orders
│   │   ├── middlewares/     # JWT extraction and Role checking
│   │   ├── routes/          # Express Routers
│   │   └── validators/      # Zod validation schemas
│   └── tests/               # 66 backend integration/unit tests
└── frontend/
    └── src/
        ├── components/      # Layout and global UI
        ├── context/         # AuthContext
        ├── pages/           # EnquiriesPage, QuotationsPage, SalesOrdersPage
        └── services/        # Axios API configurations
```

## F. Database Setup
1. Install PostgreSQL 14+ locally.
2. Create the database: `CREATE DATABASE autoparts_erp;`
3. Configure your connection string via `DATABASE_URL` (see below).
4. Run migrations: `npx prisma migrate deploy`
5. Generate client: `npx prisma generate`
6. Seed database: `npm run db:seed` (creates products and default users)

## G. Environment Variables
Store actual secrets safely in a `.env` file at the `backend/` root (DO NOT commit to Git).
Example `.env`:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/autoparts_erp?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
```

## H. Installation
Backend:
```bash
cd backend
npm install
```

Frontend:
```bash
cd frontend
npm install
```

## I. Running the application
Start the Backend:
```bash
cd backend
npm run dev
# Expected URL: http://localhost:5000
```

Start the Frontend:
```bash
cd frontend
npm run dev
# Expected URL: http://localhost:3000
```

## J. Database Commands
- `npx prisma generate`: Generates the Prisma Client.
- `npx prisma migrate dev`: Creates and applies new migrations (for dev).
- `npx prisma migrate deploy`: Applies pending migrations safely (for prod).
- `npx prisma migrate status`: Checks if the DB is fully migrated.
- `npx prisma studio`: Opens a GUI to inspect database rows.

## K. Testing
To run the automated test suite against the backend:
```bash
cd backend
npm test
```
**Verified Result**: 
- 5 test suites passed
- 66 tests passed
- 0 failed

## L. Frontend Build
To verify the frontend compiles for production safely:
```bash
cd frontend
npm run build
```
*(Production build verified successfully via Vite)*

## M. API Documentation
See `API_DOCUMENTATION.md` for a comprehensive list of endpoints.
Brief sample:
- `POST /api/auth/login` (Public) - Authenticates a user.
- `GET /api/sales-orders` (ADMIN, SALES_USER) - Retrieves orders.
- `POST /api/sales-orders/:id/confirm` (ADMIN) - Atomic inventory reservation.
- `POST /api/sales-orders/:id/dispatch` (ADMIN) - Dispatch and deduct stock.

## N. Business Rules
- Only ACCEPTED quotations convert to Sales Orders.
- One quotation cannot create multiple Sales Orders (Database `unique` constraint protected).
- Available inventory = Physical - Reserved.
- Reservation cannot exceed available inventory.
- Physical quantity does not decrease during reservation.
- Only ADMIN can confirm orders.
- Only CONFIRMED orders can be dispatched.
- Dispatch decreases both Physical and Reserved quantity.
- Dispatch cannot exceed reserved quantity.
- Duplicate dispatch is prevented natively at the DB level.
- Failed multi-item operations rollback completely (all-or-nothing transactions).

## O. Concurrency Explanation
To prevent over-reservation during high traffic (e.g., Order A wants 80 units, Order B wants 50 units simultaneously, but only 100 exist), the application does **not** rely on standard read-then-write logic. Instead, it utilizes atomic conditional updates within PostgreSQL:
```sql
UPDATE inventory 
SET reserved_qty = reserved_qty + requested 
WHERE product_id = id AND reserved_qty + requested <= physical_qty
```
This forces Postgres to lock the row and evaluate the math atomically at the exact moment of execution. If the stock is insufficient, the DB updates 0 rows, prompting the backend to instantly rollback the entire Prisma transaction safely.

## P. ER Diagram
```mermaid
erDiagram
    USER {
        int id PK
        string username
        string passwordHash
        string role
    }
    CUSTOMER {
        int id PK
        string companyName
        string contactPerson
    }
    PRODUCT {
        int id PK
        string partCode
        decimal basePrice
    }
    INVENTORY {
        int id PK
        int productId FK
        decimal physicalQty
        decimal reservedQty
    }
    ENQUIRY {
        int id PK
        int customerId FK
        string enquiryNumber
        string status
    }
    ENQUIRY_ITEM {
        int id PK
        int enquiryId FK
        int productId FK
        decimal quantity
    }
    QUOTATION {
        int id PK
        int enquiryId FK
        int customerId FK
        string quotationNumber
        decimal grandTotal
        string status
    }
    QUOTATION_ITEM {
        int id PK
        int quotationId FK
        int productId FK
        decimal quantity
    }
    SALES_ORDER {
        int id PK
        int quotationId FK
        int customerId FK
        string orderNumber
        decimal totalAmount
        string status
    }
    SALES_ORDER_ITEM {
        int id PK
        int salesOrderId FK
        int productId FK
        decimal quantity
    }
    DISPATCH {
        int id PK
        int salesOrderId FK
        string dispatchNumber
    }
    DISPATCH_ITEM {
        int id PK
        int dispatchId FK
        int productId FK
        decimal quantity
    }

    CUSTOMER ||--o{ ENQUIRY : places
    CUSTOMER ||--o{ QUOTATION : receives
    CUSTOMER ||--o{ SALES_ORDER : owns
    PRODUCT ||--|| INVENTORY : tracks
    PRODUCT ||--o{ ENQUIRY_ITEM : included_in
    ENQUIRY ||--o{ ENQUIRY_ITEM : contains
    ENQUIRY ||--o| QUOTATION : generates
    QUOTATION ||--o{ QUOTATION_ITEM : contains
    QUOTATION ||--o| SALES_ORDER : converts_to
    SALES_ORDER ||--o{ SALES_ORDER_ITEM : contains
    SALES_ORDER ||--o| DISPATCH : triggers
    DISPATCH ||--o{ DISPATCH_ITEM : dispatches
```

## Q. Demo Flow (5-Minute Workflow)
1. **Login** as a SALES_USER.
2. **Create Customer** via the Enquiries dashboard.
3. **Create Enquiry** for the new customer selecting multiple products.
4. **Create Quotation** directly from that enquiry via the Quotations page.
5. **Send/Accept Quotation** using the inline status toggles.
6. **Convert to Sales Order** utilizing the blue conversion action.
7. Switch logins to **ADMIN**.
8. **ADMIN Confirms** the Pending Sales order on the Sales Orders page.
9. **Inventory reservation** is visually verifiable via the right-side Inventory panel.
10. **Dispatch** the order using the Dispatch action.
11. **Inventory update** successfully decrements Physical and Reserved stock, marking the order as DISPATCHED.

## R. Test Credentials
*(For Demo / Local Development Purposes Only)*
- **Admin**: `admin` / `admin123`
- **Sales User**: `sales` / `sales123`
