// src/middlewares/auth.middleware.js
// JWT Authentication + Role-Based Access Control Middleware

const jwt = require("jsonwebtoken");

/**
 * Middleware: Verifies JWT from Authorization header.
 * Attaches decoded user payload to req.user.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please provide a valid Bearer token.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please log in again.",
    });
  }
};

/**
 * Middleware factory: Restricts access to specific roles.
 * @param {...string} roles - Allowed roles (e.g., "ADMIN", "SALES_USER")
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

module.exports = { authenticate, requireRole };
