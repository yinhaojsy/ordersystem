import { db } from "../db.js";

export const listRoles = (_req, res) => {
  const rows = db.prepare("SELECT * FROM roles ORDER BY id ASC;").all();
  const parsed = rows.map((row) => ({
    ...row,
    permissions: JSON.parse(row.permissions),
  }));
  res.json(parsed);
};

export const createRole = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO roles (name, displayName, permissions)
       VALUES (@name, @displayName, @permissions);`,
    );
    const result = stmt.run({
      ...payload,
      permissions: JSON.stringify(payload.permissions || { sections: [], actions: {} }),
    });
    const row = db.prepare("SELECT * FROM roles WHERE id = ?;").get(result.lastInsertRowid);
    res
      .status(201)
      .json({ ...row, permissions: JSON.parse(row.permissions || "{}") });
  } catch (error) {
    next(error);
  }
};

export const updateRole = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const fields = Object.keys(updates);
    if (!fields.length) {
      return res.status(400).json({ message: "No updates provided" });
    }
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE roles SET ${assignments} WHERE id = @id;`).run({
      ...updates,
      permissions: updates.permissions
        ? JSON.stringify(updates.permissions)
        : undefined,
      id,
    });
    const row = db.prepare("SELECT * FROM roles WHERE id = ?;").get(id);
    res.json({ ...row, permissions: JSON.parse(row.permissions || "{}") });
  } catch (error) {
    next(error);
  }
};

export const deleteRole = (req, res, next) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM roles WHERE id = ?;").run(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


