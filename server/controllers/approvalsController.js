import { db } from "../db.js";
import { getUserIdFromHeader } from "../utils/auth.js";
import { getUserPermissions, canApproveDelete, canApproveEdit, canRequestDelete, canRequestEdit } from "../utils/orderPermissions.js";
import { saveFile, generateOrderReceiptFilename, generateOrderPaymentFilename } from "../utils/fileStorage.js";
import { createNotification } from "../services/notification/notificationService.js";

/**
 * Create an approval request
 * For orders: entityType = 'order', requestType = 'delete' or 'edit'
 * For expenses: entityType = 'expense', requestType = 'delete' or 'edit'
 * For transfers: entityType = 'transfer', requestType = 'delete' or 'edit'
 */
export const createApprovalRequest = async (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
    }

    // Handle both JSON and FormData
    let entityType, entityId, requestType, reason, requestData;
    
    // Check if this is FormData (has files or body fields are strings)
    const isFormData = req.files && (req.files.receiptFiles || req.files.paymentFiles);
    
    if (isFormData) {
      // FormData - fields come as strings
      entityType = req.body.entityType;
      entityId = req.body.entityId ? Number(req.body.entityId) : undefined;
      requestType = req.body.requestType;
      reason = req.body.reason;
      requestData = req.body.requestData ? (typeof req.body.requestData === 'string' ? JSON.parse(req.body.requestData) : req.body.requestData) : undefined;
    } else {
      // Regular JSON
      ({ entityType, entityId, requestType, reason, requestData } = req.body || {});
      entityId = entityId ? Number(entityId) : undefined;
    }

    if (!entityType || !entityId || !requestType || !reason) {
      return res.status(400).json({ 
        message: "entityType, entityId, requestType, and reason are required" 
      });
    }

    if (requestType !== 'delete' && requestType !== 'edit') {
      return res.status(400).json({ message: "requestType must be 'delete' or 'edit'" });
    }

    // For edit requests, requestData is required
    if (requestType === 'edit' && !requestData) {
      return res.status(400).json({ message: "requestData is required for edit requests" });
    }

    // Handle file uploads for order edit requests
    if (requestType === 'edit' && entityType === 'order' && req.files) {
      let receiptFileIndex = 0;
      let paymentFileIndex = 0;
      
      // Process receipt files and map them to receipts that need new images
      if (req.files.receiptFiles && Array.isArray(req.files.receiptFiles)) {
        if (requestData && Array.isArray(requestData.receipts)) {
          requestData.receipts.forEach((receipt) => {
            if (receipt.hasNewImage && receiptFileIndex < req.files.receiptFiles.length) {
              const file = req.files.receiptFiles[receiptFileIndex];
              const filename = generateOrderReceiptFilename(entityId, file.mimetype, file.originalname);
              const filePath = saveFile(file.buffer, filename, "order");
              receipt.newImagePath = filePath;
              receiptFileIndex++;
            }
          });
        }
      }
      
      // Process payment files and map them to payments that need new images
      if (req.files.paymentFiles && Array.isArray(req.files.paymentFiles)) {
        if (requestData && Array.isArray(requestData.payments)) {
          requestData.payments.forEach((payment) => {
            if (payment.hasNewImage && paymentFileIndex < req.files.paymentFiles.length) {
              const file = req.files.paymentFiles[paymentFileIndex];
              const filename = generateOrderPaymentFilename(entityId, file.mimetype, file.originalname);
              const filePath = saveFile(file.buffer, filename, "order");
              payment.newImagePath = filePath;
              paymentFileIndex++;
            }
          });
        }
      }
    }

    // Validate entity exists
    let entityExists = false;
    if (entityType === 'order') {
      const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(entityId);
      entityExists = !!order;
    } else if (entityType === 'expense') {
      const expense = db.prepare("SELECT id FROM expenses WHERE id = ? AND deletedAt IS NULL").get(entityId);
      entityExists = !!expense;
    } else if (entityType === 'transfer') {
      const transfer = db.prepare("SELECT id FROM internal_transfers WHERE id = ?").get(entityId);
      entityExists = !!transfer;
    } else {
      return res.status(400).json({ message: "Invalid entityType. Must be 'order', 'expense', or 'transfer'" });
    }

    if (!entityExists) {
      return res.status(404).json({ message: `${entityType} not found` });
    }

    // Check permissions for order requests
    if (entityType === 'order') {
      const userPermissions = getUserPermissions(userId);
      const order = db.prepare("SELECT id, createdBy, handlerId FROM orders WHERE id = ?").get(entityId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Check if user has permission to request delete
      if (requestType === 'delete' && !canRequestDelete(order, userId, userPermissions)) {
        return res.status(403).json({ 
          message: "You don't have permission to request order deletion" 
        });
      }
      
      // Check if user has permission to request edit
      if (requestType === 'edit' && !canRequestEdit(order, userId, userPermissions)) {
        return res.status(403).json({ 
          message: "You don't have permission to request order edit" 
        });
      }
    }

    // Check if there's already a pending request for this entity
    const existingRequest = db.prepare(
      "SELECT id FROM approval_requests WHERE entityType = ? AND entityId = ? AND status = 'pending'"
    ).get(entityType, entityId);

    if (existingRequest) {
      return res.status(400).json({ 
        message: "A pending approval request already exists for this " + entityType 
      });
    }

    // For orders, check current status and store it for restoration later
    // Also capture the original entity data before any changes
    let previousStatus = null;
    let originalEntityData = null;
    
    if (entityType === 'order') {
      const order = db.prepare("SELECT id, status FROM orders WHERE id = ?").get(entityId);
      if (order && order.status === 'completed') {
        previousStatus = order.status;
        // Update order status based on request type
        const newStatus = requestType === 'delete' ? 'pending_delete' : 'pending_amend';
        db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(newStatus, entityId);
      }
      
      // Get the original order data with all related information (before any changes)
      const originalOrder = db.prepare(
        `SELECT o.*, 
                c.name as customerName, 
                u.name as handlerName,
                ba.name as buyAccountName,
                sa.name as sellAccountName,
                pa.name as profitAccountName,
                sca.name as serviceChargeAccountName
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         LEFT JOIN users u ON u.id = o.handlerId
         LEFT JOIN accounts ba ON ba.id = o.buyAccountId
         LEFT JOIN accounts sa ON sa.id = o.sellAccountId
         LEFT JOIN accounts pa ON pa.id = o.profitAccountId
         LEFT JOIN accounts sca ON sca.id = o.serviceChargeAccountId
         WHERE o.id = ?`
      ).get(entityId);
      
      if (originalOrder) {
        // Get tags for the order
        const tags = db.prepare(
          `SELECT t.id, t.name, t.color 
           FROM tags t
           INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
           WHERE ota.orderId = ?
           ORDER BY t.name ASC;`
        ).all(entityId);
        originalOrder.tags = tags.length > 0 ? tags : [];
        
        // For OTC orders, profit and service charges are stored in separate tables
        // Get confirmed profit first, then draft, then fall back to order table fields
        const confirmedProfit = db.prepare(
          `SELECT amount, currencyCode, accountId
           FROM order_profits
           WHERE orderId = ? AND status = 'confirmed'
           ORDER BY createdAt DESC
           LIMIT 1;`
        ).get(entityId);
        
        const draftProfit = confirmedProfit ? null : db.prepare(
          `SELECT amount, currencyCode, accountId
           FROM order_profits
           WHERE orderId = ? AND status = 'draft'
           ORDER BY createdAt DESC
           LIMIT 1;`
        ).get(entityId);
        
        const profit = confirmedProfit || draftProfit;
        if (profit) {
          originalOrder.profitAmount = profit.amount;
          originalOrder.profitCurrency = profit.currencyCode;
          originalOrder.profitAccountId = profit.accountId;
          // Get account name for profit
          if (profit.accountId) {
            const profitAccount = db.prepare("SELECT name FROM accounts WHERE id = ?").get(profit.accountId);
            if (profitAccount) {
              originalOrder.profitAccountName = profitAccount.name;
            }
          }
        }
        
        // Get confirmed service charge first, then draft, then fall back to order table fields
        const confirmedServiceCharge = db.prepare(
          `SELECT amount, currencyCode, accountId
           FROM order_service_charges
           WHERE orderId = ? AND status = 'confirmed'
           ORDER BY createdAt DESC
           LIMIT 1;`
        ).get(entityId);
        
        const draftServiceCharge = confirmedServiceCharge ? null : db.prepare(
          `SELECT amount, currencyCode, accountId
           FROM order_service_charges
           WHERE orderId = ? AND status = 'draft'
           ORDER BY createdAt DESC
           LIMIT 1;`
        ).get(entityId);
        
        const serviceCharge = confirmedServiceCharge || draftServiceCharge;
        if (serviceCharge) {
          originalOrder.serviceChargeAmount = serviceCharge.amount;
          originalOrder.serviceChargeCurrency = serviceCharge.currencyCode;
          originalOrder.serviceChargeAccountId = serviceCharge.accountId;
          // Get account name for service charge
          if (serviceCharge.accountId) {
            const serviceChargeAccount = db.prepare("SELECT name FROM accounts WHERE id = ?").get(serviceCharge.accountId);
            if (serviceChargeAccount) {
              originalOrder.serviceChargeAccountName = serviceChargeAccount.name;
            }
          }
        }
        
        // Get original receipts and payments for storage
        // For completed orders, get confirmed receipts/payments
        // Also check for draft receipts/payments if no confirmed ones exist (for edge cases)
        let originalReceipts = db.prepare(
          `SELECT r.*, a.name as accountName 
           FROM order_receipts r
           LEFT JOIN accounts a ON a.id = r.accountId
           WHERE r.orderId = ? AND r.status = 'confirmed'
           ORDER BY r.createdAt ASC;`
        ).all(entityId);
        
        let originalPayments = db.prepare(
          `SELECT p.*, a.name as accountName 
           FROM order_payments p
           LEFT JOIN accounts a ON a.id = p.accountId
           WHERE p.orderId = ? AND p.status = 'confirmed'
           ORDER BY p.createdAt ASC;`
        ).all(entityId);
        
        // If no confirmed receipts/payments, check for drafts (shouldn't happen for completed orders, but handle it)
        if (originalReceipts.length === 0) {
          originalReceipts = db.prepare(
            `SELECT r.*, a.name as accountName 
             FROM order_receipts r
             LEFT JOIN accounts a ON a.id = r.accountId
             WHERE r.orderId = ?
             ORDER BY r.createdAt ASC;`
          ).all(entityId);
        }
        
        if (originalPayments.length === 0) {
          originalPayments = db.prepare(
            `SELECT p.*, a.name as accountName 
             FROM order_payments p
             LEFT JOIN accounts a ON a.id = p.accountId
             WHERE p.orderId = ?
             ORDER BY p.createdAt ASC;`
          ).all(entityId);
        }
        
        // If no receipts/payments found but order has direct account transactions,
        // create entries from buyAccountId/sellAccountId for display purposes
        // Include imagePath for display purposes
        const { getFileUrl: getFileUrlForStorage } = await import("../utils/fileStorage.js");
        let receiptsToStore = originalReceipts.map(r => ({
          amount: r.amount,
          accountId: r.accountId,
          accountName: r.accountName,
          imagePath: r.imagePath ? (r.imagePath.startsWith('data:') || r.imagePath.startsWith('/api/uploads/') 
            ? r.imagePath 
            : getFileUrlForStorage(r.imagePath)) : null,
        }));
        
        let paymentsToStore = originalPayments.map(p => ({
          amount: p.amount,
          accountId: p.accountId,
          accountName: p.accountName,
          imagePath: p.imagePath ? (p.imagePath.startsWith('data:') || p.imagePath.startsWith('/api/uploads/') 
            ? p.imagePath 
            : getFileUrlForStorage(p.imagePath)) : null,
        }));
        
        // Handle orders with direct account transactions (no receipts/payments in child tables)
        if (receiptsToStore.length === 0 && originalOrder.buyAccountId && originalOrder.amountBuy) {
          const buyAccount = db.prepare("SELECT name FROM accounts WHERE id = ?").get(originalOrder.buyAccountId);
          receiptsToStore = [{
            amount: originalOrder.amountBuy,
            accountId: originalOrder.buyAccountId,
            accountName: buyAccount?.name || null,
          }];
        }
        
        if (paymentsToStore.length === 0 && originalOrder.sellAccountId && originalOrder.amountSell) {
          const sellAccount = db.prepare("SELECT name FROM accounts WHERE id = ?").get(originalOrder.sellAccountId);
          paymentsToStore = [{
            amount: originalOrder.amountSell,
            accountId: originalOrder.sellAccountId,
            accountName: sellAccount?.name || null,
          }];
        }
        
        // Add receipts and payments to original order data
        originalOrder.originalReceipts = receiptsToStore;
        originalOrder.originalPayments = paymentsToStore;
        
        originalEntityData = JSON.stringify(originalOrder);
      }
    } else if (entityType === 'expense') {
      const originalExpense = db.prepare(
        `SELECT e.*, a.name as accountName, a.currencyCode, u1.name as createdByName, u2.name as updatedByName
         FROM expenses e
         LEFT JOIN accounts a ON a.id = e.accountId
         LEFT JOIN users u1 ON u1.id = e.createdBy
         LEFT JOIN users u2 ON u2.id = e.updatedBy
         WHERE e.id = ? AND e.deletedAt IS NULL`
      ).get(entityId);
      if (originalExpense) {
        originalEntityData = JSON.stringify(originalExpense);
      }
    } else if (entityType === 'transfer') {
      const originalTransfer = db.prepare(
        `SELECT t.*, 
                a1.name as fromAccountName, a1.currencyCode as fromCurrencyCode,
                a2.name as toAccountName, a2.currencyCode as toCurrencyCode,
                u1.name as createdByName, u2.name as updatedByName
         FROM internal_transfers t
         LEFT JOIN accounts a1 ON a1.id = t.fromAccountId
         LEFT JOIN accounts a2 ON a2.id = t.toAccountId
         LEFT JOIN users u1 ON u1.id = t.createdBy
         LEFT JOIN users u2 ON u2.id = t.updatedBy
         WHERE t.id = ?`
      ).get(entityId);
      if (originalTransfer) {
        originalEntityData = JSON.stringify(originalTransfer);
      }
    }

    // Create approval request
    const stmt = db.prepare(
      `INSERT INTO approval_requests (
        entityType, entityId, requestType, requestedBy, reason, requestData, originalEntityData, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    );

    const result = stmt.run(
      entityType,
      entityId,
      requestType,
      userId,
      reason,
      requestData ? JSON.stringify(requestData) : null,
      originalEntityData
    );

    const requestId = result.lastInsertRowid;

    // Get the created request with user info
    const request = db.prepare(
      `SELECT ar.*,
              u1.name as requestedByName
       FROM approval_requests ar
       LEFT JOIN users u1 ON u1.id = ar.requestedBy
       WHERE ar.id = ?`
    ).get(requestId);

    // Notify users who can approve this request
    // Get all users who can approve this type of request
    const allUsers = db.prepare("SELECT id FROM users").all();
    const approverIds = [];
    
    for (const user of allUsers) {
      const userPerms = getUserPermissions(user.id);
      if (requestType === 'delete' && canApproveDelete(userPerms)) {
        approverIds.push(user.id);
      } else if (requestType === 'edit' && canApproveEdit(userPerms)) {
        approverIds.push(user.id);
      }
    }

    // Create notifications for all approvers
    if (approverIds.length > 0) {
      await createNotification({
        userId: approverIds,
        type: 'approval_pending',
        title: 'New Approval Request',
        message: `${request.requestedByName || 'A user'} has requested approval to ${requestType} ${entityType} #${entityId}.`,
        entityType: entityType,
        entityId: entityId,
        actionUrl: `/approval-requests`,
      });
    }

    res.status(201).json({
      ...request,
      requestData: request.requestData ? JSON.parse(request.requestData) : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List approval requests
 * Filters by user's permissions and optionally by entityType, status
 */
export const listApprovalRequests = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
    }

    const { entityType, status, requestType, entityId } = req.query;
    const userPermissions = getUserPermissions(userId);

    // Build WHERE conditions
    const conditions = [];
    const params = [];

    // Filter by status (only add condition if status is provided and not 'all')
    if (status && status !== 'all') {
      conditions.push("ar.status = ?");
      params.push(status);
    }
    // If status is 'all' or undefined, don't filter by status (show all)

    // Filter by entityType if provided
    if (entityType) {
      conditions.push("ar.entityType = ?");
      params.push(entityType);
    }

    // Filter by requestType if provided
    if (requestType) {
      conditions.push("ar.requestType = ?");
      params.push(requestType);
    }

    // Filter by entityId if provided
    if (entityId) {
      conditions.push("ar.entityId = ?");
      params.push(Number(entityId));
    }

    // Filter by user permissions
    // User can see:
    // 1. Requests they can approve (if they have approval permissions)
    // 2. Requests they created (requestedBy = userId)
    // 3. Requests for orders they have access to (if entityType is 'order')
    const canApproveDeleteRequests = canApproveDelete(userPermissions);
    const canApproveEditRequests = canApproveEdit(userPermissions);

    const permissionConditions = [];
    
    // Users can always see requests they created
    permissionConditions.push("ar.requestedBy = ?");
    params.push(userId);
    
    // Users with approval permissions can see requests they can approve
    if (canApproveDeleteRequests) {
      permissionConditions.push("ar.requestType = 'delete'");
    }
    if (canApproveEditRequests) {
      permissionConditions.push("ar.requestType = 'edit'");
    }

    // For order requests, also allow users who can view the order (creator, handler)
    // This is handled by checking order access in a subquery
    if (entityType === 'order' && entityId) {
      // If filtering by specific order, allow if user is creator or handler
      permissionConditions.push(`(
        EXISTS (
          SELECT 1 FROM orders o 
          WHERE o.id = ar.entityId 
          AND (o.createdBy = ? OR o.handlerId = ?)
        )
      )`);
      params.push(userId, userId);
    }

    if (permissionConditions.length > 0) {
      conditions.push(`(${permissionConditions.join(' OR ')})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const requests = db.prepare(
      `SELECT ar.*,
              u1.name as requestedByName,
              u2.name as approvedByName,
              u3.name as rejectedByName
       FROM approval_requests ar
       LEFT JOIN users u1 ON u1.id = ar.requestedBy
       LEFT JOIN users u2 ON u2.id = ar.approvedBy
       LEFT JOIN users u3 ON u3.id = ar.rejectedBy
       ${whereClause}
       ORDER BY ar.requestedAt DESC`
    ).all(...params);

    // Parse requestData JSON for each request
    const requestsWithParsedData = requests.map(req => ({
      ...req,
      requestData: req.requestData ? JSON.parse(req.requestData) : null,
    }));

    res.json(requestsWithParsedData);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single approval request with entity details
 */
export const getApprovalRequest = async (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
    }

    const { id } = req.params;
    const userPermissions = getUserPermissions(userId);
    const { getFileUrl } = await import("../utils/fileStorage.js");

    const request = db.prepare(
      `SELECT ar.*,
              u1.name as requestedByName,
              u2.name as approvedByName,
              u3.name as rejectedByName
       FROM approval_requests ar
       LEFT JOIN users u1 ON u1.id = ar.requestedBy
       LEFT JOIN users u2 ON u2.id = ar.approvedBy
       LEFT JOIN users u3 ON u3.id = ar.rejectedBy
       WHERE ar.id = ?`
    ).get(id);

    if (!request) {
      return res.status(404).json({ message: "Approval request not found" });
    }

    // Check if user has permission to view this request
    // Users can view requests they created, or requests they can approve
    const canView = 
      request.requestedBy === userId || // User created the request
      (request.requestType === 'delete' && canApproveDelete(userPermissions)) || // Can approve delete
      (request.requestType === 'edit' && canApproveEdit(userPermissions)); // Can approve edit
    
    // For order requests, also allow if user is creator or handler of the order
    let canViewOrder = false;
    if (request.entityType === 'order') {
      const order = db.prepare("SELECT createdBy, handlerId FROM orders WHERE id = ?").get(request.entityId);
      if (order && (order.createdBy === userId || order.handlerId === userId)) {
        canViewOrder = true;
      }
    }
    
    if (!canView && !canViewOrder) {
      return res.status(403).json({ message: "You don't have permission to view this request" });
    }

    // Use stored original entity data if available, otherwise fetch from database
    // This ensures we always show the original state, even after the entity has been modified
    let entity = null;
    if (request.originalEntityData) {
      // Use the stored original entity data
      entity = JSON.parse(request.originalEntityData);
      
      // For backward compatibility: if originalReceipts/originalPayments are missing,
      // fetch them from database (for old approval requests created before this feature)
      if (request.entityType === 'order' && (!entity.originalReceipts || !entity.originalPayments)) {
        const originalReceipts = db.prepare(
          `SELECT r.*, a.name as accountName 
           FROM order_receipts r
           LEFT JOIN accounts a ON a.id = r.accountId
           WHERE r.orderId = ? AND r.status = 'confirmed'
           ORDER BY r.createdAt ASC;`
        ).all(request.entityId);
        
        const originalPayments = db.prepare(
          `SELECT p.*, a.name as accountName 
           FROM order_payments p
           LEFT JOIN accounts a ON a.id = p.accountId
           WHERE p.orderId = ? AND p.status = 'confirmed'
           ORDER BY p.createdAt ASC;`
        ).all(request.entityId);
        
        // Handle orders with direct account transactions
        // Include imagePath for display purposes
        const { getFileUrl: getFileUrlForBackwardCompat } = await import("../utils/fileStorage.js");
        let receiptsToStore = originalReceipts.map(r => ({
          amount: r.amount,
          accountId: r.accountId,
          accountName: r.accountName,
          imagePath: r.imagePath ? (r.imagePath.startsWith('data:') || r.imagePath.startsWith('/api/uploads/') 
            ? r.imagePath 
            : getFileUrlForBackwardCompat(r.imagePath)) : null,
        }));
        
        let paymentsToStore = originalPayments.map(p => ({
          amount: p.amount,
          accountId: p.accountId,
          accountName: p.accountName,
          imagePath: p.imagePath ? (p.imagePath.startsWith('data:') || p.imagePath.startsWith('/api/uploads/') 
            ? p.imagePath 
            : getFileUrlForBackwardCompat(p.imagePath)) : null,
        }));
        
        if (receiptsToStore.length === 0 && entity.buyAccountId && entity.amountBuy) {
          const buyAccount = db.prepare("SELECT name FROM accounts WHERE id = ?").get(entity.buyAccountId);
          receiptsToStore = [{
            amount: entity.amountBuy,
            accountId: entity.buyAccountId,
            accountName: buyAccount?.name || null,
          }];
        }
        
        if (paymentsToStore.length === 0 && entity.sellAccountId && entity.amountSell) {
          const sellAccount = db.prepare("SELECT name FROM accounts WHERE id = ?").get(entity.sellAccountId);
          paymentsToStore = [{
            amount: entity.amountSell,
            accountId: entity.sellAccountId,
            accountName: sellAccount?.name || null,
          }];
        }
        
        entity.originalReceipts = receiptsToStore;
        entity.originalPayments = paymentsToStore;
      }
      
      // Always fetch receipts, payments, profits, and service charges as arrays for display
      if (request.entityType === 'order') {
        const { getFileUrl } = await import("../utils/fileStorage.js");
        
        // Get all receipts (use originalReceipts if available, otherwise fetch)
        if (!entity.receipts || entity.receipts.length === 0) {
          const receipts = entity.originalReceipts || db.prepare(
            `SELECT r.*, a.name as accountName 
             FROM order_receipts r
             LEFT JOIN accounts a ON a.id = r.accountId
             WHERE r.orderId = ? AND r.status = 'confirmed'
             ORDER BY r.createdAt ASC;`
          ).all(request.entityId);
          // Convert image paths to URLs
          entity.receipts = receipts.map((r) => ({
            ...r,
            imagePath: r.imagePath && !r.imagePath.startsWith('data:') && !r.imagePath.startsWith('/api/uploads/')
              ? getFileUrl(r.imagePath)
              : r.imagePath,
          }));
        } else {
          // Convert image paths to URLs for existing receipts
          entity.receipts = entity.receipts.map((r) => ({
            ...r,
            imagePath: r.imagePath && !r.imagePath.startsWith('data:') && !r.imagePath.startsWith('/api/uploads/')
              ? getFileUrl(r.imagePath)
              : r.imagePath,
          }));
        }
        
        // Ensure originalReceipts have image paths (for backward compatibility with old approval requests)
        // If originalReceipts don't have imagePath, try to get them from entity.receipts or fetch from DB
        if (entity.originalReceipts && entity.originalReceipts.length > 0) {
          // Check if any original receipt is missing imagePath
          const needsImagePaths = entity.originalReceipts.some(r => !r.imagePath);
          if (needsImagePaths) {
            // Try to match with entity.receipts first
            const receiptsWithImages = entity.receipts || [];
            entity.originalReceipts = entity.originalReceipts.map((origR) => {
              if (origR.imagePath) return origR; // Already has image path
              
              // Try to find matching receipt in entity.receipts by amount and accountId
              const matchingReceipt = receiptsWithImages.find(r => 
                Math.abs((r.amount || 0) - (origR.amount || 0)) < 0.01 &&
                (r.accountId || null) === (origR.accountId || null)
              );
              
              if (matchingReceipt && matchingReceipt.imagePath) {
                return { ...origR, imagePath: matchingReceipt.imagePath };
              }
              
              // If not found, fetch from database
              const dbReceipt = db.prepare(
                `SELECT r.imagePath 
                 FROM order_receipts r
                 WHERE r.orderId = ? AND r.accountId = ? AND ABS(r.amount - ?) < 0.01 AND r.status = 'confirmed'
                 ORDER BY r.createdAt ASC
                 LIMIT 1;`
              ).get(request.entityId, origR.accountId, origR.amount);
              
              if (dbReceipt && dbReceipt.imagePath) {
                return {
                  ...origR,
                  imagePath: dbReceipt.imagePath.startsWith('data:') || dbReceipt.imagePath.startsWith('/api/uploads/')
                    ? dbReceipt.imagePath
                    : getFileUrl(dbReceipt.imagePath),
                };
              }
              
              return origR;
            });
          }
        }
        
        // Get all payments (use originalPayments if available, otherwise fetch)
        if (!entity.payments || entity.payments.length === 0) {
          const payments = entity.originalPayments || db.prepare(
            `SELECT p.*, a.name as accountName 
             FROM order_payments p
             LEFT JOIN accounts a ON a.id = p.accountId
             WHERE p.orderId = ? AND p.status = 'confirmed'
             ORDER BY p.createdAt ASC;`
          ).all(request.entityId);
          // Convert image paths to URLs
          entity.payments = payments.map((p) => ({
            ...p,
            imagePath: p.imagePath && !p.imagePath.startsWith('data:') && !p.imagePath.startsWith('/api/uploads/')
              ? getFileUrl(p.imagePath)
              : p.imagePath,
          }));
        } else {
          // Convert image paths to URLs for existing payments
          entity.payments = entity.payments.map((p) => ({
            ...p,
            imagePath: p.imagePath && !p.imagePath.startsWith('data:') && !p.imagePath.startsWith('/api/uploads/')
              ? getFileUrl(p.imagePath)
              : p.imagePath,
          }));
        }
        
        // Ensure originalPayments have image paths (for backward compatibility with old approval requests)
        // If originalPayments don't have imagePath, try to get them from entity.payments or fetch from DB
        if (entity.originalPayments && entity.originalPayments.length > 0) {
          // Check if any original payment is missing imagePath
          const needsImagePaths = entity.originalPayments.some(p => !p.imagePath);
          if (needsImagePaths) {
            // Try to match with entity.payments first
            const paymentsWithImages = entity.payments || [];
            entity.originalPayments = entity.originalPayments.map((origP) => {
              if (origP.imagePath) return origP; // Already has image path
              
              // Try to find matching payment in entity.payments by amount and accountId
              const matchingPayment = paymentsWithImages.find(p => 
                Math.abs((p.amount || 0) - (origP.amount || 0)) < 0.01 &&
                (p.accountId || null) === (origP.accountId || null)
              );
              
              if (matchingPayment && matchingPayment.imagePath) {
                return { ...origP, imagePath: matchingPayment.imagePath };
              }
              
              // If not found, fetch from database
              const dbPayment = db.prepare(
                `SELECT p.imagePath 
                 FROM order_payments p
                 WHERE p.orderId = ? AND p.accountId = ? AND ABS(p.amount - ?) < 0.01 AND p.status = 'confirmed'
                 ORDER BY p.createdAt ASC
                 LIMIT 1;`
              ).get(request.entityId, origP.accountId, origP.amount);
              
              if (dbPayment && dbPayment.imagePath) {
                return {
                  ...origP,
                  imagePath: dbPayment.imagePath.startsWith('data:') || dbPayment.imagePath.startsWith('/api/uploads/')
                    ? dbPayment.imagePath
                    : getFileUrl(dbPayment.imagePath),
                };
              }
              
              return origP;
            });
          }
        }
        
        // Ensure originalPayments have image paths (for backward compatibility with old approval requests)
        // If originalPayments don't have imagePath, try to get them from entity.payments or fetch from DB
        if (entity.originalPayments && entity.originalPayments.length > 0) {
          // Check if any original payment is missing imagePath
          const needsImagePaths = entity.originalPayments.some(p => !p.imagePath);
          if (needsImagePaths) {
            // Try to match with entity.payments first
            const paymentsWithImages = entity.payments || [];
            entity.originalPayments = entity.originalPayments.map((origP) => {
              if (origP.imagePath) return origP; // Already has image path
              
              // Try to find matching payment in entity.payments by amount and accountId
              const matchingPayment = paymentsWithImages.find(p => 
                Math.abs((p.amount || 0) - (origP.amount || 0)) < 0.01 &&
                (p.accountId || null) === (origP.accountId || null)
              );
              
              if (matchingPayment && matchingPayment.imagePath) {
                return { ...origP, imagePath: matchingPayment.imagePath };
              }
              
              // If not found, fetch from database
              const dbPayment = db.prepare(
                `SELECT p.imagePath 
                 FROM order_payments p
                 WHERE p.orderId = ? AND p.accountId = ? AND ABS(p.amount - ?) < 0.01 AND p.status = 'confirmed'
                 ORDER BY p.createdAt ASC
                 LIMIT 1;`
              ).get(request.entityId, origP.accountId, origP.amount);
              
              if (dbPayment && dbPayment.imagePath) {
                return {
                  ...origP,
                  imagePath: dbPayment.imagePath.startsWith('data:') || dbPayment.imagePath.startsWith('/api/uploads/')
                    ? dbPayment.imagePath
                    : getFileUrl(dbPayment.imagePath),
                };
              }
              
              return origP;
            });
          }
        }
        
        // Get all profits (confirmed first, then draft)
        const allProfits = db.prepare(
          `SELECT p.*, a.name as accountName
           FROM order_profits p
           LEFT JOIN accounts a ON a.id = p.accountId
           WHERE p.orderId = ? AND p.status IN ('confirmed', 'draft')
           ORDER BY p.status DESC, p.createdAt DESC;`
        ).all(request.entityId);
        entity.profits = allProfits.map(p => ({
          id: p.id,
          amount: p.amount,
          currencyCode: p.currencyCode,
          accountId: p.accountId,
          accountName: p.accountName,
          status: p.status,
        }));
        
        // Get all service charges (confirmed first, then draft)
        const allServiceCharges = db.prepare(
          `SELECT sc.*, a.name as accountName
           FROM order_service_charges sc
           LEFT JOIN accounts a ON a.id = sc.accountId
           WHERE sc.orderId = ? AND sc.status IN ('confirmed', 'draft')
           ORDER BY sc.status DESC, sc.createdAt DESC;`
        ).all(request.entityId);
        entity.serviceCharges = allServiceCharges.map(sc => ({
          id: sc.id,
          amount: sc.amount,
          currencyCode: sc.currencyCode,
          accountId: sc.accountId,
          accountName: sc.accountName,
          status: sc.status,
        }));
      }
    } else {
      // Fallback: fetch from database (for old requests created before this feature)
      if (request.entityType === 'order') {
        entity = db.prepare(
          `SELECT o.*, 
                  c.name as customerName, 
                  u.name as handlerName,
                  ba.name as buyAccountName,
                  sa.name as sellAccountName,
                  pa.name as profitAccountName,
                  sca.name as serviceChargeAccountName
           FROM orders o
           LEFT JOIN customers c ON c.id = o.customerId
           LEFT JOIN users u ON u.id = o.handlerId
           LEFT JOIN accounts ba ON ba.id = o.buyAccountId
           LEFT JOIN accounts sa ON sa.id = o.sellAccountId
           LEFT JOIN accounts pa ON pa.id = o.profitAccountId
           LEFT JOIN accounts sca ON sca.id = o.serviceChargeAccountId
           WHERE o.id = ?`
        ).get(request.entityId);

        // Get tags for the order
        if (entity) {
          const tags = db.prepare(
            `SELECT t.id, t.name, t.color 
             FROM tags t
             INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
             WHERE ota.orderId = ?
             ORDER BY t.name ASC;`
          ).all(request.entityId);
          entity.tags = tags.length > 0 ? tags : [];
          
          // Get all receipts
          const receipts = db.prepare(
            `SELECT r.*, a.name as accountName 
             FROM order_receipts r
             LEFT JOIN accounts a ON a.id = r.accountId
             WHERE r.orderId = ? AND r.status = 'confirmed'
             ORDER BY r.createdAt ASC;`
          ).all(request.entityId);
          entity.receipts = receipts.map((r) => ({
            ...r,
            imagePath: r.imagePath && !r.imagePath.startsWith('data:') && !r.imagePath.startsWith('/api/uploads/')
              ? getFileUrlFallback(r.imagePath)
              : r.imagePath,
          }));
          entity.originalReceipts = receipts.map(r => ({
            amount: r.amount,
            accountId: r.accountId,
            accountName: r.accountName,
            imagePath: r.imagePath && !r.imagePath.startsWith('data:') && !r.imagePath.startsWith('/api/uploads/')
              ? getFileUrlFallback(r.imagePath)
              : r.imagePath,
          }));
          
          // Get all payments
          const payments = db.prepare(
            `SELECT p.*, a.name as accountName 
             FROM order_payments p
             LEFT JOIN accounts a ON a.id = p.accountId
             WHERE p.orderId = ? AND p.status = 'confirmed'
             ORDER BY p.createdAt ASC;`
          ).all(request.entityId);
          entity.payments = payments.map((p) => ({
            ...p,
            imagePath: p.imagePath && !p.imagePath.startsWith('data:') && !p.imagePath.startsWith('/api/uploads/')
              ? getFileUrlFallback(p.imagePath)
              : p.imagePath,
          }));
          entity.originalPayments = payments.map(p => ({
            amount: p.amount,
            accountId: p.accountId,
            accountName: p.accountName,
            imagePath: p.imagePath && !p.imagePath.startsWith('data:') && !p.imagePath.startsWith('/api/uploads/')
              ? getFileUrlFallback(p.imagePath)
              : p.imagePath,
          }));
          
          // For OTC orders, profit and service charges are stored in separate tables
          // Get all profits (confirmed first, then draft)
          const allProfits = db.prepare(
            `SELECT p.*, a.name as accountName
             FROM order_profits p
             LEFT JOIN accounts a ON a.id = p.accountId
             WHERE p.orderId = ? AND p.status IN ('confirmed', 'draft')
             ORDER BY p.status DESC, p.createdAt DESC;`
          ).all(request.entityId);
          entity.profits = allProfits.map(p => ({
            id: p.id,
            amount: p.amount,
            currencyCode: p.currencyCode,
            accountId: p.accountId,
            accountName: p.accountName,
            status: p.status,
          }));
          
          // Get the first profit for backward compatibility (order-level fields)
          const profit = allProfits.find(p => p.status === 'confirmed') || allProfits[0];
          if (profit) {
            entity.profitAmount = profit.amount;
            entity.profitCurrency = profit.currencyCode;
            entity.profitAccountId = profit.accountId;
            entity.profitAccountName = profit.accountName;
          }
          
          // Get all service charges (confirmed first, then draft)
          const allServiceCharges = db.prepare(
            `SELECT sc.*, a.name as accountName
             FROM order_service_charges sc
             LEFT JOIN accounts a ON a.id = sc.accountId
             WHERE sc.orderId = ? AND sc.status IN ('confirmed', 'draft')
             ORDER BY sc.status DESC, sc.createdAt DESC;`
          ).all(request.entityId);
          entity.serviceCharges = allServiceCharges.map(sc => ({
            id: sc.id,
            amount: sc.amount,
            currencyCode: sc.currencyCode,
            accountId: sc.accountId,
            accountName: sc.accountName,
            status: sc.status,
          }));
          
          // Get the first service charge for backward compatibility (order-level fields)
          const serviceCharge = allServiceCharges.find(sc => sc.status === 'confirmed') || allServiceCharges[0];
          if (serviceCharge) {
            entity.serviceChargeAmount = serviceCharge.amount;
            entity.serviceChargeCurrency = serviceCharge.currencyCode;
            entity.serviceChargeAccountId = serviceCharge.accountId;
            entity.serviceChargeAccountName = serviceCharge.accountName;
          }
        }
      } else if (request.entityType === 'expense') {
        entity = db.prepare(
          `SELECT e.*, a.name as accountName, a.currencyCode, u1.name as createdByName, u2.name as updatedByName
           FROM expenses e
           LEFT JOIN accounts a ON a.id = e.accountId
           LEFT JOIN users u1 ON u1.id = e.createdBy
           LEFT JOIN users u2 ON u2.id = e.updatedBy
           WHERE e.id = ? AND e.deletedAt IS NULL`
        ).get(request.entityId);
      } else if (request.entityType === 'transfer') {
        entity = db.prepare(
          `SELECT t.*, 
                  a1.name as fromAccountName, a1.currencyCode as fromCurrencyCode,
                  a2.name as toAccountName, a2.currencyCode as toCurrencyCode,
                  u1.name as createdByName, u2.name as updatedByName
           FROM internal_transfers t
           LEFT JOIN accounts a1 ON a1.id = t.fromAccountId
           LEFT JOIN accounts a2 ON a2.id = t.toAccountId
           LEFT JOIN users u1 ON u1.id = t.createdBy
           LEFT JOIN users u2 ON u2.id = t.updatedBy
           WHERE t.id = ?`
        ).get(request.entityId);
      }
    }

    // Parse requestData and convert image paths to URLs
    let parsedRequestData = request.requestData ? JSON.parse(request.requestData) : null;
    
    // Convert newImagePath and currentImagePath to URLs for receipts and payments
    if (parsedRequestData) {
      const { getFileUrl } = await import("../utils/fileStorage.js");
      
      if (Array.isArray(parsedRequestData.receipts)) {
        parsedRequestData.receipts = await Promise.all(parsedRequestData.receipts.map(async (receipt) => {
          // Convert newImagePath to URL if it exists and is not already a URL
          if (receipt.newImagePath && !receipt.newImagePath.startsWith('data:') && !receipt.newImagePath.startsWith('/api/uploads/') && !receipt.newImagePath.startsWith('http://') && !receipt.newImagePath.startsWith('https://')) {
            receipt.newImagePath = getFileUrl(receipt.newImagePath);
          }
          
          // Handle currentImagePath - it might already be a URL from frontend, or it might be a relative path
          // First, check if it's already a valid URL
          if (receipt.currentImagePath && 
              (receipt.currentImagePath.startsWith('data:') || 
               receipt.currentImagePath.startsWith('/api/uploads/') || 
               receipt.currentImagePath.startsWith('http://') || 
               receipt.currentImagePath.startsWith('https://'))) {
            // Already a valid URL, keep it as-is
            // No conversion needed
          } else if (receipt.currentImagePath && receipt.currentImagePath !== 'null' && receipt.currentImagePath !== '') {
            // It's a relative path, convert it to a URL
            receipt.currentImagePath = getFileUrl(receipt.currentImagePath);
          } else {
            // currentImagePath is missing or empty, try to fetch it from the database
            // This handles cases where the image wasn't changed but currentImagePath wasn't properly stored
            // Note: We can't match by amount if the amount changed, so we'll try to find any receipt for this account
            // or use the original receipts from the entity
            let dbReceipt = null;
            
            // First, try to match by exact amount and account (in case amount didn't change)
            dbReceipt = db.prepare(
              `SELECT r.imagePath 
               FROM order_receipts r
               WHERE r.orderId = ? AND r.accountId = ? AND ABS(r.amount - ?) < 0.01 AND r.status = 'confirmed'
               ORDER BY r.createdAt ASC
               LIMIT 1;`
            ).get(request.entityId, receipt.accountId, receipt.amount);
            
            // If not found and we have entity with originalReceipts, try to find matching original receipt
            if (!dbReceipt && entity && entity.originalReceipts) {
              const matchingOriginal = entity.originalReceipts.find((orig) => 
                orig.accountId === receipt.accountId
              );
              if (matchingOriginal && matchingOriginal.imagePath) {
                receipt.currentImagePath = matchingOriginal.imagePath;
                dbReceipt = { imagePath: matchingOriginal.imagePath }; // Mark as found
              }
            }
            
            // If still not found, try to get any receipt for this account (as last resort)
            if (!dbReceipt) {
              dbReceipt = db.prepare(
                `SELECT r.imagePath 
                 FROM order_receipts r
                 WHERE r.orderId = ? AND r.accountId = ? AND r.status = 'confirmed'
                 ORDER BY r.createdAt ASC
                 LIMIT 1;`
              ).get(request.entityId, receipt.accountId);
            }
            
            if (dbReceipt && dbReceipt.imagePath) {
              receipt.currentImagePath = dbReceipt.imagePath.startsWith('data:') || dbReceipt.imagePath.startsWith('/api/uploads/')
                ? dbReceipt.imagePath
                : getFileUrl(dbReceipt.imagePath);
            }
          }
          
          // Also ensure imagePath is set from currentImagePath if newImagePath doesn't exist
          // This helps the frontend display the image correctly
          if (!receipt.imagePath) {
            receipt.imagePath = receipt.newImagePath || receipt.currentImagePath || null;
          }
          return receipt;
        }));
      }
      
      if (Array.isArray(parsedRequestData.payments)) {
        parsedRequestData.payments = await Promise.all(parsedRequestData.payments.map(async (payment) => {
          // Convert newImagePath to URL if it exists and is not already a URL
          if (payment.newImagePath && !payment.newImagePath.startsWith('data:') && !payment.newImagePath.startsWith('/api/uploads/') && !payment.newImagePath.startsWith('http://') && !payment.newImagePath.startsWith('https://')) {
            payment.newImagePath = getFileUrl(payment.newImagePath);
          }
          
          // Handle currentImagePath - it might already be a URL from frontend, or it might be a relative path
          // First, check if it's already a valid URL
          if (payment.currentImagePath && 
              (payment.currentImagePath.startsWith('data:') || 
               payment.currentImagePath.startsWith('/api/uploads/') || 
               payment.currentImagePath.startsWith('http://') || 
               payment.currentImagePath.startsWith('https://'))) {
            // Already a valid URL, keep it as-is
            // No conversion needed
          } else if (payment.currentImagePath && payment.currentImagePath !== 'null' && payment.currentImagePath !== '') {
            // It's a relative path, convert it to a URL
            payment.currentImagePath = getFileUrl(payment.currentImagePath);
          } else {
            // currentImagePath is missing or empty, try to fetch it from the database
            // This handles cases where the image wasn't changed but currentImagePath wasn't properly stored
            // Note: We can't match by amount if the amount changed, so we'll try to find any payment for this account
            // or use the original payments from the entity
            let dbPayment = null;
            
            // First, try to match by exact amount and account (in case amount didn't change)
            dbPayment = db.prepare(
              `SELECT p.imagePath 
               FROM order_payments p
               WHERE p.orderId = ? AND p.accountId = ? AND ABS(p.amount - ?) < 0.01 AND p.status = 'confirmed'
               ORDER BY p.createdAt ASC
               LIMIT 1;`
            ).get(request.entityId, payment.accountId, payment.amount);
            
            // If not found and we have entity with originalPayments, try to find matching original payment
            if (!dbPayment && entity && entity.originalPayments) {
              const matchingOriginal = entity.originalPayments.find((orig) => 
                orig.accountId === payment.accountId
              );
              if (matchingOriginal && matchingOriginal.imagePath) {
                payment.currentImagePath = matchingOriginal.imagePath;
                dbPayment = { imagePath: matchingOriginal.imagePath }; // Mark as found
              }
            }
            
            // If still not found, try to get any payment for this account (as last resort)
            if (!dbPayment) {
              dbPayment = db.prepare(
                `SELECT p.imagePath 
                 FROM order_payments p
                 WHERE p.orderId = ? AND p.accountId = ? AND p.status = 'confirmed'
                 ORDER BY p.createdAt ASC
                 LIMIT 1;`
              ).get(request.entityId, payment.accountId);
            }
            
            if (dbPayment && dbPayment.imagePath) {
              payment.currentImagePath = dbPayment.imagePath.startsWith('data:') || dbPayment.imagePath.startsWith('/api/uploads/')
                ? dbPayment.imagePath
                : getFileUrl(dbPayment.imagePath);
            }
          }
          
          // Also ensure imagePath is set from currentImagePath if newImagePath doesn't exist
          // This helps the frontend display the image correctly
          if (!payment.imagePath) {
            payment.imagePath = payment.newImagePath || payment.currentImagePath || null;
          }
          return payment;
        }));
      }
    }

    res.json({
      ...request,
      requestData: parsedRequestData,
      entity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve an approval request
 * Executes the action and notifies the requester
 */
export const approveRequest = async (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
    }

    const { id } = req.params;
    const userPermissions = getUserPermissions(userId);

    // Get the request
    const request = db.prepare(
      "SELECT * FROM approval_requests WHERE id = ? AND status = 'pending'"
    ).get(id);

    if (!request) {
      return res.status(404).json({ message: "Pending approval request not found" });
    }

    // Check permissions
    if (request.requestType === 'delete' && !canApproveDelete(userPermissions)) {
      return res.status(403).json({ message: "You don't have permission to approve delete requests" });
    }
    if (request.requestType === 'edit' && !canApproveEdit(userPermissions)) {
      return res.status(403).json({ message: "You don't have permission to approve edit requests" });
    }

    // For orders, get current status before executing action (to restore if needed)
    let orderStatusBeforeAction = null;
    if (request.entityType === 'order') {
      const order = db.prepare("SELECT status FROM orders WHERE id = ?").get(request.entityId);
      if (order) {
        orderStatusBeforeAction = order.status;
      }
    }

    // Execute the action based on entityType and requestType
    if (request.entityType === 'order') {
      if (request.requestType === 'delete') {
        await executeOrderDelete(request.entityId);
        // Order is deleted, so no status to restore
      } else if (request.requestType === 'edit') {
        const amendedData = JSON.parse(request.requestData);
        await executeOrderEdit(request.entityId, amendedData);
        // Restore order status to completed after edit
        if (orderStatusBeforeAction === 'pending_amend' || orderStatusBeforeAction === 'pending_delete') {
          db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?").run(request.entityId);
        }
      }
    } else if (request.entityType === 'expense') {
      // TODO: Implement expense delete/edit when needed
      return res.status(501).json({ message: "Expense approval not yet implemented" });
    } else if (request.entityType === 'transfer') {
      // TODO: Implement transfer delete/edit when needed
      return res.status(501).json({ message: "Transfer approval not yet implemented" });
    }

    // Update request status
    db.prepare(
      `UPDATE approval_requests 
       SET status = 'approved', approvedBy = ?, approvedAt = ?
       WHERE id = ?`
    ).run(userId, new Date().toISOString(), id);

    // Get requester info and approver name for notification
    const requester = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(request.requestedBy);
    const approver = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);

    // Create notification for the requester
    await createNotification({
      userId: request.requestedBy,
      type: 'approval_approved',
      title: 'Approval Request Approved',
      message: `Your ${request.requestType} request for ${request.entityType} #${request.entityId} has been approved by ${approver?.name || 'Admin'}.`,
      entityType: request.entityType,
      entityId: request.entityId,
      actionUrl: request.entityType === 'order' ? `/orders` : request.entityType === 'expense' ? `/expenses` : `/transfers`,
    });

    res.json({
      success: true,
      message: "Request approved and action executed",
      notificationData: {
        requesterId: request.requestedBy,
        requesterName: requester?.name,
        entityType: request.entityType,
        entityId: request.entityId,
        requestType: request.requestType,
        message: `Your ${request.requestType} request for ${request.entityType} #${request.entityId} has been approved.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject an approval request
 */
export const rejectRequest = async (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
    }

    const { id } = req.params;
    const { reason: rejectionReason } = req.body || {};
    const userPermissions = getUserPermissions(userId);

    // Get the request
    const request = db.prepare(
      "SELECT * FROM approval_requests WHERE id = ? AND status = 'pending'"
    ).get(id);

    if (!request) {
      return res.status(404).json({ message: "Pending approval request not found" });
    }

    // Check permissions
    if (request.requestType === 'delete' && !canApproveDelete(userPermissions)) {
      return res.status(403).json({ message: "You don't have permission to reject delete requests" });
    }
    if (request.requestType === 'edit' && !canApproveEdit(userPermissions)) {
      return res.status(403).json({ message: "You don't have permission to reject edit requests" });
    }

    // Clean up uploaded files if this is an edit request with files
    if (request.requestType === 'edit' && request.requestData) {
      const { deleteFile } = await import("../utils/fileStorage.js");
      try {
        const requestData = JSON.parse(request.requestData);
        
        // Delete receipt files that were uploaded for this request
        if (requestData.receipts && Array.isArray(requestData.receipts)) {
          for (const receipt of requestData.receipts) {
            if (receipt.newImagePath && receipt.newImagePath !== "OTC_NO_IMAGE" && !receipt.newImagePath.startsWith('data:')) {
              try {
                deleteFile(receipt.newImagePath);
              } catch (err) {
                console.error(`Error deleting receipt file ${receipt.newImagePath} on rejection:`, err);
                // Continue even if file deletion fails
              }
            }
          }
        }
        
        // Delete payment files that were uploaded for this request
        if (requestData.payments && Array.isArray(requestData.payments)) {
          for (const payment of requestData.payments) {
            if (payment.newImagePath && payment.newImagePath !== "OTC_NO_IMAGE" && !payment.newImagePath.startsWith('data:')) {
              try {
                deleteFile(payment.newImagePath);
              } catch (err) {
                console.error(`Error deleting payment file ${payment.newImagePath} on rejection:`, err);
                // Continue even if file deletion fails
              }
            }
          }
        }
      } catch (err) {
        console.error("Error parsing requestData or deleting files on rejection:", err);
        // Continue with rejection even if file cleanup fails
      }
    }

    // For orders, restore status to completed when request is rejected
    if (request.entityType === 'order') {
      const order = db.prepare("SELECT status FROM orders WHERE id = ?").get(request.entityId);
      if (order && (order.status === 'pending_amend' || order.status === 'pending_delete')) {
        db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?").run(request.entityId);
      }
    }

    // Update request status
    db.prepare(
      `UPDATE approval_requests 
       SET status = 'rejected', rejectedBy = ?, rejectedAt = ?, reason = ?
       WHERE id = ?`
    ).run(
      userId,
      new Date().toISOString(),
      rejectionReason || request.reason + " (Rejected)",
      id
    );

    // Get requester info and rejecter name for notification
    const requester = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(request.requestedBy);
    const rejecter = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);

    // Create notification for the requester
    await createNotification({
      userId: request.requestedBy,
      type: 'approval_rejected',
      title: 'Approval Request Rejected',
      message: `Your ${request.requestType} request for ${request.entityType} #${request.entityId} has been rejected by ${rejecter?.name || 'Admin'}.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`,
      entityType: request.entityType,
      entityId: request.entityId,
      actionUrl: `/approval-requests`,
    });

    res.json({
      success: true,
      message: "Request rejected",
      notificationData: {
        requesterId: request.requestedBy,
        requesterName: requester?.name,
        entityType: request.entityType,
        entityId: request.entityId,
        requestType: request.requestType,
        message: `Your ${request.requestType} request for ${request.entityType} #${request.entityId} has been rejected.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to execute order deletion
 * This replicates the deleteOrder logic but as a function that can be called from approvals
 */
async function executeOrderDelete(orderId) {
  const order = db.prepare("SELECT id, profitAmount, profitAccountId, serviceChargeAmount, serviceChargeAccountId, buyAccountId, sellAccountId, amountBuy, amountSell, status FROM orders WHERE id = ?").get(orderId);
  if (!order) {
    throw new Error("Order not found");
  }
  
  // Get all confirmed receipts and payments for reversing balances
  const receipts = db.prepare("SELECT accountId, amount, imagePath, status FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").all(orderId);
  const payments = db.prepare("SELECT accountId, amount, imagePath, status FROM order_payments WHERE orderId = ? AND status = 'confirmed';").all(orderId);
  const confirmedProfits = db.prepare("SELECT accountId, amount FROM order_profits WHERE orderId = ? AND status = 'confirmed';").all(orderId);
  const confirmedServiceCharges = db.prepare("SELECT accountId, amount FROM order_service_charges WHERE orderId = ? AND status = 'confirmed';").all(orderId);
  
  const isCompleted = order.status === 'completed';
  const hasDirectTransactions = isCompleted && (order.buyAccountId || order.sellAccountId);
  
  // Get all receipts and payments for file deletion
  const allReceipts = db.prepare("SELECT imagePath FROM order_receipts WHERE orderId = ?;").all(orderId);
  const allPayments = db.prepare("SELECT imagePath FROM order_payments WHERE orderId = ?;").all(orderId);
  
  // Reverse account balances
  receipts.forEach((receipt) => {
    if (receipt.accountId && receipt.amount) {
      db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(receipt.amount, receipt.accountId);
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(receipt.accountId, receipt.amount, `Order #${orderId} - Reversal of receipt from customer (Order deleted)`, new Date().toISOString());
    }
  });
  
  payments.forEach((payment) => {
    if (payment.accountId && payment.amount) {
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(payment.amount, payment.accountId);
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(payment.accountId, payment.amount, `Order #${orderId} - Reversal of payment to customer (Order deleted)`, new Date().toISOString());
    }
  });
  
  // Handle direct transactions for imported/completed orders
  if (hasDirectTransactions) {
    if (order.buyAccountId && order.amountBuy) {
      const hasReceiptReversal = receipts.some(r => r.accountId === order.buyAccountId);
      if (!hasReceiptReversal && !isNaN(order.amountBuy) && order.amountBuy > 0) {
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(order.amountBuy, order.buyAccountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(order.buyAccountId, order.amountBuy, `Order #${orderId} - Reversal of receipt from customer (Order deleted)`, new Date().toISOString());
      }
    }
    if (order.sellAccountId && order.amountSell) {
      const hasPaymentReversal = payments.some(p => p.accountId === order.sellAccountId);
      if (!hasPaymentReversal && !isNaN(order.amountSell) && order.amountSell > 0) {
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(order.amountSell, order.sellAccountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(order.sellAccountId, order.amountSell, `Order #${orderId} - Reversal of payment to customer (Order deleted)`, new Date().toISOString());
      }
    }
  }
  
  // Reverse profit transactions
  const profitReversals = confirmedProfits.length > 0
    ? confirmedProfits
    : (order.profitAmount !== null && order.profitAmount !== undefined && order.profitAccountId
      ? [{ accountId: order.profitAccountId, amount: Number(order.profitAmount) }]
      : []);
  
  profitReversals.forEach((profit) => {
    const profitAmount = Number(profit.amount);
    if (profit.accountId && !isNaN(profitAmount) && profitAmount > 0) {
      db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(profitAmount, profit.accountId);
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(profit.accountId, profitAmount, `Order #${orderId} - Reversal of profit (Order deleted)`, new Date().toISOString());
    }
  });
  
  // Reverse service charge transactions
  const serviceChargeReversals = confirmedServiceCharges.length > 0
    ? confirmedServiceCharges
    : (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined && order.serviceChargeAccountId
      ? [{ accountId: order.serviceChargeAccountId, amount: Number(order.serviceChargeAmount) }]
      : []);
  
  serviceChargeReversals.forEach((serviceCharge) => {
    const serviceChargeAmount = Number(serviceCharge.amount);
    if (serviceCharge.accountId && !isNaN(serviceChargeAmount) && serviceChargeAmount !== 0) {
      if (serviceChargeAmount > 0) {
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(serviceChargeAmount, serviceCharge.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(serviceCharge.accountId, serviceChargeAmount, `Order #${orderId} - Reversal of service charge (Order deleted)`, new Date().toISOString());
      } else {
        const absAmount = Math.abs(serviceChargeAmount);
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(absAmount, serviceCharge.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(serviceCharge.accountId, absAmount, `Order #${orderId} - Reversal of service charge paid by us (Order deleted)`, new Date().toISOString());
      }
    }
  });
  
  // Delete associated files
  const { deleteFile } = await import("../utils/fileStorage.js");
  for (const receipt of allReceipts) {
    if (receipt.imagePath && receipt.imagePath !== "OTC_NO_IMAGE") {
      try {
        deleteFile(receipt.imagePath);
      } catch (err) {
        // Ignore file deletion errors
      }
    }
  }
  for (const payment of allPayments) {
    if (payment.imagePath && payment.imagePath !== "OTC_NO_IMAGE") {
      try {
        deleteFile(payment.imagePath);
      } catch (err) {
        // Ignore file deletion errors
      }
    }
  }
  
  // Delete the order (cascades to receipts, payments, etc.)
  db.prepare("DELETE FROM orders WHERE id = ?;").run(orderId);
}

/**
 * Helper function to execute order edit
 * Applies the amended order data
 */
async function executeOrderEdit(orderId, amendedData) {
  const { deleteFile } = await import("../utils/fileStorage.js");
  // Get current order data to compare changes
  const currentOrder = db.prepare("SELECT id, amountBuy, amountSell, status, sellAccountId, buyAccountId, fromCurrency, toCurrency, profitAmount, profitCurrency, profitAccountId, serviceChargeAmount, serviceChargeCurrency, serviceChargeAccountId FROM orders WHERE id = ?").get(orderId);
  if (!currentOrder) {
    throw new Error("Order not found");
  }
  
  // Check if order was originally completed (status might be pending_amend/pending_delete during approval)
  // We consider it "completed" if it has confirmed profit/service charge entries or if status indicates it was completed
  const hasConfirmedProfit = db.prepare("SELECT id FROM order_profits WHERE orderId = ? AND status = 'confirmed' LIMIT 1;").get(orderId);
  const hasConfirmedServiceCharge = db.prepare("SELECT id FROM order_service_charges WHERE orderId = ? AND status = 'confirmed' LIMIT 1;").get(orderId);
  const isOriginallyCompleted = currentOrder.status === 'completed' || 
                                  currentOrder.status === 'pending_amend' || 
                                  currentOrder.status === 'pending_delete' ||
                                  hasConfirmedProfit ||
                                  hasConfirmedServiceCharge;

  // Filter out fields that shouldn't be updated directly
  const { tagIds, ...orderUpdates } = amendedData;
  const fieldsToUpdate = Object.keys(orderUpdates).filter(key => 
    !['id', 'createdAt', 'tags', 'customerName', 'handlerName', 'buyAccountName', 'sellAccountName'].includes(key)
  );

  // Check if amountSell or amountBuy changed
  const newAmountSell = orderUpdates.amountSell !== undefined ? Number(orderUpdates.amountSell) : currentOrder.amountSell;
  const newAmountBuy = orderUpdates.amountBuy !== undefined ? Number(orderUpdates.amountBuy) : currentOrder.amountBuy;
  const amountSellChanged = newAmountSell !== currentOrder.amountSell;
  const amountBuyChanged = newAmountBuy !== currentOrder.amountBuy;

  // Handle profit and service charge separately (similar to updateOrder)
  // Also extract receipts and payments arrays - these are handled separately
  // Also extract receiptFiles and paymentFiles - these are file uploads, not database fields
  const { profitAmount, profitCurrency, profitAccountId, serviceChargeAmount, serviceChargeCurrency, serviceChargeAccountId, receipts, payments, receiptFiles, paymentFiles, ...otherUpdates } = orderUpdates;
  
  // Remove profit/service charge/receipts/payments/files fields from fieldsToUpdate since they're handled separately
  const fieldsToUpdateFiltered = fieldsToUpdate.filter(key => 
    !['profitAmount', 'profitCurrency', 'profitAccountId', 'serviceChargeAmount', 'serviceChargeCurrency', 'serviceChargeAccountId', 'receipts', 'payments', 'receiptFiles', 'paymentFiles'].includes(key)
  );

  // Normalize image paths from the request payload so we store relative paths in DB
  const normalizeImagePath = (path) => {
    if (!path) return null;
    if (typeof path !== "string") return null;
    if (path.startsWith("data:")) return path; // keep base64 as-is
    
    const uploadsIdx = path.indexOf("/api/uploads/");
    if (uploadsIdx !== -1) {
      return path.substring(uploadsIdx + "/api/uploads/".length).replace(/^\/+/, "");
    }
    
    return path.replace(/^\/+/, "");
  };

  const normalizedReceipts = Array.isArray(receipts)
    ? receipts.map((receipt) => ({
        ...receipt,
        currentImagePath: normalizeImagePath(receipt.currentImagePath),
        newImagePath: normalizeImagePath(receipt.newImagePath),
      }))
    : [];

  const normalizedPayments = Array.isArray(payments)
    ? payments.map((payment) => ({
        ...payment,
        currentImagePath: normalizeImagePath(payment.currentImagePath),
        newImagePath: normalizeImagePath(payment.newImagePath),
      }))
    : [];

  if (fieldsToUpdateFiltered.length === 0 && tagIds === undefined && 
      profitAmount === undefined && profitCurrency === undefined && profitAccountId === undefined &&
      serviceChargeAmount === undefined && serviceChargeCurrency === undefined && serviceChargeAccountId === undefined) {
    return; // No fields to update
  }

  // Build update query (excluding profit/service charge fields)
  const updateValues = {};
  fieldsToUpdateFiltered.forEach(field => {
    const value = otherUpdates[field];
    if (field === "remarks") {
      updateValues[field] = (value === null || value === undefined || value === "" || (typeof value === "string" && value.trim() === "")) ? null : String(value);
    } else if (value === null || value === "" || (typeof value === "string" && value.trim() === "")) {
      updateValues[field] = null;
    } else if (field === "buyAccountId" || field === "sellAccountId" || field === "handlerId" || field === "customerId") {
      updateValues[field] = value === "" ? null : (value ? Number(value) : null);
    } else if (field === "isFlexOrder") {
      updateValues[field] = value ? 1 : 0;
    } else {
      updateValues[field] = value;
    }
  });

  // Also update order table fields for profit/service charges (for display in orders table)
  if (profitAmount !== undefined || profitCurrency !== undefined || profitAccountId !== undefined) {
    updateValues.profitAmount = profitAmount !== undefined ? (profitAmount !== null ? Number(profitAmount) : null) : currentOrder.profitAmount;
    updateValues.profitCurrency = profitCurrency !== undefined ? profitCurrency : currentOrder.profitCurrency;
    updateValues.profitAccountId = profitAccountId !== undefined ? (profitAccountId ? Number(profitAccountId) : null) : currentOrder.profitAccountId;
  }
  if (serviceChargeAmount !== undefined || serviceChargeCurrency !== undefined || serviceChargeAccountId !== undefined) {
    updateValues.serviceChargeAmount = serviceChargeAmount !== undefined ? (serviceChargeAmount !== null ? Number(serviceChargeAmount) : null) : currentOrder.serviceChargeAmount;
    updateValues.serviceChargeCurrency = serviceChargeCurrency !== undefined ? serviceChargeCurrency : currentOrder.serviceChargeCurrency;
    updateValues.serviceChargeAccountId = serviceChargeAccountId !== undefined ? (serviceChargeAccountId ? Number(serviceChargeAccountId) : null) : currentOrder.serviceChargeAccountId;
  }

  updateValues.id = orderId;

  const assignments = Object.keys(updateValues).filter(key => key !== 'id').map((field) => `${field} = @${field}`).join(", ");
  if (assignments) {
    db.prepare(`UPDATE orders SET ${assignments} WHERE id = @id;`).run(updateValues);
  }

  // Handle profit updates
  if (profitAmount !== undefined || profitCurrency !== undefined || profitAccountId !== undefined) {
    if (isOriginallyCompleted) {
      // For completed orders: delete all old confirmed profit entries and create new one
      // First, reverse all existing confirmed profit transactions
      const allConfirmedProfits = db.prepare(
        "SELECT * FROM order_profits WHERE orderId = ? AND status = 'confirmed';"
      ).all(orderId);
      
      // Reverse all old profit transactions
      for (const oldProfit of allConfirmedProfits) {
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(oldProfit.amount, oldProfit.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          oldProfit.accountId,
          oldProfit.amount,
          `Order #${orderId} - Reversal of profit (Order amended)`,
          new Date().toISOString()
        );
      }
      
      // Delete all old confirmed profit entries
      db.prepare("DELETE FROM order_profits WHERE orderId = ? AND status = 'confirmed';").run(orderId);
      
      // Get the most recent confirmed profit for reference (if any existed)
      const confirmedProfits = allConfirmedProfits.length > 0 ? allConfirmedProfits[0] : null;

      // Create new confirmed profit entry if provided
      if (profitAmount !== null && profitAmount !== undefined && profitCurrency && profitAccountId) {
        // No confirmed profit exists, create new one
        const amount = Number(profitAmount);
        if (!isNaN(amount) && amount > 0) {
          db.prepare(
            `INSERT INTO order_profits (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, 'confirmed', ?);`
          ).run(orderId, amount, profitCurrency, profitAccountId, new Date().toISOString());

          // Update account balance
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(amount, profitAccountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            profitAccountId,
            amount,
            `Order #${orderId} - Profit (Amended)`,
            new Date().toISOString()
          );
        }
      }
    } else {
      // For pending orders: create/update draft profit entries
      db.prepare("DELETE FROM order_profits WHERE orderId = ? AND status = 'draft';").run(orderId);
      
      if (profitAmount !== null && profitAmount !== undefined && profitCurrency && profitAccountId) {
        const amount = Number(profitAmount);
        if (!isNaN(amount) && amount > 0) {
          db.prepare(
            `INSERT INTO order_profits (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, 'draft', ?);`
          ).run(orderId, amount, profitCurrency, profitAccountId, new Date().toISOString());
        }
      }
    }
  }

  // Handle service charge updates
  if (serviceChargeAmount !== undefined || serviceChargeCurrency !== undefined || serviceChargeAccountId !== undefined) {
    if (isOriginallyCompleted) {
      // For completed orders: delete all old confirmed service charge entries and create new one
      // First, reverse all existing confirmed service charge transactions
      const allConfirmedServiceCharges = db.prepare(
        "SELECT * FROM order_service_charges WHERE orderId = ? AND status = 'confirmed';"
      ).all(orderId);
      
      // Reverse all old service charge transactions
      for (const oldServiceCharge of allConfirmedServiceCharges) {
        const oldAmount = Number(oldServiceCharge.amount);
        if (oldAmount > 0) {
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(oldAmount, oldServiceCharge.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            oldServiceCharge.accountId,
            oldAmount,
            `Order #${orderId} - Reversal of service charge (Order amended)`,
            new Date().toISOString()
          );
        } else {
          const absOldAmount = Math.abs(oldAmount);
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(absOldAmount, oldServiceCharge.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            oldServiceCharge.accountId,
            absOldAmount,
            `Order #${orderId} - Reversal of service charge paid by us (Order amended)`,
            new Date().toISOString()
          );
        }
      }
      
      // Delete all old confirmed service charge entries
      db.prepare("DELETE FROM order_service_charges WHERE orderId = ? AND status = 'confirmed';").run(orderId);
      
      // Get the most recent confirmed service charge for reference (if any existed)
      const confirmedServiceCharge = allConfirmedServiceCharges.length > 0 ? allConfirmedServiceCharges[0] : null;

      // Create new confirmed service charge entry if provided
      if (serviceChargeAmount !== null && serviceChargeAmount !== undefined && serviceChargeCurrency && serviceChargeAccountId) {
        // No confirmed service charge exists, create new one
        const amount = Number(serviceChargeAmount);
        if (!isNaN(amount) && amount !== 0) {
          db.prepare(
            `INSERT INTO order_service_charges (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, 'confirmed', ?);`
          ).run(orderId, amount, serviceChargeCurrency, serviceChargeAccountId, new Date().toISOString());

          // Update account balance
          if (amount > 0) {
            db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(amount, serviceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'add', ?, ?, ?);`
            ).run(
              serviceChargeAccountId,
              amount,
              `Order #${orderId} - Service charge (Amended)`,
              new Date().toISOString()
            );
          } else {
            const absAmount = Math.abs(amount);
            db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(absAmount, serviceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'withdraw', ?, ?, ?);`
            ).run(
              serviceChargeAccountId,
              absAmount,
              `Order #${orderId} - Service charge paid by us (Amended)`,
              new Date().toISOString()
            );
          }
        }
      }
    } else {
      // For pending orders: create/update draft service charge entries
      db.prepare("DELETE FROM order_service_charges WHERE orderId = ? AND status = 'draft';").run(orderId);
      
      if (serviceChargeAmount !== null && serviceChargeAmount !== undefined && serviceChargeCurrency && serviceChargeAccountId) {
        const amount = Number(serviceChargeAmount);
        if (!isNaN(amount) && amount !== 0) {
          db.prepare(
            `INSERT INTO order_service_charges (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, 'draft', ?);`
          ).run(orderId, amount, serviceChargeCurrency, serviceChargeAccountId, new Date().toISOString());
        }
      }
    }
  }

  // Handle tag assignments if provided
  if (tagIds !== undefined) {
    db.prepare("DELETE FROM order_tag_assignments WHERE orderId = ?;").run(orderId);
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const tagAssignmentStmt = db.prepare("INSERT INTO order_tag_assignments (orderId, tagId) VALUES (?, ?);");
      const insertTagAssignments = db.transaction((tags) => {
        for (const tagId of tags) {
          if (typeof tagId === 'number' && tagId > 0) {
            try {
              tagAssignmentStmt.run(orderId, tagId);
            } catch (err) {
              // Ignore duplicate or invalid tag assignments
            }
          }
        }
      });
      insertTagAssignments(tagIds);
    }
  }

  // Handle receipts array if provided (for completed orders)
  if (isOriginallyCompleted && Array.isArray(normalizedReceipts) && normalizedReceipts.length > 0) {
    // Get all existing confirmed receipts
    const allConfirmedReceipts = db.prepare(
      "SELECT * FROM order_receipts WHERE orderId = ? AND status = 'confirmed';"
    ).all(orderId);
    
    // If the amended data reuses existing images (no new upload), avoid deleting them
    const receiptImagesToRetain = new Set(
      normalizedReceipts
        .filter(r => !r.newImagePath && r.currentImagePath)
        .map(r => r.currentImagePath)
    );

    // Reverse all old receipt transactions and delete old images
    for (const oldReceipt of allConfirmedReceipts) {
      if (oldReceipt.accountId && oldReceipt.amount) {
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(oldReceipt.amount, oldReceipt.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          oldReceipt.accountId,
          oldReceipt.amount,
          `Order #${orderId} - Reversal of receipt (Order amended)`,
          new Date().toISOString()
        );
      }
      
      // Delete old image file only when it's not being reused by the amended data
      const normalizedOldImagePath = normalizeImagePath(oldReceipt.imagePath);
      if (normalizedOldImagePath && normalizedOldImagePath !== "OTC_NO_IMAGE" && !normalizedOldImagePath.startsWith('data:') && !receiptImagesToRetain.has(normalizedOldImagePath)) {
        try {
          deleteFile(normalizedOldImagePath);
        } catch (err) {
          console.error(`Error deleting receipt image ${normalizedOldImagePath}:`, err);
        }
      }
    }
    
    // Delete all old confirmed receipts
    db.prepare("DELETE FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").run(orderId);
    
    // Create new confirmed receipts from the array
    for (const receipt of normalizedReceipts) {
      if (receipt.amount > 0 && receipt.accountId) {
        const amount = Number(receipt.amount);
        const accountId = Number(receipt.accountId);
        if (!isNaN(amount) && amount > 0 && accountId) {
          // Use new image path if provided, otherwise use current image path, otherwise use placeholder
          const imagePath = receipt.newImagePath || receipt.currentImagePath || "OTC_NO_IMAGE";
          
          db.prepare(
            `INSERT INTO order_receipts (orderId, amount, accountId, status, imagePath, createdAt)
             VALUES (?, ?, ?, 'confirmed', ?, ?);`
          ).run(orderId, amount, accountId, imagePath, new Date().toISOString());
          
          // Update account balance and create transaction
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(amount, accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            accountId,
            amount,
            `Order #${orderId} - Receipt from customer (Amended)`,
            new Date().toISOString()
          );
        }
      }
    }
  }

  // Handle payments array if provided (for completed orders)
  if (isOriginallyCompleted && Array.isArray(normalizedPayments) && normalizedPayments.length > 0) {
    // Get all existing confirmed payments
    const allConfirmedPayments = db.prepare(
      "SELECT * FROM order_payments WHERE orderId = ? AND status = 'confirmed';"
    ).all(orderId);
    
    // If the amended data reuses existing images (no new upload), avoid deleting them
    const paymentImagesToRetain = new Set(
      normalizedPayments
        .filter(p => !p.newImagePath && p.currentImagePath)
        .map(p => p.currentImagePath)
    );

    // Reverse all old payment transactions and delete old images
    for (const oldPayment of allConfirmedPayments) {
      if (oldPayment.accountId && oldPayment.amount) {
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(oldPayment.amount, oldPayment.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          oldPayment.accountId,
          oldPayment.amount,
          `Order #${orderId} - Reversal of payment (Order amended)`,
          new Date().toISOString()
        );
      }
      
      // Delete old image file only when it's not being reused by the amended data
      const normalizedOldImagePath = normalizeImagePath(oldPayment.imagePath);
      if (normalizedOldImagePath && normalizedOldImagePath !== "OTC_NO_IMAGE" && !normalizedOldImagePath.startsWith('data:') && !paymentImagesToRetain.has(normalizedOldImagePath)) {
        try {
          deleteFile(normalizedOldImagePath);
        } catch (err) {
          console.error(`Error deleting payment image ${normalizedOldImagePath}:`, err);
        }
      }
    }
    
    // Delete all old confirmed payments
    db.prepare("DELETE FROM order_payments WHERE orderId = ? AND status = 'confirmed';").run(orderId);
    
    // Create new confirmed payments from the array
    for (const payment of normalizedPayments) {
      if (payment.amount > 0 && payment.accountId) {
        const amount = Number(payment.amount);
        const accountId = Number(payment.accountId);
        if (!isNaN(amount) && amount > 0 && accountId) {
          // Use new image path if provided, otherwise use current image path, otherwise use placeholder
          const imagePath = payment.newImagePath || payment.currentImagePath || "OTC_NO_IMAGE";
          
          db.prepare(
            `INSERT INTO order_payments (orderId, amount, accountId, status, imagePath, createdAt)
             VALUES (?, ?, ?, 'confirmed', ?, ?);`
          ).run(orderId, amount, accountId, imagePath, new Date().toISOString());
          
          // Update account balance and create transaction
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(amount, accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            accountId,
            amount,
            `Order #${orderId} - Payment to customer (Amended)`,
            new Date().toISOString()
          );
        }
      }
    }
  }

  // If order was originally completed and amountSell changed, update confirmed payments and transactions
  // (Only if payments array was not explicitly provided)
  if (isOriginallyCompleted && amountSellChanged && currentOrder.sellAccountId && (!Array.isArray(normalizedPayments) || normalizedPayments.length === 0)) {
    // Get all confirmed payments for this order
    const confirmedPayments = db.prepare(
      "SELECT * FROM order_payments WHERE orderId = ? AND status = 'confirmed' ORDER BY createdAt ASC;"
    ).all(orderId);

    if (confirmedPayments.length > 0) {
      const oldTotalPayment = confirmedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const paymentDifference = newAmountSell - oldTotalPayment;

      // Update each payment proportionally or update the first payment to match the new total
      if (confirmedPayments.length === 1) {
        // Single payment: update it to match new amountSell
        const payment = confirmedPayments[0];
        const oldAmount = Number(payment.amount);
        const newAmount = newAmountSell;

        // Update payment amount
        db.prepare("UPDATE order_payments SET amount = ? WHERE id = ?;").run(newAmount, payment.id);

        // Reverse old transaction
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(oldAmount, payment.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          payment.accountId,
          oldAmount,
          `Order #${orderId} - Reversal of payment (Order amended)`,
          new Date().toISOString()
        );

        // Create new transaction with updated amount
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(newAmount, payment.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          payment.accountId,
          newAmount,
          `Order #${orderId} - Payment to customer (Amended)`,
          new Date().toISOString()
        );
      } else {
        // Multiple payments: update proportionally
        // For simplicity, update the first payment with the difference
        const firstPayment = confirmedPayments[0];
        const oldFirstAmount = Number(firstPayment.amount);
        const newFirstAmount = oldFirstAmount + paymentDifference;

        if (newFirstAmount > 0) {
          // Update first payment
          db.prepare("UPDATE order_payments SET amount = ? WHERE id = ?;").run(newFirstAmount, firstPayment.id);

          // Reverse old transaction for first payment
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(oldFirstAmount, firstPayment.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            firstPayment.accountId,
            oldFirstAmount,
            `Order #${orderId} - Reversal of payment (Order amended)`,
            new Date().toISOString()
          );

          // Create new transaction with updated amount
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(newFirstAmount, firstPayment.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            firstPayment.accountId,
            newFirstAmount,
            `Order #${orderId} - Payment to customer (Amended)`,
            new Date().toISOString()
          );
        }
      }
    }
  }

  // If order was originally completed and amountBuy changed, update confirmed receipts and transactions
  // (Only if receipts array was not explicitly provided)
  if (isOriginallyCompleted && amountBuyChanged && currentOrder.buyAccountId && (!Array.isArray(receipts) || receipts.length === 0)) {
    // Get all confirmed receipts for this order
    const confirmedReceipts = db.prepare(
      "SELECT * FROM order_receipts WHERE orderId = ? AND status = 'confirmed' ORDER BY createdAt ASC;"
    ).all(orderId);

    if (confirmedReceipts.length > 0) {
      const oldTotalReceipt = confirmedReceipts.reduce((sum, r) => sum + Number(r.amount), 0);
      const receiptDifference = newAmountBuy - oldTotalReceipt;

      // Update each receipt proportionally or update the first receipt to match the new total
      if (confirmedReceipts.length === 1) {
        // Single receipt: update it to match new amountBuy
        const receipt = confirmedReceipts[0];
        const oldAmount = Number(receipt.amount);
        const newAmount = newAmountBuy;

        // Update receipt amount
        db.prepare("UPDATE order_receipts SET amount = ? WHERE id = ?;").run(newAmount, receipt.id);

        // Reverse old transaction
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(oldAmount, receipt.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          receipt.accountId,
          oldAmount,
          `Order #${orderId} - Reversal of receipt (Order amended)`,
          new Date().toISOString()
        );

        // Create new transaction with updated amount
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(newAmount, receipt.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          receipt.accountId,
          newAmount,
          `Order #${orderId} - Receipt from customer (Amended)`,
          new Date().toISOString()
        );
      } else {
        // Multiple receipts: update proportionally
        // For simplicity, update the first receipt with the difference
        const firstReceipt = confirmedReceipts[0];
        const oldFirstAmount = Number(firstReceipt.amount);
        const newFirstAmount = oldFirstAmount + receiptDifference;

        if (newFirstAmount > 0) {
          // Update first receipt
          db.prepare("UPDATE order_receipts SET amount = ? WHERE id = ?;").run(newFirstAmount, firstReceipt.id);

          // Reverse old transaction for first receipt
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(oldFirstAmount, firstReceipt.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            firstReceipt.accountId,
            oldFirstAmount,
            `Order #${orderId} - Reversal of receipt (Order amended)`,
            new Date().toISOString()
          );

          // Create new transaction with updated amount
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(newFirstAmount, firstReceipt.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            firstReceipt.accountId,
            newFirstAmount,
            `Order #${orderId} - Receipt from customer (Amended)`,
            new Date().toISOString()
          );
        }
      }
    }
  }
}
