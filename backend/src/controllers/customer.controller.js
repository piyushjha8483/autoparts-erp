// src/controllers/customer.controller.js
// Customer management controller

const prisma = require("../lib/prisma");

/**
 * POST /api/customers
 * Creates a new customer (Garages / Automobile Dealers)
 */
const createCustomer = async (req, res, next) => {
  try {
    const { companyName, contactPerson, mobile, email, city } = req.body;

    const customer = await prisma.customer.create({
      data: {
        companyName,
        contactPerson,
        mobile,
        email: email || null,
        city,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/customers
 * Lists all customers
 */
const getCustomers = async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/customers/:id
 * Fetches single customer details by ID
 */
const getCustomerById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format",
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
};
