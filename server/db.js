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
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL
    );`,
  ).run();

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
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customerId) REFERENCES customers(id)
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
      `INSERT INTO users (name, email, role) VALUES (@name, @email, @role);`,
    );
    const seed = [
      { name: "Alice", email: "alice@fx.com", role: "admin" },
      { name: "Ben", email: "ben@fx.com", role: "manager" },
      { name: "Cara", email: "cara@fx.com", role: "viewer" },
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
    const insert = db.prepare(
      `INSERT INTO orders (customerId, fromCurrency, toCurrency, amountBuy, amountSell, rate, status, createdAt)
       VALUES (@customerId, @fromCurrency, @toCurrency, @amountBuy, @amountSell, @rate, @status, @createdAt);`,
    );
    const nowIso = () => new Date().toISOString();
    const seed = [
      {
        customerId: 1,
        fromCurrency: "USD",
        toCurrency: "EUR",
        amountBuy: 5400,
        amountSell: 5000,
        rate: 1.08,
        status: "pending",
        createdAt: nowIso(),
      },
      {
        customerId: 2,
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
};

export const initDatabase = () => {
  ensureSchema();
  seedData();
};

export const DB_CONSTANTS = {
  SECTIONS,
};


