import bcrypt from "bcryptjs";
import { db } from "../db.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    let user = db.prepare("SELECT * FROM users WHERE email = ?;").get(email);

    // If user not found, allow bootstrapping a default admin account
    if (!user) {
      if (email === "alice@fx.com" && password === "admin123") {
        const hashed = await bcrypt.hash(password, 10);
        const stmt = db.prepare(
          `INSERT INTO users (name, email, password, role) VALUES (@name, @email, @password, @role);`,
        );
        const result = stmt.run({
          name: "Alice",
          email,
          password: hashed,
          role: "admin",
        });
        user = db.prepare("SELECT * FROM users WHERE id = ?;").get(result.lastInsertRowid);
      } else {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } else if (!user.password) {
      // Backfill missing password for legacy users on first successful login attempt
      const hashed = await bcrypt.hash(password, 10);
      db.prepare("UPDATE users SET password = ? WHERE id = ?;").run(hashed, user.id);
      user.password = hashed;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    next(error);
  }
};
