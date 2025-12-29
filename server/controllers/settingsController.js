import { db } from "../db.js";

export const getSetting = (req, res, next) => {
  try {
    const { key } = req.params;
    const setting = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
    
    if (!setting) {
      return res.json({ key, value: null });
    }
    
    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    next(error);
  }
};

export const setSetting = (req, res, next) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ message: "Setting key is required" });
    }
    
    // Insert or update
    db.prepare(
      `INSERT INTO settings (key, value, updatedAt) 
       VALUES (@key, @value, @updatedAt)
       ON CONFLICT(key) DO UPDATE SET value = @value, updatedAt = @updatedAt`
    ).run({
      key,
      value: String(value),
      updatedAt: new Date().toISOString(),
    });
    
    res.json({ key, value, message: "Setting updated successfully" });
  } catch (error) {
    next(error);
  }
};

