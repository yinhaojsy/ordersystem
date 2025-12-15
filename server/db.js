import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "server", "data");
const dbPath = path.join(dataDir, "app.db");

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const SECTIONS = ["dashboard", "currencies", "customers", "users", "roles", "orders"];

const ensureSchema = () => {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      baseRateBuy REAL NOT NULL,
      conversionRateBuy REAL NOT NULL,
      baseRateSell REAL NOT NULL,
      conversionRateSell REAL NOT NULL,
      active INTEGER DEFAULT 1
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS customer_beneficiaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      paymentType TEXT NOT NULL,
      networkChain TEXT,
      walletAddresses TEXT,
      bankName TEXT,
      accountTitle TEXT,
      accountNumber TEXT,
      accountIban TEXT,
      swiftCode TEXT,
      bankAddress TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL
    );`,
  ).run();

  // Ensure password column exists for legacy databases
  const userColumns = db.prepare("PRAGMA table_info(users);").all();
  const hasPasswordColumn = userColumns.some((col) => col.name === "password");
  if (!hasPasswordColumn) {
    db.prepare("ALTER TABLE users ADD COLUMN password TEXT;").run();
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      displayName TEXT NOT NULL,
      permissions TEXT NOT NULL
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      fromCurrency TEXT NOT NULL,
      toCurrency TEXT NOT NULL,
      amountBuy REAL NOT NULL,
      amountSell REAL NOT NULL,
      rate REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      handlerId INTEGER,
      paymentType TEXT,
      networkChain TEXT,
      walletAddresses TEXT,
      bankDetails TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customerId) REFERENCES customers(id),
      FOREIGN KEY(handlerId) REFERENCES users(id)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS order_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      imagePath TEXT NOT NULL,
      amount REAL NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS order_beneficiaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      paymentType TEXT NOT NULL,
      networkChain TEXT,
      walletAddresses TEXT,
      bankName TEXT,
      accountTitle TEXT,
      accountNumber TEXT,
      accountIban TEXT,
      swiftCode TEXT,
      bankAddress TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS order_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      imagePath TEXT NOT NULL,
      amount REAL NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
    );`,
  ).run();
};

