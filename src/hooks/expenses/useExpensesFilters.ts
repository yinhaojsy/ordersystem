import { useState, useCallback, useMemo, useRef } from "react";
import type { DatePreset } from "../../types/orders";
import { getCurrentWeekRange, getLastWeekRange, getCurrentMonthRange, getLastMonthRange } from "../../utils/orders/datePresets";

export interface ExpenseFilters {
  datePreset: DatePreset;
  dateFrom: string | null;
  dateTo: string | null;
  accountId: number | null;
  currencyCode: string | null;
  createdBy: number | null;
  tagIds: number[];
}

export interface ExpenseQueryParams {
  dateFrom?: string;
  dateTo?: string;
  accountId?: number;
  currencyCode?: string;
  createdBy?: number;
  tagIds?: string;
  page?: number;
  limit?: number;
}

const defaultFilters: ExpenseFilters = {
  datePreset: 'all',
  dateFrom: null,
  dateTo: null,
  accountId: null,
  currencyCode: null,
  createdBy: null,
  tagIds: [],
};

export function useExpensesFilters(
  currentPage: number,
  setCurrentPage: (page: number) => void
) {
  const [filters, setFilters] = useState<ExpenseFilters>(defaultFilters);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [tagFilterHighlight, setTagFilterHighlight] = useState<number>(-1);
  const tagFilterListRef = useRef<HTMLDivElement | null>(null);

  // Helper function to build query parameters from filters
  const buildQueryParams = useCallback((
    filterState: ExpenseFilters,
    includePagination = false,
    page?: number
  ): ExpenseQueryParams => {
    const params: ExpenseQueryParams = {};

    if (filterState.dateFrom) params.dateFrom = filterState.dateFrom;
    if (filterState.dateTo) params.dateTo = filterState.dateTo;
    if (filterState.accountId !== null) params.accountId = filterState.accountId;
    if (filterState.currencyCode) params.currencyCode = filterState.currencyCode;
    if (filterState.createdBy !== null) params.createdBy = filterState.createdBy;
    if (filterState.tagIds.length > 0) params.tagIds = filterState.tagIds.join(',');

    if (includePagination) {
      params.page = page ?? currentPage;
      params.limit = 20;
    }

    return params;
  }, [currentPage]);

  // Handle date preset changes
  const handleDatePresetChange = useCallback((preset: DatePreset) => {
    let dateFrom: string | null = null;
    let dateTo: string | null = null;

    if (preset === 'all') {
      dateFrom = null;
      dateTo = null;
    } else if (preset === 'currentWeek') {
      const range = getCurrentWeekRange();
      dateFrom = range.from;
      dateTo = range.to;
    } else if (preset === 'lastWeek') {
      const range = getLastWeekRange();
      dateFrom = range.from;
      dateTo = range.to;
    } else if (preset === 'currentMonth') {
      const range = getCurrentMonthRange();
      dateFrom = range.from;
      dateTo = range.to;
    } else if (preset === 'lastMonth') {
      const range = getLastMonthRange();
      dateFrom = range.from;
      dateTo = range.to;
    }

    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      dateFrom,
      dateTo,
    }));
    setCurrentPage(1); // Reset to first page when filter changes
  }, [setCurrentPage]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  }, [setCurrentPage]);

  // Update a filter field
  const updateFilter = useCallback(<K extends keyof ExpenseFilters>(
    key: K,
    value: ExpenseFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, [setCurrentPage]);

  // Build query parameters for API
  const queryParams = useMemo(() => buildQueryParams(filters, true, currentPage), [filters, currentPage, buildQueryParams]);

  // Build export query parameters (same as queryParams but without pagination)
  const exportQueryParams = useMemo(() => buildQueryParams(filters, false), [filters, buildQueryParams]);

  return {
    filters,
    setFilters,
    updateFilter,
    handleDatePresetChange,
    handleClearFilters,
    buildQueryParams,
    queryParams,
    exportQueryParams,
    // Tag filter state
    isTagFilterOpen,
    setIsTagFilterOpen,
    tagFilterHighlight,
    setTagFilterHighlight,
    tagFilterListRef,
  };
}

