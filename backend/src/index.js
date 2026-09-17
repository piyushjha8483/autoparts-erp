// src/index.js
// AutoParts ERP - Main Express Server Entry Point

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "AutoParts ERP API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/customers", require("./routes/customer.routes"));
app.use("/api/enquiries", require("./routes/enquiry.routes"));
// app.use("/api/products",     require("./routes/product.routes"));
app.use("/api/quotations", require("./routes/quotation.routes"));
app.use("/api/sales-orders", require("./routes/salesOrder.routes"));
app.use("/api/dispatches", require("./routes/dispatch.routes"));
app.use("/api/inventory", require("./routes/inventory.routes"));

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`\n🚀 AutoParts ERP Backend running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
    console.log(`   Health Check: http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app; // Export for testing
