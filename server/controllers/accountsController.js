import { db } from "../db.js";

export const listAccounts = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, c.name as currencyName FROM accounts a
       LEFT JOIN currencies c ON c.code = a.currencyCode
       ORDER BY a.currencyCode ASC, a.name ASC;`,
    )
    .all();
  res.json(rows);
};

export const getAccountsSummary = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT 
        currencyCode,
        c.name as currencyName,
        SUM(a.balance) as totalBalance,
        COUNT(a.id) as accountCount
       FROM accounts a
       LEFT JOIN currencies c ON c.code = a.currencyCode
       GROUP BY currencyCode
       ORDER BY currencyCode ASC;`,
    )
    .all();
  res.json(rows);
};

export const getAccountsByCurrency = (req, res, next) => {
  try {
    const { currencyCode } = req.params;
    const rows = db
      .prepare(
        `SELECT a.*, c.name as currencyName FROM accounts a
         LEFT JOIN currencies c ON c.code = a.currencyCode
         WHERE a.currencyCode = ?
         ORDER BY a.name ASC;`,
      )
      .all(currencyCode);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

export const createAccount = (req, res, next) => {
  try {
    const { currencyCode, name, initialFunds } = req.body || {};
    
    if (!currencyCode || !name) {
      return res.status(400).json({ message: "Currency code and name are required" });
    }

    // Verify currency exists
    const currency = db.prepare("SELECT code FROM currencies WHERE code = ?").get(currencyCode);
    if (!currency) {
      return res.status(400).json({ message: "Currency not found" });
    }

    const balance = parseFloat(initialFunds || 0);
    if (isNaN(balance) || balance < 0) {
      return res.status(400).json({ message: "Invalid initial funds amount" });
    }

    const stmt = db.prepare(
      `INSERT INTO accounts (currencyCode, name, balance, createdAt)
       VALUES (@currencyCode, @name, @balance, @createdAt);`,
    );
    const result = stmt.run({
      currencyCode,
      name,
      balance,
      createdAt: new Date().toISOString(),
    });

    // If initial funds > 0, create a transaction record
    if (balance > 0) {
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (@accountId, 'add', @amount, @description, @createdAt);`,
      ).run({
        accountId: result.lastInsertRowid,
        amount: balance,
        description: "Initial funds",
        createdAt: new Date().toISOString(),
      });
    }

    const row = db
      .prepare(
        `SELECT a.*, c.name as currencyName FROM accounts a
         LEFT JOIN currencies c ON c.code = a.currencyCode
         WHERE a.id = ?;`,
      )
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
};

export const updateAccount = (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if account exists
    const existing = db.prepare("SELECT id FROM accounts WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check if account is used in any orders
    const orderCount = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE buyAccountId = ? OR sellAccountId = ?")
      .get(id, id);
    if (orderCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot edit account that is linked to existing orders" 
      });
    }

    // Check if account is used in any internal transfers
    const transferCount = db
      .prepare("SELECT COUNT(*) as count FROM internal_transfers WHERE fromAccountId = ? OR toAccountId = ?")
      .get(id, id);
    if (transferCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot edit account that is linked to existing transfers" 
      });
    }

    // Check if account is used in any expenses
    const expenseCount = db
      .prepare("SELECT COUNT(*) as count FROM expenses WHERE accountId = ? AND deletedAt IS NULL")
      .get(id);
    if (expenseCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot edit account that is linked to existing expenses" 
      });
    }

    db.prepare("UPDATE accounts SET name = @name WHERE id = @id;").run({ id, name });
    
    const row = db
      .prepare(
        `SELECT a.*, c.name as currencyName FROM accounts a
         LEFT JOIN currencies c ON c.code = a.currencyCode
         WHERE a.id = ?;`,
      )
      .get(id);
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if account exists
    const existing = db.prepare("SELECT id FROM accounts WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check if account is used in any orders
    const orderCount = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE buyAccountId = ? OR sellAccountId = ?")
      .get(id, id);
    if (orderCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot delete account that is linked to existing orders" 
      });
    }

    // Check if account is used in any internal transfers
    const transferCount = db
      .prepare("SELECT COUNT(*) as count FROM internal_transfers WHERE fromAccountId = ? OR toAccountId = ?")
      .get(id, id);
    if (transferCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot delete account that is linked to existing transfers" 
      });
    }

    // Check if account is used in any expenses
    const expenseCount = db
      .prepare("SELECT COUNT(*) as count FROM expenses WHERE accountId = ? AND deletedAt IS NULL")
      .get(id);
    if (expenseCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot delete account that is linked to existing expenses" 
      });
    }

    const stmt = db.prepare("DELETE FROM accounts WHERE id = ?;");
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const addFunds = (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body || {};
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const newBalance = account.balance + parseFloat(amount);
    
    db.prepare("UPDATE accounts SET balance = @balance WHERE id = @id;").run({
      id,
      balance: newBalance,
    });

    db.prepare(
      `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
       VALUES (@accountId, 'add', @amount, @description, @createdAt);`,
    ).run({
      accountId: id,
      amount: parseFloat(amount),
      description: description || "Funds added",
      createdAt: new Date().toISOString(),
    });

    const updated = db
      .prepare(
        `SELECT a.*, c.name as currencyName FROM accounts a
         LEFT JOIN currencies c ON c.code = a.currencyCode
         WHERE a.id = ?;`,
      )
      .get(id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const withdrawFunds = (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body || {};
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const withdrawAmount = parseFloat(amount);
    if (account.balance < withdrawAmount) {
      return res.status(400).json({ message: "Insufficient funds" });
    }

    const newBalance = account.balance - withdrawAmount;
    
    db.prepare("UPDATE accounts SET balance = @balance WHERE id = @id;").run({
      id,
      balance: newBalance,
    });

    db.prepare(
      `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
       VALUES (@accountId, 'withdraw', @amount, @description, @createdAt);`,
    ).run({
      accountId: id,
      amount: withdrawAmount,
      description: description || "Funds withdrawn",
      createdAt: new Date().toISOString(),
    });

    const updated = db
      .prepare(
        `SELECT a.*, c.name as currencyName FROM accounts a
         LEFT JOIN currencies c ON c.code = a.currencyCode
         WHERE a.id = ?;`,
      )
      .get(id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const getAccountTransactions = (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = db
      .prepare(
        `SELECT * FROM account_transactions 
         WHERE accountId = ? 
         ORDER BY createdAt DESC;`,
      )
      .all(id);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

