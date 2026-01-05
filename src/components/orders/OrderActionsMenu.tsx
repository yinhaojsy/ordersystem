import React from "react";
import type { Order } from "../../types";

interface OrderActionsMenuProps {
  order: Order;
  isOpen: boolean;
  menuPositionAbove: boolean;
  onEdit: (orderId: number) => void;
  onProcess: (orderId: number) => void;
  onView: (orderId: number) => void;
  onCancel: (orderId: number) => void;
  onDelete: (orderId: number) => void;
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
  onEdit,
  onProcess,
  onView,
  onCancel,
  onDelete,
  canCancelOrder,
  canDeleteOrder,
  isDeleting,
  t,
}: OrderActionsMenuProps) {
  if (!isOpen) return null;

  const buttons: React.ReactElement[] = [];
  
  if (order.status === "pending") {
    buttons.push(
      <button
        key="edit"
        className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-slate-50 first:rounded-t-lg"
        onClick={() => onEdit(order.id)}
      >
        {t("common.edit")}
      </button>
    );
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
      // Show View button for regular orders under process
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

  if (order.status === "completed" || order.status === "cancelled") {
    // For OTC orders, show Edit button to open OTC modal (even for completed/cancelled, but it should be view-only in modal)
    if (order.orderType === "otc") {
      buttons.push(
        <button
          key="edit"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => onEdit(order.id)}
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
  }

  // Don't show Cancel button for completed or cancelled orders or when role lacks permission
  if (canCancelOrder && order.status !== "completed" && order.status !== "cancelled") {
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

  if (canDeleteOrder) {
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

