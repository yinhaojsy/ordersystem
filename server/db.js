import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// Use Railway's persistent volume path, or fallback to local path
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "server", "data");
export const dbPath = path.join(dataDir, "app.db");

fs.mkdirSync(dataDir, { recursive: true });

const applyPragmas = (instance) => {
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
};

export const createDbInstance = () => {
  const instance = new Database(dbPath);
  applyPragmas(instance);
  return instance;
};

export let db = createDbInstance();

export const resetDbInstance = () => {
  try {
    if (db && typeof db.close === "function") {
      db.close();
    }
  } catch (e) {
    // ignore close errors
  }
  db = createDbInstance();
  return db;
};

const SECTIONS = ["dashboard", "currencies", "customers", "users", "roles", "orders", "transfers", "accounts", "expenses", "profit", "approval_requests"];

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
      phone TEXT,
      remarks TEXT
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
      permissions TEXT NOT NULL,
      updatedAt TEXT
    );`,
  ).run();
  
  // Add updatedAt column if it doesn't exist (migration)
  const roleColumns = db.prepare("PRAGMA table_info(roles);").all();
  const hasUpdatedAt = roleColumns.some((col) => col.name === "updatedAt");
  if (!hasUpdatedAt) {
    db.prepare("ALTER TABLE roles ADD COLUMN updatedAt TEXT;").run();
  }

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
      orderType TEXT DEFAULT 'online',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customerId) REFERENCES customers(id),
      FOREIGN KEY(handlerId) REFERENCES users(id)
    );`,
  ).run();

  // Migration: Add orderType column if it doesn't exist
  const orderColumns = db.prepare("PRAGMA table_info(orders);").all();
  const hasOrderType = orderColumns.some((col) => col.name === "orderType");
  if (!hasOrderType) {
    db.prepare("ALTER TABLE orders ADD COLUMN orderType TEXT DEFAULT 'online';").run();
  }

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

  db.prepare(
    `CREATE TABLE IF NOT EXISTS order_profits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      amount REAL NOT NULL,
      currencyCode TEXT NOT NULL,
      accountId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(accountId) REFERENCES accounts(id)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS order_service_charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      amount REAL NOT NULL,
      currencyCode TEXT NOT NULL,
      accountId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(accountId) REFERENCES accounts(id)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currencyCode TEXT NOT NULL,
      name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(currencyCode) REFERENCES currencies(code)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS account_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accountId INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(accountId) REFERENCES accounts(id) ON DELETE CASCADE
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS internal_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromAccountId INTEGER NOT NULL,
      toAccountId INTEGER NOT NULL,
      amount REAL NOT NULL,
      currencyCode TEXT NOT NULL,
      description TEXT,
      transactionFee REAL,
      createdBy INTEGER,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedBy INTEGER,
      updatedAt TEXT,
      FOREIGN KEY(fromAccountId) REFERENCES accounts(id),
      FOREIGN KEY(toAccountId) REFERENCES accounts(id),
      FOREIGN KEY(createdBy) REFERENCES users(id),
      FOREIGN KEY(updatedBy) REFERENCES users(id)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS transfer_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transferId INTEGER NOT NULL,
      changedBy INTEGER,
      changedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fromAccountId INTEGER NOT NULL,
      fromAccountName TEXT,
      toAccountId INTEGER NOT NULL,
      toAccountName TEXT,
      amount REAL NOT NULL,
      description TEXT,
      transactionFee REAL,
      FOREIGN KEY(transferId) REFERENCES internal_transfers(id) ON DELETE CASCADE,
      FOREIGN KEY(changedBy) REFERENCES users(id)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accountId INTEGER NOT NULL,
      amount REAL NOT NULL,
      currencyCode TEXT NOT NULL,
      description TEXT,
      imagePath TEXT,
      createdBy INTEGER,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedBy INTEGER,
      updatedAt TEXT,
      deletedBy INTEGER,
      deletedAt TEXT,
      FOREIGN KEY(accountId) REFERENCES accounts(id),
      FOREIGN KEY(createdBy) REFERENCES users(id),
      FOREIGN KEY(updatedBy) REFERENCES users(id),
      FOREIGN KEY(deletedBy) REFERENCES users(id)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS expense_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expenseId INTEGER NOT NULL,
      changedBy INTEGER,
      changedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accountId INTEGER NOT NULL,
      accountName TEXT,
      amount REAL NOT NULL,
      description TEXT,
      FOREIGN KEY(expenseId) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY(changedBy) REFERENCES users(id)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS profit_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      targetCurrencyCode TEXT NOT NULL,
      initialInvestment REAL NOT NULL DEFAULT 0,
      groups TEXT DEFAULT '[]',
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(targetCurrencyCode) REFERENCES currencies(code)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS profit_account_multipliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profitCalculationId INTEGER NOT NULL,
      accountId INTEGER NOT NULL,
      multiplier REAL NOT NULL DEFAULT 1.0,
      groupId TEXT,
      groupName TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(profitCalculationId) REFERENCES profit_calculations(id) ON DELETE CASCADE,
      FOREIGN KEY(accountId) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(profitCalculationId, accountId)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS profit_exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profitCalculationId INTEGER NOT NULL,
      fromCurrencyCode TEXT NOT NULL,
      toCurrencyCode TEXT NOT NULL,
      rate REAL NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(profitCalculationId) REFERENCES profit_calculations(id) ON DELETE CASCADE,
      FOREIGN KEY(fromCurrencyCode) REFERENCES currencies(code),
      FOREIGN KEY(toCurrencyCode) REFERENCES currencies(code),
      UNIQUE(profitCalculationId, fromCurrencyCode, toCurrencyCode)
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ).run();

  // Tags table - shared across orders, transfers, and expenses
  db.prepare(
    `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ).run();

  // Tag assignments for orders
  db.prepare(
    `CREATE TABLE IF NOT EXISTS order_tag_assignments (
      orderId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (orderId, tagId),
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
    );`,
  ).run();

  // Migration: legacy databases pointed order_tag_assignments.tagId to order_tags
  const orderTagFkInfo = db.prepare("PRAGMA foreign_key_list(order_tag_assignments);").all();
  const usesLegacyOrderTags = orderTagFkInfo.some((fk) => fk.table === "order_tags");
  if (usesLegacyOrderTags) {
    // Move any legacy tags into the shared tags table and rebuild the FK
    db.exec("PRAGMA foreign_keys=OFF;");
    try {
      const legacyTagsTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='order_tags';",
      ).get();
      const legacyTags = legacyTagsTable
        ? db.prepare("SELECT id, name, color, createdAt FROM order_tags;").all()
        : [];

      if (legacyTags.length > 0) {
        const insertLegacyTag = db.prepare(
          "INSERT OR IGNORE INTO tags (id, name, color, createdAt) VALUES (@id, @name, @color, COALESCE(@createdAt, CURRENT_TIMESTAMP));",
        );
        const upsertLegacyTags = db.transaction((rows) => rows.forEach((row) => insertLegacyTag.run(row)));
        upsertLegacyTags(legacyTags);
      }

      db.exec(
        `CREATE TABLE IF NOT EXISTS order_tag_assignments_new (
          orderId INTEGER NOT NULL,
          tagId INTEGER NOT NULL,
          PRIMARY KEY (orderId, tagId),
          FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
        );`,
      );

      db.exec(
        "INSERT OR IGNORE INTO order_tag_assignments_new (orderId, tagId) SELECT orderId, tagId FROM order_tag_assignments;",
      );
      db.exec("DROP TABLE order_tag_assignments;");
      db.exec("ALTER TABLE order_tag_assignments_new RENAME TO order_tag_assignments;");
      db.exec("DROP TABLE IF EXISTS order_tags;");
    } finally {
      db.exec("PRAGMA foreign_keys=ON;");
    }
  }

  // Tag assignments for transfers
  db.prepare(
    `CREATE TABLE IF NOT EXISTS transfer_tag_assignments (
      transferId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (transferId, tagId),
      FOREIGN KEY(transferId) REFERENCES internal_transfers(id) ON DELETE CASCADE,
      FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
    );`,
  ).run();

  // Tag assignments for expenses
  db.prepare(
    `CREATE TABLE IF NOT EXISTS expense_tag_assignments (
      expenseId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (expenseId, tagId),
      FOREIGN KEY(expenseId) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
    );`,
  ).run();

  // Generic approval requests table (for orders, expenses, transfers, etc.)
  db.prepare(
    `CREATE TABLE IF NOT EXISTS approval_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityType TEXT NOT NULL,
      entityId INTEGER NOT NULL,
      requestType TEXT NOT NULL,
      requestedBy INTEGER NOT NULL,
      requestedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approvedBy INTEGER,
      approvedAt TEXT,
      rejectedBy INTEGER,
      rejectedAt TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requestData TEXT,
      originalEntityData TEXT,
      reason TEXT NOT NULL,
      FOREIGN KEY(requestedBy) REFERENCES users(id),
      FOREIGN KEY(approvedBy) REFERENCES users(id),
      FOREIGN KEY(rejectedBy) REFERENCES users(id)
    );`,
  ).run();

  // Migration: Add originalEntityData column if it doesn't exist
  const approvalRequestColumns = db.prepare("PRAGMA table_info(approval_requests);").all();
  const hasOriginalEntityData = approvalRequestColumns.some((col) => col.name === "originalEntityData");
  if (!hasOriginalEntityData) {
    db.prepare("ALTER TABLE approval_requests ADD COLUMN originalEntityData TEXT;").run();
  }

  // Notifications table
  db.prepare(
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      actionUrl TEXT,
      isRead INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );`,
  ).run();

  // Create indexes for better performance
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_notifications_user 
     ON notifications(userId);`,
  ).run();
  
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
     ON notifications(userId, isRead);`,
  ).run();

  // User notification preferences table
  db.prepare(
    `CREATE TABLE IF NOT EXISTS user_notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE,
      notifyApprovalApproved INTEGER DEFAULT 1,
      notifyApprovalRejected INTEGER DEFAULT 1,
      notifyApprovalPending INTEGER DEFAULT 1,
      notifyOrderAssigned INTEGER DEFAULT 1,
      notifyOrderUnassigned INTEGER DEFAULT 1,
      notifyOrderCreated INTEGER DEFAULT 0,
      notifyOrderCompleted INTEGER DEFAULT 0,
      notifyOrderCancelled INTEGER DEFAULT 0,
      notifyOrderDeleted INTEGER DEFAULT 1,
      notifyExpenseCreated INTEGER DEFAULT 0,
      notifyExpenseDeleted INTEGER DEFAULT 1,
      notifyTransferCreated INTEGER DEFAULT 0,
      notifyTransferDeleted INTEGER DEFAULT 1,
      enableEmailNotifications INTEGER DEFAULT 0,
      enablePushNotifications INTEGER DEFAULT 0,
      updatedAt TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
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

  {/*我 remove customers seed data*/}
