import { db } from "../db.js";

export const listCustomers = (_req, res) => {
  const rows = db.prepare("SELECT * FROM customers ORDER BY name ASC;").all();
  res.json(rows);
};

export const createCustomer = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO customers (name, email, phone) VALUES (@name, @email, @phone);`,
    );
    const result = stmt.run(payload);
    const row = db.prepare("SELECT * FROM customers WHERE id = ?;").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const fields = Object.keys(updates);
    if (!fields.length) {
      return res.status(400).json({ message: "No updates provided" });
    }
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE customers SET ${assignments} WHERE id = @id;`).run({
      ...updates,
      id,
    });
    const row = db.prepare("SELECT * FROM customers WHERE id = ?;").get(id);
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = (req, res, next) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare("DELETE FROM customers WHERE id = ?;");
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


