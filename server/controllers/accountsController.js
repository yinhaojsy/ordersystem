import { db } from "../db.js";

export const getAccountReferences = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get all references for this account
    const orders = db
      .prepare("SELECT id, buyAccountId, sellAccountId, status, createdAt FROM orders WHERE buyAccountId = ? OR sellAccountId = ?")
      .all(id, id);
    
    const transfers = db
      .prepare("SELECT id, fromAccountId, toAccountId, amount, currencyCode, createdAt FROM internal_transfers WHERE fromAccountId = ? OR toAccountId = ?")
      .all(id, id);
    
    const expenses = db
      .prepare("SELECT id, accountId, amount, currencyCode, description, deletedAt, createdAt FROM expenses WHERE accountId = ?")
      .all(id);
    
    const orderPayments = db
      .prepare("SELECT id, orderId, accountId, amount, createdAt FROM order_payments WHERE accountId = ?")
      .all(id);
    
    const orderReceipts = db
      .prepare("SELECT id, orderId, accountId, amount, createdAt FROM order_receipts WHERE accountId = ?")
      .all(id);
    
    const profitMultipliers = db
      .prepare("SELECT id, profitCalculationId, accountId, multiplier FROM profit_account_multipliers WHERE accountId = ?")
      .all(id);
    
    const accountTransactions = db
      .prepare("SELECT id, accountId, type, amount, description, createdAt FROM account_transactions WHERE accountId = ?")
      .all(id);
    
    res.json({
      accountId: id,
      orders: {
        count: orders.length,
        records: orders
      },
      transfers: {
        count: transfers.length,
        records: transfers
      },
      expenses: {
        count: expenses.length,
        active: expenses.filter(e => !e.deletedAt).length,
        deleted: expenses.filter(e => e.deletedAt).length,
        records: expenses
      },
      orderPayments: {
        count: orderPayments.length,
        records: orderPayments
      },
      orderReceipts: {
        count: orderReceipts.length,
        records: orderReceipts
      },
      profitMultipliers: {
        count: profitMultipliers.length,
        records: profitMultipliers
      },
      accountTransactions: {
        count: accountTransactions.length,
        records: accountTransactions
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReferences = (_req, res, next) => {
  try {
    // Get counts for all accounts
    const orderCounts = db
      .prepare(`
        SELECT 
          buyAccountId as accountId,
          COUNT(*) as count
        FROM orders 
        WHERE buyAccountId IS NOT NULL
        GROUP BY buyAccountId
        UNION ALL
        SELECT 
          sellAccountId as accountId,
          COUNT(*) as count
        FROM orders 
        WHERE sellAccountId IS NOT NULL
        GROUP BY sellAccountId
      `)
      .all();
    
    const transferCounts = db
      .prepare(`
        SELECT 
          fromAccountId as accountId,
          COUNT(*) as count
        FROM internal_transfers 
        GROUP BY fromAccountId
        UNION ALL
        SELECT 
          toAccountId as accountId,
          COUNT(*) as count
        FROM internal_transfers 
        GROUP BY toAccountId
      `)
      .all();
    
    const expenseCounts = db
      .prepare(`
        SELECT 
          accountId,
          COUNT(*) as total,
          SUM(CASE WHEN deletedAt IS NULL THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN deletedAt IS NOT NULL THEN 1 ELSE 0 END) as deleted
        FROM expenses 
        GROUP BY accountId
      `)
      .all();
    
    const paymentCounts = db
      .prepare(`
        SELECT 
          accountId,
          COUNT(*) as count
        FROM order_payments 
        WHERE accountId IS NOT NULL
        GROUP BY accountId
      `)
      .all();
    
    const receiptCounts = db
      .prepare(`
        SELECT 
          accountId,
          COUNT(*) as count
        FROM order_receipts 
        WHERE accountId IS NOT NULL
        GROUP BY accountId
      `)
      .all();
    
    const profitCounts = db
      .prepare(`
        SELECT 
          accountId,
          COUNT(*) as count
        FROM profit_account_multipliers 
        GROUP BY accountId
      `)
      .all();
    
    // Get all orders
    const allOrders = db
      .prepare("SELECT id, buyAccountId, sellAccountId, status, createdAt FROM orders")
      .all();
    
    // Get all transfers
    const allTransfers = db
      .prepare("SELECT id, fromAccountId, toAccountId, amount, currencyCode, createdAt FROM internal_transfers")
      .all();
    
    // Get all expenses
    const allExpenses = db
      .prepare("SELECT id, accountId, amount, currencyCode, description, deletedAt, createdAt FROM expenses")
      .all();
    
    res.json({
      summary: {
        totalOrders: allOrders.length,
        totalTransfers: allTransfers.length,
        totalExpenses: allExpenses.length,
        activeExpenses: allExpenses.filter(e => !e.deletedAt).length,
        deletedExpenses: allExpenses.filter(e => e.deletedAt).length
      },
      orders: allOrders,
      transfers: allTransfers,
      expenses: allExpenses,
      accountReferences: {
        orders: orderCounts,
        transfers: transferCounts,
        expenses: expenseCounts,
        orderPayments: paymentCounts,
        orderReceipts: receiptCounts,
        profitMultipliers: profitCounts
      }
    });
  } catch (error) {
    next(error);
  }
};

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

    // Check if account with same name already exists (case-insensitive)
    const existingAccount = db.prepare("SELECT id FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").get(name);
    if (existingAccount) {
      return res.status(400).json({ message: "An account with this name already exists" });
    }

    const balance = parseFloat(initialFunds || 0);
    if (isNaN(balance)) {
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

    // Create a transaction record for initial funds (positive or negative)
    if (balance !== 0) {
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (@accountId, @type, @amount, @description, @createdAt);`,
      ).run({
        accountId: result.lastInsertRowid,
        type: balance > 0 ? 'add' : 'withdraw',
        amount: Math.abs(balance),
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

    // Check if another account with the same name already exists (excluding current account, case-insensitive)
    const duplicateAccount = db.prepare("SELECT id FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?").get(name, id);
    if (duplicateAccount) {
      return res.status(400).json({ message: "An account with this name already exists" });
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
  const { id } = req.params;
  
  try {
    // Check if account exists
    const existing = db.prepare("SELECT id FROM accounts WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ message: "Account not found" });
    }

    // First, check for blocking references that we cannot automatically delete
    const orderCount = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE buyAccountId = ? OR sellAccountId = ?")
      .get(id, id);
    if (orderCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot delete account that is linked to existing orders" 
      });
    }

    const transferCount = db
      .prepare("SELECT COUNT(*) as count FROM internal_transfers WHERE fromAccountId = ? OR toAccountId = ?")
      .get(id, id);
    if (transferCount.count > 0) {
      return res.status(400).json({ 
        message: "Cannot delete account that is linked to existing transfers" 
      });
    }

    // Check for expenses (including soft-deleted ones, as they still have foreign key constraints)
    const expenseCount = db
      .prepare("SELECT COUNT(*) as count FROM expenses WHERE accountId = ?")
      .get(id);
    if (expenseCount.count > 0) {
      // Check if there are non-deleted expenses
      const activeExpenseCount = db
        .prepare("SELECT COUNT(*) as count FROM expenses WHERE accountId = ? AND deletedAt IS NULL")
        .get(id);
      if (activeExpenseCount.count > 0) {
        return res.status(400).json({ 
          message: "Cannot delete account that is linked to existing expenses" 
        });
      }
      // If only soft-deleted expenses exist, we can delete them
      console.log(`Account ${id} has ${expenseCount.count} soft-deleted expenses. Will clean up.`);
    }

    // Check for profit calculations - we'll delete these automatically, but log for info
    const profitCount = db
      .prepare("SELECT COUNT(*) as count FROM profit_account_multipliers WHERE accountId = ?")
      .get(id);
    if (profitCount.count > 0) {
      console.log(`Account ${id} is referenced by ${profitCount.count} profit calculation(s). Will be removed automatically.`);
    }

    // Check for any other references that might exist
    const paymentCount = db
      .prepare("SELECT COUNT(*) as count FROM order_payments WHERE accountId = ?")
      .get(id);
    const receiptCount = db
      .prepare("SELECT COUNT(*) as count FROM order_receipts WHERE accountId = ?")
      .get(id);
    
    console.log(`Deleting account ${id}. Reference counts: orders=${orderCount.count}, transfers=${transferCount.count}, expenses=${expenseCount.count}, payments=${paymentCount.count}, receipts=${receiptCount.count}, profit=${profitCount.count}`);

    // Use a transaction to ensure all operations succeed or fail together
    const deleteAccountTransaction = db.transaction((accountId) => {
      // Delete all references in the correct order
      // First, delete from tables that might have foreign key constraints
      
      // Delete all profit_account_multipliers that reference this account
      const profitDeleted = db.prepare("DELETE FROM profit_account_multipliers WHERE accountId = ?").run(accountId);
      console.log(`Deleted ${profitDeleted.changes} profit_account_multipliers for account ${accountId}`);

      // Delete all account_transactions (has CASCADE but delete explicitly)
      const transactionsDeleted = db.prepare("DELETE FROM account_transactions WHERE accountId = ?").run(accountId);
      console.log(`Deleted ${transactionsDeleted.changes} account_transactions for account ${accountId}`);

      // Delete all order_payments that reference this account
      const paymentsDeleted = db.prepare("DELETE FROM order_payments WHERE accountId = ?").run(accountId);
      console.log(`Deleted ${paymentsDeleted.changes} order_payments for account ${accountId}`);

      // Delete all order_receipts that reference this account
      const receiptsDeleted = db.prepare("DELETE FROM order_receipts WHERE accountId = ?").run(accountId);
      console.log(`Deleted ${receiptsDeleted.changes} order_receipts for account ${accountId}`);

      // Delete all expenses (including soft-deleted) that reference this account
      // This MUST happen before deleting the account due to foreign key constraints
      const expensesDeleted = db.prepare("DELETE FROM expenses WHERE accountId = ?").run(accountId);
      console.log(`Deleted ${expensesDeleted.changes} expenses for account ${accountId}`);
      
      // Also delete expense_changes that might reference this account (though they should cascade)
      try {
        const expenseChangesDeleted = db.prepare("DELETE FROM expense_changes WHERE accountId = ?").run(accountId);
        console.log(`Deleted ${expenseChangesDeleted.changes} expense_changes for account ${accountId}`);
      } catch (e) {
        // expense_changes might not have accountId as a foreign key, so this might fail
        // That's okay, we'll continue
        console.log(`Note: Could not delete expense_changes (this is expected if no FK constraint): ${e.message}`);
      }

      // Now delete the account
      const stmt = db.prepare("DELETE FROM accounts WHERE id = ?;");
      const result = stmt.run(accountId);
      if (result.changes === 0) {
        throw new Error("Account not found");
      }
      console.log(`Successfully deleted account ${accountId}`);
    });

    // Execute the transaction
    deleteAccountTransaction(id);
    res.json({ success: true });
  } catch (error) {
    // Handle the error
    console.error("Error deleting account:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      accountId: id
    });
    
    // Ensure we have a valid error message
    const errorMessage = error?.message || String(error) || "Unknown error occurred";
    
    if (errorMessage.includes("Cannot delete account")) {
      return res.status(400).json({ message: errorMessage });
    }
    if (errorMessage.includes("not found")) {
      return res.status(404).json({ message: errorMessage });
    }
    // For foreign key constraint errors, provide a more helpful message
    if (errorMessage.includes("FOREIGN KEY") || errorMessage.includes("constraint")) {
      // Try to find what's still referencing the account
      try {
        const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE buyAccountId = ? OR sellAccountId = ?").get(id, id);
        const transferCount = db.prepare("SELECT COUNT(*) as count FROM internal_transfers WHERE fromAccountId = ? OR toAccountId = ?").get(id, id);
        const expenseCount = db.prepare("SELECT COUNT(*) as count FROM expenses WHERE accountId = ?").get(id);
        const paymentCount = db.prepare("SELECT COUNT(*) as count FROM order_payments WHERE accountId = ?").get(id);
        const receiptCount = db.prepare("SELECT COUNT(*) as count FROM order_receipts WHERE accountId = ?").get(id);
        const profitCount = db.prepare("SELECT COUNT(*) as count FROM profit_account_multipliers WHERE accountId = ?").get(id);
        
        console.log("Reference counts:", { orderCount: orderCount.count, transferCount: transferCount.count, expenseCount: expenseCount.count, paymentCount: paymentCount.count, receiptCount: receiptCount.count, profitCount: profitCount.count });
      } catch (checkError) {
        console.error("Error checking reference counts:", checkError);
      }
      
      return res.status(400).json({ 
        message: "Cannot delete account because it is referenced by other records." 
      });
    }
    
    // For any other error, return a generic error message
    return res.status(500).json({ 
      message: "An error occurred while deleting the account. Please try again." 
    });
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