/*   const customerCount = db.prepare("SELECT COUNT(*) as count FROM customers").get().count;
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
  } */

  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (userCount === 0) {
    const insert = db.prepare(
      `INSERT INTO users (name, email, password, role) VALUES (@name, @email, @password, @role);`,
    );
    const seed = [
      { name: "Admin", email: "admin@test.com", password: "$2a$10$7zYd9Yz0Q7qZfyq/BKUKee9ZCBAWNRwJj4tUNsGrD/qVUKPTySGfa", role: "admin" }, // password: admin123
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
            updateCurrency: true,
            processOrder: true,
            cancelOrder: true,
            deleteOrder: true,
            deleteManyOrders: true,
            approveOrderDelete: true,
            approveOrderEdit: true,
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
            updateCurrency: true,
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

/*
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
  } */
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
    if (!columnNames.includes("buyAccountId")) {
      db.prepare("ALTER TABLE orders ADD COLUMN buyAccountId INTEGER REFERENCES accounts(id)").run();
    }
    if (!columnNames.includes("sellAccountId")) {
      db.prepare("ALTER TABLE orders ADD COLUMN sellAccountId INTEGER REFERENCES accounts(id)").run();
    }
    if (!columnNames.includes("paymentFlow")) {
      db.prepare("ALTER TABLE orders ADD COLUMN paymentFlow TEXT DEFAULT 'receive_first'").run();
    }
    if (!columnNames.includes("actualAmountBuy")) {
      db.prepare("ALTER TABLE orders ADD COLUMN actualAmountBuy REAL").run();
    }
    if (!columnNames.includes("actualAmountSell")) {
      db.prepare("ALTER TABLE orders ADD COLUMN actualAmountSell REAL").run();
    }
    if (!columnNames.includes("actualRate")) {
      db.prepare("ALTER TABLE orders ADD COLUMN actualRate REAL").run();
    }
    if (!columnNames.includes("isFlexOrder")) {
      db.prepare("ALTER TABLE orders ADD COLUMN isFlexOrder INTEGER DEFAULT 0").run();
    }
    if (!columnNames.includes("serviceChargeAmount")) {
      db.prepare("ALTER TABLE orders ADD COLUMN serviceChargeAmount REAL").run();
    }
    if (!columnNames.includes("serviceChargeCurrency")) {
      db.prepare("ALTER TABLE orders ADD COLUMN serviceChargeCurrency TEXT").run();
    }
    if (!columnNames.includes("profitAmount")) {
      db.prepare("ALTER TABLE orders ADD COLUMN profitAmount REAL").run();
    }
    if (!columnNames.includes("profitCurrency")) {
      db.prepare("ALTER TABLE orders ADD COLUMN profitCurrency TEXT").run();
    }
    if (!columnNames.includes("profitAccountId")) {
      db.prepare("ALTER TABLE orders ADD COLUMN profitAccountId INTEGER REFERENCES accounts(id)").run();
    }
    if (!columnNames.includes("serviceChargeAccountId")) {
      db.prepare("ALTER TABLE orders ADD COLUMN serviceChargeAccountId INTEGER REFERENCES accounts(id)").run();
    }
    if (!columnNames.includes("remarks")) {
      db.prepare("ALTER TABLE orders ADD COLUMN remarks TEXT").run();
    }
    if (!columnNames.includes("createdBy")) {
      db.prepare("ALTER TABLE orders ADD COLUMN createdBy INTEGER REFERENCES users(id)").run();
    }

    // Check customers table for remarks column
    const customerTableInfo = db.prepare("PRAGMA table_info(customers)").all();
    const customerColumnNames = customerTableInfo.map((col) => col.name);
    
    if (!customerColumnNames.includes("remarks")) {
      db.prepare("ALTER TABLE customers ADD COLUMN remarks TEXT").run();
    }

    // Check order_payments table for new columns
    const paymentTableInfo = db.prepare("PRAGMA table_info(order_payments)").all();
    const paymentColumnNames = paymentTableInfo.map((col) => col.name);
    
    if (!paymentColumnNames.includes("accountId")) {
      db.prepare("ALTER TABLE order_payments ADD COLUMN accountId INTEGER REFERENCES accounts(id)").run();
    }

    // Check order_receipts table for new columns
    const receiptTableInfo = db.prepare("PRAGMA table_info(order_receipts)").all();
    const receiptColumnNames = receiptTableInfo.map((col) => col.name);
    
    if (!receiptColumnNames.includes("accountId")) {
      db.prepare("ALTER TABLE order_receipts ADD COLUMN accountId INTEGER REFERENCES accounts(id)").run();
    }
    if (!receiptColumnNames.includes("status")) {
      // Default existing records to 'confirmed' to maintain backward compatibility
      db.prepare("ALTER TABLE order_receipts ADD COLUMN status TEXT DEFAULT 'confirmed'").run();
      // Update all existing records to confirmed
      db.prepare("UPDATE order_receipts SET status = 'confirmed' WHERE status IS NULL").run();
    }

    // Check order_payments table for status column
    if (!paymentColumnNames.includes("status")) {
      // Default existing records to 'confirmed' to maintain backward compatibility
      db.prepare("ALTER TABLE order_payments ADD COLUMN status TEXT DEFAULT 'confirmed'").run();
      // Update all existing records to confirmed
      db.prepare("UPDATE order_payments SET status = 'confirmed' WHERE status IS NULL").run();
    }

    // Check transfers table for new columns
    const transferTableInfo = db.prepare("PRAGMA table_info(internal_transfers)").all();
    const transferColumnNames = transferTableInfo.map((col) => col.name);
    
    if (!transferColumnNames.includes("updatedBy")) {
      db.prepare("ALTER TABLE internal_transfers ADD COLUMN updatedBy INTEGER REFERENCES users(id)").run();
    }
    if (!transferColumnNames.includes("updatedAt")) {
      db.prepare("ALTER TABLE internal_transfers ADD COLUMN updatedAt TEXT").run();
    }
    if (!transferColumnNames.includes("transactionFee")) {
      db.prepare("ALTER TABLE internal_transfers ADD COLUMN transactionFee REAL").run();
    }

    // Check transfer_changes table for new columns
    const transferChangesTableInfo = db.prepare("PRAGMA table_info(transfer_changes)").all();
    const transferChangesColumnNames = transferChangesTableInfo.map((col) => col.name);
    
    if (!transferChangesColumnNames.includes("transactionFee")) {
      db.prepare("ALTER TABLE transfer_changes ADD COLUMN transactionFee REAL").run();
    }

    // Check profit_calculations table for groups column
    const profitCalcTableInfo = db.prepare("PRAGMA table_info(profit_calculations)").all();
    const profitCalcColumnNames = profitCalcTableInfo.map((col) => col.name);
    
    if (!profitCalcColumnNames.includes("groups")) {
      db.prepare("ALTER TABLE profit_calculations ADD COLUMN groups TEXT DEFAULT '[]'").run();
    }
    
    // Check profit_calculations table for isDefault column
    if (!profitCalcColumnNames.includes("isDefault")) {
      db.prepare("ALTER TABLE profit_calculations ADD COLUMN isDefault INTEGER NOT NULL DEFAULT 0").run();
    }

    // Migrate existing roles to include "profit" section if not present
    const roles = db.prepare("SELECT id, permissions FROM roles").all();
    roles.forEach((role) => {
      try {
        const permissions = JSON.parse(role.permissions);
        if (permissions.sections && !permissions.sections.includes("profit")) {
          permissions.sections.push("profit");
          db.prepare("UPDATE roles SET permissions = @permissions, updatedAt = @updatedAt WHERE id = @id").run({
            id: role.id,
            permissions: JSON.stringify(permissions),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`Error migrating role ${role.id}:`, error);
      }
    });
  } catch (error) {
    console.error("Migration error:", error);
  }
};

export const initDatabase = () => {
  try {
    ensureSchema();
    migrateDatabase();
    seedData();
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error; // Re-throw to be caught by app.js
  }
};

export const DB_CONSTANTS = {
  SECTIONS,
};


