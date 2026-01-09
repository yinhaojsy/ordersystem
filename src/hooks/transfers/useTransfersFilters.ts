import { useState, useCallback, useMemo, useRef } from "react";
import type { DatePreset } from "../../types/orders";
import { getCurrentWeekRange, getLastWeekRange, getCurrentMonthRange, getLastMonthRange } from "../../utils/orders/datePresets";

export interface TransferFilters {
  datePreset: DatePreset;
  dateFrom: string | null;
  dateTo: string | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  currencyCode: string | null;
  createdBy: number | null;
  tagIds: number[];
}

export interface TransferQueryParams {
  dateFrom?: string;
  dateTo?: string;
  fromAccountId?: number;
  toAccountId?: number;
  currencyCode?: string;
  createdBy?: number;
  tagIds?: string;
  page?: number;
  limit?: number;
}

const defaultFilters: TransferFilters = {
  datePreset: 'all',
  dateFrom: null,
  dateTo: null,
  fromAccountId: null,
  toAccountId: null,
  currencyCode: null,
  createdBy: null,
  tagIds: [],
};

export function useTransfersFilters(
  currentPage: number,
  setCurrentPage: (page: number) => void
) {
  const [filters, setFilters] = useState<TransferFilters>(defaultFilters);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [tagFilterHighlight, setTagFilterHighlight] = useState<number>(-1);
  const tagFilterListRef = useRef<HTMLDivElement | null>(null);

  // Helper function to build query parameters from filters
  const buildQueryParams = useCallback((
    filterState: TransferFilters,
    includePagination = false,
    page?: number
  ): TransferQueryParams => {
    const params: TransferQueryParams = {};

    if (filterState.dateFrom) params.dateFrom = filterState.dateFrom;
    if (filterState.dateTo) params.dateTo = filterState.dateTo;
    if (filterState.fromAccountId !== null) params.fromAccountId = filterState.fromAccountId;
    if (filterState.toAccountId !== null) params.toAccountId = filterState.toAccountId;
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
  const updateFilter = useCallback(<K extends keyof TransferFilters>(
    key: K,
    value: TransferFilters[K]
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

