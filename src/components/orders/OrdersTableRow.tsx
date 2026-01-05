import React from "react";
import type { Order } from "../../types";
import { renderOrderCell } from "./OrdersTableColumns";
import { OrderActionsMenu } from "./OrderActionsMenu";
import type { Account } from "../../types";
import type { OrderStatus } from "../../types";

interface OrdersTableRowProps {
  order: Order;
  columnOrder: string[];
  visibleColumns: Set<string>;
  accounts: Account[];
  getStatusTone: (status: OrderStatus) => "amber" | "blue" | "emerald" | "rose" | "slate";
  // Selection
  showCheckbox: boolean;
  isSelected: boolean;
  onSelect: (orderId: number, selected: boolean) => void;
  // Actions
  openMenuId: number | null;
  menuPositionAbove: { [key: number]: boolean };
  menuRef: (el: HTMLDivElement | null) => void;
  menuElementRef: (el: HTMLDivElement | null) => void;
  onMenuToggle: (orderId: number) => void;
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
 * Individual row in the orders table
 */
export function OrdersTableRow({
  order,
  columnOrder,
  visibleColumns,
  accounts,
  getStatusTone,
  showCheckbox,
  isSelected,
  onSelect,
  openMenuId,
  menuPositionAbove,
  menuRef,
  menuElementRef,
  onMenuToggle,
  onEdit,
  onProcess,
  onView,
  onCancel,
  onDelete,
  canCancelOrder,
  canDeleteOrder,
  isDeleting,
  t,
}: OrdersTableRowProps) {
  const isMenuOpen = openMenuId === order.id;

  return (
    <tr key={order.id} className="border-b border-slate-100">
      {showCheckbox && (
        <td className="py-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={isSelected}
            onChange={(e) => onSelect(order.id, e.target.checked)}
          />
        </td>
      )}
      {columnOrder.map((columnKey) => 
        visibleColumns.has(columnKey) ? renderOrderCell({
          columnKey,
          order,
          accounts,
          getStatusTone,
          t,
        }) : null
      )}
      <td className="py-2">
        <div
          className="relative inline-block"
          ref={menuRef}
        >
          <button
            className="flex items-center justify-center p-1 hover:bg-slate-100 rounded transition-colors"
            onClick={() => onMenuToggle(order.id)}
            aria-label={t("orders.actions")}
          >
            <svg
              className="w-5 h-5 text-slate-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {isMenuOpen && (
            <div 
              ref={menuElementRef}
            >
              <OrderActionsMenu
                order={order}
                isOpen={isMenuOpen}
                menuPositionAbove={menuPositionAbove[order.id] || false}
                onEdit={onEdit}
                onProcess={onProcess}
                onView={onView}
                onCancel={onCancel}
                onDelete={onDelete}
                canCancelOrder={canCancelOrder}
                canDeleteOrder={canDeleteOrder}
                isDeleting={isDeleting}
                t={t}
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

