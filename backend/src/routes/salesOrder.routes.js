// src/routes/salesOrder.routes.js
// Sales Order API routes with RBAC

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const {
  getSalesOrders,
  getSalesOrderById,
  confirmSalesOrder,
} = require("../controllers/salesOrder.controller");

// GET /api/sales-orders - List sales orders (ADMIN and SALES_USER)
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getSalesOrders
);

// GET /api/sales-orders/:id - Get sales order by ID (ADMIN and SALES_USER)
router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES_USER"),
  getSalesOrderById
);

const { dispatchSalesOrder } = require("../controllers/dispatch.controller");
const { createDispatchSchema } = require("../validators/dispatch.validator");
const { validate } = require("../middlewares/validate.middleware");

// POST /api/sales-orders/:id/confirm - Confirm sales order (ADMIN only)
router.post(
  "/:id/confirm",
  authenticate,
  requireRole("ADMIN"),
  confirmSalesOrder
);

// POST /api/sales-orders/:id/dispatch - Dispatch sales order (ADMIN only)
router.post(
  "/:id/dispatch",
  authenticate,
  requireRole("ADMIN"),
  validate(createDispatchSchema),
  dispatchSalesOrder
);

module.exports = router;
