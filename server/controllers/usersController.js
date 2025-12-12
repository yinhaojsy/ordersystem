import { db } from "../db.js";

export const listUsers = (_req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY name ASC;").all();
  res.json(rows);
};

export const createUser = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO users (name, email, role) VALUES (@name, @email, @role);`,
    );
    const result = stmt.run(payload);
    const row = db.prepare("SELECT * FROM users WHERE id = ?;").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
};

export const updateUser = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const fields = Object.keys(updates);
    if (!fields.length) {
      return res.status(400).json({ message: "No updates provided" });
    }
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE users SET ${assignments} WHERE id = @id;`).run({
      ...updates,
      id,
    });
    const row = db.prepare("SELECT * FROM users WHERE id = ?;").get(id);
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = (req, res, next) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM users WHERE id = ?;").run(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


