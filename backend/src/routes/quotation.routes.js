// src/routes/quotation.routes.js
// Quotation API routes with RBAC and Zod validation

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const {
  createQuotationSchema,
  updateQuotationStatusSchema,
} = require("../validators/quotation.validator");
const {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
} = require("../controllers/quotation.controller");

// POST /api/quotations - Create quotation (SALES_USER only)
router.post(
  "/",
  authenticate,
  requireRole("SALES_USER"),
  validate(createQuotationSchema),
  createQuotation
);

// GET /api/quotations - List quotations (ADMIN and SALES_USER)
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getQuotations
);

// GET /api/quotations/:id - Get quotation by ID (ADMIN and SALES_USER)
router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getQuotationById
);

// PATCH /api/quotations/:id/status - Update quotation status (ADMIN and SALES_USER)
router.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  validate(updateQuotationStatusSchema),
  updateQuotationStatus
);

const { convertQuotationToSalesOrder } = require("../controllers/salesOrder.controller");
const { convertQuotationSchema } = require("../validators/salesOrder.validator");

// POST /api/quotations/:id/convert - Convert quotation to Sales Order (SALES_USER only)
router.post(
  "/:id/convert",
  authenticate,
  requireRole("SALES_USER"),
  validate(convertQuotationSchema),
  convertQuotationToSalesOrder
);

module.exports = router;
