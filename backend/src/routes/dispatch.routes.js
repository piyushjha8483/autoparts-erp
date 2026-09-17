// src/routes/dispatch.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { getDispatches, getDispatchById } = require("../controllers/dispatch.controller");

// GET /api/dispatches - List dispatches (ADMIN and SALES_USER)
router.get("/", authenticate, requireRole("ADMIN", "SALES_USER"), getDispatches);

// GET /api/dispatches/:id - Get dispatch by ID (ADMIN and SALES_USER)
router.get("/:id", authenticate, requireRole("ADMIN", "SALES_USER"), getDispatchById);

module.exports = router;
