// src/validators/dispatch.validator.js
const { z } = require("zod");

const createDispatchSchema = z.object({
  dispatchNumber: z.string({ required_error: "dispatchNumber is required" }).trim().min(1),
  dispatchDate: z.string({ required_error: "dispatchDate is required" }).datetime().or(z.string().min(10)),
  vehicleNumber: z.string().trim().optional(),
  driverName: z.string().trim().optional(),
});

module.exports = {
  createDispatchSchema,
};
