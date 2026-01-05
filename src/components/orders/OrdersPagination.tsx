import React from "react";

interface OrdersPaginationProps {
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  onPageChange: (page: number) => void;
  t: (key: string) => string;
}

/**
 * Pagination component for orders table
 */
export function OrdersPagination({
  currentPage,
  totalPages,
  totalOrders,
  onPageChange,
  t,
}: OrdersPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
      <div className="text-sm text-slate-600">
        {t("orders.showing") || "Showing"} {(currentPage - 1) * 20 + 1} {t("orders.to") || "to"} {Math.min(currentPage * 20, totalOrders)} {t("orders.of") || "of"} {totalOrders} {t("orders.orders") || "orders"}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("orders.previous") || "Previous"}
        </button>
        <span className="text-sm text-slate-600">
          {t("orders.page") || "Page"} {currentPage} {t("orders.of") || "of"} {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("orders.next") || "Next"}
        </button>
      </div>
    </div>
  );
}

