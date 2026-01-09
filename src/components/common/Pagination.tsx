import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  t: (key: string) => string;
  entityName?: string; // e.g., "orders", "expenses", "transfers"
}

/**
 * Generic pagination component
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 20,
  onPageChange,
  t,
  entityName = "items",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
      <div className="text-sm text-slate-600">
        {t("common.showing") || "Showing"} {startItem} {t("common.to") || "to"}{" "}
        {endItem} {t("common.of") || "of"} {"("}{totalItems} {entityName}{")"}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("common.previous") || "Previous"}
        </button>
        <span className="text-sm text-slate-600">
          {t("common.page") || "Page"} {currentPage} {t("common.of") || "of"}{" "}
          {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("common.next") || "Next"}
        </button>
      </div>
    </div>
  );
}
