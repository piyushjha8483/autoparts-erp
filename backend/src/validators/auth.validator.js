// src/validators/auth.validator.js
const { z } = require("zod");

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

module.exports = { loginSchema };
