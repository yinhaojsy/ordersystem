import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { OrdersTableRow } from "./OrdersTableRow";
import { Pagination } from "../common/Pagination";
import { getStatusTone } from "../../utils/orders/orderFormatters";
import type { Order, Account, AuthResponse } from "../../types";

interface OrdersTableProps {
  orders: Order[];
  accounts: Account[];
  // Column management
  columnOrder: string[];
  visibleColumns: Set<string>;
  getColumnLabel: (key: string) => string;
  // Selection
  showCheckbox: boolean;
  selectedOrderIds: number[];
  onSelectOrder: (orderId: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  // Actions
  openMenuId: number | null;
  menuPositionAbove: { [key: number]: boolean };
  menuRefs: React.MutableRefObject<{ [key: number]: HTMLDivElement | null }>;
  menuElementRefs: React.MutableRefObject<{ [key: number]: HTMLDivElement | null }>;
  onMenuToggle: (orderId: number) => void;
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
  // Pagination
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  onPageChange: (page: number) => void;
}

/**
 * Main orders table component
 */
export function OrdersTable({
  orders,
  accounts,
  columnOrder,
  visibleColumns,
  getColumnLabel,
  showCheckbox,
  selectedOrderIds,
  onSelectOrder,
  onSelectAll,
  openMenuId,
  menuPositionAbove,
  menuRefs,
  menuElementRefs,
  onMenuToggle,
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
  currentPage,
  totalPages,
  totalOrders,
  onPageChange,
}: OrdersTableProps) {
  const { t } = useTranslation();

  const handleMenuRef = useCallback((orderId: number) => (el: HTMLDivElement | null) => {
    menuRefs.current[orderId] = el;
  }, [menuRefs]);

  const handleMenuElementRef = useCallback((orderId: number) => (el: HTMLDivElement | null) => {
    menuElementRefs.current[orderId] = el;
  }, [menuElementRefs]);

  return (
    <>
      <div className="overflow-x-auto min-h-[60vh]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              {showCheckbox && (
                <th className="py-2 w-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!orders.length && selectedOrderIds.length === orders.length}
                    onChange={(e) => onSelectAll(e.target.checked)}
                  />
                </th>
              )}
              {columnOrder.map((columnKey) => 
                visibleColumns.has(columnKey) && (
                  <th key={columnKey} className="py-2">{getColumnLabel(columnKey)}</th>
                )
              )}
              <th className="py-2">{t("orders.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <OrdersTableRow
                key={order.id}
                order={order}
                columnOrder={columnOrder}
                visibleColumns={visibleColumns}
                accounts={accounts}
                getStatusTone={getStatusTone}
                showCheckbox={showCheckbox}
                isSelected={selectedOrderIds.includes(order.id)}
                onSelect={onSelectOrder}
                openMenuId={openMenuId}
                menuPositionAbove={menuPositionAbove}
                menuRef={handleMenuRef(order.id)}
                menuElementRef={handleMenuElementRef(order.id)}
                onMenuToggle={onMenuToggle}
                authUser={authUser}
                onEdit={onEdit}
                onProcess={onProcess}
                onView={onView}
                onCancel={onCancel}
                onDelete={onDelete}
                onRequestDelete={onRequestDelete}
                onRequestEdit={onRequestEdit}
                canCancelOrder={canCancelOrder}
                canDeleteOrder={canDeleteOrder}
                isDeleting={isDeleting}
                t={t}
              />
            ))}
            {!orders.length && (
              <tr>
                <td className="py-4 text-sm text-slate-500" colSpan={columnOrder.length + (showCheckbox ? 1 : 0) + 1}>
                  {t("orders.noOrders")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalOrders}
        onPageChange={onPageChange}
        t={t}
      />
    </>
  );
}

