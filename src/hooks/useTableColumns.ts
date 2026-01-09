import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export interface ColumnDefinition {
  key: string;
  label: string;
}

export interface UseTableColumnsOptions {
  /** Array of all available column keys */
  columnKeys: string[];
  /** Function that returns column definitions with translated labels */
  getColumnDefinitions: (t: (key: string) => string) => ColumnDefinition[];
  /** Prefix for localStorage keys (e.g., "ordersPage", "expensesPage") */
  storagePrefix: string;
  /** Optional array of column keys that should be visible by default for first-time users. If not provided, all columns are visible. */
  defaultVisibleColumns?: string[];
}

export function useTableColumns({
  columnKeys,
  getColumnDefinitions,
  storagePrefix,
  defaultVisibleColumns,
}: UseTableColumnsOptions) {
  const { t } = useTranslation();
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Define all available columns (with translated labels) - this is the master list
  const getAvailableColumns = useCallback((): ColumnDefinition[] => {
    return getColumnDefinitions(t);
  }, [getColumnDefinitions, t]);
  
  // Initialize column order from localStorage or default order
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem(`${storagePrefix}_columnOrder`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that it's an array of strings
        if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
          // Validate that all columns are present
          const savedSet = new Set(parsed);
          const defaultSet = new Set(columnKeys);
          if (savedSet.size === defaultSet.size && [...savedSet].every(key => defaultSet.has(key))) {
            return parsed;
          }
        }
      } catch {
        // If parsing fails, use default order
      }
    }
    // Default order
    return [...columnKeys];
  });
  
  // Get ordered columns based on columnOrder
  const availableColumns = useMemo(() => {
    return columnOrder.map(key => {
      const column = getAvailableColumns().find(col => col.key === key);
      return column || { key, label: key };
    }).filter(col => col);
  }, [columnOrder, getAvailableColumns]);
  
  // Initialize column visibility from localStorage or default to specified visible columns
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`${storagePrefix}_visibleColumns`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
          return new Set<string>(defaultVisibleColumns || columnKeys);
        }
        const savedSet = new Set<string>(parsed.filter((item): item is string => typeof item === "string"));
        // Merge with current columnKeys to ensure new columns are included
        // Start with saved columns, then add any new columns that aren't in saved
        const merged = new Set<string>(savedSet);
        columnKeys.forEach(key => {
          if (!savedSet.has(key)) {
            merged.add(key); // Add new columns to visible columns
          }
        });
        return merged;
      } catch {
        // If parsing fails, return default visible columns
        return new Set<string>(defaultVisibleColumns || columnKeys);
      }
    }
    // Default: use specified visible columns, or all columns if not specified
    return new Set<string>(defaultVisibleColumns || columnKeys);
  });

  // Save column order to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}_columnOrder`, JSON.stringify(columnOrder));
  }, [columnOrder, storagePrefix]);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}_visibleColumns`, JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns, storagePrefix]);

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

