# AutoParts ERP - API Documentation

Base URL: \`http://localhost:5000/api\`

All endpoints except login require a valid JWT passed in the \`Authorization\` header as a Bearer token.

### Authentication
**POST \`/api/auth/login\`**
- **Role:** Public
- **Description:** Authenticates a user and returns a JWT and user object.
- **Request Body:** \`{ "username": "admin", "password": "admin123" }\`

### Customers
**POST \`/api/customers\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Creates a new B2B customer.
- **Request Body:** \`{ "companyName": "...", "contactPerson": "...", "mobile": "...", "city": "..." }\`

**GET \`/api/customers\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Retrieves all customers.

### Enquiries
**POST \`/api/enquiries\`**
- **Role:** SALES_USER
- **Description:** Captures a new multi-item customer request.
- **Request Body:** \`{ "enquiryNumber": "...", "customerId": 1, "items": [{ "productId": 1, "quantity": 10 }] }\`

**GET \`/api/enquiries\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Retrieves all enquiries.

### Quotations
**POST \`/api/quotations\`**
- **Role:** SALES_USER
- **Description:** Creates a quotation derived from an enquiry. Backend calculates all line amounts and grand totals.
- **Request Body:** \`{ "quotationNumber": "...", "enquiryId": 1, "validUntil": "2026-10-15T00:00:00Z", "items": [...] }\`

**GET \`/api/quotations\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Retrieves all quotations.

**GET \`/api/quotations/:id\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Retrieves a specific quotation by ID.

**PATCH \`/api/quotations/:id/status\`**
- **Role:** SALES_USER
- **Description:** Progresses the status of a quotation (e.g. DRAFT → SENT → ACCEPTED).
- **Request Body:** \`{ "status": "ACCEPTED" }\`

**POST \`/api/quotations/:id/convert\`**
- **Role:** SALES_USER
- **Description:** Converts an ACCEPTED quotation into a Sales Order.
- **Request Body:** \`{ "orderNumber": "..." }\`

### Sales Orders & Dispatch
**GET \`/api/sales-orders\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Retrieves all sales orders.

**GET \`/api/sales-orders/:id\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Retrieves a specific sales order by ID.

**POST \`/api/sales-orders/:id/confirm\`**
- **Role:** ADMIN
- **Description:** Confirms a PENDING sales order and atomically reserves inventory. Throws 400 if stock is insufficient.

**POST \`/api/sales-orders/:id/dispatch\`**
- **Role:** ADMIN
- **Description:** Dispatches a CONFIRMED sales order, creating a Dispatch record and atomically decrementing Physical and Reserved stock.
- **Request Body:** \`{ "dispatchNumber": "...", "dispatchDate": "...", "vehicleNumber": "...", "driverName": "..." }\`

### Inventory
**GET \`/api/inventory\`**
- **Role:** SALES_USER, ADMIN
- **Description:** Retrieves an overview of all products and computed stock values (Physical, Reserved, Available). Strictly Read-Only.
