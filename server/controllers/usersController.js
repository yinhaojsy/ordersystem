import bcrypt from "bcryptjs";
import { db } from "../db.js";

export const listUsers = (_req, res) => {
  const rows = db.prepare("SELECT id, name, email, role FROM users ORDER BY name ASC;").all();
  res.json(rows);
};

export const createUser = (req, res, next) => {
  try {
    const payload = req.body || {};
    const data = { ...payload };
    if (data.password) {
      data.password = bcrypt.hashSync(data.password, 10);
    } else {
      data.password = null;
    }
    const stmt = db.prepare(
      `INSERT INTO users (name, email, password, role) VALUES (@name, @email, @password, @role);`,
    );
    const result = stmt.run(data);
    const row = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?;").get(result.lastInsertRowid);
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
    const normalized = { ...updates };
    if (normalized.password !== undefined) {
      normalized.password = normalized.password ? bcrypt.hashSync(normalized.password, 10) : null;
    }
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE users SET ${assignments} WHERE id = @id;`).run({
      ...normalized,
      id,
    });
    const row = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?;").get(id);
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = (req, res, next) => {
  try {
    const { id } = req.params;
    // Prevent deleting users that are referenced as handlers on orders
    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE handlerId = ?;")
      .get(id);
    if (count > 0) {
      return res
        .status(400)
        .json({ message: "Cannot delete user while they are assigned to existing orders." });
    }

    const stmt = db.prepare("DELETE FROM users WHERE id = ?;");
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


