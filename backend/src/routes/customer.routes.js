// src/routes/customer.routes.js
// Customer API routes with RBAC and validation

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { createCustomerSchema } = require("../validators/customer.validator");
const {
  createCustomer,
  getCustomers,
  getCustomerById,
} = require("../controllers/customer.controller");

// POST /api/customers - Create a customer (SALES_USER only)
router.post(
  "/",
  authenticate,
  requireRole("SALES_USER"),
  validate(createCustomerSchema),
  createCustomer
);

// GET /api/customers - List all customers (ADMIN and SALES_USER)
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getCustomers
);

// GET /api/customers/:id - Get customer by ID (ADMIN and SALES_USER)
router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getCustomerById
);

module.exports = router;
