// src/routes/enquiry.routes.js
// Spare Parts Enquiry API routes with RBAC and Zod validation

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const {
  createEnquirySchema,
  updateEnquiryStatusSchema,
} = require("../validators/enquiry.validator");
const {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
} = require("../controllers/enquiry.controller");

// POST /api/enquiries - Create enquiry (SALES_USER only)
router.post(
  "/",
  authenticate,
  requireRole("SALES_USER"),
  validate(createEnquirySchema),
  createEnquiry
);

// GET /api/enquiries - List enquiries (ADMIN and SALES_USER)
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getEnquiries
);

// GET /api/enquiries/:id - Get enquiry by ID (ADMIN and SALES_USER)
router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getEnquiryById
);

// PATCH /api/enquiries/:id/status - Update enquiry status (ADMIN and SALES_USER)
router.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  validate(updateEnquiryStatusSchema),
  updateEnquiryStatus
);

module.exports = router;
