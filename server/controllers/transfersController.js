import { db } from "../db.js";

export const listTransfers = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT 
        t.*,
        fromAcc.name as fromAccountName,
        fromAcc.currencyCode,
        toAcc.name as toAccountName,
        creator.name as createdByName,
        updater.name as updatedByName
       FROM internal_transfers t
       LEFT JOIN accounts fromAcc ON fromAcc.id = t.fromAccountId
       LEFT JOIN accounts toAcc ON toAcc.id = t.toAccountId
       LEFT JOIN users creator ON creator.id = t.createdBy
       LEFT JOIN users updater ON updater.id = t.updatedBy
       ORDER BY t.createdAt DESC;`,
    )
    .all();
  res.json(rows);
};

export const createTransfer = (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, description, createdBy } = req.body || {};

    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ message: "From account, to account, and amount are required" });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ message: "Cannot transfer to the same account" });
    }

    // Get both accounts
    const fromAccount = db.prepare("SELECT id, name, balance, currencyCode FROM accounts WHERE id = ?;").get(fromAccountId);
    const toAccount = db.prepare("SELECT id, name, balance, currencyCode FROM accounts WHERE id = ?;").get(toAccountId);

    if (!fromAccount) {
      return res.status(404).json({ message: "From account not found" });
    }
    if (!toAccount) {
      return res.status(404).json({ message: "To account not found" });
    }

    // Verify same currency
    if (fromAccount.currencyCode !== toAccount.currencyCode) {
      return res.status(400).json({ 
        message: `Cannot transfer between different currencies. From: ${fromAccount.currencyCode}, To: ${toAccount.currencyCode}` 
      });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    // Check sufficient balance (allow negative, but warn)
    const newFromBalance = fromAccount.balance - transferAmount;
    if (newFromBalance < 0) {
      // Allow negative but could add warning here if needed
    }

    // Perform transfer in a transaction
    const transaction = db.transaction(() => {
      // Update balances
      db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(transferAmount, fromAccountId);
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(transferAmount, toAccountId);

      // Create transaction records for both accounts
      const transferDescription = description 
        ? `Internal transfer to ${toAccount.name}: ${description}`
        : `Internal transfer to ${toAccount.name}`;
      
      const receiveDescription = description
        ? `Internal transfer from ${fromAccount.name}: ${description}`
        : `Internal transfer from ${fromAccount.name}`;

      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        fromAccountId,
        transferAmount,
        transferDescription,
        new Date().toISOString()
      );

      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(
        toAccountId,
        transferAmount,
        receiveDescription,
        new Date().toISOString()
      );

      // Create transfer record
      const stmt = db.prepare(
        `INSERT INTO internal_transfers (fromAccountId, toAccountId, amount, currencyCode, description, createdBy, createdAt)
         VALUES (@fromAccountId, @toAccountId, @amount, @currencyCode, @description, @createdBy, @createdAt);`
      );
      const result = stmt.run({
        fromAccountId,
        toAccountId,
        amount: transferAmount,
        currencyCode: fromAccount.currencyCode,
        description: description || null,
        createdBy: createdBy || null,
        createdAt: new Date().toISOString(),
      });

      const transferId = result.lastInsertRowid;

      // Log the initial creation as a change
      db.prepare(
        `INSERT INTO transfer_changes (transferId, changedBy, changedAt, fromAccountId, fromAccountName, toAccountId, toAccountName, amount, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`
      ).run(
        transferId,
        createdBy || null,
        new Date().toISOString(),
        fromAccountId,
        fromAccount.name,
        toAccountId,
        toAccount.name,
        transferAmount,
        description || null
      );

      return transferId;
    });

    const transferId = transaction();

    // Get the created transfer with joined data
    const transfer = db
      .prepare(
        `SELECT 
          t.*,
          fromAcc.name as fromAccountName,
          fromAcc.currencyCode,
          toAcc.name as toAccountName,
          creator.name as createdByName
         FROM internal_transfers t
         LEFT JOIN accounts fromAcc ON fromAcc.id = t.fromAccountId
         LEFT JOIN accounts toAcc ON toAcc.id = t.toAccountId
         LEFT JOIN users creator ON creator.id = t.createdBy
         WHERE t.id = ?;`
      )
      .get(transferId);

    res.status(201).json(transfer);
  } catch (error) {
    next(error);
  }
};

export const updateTransfer = (req, res, next) => {
  try {
    const { id } = req.params;
    const { fromAccountId, toAccountId, amount, description, updatedBy } = req.body || {};

    // Get existing transfer
    const existingTransfer = db.prepare("SELECT * FROM internal_transfers WHERE id = ?;").get(id);
    if (!existingTransfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    // Get account details
    const finalFromAccountId = fromAccountId !== undefined ? fromAccountId : existingTransfer.fromAccountId;
    const finalToAccountId = toAccountId !== undefined ? toAccountId : existingTransfer.toAccountId;
    const finalAmount = amount !== undefined ? Number(amount) : existingTransfer.amount;
    const finalDescription = description !== undefined ? (description || null) : existingTransfer.description;

    if (finalFromAccountId === finalToAccountId) {
      return res.status(400).json({ message: "Cannot transfer to the same account" });
    }

    const fromAccount = db.prepare("SELECT id, name, balance, currencyCode FROM accounts WHERE id = ?;").get(finalFromAccountId);
    const toAccount = db.prepare("SELECT id, name, balance, currencyCode FROM accounts WHERE id = ?;").get(finalToAccountId);

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    if (fromAccount.currencyCode !== toAccount.currencyCode) {
      return res.status(400).json({ 
        message: `Cannot transfer between different currencies. From: ${fromAccount.currencyCode}, To: ${toAccount.currencyCode}` 
      });
    }

    if (isNaN(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const fromAccountChanged = fromAccountId !== undefined && fromAccountId !== existingTransfer.fromAccountId;
    const toAccountChanged = toAccountId !== undefined && toAccountId !== existingTransfer.toAccountId;
    const amountChanged = amount !== undefined && amount !== existingTransfer.amount;

    // Perform update in a transaction
    const transaction = db.transaction(() => {
      // If accounts or amount changed, reverse old transfer and create new one
      if (fromAccountChanged || toAccountChanged || amountChanged) {
        // Reverse old transfer: add back to old from account, deduct from old to account
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(
          existingTransfer.amount,
          existingTransfer.fromAccountId
        );
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(
          existingTransfer.amount,
          existingTransfer.toAccountId
        );

        // Create reversal transactions
        const oldFromAccount = db.prepare("SELECT name FROM accounts WHERE id = ?;").get(existingTransfer.fromAccountId);
        const oldToAccount = db.prepare("SELECT name FROM accounts WHERE id = ?;").get(existingTransfer.toAccountId);
        
        const oldDescription = existingTransfer.description 
          ? `Internal transfer to ${oldToAccount.name}: ${existingTransfer.description}`
          : `Internal transfer to ${oldToAccount.name}`;

        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          existingTransfer.fromAccountId,
          existingTransfer.amount,
          `Reversal: ${oldDescription}`,
          new Date().toISOString()
        );

        const oldReceiveDescription = existingTransfer.description
          ? `Internal transfer from ${oldFromAccount.name}: ${existingTransfer.description}`
          : `Internal transfer from ${oldFromAccount.name}`;

        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          existingTransfer.toAccountId,
          existingTransfer.amount,
          `Reversal: ${oldReceiveDescription}`,
          new Date().toISOString()
        );

        // Create new transfer: deduct from new from account, add to new to account
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(
          finalAmount,
          finalFromAccountId
        );
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(
          finalAmount,
          finalToAccountId
        );

        // Create new transactions
        const newDescription = finalDescription
          ? `Internal transfer to ${toAccount.name}: ${finalDescription}`
          : `Internal transfer to ${toAccount.name}`;

        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          finalFromAccountId,
          finalAmount,
          newDescription,
          new Date().toISOString()
        );

        const newReceiveDescription = finalDescription
          ? `Internal transfer from ${fromAccount.name}: ${finalDescription}`
          : `Internal transfer from ${fromAccount.name}`;

        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          finalToAccountId,
          finalAmount,
          newReceiveDescription,
          new Date().toISOString()
        );
      }

      // Update transfer record
      const updateFields = [];
      const updateValues = [];
      
      if (fromAccountId !== undefined) updateFields.push("fromAccountId = ?"), updateValues.push(fromAccountId);
      if (toAccountId !== undefined) updateFields.push("toAccountId = ?"), updateValues.push(toAccountId);
      if (amount !== undefined) updateFields.push("amount = ?"), updateValues.push(finalAmount);
      if (description !== undefined) updateFields.push("description = ?"), updateValues.push(finalDescription || null);
      
      updateFields.push("updatedBy = ?"), updateValues.push(updatedBy || null);
      updateFields.push("updatedAt = ?"), updateValues.push(new Date().toISOString());
      updateValues.push(id);

      if (updateFields.length > 2) {
        db.prepare(`UPDATE internal_transfers SET ${updateFields.join(", ")} WHERE id = ?;`).run(...updateValues);
        
        // Log the change if accounts, amount, or description changed
        if (fromAccountId !== undefined || toAccountId !== undefined || amount !== undefined || description !== undefined) {
          db.prepare(
            `INSERT INTO transfer_changes (transferId, changedBy, changedAt, fromAccountId, fromAccountName, toAccountId, toAccountName, amount, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`
          ).run(
            id,
            updatedBy || null,
            new Date().toISOString(),
            finalFromAccountId,
            fromAccount.name,
            finalToAccountId,
            toAccount.name,
            finalAmount,
            finalDescription
          );
        }
      }
    });

    transaction();

    // Get the updated transfer with joined data
    const transfer = db
      .prepare(
        `SELECT 
          t.*,
          fromAcc.name as fromAccountName,
          fromAcc.currencyCode,
          toAcc.name as toAccountName,
          creator.name as createdByName,
          updater.name as updatedByName
         FROM internal_transfers t
         LEFT JOIN accounts fromAcc ON fromAcc.id = t.fromAccountId
         LEFT JOIN accounts toAcc ON toAcc.id = t.toAccountId
         LEFT JOIN users creator ON creator.id = t.createdBy
         LEFT JOIN users updater ON updater.id = t.updatedBy
         WHERE t.id = ?;`
      )
      .get(id);

    res.json(transfer);
  } catch (error) {
    next(error);
  }
};

export const getTransferChanges = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if transfer exists
    const transfer = db.prepare("SELECT id FROM internal_transfers WHERE id = ?;").get(id);
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    // Get all changes for this transfer
    const changes = db
      .prepare(
        `SELECT 
          tc.*,
          u.name as changedByName
         FROM transfer_changes tc
         LEFT JOIN users u ON u.id = tc.changedBy
         WHERE tc.transferId = ?
         ORDER BY tc.changedAt ASC;`
      )
      .all(id);

    res.json(changes);
  } catch (error) {
    next(error);
  }
};

export const deleteTransfer = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if transfer exists
    const transfer = db.prepare("SELECT * FROM internal_transfers WHERE id = ?;").get(id);
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    // Note: We don't reverse the account balances when deleting a transfer
    // as this could cause issues if accounts have been modified since the transfer
    // The transfer record is just removed for audit purposes
    
    db.prepare("DELETE FROM internal_transfers WHERE id = ?;").run(id);
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