const seedData = () => {
  const currencyCount = db.prepare("SELECT COUNT(*) as count FROM currencies").get().count;
  if (currencyCount === 0) {
    const insert = db.prepare(
      `INSERT INTO currencies (code, name, baseRateBuy, conversionRateBuy, baseRateSell, conversionRateSell, active)
       VALUES (@code, @name, @baseRateBuy, @conversionRateBuy, @baseRateSell, @conversionRateSell, @active);`,
    );
    const seed = [
      {
        code: "USD",
        name: "US Dollar",
        baseRateBuy: 1.0,
        conversionRateBuy: 1.0,
        baseRateSell: 1.0,
        conversionRateSell: 1.0,
        active: 1,
      },
      {
        code: "EUR",
        name: "Euro",
        baseRateBuy: 1.08,
        conversionRateBuy: 1.085,
        baseRateSell: 1.075,
        conversionRateSell: 1.08,
        active: 1,
      },
      {
        code: "GBP",
        name: "British Pound",
        baseRateBuy: 1.25,
        conversionRateBuy: 1.255,
        baseRateSell: 1.245,
        conversionRateSell: 1.25,
        active: 1,
      },
    ];
    const insertMany = db.transaction((rows) => rows.forEach((row) => insert.run(row)));
    insertMany(seed);
  }

  const customerCount = db.prepare("SELECT COUNT(*) as count FROM customers").get().count;
  if (customerCount === 0) {
    const insert = db.prepare(
      `INSERT INTO customers (name, email, phone) VALUES (@name, @email, @phone);`,
    );
    const seed = [
      { name: "John Doe", email: "john@example.com", phone: "+1-555-0101" },
      { name: "Sophie Yang", email: "sophie@example.com", phone: "+1-555-0102" },
      { name: "Michael Chen", email: "michael@example.com", phone: "+1-555-0103" },
    ];
    const insertMany = db.transaction((rows) => rows.forEach((row) => insert.run(row)));
    insertMany(seed);
  }

  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (userCount === 0) {
    const insert = db.prepare(
      `INSERT INTO users (name, email, password, role) VALUES (@name, @email, @password, @role);`,
    );
    const seed = [
      { name: "Alice", email: "alice@fx.com", password: "$2a$10$7zYd9Yz0Q7qZfyq/BKUKee9ZCBAWNRwJj4tUNsGrD/qVUKPTySGfa", role: "admin" }, // password: admin123
      { name: "Ben", email: "ben@fx.com", password: "$2a$10$7zYd9Yz0Q7qZfyq/BKUKee9ZCBAWNRwJj4tUNsGrD/qVUKPTySGfa", role: "manager" },
      { name: "Cara", email: "cara@fx.com", password: "$2a$10$7zYd9Yz0Q7qZfyq/BKUKee9ZCBAWNRwJj4tUNsGrD/qVUKPTySGfa", role: "viewer" },
    ];
    const insertMany = db.transaction((rows) => rows.forEach((row) => insert.run(row)));
    insertMany(seed);
  }

  const roleCount = db.prepare("SELECT COUNT(*) as count FROM roles").get().count;
  if (roleCount === 0) {
    const insert = db.prepare(
      `INSERT INTO roles (name, displayName, permissions) VALUES (@name, @displayName, @permissions);`,
    );
    const basePermissions = [
      {
        name: "admin",
        displayName: "Admin",
        permissions: {
          sections: SECTIONS,
          actions: {
            createCustomer: true,
            createUser: true,
            createOrder: true,
            createCurrency: true,
            editCurrency: true,
            processOrder: true,
            cancelOrder: true,
            deleteOrder: true,
            deleteManyOrders: true,
          },
        },
      },
      {
        name: "manager",
        displayName: "Manager",
        permissions: {
          sections: ["dashboard", "currencies", "customers", "orders"],
          actions: {
            createCustomer: true,
            createOrder: true,
            createCurrency: true,
            editCurrency: true,
            processOrder: true,
            cancelOrder: true,
          },
        },
      },
      {
        name: "viewer",
        displayName: "Viewer",
        permissions: {
          sections: ["dashboard", "orders"],
          actions: {},
        },
      },
    ];
    const insertMany = db.transaction((rows) =>
      rows.forEach((row) =>
        insert.run({
          name: row.name,
          displayName: row.displayName,
          permissions: JSON.stringify(row.permissions),
        }),
      ),
    );
    insertMany(basePermissions);
  }

  const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders").get().count;
  if (orderCount === 0) {
    // Get actual customer IDs from the database
    const getCustomerId = db.prepare("SELECT id FROM customers WHERE email = ?");
    const customer1 = getCustomerId.get("john@example.com");
    const customer2 = getCustomerId.get("sophie@example.com");
    
    // Only seed orders if we have at least 2 customers
    if (customer1 && customer2) {
      const insert = db.prepare(
        `INSERT INTO orders (customerId, fromCurrency, toCurrency, amountBuy, amountSell, rate, status, createdAt)
         VALUES (@customerId, @fromCurrency, @toCurrency, @amountBuy, @amountSell, @rate, @status, @createdAt);`,
      );
      const nowIso = () => new Date().toISOString();
      const seed = [
        {
          customerId: customer1.id,
          fromCurrency: "USD",
          toCurrency: "EUR",
          amountBuy: 5400,
          amountSell: 5000,
          rate: 1.08,
          status: "pending",
          createdAt: nowIso(),
        },
        {
          customerId: customer2.id,
          fromCurrency: "GBP",
          toCurrency: "USD",
          amountBuy: 4000,
          amountSell: 3200,
          rate: 1.25,
          status: "completed",
          createdAt: nowIso(),
        },
      ];
      const insertMany = db.transaction((rows) => rows.forEach((row) => insert.run(row)));
      insertMany(seed);
    }
  }
};

const migrateDatabase = () => {
  // Check if new columns exist, if not add them
  try {
    const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
    const columnNames = tableInfo.map((col) => col.name);
    
    if (!columnNames.includes("handlerId")) {
      db.prepare("ALTER TABLE orders ADD COLUMN handlerId INTEGER REFERENCES users(id)").run();
    }
    if (!columnNames.includes("paymentType")) {
      db.prepare("ALTER TABLE orders ADD COLUMN paymentType TEXT").run();
    }
    if (!columnNames.includes("networkChain")) {
      db.prepare("ALTER TABLE orders ADD COLUMN networkChain TEXT").run();
    }
    if (!columnNames.includes("walletAddresses")) {
      db.prepare("ALTER TABLE orders ADD COLUMN walletAddresses TEXT").run();
    }
    if (!columnNames.includes("bankDetails")) {
      db.prepare("ALTER TABLE orders ADD COLUMN bankDetails TEXT").run();
    }
  } catch (error) {
    console.error("Migration error:", error);
  }
};

export const initDatabase = () => {
  ensureSchema();
  migrateDatabase();
  seedData();
};

export const DB_CONSTANTS = {
  SECTIONS,
};


