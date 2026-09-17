// tests/dispatch.test.js
const request = require("supertest");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

describe("Step 8: Dispatch Module API Tests", () => {
  let adminToken = "";
  let salesToken = "";
  let testCustomerId = null;
  let testEnquiryId = null;
  let testProductId1 = null;
  let testProductId2 = null;

  // Sales Orders for different states
  let pendingOrderId = null;
  let confirmedOrderId = null;
  let cancelledOrderId = null;
  let dispatchedOrderId = null;

  // Orders for rollback and negative testing
  let rollbackOrderId = null;

  beforeAll(async () => {
    // 1. Get tokens
    const adminLogin = await request(app).post("/api/auth/login").send({ username: "admin", password: "admin123" });
    adminToken = adminLogin.body.token;

    const salesLogin = await request(app).post("/api/auth/login").send({ username: "sales", password: "sales123" });
    salesToken = salesLogin.body.token;

    // 2. Fetch seeded products (need 2 for rollback test)
    const products = await prisma.product.findMany({ take: 2 });
    testProductId1 = products[0].id;
    testProductId2 = products[1].id;

    // Initialize Inventory for tests
    await prisma.inventory.upsert({
      where: { productId: testProductId1 },
      update: { physicalQty: 100, reservedQty: 50 },
      create: { productId: testProductId1, physicalQty: 100, reservedQty: 50 },
    });
    await prisma.inventory.upsert({
      where: { productId: testProductId2 },
      update: { physicalQty: 10, reservedQty: 5 },
      create: { productId: testProductId2, physicalQty: 10, reservedQty: 5 },
    });

    // 3. Create a Customer
    const customerRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ companyName: "Dispatch Test Garage", contactPerson: "DSP Tester", mobile: "3333333333", city: "Delhi" });
    testCustomerId = customerRes.body.customer.id;

    // 4. Create an Enquiry
    const enquiryRes = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        enquiryNumber: "ENQ-DSP-TEST-001",
        customerId: testCustomerId,
        items: [{ productId: testProductId1, quantity: 10 }, { productId: testProductId2, quantity: 10 }],
      });
    testEnquiryId = enquiryRes.body.enquiry.id;

    // Helper to create quotation and sales order
    const createTestOrder = async (qNum, oNum, statusStr, items) => {
      // Create quotation
      const qRes = await request(app).post("/api/quotations").set("Authorization", `Bearer ${salesToken}`).send({
        quotationNumber: qNum,
        enquiryId: testEnquiryId,
        validUntil: "2026-10-15",
        items,
      });
      const qId = qRes.body.quotation.id;

      await prisma.quotation.update({ where: { id: qId }, data: { status: "ACCEPTED" } });

      // Create sales order
      const oRes = await request(app).post(`/api/quotations/${qId}/convert`).set("Authorization", `Bearer ${salesToken}`).send({ orderNumber: oNum });
      const oId = oRes.body.salesOrder.id;

      // Set custom status
      await prisma.salesOrder.update({ where: { id: oId }, data: { status: statusStr } });

      return oId;
    };

    // 5. Create orders
    pendingOrderId = await createTestOrder("QT-DSP-PEND", "SO-DSP-PEND", "PENDING", [{ productId: testProductId1, quantity: 10, unitPrice: 100, discountPercent: 0, gstPercent: 18 }]);
    confirmedOrderId = await createTestOrder("QT-DSP-CONF", "SO-DSP-CONF", "CONFIRMED", [{ productId: testProductId1, quantity: 20, unitPrice: 100, discountPercent: 0, gstPercent: 18 }]);
    cancelledOrderId = await createTestOrder("QT-DSP-CANC", "SO-DSP-CANC", "CANCELLED", [{ productId: testProductId1, quantity: 10, unitPrice: 100, discountPercent: 0, gstPercent: 18 }]);
    dispatchedOrderId = await createTestOrder("QT-DSP-DISP", "SO-DSP-DISP", "DISPATCHED", [{ productId: testProductId1, quantity: 10, unitPrice: 100, discountPercent: 0, gstPercent: 18 }]);
    
    // Multi-item order for rollback testing (Product 1 has enough, Product 2 does not have enough reserved stock)
    rollbackOrderId = await createTestOrder("QT-DSP-ROLL", "SO-DSP-ROLL", "CONFIRMED", [
      { productId: testProductId1, quantity: 10, unitPrice: 100, discountPercent: 0, gstPercent: 18 }, // Needs 10, Reserved 50 (OK)
      { productId: testProductId2, quantity: 20, unitPrice: 100, discountPercent: 0, gstPercent: 18 }  // Needs 20, Reserved 5 (FAILS)
    ]);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.dispatchItem.deleteMany({ where: { dispatch: { dispatchNumber: { startsWith: "DSP-TEST-" } } } });
    await prisma.dispatch.deleteMany({ where: { dispatchNumber: { startsWith: "DSP-TEST-" } } });

    await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { orderNumber: { startsWith: "SO-DSP-" } } } });
    await prisma.salesOrder.deleteMany({ where: { orderNumber: { startsWith: "SO-DSP-" } } });
    
    await prisma.quotationItem.deleteMany({ where: { quotation: { quotationNumber: { startsWith: "QT-DSP-" } } } });
    await prisma.quotation.deleteMany({ where: { quotationNumber: { startsWith: "QT-DSP-" } } });

    await prisma.enquiryItem.deleteMany({ where: { enquiry: { enquiryNumber: { startsWith: "ENQ-DSP-TEST-" } } } });
    await prisma.enquiry.deleteMany({ where: { enquiryNumber: { startsWith: "ENQ-DSP-TEST-" } } });
    
    await prisma.customer.deleteMany({ where: { companyName: { startsWith: "Dispatch Test Garage" } } });

    await prisma.inventory.update({ where: { productId: testProductId1 }, data: { physicalQty: 500, reservedQty: 0 } });
    await prisma.inventory.update({ where: { productId: testProductId2 }, data: { physicalQty: 500, reservedQty: 0 } });

    await prisma.$disconnect();
  });

  describe("POST /api/sales-orders/:id/dispatch", () => {
    const validDispatchPayload = {
      dispatchNumber: "DSP-TEST-001",
      dispatchDate: "2026-09-17T10:00:00Z",
      vehicleNumber: "DL-1C-1234",
      driverName: "John Doe"
    };

    it("should prevent SALES_USER from dispatching", async () => {
      const res = await request(app)
        .post(`/api/sales-orders/${confirmedOrderId}/dispatch`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send(validDispatchPayload);
      
      expect(res.statusCode).toBe(403);
    });

    it("should reject invalid data payload", async () => {
      const res = await request(app)
        .post(`/api/sales-orders/${confirmedOrderId}/dispatch`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({}); // Missing required fields
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should prevent dispatch of PENDING order", async () => {
      const res = await request(app)
        .post(`/api/sales-orders/${pendingOrderId}/dispatch`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...validDispatchPayload, dispatchNumber: "DSP-TEST-PEND" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Only CONFIRMED/i);
    });

    it("should prevent dispatch of CANCELLED order", async () => {
      const res = await request(app)
        .post(`/api/sales-orders/${cancelledOrderId}/dispatch`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...validDispatchPayload, dispatchNumber: "DSP-TEST-CANC" });
      
      expect(res.statusCode).toBe(400);
    });

    it("should prevent dispatch of DISPATCHED order", async () => {
      const res = await request(app)
        .post(`/api/sales-orders/${dispatchedOrderId}/dispatch`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...validDispatchPayload, dispatchNumber: "DSP-TEST-DISP" });
      
      expect(res.statusCode).toBe(400);
    });

    it("should dispatch a CONFIRMED order and deduct inventory correctly", async () => {
      // Product 1: physical=100, reserved=50 before. Dispatching 20.
      const res = await request(app)
        .post(`/api/sales-orders/${confirmedOrderId}/dispatch`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(validDispatchPayload);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);

      const dispatch = res.body.dispatch;
      expect(dispatch.dispatchNumber).toBe("DSP-TEST-001");
      expect(dispatch.dispatchItems.length).toBe(1);
      expect(parseFloat(dispatch.dispatchItems[0].quantity)).toBe(20);

      // Verify Sales Order status
      const so = await prisma.salesOrder.findUnique({ where: { id: confirmedOrderId } });
      expect(so.status).toBe("DISPATCHED");

      // Verify inventory deducted
      const inv = await prisma.inventory.findUnique({ where: { productId: testProductId1 } });
      expect(parseFloat(inv.physicalQty)).toBe(80); // 100 - 20
      expect(parseFloat(inv.reservedQty)).toBe(30); // 50 - 20
    });

    it("should reject duplicate dispatch natively at database level", async () => {
      // Manually reset status to CONFIRMED to simulate a race condition where the status check passes
      await prisma.salesOrder.update({ where: { id: confirmedOrderId }, data: { status: "CONFIRMED" } });

      const res = await request(app)
        .post(`/api/sales-orders/${confirmedOrderId}/dispatch`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...validDispatchPayload, dispatchNumber: "DSP-TEST-DUPE" });
      
      expect(res.statusCode).toBe(409); // P2002 conflict mapped to 409
      expect(res.body.message).toMatch(/exists/i);

      // Verify only one dispatch exists for this order
      const count = await prisma.dispatch.count({ where: { salesOrderId: confirmedOrderId } });
      expect(count).toBe(1);
    });

    it("should rollback completely if one item lacks reserved stock", async () => {
      // rollbackOrderId needs 10 of Prod1 (has 30 reserved now) and 20 of Prod2 (has 5 reserved).
      // Product 2 should fail the atomic check `reserved_qty >= 20`.
      
      const inv1Before = await prisma.inventory.findUnique({ where: { productId: testProductId1 } });
      const inv2Before = await prisma.inventory.findUnique({ where: { productId: testProductId2 } });

      const res = await request(app)
        .post(`/api/sales-orders/${rollbackOrderId}/dispatch`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...validDispatchPayload, dispatchNumber: "DSP-TEST-ROLL" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Insufficient reserved or physical stock/i);

      // Verify Sales Order remains CONFIRMED
      const so = await prisma.salesOrder.findUnique({ where: { id: rollbackOrderId } });
      expect(so.status).toBe("CONFIRMED");

      // Verify NO dispatch record created
      const count = await prisma.dispatch.count({ where: { salesOrderId: rollbackOrderId } });
      expect(count).toBe(0);

      // Verify NO inventory changes
      const inv1After = await prisma.inventory.findUnique({ where: { productId: testProductId1 } });
      const inv2After = await prisma.inventory.findUnique({ where: { productId: testProductId2 } });

      expect(parseFloat(inv1After.physicalQty)).toBe(parseFloat(inv1Before.physicalQty));
      expect(parseFloat(inv1After.reservedQty)).toBe(parseFloat(inv1Before.reservedQty));
      expect(parseFloat(inv2After.physicalQty)).toBe(parseFloat(inv2Before.physicalQty));
      expect(parseFloat(inv2After.reservedQty)).toBe(parseFloat(inv2Before.reservedQty));
    });
  });
});
