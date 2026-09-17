// src/controllers/enquiry.controller.js
// Spare Parts Enquiry Controller

const prisma = require("../lib/prisma");

/**
 * POST /api/enquiries
 * Creates a new spare parts enquiry with multiple items inside a Prisma transaction.
 */
const createEnquiry = async (req, res, next) => {
  try {
    const { enquiryNumber, customerId, enquiryDate, expectedDate, notes, items } = req.body;

    // 1. Check if enquiryNumber is already taken
    const existingEnquiry = await prisma.enquiry.findUnique({
      where: { enquiryNumber },
    });
    if (existingEnquiry) {
      return res.status(409).json({
        success: false,
        message: `Enquiry with number '${enquiryNumber}' already exists`,
      });
    }

    // 2. Verify Customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customerId} does not exist`,
      });
    }

    // 3. Verify all Products exist
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    const foundProductIds = new Set(existingProducts.map((p) => p.id));
    const missingProductIds = productIds.filter((id) => !foundProductIds.has(id));

    if (missingProductIds.length > 0) {
      return res.status(404).json({
        success: false,
        message: `Product(s) not found with ID(s): ${missingProductIds.join(", ")}`,
      });
    }

    // 4. Execute Prisma Transaction to create Enquiry and relational EnquiryItems
    const newEnquiry = await prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.create({
        data: {
          enquiryNumber,
          customerId,
          enquiryDate: enquiryDate ? new Date(enquiryDate) : new Date(),
          requiredDate: expectedDate ? new Date(expectedDate) : null,
          notes: notes || null,
          status: "NEW",
          enquiryItems: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          customer: true,
          enquiryItems: {
            include: {
              product: true,
            },
          },
        },
      });

      return enquiry;
    });

    return res.status(201).json({
      success: true,
      message: "Enquiry created successfully",
      enquiry: newEnquiry,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/enquiries
 * Lists all enquiries with relational customer and item details.
 */
const getEnquiries = async (req, res, next) => {
  try {
    const enquiries = await prisma.enquiry.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        enquiryItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: enquiries.length,
      enquiries,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/enquiries/:id
 * Retrieves details for a specific enquiry by ID.
 */
const getEnquiryById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID format",
      });
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        customer: true,
        enquiryItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      enquiry,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/enquiries/:id/status
 * Updates enquiry status (NEW, QUOTED, WON, LOST)
 */
const updateEnquiryStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID format",
      });
    }

    const { status } = req.body;

    const existingEnquiry = await prisma.enquiry.findUnique({
      where: { id },
    });

    if (!existingEnquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry with ID ${id} not found`,
      });
    }

    // Validate status state transition rules
    // Allowed transitions: NEW -> QUOTED, QUOTED -> WON, QUOTED -> LOST
    const allowedTransitions = {
      NEW: ["QUOTED"],
      QUOTED: ["WON", "LOST"],
      WON: [],
      LOST: [],
    };

    const currentStatus = existingEnquiry.status;
    const allowedNextStatuses = allowedTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentStatus}' to '${status}'. Allowed transitions from '${currentStatus}': ${
          allowedNextStatuses.length > 0 ? allowedNextStatuses.join(", ") : "none (terminal status)"
        }`,
      });
    }

    const updatedEnquiry = await prisma.enquiry.update({
      where: { id },
      data: { status },
      include: {
        customer: true,
        enquiryItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Enquiry status updated to ${status}`,
      enquiry: updatedEnquiry,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
};
