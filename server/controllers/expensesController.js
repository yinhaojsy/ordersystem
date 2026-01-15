import { db } from "../db.js";
import {
  saveFile,
  deleteFile,
  generateExpenseFilename,
  base64ToBuffer,
  getFileUrl,
} from "../utils/fileStorage.js";
import { getUserIdFromHeader } from "../utils/auth.js";
import { createNotification } from "../services/notification/notificationService.js";

export const listExpenses = (req, res) => {
  const {
    dateFrom,
    dateTo,
    accountId,
    currencyCode,
    createdBy,
    tagId,
    tagIds,
    page,
    limit,
  } = req.query;
  
  // Build WHERE conditions
  const conditions = ['e.deletedAt IS NULL'];
  const params = {};
  
  if (dateFrom) {
    conditions.push('DATE(e.createdAt) >= DATE(@dateFrom)');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    conditions.push('DATE(e.createdAt) <= DATE(@dateTo)');
    params.dateTo = dateTo;
  }
  if (accountId) {
    conditions.push('e.accountId = @accountId');
    params.accountId = parseInt(accountId, 10);
  }
  if (currencyCode) {
    conditions.push('e.currencyCode = @currencyCode');
    params.currencyCode = currencyCode;
  }
  if (createdBy) {
    conditions.push('e.createdBy = @createdBy');
    params.createdBy = parseInt(createdBy, 10);
  }
  
  // Handle tag filtering (support both single tagId and multiple tagIds)
  const parsedTagIds = [];
  if (tagIds) {
    const parts = String(tagIds).split(',').map((v) => parseInt(v, 10)).filter((v) => !isNaN(v));
    parsedTagIds.push(...parts);
  } else if (tagId) {
    const single = parseInt(tagId, 10);
    if (!isNaN(single)) parsedTagIds.push(single);
  }
  if (parsedTagIds.length > 0) {
    const placeholders = parsedTagIds.map((_, i) => `@tagId${i}`).join(',');
    conditions.push(`EXISTS (
      SELECT 1 FROM expense_tag_assignments eta 
      WHERE eta.expenseId = e.id AND eta.tagId IN (${placeholders})
    )`);
    parsedTagIds.forEach((id, i) => {
      params[`tagId${i}`] = id;
    });
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Pagination
  const pageNum = parseInt(page, 10) || 1;
  const pageSize = parseInt(limit, 10) || 20;
  const offset = (pageNum - 1) * pageSize;
  const usePagination = page && limit;

  // Get total count
  let countQuery = `SELECT COUNT(*) as total
       FROM expenses e
       ${whereClause};`;
  const countResult = db.prepare(countQuery).get(params);
  const total = countResult.total;
  
  let query = `SELECT 
        e.*,
        acc.name as accountName,
        creator.name as createdByName,
        updater.name as updatedByName
       FROM expenses e
       LEFT JOIN accounts acc ON acc.id = e.accountId
       LEFT JOIN users creator ON creator.id = e.createdBy
       LEFT JOIN users updater ON updater.id = e.updatedBy
       ${whereClause}
       ORDER BY e.createdAt DESC`;
  
  // Add pagination if requested
  if (usePagination) {
    query += ` LIMIT @limit OFFSET @offset;`;
    params.limit = pageSize;
    params.offset = offset;
  } else {
    query += `;`;
  }
  
  const rows = db.prepare(query).all(params);
  
  // Convert file paths to URLs for response (if not base64) and add tags
  const expensesWithUrls = rows.map(expense => {
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN expense_tag_assignments eta ON eta.tagId = t.id
         WHERE eta.expenseId = ?
         ORDER BY t.name ASC;`
      )
      .all(expense.id);
    
    return {
      ...expense,
      imagePath: expense.imagePath && !expense.imagePath.startsWith('data:') 
        ? getFileUrl(expense.imagePath) 
        : expense.imagePath,
      tags: tags.length > 0 ? tags : [],
    };
  });
  
  // Return with pagination info if requested
  if (usePagination) {
    res.json({
      expenses: expensesWithUrls,
      total,
      page: pageNum,
      limit: pageSize,
    });
  } else {
    res.json(expensesWithUrls);
  }
};

export const exportExpenses = (req, res) => {
  // Extract query parameters (same as listExpenses but without pagination)
  const {
    dateFrom,
    dateTo,
    accountId,
    currencyCode,
    createdBy,
    tagId,
    tagIds,
  } = req.query;
  
  // Build WHERE conditions (same logic as listExpenses)
  const conditions = ['e.deletedAt IS NULL'];
  const params = {};
  
  if (dateFrom) {
    conditions.push('DATE(e.createdAt) >= DATE(@dateFrom)');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    conditions.push('DATE(e.createdAt) <= DATE(@dateTo)');
    params.dateTo = dateTo;
  }
  if (accountId) {
    conditions.push('e.accountId = @accountId');
    params.accountId = parseInt(accountId, 10);
  }
  if (currencyCode) {
    conditions.push('e.currencyCode = @currencyCode');
    params.currencyCode = currencyCode;
  }
  if (createdBy) {
    conditions.push('e.createdBy = @createdBy');
    params.createdBy = parseInt(createdBy, 10);
  }
  
  // Handle tag filtering (support both single tagId and multiple tagIds)
  const parsedTagIds = [];
  if (tagIds) {
    const parts = String(tagIds).split(',').map((v) => parseInt(v, 10)).filter((v) => !isNaN(v));
    parsedTagIds.push(...parts);
  } else if (tagId) {
    const single = parseInt(tagId, 10);
    if (!isNaN(single)) parsedTagIds.push(single);
  }
  if (parsedTagIds.length > 0) {
    const placeholders = parsedTagIds.map((_, i) => `@tagId${i}`).join(',');
    conditions.push(`EXISTS (
      SELECT 1 FROM expense_tag_assignments eta 
      WHERE eta.expenseId = e.id AND eta.tagId IN (${placeholders})
    )`);
    parsedTagIds.forEach((id, i) => {
      params[`tagId${i}`] = id;
    });
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Build query without pagination
  let query = `SELECT 
        e.*,
        acc.name as accountName,
        creator.name as createdByName,
        updater.name as updatedByName
       FROM expenses e
       LEFT JOIN accounts acc ON acc.id = e.accountId
       LEFT JOIN users creator ON creator.id = e.createdBy
       LEFT JOIN users updater ON updater.id = e.updatedBy
       ${whereClause}
       ORDER BY e.createdAt DESC;`;
  
  const rows = db.prepare(query).all(params);
  
  // Convert file paths to URLs for response (if not base64) and add tags
  const expensesWithUrls = rows.map(expense => {
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN expense_tag_assignments eta ON eta.tagId = t.id
         WHERE eta.expenseId = ?
         ORDER BY t.name ASC;`
      )
      .all(expense.id);
    
    return {
      ...expense,
      imagePath: expense.imagePath && !expense.imagePath.startsWith('data:') 
        ? getFileUrl(expense.imagePath) 
        : expense.imagePath,
      tags: tags.length > 0 ? tags : [],
    };
  });
  
  res.json(expensesWithUrls);
};

