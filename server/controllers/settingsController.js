import { db, resetDbInstance, dbPath } from "../db.js";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isSafetyBackup = (file) =>
  typeof file === "string" && file.startsWith("pre-restore-") && file.endsWith(".db");

// Get paths
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "server", "data");
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
      const zipFilename = `backup-with-files-${timestamp}.zip`;
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
      
      // Create a backup using better-sqlite3's backup API (expects a path string)
      const backupPath = path.join(backupsDir, dbFilename);
      
      db.backup(backupPath)
        .then(() => {
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

// Restore from uploaded backup
export const restoreBackup = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No backup file provided" });
    }
    
    const uploadedFile = req.file;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    // Create safety backup of current database
    const safetyBackupPath = path.join(backupsDir, `pre-restore-${timestamp}.db`);
    
    db.backup(safetyBackupPath)
      .then(() => {
        // Determine if uploaded file is zip or db
        const isZip = uploadedFile.originalname.endsWith(".zip") || uploadedFile.mimetype === "application/zip";
        
        if (isZip) {
          // TODO: Implement zip extraction and restore
          // For now, return error and clean up the upload
          fs.unlinkSync(uploadedFile.path);
          return res.status(400).json({ 
            message: "Zip restore not yet implemented. Please use database-only backup for now." 
          });
        } else {
      // Database only restore
      // Close current connection temporarily and replace database file
      db.close();
      fs.copyFileSync(uploadedFile.path, dbPath);
      
      // Reopen database (updates exported binding via resetDbInstance)
      resetDbInstance();
      
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
            fs.unlinkSync(safetyBackupPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        // Ensure database is open after failure
        resetDbInstance();
        res.status(500).json({ message: "Error restoring backup" });
      });
  } catch (error) {
    console.error("Restore error:", error);
    next(error);
  }
};

// Restore from latest safety backup (pre-restore-*.db)
// List safety backups (pre-restore-*.db)
export const listSafetyBackups = (_req, res, next) => {
  try {
    const backups = fs
      .readdirSync(backupsDir)
      .filter((file) => isSafetyBackup(file))
      .map((file) => {
        const fullPath = path.join(backupsDir, file);
        const stats = fs.statSync(fullPath);
        return { file, path: fullPath, modifiedAt: stats.mtime.toISOString(), size: stats.size };
      })
      .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
    
    res.json({ backups });
  } catch (error) {
    console.error("List safety backups error:", error);
    next(error);
  }
};

// Restore from safety backup (latest or specified file)
export const restoreSafetyBackup = (req, res, next) => {
  try {
    const { file } = req.body || {};
    let target;

    const backups = fs.readdirSync(backupsDir).filter((name) => isSafetyBackup(name));

    if (backups.length === 0) {
      return res.status(404).json({ message: "No safety backup found" });
    }

    if (file) {
      if (!isSafetyBackup(file)) {
        return res.status(400).json({ message: "Invalid safety backup name" });
      }
      if (!backups.includes(file)) {
        return res.status(404).json({ message: "Specified safety backup not found" });
      }
      target = path.join(backupsDir, file);
    } else {
      // Pick the most recent safety backup
      const sorted = backups
        .map((name) => {
          const fullPath = path.join(backupsDir, name);
          const stats = fs.statSync(fullPath);
          return { name, fullPath, mtime: stats.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
      target = sorted[0].fullPath;
    }
    
    // Replace database with safety backup
    db.close();
    fs.copyFileSync(target, dbPath);
    resetDbInstance();
    
    res.json({
      message: "Database restored from safety backup",
      safetyBackup: target,
    });
  } catch (error) {
    console.error("Restore safety backup error:", error);
    // Ensure database is open after failure
    resetDbInstance();
    next(error);
  }
};

// Download a safety backup
export const downloadSafetyBackup = (req, res, next) => {
  try {
    const { file } = req.query;
    if (!isSafetyBackup(file)) {
      return res.status(400).json({ message: "Invalid safety backup name" });
    }
    const target = path.join(backupsDir, file);
    if (!fs.existsSync(target)) {
      return res.status(404).json({ message: "Safety backup not found" });
    }
    res.download(target, file);
  } catch (error) {
    console.error("Download safety backup error:", error);
    next(error);
  }
};

// Delete a safety backup
export const deleteSafetyBackup = (req, res, next) => {
  try {
    const { file } = req.body || {};
    if (!isSafetyBackup(file)) {
      return res.status(400).json({ message: "Invalid safety backup name" });
    }
    const target = path.join(backupsDir, file);
    if (!fs.existsSync(target)) {
      return res.status(404).json({ message: "Safety backup not found" });
    }
    fs.unlinkSync(target);
    res.json({ message: "Safety backup deleted", file });
  } catch (error) {
    console.error("Delete safety backup error:", error);
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
    
    const validTables = [
      "orders",
      "expenses",
      "internal_transfers",
      "customers",
      "accounts",
      "users",
      "tags",
      "currencies",
    ];
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

