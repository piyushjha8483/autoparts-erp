const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");

// GET /api/inventory
router.get("/", authenticate, requireRole("ADMIN", "SALES_USER"), async (req, res, next) => {
  try {
    const inventory = await prisma.product.findMany({
      include: {
        inventory: true
      },
      orderBy: { partName: "asc" }
    });

    const formatted = inventory.map(p => {
      const physical = p.inventory ? parseFloat(p.inventory.physicalQty) : 0;
      const reserved = p.inventory ? parseFloat(p.inventory.reservedQty) : 0;
      return {
        id: p.id,
        partCode: p.partCode,
        partName: p.partName,
        category: p.category,
        basePrice: parseFloat(p.basePrice),
        physicalQuantity: physical,
        reservedQuantity: reserved,
        availableQuantity: physical - reserved
      };
    });

    return res.status(200).json({ success: true, count: formatted.length, inventory: formatted });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
