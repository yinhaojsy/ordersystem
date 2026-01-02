import { db } from "../db.js";
import {
  saveFile,
  deleteFile,
  generateExpenseFilename,
  base64ToBuffer,
  getFileUrl,
} from "../utils/fileStorage.js";

export const listExpenses = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT 
        e.*,
        acc.name as accountName,
        creator.name as createdByName,
        updater.name as updatedByName
       FROM expenses e
       LEFT JOIN accounts acc ON acc.id = e.accountId
       LEFT JOIN users creator ON creator.id = e.createdBy
       LEFT JOIN users updater ON updater.id = e.updatedBy
       WHERE e.deletedAt IS NULL
       ORDER BY e.createdAt DESC;`,
    )
    .all();
  
  // Convert file paths to URLs for response (if not base64)
  const expensesWithUrls = rows.map(expense => ({
    ...expense,
    imagePath: expense.imagePath && !expense.imagePath.startsWith('data:') 
      ? getFileUrl(expense.imagePath) 
      : expense.imagePath,
  }));
  
  res.json(expensesWithUrls);
};

export const createExpense = (req, res, next) => {
  try {
    // Multer automatically parses FormData fields into req.body
    // When FormData is used, fields are strings; when JSON is used, they might be numbers
    const accountId = req.body?.accountId;
    const amount = req.body?.amount;
    const description = req.body?.description;
    const createdBy = req.body?.createdBy;
    const file = req.file; // Multer file object

    // Validate accountId - handle both string and number inputs (FormData sends strings)
    // Check if accountId exists and is valid
    if (accountId == null || accountId === "" || accountId === undefined) {
      return res.status(400).json({ message: "Account and amount are required" });
    }
    
    const accountIdStr = String(accountId).trim();
    const accountIdNum = Number(accountIdStr);
    
    if (!accountIdStr || isNaN(accountIdNum) || accountIdNum <= 0) {
      return res.status(400).json({ message: "Account and amount are required" });
    }

    // Validate amount - handle both string and number inputs (FormData sends strings)
    // Check if amount exists and is valid
    if (amount == null || amount === "" || amount === undefined) {
      return res.status(400).json({ message: "Account and amount are required" });
    }
    
    const amountStr = String(amount).trim();
    const expenseAmount = Number(amountStr);
    
    if (!amountStr || isNaN(expenseAmount) || expenseAmount <= 0) {
      return res.status(400).json({ message: "Account and amount are required" });
    }

    // Get account details
    const account = db.prepare("SELECT id, name, balance, currencyCode FROM accounts WHERE id = ?;").get(accountIdNum);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Handle file upload - support both file and base64 (for backward compatibility)
    let imagePath = null;
    
    if (file) {
      // We need to create the expense first to get the ID for filename
      // So we'll do it in two steps: create expense, then update with file
      const tempExpenseId = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM expenses;").get().nextId;
      const filename = generateExpenseFilename(tempExpenseId, file.mimetype, file.originalname);
      imagePath = saveFile(file.buffer, filename, "expense");
    } else if (req.body.imagePath) {
      // Legacy base64 path (backward compatibility)
      const base64Path = req.body.imagePath;
      if (typeof base64Path === 'string' && base64Path.trim().length > 0) {
        if (base64Path.startsWith('data:')) {
          // We'll convert after we get the expense ID
          imagePath = base64Path; // Temporary, will be converted
        } else {
          // Already a file path
          imagePath = base64Path;
        }
      }
    }

    // Perform expense creation in a transaction
    let expenseId;
    const transaction = db.transaction(() => {
      // Deduct amount from account balance (allow negative)
      db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(expenseAmount, accountIdNum);

      // Create transaction record for the account
      const expenseDescription = description 
        ? `Expense: ${description}`
        : "Expense";

      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        accountIdNum,
        expenseAmount,
        expenseDescription,
        new Date().toISOString()
      );

      // Create expense record
      const stmt = db.prepare(
        `INSERT INTO expenses (accountId, amount, currencyCode, description, imagePath, createdBy, createdAt)
         VALUES (@accountId, @amount, @currencyCode, @description, @imagePath, @createdBy, @createdAt);`
      );
      const result = stmt.run({
        accountId: accountIdNum,
        amount: expenseAmount,
        currencyCode: account.currencyCode,
        description: description || null,
        imagePath: imagePath || null,
        createdBy: createdBy || null,
        createdAt: new Date().toISOString(),
      });

      expenseId = result.lastInsertRowid;

      // If we have a base64 image, convert it to file now that we have the expense ID
      if (imagePath && imagePath.startsWith('data:')) {
        const buffer = base64ToBuffer(imagePath);
        if (buffer) {
          const filename = generateExpenseFilename(expenseId, null, null);
          imagePath = saveFile(buffer, filename, "expense");
          // Update the expense with the file path
          db.prepare("UPDATE expenses SET imagePath = ? WHERE id = ?;").run(imagePath, expenseId);
        }
      }

      // Log the initial creation as a change
      db.prepare(
        `INSERT INTO expense_changes (expenseId, changedBy, changedAt, accountId, accountName, amount, description)
         VALUES (?, ?, ?, ?, ?, ?, ?);`
      ).run(
        expenseId,
        createdBy || null,
        new Date().toISOString(),
        accountIdNum,
        account.name,
        expenseAmount,
        description || null
      );

      return expenseId;
    });

    transaction();

    // Get the created expense with joined data
    const expense = db
      .prepare(
        `SELECT 
          e.*,
          acc.name as accountName,
          creator.name as createdByName
         FROM expenses e
         LEFT JOIN accounts acc ON acc.id = e.accountId
         LEFT JOIN users creator ON creator.id = e.createdBy
         WHERE e.id = ?;`
      )
      .get(expenseId);
    
    // Convert file path to URL for response (if not base64)
    const expenseWithUrl = {
      ...expense,
      imagePath: expense.imagePath && !expense.imagePath.startsWith('data:') 
        ? getFileUrl(expense.imagePath) 
        : expense.imagePath,
    };

    res.status(201).json(expenseWithUrl);
  } catch (error) {
    next(error);
  }
};

export const updateExpense = (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountId, amount, description, updatedBy } = req.body || {};
    const file = req.file; // Multer file object

    // Get existing expense
    const existingExpense = db.prepare("SELECT * FROM expenses WHERE id = ?;").get(id);
    if (!existingExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    // Handle file upload - support both file and base64 (for backward compatibility)
    let imagePath = undefined; // undefined means don't change, null means remove
    
    if (file) {
      // New file upload - delete old file if it exists
      if (existingExpense.imagePath && !existingExpense.imagePath.startsWith('data:')) {
        deleteFile(existingExpense.imagePath);
      }
      const filename = generateExpenseFilename(id, file.mimetype, file.originalname);
      imagePath = saveFile(file.buffer, filename, "expense");
    } else if (req.body.imagePath !== undefined) {
      // Explicitly set imagePath (could be null to remove, or new base64, or file path)
      if (req.body.imagePath === null || req.body.imagePath === '') {
        // Remove image - delete old file if it exists
        if (existingExpense.imagePath && !existingExpense.imagePath.startsWith('data:')) {
          deleteFile(existingExpense.imagePath);
        }
        imagePath = null;
      } else if (req.body.imagePath.startsWith('data:')) {
        // Legacy base64 - convert to file
        if (existingExpense.imagePath && !existingExpense.imagePath.startsWith('data:')) {
          deleteFile(existingExpense.imagePath);
        }
        const buffer = base64ToBuffer(req.body.imagePath);
        if (buffer) {
          const filename = generateExpenseFilename(id, null, null);
          imagePath = saveFile(buffer, filename, "expense");
        } else {
          imagePath = req.body.imagePath; // Keep as base64 if conversion fails
        }
      } else {
        // Already a file path (shouldn't happen, but handle it)
        imagePath = req.body.imagePath;
      }
    }

    // Get account details for both old and new accounts
    // Handle both string and number inputs (FormData sends strings)
    let finalAccountId = existingExpense.accountId;
    if (accountId !== undefined) {
      const accountIdStr = String(accountId).trim();
      const accountIdNum = Number(accountIdStr);
      if (!accountIdStr || isNaN(accountIdNum) || accountIdNum <= 0) {
        return res.status(400).json({ message: "Account and amount are required" });
      }
      finalAccountId = accountIdNum;
    }
    
    const accountChanged = accountId !== undefined && accountId !== existingExpense.accountId;
    
    const newAccount = db.prepare("SELECT id, name, balance, currencyCode FROM accounts WHERE id = ?;").get(finalAccountId);
    if (!newAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    // If account changed, verify currency matches
    if (accountChanged) {
      const oldAccount = db.prepare("SELECT currencyCode FROM accounts WHERE id = ?;").get(existingExpense.accountId);
      if (oldAccount && oldAccount.currencyCode !== newAccount.currencyCode) {
        return res.status(400).json({ 
          message: `Cannot change account to different currency. Old: ${oldAccount.currencyCode}, New: ${newAccount.currencyCode}` 
        });
      }
    }

    // Handle amount validation - support both string and number inputs
    let expenseAmount = existingExpense.amount;
    if (amount !== undefined) {
      const amountStr = String(amount).trim();
      const amountNum = Number(amountStr);
      if (!amountStr || isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Account and amount are required" });
      }
      expenseAmount = amountNum;
    }

    const amountChanged = amount !== undefined && amount !== existingExpense.amount;

    // Perform update in a transaction
    const transaction = db.transaction(() => {
      // Handle account or amount changes - need to reverse old transaction and create new one
      if (accountChanged || amountChanged) {
        const oldDescription = existingExpense.description 
          ? `Expense: ${existingExpense.description}`
          : "Expense";
        
        // Reverse old transaction (add back the old amount to old account)
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          existingExpense.accountId,
          existingExpense.amount,
          `Reversal: ${oldDescription}`,
          new Date().toISOString()
        );

        // Create new transaction (deduct new amount from new account)
        const newDescription = description !== undefined 
          ? (description ? `Expense: ${description}` : "Expense")
          : oldDescription;
        
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          finalAccountId,
          expenseAmount,
          newDescription,
          new Date().toISOString()
        );

        // Update account balances
        // Add back to old account
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(
          existingExpense.amount, 
          existingExpense.accountId
        );
        
        // Deduct from new account
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(
          expenseAmount, 
          finalAccountId
        );
      } else if (description !== undefined && description !== existingExpense.description) {
        // Only description changed, update the latest transaction
        const expenseDescription = description 
          ? `Expense: ${description}`
          : "Expense";
        
        // Update the most recent transaction for this expense
        const latestTransaction = db
          .prepare(
            `SELECT id FROM account_transactions 
             WHERE accountId = ? AND description LIKE ? 
             ORDER BY createdAt DESC LIMIT 1;`
          )
          .get(existingExpense.accountId, `Expense%`);
        
        if (latestTransaction) {
          db.prepare("UPDATE account_transactions SET description = ? WHERE id = ?;")
            .run(expenseDescription, latestTransaction.id);
        }
      }

      // Update expense record
      const updateFields = [];
      const updateValues = [];
      
      const finalAmount = expenseAmount;
      const finalDescription = description !== undefined ? (description || null) : existingExpense.description;
      
      if (accountId !== undefined) updateFields.push("accountId = ?"), updateValues.push(finalAccountId);
      if (amount !== undefined) updateFields.push("amount = ?"), updateValues.push(expenseAmount);
      if (description !== undefined) updateFields.push("description = ?"), updateValues.push(description || null);
      if (imagePath !== undefined) updateFields.push("imagePath = ?"), updateValues.push(imagePath || null);
      
      updateFields.push("updatedBy = ?"), updateValues.push(updatedBy || null);
      updateFields.push("updatedAt = ?"), updateValues.push(new Date().toISOString());
      updateValues.push(id);

      if (updateFields.length > 2) { // More than just updatedBy and updatedAt
        db.prepare(`UPDATE expenses SET ${updateFields.join(", ")} WHERE id = ?;`).run(...updateValues);
        
        // Log the change if account, amount, or description changed
        if (accountId !== undefined || amount !== undefined || description !== undefined) {
          db.prepare(
            `INSERT INTO expense_changes (expenseId, changedBy, changedAt, accountId, accountName, amount, description)
             VALUES (?, ?, ?, ?, ?, ?, ?);`
          ).run(
            id,
            updatedBy || null,
            new Date().toISOString(),
            finalAccountId,
            newAccount.name,
            finalAmount,
            finalDescription
          );
        }
      }
    });

    transaction();

    // Get the updated expense with joined data
    const expense = db
      .prepare(
        `SELECT 
          e.*,
          acc.name as accountName,
          creator.name as createdByName,
          updater.name as updatedByName
         FROM expenses e
         LEFT JOIN accounts acc ON acc.id = e.accountId
         LEFT JOIN users creator ON creator.id = e.createdBy
         LEFT JOIN users updater ON updater.id = e.updatedBy
         WHERE e.id = ?;`
      )
      .get(id);
    
    // Convert file path to URL for response (if not base64)
    const expenseWithUrl = {
      ...expense,
      imagePath: expense.imagePath && !expense.imagePath.startsWith('data:') 
        ? getFileUrl(expense.imagePath) 
        : expense.imagePath,
    };

    res.json(expenseWithUrl);
  } catch (error) {
    next(error);
  }
};

export const getExpenseChanges = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if expense exists
    const expense = db.prepare("SELECT id FROM expenses WHERE id = ?;").get(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Get all changes for this expense
    const changes = db
      .prepare(
        `SELECT 
          ec.*,
          u.name as changedByName
         FROM expense_changes ec
         LEFT JOIN users u ON u.id = ec.changedBy
         WHERE ec.expenseId = ?
         ORDER BY ec.changedAt ASC;`
      )
      .all(id);

    res.json(changes);
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if expense exists
    const expense = db.prepare("SELECT * FROM expenses WHERE id = ?;").get(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    // Delete associated file if it exists
    if (expense.imagePath && !expense.imagePath.startsWith('data:')) {
      deleteFile(expense.imagePath);
    }

    // Perform hard delete in a transaction
    const transaction = db.transaction(() => {
      // Reverse the expense (add back the amount to account)
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(expense.amount, expense.accountId);

      // Create reversal transaction record
      const expenseDescription = expense.description 
        ? `Expense: ${expense.description}`
        : "Expense";
      
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(
        expense.accountId,
        expense.amount,
        `Reversal: ${expenseDescription} (Deleted)`,
        new Date().toISOString()
      );

      // Hard delete the expense (this will cascade delete expense_changes due to FK constraint)
      db.prepare("DELETE FROM expenses WHERE id = ?;").run(id);
    });

    transaction();
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