export const createExpense = async (req, res, next) => {
  try {
    // Multer automatically parses FormData fields into req.body
    // When FormData is used, fields are strings; when JSON is used, they might be numbers
    const accountId = req.body?.accountId;
    const amount = req.body?.amount;
    const description = req.body?.description;
    const createdBy = req.body?.createdBy;
    const tagIds = req.body?.tagIds ? (Array.isArray(req.body.tagIds) ? req.body.tagIds : JSON.parse(req.body.tagIds)) : undefined;
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

    // Handle currencyCode for imports (optional, but validate if provided)
    let finalCurrencyCode = account.currencyCode;
    if (req.body?.currencyCode) {
      const providedCurrencyCode = String(req.body.currencyCode).trim();
      if (providedCurrencyCode !== account.currencyCode) {
        return res.status(400).json({ 
          message: `Currency "${providedCurrencyCode}" does not match account currency "${account.currencyCode}"` 
        });
      }
      finalCurrencyCode = providedCurrencyCode;
    }

    // Handle createdAt for imports (optional)
    let finalCreatedAt = new Date().toISOString();
    if (req.body?.createdAt) {
      const providedDate = new Date(req.body.createdAt);
      if (!isNaN(providedDate.getTime())) {
        finalCreatedAt = providedDate.toISOString();
      }
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
      // Create expense record first to get the expense ID
      const stmt = db.prepare(
        `INSERT INTO expenses (accountId, amount, currencyCode, description, imagePath, createdBy, createdAt)
         VALUES (@accountId, @amount, @currencyCode, @description, @imagePath, @createdBy, @createdAt);`
      );
      const result = stmt.run({
        accountId: accountIdNum,
        amount: expenseAmount,
        currencyCode: finalCurrencyCode,
        description: description || null,
        imagePath: imagePath || null,
        createdBy: createdBy || null,
        createdAt: finalCreatedAt,
      });

      expenseId = result.lastInsertRowid;

      // Deduct amount from account balance (allow negative)
      db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(expenseAmount, accountIdNum);

      // Create transaction record for the account with expense ID
      const isImported = req.body?.isImported === true || req.body?.isImported === "true";
      const expenseDescription = description 
        ? (isImported ? `Expense #${expenseId} - ${description} (Imported)` : `Expense #${expenseId} - ${description}`)
        : (isImported ? `Expense #${expenseId} (Imported)` : `Expense #${expenseId}`);

      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        accountIdNum,
        expenseAmount,
        expenseDescription,
        finalCreatedAt
      );

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
        finalCreatedAt,
        accountIdNum,
        account.name,
        expenseAmount,
        description || null
      );

      return expenseId;
    });

    transaction();

    // Handle tag assignments if provided
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      const tagAssignmentStmt = db.prepare(
        `INSERT INTO expense_tag_assignments (expenseId, tagId) VALUES (?, ?);`
      );
      const insertTagAssignments = db.transaction((tags) => {
        for (const tagId of tags) {
          if (typeof tagId === 'number' && tagId > 0) {
            try {
              tagAssignmentStmt.run(expenseId, tagId);
            } catch (err) {
              // Ignore duplicate or invalid tag assignments
            }
          }
        }
      });
      insertTagAssignments(tagIds);
    }

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
    
    // Get tags for the expense
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN expense_tag_assignments eta ON eta.tagId = t.id
         WHERE eta.expenseId = ?
         ORDER BY t.name ASC;`
      )
      .all(expenseId);
    
    // Convert file path to URL for response (if not base64)
    const expenseWithUrl = {
      ...expense,
      imagePath: expense.imagePath && !expense.imagePath.startsWith('data:') 
        ? getFileUrl(expense.imagePath) 
        : expense.imagePath,
      tags: tags.length > 0 ? tags : [],
    };

    // Send notification to all users about new expense
    const allUsers = db.prepare("SELECT id FROM users").all();
    const allUserIds = allUsers.map(u => u.id);
    const creatorUser = db.prepare("SELECT name FROM users WHERE id = ?").get(createdBy);
    const accountInfo = db.prepare("SELECT name, currencyCode FROM accounts WHERE id = ?").get(accountIdNum);
    
    await createNotification({
      userId: allUserIds,
      type: 'expense_created',
      title: 'New Expense Created',
      message: `Expense #${expenseId} created by ${creatorUser?.name || 'User'} - ${expenseAmount} ${expense.currencyCode} (${accountInfo?.name || 'Account'})${description ? ': ' + description : ''}`,
      entityType: 'expense',
      entityId: expenseId,
      actionUrl: `/expenses`,
    });

    res.status(201).json(expenseWithUrl);
  } catch (error) {
    next(error);
  }
};

