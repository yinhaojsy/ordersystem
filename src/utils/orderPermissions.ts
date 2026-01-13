import type { Order, AuthResponse } from "../types";
import { hasActionPermission } from "./permissions";

/**
 * Check if user is admin
 */
export function isAdmin(user: AuthResponse | null): boolean {
  if (!user) return false;
  // Admin typically has deleteOrder permission
  return hasActionPermission(user, "deleteOrder");
}

/**
 * Check if user can modify an order (is creator or handler)
 */
export function canModifyOrder(order: Order, user: AuthResponse | null): boolean {
  if (!order || !user) {
    return false;
  }
  
  // Handle type conversion for comparison (both should be numbers)
  const createdBy = order.createdBy !== null && order.createdBy !== undefined ? Number(order.createdBy) : null;
  const handlerId = order.handlerId !== null && order.handlerId !== undefined ? Number(order.handlerId) : null;
  const userId = Number(user.id);
  
  return createdBy === userId || handlerId === userId;
}

/**
 * Check if user can request delete for an order
 */
export function canRequestDelete(order: Order, user: AuthResponse | null): boolean {
  if (!user) return false;
  // Must have requestOrderDelete permission
  if (!hasActionPermission(user, "requestOrderDelete")) return false;
  // Must be creator or handler of the order, or admin
  if (isAdmin(user)) return true;
  return canModifyOrder(order, user);
}

/**
 * Check if user can request edit for an order
 */
export function canRequestEdit(order: Order, user: AuthResponse | null): boolean {
  if (!user) return false;
  // Must have requestOrderEdit permission
  if (!hasActionPermission(user, "requestOrderEdit")) return false;
  // Must be creator or handler of the order, or admin
  if (isAdmin(user)) return true;
  return canModifyOrder(order, user);
}

/**
 * Check if user can approve delete requests
 */
export function canApproveDelete(user: AuthResponse | null): boolean {
  if (!user) return false;
  return hasActionPermission(user, "approveOrderDelete");
}

/**
 * Check if user can approve edit requests
 */
export function canApproveEdit(user: AuthResponse | null): boolean {
  if (!user) return false;
  return hasActionPermission(user, "approveOrderEdit");
}

/**
 * Check if user can perform actions on an order (add receipts, payments, profit, service charges, complete)
 */
export function canPerformOrderActions(order: Order, user: AuthResponse | null): boolean {
  if (!user || !order) return false;
  // Admin can always perform actions
  if (isAdmin(user)) return true;
  // Creator or handler can perform actions
  return canModifyOrder(order, user);
}
