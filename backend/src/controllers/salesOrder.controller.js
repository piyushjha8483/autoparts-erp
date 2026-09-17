// src/controllers/salesOrder.controller.js
// Sales Order Controller

const prisma = require("../lib/prisma");

/**
 * POST /api/quotations/:id/convert
 * Converts an ACCEPTED quotation into a Sales Order.
 */
const convertQuotationToSalesOrder = async (req, res, next) => {
  try {
    const quotationId = parseInt(req.params.id, 10);
    if (isNaN(quotationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format",
      });
    }

    const { orderNumber } = req.body;

    // We use a transaction to ensure atomicity.
    const salesOrder = await prisma.$transaction(async (tx) => {
      // 1. Fetch quotation with items
      const quotation = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: { quotationItems: true },
      });

      if (!quotation) {
        throw { status: 404, message: `Quotation with ID ${quotationId} not found` };
      }

      // 2. Only allow converting ACCEPTED quotations
      if (quotation.status !== "ACCEPTED") {
        throw { 
          status: 400, 
          message: `Only ACCEPTED quotations can be converted to Sales Orders. Current status is ${quotation.status}.` 
        };
      }

      // 3. Map items and copy EXACT amounts/prices as required
      const orderItems = quotation.quotationItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineAmount: item.lineAmount,
      }));

      // 4. Create Sales Order
      // If a Sales Order with this quotationId already exists, it will throw a P2002 error
      // due to the unique constraint on quotationId, which we will catch and map to 409 Conflict.
      const newOrder = await tx.salesOrder.create({
        data: {
          orderNumber,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          totalAmount: quotation.grandTotal, // Safely copied from backend-calculated total
          status: "PENDING",
          salesOrderItems: {
            create: orderItems,
          },
        },
        include: {
          customer: true,
          quotation: true,
          salesOrderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      return newOrder;
    });

    return res.status(201).json({
      success: true,
      message: "Quotation successfully converted to Sales Order",
      salesOrder,
    });
  } catch (err) {
    // Handle Prisma duplicate constraint error (e.g. duplicate quotationId or orderNumber)
    if (err.code === "P2002") {
      const target = err.meta && err.meta.target ? err.meta.target : [];
      let conflictMsg = "A Sales Order already exists for this Quotation";
      if (target.includes("order_number")) {
        conflictMsg = "A Sales Order with this orderNumber already exists";
      }
      return res.status(409).json({
        success: false,
        message: conflictMsg,
      });
    }
    
    // Handle manual throws from the transaction
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }

    next(err);
  }
};

/**
 * GET /api/sales-orders
 * Lists all Sales Orders.
 */
const getSalesOrders = async (req, res, next) => {
  try {
    const salesOrders = await prisma.salesOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        quotation: true,
        salesOrderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: salesOrders.length,
      salesOrders,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/sales-orders/:id
 * Retrieves a specific Sales Order by ID.
 */
const getSalesOrderById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sales Order ID format",
      });
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        quotation: true,
        salesOrderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: `Sales Order with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      salesOrder,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sales-orders/:id/confirm
 * Confirms a PENDING sales order and atomically reserves inventory.
 */
const confirmSalesOrder = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid Sales Order ID format" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Sales Order
      const salesOrder = await tx.salesOrder.findUnique({
        where: { id },
        include: { salesOrderItems: true },
      });

      if (!salesOrder) {
        throw { status: 404, message: `Sales Order with ID ${id} not found` };
      }

      if (salesOrder.status !== "PENDING") {
        throw { status: 400, message: `Only PENDING Sales Orders can be confirmed. Current status: ${salesOrder.status}` };
      }

      // 2. Perform atomic inventory reservations for all items
      for (const item of salesOrder.salesOrderItems) {
        // First verify inventory exists
        const inv = await tx.inventory.findUnique({ where: { productId: item.productId } });
        if (!inv) {
          throw { status: 400, message: `Inventory record not found for product ID ${item.productId}` };
        }

        // Execute conditional raw update
        const updatedCount = await tx.$executeRaw`
          UPDATE inventory
          SET reserved_qty = reserved_qty + ${item.quantity},
              updated_at = NOW()
          WHERE product_id = ${item.productId}
            AND reserved_qty + ${item.quantity} <= physical_qty
        `;

        if (updatedCount === 0) {
          throw { status: 400, message: `Insufficient available stock for product ID ${item.productId}` };
        }
      }

      // 3. Update Sales Order status to CONFIRMED
      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: { salesOrderItems: true }
      });

      return updatedOrder;
    });

    return res.status(200).json({
      success: true,
      message: "Sales Order confirmed and inventory reserved successfully",
      salesOrder: result,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  convertQuotationToSalesOrder,
  getSalesOrders,
  getSalesOrderById,
  confirmSalesOrder,
};
