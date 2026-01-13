import { db } from "../db.js";

/**
 * Check if user is admin (has all permissions or admin role)
 * @param {Object} userPermissions - User's permissions object
 * @returns {boolean}
 */
export function isAdmin(userPermissions) {
  if (!userPermissions || !userPermissions.actions) {
    return false;
  }
  
  // Check if user has all sections (admin typically has all sections)
  // Or check for a specific admin flag if you have one
  // For now, we'll check if they have deleteOrder permission which only admins have
  return userPermissions.actions.deleteOrder === true;
}

/**
 * Get user's permissions from database
 * @param {number} userId - User ID
 * @returns {Object|null} - Permissions object or null
 */
export function getUserPermissions(userId) {
  if (!userId) {
    return null;
  }
  
  const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId);
  if (!user || !user.role) {
    return null;
  }
  
  const roleRow = db.prepare("SELECT permissions FROM roles WHERE name = ?").get(user.role);
  if (!roleRow || !roleRow.permissions) {
    return { sections: [], actions: {} };
  }
  
  try {
    return JSON.parse(roleRow.permissions);
  } catch (e) {
    return { sections: [], actions: {} };
  }
}

/**
 * Check if user can modify an order (is creator or handler)
 * @param {Object} order - Order object with createdBy and handlerId
 * @param {number} userId - User ID to check
 * @returns {boolean}
 */
export function canModifyOrder(order, userId) {
  if (!order || !userId) {
    return false;
  }
  
  return order.createdBy === userId || order.handlerId === userId;
}

/**
 * Check if user can approve delete requests
 * @param {Object} userPermissions - User's permissions object
 * @returns {boolean}
 */
export function canApproveDelete(userPermissions) {
  if (!userPermissions || !userPermissions.actions) {
    return false;
  }
  return userPermissions.actions.approveOrderDelete === true;
}

/**
 * Check if user can approve edit requests
 * @param {Object} userPermissions - User's permissions object
 * @returns {boolean}
 */
export function canApproveEdit(userPermissions) {
  if (!userPermissions || !userPermissions.actions) {
    return false;
  }
  return userPermissions.actions.approveOrderEdit === true;
}

/**
 * Check if user can request delete for an order
 * @param {Object} order - Order object with createdBy and handlerId
 * @param {number} userId - User ID
 * @param {Object} userPermissions - User's permissions object
 * @returns {boolean}
 */
export function canRequestDelete(order, userId, userPermissions) {
  if (!userPermissions || !userPermissions.actions) {
    return false;
  }
  // Must have requestOrderDelete permission
  if (!userPermissions.actions.requestOrderDelete) {
    return false;
  }
  // Must be creator or handler of the order, or admin
  if (isAdmin(userPermissions)) {
    return true;
  }
  return canModifyOrder(order, userId);
}

/**
 * Check if user can request edit for an order
 * @param {Object} order - Order object with createdBy and handlerId
 * @param {number} userId - User ID
 * @param {Object} userPermissions - User's permissions object
 * @returns {boolean}
 */
export function canRequestEdit(order, userId, userPermissions) {
  if (!userPermissions || !userPermissions.actions) {
    return false;
  }
  // Must have requestOrderEdit permission
  if (!userPermissions.actions.requestOrderEdit) {
    return false;
  }
  // Must be creator or handler of the order, or admin
  if (isAdmin(userPermissions)) {
    return true;
  }
  return canModifyOrder(order, userId);
}
