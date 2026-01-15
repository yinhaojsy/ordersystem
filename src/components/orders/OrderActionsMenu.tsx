import React from "react";
import type { Order, AuthResponse } from "../../types";
import { isAdmin, canModifyOrder, canRequestDelete, canRequestEdit } from "../../utils/orderPermissions";

interface OrderActionsMenuProps {
  order: Order;
  isOpen: boolean;
  menuPositionAbove: boolean;
  authUser: AuthResponse | null;
  onEdit: (orderId: number) => void;
  onProcess: (orderId: number) => void;
  onView: (orderId: number) => void;
  onCancel: (orderId: number) => void;
  onDelete: (orderId: number) => void;
  onRequestDelete?: (orderId: number) => void;
  onRequestEdit?: (orderId: number) => void;
  canCancelOrder: boolean;
  canDeleteOrder: boolean;
  isDeleting: boolean;
  t: (key: string) => string;
}

/**
 * Action buttons menu for an order row
 */
export function OrderActionsMenu({
  order,
  isOpen,
  menuPositionAbove,
  authUser,
  onEdit,
  onProcess,
  onView,
  onCancel,
  onDelete,
  onRequestDelete,
  onRequestEdit,
  canCancelOrder,
  canDeleteOrder,
  isDeleting,
  t,
}: OrderActionsMenuProps) {
  if (!isOpen) return null;

  const buttons: React.ReactElement[] = [];
  const userIsAdmin = isAdmin(authUser);
  const userCanModify = canModifyOrder(order, authUser);
  const userCanRequestDelete = canRequestDelete(order, authUser);
  const userCanRequestEdit = canRequestEdit(order, authUser);
  
  if (order.status === "pending") {
    // For pending orders, show edit button if user can modify
    if (userIsAdmin || userCanModify) {
      buttons.push(
        <button
          key="edit"
          className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => onEdit(order.id)}
        >
          {t("common.edit")}
        </button>
      );
    } else if (order.orderType === "otc") {
      // For pending OTC orders, show view button if user cannot modify
      // This allows other users to see the order details in read-only mode
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => onEdit(order.id)}
        >
          {t("orders.view")}
        </button>
      );
    }
    // Don't show Process button for OTC orders - they already have a handler and can be edited directly
    // Process button is only for regular online orders that need handler assignment
    if (order.orderType !== "otc") {
      buttons.push(
        <button
          key="process"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50"
          onClick={() => onProcess(order.id)}
        >
          {t("orders.process")}
        </button>
      );
    }
  }

  if (order.status === "under_process") {
    // For OTC orders, show Edit button to open OTC modal
    if (order.orderType === "otc") {
      buttons.push(
        <button
          key="edit"
          className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => onEdit(order.id)}
        >
          {t("common.edit")}
        </button>
      );
    } else {
      // Show View button for regular orders under process (editing is restricted for under_process orders)
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => onView(order.id)}
        >
          {t("orders.view")}
        </button>
      );
    }
  }

  if (order.status === "completed" || order.status === "cancelled" || order.status === "pending_amend" || order.status === "pending_delete") {
    // For OTC orders with pending_amend/pending_delete, use onView to show OrderChangesModal
    // For completed/cancelled OTC orders, use onEdit to show OtcOrderModal (view-only)
    if (order.orderType === "otc") {
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => {
            // For pending_amend/pending_delete, show OrderChangesModal via onView
            // For completed/cancelled, show OtcOrderModal via onEdit
            if (order.status === "pending_amend" || order.status === "pending_delete") {
              onView(order.id);
            } else {
              onEdit(order.id);
            }
          }}
        >
          {t("orders.view")}
        </button>
      );
    } else {
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => onView(order.id)}
        >
          {t("orders.view")}
        </button>
      );
    }

    // For completed orders (not pending_amend or pending_delete), show Request Edit button if user can request edit
    if (order.status === "completed" && onRequestEdit && userCanRequestEdit) {
      buttons.push(
        <button
          key="request-edit"
          className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-slate-50"
          onClick={() => onRequestEdit(order.id)}
        >
          {userIsAdmin ? t("orders.requestEdit") || "Request Edit" : t("orders.requestEdit") || "Request Edit"}
        </button>
      );
    }
  }

  // Don't show Cancel button for completed, cancelled, or pending approval orders
  // Only creator, handler, or admin can cancel orders
  if (canCancelOrder && order.status !== "completed" && order.status !== "cancelled" && order.status !== "pending_amend" && order.status !== "pending_delete") {
    // Check if user can perform actions (is admin, creator, or handler)
    if (userIsAdmin || userCanModify) {
      buttons.push(
        <button
          key="cancel"
          className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-slate-50"
          onClick={() => onCancel(order.id)}
        >
          {t("orders.cancel")}
        </button>
      );
    }
  }

  // Delete button - show based on permissions
  if (canDeleteOrder && userIsAdmin) {
    // Admin can delete directly
    buttons.push(
      <button
        key="delete"
        className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 last:rounded-b-lg border-t border-slate-200"
        onClick={() => onDelete(order.id)}
        disabled={isDeleting}
      >
        {isDeleting ? t("common.deleting") : t("orders.delete")}
      </button>
    );
  }
  
  // Show Request Delete button for completed orders (not pending_amend or pending_delete) if user can request
  if (onRequestDelete && userCanRequestDelete && order.status === "completed") {
    buttons.push(
      <button
        key="request-delete"
        className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-slate-50 last:rounded-b-lg border-t border-slate-200"
        onClick={() => onRequestDelete(order.id)}
      >
        {t("orders.requestDelete") || "Request Delete"}
      </button>
    );
  }

  return (
    <div 
      className={`absolute right-0 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] ${
        menuPositionAbove ? 'bottom-full mb-1' : 'top-0'
      }`}
    >
      {buttons}
    </div>
  );
}

