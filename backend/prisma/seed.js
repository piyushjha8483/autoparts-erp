// prisma/seed.js
// Seed script: Creates admin user, sales user, 6 spare parts, and inventory records

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ───────────────────────────────────────────────────
  // USERS
  // ───────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 10);
  const salesPassword = await bcrypt.hash("sales123", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { username: "sales" },
    update: { role: "SALES_USER" },
    create: {
      username: "sales",
      passwordHash: salesPassword,
      role: "SALES_USER",
    },
  });

  console.log(`✅ Users created: ${admin.username} (ADMIN), ${salesUser.username} (SALES_USER)`);

  // ───────────────────────────────────────────────────
  // PRODUCTS (Automobile Spare Parts)
  // ───────────────────────────────────────────────────
  const productsData = [
    {
      partCode: "BP-001",
      partName: "Brake Pad Set",
      category: "Braking System",
      unit: "Set",
      basePrice: 1200.0,
    },
    {
      partCode: "CP-001",
      partName: "Clutch Plate",
      category: "Transmission",
      unit: "Piece",
      basePrice: 2500.0,
    },
    {
      partCode: "EO-5W30",
      partName: "Engine Oil 5W-30 (1L)",
      category: "Lubricants",
      unit: "Litre",
      basePrice: 350.0,
    },
    {
      partCode: "AF-001",
      partName: "Air Filter",
      category: "Engine",
      unit: "Piece",
      basePrice: 450.0,
    },
    {
      partCode: "SP-001",
      partName: "Spark Plug",
      category: "Ignition System",
      unit: "Piece",
      basePrice: 180.0,
    },
    {
      partCode: "OF-001",
      partName: "Oil Filter",
      category: "Engine",
      unit: "Piece",
      basePrice: 220.0,
    },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { partCode: p.partCode },
      update: {},
      create: p,
    });
    createdProducts.push(product);
    console.log(`  ✅ Product: [${product.partCode}] ${product.partName}`);
  }

  // ───────────────────────────────────────────────────
  // INVENTORY (Initial Stock)
  // ───────────────────────────────────────────────────
  const inventoryData = [
    { productId: createdProducts[0].id, physicalQty: 100, reservedQty: 0 }, // Brake Pad Set
    { productId: createdProducts[1].id, physicalQty: 50,  reservedQty: 0 }, // Clutch Plate
    { productId: createdProducts[2].id, physicalQty: 500, reservedQty: 0 }, // Engine Oil
    { productId: createdProducts[3].id, physicalQty: 200, reservedQty: 0 }, // Air Filter
    { productId: createdProducts[4].id, physicalQty: 300, reservedQty: 0 }, // Spark Plug
    { productId: createdProducts[5].id, physicalQty: 250, reservedQty: 0 }, // Oil Filter
  ];

  for (const inv of inventoryData) {
    await prisma.inventory.upsert({
      where: { productId: inv.productId },
      update: {},
      create: inv,
    });
  }

  console.log("✅ Inventory records created for all products");

  // ───────────────────────────────────────────────────
  // SAMPLE CUSTOMER
  // ───────────────────────────────────────────────────
  await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyName: "Sharma Auto Garage",
      contactPerson: "Ramesh Sharma",
      mobile: "9876543210",
      email: "ramesh@sharmagarage.com",
      city: "Delhi",
    },
  });

  await prisma.customer.upsert({
    where: { id: 2 },
    update: {},
    create: {
      companyName: "Krishna Motors Pvt. Ltd.",
      contactPerson: "Suresh Kumar",
      mobile: "9812345678",
      email: "suresh@krishnamotors.com",
      city: "Mumbai",
    },
  });

  console.log("✅ Sample customers created");

  console.log("\n🎉 Seed completed successfully!");
  console.log("─────────────────────────────────────────────");
  console.log("Seed Credentials:");
  console.log("  ADMIN       → username: admin  | password: admin123");
  console.log("  SALES_USER  → username: sales  | password: sales123");
  console.log("─────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
