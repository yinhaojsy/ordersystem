import React from "react";
import { ColumnDropdown } from "../common/ColumnDropdown";
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
 * Column visibility and ordering dropdown for Orders page
 * Wrapper around the generic ColumnDropdown component
 */
export function OrdersColumnDropdown(props: OrdersColumnDropdownProps) {
  return (
    <ColumnDropdown
      {...props}
      translationKeys={{
        columns: "orders.columns",
        showColumns: "orders.showColumns",
      }}
    />
  );
}

