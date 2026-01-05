import React from "react";
import type { ColumnDefinition } from "../../hooks/orders/useOrdersTable";

interface OrdersColumnDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  availableColumns: ColumnDefinition[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnKey: string) => void;
  draggedColumnIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  t: (key: string) => string;
}

/**
 * Column visibility and ordering dropdown
 */
export function OrdersColumnDropdown({
  isOpen,
  onToggle,
  availableColumns,
  visibleColumns,
  onToggleColumn,
  draggedColumnIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragLeave,
  dropdownRef,
  t,
}: OrdersColumnDropdownProps) {
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
        aria-label={t("orders.columns") || "Columns"}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
        {t("orders.columns") || "Columns"}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-2">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
            {t("orders.showColumns") || "Show Columns"}
          </div>
          {availableColumns.map((column, index) => (
            <div
              key={column.key}
              onDragOver={(e) => onDragOver(e, index)}
              onDragLeave={onDragLeave}
              className={`flex items-center gap-2 px-4 py-2 hover:bg-slate-50 ${
                dragOverIndex === index ? 'bg-blue-50 border-t-2 border-blue-500' : ''
              } ${draggedColumnIndex === index ? 'opacity-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={visibleColumns.has(column.key)}
                onChange={() => onToggleColumn(column.key)}
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => e.preventDefault()}
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 flex-shrink-0"
              />
              <span 
                className="text-sm text-slate-700 flex-1"
                onDragStart={(e) => e.preventDefault()}
              >
                {column.label}
              </span>
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', index.toString());
                  onDragStart(index);
                }}
                onDragEnd={onDragEnd}
                className="cursor-move flex-shrink-0 text-slate-400 hover:text-slate-600 select-none"
                style={{ userSelect: 'none' }}
              >
                <svg
                  className="w-4 h-4 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8h16M4 16h16"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

