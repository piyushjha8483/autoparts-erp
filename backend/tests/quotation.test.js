// tests/quotation.test.js
const request = require("supertest");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

describe("Step 5: Quotation Module API Tests", () => {
  let adminToken = "";
  let salesToken = "";
  let testCustomerId = null;
  let testEnquiryId = null;
  let testProductId1 = null;
  let testProductId2 = null;

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

    // 2. Fetch seeded products for test assertions
    const products = await prisma.product.findMany({ take: 2 });
    expect(products.length).toBeGreaterThanOrEqual(2);
    testProductId1 = products[0].id;
    testProductId2 = products[1].id;

    // 3. Create a Customer for tests
    const customerRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        companyName: "Quotation Test Garage",
        contactPerson: "Q. Tester",
        mobile: "1111111111",
        city: "Mumbai",
      });
    testCustomerId = customerRes.body.customer.id;

    // 4. Create an Enquiry for tests
    const enquiryRes = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        enquiryNumber: "ENQ-QUOT-TEST-001",
        customerId: testCustomerId,
        items: [
          { productId: testProductId1, quantity: 10 },
          { productId: testProductId2, quantity: 5 },
        ],
      });
    testEnquiryId = enquiryRes.body.enquiry.id;
  });

  afterAll(async () => {
    // Clean up created data
    await prisma.quotationItem.deleteMany({
      where: {
        quotation: {
          quotationNumber: { startsWith: "QT-TEST-" },
        },
      },
    });
    await prisma.quotation.deleteMany({
      where: { quotationNumber: { startsWith: "QT-TEST-" } },
    });
    await prisma.enquiryItem.deleteMany({
      where: {
        enquiry: {
          enquiryNumber: { startsWith: "ENQ-QUOT-TEST-" },
        },
      },
    });
    await prisma.enquiry.deleteMany({
      where: { enquiryNumber: { startsWith: "ENQ-QUOT-TEST-" } },
    });
    await prisma.customer.deleteMany({
      where: { companyName: { startsWith: "Quotation Test Garage" } },
    });

    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // QUOTATION API TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/quotations", () => {
    let createdQuotationId = null;
    const testQuotationNum = "QT-TEST-001";

    it("should allow authenticated SALES_USER to create a quotation", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: testQuotationNum,
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [
            {
              productId: testProductId1,
              quantity: 2,
              unitPrice: 50,
              discountPercent: 0,
              gstPercent: 10,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.quotation).toBeDefined();
      expect(res.body.quotation.status).toBe("DRAFT");
      expect(res.body.quotation.enquiry.status).toBe("QUOTED");
      expect(res.body.quotation.quotationItems.length).toBe(1);

      createdQuotationId = res.body.quotation.id;

      // Verify the Enquiry in the DB actually transitioned to QUOTED
      const updatedEnq = await prisma.enquiry.findUnique({ where: { id: testEnquiryId } });
      expect(updatedEnq.status).toBe("QUOTED");
    });

    it("should reject quotation creation without validUntil (required field)", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-NOVALID",
          enquiryId: testEnquiryId,
          // validUntil missing
          items: [
            {
              productId: testProductId1,
              quantity: 1,
              unitPrice: 100,
              discountPercent: 0,
              gstPercent: 0,
            },
          ],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.some(e => e.field === "validUntil")).toBe(true);
    });

    it("should perform explicit backend calculation accurately and ignore client grandTotal", async () => {
      // Test case specifically requested:
      // Quantity = 10, Unit Price = 100, Discount = 10%, GST = 18%
      // Expected: base = 1000, discount = 100, taxable = 900, gst = 162, lineAmount = 1062, grandTotal = 1062
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-CALC-001",
          enquiryId: testEnquiryId,
          validUntil: "2026-10-31",
          grandTotal: 1, // Malicious client sending incorrect grandTotal
          items: [
            {
              productId: testProductId1,
              quantity: 10,
              unitPrice: 100,
              discountPercent: 10,
              gstPercent: 18,
              lineAmount: 1, // Malicious client sending incorrect lineAmount
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      
      const quotation = res.body.quotation;
      const item = quotation.quotationItems[0];
      
      expect(parseFloat(quotation.grandTotal)).toBe(1062);
      expect(parseFloat(item.lineAmount)).toBe(1062);
      // Ensure the other values are correctly stored
      expect(parseFloat(item.quantity)).toBe(10);
      expect(parseFloat(item.unitPrice)).toBe(100);
      expect(parseFloat(item.discountPct)).toBe(10);
      expect(parseFloat(item.gstPct)).toBe(18);
    });

    it("should support multiple products in a quotation", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-MULTI",
          enquiryId: testEnquiryId,
          validUntil: "2026-10-31",
          items: [
            {
              productId: testProductId1,
              quantity: 1,
              unitPrice: 100,
              discountPercent: 0,
              gstPercent: 0,
            },
            {
              productId: testProductId2,
              quantity: 2,
              unitPrice: 50,
              discountPercent: 0,
              gstPercent: 0,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.quotation.quotationItems.length).toBe(2);
      expect(parseFloat(res.body.quotation.grandTotal)).toBe(200); // 1*100 + 2*50
    });

    it("should reject duplicate quotationNumber with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: testQuotationNum, // Duplicate
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [{ productId: testProductId1, quantity: 1, unitPrice: 1, discountPercent: 0, gstPercent: 0 }],
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should reject zero or negative quantity (400)", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-NEG-QTY",
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [{ productId: testProductId1, quantity: 0, unitPrice: 10, discountPercent: 0, gstPercent: 0 }],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject negative unit price (400)", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-NEG-PRICE",
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [{ productId: testProductId1, quantity: 1, unitPrice: -10, discountPercent: 0, gstPercent: 0 }],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject discount > 100 (400)", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-DISC-OVER",
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [{ productId: testProductId1, quantity: 1, unitPrice: 100, discountPercent: 101, gstPercent: 0 }],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject GST > 100 (400)", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-GST-OVER",
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [{ productId: testProductId1, quantity: 1, unitPrice: 100, discountPercent: 0, gstPercent: 101 }],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject nonexistent enquiry (404)", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-NOENQ",
          enquiryId: 999999,
          validUntil: "2026-10-15",
          items: [{ productId: testProductId1, quantity: 1, unitPrice: 100, discountPercent: 0, gstPercent: 0 }],
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should reject nonexistent product (404)", async () => {
      const res = await request(app)
        .post("/api/quotations")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          quotationNumber: "QT-TEST-NOPROD",
          enquiryId: testEnquiryId,
          validUntil: "2026-10-15",
          items: [{ productId: 999999, quantity: 1, unitPrice: 100, discountPercent: 0, gstPercent: 0 }],
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should reject unauthenticated creation request (401)", async () => {
      const res = await request(app).post("/api/quotations").send({
        quotationNumber: "QT-TEST-NOAUTH",
        enquiryId: testEnquiryId,
        validUntil: "2026-10-15",
        items: [{ productId: testProductId1, quantity: 1, unitPrice: 100, discountPercent: 0, gstPercent: 0 }],
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/quotations", () => {
    it("should list quotations with relational information", async () => {
      const res = await request(app)
        .get("/api/quotations")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.quotations)).toBe(true);
      expect(res.body.quotations.length).toBeGreaterThan(0);
      
      const q = res.body.quotations[0];
      expect(q.enquiry).toBeDefined();
      expect(q.customer).toBeDefined();
      expect(q.quotationItems).toBeDefined();
      if(q.quotationItems.length > 0) {
        expect(q.quotationItems[0].product).toBeDefined();
      }
    });
  });

  describe("PATCH /api/quotations/:id/status", () => {
    let qtId1, qtId2;

    beforeAll(async () => {
      // Create 2 draft quotations for status testing
      const res1 = await request(app).post("/api/quotations").set("Authorization", `Bearer ${salesToken}`).send({
        quotationNumber: "QT-TEST-STAT-001", enquiryId: testEnquiryId, validUntil: "2026-10-15", items: [{ productId: testProductId1, quantity: 1, unitPrice: 100, discountPercent: 0, gstPercent: 0 }]
      });
      qtId1 = res1.body.quotation.id;

      const res2 = await request(app).post("/api/quotations").set("Authorization", `Bearer ${salesToken}`).send({
        quotationNumber: "QT-TEST-STAT-002", enquiryId: testEnquiryId, validUntil: "2026-10-15", items: [{ productId: testProductId1, quantity: 1, unitPrice: 100, discountPercent: 0, gstPercent: 0 }]
      });
      qtId2 = res2.body.quotation.id;
    });

    it("should reject invalid transition DRAFT -> ACCEPTED (400)", async () => {
      const res = await request(app).patch(`/api/quotations/${qtId1}/status`).set("Authorization", `Bearer ${salesToken}`).send({ status: "ACCEPTED" });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should allow DRAFT -> SENT (200)", async () => {
      const res = await request(app).patch(`/api/quotations/${qtId1}/status`).set("Authorization", `Bearer ${salesToken}`).send({ status: "SENT" });
      expect(res.statusCode).toBe(200);
      expect(res.body.quotation.status).toBe("SENT");
    });

    it("should allow SENT -> ACCEPTED (200)", async () => {
      const res = await request(app).patch(`/api/quotations/${qtId1}/status`).set("Authorization", `Bearer ${salesToken}`).send({ status: "ACCEPTED" });
      expect(res.statusCode).toBe(200);
      expect(res.body.quotation.status).toBe("ACCEPTED");
    });

    it("should reject transition out of terminal state ACCEPTED (400)", async () => {
      const res = await request(app).patch(`/api/quotations/${qtId1}/status`).set("Authorization", `Bearer ${salesToken}`).send({ status: "SENT" });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should allow SENT -> REJECTED on another quotation (200)", async () => {
      await request(app).patch(`/api/quotations/${qtId2}/status`).set("Authorization", `Bearer ${salesToken}`).send({ status: "SENT" });
      const res = await request(app).patch(`/api/quotations/${qtId2}/status`).set("Authorization", `Bearer ${salesToken}`).send({ status: "REJECTED" });
      expect(res.statusCode).toBe(200);
      expect(res.body.quotation.status).toBe("REJECTED");
    });
  });
});
