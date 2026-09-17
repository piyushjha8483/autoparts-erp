// src/validators/enquiry.validator.js
// Zod validation schemas for Enquiry module

const { z } = require("zod");

const enquiryItemSchema = z.object({
  productId: z
    .number({ required_error: "productId is required" })
    .int("productId must be an integer")
    .positive("productId must be a positive integer"),
  quantity: z
    .number({ required_error: "quantity is required" })
    .gt(0, "quantity must be greater than 0"),
});

const createEnquirySchema = z.object({
  enquiryNumber: z
    .string({ required_error: "enquiryNumber is required" })
    .min(1, "enquiryNumber cannot be empty")
    .max(50, "enquiryNumber must not exceed 50 characters")
    .trim(),
  customerId: z
    .number({ required_error: "customerId is required" })
    .int("customerId must be an integer")
    .positive("customerId must be a positive integer"),
  enquiryDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "enquiryDate must be a valid date string",
    }),
  expectedDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "expectedDate must be a valid date string",
    }),
  notes: z.string().optional().nullable(),
  items: z
    .array(enquiryItemSchema, { required_error: "items are required" })
    .min(1, "An enquiry must contain at least one item"),
});

const updateEnquiryStatusSchema = z.object({
  status: z.enum(["NEW", "QUOTED", "WON", "LOST"], {
    errorMap: () => ({
      message: "Status must be one of: NEW, QUOTED, WON, LOST",
    }),
  }),
});

module.exports = {
  createEnquirySchema,
  updateEnquiryStatusSchema,
};
