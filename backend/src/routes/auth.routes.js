// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { loginSchema } = require("../validators/auth.validator");

// Public routes
router.post("/login", validate(loginSchema), authController.login);

// Protected routes
router.get("/me", authenticate, authController.getMe);
router.get("/admin-test", authenticate, requireRole("ADMIN"), authController.adminTest);

module.exports = router;
