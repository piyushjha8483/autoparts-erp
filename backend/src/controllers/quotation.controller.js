// src/controllers/quotation.controller.js
// Quotation Controller

const prisma = require("../lib/prisma");
const { Prisma } = require("@prisma/client");

/**
 * POST /api/quotations
 * Creates a new quotation.
 */
const createQuotation = async (req, res, next) => {
  try {
    const { quotationNumber, enquiryId, validUntil, items } = req.body;

    // 1. Check if quotationNumber is already taken
    const existingQuotation = await prisma.quotation.findUnique({
      where: { quotationNumber },
    });
    if (existingQuotation) {
      return res.status(409).json({
        success: false,
        message: `Quotation with number '${quotationNumber}' already exists`,
      });
    }

    // 2. Verify Enquiry exists and get customerId
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
    });
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry with ID ${enquiryId} does not exist`,
      });
    }

    if (enquiry.status === "LOST") {
      return res.status(400).json({
        success: false,
        message: "Cannot create quotation for a LOST enquiry",
      });
    }

    const customerId = enquiry.customerId;

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

    // 4. Execute Prisma Transaction to create Quotation, QuotationItems, and update Enquiry
    const newQuotation = await prisma.$transaction(async (tx) => {
      // Update the related Enquiry status to QUOTED (only if it was NEW)
      if (enquiry.status === "NEW") {
        await tx.enquiry.update({
          where: { id: enquiryId },
          data: { status: "QUOTED" },
        });
      }

      let grandTotal = new Prisma.Decimal(0);
      
      const formattedItems = items.map((item) => {
        const qty = new Prisma.Decimal(item.quantity);
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const discountPct = new Prisma.Decimal(item.discountPercent);
        const gstPct = new Prisma.Decimal(item.gstPercent);

        // Explicit calculation logic using Decimal to avoid floating-point errors
        const baseAmount = qty.mul(unitPrice);
        const discountAmount = baseAmount.mul(discountPct.div(100));
        const taxableAmount = baseAmount.sub(discountAmount);
        const gstAmount = taxableAmount.mul(gstPct.div(100));
        const lineAmount = taxableAmount.add(gstAmount);

        grandTotal = grandTotal.add(lineAmount);

        return {
          productId: item.productId,
          quantity: qty,
          unitPrice: unitPrice,
          discountPct: discountPct,
          gstPct: gstPct,
          lineAmount: lineAmount,
        };
      });

      // Create the quotation
      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          enquiryId,
          customerId,
          validUntil: new Date(validUntil),
          status: "DRAFT",
          grandTotal: grandTotal,
          quotationItems: {
            create: formattedItems,
          },
        },
        include: {
          enquiry: true,
          customer: true,
          quotationItems: {
            include: {
              product: true,
            },
          },
        },
      });

      return quotation;
    });

    return res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      quotation: newQuotation,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/quotations
 * Lists all quotations with relational data.
 */
const getQuotations = async (req, res, next) => {
  try {
    const quotations = await prisma.quotation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        enquiry: true,
        customer: true,
        quotationItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: quotations.length,
      quotations,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/quotations/:id
 * Retrieves details for a specific quotation by ID.
 */
const getQuotationById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format",
      });
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        enquiry: true,
        customer: true,
        quotationItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      quotation,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/quotations/:id/status
 * Updates quotation status (DRAFT, SENT, ACCEPTED, REJECTED)
 */
const updateQuotationStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format",
      });
    }

    const { status } = req.body;

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!existingQuotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation with ID ${id} not found`,
      });
    }

    // Validate status state transition rules
    // Allowed transitions: DRAFT -> SENT, SENT -> ACCEPTED, SENT -> REJECTED
    const allowedTransitions = {
      DRAFT: ["SENT"],
      SENT: ["ACCEPTED", "REJECTED"],
      ACCEPTED: [],
      REJECTED: [],
    };

    const currentStatus = existingQuotation.status;
    const allowedNextStatuses = allowedTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentStatus}' to '${status}'. Allowed transitions from '${currentStatus}': ${
          allowedNextStatuses.length > 0 ? allowedNextStatuses.join(", ") : "none (terminal status)"
        }`,
      });
    }

    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: { status },
      include: {
        enquiry: true,
        customer: true,
        quotationItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Quotation status updated to ${status}`,
      quotation: updatedQuotation,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
};
