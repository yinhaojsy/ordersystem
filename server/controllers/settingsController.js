import { db } from "../db.js";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get paths
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "server", "data");
const dbPath = path.join(dataDir, "app.db");
const uploadsDir = path.join(dataDir, "uploads");
const backupsDir = path.join(dataDir, "backups");

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

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

// Create backup (database only or with files)
export const createBackup = (req, res, next) => {
  try {
    const { includeFiles } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    if (includeFiles) {
      // Create zip with database and files
      const zipFilename = `backup-${timestamp}.zip`;
      const zipPath = path.join(backupsDir, zipFilename);
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);
      
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error creating backup archive" });
        }
      });
      
      archive.pipe(res);
      
      // Add database file
      archive.file(dbPath, { name: "app.db" });
      
      // Add uploads directory if it exists
      if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, "uploads");
      }
      
      archive.finalize();
    } else {
      // Database only backup
      const dbFilename = `backup-${timestamp}.db`;
      
      res.setHeader("Content-Type", "application/x-sqlite3");
      res.setHeader("Content-Disposition", `attachment; filename="${dbFilename}"`);
      
      // Create a backup using better-sqlite3's backup API
      const backupPath = path.join(backupsDir, dbFilename);
      const backupDb = new Database(backupPath);
      
      db.backup(backupDb)
        .then(() => {
          backupDb.close();
          
          // Stream the backup file to response
          const stream = fs.createReadStream(backupPath);
          stream.pipe(res);
          
          stream.on("end", () => {
            // Clean up backup file after sending
            fs.unlinkSync(backupPath);
          });
          
          stream.on("error", (err) => {
            console.error("Stream error:", err);
            if (!res.headersSent) {
              res.status(500).json({ message: "Error streaming backup" });
            }
          });
        })
        .catch((err) => {
          console.error("Backup error:", err);
          if (fs.existsSync(backupPath)) {
            backupDb.close();
            fs.unlinkSync(backupPath);
          }
          if (!res.headersSent) {
            res.status(500).json({ message: "Error creating database backup" });
          }
        });
    }
  } catch (error) {
    console.error("Backup error:", error);
    next(error);
  }
};

// Restore from backup
export const restoreBackup = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No backup file provided" });
    }
    
    const uploadedFile = req.file;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    // Create safety backup of current database
    const safetyBackupPath = path.join(backupsDir, `pre-restore-${timestamp}.db`);
    const safetyBackupDb = new Database(safetyBackupPath);
    
    db.backup(safetyBackupDb)
      .then(() => {
        safetyBackupDb.close();
        
        // Determine if uploaded file is zip or db
        const isZip = uploadedFile.originalname.endsWith(".zip") || uploadedFile.mimetype === "application/zip";
        
        if (isZip) {
          // TODO: Implement zip extraction and restore
          // For now, return error
          return res.status(400).json({ 
            message: "Zip restore not yet implemented. Please use database-only backup for now." 
          });
        } else {
          // Database only restore
          // Close current connection temporarily
          db.close();
          
          // Replace database file
          fs.copyFileSync(uploadedFile.path, dbPath);
          
          // Reopen database
          const Database = require("better-sqlite3");
          const newDb = new Database(dbPath);
          newDb.pragma("journal_mode = WAL");
          newDb.pragma("foreign_keys = ON");
          
          // Update the db export reference
          Object.assign(db, newDb);
          
          // Clean up uploaded file
          fs.unlinkSync(uploadedFile.path);
          
          res.json({ 
            message: "Database restored successfully",
            safetyBackup: safetyBackupPath 
          });
        }
      })
      .catch((err) => {
        console.error("Restore error:", err);
        if (fs.existsSync(safetyBackupPath)) {
          try {
            safetyBackupDb.close();
          } catch (e) {
            // Ignore
          }
        }
        res.status(500).json({ message: "Error restoring backup" });
      });
  } catch (error) {
    console.error("Restore error:", error);
    next(error);
  }
};

// Reset auto-increment IDs for specified tables
export const resetTableIds = (req, res, next) => {
  try {
    const { tables } = req.body; // Array of table names: ['orders', 'expenses', 'internal_transfers']
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ message: "No tables specified" });
    }
    
    const validTables = ["orders", "expenses", "internal_transfers"];
    const tablesToReset = tables.filter((t) => validTables.includes(t));
    
    if (tablesToReset.length === 0) {
      return res.status(400).json({ message: "No valid tables specified" });
    }
    
    const results = [];
    
    for (const tableName of tablesToReset) {
      // Check if table is empty
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
      
      if (count > 0) {
        results.push({
          table: tableName,
          success: false,
          message: `Table has ${count} rows. Cannot reset ID while table has data.`,
          currentMaxId: db.prepare(`SELECT MAX(id) as maxId FROM ${tableName}`).get().maxId,
        });
      } else {
        // Reset the auto-increment by deleting from sqlite_sequence
        db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(tableName);
        
        results.push({
          table: tableName,
          success: true,
          message: "ID counter reset successfully. Next ID will be 1.",
          currentMaxId: 0,
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error("Reset IDs error:", error);
    next(error);
  }
};

// Get database schema information
export const getDbSchema = (req, res, next) => {
  try {
    // Get all tables
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    
    const schema = tables.map((table) => {
      const tableName = table.name;
      
      // Get column info for each table
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      
      // Get row count
      const rowCount = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
      
      return {
        name: tableName,
        rowCount,
        columns: columns.map((col) => ({
          name: col.name,
          type: col.type,
          notNull: col.notnull === 1,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1,
        })),
      };
    });
    
    res.json({ schema });
  } catch (error) {
    console.error("Get schema error:", error);
    next(error);
  }
};

// Execute SQL query (read-only)
export const executeQuery = (req, res, next) => {
  try {
    const { sql } = req.body;
    
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ message: "No SQL query provided" });
    }
    
    // Validate that query is read-only (starts with SELECT)
    const trimmedSql = sql.trim().toLowerCase();
    if (!trimmedSql.startsWith("select") && !trimmedSql.startsWith("pragma")) {
      return res.status(400).json({ 
        message: "Only SELECT and PRAGMA queries are allowed for security reasons" 
      });
    }
    
    // Execute query with timeout
    try {
      const results = db.prepare(sql).all();
      
      res.json({ 
        success: true,
        rowCount: results.length,
        results 
      });
    } catch (queryError) {
      res.status(400).json({ 
        success: false,
        message: queryError.message 
      });
    }
  } catch (error) {
    console.error("Execute query error:", error);
    next(error);
  }
};

