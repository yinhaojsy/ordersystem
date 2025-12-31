import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Railway's persistent volume path, or fallback to local path
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "server", "data");
const uploadsDir = path.join(dataDir, "uploads");

// Ensure uploads directory structure exists
const ensureUploadsDir = () => {
  const dirs = [
    uploadsDir,
    path.join(uploadsDir, "orders"),
    path.join(uploadsDir, "expenses"),
  ];
  
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize on module load
ensureUploadsDir();

/**
 * Get file extension from mimetype or original filename
 */
const getFileExtension = (mimetype, originalname) => {
  if (mimetype) {
    if (mimetype === "image/jpeg" || mimetype === "image/jpg") return ".jpg";
    if (mimetype === "image/png") return ".png";
    if (mimetype === "image/gif") return ".gif";
    if (mimetype === "image/webp") return ".webp";
    if (mimetype === "application/pdf") return ".pdf";
  }
  
  // Fallback to original filename extension
  if (originalname) {
    const ext = path.extname(originalname).toLowerCase();
    if (ext) return ext;
  }
  
  return ".jpg"; // Default
};

/**
 * Generate a unique filename for order receipt
 * Format: order_{orderId}_receipt_{timestamp}_{hash}.{ext}
 */
export const generateOrderReceiptFilename = (orderId, mimetype, originalname) => {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(4).toString("hex");
  const ext = getFileExtension(mimetype, originalname);
  return `order_${orderId}_receipt_${timestamp}_${hash}${ext}`;
};

/**
 * Generate a unique filename for order payment
 * Format: order_{orderId}_payment_{timestamp}_{hash}.{ext}
 */
export const generateOrderPaymentFilename = (orderId, mimetype, originalname) => {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(4).toString("hex");
  const ext = getFileExtension(mimetype, originalname);
  return `order_${orderId}_payment_${timestamp}_${hash}${ext}`;
};

/**
 * Generate a unique filename for expense
 * Format: expense_{expenseId}__{timestamp}_{hash}.{ext}
 */
export const generateExpenseFilename = (expenseId, mimetype, originalname) => {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(4).toString("hex");
  const ext = getFileExtension(mimetype, originalname);
  return `expense_${expenseId}_${timestamp}_${hash}${ext}`;
};

/**
 * Save file to disk and return relative path
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Generated filename
 * @param {string} type - 'order' or 'expense'
 * @returns {string} Relative path from uploads directory (e.g., "orders/order_123_receipt_...jpg")
 */
export const saveFile = (buffer, filename, type = "order") => {
  ensureUploadsDir();
  
  const subDir = type === "expense" ? "expenses" : "orders";
  const filePath = path.join(uploadsDir, subDir, filename);
  
  fs.writeFileSync(filePath, buffer);
  
  // Return relative path (for database storage and URL serving)
  return path.join(subDir, filename).replace(/\\/g, "/"); // Normalize path separators
};

/**
 * Delete file from disk
 * @param {string} filePath - Relative path (e.g., "orders/order_123_receipt_...jpg")
 */
export const deleteFile = (filePath) => {
  if (!filePath) return;
  
  // Handle legacy base64 paths - don't try to delete them
  if (filePath.startsWith("data:")) {
    return;
  }
  
  const fullPath = path.join(uploadsDir, filePath);
  
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    // Don't throw - file deletion errors shouldn't break the app
  }
};

/**
 * Get full file path on disk
 * @param {string} filePath - Relative path (e.g., "orders/order_123_receipt_...jpg")
 * @returns {string} Full path on disk
 */
export const getFullFilePath = (filePath) => {
  if (!filePath) return null;
  
  // Handle legacy base64 paths
  if (filePath.startsWith("data:")) {
    return null;
  }
  
  return path.join(uploadsDir, filePath);
};

/**
 * Convert base64 data URL to buffer (for migration/backward compatibility)
 */
export const base64ToBuffer = (base64String) => {
  if (!base64String || !base64String.startsWith("data:")) {
    return null;
  }
  
  // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
  const base64Data = base64String.split(",")[1];
  if (!base64Data) {
    return null;
  }
  
  return Buffer.from(base64Data, "base64");
};

/**
 * Get uploads directory path (for serving static files)
 */
export const getUploadsDir = () => uploadsDir;

/**
 * Get relative URL path for a file (for serving via HTTP)
 * @param {string} filePath - Relative path (e.g., "orders/order_123_receipt_...jpg")
 * @returns {string} URL path (e.g., "/api/uploads/orders/order_123_receipt_...jpg")
 */
export const getFileUrl = (filePath) => {
  if (!filePath) return null;
  
  // If it's already a base64 data URL, return as-is (for backward compatibility)
  if (filePath.startsWith("data:")) {
    return filePath;
  }
  
  // Return URL path for file storage
  return `/api/uploads/${filePath}`;
};

