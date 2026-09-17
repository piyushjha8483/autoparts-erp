// tests/salesOrder.test.js
const request = require("supertest");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

describe("Step 6 & 7: Sales Order Module API Tests", () => {
  let adminToken = "";
  let salesToken = "";
  let testCustomerId = null;
  let testEnquiryId = null;
  let testProductId1 = null;

  // Quotations created for different status tests
  let acceptedQuotationId = null;
  let acceptedQuotationIdA = null; // For concurrent testing
  let acceptedQuotationIdB = null; // For concurrent testing
  let draftQuotationId = null;
  let sentQuotationId = null;
  let rejectedQuotationId = null;

  beforeAll(async () => {
    // 1. Get tokens for ADMIN and SALES_USER
    const adminLogin = await request(app).post("/api/auth/login").send({
      username: "admin",
      password: "admin123",
    });
    adminToken = adminLogin.body.token;

    const salesLogin = await request(app).post("/api/auth/login").send({
      username: "sales",
      password: "sales123",
    });
    salesToken = salesLogin.body.token;

    // 2. Fetch seeded product
    const products = await prisma.product.findMany({ take: 1 });
    expect(products.length).toBeGreaterThanOrEqual(1);
    testProductId1 = products[0].id;

    // Initialize Inventory to exactly 100 for the concurrent test
    await prisma.inventory.upsert({
      where: { productId: testProductId1 },
      update: { physicalQty: 100, reservedQty: 0 },
      create: { productId: testProductId1, physicalQty: 100, reservedQty: 0 },
    });

    // 3. Create a Customer for tests
    const customerRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        companyName: "Sales Order Test Garage",
        contactPerson: "SO Tester",
        mobile: "2222222222",
        city: "Mumbai",
      });
    testCustomerId = customerRes.body.customer.id;

    // 4. Create an Enquiry for tests
    const enquiryRes = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        enquiryNumber: "ENQ-SO-TEST-001",
        customerId: testCustomerId,
        items: [{ productId: testProductId1, quantity: 10 }],
      });
    testEnquiryId = enquiryRes.body.enquiry.id;

    // Helper to create quotation
    const createTestQuotation = async (qNum, statusStr, qty = 10) => {
      const qRes = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: qNum,
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [{ productId: testProductId1, quantity: qty, unitPrice: 100, discountPercent: 10, gstPercent: 18 }],
        });
      
      const qId = qRes.body.quotation.id;

      await prisma.quotation.update({
        where: { id: qId },
        data: { status: statusStr },
      });

      return qId;
    };

    // 5. Create quotations in various states
    acceptedQuotationId = await createTestQuotation("QT-SO-ACC", "ACCEPTED");
    acceptedQuotationIdA = await createTestQuotation("QT-SO-ACC-A", "ACCEPTED", 80);
    acceptedQuotationIdB = await createTestQuotation("QT-SO-ACC-B", "ACCEPTED", 50);
    draftQuotationId = await createTestQuotation("QT-SO-DRAFT", "DRAFT");
    sentQuotationId = await createTestQuotation("QT-SO-SENT", "SENT");
    rejectedQuotationId = await createTestQuotation("QT-SO-REJ", "REJECTED");
  });

  afterAll(async () => {
    // Clean up created data
    await prisma.salesOrderItem.deleteMany({
      where: { salesOrder: { orderNumber: { startsWith: "SO-TEST-" } } },
    });
    await prisma.salesOrder.deleteMany({
      where: { orderNumber: { startsWith: "SO-TEST-" } },
    });
    
    await prisma.quotationItem.deleteMany({
      where: { quotation: { quotationNumber: { startsWith: "QT-SO-" } } },
    });
    await prisma.quotation.deleteMany({
      where: { quotationNumber: { startsWith: "QT-SO-" } },
    });

    await prisma.enquiryItem.deleteMany({
      where: { enquiry: { enquiryNumber: { startsWith: "ENQ-SO-TEST-" } } },
    });
    await prisma.enquiry.deleteMany({
      where: { enquiryNumber: { startsWith: "ENQ-SO-TEST-" } },
    });
    
    await prisma.customer.deleteMany({
      where: { companyName: { startsWith: "Sales Order Test Garage" } },
    });

    await prisma.inventory.update({
      where: { productId: testProductId1 },
      data: { physicalQty: 500, reservedQty: 0 },
    });

    await prisma.$disconnect();
  });

  describe("POST /api/quotations/:id/convert", () => {
    it("should prevent unauthorized/unauthenticated access", async () => {
      const res = await request(app).post(`/api/quotations/${acceptedQuotationId}/convert`).send({
        orderNumber: "SO-TEST-AUTH",
      });
      expect(res.statusCode).toBe(401); // No token
    });

    it("should prevent draft quotation conversion", async () => {
      const res = await request(app)
        .post(`/api/quotations/${draftQuotationId}/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-DRAFT" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should prevent sent quotation conversion", async () => {
      const res = await request(app)
        .post(`/api/quotations/${sentQuotationId}/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-SENT" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should prevent rejected quotation conversion", async () => {
      const res = await request(app)
        .post(`/api/quotations/${rejectedQuotationId}/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-REJ" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should convert an ACCEPTED quotation and correctly copy all fields", async () => {
      const res = await request(app)
        .post(`/api/quotations/${acceptedQuotationId}/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-001" });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      
      const so = res.body.salesOrder;
      expect(so).toBeDefined();
      expect(so.orderNumber).toBe("SO-TEST-001");
      expect(so.status).toBe("PENDING");
      expect(so.quotationId).toBe(acceptedQuotationId);
      expect(so.customerId).toBe(testCustomerId);

      expect(parseFloat(so.totalAmount)).toBe(1062);

      expect(so.salesOrderItems.length).toBe(1);
      const item = so.salesOrderItems[0];
      expect(item.productId).toBe(testProductId1);
      expect(parseFloat(item.quantity)).toBe(10);
      expect(parseFloat(item.unitPrice)).toBe(100);
      expect(parseFloat(item.lineAmount)).toBe(1062);
    });

    it("should prevent duplicate conversions (409 Conflict)", async () => {
      const res = await request(app)
        .post(`/api/quotations/${acceptedQuotationId}/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-DUPE" });
      
      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      
      const count = await prisma.salesOrder.count({
        where: { quotationId: acceptedQuotationId }
      });
      expect(count).toBe(1);
    });
    
    it("should reject nonexistent quotation ID", async () => {
      const res = await request(app)
        .post(`/api/quotations/999999/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-N/A" });
      
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/sales-orders", () => {
    it("should allow ADMIN to retrieve list of sales orders", async () => {
      const res = await request(app)
        .get("/api/sales-orders")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.salesOrders)).toBe(true);
    });
  });

  describe("GET /api/sales-orders/:id", () => {
    let testSoId = null;
    beforeAll(async () => {
      const so = await prisma.salesOrder.findFirst({ where: { orderNumber: "SO-TEST-001" } });
      testSoId = so.id;
    });

    it("should retrieve a single sales order by ID", async () => {
      const res = await request(app)
        .get(`/api/sales-orders/${testSoId}`)
        .set("Authorization", `Bearer ${salesToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.salesOrder.orderNumber).toBe("SO-TEST-001");
    });
  });

  describe("POST /api/sales-orders/:id/confirm (Inventory Reservation)", () => {
    let orderA_Id, orderB_Id;

    beforeAll(async () => {
      // Pre-create Order A (80) and Order B (50)
      const resA = await request(app)
        .post(`/api/quotations/${acceptedQuotationIdA}/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-A" });
      orderA_Id = resA.body.salesOrder.id;

      const resB = await request(app)
        .post(`/api/quotations/${acceptedQuotationIdB}/convert`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ orderNumber: "SO-TEST-B" });
      orderB_Id = resB.body.salesOrder.id;
    });

    it("should prevent SALES_USER from confirming", async () => {
      const res = await request(app)
        .post(`/api/sales-orders/${orderA_Id}/confirm`)
        .set("Authorization", `Bearer ${salesToken}`);
      
      expect(res.statusCode).toBe(403); // Forbidden
    });

    it("should handle concurrent confirmation correctly (atomic updates)", async () => {
      // Both start as PENDING. Total available inventory is 100.
      // Order A requests 80, Order B requests 50.
      // Running them concurrently should result in exactly one succeeding and one failing.
      
      const [resA, resB] = await Promise.all([
        request(app).post(`/api/sales-orders/${orderA_Id}/confirm`).set("Authorization", `Bearer ${adminToken}`),
        request(app).post(`/api/sales-orders/${orderB_Id}/confirm`).set("Authorization", `Bearer ${adminToken}`)
      ]);

      const successCount = [resA.statusCode, resB.statusCode].filter(code => code === 200).length;
      const failCount = [resA.statusCode, resB.statusCode].filter(code => code === 400).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Verify the final state of inventory
      const inv = await prisma.inventory.findUnique({ where: { productId: testProductId1 } });
      const reserved = parseFloat(inv.reservedQty);
      const physical = parseFloat(inv.physicalQty);
      
      expect(physical).toBe(100);
      // It must be strictly 80 or 50, not 130
      expect([50, 80]).toContain(reserved);

      // Verify Sales Order statuses
      const finalA = await prisma.salesOrder.findUnique({ where: { id: orderA_Id } });
      const finalB = await prisma.salesOrder.findUnique({ where: { id: orderB_Id } });
      
      if (reserved === 80) {
        expect(finalA.status).toBe("CONFIRMED");
        expect(finalB.status).toBe("PENDING");
      } else {
        expect(finalB.status).toBe("CONFIRMED");
        expect(finalA.status).toBe("PENDING");
      }
    });

    it("should not allow confirming an already CONFIRMED order", async () => {
      const finalA = await prisma.salesOrder.findUnique({ where: { id: orderA_Id } });
      const finalB = await prisma.salesOrder.findUnique({ where: { id: orderB_Id } });
      
      // Determine which one succeeded
      const confirmedId = finalA.status === "CONFIRMED" ? orderA_Id : orderB_Id;

      const res = await request(app)
        .post(`/api/sales-orders/${confirmedId}/confirm`)
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Only PENDING/i);
    });

  });
});
