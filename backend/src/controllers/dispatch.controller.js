// src/controllers/dispatch.controller.js
const prisma = require("../lib/prisma");

/**
 * POST /api/sales-orders/:id/dispatch
 * Dispatches a CONFIRMED Sales Order.
 */
const dispatchSalesOrder = async (req, res, next) => {
  try {
    const salesOrderId = parseInt(req.params.id, 10);
    if (isNaN(salesOrderId)) {
      return res.status(400).json({ success: false, message: "Invalid Sales Order ID format" });
    }

    const { dispatchNumber, dispatchDate, vehicleNumber, driverName } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Sales Order
      const salesOrder = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { salesOrderItems: true },
      });

      if (!salesOrder) {
        throw { status: 404, message: `Sales Order with ID ${salesOrderId} not found` };
      }

      // 2. Only allow dispatching CONFIRMED orders
      if (salesOrder.status !== "CONFIRMED") {
        throw { status: 400, message: `Only CONFIRMED Sales Orders can be dispatched. Current status: ${salesOrder.status}` };
      }

      // 3. Atomically update inventory for each item
      const dispatchItems = [];
      for (const item of salesOrder.salesOrderItems) {
        // Decrease physicalQty and reservedQty
        const updatedCount = await tx.$executeRaw`
          UPDATE inventory
          SET reserved_qty = reserved_qty - ${item.quantity},
              physical_qty = physical_qty - ${item.quantity},
              updated_at = NOW()
          WHERE product_id = ${item.productId}
            AND reserved_qty >= ${item.quantity}
            AND physical_qty >= ${item.quantity}
        `;

        if (updatedCount === 0) {
          throw { status: 400, message: `Insufficient reserved or physical stock for product ID ${item.productId}` };
        }

        dispatchItems.push({
          productId: item.productId,
          quantity: item.quantity,
        });
      }

      // 4. Create Dispatch record (relies on DB constraint to prevent duplicates)
      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNumber,
          salesOrderId: salesOrder.id,
          dispatchDate: new Date(dispatchDate),
          vehicleNumber,
          driverName,
          dispatchItems: {
            create: dispatchItems,
          },
        },
        include: {
          dispatchItems: {
            include: { product: true }
          }
        }
      });

      // 5. Update Sales Order status
      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: "DISPATCHED" },
      });

      return dispatch;
    });

    return res.status(201).json({
      success: true,
      message: "Sales Order dispatched successfully",
      dispatch: result,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A Dispatch already exists for this Sales Order (or duplicate dispatchNumber)",
      });
    }

    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }

    next(err);
  }
};

/**
 * GET /api/dispatches
 * Lists all dispatches.
 */
const getDispatches = async (req, res, next) => {
  try {
    const dispatches = await prisma.dispatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        salesOrder: {
          include: { customer: true }
        },
        dispatchItems: {
          include: { product: true }
        }
      },
    });

    return res.status(200).json({
      success: true,
      count: dispatches.length,
      dispatches,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dispatches/:id
 * Retrieves a specific dispatch by ID.
 */
const getDispatchById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid Dispatch ID format" });
    }

    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: { customer: true }
        },
        dispatchItems: {
          include: { product: true }
        }
      },
    });

    if (!dispatch) {
      return res.status(404).json({ success: false, message: `Dispatch with ID ${id} not found` });
    }

    return res.status(200).json({
      success: true,
      dispatch,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  dispatchSalesOrder,
  getDispatches,
  getDispatchById,
};
