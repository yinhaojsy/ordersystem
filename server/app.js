import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/api.js";
import { initDatabase } from "./db.js";
import { getUploadsDir } from "./utils/fileStorage.js";

// Wrap database initialization in try-catch
try {
  initDatabase();
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Failed to initialize database:', error);
  // Don't exit immediately - let the server start and log the error
  // Railway will restart if needed
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Keep limit for backward compatibility during migration
// Note: express.urlencoded is NOT needed here - multer handles FormData parsing automatically

// Serve uploaded files statically
app.use("/api/uploads", express.static(getUploadsDir()));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use("/api", apiRouter);

// Serve static files from React app in production only
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  
  // Catch-all handler: send back React's index.html file for all non-API routes
  // Use middleware approach for Express 5 compatibility
  app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/api")) {
      return next();
    }
    // For all other routes, serve index.html (SPA routing)
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((err, req, res, _next) => {
  // Handle SQLite unique constraint errors
  if (err && (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT')) {
    // Check if it's a currency code constraint
    if (req.path && req.path.includes('/currencies/')) {
      return res.status(400).json({ 
        message: "Currency code already exists. Please choose a different code." 
      });
    }
    // Generic unique constraint error
    return res.status(400).json({ 
      message: "A record with this value already exists. Please choose a different value." 
    });
  }
  
  // Only log unexpected errors
  if (err && err.code !== 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    console.error(err);
  }
  
  // Handle foreign key constraint errors
  if (err && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    // Check if it's a tag assignment error
    if (req.path && req.path.includes('/tags/batch-assign')) {
      return res.status(400).json({ 
        message: err.message || "Invalid order, transfer, expense, or tag ID. Please ensure all IDs exist." 
      });
    }
    // Check if it's a customer deletion error
    if (req.path && req.path.includes('/customers/')) {
      return res.status(400).json({ 
        message: "Cannot delete customer while they have existing orders. Please delete the orders first." 
      });
    }
    // Check if it's a user deletion error
    if (req.path && req.path.includes('/users/')) {
      return res.status(400).json({ 
        message: "Cannot delete user while they are assigned to existing orders. Please delete or reassign the orders first." 
      });
    }
    // Generic foreign key error
    return res.status(400).json({ 
      message: "Cannot delete this item because it is referenced by other records." 
    });
  }
  
  res.status(500).json({ message: err.message || "Internal server error" });
});

export default app;


