import { db } from "../db.js";

export const listExpenses = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT 
        e.*,
        acc.name as accountName,
        creator.name as createdByName,
        updater.name as updatedByName,
        deleter.name as deletedByName
       FROM expenses e
       LEFT JOIN accounts acc ON acc.id = e.accountId
       LEFT JOIN users creator ON creator.id = e.createdBy
       LEFT JOIN users updater ON updater.id = e.updatedBy
       LEFT JOIN users deleter ON deleter.id = e.deletedBy
       WHERE e.deletedAt IS NULL
       ORDER BY e.createdAt DESC;`,
    )
    .all();
  res.json(rows);
};

export const createExpense = (req, res, next) => {
  try {
    const { accountId, amount, description, imagePath, createdBy } = req.body || {};

    if (!accountId || !amount) {
      return res.status(400).json({ message: "Account and amount are required" });
    }

    // Get account details
    const account = db.prepare("SELECT id, name, balance, currencyCode FROM accounts WHERE id = ?;").get(accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const expenseAmount = Number(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    // Perform expense creation in a transaction
    const transaction = db.transaction(() => {
      // Deduct amount from account balance (allow negative)
      db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(expenseAmount, accountId);

      // Create transaction record for the account
      const expenseDescription = description 
        ? `Expense: ${description}`
        : "Expense";

      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        accountId,
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
        accountId,
        amount: expenseAmount,
        currencyCode: account.currencyCode,
        description: description || null,
        imagePath: imagePath || null,
        createdBy: createdBy || null,
        createdAt: new Date().toISOString(),
      });

      const expenseId = result.lastInsertRowid;

      // Log the initial creation as a change
      db.prepare(
        `INSERT INTO expense_changes (expenseId, changedBy, changedAt, accountId, accountName, amount, description)
         VALUES (?, ?, ?, ?, ?, ?, ?);`
      ).run(
        expenseId,
        createdBy || null,
        new Date().toISOString(),
        accountId,
        account.name,
        expenseAmount,
        description || null
      );

      return expenseId;
    });

    const expenseId = transaction();

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

    res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
};

export const updateExpense = (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountId, amount, description, imagePath, updatedBy } = req.body || {};

    // Get existing expense
    const existingExpense = db.prepare("SELECT * FROM expenses WHERE id = ? AND deletedAt IS NULL;").get(id);
    if (!existingExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Get account details for both old and new accounts
    const finalAccountId = accountId !== undefined ? accountId : existingExpense.accountId;
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

    const expenseAmount = Number(amount || existingExpense.amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
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
      
      if (accountId !== undefined) updateFields.push("accountId = ?"), updateValues.push(accountId);
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

    res.json(expense);
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
    const { deletedBy } = req.body || {};
    
    // Check if expense exists
    const expense = db.prepare("SELECT * FROM expenses WHERE id = ? AND deletedAt IS NULL;").get(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Perform soft delete in a transaction
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

      // Soft delete the expense (mark as deleted with audit trail)
      db.prepare("UPDATE expenses SET deletedBy = ?, deletedAt = ? WHERE id = ?;").run(
        deletedBy || null,
        new Date().toISOString(),
        id
      );
    });

    transaction();
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

