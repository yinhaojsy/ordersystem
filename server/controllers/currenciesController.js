import { db } from "../db.js";

export const listCurrencies = (_req, res) => {
  const rows = db.prepare("SELECT * FROM currencies ORDER BY code ASC;").all();
  res.json(rows.map((row) => ({ ...row, active: Boolean(row.active) })));
};

export const createCurrency = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO currencies (code, name, baseRateBuy, conversionRateBuy, baseRateSell, conversionRateSell, active)
       VALUES (@code, @name, @baseRateBuy, @conversionRateBuy, @baseRateSell, @conversionRateSell, @active);`,
    );
    const result = stmt.run({ ...payload, active: payload.active ? 1 : 0 });
    const row = db.prepare("SELECT * FROM currencies WHERE id = ?;").get(result.lastInsertRowid);
    res.status(201).json({ ...row, active: Boolean(row.active) });
  } catch (error) {
    next(error);
  }
};

export const updateCurrency = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const fields = Object.keys(updates);
    if (!fields.length) {
      return res.status(400).json({ message: "No updates provided" });
    }

    // Get existing currency
    const existingCurrency = db.prepare("SELECT id, code FROM currencies WHERE id = ?;").get(id);
    if (!existingCurrency) {
      return res.status(404).json({ message: "Currency not found" });
    }

    // Check if code is being updated and if it already exists
    if (updates.code !== undefined) {
      // If code is changing, check if new code already exists
      if (updates.code !== existingCurrency.code) {
        const codeExists = db.prepare("SELECT id FROM currencies WHERE code = ? AND id != ?;").get(updates.code, id);
        if (codeExists) {
          return res.status(400).json({ 
            message: `Currency code "${updates.code}" already exists. Please choose a different code.` 
          });
        }

        // Update currency code in a transaction to cascade updates to all references
        const oldCode = existingCurrency.code;
        const newCode = updates.code;

        // Temporarily disable foreign key constraints to allow updating references
        db.pragma("foreign_keys = OFF");
        
        try {
          const transaction = db.transaction(() => {
            // First, update the currency code in currencies table
            const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
            db.prepare(`UPDATE currencies SET ${assignments} WHERE id = @id;`).run({
              ...updates,
              active: updates.active ? 1 : 0,
              id,
            });

            // Then update all orders that reference the old currency code
            db.prepare("UPDATE orders SET fromCurrency = ? WHERE fromCurrency = ?;").run(newCode, oldCode);
            db.prepare("UPDATE orders SET toCurrency = ? WHERE toCurrency = ?;").run(newCode, oldCode);

            // Update all accounts that reference the old currency code
            db.prepare("UPDATE accounts SET currencyCode = ? WHERE currencyCode = ?;").run(newCode, oldCode);

            // Update all internal transfers that reference the old currency code
            db.prepare("UPDATE internal_transfers SET currencyCode = ? WHERE currencyCode = ?;").run(newCode, oldCode);
          });

          transaction();
        } finally {
          // Re-enable foreign key constraints
          db.pragma("foreign_keys = ON");
        }
      } else {
        // Code is not changing, just update other fields
        const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
        db.prepare(`UPDATE currencies SET ${assignments} WHERE id = @id;`).run({
          ...updates,
          active: updates.active ? 1 : 0,
          id,
        });
      }
    } else {
      // Code is not being updated, just update other fields
      const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
      db.prepare(`UPDATE currencies SET ${assignments} WHERE id = @id;`).run({
        ...updates,
        active: updates.active ? 1 : 0,
        id,
      });
    }

    const row = db.prepare("SELECT * FROM currencies WHERE id = ?;").get(id);
    res.json({ ...row, active: Boolean(row.active) });
  } catch (error) {
    // Handle SQLite unique constraint error
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || 
        error.code === 'SQLITE_CONSTRAINT' ||
        error.message?.includes('UNIQUE constraint') ||
        error.message?.includes('UNIQUE')) {
      const code = updates.code || 'the provided code';
      return res.status(400).json({ 
        message: `Currency code "${code}" already exists. Please choose a different code.` 
      });
    }
    console.error('Currency update error:', error);
    next(error);
  }
};

export const deleteCurrency = (req, res, next) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare("DELETE FROM currencies WHERE id = ?;");
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Currency not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


