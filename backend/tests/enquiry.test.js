// tests/enquiry.test.js
const request = require("supertest");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

describe("Step 4: Customer & Enquiry Module API Tests", () => {
  let adminToken = "";
  let salesToken = "";
  let testCustomerId = null;
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
  });

  afterAll(async () => {
    // Clean up created enquiries and customers after test suite runs
    await prisma.enquiryItem.deleteMany({
      where: {
        enquiry: {
          enquiryNumber: { startsWith: "ENQ-TEST-" },
        },
      },
    });
    await prisma.enquiry.deleteMany({
      where: { enquiryNumber: { startsWith: "ENQ-TEST-" } },
    });
    await prisma.customer.deleteMany({
      where: { companyName: { startsWith: "Test Garage" } },
    });

    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CUSTOMER API TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe("Customer Endpoints (/api/customers)", () => {
    it("should allow authenticated SALES_USER to create a customer", async () => {
      const res = await request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          companyName: "Test Garage Alpha",
          contactPerson: "Rahul Sharma",
          mobile: "9876543210",
          email: "rahul@testgarage.com",
          city: "Pune",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.customer).toBeDefined();
      expect(res.body.customer.companyName).toBe("Test Garage Alpha");

      testCustomerId = res.body.customer.id;
    });

    it("should reject customer creation with missing required fields", async () => {
      const res = await request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          companyName: "Test Garage Beta",
          // missing contactPerson, mobile, city
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("should allow ADMIN to list all customers", async () => {
      const res = await request(app)
        .get("/api/customers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.customers)).toBe(true);
      expect(res.body.customers.length).toBeGreaterThan(0);
    });

    it("should retrieve a customer by ID", async () => {
      const res = await request(app)
        .get(`/api/customers/${testCustomerId}`)
        .set("Authorization", `Bearer ${salesToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.customer.id).toBe(testCustomerId);
    });

    it("should return 404 for nonexistent customer ID", async () => {
      const res = await request(app)
        .get("/api/customers/999999")
        .set("Authorization", `Bearer ${salesToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ENQUIRY API TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe("Enquiry Endpoints (/api/enquiries)", () => {
    let createdEnquiryId = null;
    const testEnquiryNum = "ENQ-TEST-001";

    it("should allow authenticated SALES_USER to create an enquiry with multiple products", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          enquiryNumber: testEnquiryNum,
          customerId: testCustomerId,
          enquiryDate: "2026-09-16",
          expectedDate: "2026-09-25",
          notes: "Need urgent delivery for brake pads and clutch plates",
          items: [
            { productId: testProductId1, quantity: 4 },
            { productId: testProductId2, quantity: 2 },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.enquiry).toBeDefined();
      expect(res.body.enquiry.enquiryNumber).toBe(testEnquiryNum);
      expect(res.body.enquiry.status).toBe("NEW");
      expect(res.body.enquiry.customer.id).toBe(testCustomerId);
      expect(res.body.enquiry.enquiryItems.length).toBe(2);

      createdEnquiryId = res.body.enquiry.id;
    });

    it("should reject duplicate enquiryNumber with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          enquiryNumber: testEnquiryNum, // Same number
          customerId: testCustomerId,
          items: [{ productId: testProductId1, quantity: 1 }],
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("should reject enquiry creation with zero or negative quantity", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          enquiryNumber: "ENQ-TEST-ZERO",
          customerId: testCustomerId,
          items: [{ productId: testProductId1, quantity: 0 }],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject enquiry creation with nonexistent customer (404)", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          enquiryNumber: "ENQ-TEST-NOCUST",
          customerId: 999999,
          items: [{ productId: testProductId1, quantity: 5 }],
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Customer/i);
    });

    it("should reject enquiry creation with nonexistent product (404)", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          enquiryNumber: "ENQ-TEST-NOPROD",
          customerId: testCustomerId,
          items: [{ productId: 999999, quantity: 5 }],
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Product/i);
    });

    it("should reject unauthenticated enquiry creation requests (401)", async () => {
      const res = await request(app).post("/api/enquiries").send({
        enquiryNumber: "ENQ-TEST-NOAUTH",
        customerId: testCustomerId,
        items: [{ productId: testProductId1, quantity: 1 }],
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should list enquiries with customer and product information", async () => {
      const res = await request(app)
        .get("/api/enquiries")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.enquiries)).toBe(true);
      expect(res.body.enquiries.length).toBeGreaterThan(0);

      const found = res.body.enquiries.find((e) => e.id === createdEnquiryId);
      expect(found).toBeDefined();
      expect(found.customer).toBeDefined();
      expect(found.enquiryItems.length).toBe(2);
      expect(found.enquiryItems[0].product).toBeDefined();
    });

    it("should retrieve single enquiry by ID with customer and product details", async () => {
      const res = await request(app)
        .get(`/api/enquiries/${createdEnquiryId}`)
        .set("Authorization", `Bearer ${salesToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enquiry.id).toBe(createdEnquiryId);
      expect(res.body.enquiry.customer.id).toBe(testCustomerId);
      expect(res.body.enquiry.enquiryItems.length).toBe(2);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ENQUIRY STATUS WORKFLOW TESTS (NEW -> QUOTED -> WON / LOST)
    // ─────────────────────────────────────────────────────────────────────────
    it("should reject invalid transition NEW -> WON (400)", async () => {
      const res = await request(app)
        .patch(`/api/enquiries/${createdEnquiryId}/status`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ status: "WON" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid status transition/i);
    });

    it("should allow valid transition NEW -> QUOTED (200)", async () => {
      const res = await request(app)
        .patch(`/api/enquiries/${createdEnquiryId}/status`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ status: "QUOTED" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enquiry.status).toBe("QUOTED");
    });

    it("should allow valid transition QUOTED -> WON (200)", async () => {
      const res = await request(app)
        .patch(`/api/enquiries/${createdEnquiryId}/status`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ status: "WON" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enquiry.status).toBe("WON");
    });

    it("should reject invalid transition WON -> NEW (400)", async () => {
      const res = await request(app)
        .patch(`/api/enquiries/${createdEnquiryId}/status`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ status: "NEW" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid status transition/i);
    });

    it("should allow valid transition QUOTED -> LOST on a second enquiry (200)", async () => {
      // Create a second test enquiry for testing QUOTED -> LOST
      const enq2Res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          enquiryNumber: "ENQ-TEST-002",
          customerId: testCustomerId,
          items: [{ productId: testProductId1, quantity: 1 }],
        });

      const enq2Id = enq2Res.body.enquiry.id;

      // NEW -> QUOTED
      await request(app)
        .patch(`/api/enquiries/${enq2Id}/status`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ status: "QUOTED" });

      // QUOTED -> LOST
      const res = await request(app)
        .patch(`/api/enquiries/${enq2Id}/status`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ status: "LOST" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enquiry.status).toBe("LOST");
    });

    it("should reject arbitrary invalid status value (400)", async () => {
      const res = await request(app)
        .patch(`/api/enquiries/${createdEnquiryId}/status`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({ status: "INVALID_STATUS_VALUE" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
