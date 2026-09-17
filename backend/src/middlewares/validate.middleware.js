// src/middlewares/validate.middleware.js
// Zod Validation Middleware Factory

/**
 * Validates req.body against a Zod schema.
 * Returns 400 with structured errors if validation fails.
 * @param {import("zod").ZodSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.body = result.data; // Replace with parsed/coerced data
  next();
};

module.exports = { validate };
