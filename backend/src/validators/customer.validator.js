// src/validators/customer.validator.js
// Zod validation schemas for Customer module

const { z } = require("zod");

const createCustomerSchema = z.object({
  companyName: z
    .string({ required_error: "companyName is required" })
    .min(1, "companyName cannot be empty")
    .max(200, "companyName must not exceed 200 characters")
    .trim(),
  contactPerson: z
    .string({ required_error: "contactPerson is required" })
    .min(1, "contactPerson cannot be empty")
    .max(100, "contactPerson must not exceed 100 characters")
    .trim(),
  mobile: z
    .string({ required_error: "mobile is required" })
    .min(1, "mobile cannot be empty")
    .max(20, "mobile must not exceed 20 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email format")
    .max(150, "email must not exceed 150 characters")
    .optional()
    .or(z.literal("")),
  city: z
    .string({ required_error: "city is required" })
    .min(1, "city cannot be empty")
    .max(100, "city must not exceed 100 characters")
    .trim(),
});

module.exports = {
  createCustomerSchema,
};
