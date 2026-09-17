// src/validators/quotation.validator.js
// Zod validation schemas for Quotation module

const { z } = require("zod");

const quotationItemSchema = z.object({
  productId: z
    .number({ required_error: "productId is required" })
    .int("productId must be an integer")
    .positive("productId must be a positive integer"),
  quantity: z
    .number({ required_error: "quantity is required" })
    .gt(0, "quantity must be greater than 0"),
  unitPrice: z
    .number({ required_error: "unitPrice is required" })
    .nonnegative("unitPrice cannot be negative"),
  discountPercent: z
    .number({ required_error: "discountPercent is required" })
    .min(0, "discountPercent must be at least 0")
    .max(100, "discountPercent cannot exceed 100"),
  gstPercent: z
    .number({ required_error: "gstPercent is required" })
    .min(0, "gstPercent must be at least 0")
    .max(100, "gstPercent cannot exceed 100"),
});

const createQuotationSchema = z.object({
  quotationNumber: z
    .string({ required_error: "quotationNumber is required" })
    .min(1, "quotationNumber cannot be empty")
    .max(50, "quotationNumber must not exceed 50 characters")
    .trim(),
  enquiryId: z
    .number({ required_error: "enquiryId is required" })
    .int("enquiryId must be an integer")
    .positive("enquiryId must be a positive integer"),
  validUntil: z
    .string({ required_error: "validUntil is required" })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "validUntil must be a valid date string",
    }),
  items: z
    .array(quotationItemSchema, { required_error: "items are required" })
    .min(1, "A quotation must contain at least one item"),
});

const updateQuotationStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"], {
    errorMap: () => ({
      message: "Status must be one of: DRAFT, SENT, ACCEPTED, REJECTED",
    }),
  }),
});

module.exports = {
  createQuotationSchema,
  updateQuotationStatusSchema,
};