export const updateExpense = (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountId, amount, description, updatedBy, tagIds } = req.body || {};
    const tagIdsArray = tagIds ? (Array.isArray(tagIds) ? tagIds : JSON.parse(tagIds)) : undefined;
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
          ? `Expense #${id} - ${existingExpense.description}`
          : `Expense #${id}`;
        
        // Reverse old transaction (add back the old amount to old account)
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          existingExpense.accountId,
          existingExpense.amount,
          `Reversal: ${oldDescription} (Order updated)`,
          new Date().toISOString()
        );

        // Create new transaction (deduct new amount from new account)
        const newDescription = description !== undefined 
          ? (description ? `Expense #${id} - ${description}` : `Expense #${id}`)
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
          ? `Expense #${id} - ${description}`
          : `Expense #${id}`;
        
        // Update the most recent transaction for this expense
        const latestTransaction = db
          .prepare(
            `SELECT id FROM account_transactions 
             WHERE accountId = ? AND description LIKE ? 
             ORDER BY createdAt DESC LIMIT 1;`
          )
          .get(existingExpense.accountId, `Expense #${id}%`);
        
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

    // Handle tag assignments if provided
    if (tagIdsArray !== undefined) {
      // Remove all existing tag assignments
      db.prepare("DELETE FROM expense_tag_assignments WHERE expenseId = ?;").run(id);
      
      // Add new tag assignments if provided
      if (Array.isArray(tagIdsArray) && tagIdsArray.length > 0) {
        const tagAssignmentStmt = db.prepare(
          `INSERT INTO expense_tag_assignments (expenseId, tagId) VALUES (?, ?);`
        );
        const insertTagAssignments = db.transaction((tags) => {
          for (const tagId of tags) {
            if (typeof tagId === 'number' && tagId > 0) {
              try {
                tagAssignmentStmt.run(id, tagId);
              } catch (err) {
                // Ignore duplicate or invalid tag assignments
              }
            }
          }
        });
        insertTagAssignments(tagIdsArray);
      }
    }

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
    
    // Get tags for the expense
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN expense_tag_assignments eta ON eta.tagId = t.id
         WHERE eta.expenseId = ?
         ORDER BY t.name ASC;`
      )
      .all(id);
    
    // Convert file path to URL for response (if not base64)
    const expenseWithUrl = {
      ...expense,
      imagePath: expense.imagePath && !expense.imagePath.startsWith('data:') 
        ? getFileUrl(expense.imagePath) 
        : expense.imagePath,
      tags: tags.length > 0 ? tags : [],
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

export const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserIdFromHeader(req);

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
      // Ensure accountId is an integer
      const accountId = typeof expense.accountId === 'number' ? expense.accountId : parseInt(expense.accountId, 10);
      const expenseAmount = typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount);
      
      // Validate accountId and amount
      if (isNaN(accountId) || accountId <= 0) {
        throw new Error(`Invalid accountId: ${expense.accountId}`);
      }
      if (isNaN(expenseAmount) || expenseAmount <= 0) {
        throw new Error(`Invalid expense amount: ${expense.amount}`);
      }
      
      // Verify account exists before reversing
      const account = db.prepare("SELECT id FROM accounts WHERE id = ?").get(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      // Reverse the expense (add back the amount to account)
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(expenseAmount, accountId);

      // Create reversal transaction record
      const expenseDescription = expense.description 
        ? `Expense #${id} - ${expense.description}`
        : `Expense #${id}`;
      
      // Always use current time for reversal to ensure it appears as the latest transaction
      const reversalCreatedAt = new Date().toISOString();
      
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(
        accountId,
        expenseAmount,
        `Reversal: ${expenseDescription} (Deleted)`,
        reversalCreatedAt
      );

      // Hard delete the expense (this will cascade delete expense_changes due to FK constraint)
      db.prepare("DELETE FROM expenses WHERE id = ?;").run(id);
    });

    transaction();

    // Send notification to all users about expense deletion
    const allUsers = db.prepare("SELECT id FROM users").all();
    const allUserIds = allUsers.map(u => u.id);
    const userName = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
    const account = db.prepare("SELECT name FROM accounts WHERE id = ?").get(expense.accountId);
    
    await createNotification({
      userId: allUserIds,
      type: 'expense_deleted',
      title: 'Expense Deleted',
      message: `Expense #${id} - ${expense.amount} ${expense.currencyCode} (${account?.name || 'Account'}) deleted by ${userName?.name || 'User'}${expense.description ? ': ' + expense.description : ''}`,
      entityType: 'expense',
      entityId: id,
      actionUrl: `/expenses`,
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

