// src/validators/salesOrder.validator.js
// Zod validation schemas for Sales Order module

const { z } = require("zod");

const convertQuotationSchema = z.object({
  orderNumber: z
    .string({ required_error: "orderNumber is required" })
    .min(1, "orderNumber cannot be empty")
    .max(50, "orderNumber must not exceed 50 characters")
    .trim(),
});

module.exports = {
  convertQuotationSchema,
};
