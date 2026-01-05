import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

const COLUMN_KEYS = ["id", "date", "handler", "customer", "pair", "buy", "sell", "rate", "status", "orderType", "buyAccount", "sellAccount", "profit", "serviceCharges", "tags"];

export interface ColumnDefinition {
  key: string;
  label: string;
}

export function useOrdersTable() {
  const { t } = useTranslation();
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Define all available columns (with translated labels) - this is the master list
  const getAvailableColumns = useCallback((): ColumnDefinition[] => [
    { key: "id", label: t("orders.orderId") },
    { key: "date", label: t("orders.date") },
    { key: "handler", label: t("orders.handler") },
    { key: "customer", label: t("orders.customer") },
    { key: "pair", label: t("orders.pair") },
    { key: "buy", label: t("orders.buy") },
    { key: "sell", label: t("orders.sell") },
    { key: "rate", label: t("orders.rate") },
    { key: "status", label: t("orders.status") },
    { key: "orderType", label: t("orders.orderType") || "Order Type" },
    { key: "buyAccount", label: t("orders.buyAccount") },
    { key: "sellAccount", label: t("orders.sellAccount") },
    { key: "profit", label: t("orders.profit") },
    { key: "serviceCharges", label: t("orders.serviceCharges") },
    { key: "tags", label: t("orders.tags") || "Tags" },
  ], [t]);
  
  // Initialize column order from localStorage or default order
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("ordersPage_columnOrder");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that it's an array of strings
        if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
          // Validate that all columns are present
          const savedSet = new Set(parsed);
          const defaultSet = new Set(COLUMN_KEYS);
          if (savedSet.size === defaultSet.size && [...savedSet].every(key => defaultSet.has(key))) {
            return parsed;
          }
        }
      } catch {
        // If parsing fails, use default order
      }
    }
    // Default order
    return [...COLUMN_KEYS];
  });
  
  // Get ordered columns based on columnOrder
  const availableColumns = useMemo(() => {
    return columnOrder.map(key => {
      const column = getAvailableColumns().find(col => col.key === key);
      return column || { key, label: key };
    }).filter(col => col);
  }, [columnOrder, getAvailableColumns]);
  
  // Initialize column visibility from localStorage or default to all visible
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("ordersPage_visibleColumns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
          return new Set<string>(COLUMN_KEYS);
        }
        const savedSet = new Set<string>(parsed.filter((item): item is string => typeof item === "string"));
        // Merge with current COLUMN_KEYS to ensure new columns (like tags) are included
        // Start with saved columns, then add any new columns that aren't in saved
        const merged = new Set<string>(savedSet);
        COLUMN_KEYS.forEach(key => {
          if (!savedSet.has(key)) {
            merged.add(key); // Add new columns like "tags" to visible columns
          }
        });
        return merged;
      } catch {
        // If parsing fails, return all columns visible
        return new Set<string>(COLUMN_KEYS);
      }
    }
    // Default: all columns visible
    return new Set<string>(COLUMN_KEYS);
  });

  // Save column order to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("ordersPage_columnOrder", JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("ordersPage_visibleColumns", JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((columnKey: string) => {
    setVisibleColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey);
      } else {
        newSet.add(columnKey);
      }
      return newSet;
    });
  }, []);

  // Column drag handlers
  const handleColumnDragStart = useCallback((index: number) => {
    setDraggedColumnIndex(index);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleColumnDragEnd = useCallback(() => {
    if (draggedColumnIndex !== null && dragOverIndex !== null && draggedColumnIndex !== dragOverIndex) {
      const newOrder = [...columnOrder];
      const [removed] = newOrder.splice(draggedColumnIndex, 1);
      newOrder.splice(dragOverIndex, 0, removed);
      setColumnOrder(newOrder);
    }
    setDraggedColumnIndex(null);
    setDragOverIndex(null);
  }, [draggedColumnIndex, dragOverIndex, columnOrder]);

  const handleColumnDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  // Get column label
  const getColumnLabel = useCallback((key: string): string => {
    const column = getAvailableColumns().find(col => col.key === key);
    return column?.label || key;
  }, [getAvailableColumns]);

  // Close column dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    // Column definitions
    availableColumns,
    columnOrder,
    visibleColumns,
    getColumnLabel,
    getAvailableColumns,
    // Column management
    toggleColumnVisibility,
    setColumnOrder,
    // Column dropdown
    isColumnDropdownOpen,
    setIsColumnDropdownOpen,
    columnDropdownRef,
    // Drag and drop
    draggedColumnIndex,
    dragOverIndex,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleColumnDragLeave,
  };
}

