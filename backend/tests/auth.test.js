// tests/auth.test.js
const request = require("supertest");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

describe("JWT Authentication & RBAC API Endpoints", () => {
  let adminToken = "";
  let salesToken = "";

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid ADMIN credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        username: "admin",
        password: "admin123",
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toEqual("admin");
      expect(res.body.user.role).toEqual("ADMIN");
      expect(res.body.user.passwordHash).toBeUndefined();

      adminToken = res.body.token;
    });

    it("should login successfully with valid SALES_USER credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        username: "sales",
        password: "sales123",
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toEqual("sales");
      expect(res.body.user.role).toEqual("SALES_USER");

      salesToken = res.body.token;
    });

    it("should return 401 for invalid password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        username: "admin",
        password: "wrongpassword",
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it("should return 400 when required fields are missing", async () => {
      const res = await request(app).post("/api/auth/login").send({
        username: "admin",
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return 401 when missing token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 when using an invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken123");

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it("should return user details when authenticated with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toEqual("admin");
      expect(res.body.user.role).toEqual("ADMIN");
      expect(res.body.user.passwordHash).toBeUndefined();
    });
  });

  describe("GET /api/auth/admin-test (RBAC)", () => {
    it("should allow ADMIN user to access admin-test endpoint", async () => {
      const res = await request(app)
        .get("/api/auth/admin-test")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/ADMIN/i);
    });

    it("should return 403 Forbidden when SALES_USER user accesses admin-test endpoint", async () => {
      const res = await request(app)
        .get("/api/auth/admin-test")
        .set("Authorization", `Bearer ${salesToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Access denied/i);
    });
  });
});
