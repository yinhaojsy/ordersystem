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
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE currencies SET ${assignments} WHERE id = @id;`).run({
      ...updates,
      active: updates.active ? 1 : 0,
      id,
    });
    const row = db.prepare("SELECT * FROM currencies WHERE id = ?;").get(id);
    res.json({ ...row, active: Boolean(row.active) });
  } catch (error) {
    next(error);
  }
};

export const deleteCurrency = (req, res, next) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM currencies WHERE id = ?;").run(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


