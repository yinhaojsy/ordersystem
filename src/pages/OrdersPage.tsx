import React, { useState, type FormEvent, useEffect, useRef, type ReactNode, useMemo, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";

// Component for account tooltip with overflow handling
const AccountTooltip = memo(function AccountTooltip({ 
  accounts, 
  label, 
  children,
  profitAmount,
  profitCurrency,
  profitAccountName,
  serviceChargeAmount,
  serviceChargeCurrency,
  serviceChargeAccountName,
  isSellAccount = false
}: { 
  accounts: Array<{ accountId: number; accountName: string; amount: number }>; 
  label: string;
  children: ReactNode;
  profitAmount?: number | null;
  profitCurrency?: string | null;
  profitAccountName?: string | null;
  serviceChargeAmount?: number | null;
  serviceChargeCurrency?: string | null;
  serviceChargeAccountName?: string | null;
  isSellAccount?: boolean;
}) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<'above' | 'below'>('below');
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkPosition = () => {
      if (!containerRef.current || !tooltipRef.current) return;
      
      const containerElement = containerRef.current;
      const tooltipElement = tooltipRef.current;
      
      // Use requestAnimationFrame to ensure tooltip is rendered
      requestAnimationFrame(() => {
        const containerRect = containerElement.getBoundingClientRect();
        const tooltipHeight = tooltipElement.offsetHeight || 200; // Approximate height if not measured yet
        const spaceBelow = window.innerHeight - containerRect.bottom;
        const spaceAbove = containerRect.top;
        
        // Position above if there's not enough space below, or if there's more space above
        const shouldPositionAbove = spaceBelow < tooltipHeight || spaceAbove > spaceBelow;
        
        setPosition(shouldPositionAbove ? 'above' : 'below');
      });
    };

    const container = containerRef.current;
    if (container) {
      const handleMouseEnter = () => {
        checkPosition();
        // Double-check after a brief delay to ensure tooltip is fully rendered
        setTimeout(checkPosition, 10);
      };
      
      container.addEventListener('mouseenter', handleMouseEnter);
      // Also check on scroll
      window.addEventListener('scroll', checkPosition, true);
      return () => {
        container.removeEventListener('mouseenter', handleMouseEnter);
        window.removeEventListener('scroll', checkPosition, true);
      };
    }
  }, [accounts.length]);

  return (
    <div ref={containerRef} className="relative group">
      {children}
      <div
        ref={tooltipRef}
        className={`absolute left-0 z-50 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-xl p-3 min-w-[220px] max-w-[300px] ${
          position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
        style={{
          maxHeight: `${Math.min(window.innerHeight - 40, 400)}px`,
          overflowY: 'auto',
          overflowX: 'visible'
        }}
      >
        <div className="text-xs font-semibold text-slate-700 mb-2 pb-2 border-b border-slate-200">
          {label} ({accounts.length})
        </div>
        <div className="space-y-2">
          {accounts.map((acc, idx) => (
            <div key={idx} className="text-xs text-slate-600 flex justify-between items-center gap-3">
              <span className="truncate">{acc.accountName}</span>
              <span className="font-medium text-slate-800 whitespace-nowrap">
                {isSellAccount ? `-${acc.amount.toFixed(2)}` : acc.amount.toFixed(2)}
              </span>
            </div>
          ))}
          {profitAmount !== null && profitAmount !== undefined && profitAccountName && (
            <div className="text-xs text-blue-700 flex justify-between items-center gap-3 pt-2 border-t border-slate-200">
              <span className="truncate font-semibold">Profit ({profitAccountName})</span>
              <span className="font-medium whitespace-nowrap">
                {profitAmount > 0 ? "+" : ""}{profitAmount.toFixed(2)} {profitCurrency || ""}
              </span>
            </div>
          )}
          {serviceChargeAmount !== null && serviceChargeAmount !== undefined && serviceChargeAccountName && (
            <div className="text-xs flex justify-between items-center gap-3 pt-2 border-t border-slate-200">
              <span className={`truncate font-semibold ${serviceChargeAmount < 0 ? "text-red-600" : "text-green-700"}`}>
                Fees ({serviceChargeAccountName})
              </span>
              <span className={`font-medium whitespace-nowrap ${serviceChargeAmount < 0 ? "text-red-600" : "text-green-700"}`}>
                {serviceChargeAmount > 0 ? "+" : ""}{serviceChargeAmount.toFixed(2)} {serviceChargeCurrency || ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Searchable Select Component
const SearchableSelect = memo(function SearchableSelect<T extends { id: number; name: string }>({
  value,
  onChange,
  options,
  placeholder,
  label,
  allOptionLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  options: T[];
  placeholder: string;
  label: string;
  allOptionLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((option) => option.name.toLowerCase().includes(term));
  }, [options, searchTerm]);

  // Get all options including "All" option
  const allOptions = useMemo(() => {
    return [{ id: null, name: allOptionLabel } as unknown as T & { id: number | null }, ...filteredOptions];
  }, [filteredOptions, allOptionLabel]);

  // Get selected option name
  const selectedOption = options.find((opt) => opt.id === value);
  const displayValue = selectedOption ? selectedOption.name : "";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset search and highlight when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlighted index when search term changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && dropdownRef.current) {
      const optionElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (optionElement) {
        optionElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionId: number | null) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < allOptions.length - 1 ? prev + 1 : 0;
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : allOptions.length - 1;
          return next;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          handleSelect(allOptions[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {isOpen && (
        <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {allOptions.map((option, index) => (
            <div
              key={option.id ?? "all"}
              onClick={() => handleSelect(option.id)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                index === highlightedIndex
                  ? "bg-blue-100 text-blue-900 font-medium"
                  : value === option.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.name}
            </div>
          ))}
          {filteredOptions.length === 0 && searchTerm.trim() && (
            <div className="px-3 py-2 text-sm text-slate-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}) as <T extends { id: number; name: string }>(props: {
  value: number | null;
  onChange: (value: number | null) => void;
  options: T[];
  placeholder: string;
  label: string;
  allOptionLabel: string;
}) => React.ReactElement;

import {
  useAddOrderMutation,
  useGetCurrenciesQuery,
  useGetCustomersQuery,
  useGetOrdersQuery,
  useGetUsersQuery,
  useUpdateOrderMutation,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
  useGetOrderDetailsQuery,
  useProcessOrderMutation,
  useAddReceiptMutation,
  useUpdateReceiptMutation,
  useDeleteReceiptMutation,
  useConfirmReceiptMutation,
  useAddBeneficiaryMutation,
  useAddPaymentMutation,
  useUpdatePaymentMutation,
  useDeletePaymentMutation,
  useConfirmPaymentMutation,
  useGetCustomerBeneficiariesQuery,
  useAddCustomerBeneficiaryMutation,
  useGetAccountsQuery,
  useAddCustomerMutation,
  useProceedWithPartialReceiptsMutation,
  useAdjustFlexOrderRateMutation,
  useGetTagsQuery,
  useBatchAssignTagsMutation,
  useBatchUnassignTagsMutation,
} from "../services/api";
import { useGetRolesQuery } from "../services/api";
import { useAppSelector } from "../app/hooks";
import { hasActionPermission } from "../utils/permissions";
import type { OrderStatus, Order } from "../types";
import { formatDate } from "../utils/format";

// Date preset helper functions
const getCurrentWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days; otherwise go to Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  
  return {
    from: monday.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0],
  };
};

const getLastWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() + diff - 7);
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  
  return {
    from: lastMonday.toISOString().split('T')[0],
    to: lastSunday.toISOString().split('T')[0],
  };
};

const getCurrentMonthRange = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDay.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  
  return {
    from: firstDay.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0],
  };
};

const getLastMonthRange = () => {
  const today = new Date();
  const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  firstDayLastMonth.setHours(0, 0, 0, 0);
  
  const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  lastDayLastMonth.setHours(23, 59, 59, 999);
  
  return {
    from: firstDayLastMonth.toISOString().split('T')[0],
    to: lastDayLastMonth.toISOString().split('T')[0],
  };
};

export default function OrdersPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: roles = [] } = useGetRolesQuery();

  // Filter state
  const [filters, setFilters] = useState<{
    datePreset: 'all' | 'currentWeek' | 'lastWeek' | 'currentMonth' | 'lastMonth' | 'custom';
    dateFrom: string | null;
    dateTo: string | null;
    handlerId: number | null;
    customerId: number | null;
    currencyPair: string | null;
    buyAccountId: number | null;
    sellAccountId: number | null;
    status: OrderStatus | null;
    orderType: "online" | "otc" | null;
    tagIds: number[];
  }>({
    datePreset: 'all',
    dateFrom: null,
    dateTo: null,
    handlerId: null,
    customerId: null,
    currencyPair: null,
    buyAccountId: null,
    sellAccountId: null,
    status: null,
    orderType: null,
    tagIds: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [tagFilterHighlight, setTagFilterHighlight] = useState<number>(-1);

  // Helper function to build query parameters from filters
  const buildQueryParams = useCallback((
    filterState: {
      datePreset: 'all' | 'currentWeek' | 'lastWeek' | 'currentMonth' | 'lastMonth' | 'custom';
      dateFrom: string | null;
      dateTo: string | null;
      handlerId: number | null;
      customerId: number | null;
      currencyPair: string | null;
      buyAccountId: number | null;
      sellAccountId: number | null;
      status: OrderStatus | null;
      orderType: "online" | "otc" | null;
      tagIds: number[];
    },
    includePagination = false,
    page?: number
  ) => {
    const params: {
      dateFrom?: string;
      dateTo?: string;
      handlerId?: number;
      customerId?: number;
      fromCurrency?: string;
      toCurrency?: string;
      buyAccountId?: number;
      sellAccountId?: number;
      status?: OrderStatus;
      orderType?: "online" | "otc";
      tagIds?: string;
      page?: number;
      limit?: number;
    } = {};

    if (filterState.dateFrom) params.dateFrom = filterState.dateFrom;
    if (filterState.dateTo) params.dateTo = filterState.dateTo;
    if (filterState.handlerId !== null) params.handlerId = filterState.handlerId;
    if (filterState.customerId !== null) params.customerId = filterState.customerId;
    if (filterState.currencyPair) {
      const [from, to] = filterState.currencyPair.split('/');
      params.fromCurrency = from;
      params.toCurrency = to;
    }
    if (filterState.buyAccountId !== null) params.buyAccountId = filterState.buyAccountId;
    if (filterState.sellAccountId !== null) params.sellAccountId = filterState.sellAccountId;
    if (filterState.status) params.status = filterState.status;
    if (filterState.orderType) params.orderType = filterState.orderType;
    if (filterState.tagIds.length > 0) params.tagIds = filterState.tagIds.join(',');
    
    if (includePagination) {
      params.page = page ?? currentPage;
      params.limit = 20;
    }

    return params;
  }, [currentPage]);

  // Build query parameters for API
  const queryParams = useMemo(() => buildQueryParams(filters, true, currentPage), [filters, currentPage, buildQueryParams]);

  const { data: ordersData, isLoading, refetch: refetchOrders } = useGetOrdersQuery(queryParams);
  const orders = ordersData?.orders || [];
  const totalOrders = ordersData?.total || 0;
  const totalPages = ordersData?.totalPages || 1;

  const { data: customers = [] } = useGetCustomersQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: users = [] } = useGetUsersQuery();
  const { data: accounts = [] } = useGetAccountsQuery();

  // Get unique currency pairs from all orders (for dropdown)
  // Note: This would ideally come from the backend, but for now we'll generate from currencies
  const currencyPairs = useMemo(() => {
    const pairs = new Set<string>();
    // Generate pairs from active currencies
    currencies
      .filter((c) => c.active)
      .forEach((fromCurr) => {
        currencies
          .filter((c) => c.active && c.code !== fromCurr.code)
          .forEach((toCurr) => {
            pairs.add(`${fromCurr.code}/${toCurr.code}`);
          });
      });
    return Array.from(pairs).sort();
  }, [currencies]);

  // Handle date preset changes
  const handleDatePresetChange = useCallback((preset: 'all' | 'currentWeek' | 'lastWeek' | 'currentMonth' | 'lastMonth' | 'custom') => {
    let dateFrom: string | null = null;
    let dateTo: string | null = null;

    if (preset === 'all') {
      // Clear date filters
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
    // For 'custom', keep existing dateFrom/dateTo values

    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      dateFrom,
      dateTo,
    }));
    setCurrentPage(1); // Reset to first page when filter changes
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      datePreset: 'all',
      dateFrom: null,
      dateTo: null,
      handlerId: null,
      customerId: null,
      currencyPair: null,
      buyAccountId: null,
      sellAccountId: null,
      status: null,
      orderType: null,
      tagIds: [],
    });
    setCurrentPage(1);
  }, []);

  // Build export query parameters (same as queryParams but without pagination)
  const exportQueryParams = useMemo(() => buildQueryParams(filters, false), [filters, buildQueryParams]);

  // Export orders function
  const [isExporting, setIsExporting] = useState(false);
  const handleExportOrders = useCallback(async () => {
    try {
      setIsExporting(true);
      
      // Fetch all filtered orders using the export endpoint
      const queryString = new URLSearchParams();
      if (exportQueryParams.dateFrom) queryString.append("dateFrom", exportQueryParams.dateFrom);
      if (exportQueryParams.dateTo) queryString.append("dateTo", exportQueryParams.dateTo);
      if (exportQueryParams.handlerId !== undefined) queryString.append("handlerId", exportQueryParams.handlerId.toString());
      if (exportQueryParams.customerId !== undefined) queryString.append("customerId", exportQueryParams.customerId.toString());
      if (exportQueryParams.fromCurrency) queryString.append("fromCurrency", exportQueryParams.fromCurrency);
      if (exportQueryParams.toCurrency) queryString.append("toCurrency", exportQueryParams.toCurrency);
      if (exportQueryParams.buyAccountId !== undefined) queryString.append("buyAccountId", exportQueryParams.buyAccountId.toString());
      if (exportQueryParams.sellAccountId !== undefined) queryString.append("sellAccountId", exportQueryParams.sellAccountId.toString());
      if (exportQueryParams.status) queryString.append("status", exportQueryParams.status);
      if (exportQueryParams.tagIds) queryString.append("tagIds", exportQueryParams.tagIds);

      const response = await fetch(`/api/orders/export${queryString.toString() ? `?${queryString.toString()}` : ""}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders for export");
      }
      const ordersToExport: Order[] = await response.json();

      // Prepare data for Excel
      const ordersData = ordersToExport.map((order) => ({
        "Order ID": order.id,
        "Date": formatDate(order.createdAt),
        "Handler": order.handlerName || "-",
        "Customer": order.customerName || "-",
        "Currency Pair": `${order.fromCurrency}/${order.toCurrency}`,
        "Amount Buy": order.amountBuy,
        "From Currency": order.fromCurrency,
        "Amount Sell": order.amountSell,
        "To Currency": order.toCurrency,
        "Rate": order.rate,
        "Status": order.status,
        "Buy Account": order.buyAccountName || "-",
        "Sell Account": order.sellAccountName || "-",
        "Profit Amount": order.profitAmount || 0,
        "Profit Currency": order.profitCurrency || "-",
        "Service Charge Amount": order.serviceChargeAmount || 0,
        "Service Charge Currency": order.serviceChargeCurrency || "-",
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ordersSheet = XLSX.utils.json_to_sheet(ordersData);
      XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");

      // Write file
      const fileName = `orders_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setAlertModal({
        isOpen: true,
        message: (t("orders.exportSuccess") || "Successfully exported {{count}} orders to {{fileName}}")
          .replace("{{count}}", ordersToExport.length.toString())
          .replace("{{fileName}}", fileName),
        type: "success",
      });
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: t("orders.exportError") || "Failed to export orders. Please try again.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  }, [exportQueryParams, t]);

  // Download import template
  const handleDownloadTemplate = useCallback(() => {
    // Create template data with example rows
    const templateData = [
      {
        "Customer": "Example Customer",
        "Handler": "John Doe",
        "Currency Pair": "USD/HKD",
        "Amount Buy": 1000,
        "Amount Sell": 7800,
        "Rate": 7.8,
        "Status": "pending"
      },
      {
        "Customer": "Another Customer",
        "Handler": "",
        "Currency Pair": "USDT/USD",
        "Amount Buy": 500,
        "Amount Sell": 500,
        "Rate": 1.0,
        "Status": "completed"
      }
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    const templateSheet = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, templateSheet, "Orders");

    // Write file
    XLSX.writeFile(wb, "orders_import_template.xlsx");
  }, []);

  // Import orders function
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);

      // Read Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // Read Orders sheet
      const ordersSheet = workbook.Sheets["Orders"];
      if (!ordersSheet) {
        setAlertModal({
          isOpen: true,
          message: t("orders.ordersSheetNotFound") || "Orders sheet not found in the file",
          type: "error",
        });
        setIsImporting(false);
        return;
      }

      const ordersData = XLSX.utils.sheet_to_json(ordersSheet) as any[];

      if (ordersData.length === 0) {
        setAlertModal({
          isOpen: true,
          message: t("orders.noOrdersInFile") || "No orders found in the file",
          type: "error",
        });
        setIsImporting(false);
        return;
      }

      // Get customers and users for mapping
      const customerMap = new Map(customers.map((c) => [c.name.toLowerCase(), c.id]));
      const userMap = new Map(users.map((u) => [u.name.toLowerCase(), u.id]));

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process each order
      for (let i = 0; i < ordersData.length; i++) {
        const row = ordersData[i];
        try {
          // Find customer by name
          const customerName = String(row["Customer"] || "").trim();
          const customerId = customerMap.get(customerName.toLowerCase());
          if (!customerId) {
            errors.push(`Row ${i + 2}: Customer "${customerName}" not found`);
            errorCount++;
            continue;
          }

          // Find handler by name (optional)
          const handlerName = String(row["Handler"] || "").trim();
          const handlerId = handlerName ? userMap.get(handlerName.toLowerCase()) : null;

          // Parse currency pair
          const currencyPair = String(row["Currency Pair"] || "").trim();
          const [fromCurrency, toCurrency] = currencyPair.split("/").map((c) => c.trim());
          if (!fromCurrency || !toCurrency) {
            errors.push(`Row ${i + 2}: Invalid currency pair "${currencyPair}"`);
            errorCount++;
            continue;
          }

          // Parse amounts and rate
          const amountBuy = parseFloat(row["Amount Buy"] || row["amountBuy"] || "0");
          const amountSell = parseFloat(row["Amount Sell"] || row["amountSell"] || "0");
          const rate = parseFloat(row["Rate"] || row["rate"] || "0");

          if (!amountBuy || !amountSell || !rate) {
            errors.push(`Row ${i + 2}: Missing required fields (Amount Buy, Amount Sell, or Rate)`);
            errorCount++;
            continue;
          }

          // Parse status
          const statusStr = String(row["Status"] || row["status"] || "pending").trim().toLowerCase();
          const statusMap: Record<string, OrderStatus> = {
            "pending": "pending",
            "under_process": "under_process",
            "completed": "completed",
            "cancelled": "cancelled",
          };
          const status = statusMap[statusStr] || "pending";

          // Create order
          const orderData = {
            customerId,
            handlerId: handlerId || undefined,
            fromCurrency,
            toCurrency,
            amountBuy,
            amountSell,
            rate,
            status: status as OrderStatus,
          };

          await addOrder(orderData);
          successCount++;
        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message || "Unknown error"}`);
          errorCount++;
        }
      }

      // Show results
      let message = (t("orders.importSuccess") || "Successfully imported {{count}} orders").replace("{{count}}", successCount.toString());
      if (errorCount > 0) {
        message += `. ${errorCount} orders failed to import.`;
        if (errors.length > 0) {
          message += `\n\nErrors:\n${errors.slice(0, 10).join("\n")}`;
          if (errors.length > 10) {
            message += `\n... and ${errors.length - 10} more errors`;
          }
        }
      }

      setAlertModal({
        isOpen: true,
        message,
        type: errorCount > 0 ? "warning" : "success",
      });

      setImportModalOpen(false);
      // Reset file input
      e.target.value = "";
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: t("orders.importError") || `Failed to import orders: ${error.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsImporting(false);
    }
  }, [t]);

  // Helper function to prevent number input from changing value on scroll
  const handleNumberInputWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (document.activeElement === target) {
      target.blur();
    }
  }, []);

  // Helper function to calculate amountSell from amountBuy using the same logic as order creation
  const calculateAmountSell = (amountBuy: number, rate: number, fromCurrency: string, toCurrency: string): number => {
    if (!Number.isFinite(rate) || rate <= 0) {
      return 0;
    }
    // Determine which side is the "stronger" currency so we know which way to apply the rate.
    // Heuristic: USDT (or any currency with rate <= 1) is the base; otherwise pick the currency with the smaller rate.
    const getCurrencyRate = (code: string) => {
      const currency = currencies.find((c) => c.code === code);
      const candidate =
        currency?.conversionRateBuy ??
        currency?.baseRateBuy ??
        currency?.baseRateSell ??
        currency?.conversionRateSell;
      return typeof candidate === "number" ? candidate : null;
    };

    const fromRate = getCurrencyRate(fromCurrency);
    const toRate = getCurrencyRate(toCurrency);

    const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : fromCurrency === "USDT";
    const inferredToIsUSDT = toRate !== null ? toRate <= 1 : toCurrency === "USDT";

    // If both sides look like USDT (rate <= 1), default to multiply
    if (inferredFromIsUSDT && inferredToIsUSDT) {
      return amountBuy * rate;
    }

    let baseIsFrom: boolean | null = null;
    if (inferredFromIsUSDT !== inferredToIsUSDT) {
      // One side is USDT (or behaves like it)
      baseIsFrom = inferredFromIsUSDT;
    } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
      // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
      baseIsFrom = fromRate < toRate;
    } else {
      // Default to multiply if we can't determine
      return amountBuy * rate;
    }

    if (baseIsFrom) {
      // Stronger/base currency (fromCurrency) → weaker: multiply by rate
      return amountBuy * rate;
    } else {
      // Weaker → stronger/base currency (toCurrency): divide by rate
      return amountBuy / rate;
    }
  };

  const [addOrder, { isLoading: isSaving }] = useAddOrderMutation();
  const [updateOrder] = useUpdateOrderMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();
  const { data: tags = [] } = useGetTagsQuery();
  const [batchAssignTags, { isLoading: isTagging }] = useBatchAssignTagsMutation();
  const [batchUnassignTags, { isLoading: isUntagging }] = useBatchUnassignTagsMutation();
  const [addCustomer, { isLoading: isCreatingCustomer }] = useAddCustomerMutation();
  const [processOrder] = useProcessOrderMutation();
  const [addReceipt] = useAddReceiptMutation();
  const [updateReceipt] = useUpdateReceiptMutation();
  const [deleteReceipt] = useDeleteReceiptMutation();
  const [confirmReceipt] = useConfirmReceiptMutation();
  const [addBeneficiary] = useAddBeneficiaryMutation();
  const [addPayment] = useAddPaymentMutation();
  const [updatePayment] = useUpdatePaymentMutation();
  const [deletePayment] = useDeletePaymentMutation();
  const [confirmPayment] = useConfirmPaymentMutation();
  const [addCustomerBeneficiary] = useAddCustomerBeneficiaryMutation();
  const [proceedWithPartialReceipts] = useProceedWithPartialReceiptsMutation();
  const [adjustFlexOrderRate] = useAdjustFlexOrderRateMutation();

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPositionAbove, setMenuPositionAbove] = useState<{ [key: number]: boolean }>({});
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  const [isBatchTagMode, setIsBatchTagMode] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const selectedTagNames = useMemo(
    () =>
      filters.tagIds
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    [filters.tagIds, tags],
  );
  const tagFilterLabel = useMemo(() => {
    if (selectedTagNames.length === 0) {
      return t("orders.selectTag") || "Select tags";
    }
    return selectedTagNames.join(", ");
  }, [selectedTagNames, t]);
  const tagFilterListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isTagFilterOpen && tags.length > 0) {
      setTagFilterHighlight(0);
      // Move focus to the list for keyboard navigation
      setTimeout(() => tagFilterListRef.current?.focus(), 0);
    } else if (!isTagFilterOpen) {
      setTagFilterHighlight(-1);
    }
  }, [isTagFilterOpen, tags.length]);

  const handleTagFilterKeyDown = (e: React.KeyboardEvent) => {
    if (!isTagFilterOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        setIsTagFilterOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsTagFilterOpen(false);
      return;
    }

    if (tags.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTagFilterHighlight((prev) => {
        const next = prev < tags.length - 1 ? prev + 1 : 0;
        return next;
      });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setTagFilterHighlight((prev) => {
        if (prev <= 0) return tags.length - 1;
        return prev - 1;
      });
      return;
    }

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (tagFilterHighlight >= 0 && tagFilterHighlight < tags.length) {
        const tag = tags[tagFilterHighlight];
        setFilters((prev) => {
          const exists = prev.tagIds.includes(tag.id);
          const next = exists ? prev.tagIds.filter((id) => id !== tag.id) : [...prev.tagIds, tag.id];
          return { ...prev, tagIds: next };
        });
        setCurrentPage(1);
      }
    }
  };
  
  // Column visibility state
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
  
  // Define all available column keys (used for initialization)
  const columnKeys = ["id", "date", "handler", "customer", "pair", "buy", "sell", "rate", "status", "orderType", "buyAccount", "sellAccount", "profit", "serviceCharges", "tags"];
  
  // Define all available columns (with translated labels) - this is the master list
  const getAvailableColumns = () => [
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
  ];
  
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
  const availableColumns = columnOrder.map(key => {
    const column = getAvailableColumns().find(col => col.key === key);
    return column || { key, label: key };
  }).filter(col => col);
  
  // Initialize column visibility from localStorage or default to all visible
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("ordersPage_visibleColumns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
          return new Set<string>(columnKeys);
        }
        const savedSet = new Set<string>(parsed.filter((item): item is string => typeof item === "string"));
        // Merge with current columnKeys to ensure new columns (like tags) are included
        // Start with saved columns, then add any new columns that aren't in saved
        const merged = new Set<string>(savedSet);
        columnKeys.forEach(key => {
          if (!savedSet.has(key)) {
            merged.add(key); // Add new columns like "tags" to visible columns
          }
        });
        return merged;
      } catch {
        // If parsing fails, return all columns visible
        return new Set<string>(columnKeys);
      }
    }
    // Default: all columns visible
    return new Set<string>(columnKeys);
  });
  
  // Drag and drop state
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; orderId: number | null; isBulk?: boolean }>({
    isOpen: false,
    message: "",
    orderId: null,
    isBulk: false,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFlexOrderMode, setIsFlexOrderMode] = useState(false);
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [processModalOrderId, setProcessModalOrderId] = useState<number | null>(null);
  const [viewModalOrderId, setViewModalOrderId] = useState<number | null>(null);
  const [makePaymentModalOrderId, setMakePaymentModalOrderId] = useState<number | null>(null);
  const [isOtcOrderModalOpen, setIsOtcOrderModalOpen] = useState(false);
  const [otcEditingOrderId, setOtcEditingOrderId] = useState<number | null>(null);
  const previousOrderStatusRef = useRef<string | null>(null);
  
  // Service charge and profit state
  const [showProfitSection, setShowProfitSection] = useState(false);
  const [showServiceChargeSection, setShowServiceChargeSection] = useState(false);
  // Upload section visibility state
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [showPaymentUpload, setShowPaymentUpload] = useState(false);
  const [profitAmount, setProfitAmount] = useState<string>("");
  const [profitCurrency, setProfitCurrency] = useState<string>("");
  const [profitAccountId, setProfitAccountId] = useState<string>("");
  const [serviceChargeAmount, setServiceChargeAmount] = useState<string>("");
  const [serviceChargeCurrency, setServiceChargeCurrency] = useState<string>("");
  const [serviceChargeAccountId, setServiceChargeAccountId] = useState<string>("");
  
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const menuElementRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const receiptFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const paymentFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [calculatedField, setCalculatedField] = useState<"buy" | "sell" | null>(null);
  const [receiptUploadKey, setReceiptUploadKey] = useState(0);
  const [paymentUploadKey, setPaymentUploadKey] = useState(0);
  const [flexOrderRate, setFlexOrderRate] = useState<string | null>(null);
  const [excessPaymentWarning, setExcessPaymentWarning] = useState<{
    excessAmount: number;
    additionalReceiptsNeeded: number;
  } | null>(null);
  const [showExcessPaymentModal, setShowExcessPaymentModal] = useState(false);
  const [excessPaymentModalData, setExcessPaymentModalData] = useState<{
    expectedPayment: number;
    actualPayment: number;
    excess: number;
    additionalReceipts: number;
    fromCurrency: string;
    toCurrency: string;
  } | null>(null);
  const [showMissingPaymentModal, setShowMissingPaymentModal] = useState(false);
  const [missingPaymentModalData, setMissingPaymentModalData] = useState<{
    expectedPayment: number;
    actualPayment: number;
    missing: number;
    toCurrency: string;
  } | null>(null);
  const [showExcessReceiptModal, setShowExcessReceiptModal] = useState(false);
  const [excessReceiptModalData, setExcessReceiptModalData] = useState<{
    expectedReceipt: number;
    attemptedReceipt: number;
    excess: number;
    fromCurrency: string;
  } | null>(null);
  const [showExcessPaymentModalNormal, setShowExcessPaymentModalNormal] = useState(false);
  const [excessPaymentModalNormalData, setExcessPaymentModalNormalData] = useState<{
    expectedPayment: number;
    attemptedPayment: number;
    excess: number;
    toCurrency: string;
  } | null>(null);
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    src: string;
    type: 'image' | 'pdf';
    title: string;
  } | null>(null);

  const [form, setForm] = useState({
    customerId: "",
    fromCurrency: "",
    toCurrency: "",
    amountBuy: "",
    amountSell: "",
    rate: "",
    status: "pending" as OrderStatus,
  });

  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [processForm, setProcessForm] = useState<{
    handlerId: string;
    paymentFlow: "receive_first" | "pay_first";
    // Commented out for future use:
    // paymentType: "CRYPTO" | "FIAT";
    // networkChain: string;
    // walletAddresses: string[];
    // bankName: string;
    // accountTitle: string;
    // accountNumber: string;
    // accountIban: string;
    // swiftCode: string;
    // bankAddress: string;
  }>({
    handlerId: "",
    paymentFlow: "receive_first",
    // Commented out for future use:
    // paymentType: "CRYPTO" as "CRYPTO" | "FIAT",
    // networkChain: "",
    // walletAddresses: [""],
    // bankName: "",
    // accountTitle: "",
    // accountNumber: "",
    // accountIban: "",
    // swiftCode: "",
    // bankAddress: "",
  });

  const [beneficiaryForm, setBeneficiaryForm] = useState({
    paymentAccountId: "",
    // Commented out for future use:
    // paymentType: "CRYPTO" as "CRYPTO" | "FIAT",
    // networkChain: "",
    // walletAddresses: [""],
    // bankName: "",
    // accountTitle: "",
    // accountNumber: "",
    // accountIban: "",
    // swiftCode: "",
    // bankAddress: "",
  });
  const [saveBeneficiaryToCustomer, setSaveBeneficiaryToCustomer] = useState(false);
  const [selectedCustomerBeneficiaryId, setSelectedCustomerBeneficiaryId] = useState<number | "">(
    "",
  );

  const applyCustomerBeneficiaryToForm = (beneficiaryId: number) => {
    // Commented out for future use - beneficiary details
    // const selected = customerBeneficiaries.find((b) => b.id === beneficiaryId);
    // if (!selected) return;
    // if (selected.paymentType === "CRYPTO") {
    //   setBeneficiaryForm({
    //     paymentType: "CRYPTO",
    //     networkChain: selected.networkChain || "",
    //     walletAddresses: selected.walletAddresses && selected.walletAddresses.length > 0
    //       ? selected.walletAddresses
    //       : [""],
    //     bankName: "",
    //     accountTitle: "",
    //     accountNumber: "",
    //     accountIban: "",
    //     swiftCode: "",
    //     bankAddress: "",
    //   });
    // } else {
    //   setBeneficiaryForm({
    //     paymentType: "FIAT",
    //     networkChain: "",
    //     walletAddresses: [""],
    //     bankName: selected.bankName || "",
    //     accountTitle: selected.accountTitle || "",
    //     accountNumber: selected.accountNumber || "",
    //     accountIban: selected.accountIban || "",
    //     swiftCode: selected.swiftCode || "",
    //     bankAddress: selected.bankAddress || "",
    //   });
    // }
  };

  const [receiptUploads, setReceiptUploads] = useState<Array<{ image: string; file?: File; amount: string; accountId: string }>>([{ image: "", amount: "", accountId: "" }]);
  const [paymentUploads, setPaymentUploads] = useState<Array<{ image: string; file?: File; amount: string; accountId: string }>>([{ image: "", amount: "", accountId: "" }]);
  
  // OTC Order state
  const [otcForm, setOtcForm] = useState({
    customerId: "",
    fromCurrency: "",
    toCurrency: "",
    amountBuy: "",
    amountSell: "",
    rate: "",
    handlerId: "",
  });
  const [otcReceipts, setOtcReceipts] = useState<Array<{ amount: string; accountId: string }>>([]);
  const [otcPayments, setOtcPayments] = useState<Array<{ amount: string; accountId: string }>>([]);
  const [otcProfitAmount, setOtcProfitAmount] = useState<string>("");
  const [otcProfitCurrency, setOtcProfitCurrency] = useState<string>("");
  const [otcProfitAccountId, setOtcProfitAccountId] = useState<string>("");
  const [otcServiceChargeAmount, setOtcServiceChargeAmount] = useState<string>("");
  const [otcServiceChargeCurrency, setOtcServiceChargeCurrency] = useState<string>("");
  const [otcServiceChargeAccountId, setOtcServiceChargeAccountId] = useState<string>("");
  const [showOtcProfitSection, setShowOtcProfitSection] = useState(false);
  const [showOtcServiceChargeSection, setShowOtcServiceChargeSection] = useState(false);
  const [otcCalculatedField, setOtcCalculatedField] = useState<"buy" | "sell" | null>(null);
  const [receiptDragOver, setReceiptDragOver] = useState(false);
  const [paymentDragOver, setPaymentDragOver] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<"receipt" | "payment" | null>(null);

  const { data: orderDetails } = useGetOrderDetailsQuery(viewModalOrderId || 0, {
    skip: !viewModalOrderId,
  });

  const { data: otcOrderDetails } = useGetOrderDetailsQuery(otcEditingOrderId || 0, {
    skip: !otcEditingOrderId,
  });

  // Helper function to determine which currency is the base (stronger) currency
  // Returns true if fromCurrency is base, false if toCurrency is base, null if can't determine
  const getBaseCurrency = useCallback((fromCurrency: string, toCurrency: string): boolean | null => {
    const getCurrencyRate = (code: string) => {
      const currency = currencies.find((c) => c.code === code);
      const candidate =
        currency?.conversionRateBuy ??
        currency?.baseRateBuy ??
        currency?.baseRateSell ??
        currency?.conversionRateSell;
      return typeof candidate === "number" ? candidate : null;
    };

    const fromRate = getCurrencyRate(fromCurrency);
    const toRate = getCurrencyRate(toCurrency);

    const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : fromCurrency === "USDT";
    const inferredToIsUSDT = toRate !== null ? toRate <= 1 : toCurrency === "USDT";

    // If both sides look like USDT (rate <= 1), return null
    if (inferredFromIsUSDT && inferredToIsUSDT) return null;

    if (inferredFromIsUSDT !== inferredToIsUSDT) {
      // One side is USDT (or behaves like it)
      return inferredFromIsUSDT;
    } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
      // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
      return fromRate < toRate;
    }
    return null;
  }, [currencies]);

  // Initialize flex order rate when modal opens
  useEffect(() => {
    if (orderDetails?.order && orderDetails.order.isFlexOrder) {
      const initialRate = orderDetails.order.actualRate ?? orderDetails.order.rate;
      setFlexOrderRate(
        initialRate !== undefined && initialRate !== null ? String(initialRate) : null
      );
    }
  }, [orderDetails]);

  const resolveFlexOrderRate = (details?: typeof orderDetails) => {
    const fallbackRate = details?.order?.actualRate ?? details?.order?.rate ?? 0;
    const parsedRate =
      flexOrderRate === ""
        ? 0
        : flexOrderRate !== null
          ? Number(flexOrderRate)
          : Number(fallbackRate);

    if (!Number.isFinite(parsedRate)) {
      return 0;
    }

    return parsedRate;
  };

  const resolvedFlexRate = resolveFlexOrderRate(orderDetails);

  // Track order status when modal opens
  useEffect(() => {
    if (viewModalOrderId && orderDetails?.order) {
      // Store the status when modal opens or order details load
      previousOrderStatusRef.current = orderDetails.order.status;
    } else if (!viewModalOrderId) {
      // Reset when modal closes
      previousOrderStatusRef.current = null;
    }
  }, [viewModalOrderId, orderDetails?.order?.id]);

  // Auto-close the view modal only if order transitions TO completed while modal is open
  // (not if it's already completed when user opens it)
  useEffect(() => {
    if (
      viewModalOrderId &&
      orderDetails?.order?.status === "completed" &&
      previousOrderStatusRef.current !== "completed" &&
      previousOrderStatusRef.current !== null &&
      !excessPaymentWarning
    ) {
      // Order just transitioned to completed, auto-close
      setViewModalOrderId(null);
      previousOrderStatusRef.current = null;
    }
  }, [orderDetails?.order?.status, excessPaymentWarning, viewModalOrderId]);

  // Determine if OTC order is completed/cancelled for view mode
  const isOtcCompleted = useMemo(() => {
    return otcEditingOrderId && otcOrderDetails?.order && (otcOrderDetails.order.status === "completed" || otcOrderDetails.order.status === "cancelled");
  }, [otcEditingOrderId, otcOrderDetails]);

  // Load OTC order details when editing
  useEffect(() => {
    if (otcEditingOrderId && otcOrderDetails && otcOrderDetails.order) {
      const order = otcOrderDetails.order;
      setOtcForm({
        customerId: String(order.customerId),
        fromCurrency: order.fromCurrency,
        toCurrency: order.toCurrency,
        amountBuy: String(order.amountBuy),
        amountSell: String(order.amountSell),
        rate: String(order.rate),
        handlerId: order.handlerId ? String(order.handlerId) : "",
      });
      // Load receipts and payments - ensure we have valid arrays
      const receipts = Array.isArray(otcOrderDetails.receipts) ? otcOrderDetails.receipts : [];
      const payments = Array.isArray(otcOrderDetails.payments) ? otcOrderDetails.payments : [];
      
      setOtcReceipts(receipts.map(r => ({
        amount: String(r.amount || ""),
        accountId: r.accountId ? String(r.accountId) : "",
      })));
      
      setOtcPayments(payments.map(p => ({
        amount: String(p.amount || ""),
        accountId: p.accountId ? String(p.accountId) : "",
      })));
      
      // Load profit and service charges
      if (order.profitAmount !== null && order.profitAmount !== undefined) {
        setOtcProfitAmount(String(order.profitAmount));
        setOtcProfitCurrency(order.profitCurrency || "");
        setOtcProfitAccountId(order.profitAccountId ? String(order.profitAccountId) : "");
        setShowOtcProfitSection(true);
      }
      if (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined) {
        setOtcServiceChargeAmount(String(order.serviceChargeAmount));
        setOtcServiceChargeCurrency(order.serviceChargeCurrency || "");
        setOtcServiceChargeAccountId(order.serviceChargeAccountId ? String(order.serviceChargeAccountId) : "");
        setShowOtcServiceChargeSection(true);
      }
    }
  }, [otcEditingOrderId, otcOrderDetails]);

  const resetForm = () => {
    setForm({
      customerId: "",
      fromCurrency: "",
      toCurrency: "",
      amountBuy: "",
      amountSell: "",
      rate: "",
      status: "pending",
    });
    setCalculatedField(null);
  };

  const resetProcessForm = () => {
    setProcessForm({
      handlerId: "",
      paymentFlow: "receive_first",
      // Commented out for future use:
      // paymentType: "CRYPTO",
      // networkChain: "",
      // walletAddresses: [""],
      // bankName: "",
      // accountTitle: "",
      // accountNumber: "",
      // accountIban: "",
      // swiftCode: "",
      // bankAddress: "",
    });
  };

  const resetBeneficiaryForm = () => {
    setBeneficiaryForm({
      paymentAccountId: "",
      // Commented out for future use:
      // paymentType: "CRYPTO",
      // networkChain: "",
      // walletAddresses: [""],
      // bankName: "",
      // accountTitle: "",
      // accountNumber: "",
      // accountIban: "",
      // swiftCode: "",
      // bankAddress: "",
    });
    setSaveBeneficiaryToCustomer(false);
    setSelectedCustomerBeneficiaryId("");
  };

  const resetOtcForm = () => {
    setOtcForm({
      customerId: "",
      fromCurrency: "",
      toCurrency: "",
      amountBuy: "",
      amountSell: "",
      rate: "",
      handlerId: "",
    });
    setOtcReceipts([]);
    setOtcPayments([]);
    setOtcProfitAmount("");
    setOtcProfitCurrency("");
    setOtcProfitAccountId("");
    setOtcServiceChargeAmount("");
    setOtcServiceChargeCurrency("");
    setOtcServiceChargeAccountId("");
    setShowOtcProfitSection(false);
    setShowOtcServiceChargeSection(false);
    setOtcCalculatedField(null);
  };

  const closeOtcModal = () => {
    resetOtcForm();
    setIsOtcOrderModalOpen(false);
    setOtcEditingOrderId(null);
  };
 /*  // When fromCurrency or toCurrency changes, fetch the buy and sell rates for the selected non-USDT currency (rates are against USDT)
  useEffect(() => {
    const fetchConversionRates = async () => {
      let currency = null;
      // Only fetch for the currency that is NOT USDT, and only if one is USDT and one is not
      if (form.fromCurrency === "USDT" && form.toCurrency && form.toCurrency !== "USDT") {
        currency = form.toCurrency;
      } else if (form.toCurrency === "USDT" && form.fromCurrency && form.fromCurrency !== "USDT") {
        currency = form.fromCurrency;
      } else {
        // If both are USDT or both are non-USDT or missing, do nothing
        return;
      }
      try {
        // Replace with your actual endpoint or API method
        const response = await fetch(`/api/exchange-rates/${currency}`);
        if (!response.ok) {
          // Handles HTTP 404s or others gracefully
          console.warn(`Exchange rates endpoint not found for: ${currency}`);
          return;
        }
        // Attempt to parse only if the response is JSON
        const contentType = response.headers.get("Content-Type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(`Exchange rates response for ${currency} is not valid JSON`);
          return;
        }
        const data = await response.json();
        // Suppose the response structure is { buy: 284.5, sell: 286 }
        if (data && typeof data.buy !== 'undefined' && typeof data.sell !== 'undefined') {
          console.log(`Buy rate for ${currency} against USDT: ${data.buy}`);
          console.log(`Sell rate for ${currency} against USDT: ${data.sell}`);
        } else {
          console.log(`Could not fetch valid conversion rates for ${currency} against USDT`);
        }
      } catch (error) {
        console.log(`Error fetching conversion rates for ${currency} against USDT:`, error);
      }
    };
    fetchConversionRates();
  }, [form.fromCurrency, form.toCurrency]); */



  // Auto-calculate amount when rate or source amount changes
  useEffect(() => {
    if (!form.rate || form.rate === "0" || !calculatedField) return;
    if (!form.fromCurrency || !form.toCurrency) return;

    const rate = Number(form.rate);
    if (isNaN(rate) || rate <= 0) return;

    // Determine which side is the "stronger" currency so we know which way to apply the rate.
    // Heuristic: USDT (or any currency with rate <= 1) is the base; otherwise pick the currency with the smaller rate.
    const getCurrencyRate = (code: string) => {
      const currency = currencies.find((c) => c.code === code);
      const candidate =
        currency?.conversionRateBuy ??
        currency?.baseRateBuy ??
        currency?.baseRateSell ??
        currency?.conversionRateSell;
      return typeof candidate === "number" ? candidate : null;
    };

    const fromRate = getCurrencyRate(form.fromCurrency);
    const toRate = getCurrencyRate(form.toCurrency);

    const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : form.fromCurrency === "USDT";
    const inferredToIsUSDT = toRate !== null ? toRate <= 1 : form.toCurrency === "USDT";

    // If both sides look like USDT (rate <= 1), nothing to auto-calc
    if (inferredFromIsUSDT && inferredToIsUSDT) return;

    let baseIsFrom: boolean | null = null;
    if (inferredFromIsUSDT !== inferredToIsUSDT) {
      // One side is USDT (or behaves like it)
      baseIsFrom = inferredFromIsUSDT;
    } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
      // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
      baseIsFrom = fromRate < toRate;
    } else {
      return;
    }

    if (calculatedField === "buy" && form.amountBuy) {
      const buyAmount = Number(form.amountBuy);
      if (!isNaN(buyAmount) && buyAmount > 0) {
        let sellAmount: string;
        if (baseIsFrom) {
          // Stronger/base currency → weaker: multiply by rate
          sellAmount = (buyAmount * rate).toFixed(2);
        } else {
          // Weaker → stronger/base: divide by rate
          sellAmount = (buyAmount / rate).toFixed(2);
        }
        setForm((prev) => ({ ...prev, amountSell: sellAmount }));
      }
    } else if (calculatedField === "sell" && form.amountSell) {
      const sellAmount = Number(form.amountSell);
      if (!isNaN(sellAmount) && sellAmount > 0) {
        let buyAmount: string;
        if (baseIsFrom) {
          // Stronger/base currency → weaker: divide to get base amount
          buyAmount = (sellAmount / rate).toFixed(2);
        } else {
          // Weaker → stronger/base: multiply to get base amount
          buyAmount = (sellAmount * rate).toFixed(2);
        }
        setForm((prev) => ({ ...prev, amountBuy: buyAmount }));
      }
    }
  }, [form.rate, form.amountBuy, form.amountSell, calculatedField, form.fromCurrency, form.toCurrency, currencies]);

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
    setEditingOrderId(null);
    setIsFlexOrderMode(false);
  };

  const resetCustomerForm = () => {
    setCustomerForm({
      name: "",
      email: "",
      phone: "",
    });
  };

  const handleCreateCustomer = async (event: FormEvent) => {
    event.preventDefault();
    if (!customerForm.name) return;
    
    try {
      const newCustomer = await addCustomer({
        name: customerForm.name,
        email: customerForm.email || "",
        phone: customerForm.phone || "",
        id: undefined,
      }).unwrap();
      
      // Select the newly created customer
      if (newCustomer?.id) {
        setForm((p) => ({ ...p, customerId: String(newCustomer.id) }));
      }
      
      resetCustomerForm();
      setIsCreateCustomerModalOpen(false);
    } catch (error) {
      console.error("Error creating customer:", error);
    }
  };

  const startEdit = useCallback((orderId: number) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    
    // Check if it's an OTC order
    if (order.orderType === "otc") {
      // Open OTC modal for editing/viewing (OTC orders can be viewed/edited in OTC modal regardless of status)
      setOtcEditingOrderId(orderId);
      setOtcForm({
        customerId: String(order.customerId),
        fromCurrency: order.fromCurrency,
        toCurrency: order.toCurrency,
        amountBuy: String(order.amountBuy),
        amountSell: String(order.amountSell),
        rate: String(order.rate),
        handlerId: order.handlerId ? String(order.handlerId) : "",
      });
      setIsOtcOrderModalOpen(true);
      setOpenMenuId(null);
      // Load receipts, payments, profit, service charges via orderDetails query
      return;
    }
    
    // For non-OTC orders, only allow editing if status is pending
    if (order.status !== "pending") return;
    
    setEditingOrderId(orderId);
    setForm({
      customerId: String(order.customerId),
      fromCurrency: order.fromCurrency,
      toCurrency: order.toCurrency,
      amountBuy: String(order.amountBuy),
      amountSell: String(order.amountSell),
      rate: String(order.rate),
      status: order.status,
    });
    setIsModalOpen(true);
    setOpenMenuId(null);
  }, [orders]);

  const closeProcessModal = () => {
    resetProcessForm();
    setProcessModalOrderId(null);
  };

  const closeViewModal = () => {
    setViewModalOrderId(null);
    setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
    setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
    setReceiptUploadKey(0);
    setPaymentUploadKey(0);
    setFlexOrderRate(null);
    setExcessPaymentWarning(null);
    // Reset profit and service charge state
    setProfitAmount("");
    setProfitCurrency("");
    setProfitAccountId("");
    setServiceChargeAmount("");
    setServiceChargeCurrency("");
    setServiceChargeAccountId("");
    setShowProfitSection(false);
    setShowServiceChargeSection(false);
    setShowReceiptUpload(false);
    setShowPaymentUpload(false);
    setShowServiceChargeSection(false);
    // Clear refs
    receiptFileInputRefs.current = {};
    paymentFileInputRefs.current = {};
  };

  const closeMakePaymentModal = () => {
    resetBeneficiaryForm();
    setMakePaymentModalOrderId(null);
    setSaveBeneficiaryToCustomer(false);
    setSelectedCustomerBeneficiaryId("");
  };

  // OTC Order handlers
  const handleOtcOrderSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!otcForm.customerId || !otcForm.fromCurrency || !otcForm.toCurrency) return;

    try {
      let orderId: number;
      
      if (otcEditingOrderId) {
        // Update existing order
        await updateOrder({
          id: otcEditingOrderId,
          data: {
            customerId: Number(otcForm.customerId),
            fromCurrency: otcForm.fromCurrency,
            toCurrency: otcForm.toCurrency,
            amountBuy: Number(otcForm.amountBuy || 0),
            amountSell: Number(otcForm.amountSell || 0),
            rate: Number(otcForm.rate || 1),
          },
        }).unwrap();
        orderId = otcEditingOrderId;
      } else {
        // Create new OTC order
        const newOrder = await addOrder({
          customerId: Number(otcForm.customerId),
          fromCurrency: otcForm.fromCurrency,
          toCurrency: otcForm.toCurrency,
          amountBuy: Number(otcForm.amountBuy || 0),
          amountSell: Number(otcForm.amountSell || 0),
          rate: Number(otcForm.rate || 1),
          status: "pending",
          orderType: "otc",
        }).unwrap();
        orderId = newOrder.id;
      }

      // Assign handler if selected (use updateOrder to keep status as pending)
      if (otcForm.handlerId) {
        await updateOrder({
          id: orderId,
          data: {
            handlerId: Number(otcForm.handlerId),
          },
        }).unwrap();
      }

      // Delete existing receipts and payments when editing, then recreate from form
      if (otcEditingOrderId && otcOrderDetails) {
        // Delete existing receipts
        for (const receipt of otcOrderDetails.receipts || []) {
          try {
            await deleteReceipt(receipt.id).unwrap();
          } catch (error) {
            console.error("Error deleting receipt:", error);
          }
        }
        // Delete existing payments
        for (const payment of otcOrderDetails.payments || []) {
          try {
            await deletePayment(payment.id).unwrap();
          } catch (error) {
            console.error("Error deleting payment:", error);
          }
        }
      }

      // Create receipts (without image for OTC orders)
      for (const receipt of otcReceipts) {
        const receiptAmount = Number(receipt.amount) || 0;
        if (receiptAmount !== 0 && receipt.accountId) {
          await addReceipt({
            id: orderId,
            amount: receiptAmount,
            accountId: Number(receipt.accountId),
            imagePath: "", // Empty for OTC orders - backend will use placeholder
          } as any).unwrap();
        }
      }

      // Create payments (without image for OTC orders)
      for (const payment of otcPayments) {
        const paymentAmount = Number(payment.amount) || 0;
        if (paymentAmount !== 0 && payment.accountId) {
          await addPayment({
            id: orderId,
            amount: paymentAmount,
            accountId: Number(payment.accountId),
            imagePath: "", // Empty for OTC orders - backend will use placeholder
          } as any).unwrap();
        }
      }

      // Add profit if provided
      if (otcProfitAmount && otcProfitAccountId && otcProfitCurrency) {
        await updateOrder({
          id: orderId,
          data: {
            profitAmount: Number(otcProfitAmount),
            profitCurrency: otcProfitCurrency,
            profitAccountId: Number(otcProfitAccountId),
          },
        }).unwrap();
      }

      // Add service charges if provided
      if (otcServiceChargeAmount && otcServiceChargeAccountId && otcServiceChargeCurrency) {
        await updateOrder({
          id: orderId,
          data: {
            serviceChargeAmount: Number(otcServiceChargeAmount),
            serviceChargeCurrency: otcServiceChargeCurrency,
            serviceChargeAccountId: Number(otcServiceChargeAccountId),
          },
        }).unwrap();
      }

      closeOtcModal();
    } catch (error: any) {
      console.error("Error saving OTC order:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to save OTC order";
      alert(errorMessage);
    }
  };

  const handleOtcOrderComplete = async (event: FormEvent) => {
    event.preventDefault();
    if (!otcForm.customerId || !otcForm.fromCurrency || !otcForm.toCurrency) return;

    // Validate handler is assigned
    if (!otcForm.handlerId) {
      alert("Handler must be assigned before completing the order");
      return;
    }

    // Validate that all receipts with amounts have accounts selected
    const receiptsWithoutAccounts = otcReceipts.filter(
      (r) => (Number(r.amount) || 0) > 0 && !r.accountId
    );
    if (receiptsWithoutAccounts.length > 0) {
      alert("All receipts with amounts must have an account selected. Please select accounts for all receipts with amounts.");
      return;
    }

    // Validate that all payments with amounts have accounts selected
    const paymentsWithoutAccounts = otcPayments.filter(
      (p) => (Number(p.amount) || 0) > 0 && !p.accountId
    );
    if (paymentsWithoutAccounts.length > 0) {
      alert("All payments with amounts must have an account selected. Please select accounts for all payments with amounts.");
      return;
    }

    // Validate receipt total equals amountBuy
    const receiptTotal = otcReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const amountBuy = Number(otcForm.amountBuy || 0);
    if (Math.abs(receiptTotal - amountBuy) > 0.01) {
      alert(`Receipt total (${receiptTotal.toFixed(2)}) must equal Amount Buy (${amountBuy.toFixed(2)})`);
      return;
    }

    // Validate payment total equals amountSell
    const paymentTotal = otcPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const amountSell = Number(otcForm.amountSell || 0);
    if (Math.abs(paymentTotal - amountSell) > 0.01) {
      alert(`Payment total (${paymentTotal.toFixed(2)}) must equal Amount Sell (${amountSell.toFixed(2)})`);
      return;
    }

    try {
      let orderId: number;
      
      if (otcEditingOrderId) {
        // Update existing order
        await updateOrder({
          id: otcEditingOrderId,
          data: {
            customerId: Number(otcForm.customerId),
            fromCurrency: otcForm.fromCurrency,
            toCurrency: otcForm.toCurrency,
            amountBuy: Number(otcForm.amountBuy || 0),
            amountSell: Number(otcForm.amountSell || 0),
            rate: Number(otcForm.rate || 1),
          },
        }).unwrap();
        orderId = otcEditingOrderId;
      } else {
        // Create new OTC order
        const newOrder = await addOrder({
          customerId: Number(otcForm.customerId),
          fromCurrency: otcForm.fromCurrency,
          toCurrency: otcForm.toCurrency,
          amountBuy: Number(otcForm.amountBuy || 0),
          amountSell: Number(otcForm.amountSell || 0),
          rate: Number(otcForm.rate || 1),
          status: "pending",
          orderType: "otc",
        }).unwrap();
        orderId = newOrder.id;
      }

      // Assign handler
      await processOrder({
        id: orderId,
        handlerId: Number(otcForm.handlerId),
      }).unwrap();

      // Delete existing receipts and payments when editing, then recreate from form
      if (otcEditingOrderId && otcOrderDetails) {
        // Delete existing receipts
        for (const receipt of otcOrderDetails.receipts || []) {
          try {
            await deleteReceipt(receipt.id).unwrap();
          } catch (error) {
            console.error("Error deleting receipt:", error);
          }
        }
        // Delete existing payments
        for (const payment of otcOrderDetails.payments || []) {
          try {
            await deletePayment(payment.id).unwrap();
          } catch (error) {
            console.error("Error deleting payment:", error);
          }
        }
      }

      // Create and confirm receipts
      for (const receipt of otcReceipts) {
        const receiptAmount = Number(receipt.amount) || 0;
        if (receiptAmount !== 0 && receipt.accountId) {
          const receiptResult = await addReceipt({
            id: orderId,
            amount: receiptAmount,
            accountId: Number(receipt.accountId),
            imagePath: "",
          } as any).unwrap();
          // Confirm receipt immediately for OTC orders
          await confirmReceipt((receiptResult as any).id).unwrap();
        }
      }

      // Create and confirm payments
      for (const payment of otcPayments) {
        const paymentAmount = Number(payment.amount) || 0;
        if (paymentAmount !== 0 && payment.accountId) {
          const paymentResult = await addPayment({
            id: orderId,
            amount: paymentAmount,
            accountId: Number(payment.accountId),
            imagePath: "",
          } as any).unwrap();
          // Confirm payment immediately for OTC orders
          await confirmPayment((paymentResult as any).id).unwrap();
        }
      }

      // Add profit if provided
      if (otcProfitAmount && otcProfitAccountId && otcProfitCurrency) {
        await updateOrder({
          id: orderId,
          data: {
            profitAmount: Number(otcProfitAmount),
            profitCurrency: otcProfitCurrency,
            profitAccountId: Number(otcProfitAccountId),
          },
        }).unwrap();
      }

      // Add service charges if provided
      if (otcServiceChargeAmount && otcServiceChargeAccountId && otcServiceChargeCurrency) {
        await updateOrder({
          id: orderId,
          data: {
            serviceChargeAmount: Number(otcServiceChargeAmount),
            serviceChargeCurrency: otcServiceChargeCurrency,
            serviceChargeAccountId: Number(otcServiceChargeAccountId),
          },
        }).unwrap();
      }

      // Complete the order
      await updateOrderStatus({
        id: orderId,
        status: "completed",
      }).unwrap();

      closeOtcModal();
    } catch (error: any) {
      console.error("Error completing OTC order:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to complete OTC order";
      alert(errorMessage);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.customerId || !form.fromCurrency || !form.toCurrency) return;
    
    if (editingOrderId) {
      // Update existing order
      await updateOrder({
        id: editingOrderId,
        data: {
          customerId: Number(form.customerId),
          fromCurrency: form.fromCurrency,
          toCurrency: form.toCurrency,
          amountBuy: Number(form.amountBuy || 0),
          amountSell: Number(form.amountSell || 0),
          rate: Number(form.rate || 1),
        },
      }).unwrap();
      resetForm();
      setEditingOrderId(null);
      setIsModalOpen(false);
    } else {
      // Create new order (regular or flex)
      const newOrder = await addOrder({
        customerId: Number(form.customerId),
        fromCurrency: form.fromCurrency,
        toCurrency: form.toCurrency,
        amountBuy: Number(form.amountBuy || 0),
        amountSell: Number(form.amountSell || 0),
        rate: Number(form.rate || 1),
        status: form.status,
        isFlexOrder: isFlexOrderMode,
      }).unwrap();
      resetForm();
      setIsModalOpen(false);
      setIsFlexOrderMode(false);
      
      // Automatically open Process Order modal for the newly created order
      if (newOrder?.id) {
        setProcessModalOrderId(newOrder.id);
      }
    }
  };

  const handleProcess = async (event: FormEvent) => {
    event.preventDefault();
    if (!processModalOrderId || !processForm.handlerId) return;

    const currentOrder = orders.find((o) => o.id === processModalOrderId);
    const isFlex = currentOrder?.isFlexOrder;

    const payload: any = {
      id: processModalOrderId,
      handlerId: Number(processForm.handlerId),
    };

    // Commented out for future use:
    // paymentType: processForm.paymentType,
    // if (processForm.paymentType === "CRYPTO") {
    //   payload.networkChain = processForm.networkChain;
    //   payload.walletAddresses = processForm.walletAddresses.filter((addr) => addr.trim());
    // } else {
    //   payload.bankDetails = {
    //     bankName: processForm.bankName,
    //     accountTitle: processForm.accountTitle,
    //     accountNumber: processForm.accountNumber,
    //     accountIban: processForm.accountIban,
    //     swiftCode: processForm.swiftCode,
    //     bankAddress: processForm.bankAddress,
    //   };
    // }

    try {
      await processOrder(payload).unwrap();
      resetProcessForm();
      setProcessModalOrderId(null);
      setOpenMenuId(null);
    } catch (error: any) {
      console.error("Error processing order:", error);
      const errorMessage = error?.data?.message || error?.message || t("orders.failedToProcessOrder");
      alert(errorMessage);
    }
  };

  const handleAddReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!viewModalOrderId || !orderDetails) return;

    // Validate that all uploads with image and amount also have accountId
    for (const upload of receiptUploads) {
      if (upload.image && upload.amount) {
        if (!upload.accountId || upload.accountId === "") {
          alert(t("orders.accountSelectionRequired"));
          return;
        }
      }
    }

    // For normal orders (not flex orders), validate that total receipts don't exceed order amount
    const currentOrder = orderDetails.order;
    if (!currentOrder.isFlexOrder) {
      // Calculate total amount of new receipts being uploaded
      let newReceiptTotal = 0;
      for (const upload of receiptUploads) {
        if (upload.image && upload.amount && upload.accountId) {
          newReceiptTotal += Number(upload.amount);
        }
      }

      // Get existing total receipt amount (not balance - balance is the remaining amount)
      const existingReceiptTotal = orderDetails.totalReceiptAmount || 0;
      
      // Calculate total receipts (existing + new)
      const totalReceipts = existingReceiptTotal + newReceiptTotal;
      
      // Only block if total exceeds order amount (allow partial uploads)
      if (totalReceipts > currentOrder.amountBuy) {
        // Excess is the amount by which the total receipts (existing + new) exceed the order amount
        const excess = totalReceipts - currentOrder.amountBuy;
        setExcessReceiptModalData({
          expectedReceipt: currentOrder.amountBuy,
          attemptedReceipt: totalReceipts, // Show total (existing + new) in the modal
          excess: excess,
          fromCurrency: currentOrder.fromCurrency,
        });
        setShowExcessReceiptModal(true);
        return; // Prevent submission
      }
    }

    // Process all valid uploads
    for (const upload of receiptUploads) {
      if (upload.image && upload.amount && upload.accountId) {
        const payload: any = {
          id: viewModalOrderId,
          amount: Number(upload.amount),
          accountId: Number(upload.accountId),
        };
        
        // Send File object if available, otherwise fallback to base64 (backward compatibility)
        if (upload.file) {
          payload.file = upload.file;
        } else {
          payload.imagePath = upload.image;
        }
        
        await addReceipt(payload).unwrap();
      }
    }

    // Reset file inputs
    Object.values(receiptFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    // Clear uploads and hide the upload section
    setReceiptUploads([]);
    setReceiptUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    setShowReceiptUpload(false); // Hide the upload section after successful upload
    
  };

  const handleAddBeneficiary = async (event: FormEvent) => {
    event.preventDefault();
    if (!makePaymentModalOrderId || !beneficiaryForm.paymentAccountId) return;

    // Get order and account details for balance validation
    const paymentOrder = orders.find((o) => o.id === makePaymentModalOrderId);
    const selectedAccount = accounts.find((a) => a.id === Number(beneficiaryForm.paymentAccountId));
    
    if (paymentOrder && selectedAccount) {
      const requiredAmount = paymentOrder.amountSell;
      const currentBalance = selectedAccount.balance;
      
      // Check if account has insufficient funds
      if (currentBalance < requiredAmount) {
        const newBalance = currentBalance - requiredAmount;
        const confirmMessage = t("orders.insufficientBalanceWarning", {
          accountName: selectedAccount.name,
          currentBalance: currentBalance.toFixed(2),
          currency: selectedAccount.currencyCode,
          requiredAmount: requiredAmount.toFixed(2),
          newBalance: newBalance.toFixed(2)
        });
        
        if (!window.confirm(confirmMessage)) {
          return; // User cancelled
        }
      }
    }

    const payload: any = {
      id: makePaymentModalOrderId,
      paymentAccountId: Number(beneficiaryForm.paymentAccountId),
      // Commented out for future use:
      // paymentType: beneficiaryForm.paymentType,
      // if (beneficiaryForm.paymentType === "CRYPTO") {
      //   payload.networkChain = beneficiaryForm.networkChain;
      //   payload.walletAddresses = beneficiaryForm.walletAddresses.filter((addr) => addr.trim());
      // } else {
      //   payload.bankName = beneficiaryForm.bankName;
      //   payload.accountTitle = beneficiaryForm.accountTitle;
      //   payload.accountNumber = beneficiaryForm.accountNumber;
      //   payload.accountIban = beneficiaryForm.accountIban;
      //   payload.swiftCode = beneficiaryForm.swiftCode;
      //   payload.bankAddress = beneficiaryForm.bankAddress;
      // }
    };

    await addBeneficiary(payload);
    // Commented out for future use:
    // if (saveBeneficiaryToCustomer && makePaymentOrder?.customerId) {
    //   const customerPayload = { ...payload, customerId: makePaymentOrder.customerId };
    //   delete customerPayload.id;
    //   await addCustomerBeneficiary(customerPayload);
    // }
    resetBeneficiaryForm();
    const orderId = makePaymentModalOrderId;
    setMakePaymentModalOrderId(null);
    setOpenMenuId(null);
    
    setViewModalOrderId(orderId);
  };

  const handleAddPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!viewModalOrderId || !orderDetails) return;

    // Validate that all uploads have required fields
    for (const upload of paymentUploads) {
      if (upload.image && upload.amount) {
        if (!upload.accountId) {
          alert(t("orders.accountSelectionRequired"));
          return;
        }
      }
    }

    const currentOrder = orderDetails.order;
    const isFlex = currentOrder?.isFlexOrder;

    // For normal orders (not flex orders), validate that total payments don't exceed order amount
    if (!isFlex) {
      // Calculate total amount of new payments being uploaded
      let newPaymentTotal = 0;
      for (const upload of paymentUploads) {
        if (upload.image && upload.amount && upload.accountId) {
          newPaymentTotal += Number(upload.amount);
        }
      }

      // Get existing total payment amount (not balance - balance is the remaining amount)
      const existingPaymentTotal = orderDetails.totalPaymentAmount || 0;
      
      // Calculate total payments (existing + new)
      const totalPayments = existingPaymentTotal + newPaymentTotal;
      
      // Only block if total exceeds order amount (allow partial uploads)
      if (totalPayments > currentOrder.amountSell) {
        // Excess is the amount by which the total payments (existing + new) exceed the order amount
        const excess = totalPayments - currentOrder.amountSell;
        setExcessPaymentModalNormalData({
          expectedPayment: currentOrder.amountSell,
          attemptedPayment: totalPayments, // Show total (existing + new) in the modal
          excess: excess,
          toCurrency: currentOrder.toCurrency,
        });
        setShowExcessPaymentModalNormal(true);
        return; // Prevent submission
      }
    }

    // Note: Exchange rate should be updated using the "Update Exchange Rate" button
    // We don't auto-update it during payment upload to give user control

    for (const upload of paymentUploads) {
      if (upload.image && upload.amount) {
        const payload: any = {
          id: viewModalOrderId,
          amount: Number(upload.amount),
          accountId: Number(upload.accountId),
        };
        
        // Send File object if available, otherwise fallback to base64 (backward compatibility)
        if (upload.file) {
          payload.file = upload.file;
        } else {
          payload.imagePath = upload.image;
        }
        
        try {
          const result = await addPayment(payload).unwrap();
          
          // Check for excess payment warning in flex orders
          if (isFlex && (result as any).flexOrderExcess) {
            setExcessPaymentWarning({
              excessAmount: (result as any).flexOrderExcess.excessAmount,
              additionalReceiptsNeeded: (result as any).flexOrderExcess.additionalReceiptsNeeded,
            });
          }
        } catch (error) {
          console.error("Error adding payment:", error);
        }
      }
    }

    // Reset file inputs
    Object.values(paymentFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    // Clear uploads and hide the upload section
    setPaymentUploads([]);
    setPaymentUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    setShowPaymentUpload(false); // Hide the upload section after successful upload
    
  };

  const handleImageUpload = (file: File, index: number, type: "receipt" | "payment") => {
    // Check if file is an image or PDF
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    
    if (!isImage && !isPDF) {
      alert(t("orders.pleaseUploadImageOrPdf"));
      return;
    }
    
    // Store the File object immediately
    if (type === "receipt") {
      setReceiptUploads((prev) => {
        const newUploads = [...prev];
        newUploads[index] = { ...newUploads[index], file };
        return newUploads;
      });
    } else {
      setPaymentUploads((prev) => {
        const newUploads = [...prev];
        newUploads[index] = { ...newUploads[index], file };
        return newUploads;
      });
    }
    
    // Convert to base64 for preview (keep existing behavior)
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "receipt") {
        setReceiptUploads((prev) => {
          const newUploads = [...prev];
          newUploads[index] = { ...newUploads[index], image: base64 };
          return newUploads;
        });
      } else {
        setPaymentUploads((prev) => {
          const newUploads = [...prev];
          newUploads[index] = { ...newUploads[index], image: base64 };
          return newUploads;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: "receipt" | "payment") => {
    e.preventDefault();
    if (type === "receipt") {
      setReceiptDragOver(false);
    } else {
      setPaymentDragOver(false);
    }

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
    if (validFiles.length > 0) {
      handleImageUpload(validFiles[0], index, type);
    }
  };

  const handleDragOver = (e: React.DragEvent, type: "receipt" | "payment") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "receipt") {
      setReceiptDragOver(true);
    } else {
      setPaymentDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent, type: "receipt" | "payment") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "receipt") {
      setReceiptDragOver(false);
    } else {
      setPaymentDragOver(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, type: "receipt" | "payment") => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file, index, type);
    }
  };

  // Handle paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste when modal is open
      if (!viewModalOrderId && !makePaymentModalOrderId) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Determine which upload type is active based on which modal is open
            const uploadType = activeUploadType || (viewModalOrderId ? "receipt" : "payment");
            
            if (uploadType === "receipt") {
              setReceiptUploads((prev) => {
                const emptyIndex = prev.findIndex(u => !u.image);
                const targetIndex = emptyIndex !== -1 ? emptyIndex : prev.length;
                const updated = [...prev];
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  updated.push({ image: "", amount: "", accountId: "" });
                }
                
                // Store File object
                if (!updated[targetIndex]) {
                  updated[targetIndex] = { image: "", amount: "", accountId: "" };
                }
                updated[targetIndex] = { ...updated[targetIndex], file };
                
                // Convert to base64 for preview
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = reader.result as string;
                  setReceiptUploads((current) => {
                    const finalUpdated = [...current];
                    if (!finalUpdated[targetIndex]) {
                      finalUpdated[targetIndex] = { image: "", amount: "", accountId: "" };
                    }
                    finalUpdated[targetIndex] = { ...finalUpdated[targetIndex], image: base64 };
                    return finalUpdated;
                  });
                };
                reader.readAsDataURL(file);
                
                return updated;
              });
            } else {
              setPaymentUploads((prev) => {
                const emptyIndex = prev.findIndex(u => !u.image);
                const targetIndex = emptyIndex !== -1 ? emptyIndex : prev.length;
                
                // Store File object and process for preview
                setPaymentUploads((current) => {
                  const updated = [...current];
                  if (!updated[targetIndex]) {
                    updated[targetIndex] = { image: "", amount: "", accountId: "" };
                  }
                  const existing = updated[targetIndex];
                  updated[targetIndex] = { ...existing, file };
                  return updated;
                });
                
                // Convert to base64 for preview
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = reader.result as string;
                  setPaymentUploads((current) => {
                    const updated = [...current];
                    if (!updated[targetIndex]) {
                      updated[targetIndex] = { image: "", amount: "", accountId: "" };
                    }
                    const existing = updated[targetIndex];
                    updated[targetIndex] = { image: base64, amount: existing.amount, accountId: existing.accountId, file: existing.file };
                    return updated;
                  });
                };
                reader.readAsDataURL(file);
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  return [...prev, { image: "", amount: "", accountId: "" }];
                }
                return prev;
              });
            }
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [viewModalOrderId, makePaymentModalOrderId, activeUploadType]);

  // Helper function to determine if a file path is an image or PDF
  const getFileType = useCallback((imagePath: string): 'image' | 'pdf' | null => {
    if (!imagePath) return null;
    
    // Check for base64 data URLs
    if (imagePath.startsWith('data:image/')) return 'image';
    if (imagePath.startsWith('data:application/pdf')) return 'pdf';
    
    // Check for server URLs (e.g., /api/uploads/orders/...)
    if (imagePath.startsWith('/api/uploads/')) {
      const lowerPath = imagePath.toLowerCase();
      if (lowerPath.endsWith('.pdf')) return 'pdf';
      if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || 
          lowerPath.endsWith('.png') || lowerPath.endsWith('.gif') || 
          lowerPath.endsWith('.webp')) return 'image';
    }
    
    return null;
  }, []);

  const setStatus = useCallback(async (id: number, status: OrderStatus) => {
    await updateOrderStatus({ id, status });
    setOpenMenuId(null);
  }, [updateOrderStatus]);

  const handleDeleteClick = useCallback((id: number) => {
    setConfirmModal({
      isOpen: true,
      message: t("orders.confirmDeleteOrder") || "Are you sure you want to delete this order?",
      orderId: id,
      isBulk: false,
    });
    setOpenMenuId(null);
  }, [t]);

  const handleDelete = async (id: number) => {
    try {
      await deleteOrder(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
    } catch (error: any) {
      let message = "Cannot delete order. An error occurred.";
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedOrderIds.map((id) => deleteOrder(id).unwrap()));
      setSelectedOrderIds([]);
      setIsBatchDeleteMode(false);
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
    } catch (error: any) {
      let message = "Cannot delete orders. An error occurred.";
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const currentRole = useMemo(() => roles.find((r) => r.name === authUser?.role), [roles, authUser?.role]);
  const canCancelOrder = useMemo(() => Boolean(currentRole?.permissions?.actions?.cancelOrder), [currentRole]);
  const canDeleteOrder = useMemo(() => Boolean(currentRole?.permissions?.actions?.deleteOrder), [currentRole]);
  const canDeleteManyOrders = useMemo(() => Boolean(currentRole?.permissions?.actions?.deleteManyOrders), [currentRole]);

  const getActionButtons = useCallback((order: typeof orders[0]) => {
    const buttons = [];
    
    if (order.status === "pending") {
      buttons.push(
        <button
          key="edit"
          className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => startEdit(order.id)}
        >
          {t("common.edit")}
        </button>
      );
      buttons.push(
        <button
          key="process"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50"
          onClick={() => {
            setProcessModalOrderId(order.id);
            setOpenMenuId(null);
          }}
        >
          {t("orders.process")}
        </button>
      );
    }


    if (order.status === "under_process") {
      // For OTC orders, show Edit button to open OTC modal
      if (order.orderType === "otc") {
        buttons.push(
          <button
            key="edit"
            className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-slate-50 first:rounded-t-lg"
            onClick={() => startEdit(order.id)}
          >
            {t("common.edit")}
          </button>
        );
      } else {
        // Show View button for regular orders under process
        buttons.push(
          <button
            key="view"
            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
            onClick={() => {
              setViewModalOrderId(order.id);
              setOpenMenuId(null);
            }}
          >
            {t("orders.view")}
          </button>
        );
      }
    }

    if (order.status === "completed" || order.status === "cancelled") {
      // For OTC orders, show Edit button to open OTC modal (even for completed/cancelled, but it should be view-only in modal)
      if (order.orderType === "otc") {
        buttons.push(
          <button
            key="edit"
            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
            onClick={() => startEdit(order.id)}
          >
            {t("orders.view")}
          </button>
        );
      } else {
        buttons.push(
          <button
            key="view"
            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
            onClick={() => {
              setViewModalOrderId(order.id);
              setOpenMenuId(null);
            }}
          >
            {t("orders.view")}
          </button>
        );
      }
    }

    // Don't show Cancel button for completed or cancelled orders or when role lacks permission
    if (canCancelOrder && order.status !== "completed" && order.status !== "cancelled") {
      buttons.push(
        <button
          key="cancel"
          className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-slate-50"
          onClick={() => setStatus(order.id, "cancelled")}
        >
          {t("orders.cancel")}
        </button>
      );
    }

    if (canDeleteOrder) {
      buttons.push(
        <button
          key="delete"
          className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 last:rounded-b-lg border-t border-slate-200"
          onClick={() => handleDeleteClick(order.id)}
          disabled={isDeleting}
        >
          {isDeleting ? t("common.deleting") : t("orders.delete")}
        </button>
      );
    }

    return buttons;
  }, [startEdit, setProcessModalOrderId, setViewModalOrderId, setOpenMenuId, setStatus, handleDeleteClick, canCancelOrder, canDeleteOrder, isDeleting, t]);

  const getStatusTone = useCallback((status: OrderStatus) => {
    switch (status) {
      case "pending":
        return "amber";
      case "under_process":
        return "blue";
      case "completed":
        return "emerald";
      case "cancelled":
        return "rose";
      default:
        return "slate";
    }
  }, []);

  // Helper function to open PDF data URI in a new tab
  const openPdfInNewTab = useCallback((dataUri: string) => {
    // If it's a server URL, open it directly
    if (dataUri.startsWith('/api/uploads/')) {
      window.open(dataUri, '_blank');
      return;
    }
    
    try {
      // Convert data URI to blob
      const byteString = atob(dataUri.split(',')[1]);
      const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      
      // Open in new tab
      const newWindow = window.open(url, '_blank');
      if (newWindow) {
        // Clean up the object URL after a delay to allow the browser to load it
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } else {
        // If popup blocked, revoke immediately
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      // Fallback: try opening directly
      window.open(dataUri, '_blank');
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId !== null) {
        const menuElement = menuRefs.current[openMenuId];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  // Calculate menu position (above or below) when it opens
  useEffect(() => {
    if (openMenuId !== null) {
      const buttonElement = menuRefs.current[openMenuId];
      const menuElement = menuElementRefs.current[openMenuId];
      
      if (buttonElement) {
        // Use requestAnimationFrame to ensure menu is rendered
        requestAnimationFrame(() => {
          const buttonRect = buttonElement.getBoundingClientRect();
          const menuHeight = menuElement?.offsetHeight || 200; // Approximate height if not measured yet
          const spaceBelow = window.innerHeight - buttonRect.bottom;
          const spaceAbove = buttonRect.top;
          
          // Position above if there's not enough space below, or if there's more space above
          const shouldPositionAbove = spaceBelow < menuHeight + 10 && spaceAbove > spaceBelow;
          
          setMenuPositionAbove(prev => ({
            ...prev,
            [openMenuId]: shouldPositionAbove
          }));
        });
      }
    }
  }, [openMenuId]);

  // Handle Esc key to close view modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewModalOrderId) {
        closeViewModal();
      }
    };

    if (viewModalOrderId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [viewModalOrderId]);

  // Handle Esc key to close create order modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
        resetForm();
        setEditingOrderId(null);
        setIsFlexOrderMode(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [isModalOpen]);

  // Handle Esc key to close process order modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && processModalOrderId) {
        closeProcessModal();
      }
    };

    if (processModalOrderId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [processModalOrderId]);

  // Handle Esc key to close viewer modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewerModal) {
        setViewerModal(null);
      }
    };

    if (viewerModal) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [viewerModal]);

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem("ordersPage_visibleColumns", JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // Save column order to localStorage
  useEffect(() => {
    localStorage.setItem("ordersPage_columnOrder", JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Handle click outside column dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isColumnDropdownOpen && columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };

    if (isColumnDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isColumnDropdownOpen]);

  // Drag and drop handlers for column reordering
  const handleColumnDragStart = (index: number) => {
    setDraggedColumnIndex(index);
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleColumnDragEnd = () => {
    if (draggedColumnIndex !== null && dragOverIndex !== null && draggedColumnIndex !== dragOverIndex) {
      const newOrder = [...columnOrder];
      const [removed] = newOrder.splice(draggedColumnIndex, 1);
      newOrder.splice(dragOverIndex, 0, removed);
      setColumnOrder(newOrder);
    }
    setDraggedColumnIndex(null);
    setDragOverIndex(null);
  };

  const handleColumnDragLeave = () => {
    setDragOverIndex(null);
  };

  // Helper function to get column label
  const getColumnLabel = (key: string): string => {
    const column = getAvailableColumns().find(col => col.key === key);
    return column?.label || key;
  };

  // Helper function to render cell content for a column
  const renderCellContent = (columnKey: string, order: typeof orders[0]) => {
    switch (columnKey) {
      case "id":
        return <td key={columnKey} className="py-2 font-mono text-slate-600">#{order.id}</td>;
      case "date":
        return <td key={columnKey} className="py-2">{formatDate(order.createdAt)}</td>;
      case "handler":
        return (
          <td key={columnKey} className="py-2">
            {order.handlerName ? (
              order.handlerName
            ) : (
              <span className="text-rose-600">
                {t("orders.noHandlerAssigned")}
              </span>
            )}
          </td>
        );
      case "customer":
        return (
          <td key={columnKey} className="py-2 font-semibold">
            <div className="flex items-center gap-2">
              {order.customerName || order.customerId}
              {order.isFlexOrder && (
                <Badge tone="purple">
                  Flex Order
                </Badge>
              )}
            </div>
          </td>
        );
      case "pair":
        return (
          <td key={columnKey} className="py-2">
            {order.fromCurrency} → {order.toCurrency}
          </td>
        );
      case "buy":
        return (
          <td key={columnKey} className="py-2">
            {order.isFlexOrder && order.actualAmountBuy ? (
              <span>
                <span className="text-purple-600 font-semibold">{Math.round(order.actualAmountBuy)}</span>
                {/* <span className="text-slate-400 text-xs ml-1 line-through">{Math.round(order.amountBuy)}</span> */}
              </span>
            ) : (
              Math.round(order.amountBuy)
            )}
          </td>
        );
      case "sell":
        return (
          <td key={columnKey} className="py-2">
            {order.isFlexOrder && order.actualAmountSell ? (
              <span>
                -<span className="text-purple-600 font-semibold">{Math.round(order.actualAmountSell)}</span>
                {/* <span className="text-slate-400 text-xs ml-1 line-through">{Math.round(order.amountSell)}</span> */}
              </span>
            ) : (
              `-${Math.round(order.amountSell)}`
            )}
          </td>
        );
      case "rate":
        return (
          <td key={columnKey} className="py-2">
            {order.isFlexOrder && order.actualRate ? (
              <span>
                <span className="text-purple-600 font-semibold">{order.actualRate}</span>
                {/* <span className="text-slate-400 text-xs ml-1 line-through">{order.rate}</span> */}
              </span>
            ) : (
              order.rate
            )}
          </td>
        );
      case "status":
        return (
          <td key={columnKey} className="py-2">
            <Badge tone={getStatusTone(order.status)}>
              {t(`orders.${order.status}`)}
            </Badge>
          </td>
        );
      case "orderType":
        return (
          <td key={columnKey} className="py-2">
            <Badge tone={order.orderType === "otc" ? "amber" : "blue"}>
              {order.orderType === "otc" ? "OTC" : "Online"}
            </Badge>
          </td>
        );
      case "buyAccount": {
        const buyAccounts = order.buyAccounts || [];
        const firstAccount = buyAccounts.length > 0 ? buyAccounts[0] : null;
        const accountName = firstAccount?.accountName || "-";
        
        // Check if profit or service charge should appear in buy account tooltip
        // Buy account is for fromCurrency, so check if profit/service charge currency matches fromCurrency
        const showProfitInBuy = order.profitCurrency === order.fromCurrency && 
                                order.profitAmount !== null && 
                                order.profitAmount !== undefined &&
                                order.profitAccountId;
        const showServiceChargeInBuy = order.serviceChargeCurrency === order.fromCurrency && 
                                       order.serviceChargeAmount !== null && 
                                       order.serviceChargeAmount !== undefined &&
                                       order.serviceChargeAccountId;
        
        const profitAccountName = showProfitInBuy && order.profitAccountId 
          ? accounts.find(acc => acc.id === order.profitAccountId)?.name || null
          : null;
        const serviceChargeAccountName = showServiceChargeInBuy && order.serviceChargeAccountId
          ? accounts.find(acc => acc.id === order.serviceChargeAccountId)?.name || null
          : null;
        
        // Check if profit/service charge accounts are different from buyAccounts
        const profitAccountId = showProfitInBuy ? order.profitAccountId : null;
        const serviceChargeAccountId = showServiceChargeInBuy ? order.serviceChargeAccountId : null;
        
        const profitAccountInBuyAccounts = profitAccountId 
          ? buyAccounts.some(acc => acc.accountId === profitAccountId)
          : false;
        const serviceChargeAccountInBuyAccounts = serviceChargeAccountId
          ? buyAccounts.some(acc => acc.accountId === serviceChargeAccountId)
          : false;
        
        // Count includes buyAccounts plus profit/service charge accounts if they're different
        let accountCount = buyAccounts.length;
        if (profitAccountId && !profitAccountInBuyAccounts) {
          accountCount++;
        }
        if (serviceChargeAccountId && !serviceChargeAccountInBuyAccounts) {
          accountCount++;
        }
        
        const hasMultiple = accountCount > 1;
        const shouldShowTooltip = hasMultiple || showProfitInBuy || showServiceChargeInBuy;
        
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {shouldShowTooltip ? (
              <AccountTooltip 
                accounts={buyAccounts} 
                label={t("orders.buyAccount")}
                profitAmount={showProfitInBuy ? order.profitAmount : null}
                profitCurrency={showProfitInBuy ? order.profitCurrency : null}
                profitAccountName={profitAccountName}
                serviceChargeAmount={showServiceChargeInBuy ? order.serviceChargeAmount : null}
                serviceChargeCurrency={showServiceChargeInBuy ? order.serviceChargeCurrency : null}
                serviceChargeAccountName={serviceChargeAccountName}
              >
                <div className="flex items-center gap-2 cursor-default">
                  <span>{accountName}</span>
                  {hasMultiple && (
                    <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                      {accountCount}
                    </span>
                  )}
                </div>
              </AccountTooltip>
            ) : (
              <span>{accountName}</span>
            )}
          </td>
        );
      }
      case "sellAccount": {
        const sellAccounts = order.sellAccounts || [];
        const firstAccount = sellAccounts.length > 0 ? sellAccounts[0] : null;
        const accountName = firstAccount?.accountName || "-";
        
        // Check if profit or service charge should appear in sell account tooltip
        // Sell account is for toCurrency, so check if profit/service charge currency matches toCurrency
        const showProfitInSell = order.profitCurrency === order.toCurrency && 
                                 order.profitAmount !== null && 
                                 order.profitAmount !== undefined &&
                                 order.profitAccountId;
        const showServiceChargeInSell = order.serviceChargeCurrency === order.toCurrency && 
                                        order.serviceChargeAmount !== null && 
                                        order.serviceChargeAmount !== undefined &&
                                        order.serviceChargeAccountId;
        
        const profitAccountName = showProfitInSell && order.profitAccountId 
          ? accounts.find(acc => acc.id === order.profitAccountId)?.name || null
          : null;
        const serviceChargeAccountName = showServiceChargeInSell && order.serviceChargeAccountId
          ? accounts.find(acc => acc.id === order.serviceChargeAccountId)?.name || null
          : null;
        
        // Check if profit/service charge accounts are different from sellAccounts
        const profitAccountId = showProfitInSell ? order.profitAccountId : null;
        const serviceChargeAccountId = showServiceChargeInSell ? order.serviceChargeAccountId : null;
        
        const profitAccountInSellAccounts = profitAccountId 
          ? sellAccounts.some(acc => acc.accountId === profitAccountId)
          : false;
        const serviceChargeAccountInSellAccounts = serviceChargeAccountId
          ? sellAccounts.some(acc => acc.accountId === serviceChargeAccountId)
          : false;
        
        // Count includes sellAccounts plus profit/service charge accounts if they're different
        let accountCount = sellAccounts.length;
        if (profitAccountId && !profitAccountInSellAccounts) {
          accountCount++;
        }
        if (serviceChargeAccountId && !serviceChargeAccountInSellAccounts) {
          accountCount++;
        }
        
        const hasMultiple = accountCount > 1;
        const shouldShowTooltip = hasMultiple || showProfitInSell || showServiceChargeInSell;
        
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {shouldShowTooltip ? (
              <AccountTooltip 
                accounts={sellAccounts} 
                label={t("orders.sellAccount")}
                profitAmount={showProfitInSell ? order.profitAmount : null}
                // profitCurrency={showProfitInSell ? order.profitCurrency : null}
                profitAccountName={profitAccountName}
                serviceChargeAmount={showServiceChargeInSell ? order.serviceChargeAmount : null}
                // serviceChargeCurrency={showServiceChargeInSell ? order.serviceChargeCurrency : null}
                serviceChargeAccountName={serviceChargeAccountName}
                isSellAccount={true}
              >
                <div className="flex items-center gap-2 cursor-default">
                  <span>{accountName}</span>
                  {hasMultiple && (
                    <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                      {accountCount}
                    </span>
                  )}
                </div>
              </AccountTooltip>
            ) : (
              <span>{accountName}</span>
            )}
          </td>
        );
      }
      case "profit":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {order.profitAmount !== null && order.profitAmount !== undefined ? (
              <span className="text-blue-700 font-medium">
                {order.profitAmount > 0 ? "+" : ""}{order.profitAmount.toFixed(2)} {order.profitCurrency || ""}
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </td>
        );
      case "serviceCharges":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined ? (
              <span className={`font-medium ${order.serviceChargeAmount < 0 ? "text-red-600" : "text-green-700"}`}>
                {order.serviceChargeAmount > 0 ? "+" : ""}{order.serviceChargeAmount.toFixed(2)} {order.serviceChargeCurrency || ""}
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </td>
        );
      case "tags":
        return (
          <td key={columnKey} className="py-2">
            <div className="flex flex-wrap gap-1">
              {order.tags && Array.isArray(order.tags) && order.tags.length > 0 ? (
                order.tags.map((tag: { id: number; name: string; color: string }) => (
                  <Badge key={tag.id} tone="slate" backgroundColor={tag.color}>
                    {tag.name}
                  </Badge>
                ))
              ) : (
                <span className="text-slate-400 text-xs">-</span>
              )}
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  // Toggle column visibility
  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey);
      } else {
        newSet.add(columnKey);
      }
      return newSet;
    });
  };

  const currentOrder = orders.find((o) => o.id === viewModalOrderId);
  const makePaymentOrder = orders.find((o) => o.id === makePaymentModalOrderId);
  // Use orderDetails.order.status if available (more up-to-date), otherwise fall back to currentOrder
  const orderStatusForView = orderDetails?.order?.status || currentOrder?.status;
  const isUnderProcess = orderStatusForView === "under_process";

  const { data: customerBeneficiaries = [] } = useGetCustomerBeneficiariesQuery(
    makePaymentOrder?.customerId ?? 0,
    { skip: !makePaymentOrder?.customerId },
  );

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("orders.title")}
        description={t("orders.description")}
        actions={
          <div className="flex items-center gap-4">
            {isLoading ? t("common.loading") : `${totalOrders} ${t("orders.orders")}`}
            <button
              onClick={() => {
                setIsFlexOrderMode(false);
                setIsModalOpen(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
            >
              {t("orders.createOrder")}
            </button>
            {hasActionPermission(authUser, "createFlexOrder") && (
              <button
                onClick={() => {
                  setIsFlexOrderMode(true);
                  setIsModalOpen(true);
                }}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 transition-colors"
              >
                {t("orders.createFlexOrder")}
              </button>
            )}
            <button
              onClick={() => {
                setIsOtcOrderModalOpen(true);
              }}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 transition-colors"
            >
              OTC Order
            </button>
            <button
              onClick={async () => {
                if (!isBatchTagMode) {
                  // Enable batch tag mode
                  setIsBatchTagMode(true);
                  setIsBatchDeleteMode(false); // Exit batch delete mode if active
                  setSelectedOrderIds([]);
                } else {
                  // If no orders selected, exit batch tag mode
                  if (!selectedOrderIds.length) {
                    setIsBatchTagMode(false);
                    setSelectedOrderIds([]);
                    return;
                  }
                  // Open tag selection modal
                  setIsTagModalOpen(true);
                }
              }}
              disabled={isTagging}
              className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              {isTagging 
                ? t("orders.tagging") || "Tagging..." 
                : isBatchTagMode 
                  ? (selectedOrderIds.length > 0 ? t("orders.addTags") || "Add Tags" : t("common.cancel"))
                  : t("orders.addTag") || "Add Tag"}
            </button>
            {canDeleteManyOrders && (
              <button
                onClick={async () => {
                  if (!isBatchDeleteMode) {
                    // Enable batch delete mode
                    setIsBatchDeleteMode(true);
                    setIsBatchTagMode(false); // Exit batch tag mode if active
                    setSelectedOrderIds([]);
                  } else {
                    // If no orders selected, exit batch delete mode
                    if (!selectedOrderIds.length) {
                      setIsBatchDeleteMode(false);
                      setSelectedOrderIds([]);
                      return;
                    }
                    // Delete selected orders
                    setConfirmModal({
                      isOpen: true,
                      message: t("orders.confirmDeleteOrder") || "Are you sure you want to delete the selected orders?",
                      orderId: -1,
                      isBulk: true,
                    });
                  }
                }}
                disabled={isDeleting}
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                {isDeleting 
                  ? t("common.deleting") 
                  : isBatchDeleteMode 
                    ? (selectedOrderIds.length > 0 ? t("orders.deleteSelected") : t("common.cancel"))
                    : t("orders.batchDelete")}
              </button>
            )}
            <button
              onClick={() => setImportModalOpen(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              {t("orders.import") || "Import Orders"}
            </button>
            <div className="relative" ref={columnDropdownRef}>
              <button
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
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
                  className={`w-4 h-4 transition-transform ${isColumnDropdownOpen ? "rotate-180" : ""}`}
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
              {isColumnDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-2">
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                    {t("orders.showColumns") || "Show Columns"}
                  </div>
                  {availableColumns.map((column, index) => (
                    <div
                      key={column.key}
                      onDragOver={(e) => handleColumnDragOver(e, index)}
                      onDragLeave={handleColumnDragLeave}
                      className={`flex items-center gap-2 px-4 py-2 hover:bg-slate-50 ${
                        dragOverIndex === index ? 'bg-blue-50 border-t-2 border-blue-500' : ''
                      } ${draggedColumnIndex === index ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(column.key)}
                        onChange={() => toggleColumnVisibility(column.key)}
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
                          handleColumnDragStart(index);
                        }}
                        onDragEnd={handleColumnDragEnd}
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
          </div>
        }
      >
        {/* Filter Section */}
        <div className="mb-4 border-b border-slate-200 pb-4">
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="flex items-center justify-between w-full text-left text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg
                className={`w-5 h-5 transition-transform ${isFilterExpanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t("orders.filters") || "Filters"}
            </span>
            <span className="text-xs font-normal text-slate-500">
              {Object.values(filters).filter(v => v !== null && v !== 'all' && v !== 'custom').length > 0 && `(${Object.values(filters).filter(v => v !== null && v !== 'all' && v !== 'custom').length} active)`}
            </span>
          </button>
          
          {isFilterExpanded && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Date Preset */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("orders.datePreset") || "Date Range"}
                </label>
                <select
                  value={filters.datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">{t("orders.all") || "All"}</option>
                  <option value="currentWeek">{t("orders.currentWeek") || "Current Week"}</option>
                  <option value="lastWeek">{t("orders.lastWeek") || "Last Week"}</option>
                  <option value="currentMonth">{t("orders.currentMonth") || "Current Month"}</option>
                  <option value="lastMonth">{t("orders.lastMonth") || "Last Month"}</option>
                  <option value="custom">{t("orders.custom") || "Custom"}</option>
                </select>
              </div>

              {/* Date From */}
              {filters.datePreset === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t("orders.dateFrom") || "Date From"}
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom || ""}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, dateFrom: e.target.value || null }));
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Date To */}
              {filters.datePreset === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t("orders.dateTo") || "Date To"}
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo || ""}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, dateTo: e.target.value || null }));
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Handler */}
              <SearchableSelect
                value={filters.handlerId}
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, handlerId: value }));
                  setCurrentPage(1);
                }}
                options={users}
                placeholder={t("orders.selectHandler") || "Type to search handlers..."}
                label={t("orders.handler") || "Handler"}
                allOptionLabel={t("orders.all") || "All"}
              />

              {/* Customer */}
              <SearchableSelect
                value={filters.customerId}
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, customerId: value }));
                  setCurrentPage(1);
                }}
                options={customers}
                placeholder={t("orders.selectCustomer") || "Type to search customers..."}
                label={t("orders.customer") || "Customer"}
                allOptionLabel={t("orders.all") || "All"}
              />

              {/* Currency Pair */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("orders.currencyPair") || "Currency Pair"}
                </label>
                <select
                  value={filters.currencyPair || ""}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, currencyPair: e.target.value || null }));
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("orders.all") || "All"}</option>
                  {currencyPairs.map((pair) => (
                    <option key={pair} value={pair}>
                      {pair}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buy Account */}
              <SearchableSelect
                value={filters.buyAccountId}
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, buyAccountId: value }));
                  setCurrentPage(1);
                }}
                options={accounts}
                placeholder={t("orders.selectBuyAccount") || "Type to search buy accounts..."}
                label={t("orders.buyAccount") || "Buy Account"}
                allOptionLabel={t("orders.all") || "All"}
              />

              {/* Sell Account */}
              <SearchableSelect
                value={filters.sellAccountId}
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, sellAccountId: value }));
                  setCurrentPage(1);
                }}
                options={accounts}
                placeholder={t("orders.selectSellAccount") || "Type to search sell accounts..."}
                label={t("orders.sellAccount") || "Sell Account"}
                allOptionLabel={t("orders.all") || "All"}
              />

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("orders.status") || "Status"}
                </label>
                <select
                  value={filters.status || ""}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, status: (e.target.value || null) as OrderStatus | null }));
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("orders.all") || "All"}</option>
                  <option value="pending">{t("orders.pending") || "Pending"}</option>
                  <option value="under_process">{t("orders.underProcess") || "Under Process"}</option>
                  <option value="completed">{t("orders.completed") || "Completed"}</option>
                  <option value="cancelled">{t("orders.cancelled") || "Cancelled"}</option>
                </select>
              </div>

              {/* Order Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("orders.orderType") || "Order Type"}
                </label>
                <select
                  value={filters.orderType || ""}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, orderType: (e.target.value || null) as "online" | "otc" | null }));
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("orders.all") || "All"}</option>
                  <option value="online">Online</option>
                  <option value="otc">OTC</option>
                </select>
              </div>

              {/* Tag Filter */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("orders.tag") || "Tag"}
                </label>
                <button
                  type="button"
                  onClick={() => setIsTagFilterOpen((prev) => !prev)}
                  onKeyDown={handleTagFilterKeyDown}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm flex items-center justify-between hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <span
                    className="truncate flex-1 min-w-0 text-left"
                    title={selectedTagNames.length ? selectedTagNames.join(", ") : undefined}
                  >
                    {tagFilterLabel}
                  </span>
                  {filters.tagIds.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700 font-medium shrink-0">
                      {filters.tagIds.length}
                    </span>
                  )}
                  <svg className="w-4 h-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l4 4 4-4" />
                  </svg>
                </button>
                {isTagFilterOpen && (
                  <div
                    ref={tagFilterListRef}
                    tabIndex={0}
                    onKeyDown={handleTagFilterKeyDown}
                    className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 focus:outline-none"
                  >
                    {tags.length === 0 && (
                      <div className="text-sm text-slate-500 px-2 py-1">
                        {t("orders.noTagsAvailable") || "No tags available"}
                      </div>
                    )}
                    {tags.map((tag: { id: number; name: string; color: string }, idx: number) => {
                      const isHighlighted = tagFilterHighlight === idx;
                      return (
                        <label
                          key={tag.id}
                          onMouseEnter={() => setTagFilterHighlight(idx)}
                          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
                            isHighlighted ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={filters.tagIds.includes(tag.id)}
                            onChange={(e) => {
                              setFilters((prev) => {
                                const exists = prev.tagIds.includes(tag.id);
                                const next = e.target.checked
                                  ? [...prev.tagIds, tag.id]
                                  : prev.tagIds.filter((id) => id !== tag.id);
                                return { ...prev, tagIds: next };
                              });
                              setCurrentPage(1);
                            }}
                          />
                          <Badge tone="slate" backgroundColor={tag.color}>
                            {tag.name}
                          </Badge>
                        </label>
                      );
                    })}
                    {tags.length > 0 && (
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200">
                        <button
                          className="text-xs text-slate-600 hover:text-slate-900"
                          onClick={() => {
                            setFilters((prev) => ({ ...prev, tagIds: [] }));
                            setCurrentPage(1);
                          }}
                        >
                          {t("common.clear") || "Clear"}
                        </button>
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800"
                          onClick={() => setIsTagFilterOpen(false)}
                        >
                          {t("common.done") || "Done"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("orders.clearFilters") || "Clear Filters"}
                </button>
              </div>

              {/* Export Button */}
              <div className="flex items-end">
                <button
                  onClick={handleExportOrders}
                  disabled={isExporting}
                  className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t("orders.exporting") || "Exporting..."}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t("orders.export") || "Export to Excel"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

{/* REMOVE THE BELOW DIV TO THIS ONE IF DON'T WANT HEIGHT FULL
        <div className="overflow-x-auto">
         */}
        <div className="overflow-x-auto min-h-[60vh]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                {(isBatchTagMode || (canDeleteManyOrders && isBatchDeleteMode)) && (
                  <th className="py-2 w-8">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={
                        !!orders.length &&
                        selectedOrderIds.length === orders.length
                      }
                      onChange={(e) =>
                        setSelectedOrderIds(
                          e.target.checked ? orders.map((o) => o.id) : [],
                        )
                      }
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
                <tr key={order.id} className="border-b border-slate-100">
                  {(isBatchTagMode || (canDeleteManyOrders && isBatchDeleteMode)) && (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrderIds((prev) =>
                              prev.includes(order.id)
                                ? prev
                                : [...prev, order.id],
                            );
                          } else {
                            setSelectedOrderIds((prev) =>
                              prev.filter((id) => id !== order.id),
                            );
                          }
                        }}
                      />
                    </td>
                  )}
                  {columnOrder.map((columnKey) => 
                    visibleColumns.has(columnKey) ? renderCellContent(columnKey, order) : null
                  )}
                  <td className="py-2">
                    <div
                      className="relative inline-block"
                      ref={(el) => {
                        menuRefs.current[order.id] = el;
                      }}
                    >
                      <button
                        className="flex items-center justify-center p-1 hover:bg-slate-100 rounded transition-colors"
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === order.id ? null : order.id,
                          )
                        }
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

                      {openMenuId === order.id && (
                        <div 
                          ref={(el) => {
                            menuElementRefs.current[order.id] = el;
                          }}
                          className={`absolute right-0 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] ${
                            menuPositionAbove[order.id] ? 'bottom-full mb-1' : 'top-0'
                          }`}
                        >
                          {getActionButtons(order)}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={8}>
                    {t("orders.noOrders")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <div className="text-sm text-slate-600">
              {t("orders.showing") || "Showing"} {(currentPage - 1) * 20 + 1} {t("orders.to") || "to"} {Math.min(currentPage * 20, totalOrders)} {t("orders.of") || "of"} {totalOrders} {t("orders.orders") || "orders"}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("orders.previous") || "Previous"}
              </button>
              <span className="text-sm text-slate-600">
                {t("orders.page") || "Page"} {currentPage} {t("orders.of") || "of"} {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("orders.next") || "Next"}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Create Order Modal */}
      {isModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingOrderId 
                  ? t("orders.editOrderTitle") 
                  : isFlexOrderMode 
                    ? t("orders.createFlexOrder") 
                    : t("orders.createOrderTitle")}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={submit}>
              <div className="col-span-full flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customerId: e.target.value }))
                  }
                  required
                >
                  <option value="">{t("orders.selectCustomer")}</option>
                  {customers.map((customer) => (
                    <option value={customer.id} key={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreateCustomerModalOpen(true)}
                  className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  {t("orders.createNewCustomer")}
                </button>
              </div>
              <div className="col-span-full grid grid-cols-2 gap-3">
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  value={form.fromCurrency}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fromCurrency: e.target.value }))
                  }
                  required
                >
                  <option value="">{t("orders.from")}</option>
                  {currencies
                    .filter((currency) => Boolean(currency.active) && currency.code !== form.toCurrency)
                    .map((currency) => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code}
                      </option>
                    ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  value={form.toCurrency}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, toCurrency: e.target.value }))
                  }
                  required
                >
                  <option value="">{t("orders.to")}</option>
                  {currencies
                    .filter((currency) => Boolean(currency.active) && currency.code !== form.fromCurrency)
                    .map((currency) => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code}
                      </option>
                    ))}
                </select>
              </div>
              <input
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.exchangeRate")}
                value={form.rate}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((p) => ({ ...p, rate: value }));
                  if (!value) {
                    setCalculatedField(null);
                  }
                }}
                required
                type="number"
                step="0.0001"
                onWheel={handleNumberInputWheel}
              />
              <div className="col-span-full grid grid-cols-2 gap-3">
                <input
                  className={`rounded-lg border border-slate-200 px-3 py-2 ${
                    calculatedField === "sell"
                      ? "bg-slate-50 cursor-not-allowed"
                      : ""
                  }`}
                  placeholder={t("orders.amountBuy")}
                  value={form.amountBuy}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => ({ ...p, amountBuy: value }));
                    if (value && form.rate) {
                      const rate = Number(form.rate);
                      if (!isNaN(rate) && rate > 0) {
                        const buyAmount = Number(value);
                        if (!isNaN(buyAmount) && buyAmount > 0) {
                          const sellAmount = (buyAmount * rate).toFixed(4);
                          setForm((p) => ({ ...p, amountSell: sellAmount }));
                        }
                      }
                      setCalculatedField("buy");
                    } else if (!value) {
                      setCalculatedField(null);
                      setForm((p) => ({ ...p, amountSell: "" }));
                    }
                  }}
                  readOnly={calculatedField === "sell"}
                  required
                  type="number"
                  onWheel={handleNumberInputWheel}
                />
                <input
                  className={`rounded-lg border border-slate-200 px-3 py-2 ${
                    calculatedField === "buy"
                      ? "bg-slate-50 cursor-not-allowed"
                      : ""
                  }`}
                  placeholder={t("orders.amountSell")}
                  value={form.amountSell}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => ({ ...p, amountSell: value }));
                    if (value && form.rate) {
                      const rate = Number(form.rate);
                      if (!isNaN(rate) && rate > 0) {
                        const sellAmount = Number(value);
                        if (!isNaN(sellAmount) && sellAmount > 0) {
                          const buyAmount = (sellAmount / rate).toFixed(4);
                          setForm((p) => ({ ...p, amountBuy: buyAmount }));
                        }
                      }
                      setCalculatedField("sell");
                    } else if (!value) {
                      setCalculatedField(null);
                      setForm((p) => ({ ...p, amountBuy: "" }));
                    }
                  }}
                  readOnly={calculatedField === "buy"}
                  required
                  type="number"
                  onWheel={handleNumberInputWheel}
                />
              </div>
              <div className="col-span-full flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isSaving ? t("common.saving") : editingOrderId ? t("orders.updateOrder") : t("orders.saveOrder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {isCreateCustomerModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.createNewCustomerTitle")}
              </h2>
              <button
                onClick={() => {
                  setIsCreateCustomerModalOpen(false);
                  resetCustomerForm();
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={handleCreateCustomer}>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("customers.name")}
                value={customerForm.name}
                onChange={(e) =>
                  setCustomerForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("customers.email")}
                type="email"
                value={customerForm.email}
                onChange={(e) =>
                  setCustomerForm((p) => ({ ...p, email: e.target.value }))
                }
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("customers.phone")}
                type="tel"
                value={customerForm.phone}
                onChange={(e) =>
                  setCustomerForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateCustomerModalOpen(false);
                    resetCustomerForm();
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isCreatingCustomer ? t("common.saving") : t("customers.createCustomer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Order Modal */}
      {processModalOrderId && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.processOrderTitle")}
              </h2>
              <button
                onClick={closeProcessModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={handleProcess}>
              <select
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                value={processForm.handlerId}
                onChange={(e) =>
                  setProcessForm((p) => ({ ...p, handlerId: e.target.value }))
                }
                required
              >
                <option value="">{t("orders.selectHandler")}</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>

              {/* Commented out for future use - CRYPTO/FIAT payment type selection */}
              {/* 
              <div className="col-span-full">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("orders.paymentType")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentType"
                      value="CRYPTO"
                      checked={processForm.paymentType === "CRYPTO"}
                      onChange={(e) =>
                        setProcessForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.crypto")}
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentType"
                      value="FIAT"
                      checked={processForm.paymentType === "FIAT"}
                      onChange={(e) =>
                        setProcessForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.fiat")}
                  </label>
                </div>
              </div>

              {processForm.paymentType === "CRYPTO" ? (
                <>
                  <select
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    value={processForm.networkChain}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        networkChain: e.target.value,
                      }))
                    }
                  >
                    <option value="">{t("orders.selectNetworkChain")}</option>
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                    <option value="POLYGON">POLYGON</option>
                  </select>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("orders.walletAddresses")}
                    </label>
                    {processForm.walletAddresses.map((addr, index) => (
                      <div key={index} className="mb-2">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          placeholder={t("orders.walletAddress")}
                          value={addr}
                          onChange={(e) => {
                            const newAddresses = [...processForm.walletAddresses];
                            newAddresses[index] = e.target.value;
                            setProcessForm((p) => ({
                              ...p,
                              walletAddresses: newAddresses,
                            }));
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setProcessForm((p) => ({
                          ...p,
                          walletAddresses: [...p.walletAddresses, ""],
                        }))
                      }
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {t("orders.addAnotherAddress")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankName")}
                    value={processForm.bankName}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        bankName: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountTitle")}
                    value={processForm.accountTitle}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        accountTitle: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountNumber")}
                    value={processForm.accountNumber}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        accountNumber: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountIban")}
                    value={processForm.accountIban}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        accountIban: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.swiftCode")}
                    value={processForm.swiftCode}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        swiftCode: e.target.value,
                      }))
                    }
                  />
                  <textarea
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankAddress")}
                    value={processForm.bankAddress}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        bankAddress: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </>
              )}
              */}

              <div className="col-span-full flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeProcessModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                >
                  {t("orders.processOrder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {viewModalOrderId && orderDetails && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.orderDetails")}
              </h2>
              <button
                onClick={closeViewModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
            <div className={orderDetails.order.isFlexOrder ? "grid grid-cols-1 lg:grid-cols-3 gap-4" : "space-y-4"}>
              {/* For flex orders, show both receipt and payment sections */}
              {orderDetails.order.isFlexOrder ? (
                <>
                  {/* Main Content - Left Side */}
                  <div className="lg:col-span-2 space-y-4">
                  {/* Receipt Upload Section for Flex Orders */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Receipt Uploads (Flex Order)
                    </h3>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountBuy")}: {orderDetails.order.amountBuy}
                      {orderDetails.order.actualAmountBuy && (
                        <span className="ml-2 text-purple-600">
                          (Actual: {orderDetails.order.actualAmountBuy})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountReceived")}: {orderDetails.totalReceiptAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.receiptBalance.toFixed(2)}
                    </div>

                    {orderDetails.receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className={`mb-4 p-3 border rounded-lg ${
                          receipt.status === 'draft' 
                            ? 'border-yellow-300 bg-yellow-50' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {receipt.status === 'draft' && (
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">
                              Draft
                            </span>
                          )}
                          {receipt.status === 'draft' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.confirmReceiptQuestion") || "Confirm this receipt?")) {
                                    try {
                                      await confirmReceipt(receipt.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error confirming receipt:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to confirm receipt";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                              >
                                {t("common.confirm") || "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.deleteReceiptQuestion") || "Delete this receipt?")) {
                                    try {
                                      await deleteReceipt(receipt.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error deleting receipt:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to delete receipt";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                              >
                                {t("common.delete") || "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                        {getFileType(receipt.imagePath) === 'image' ? (
                          <img
                            src={receipt.imagePath}
                            alt="Receipt"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: receipt.imagePath,
                              type: 'image',
                              title: t("orders.receiptUploads")
                            })}
                          />
                        ) : getFileType(receipt.imagePath) === 'pdf' ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(receipt.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {receipt.amount}
                        </p>
                        {receipt.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {receipt.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                      <>
                        {!showReceiptUpload && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowReceiptUpload(true);
                              if (receiptUploads.length === 0) {
                                setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
                              }
                            }}
                            className="mt-4 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            {t("orders.addReceipt") || "ADD RECEIPT"}
                          </button>
                        )}
                        {showReceiptUpload && (
                          <form onSubmit={handleAddReceipt} className="mt-4">
                      {receiptUploads.map((upload, index) => (
                        <div
                          key={`${receiptUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                            receiptDragOver && index === receiptUploads.length - 1
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200"
                          }`}
                          onDrop={(e) => {
                            handleDrop(e, index, "receipt");
                            setActiveUploadType(null);
                          }}
                          onDragOver={(e) => {
                            handleDragOver(e, "receipt");
                            setActiveUploadType("receipt");
                          }}
                          onDragLeave={(e) => {
                            handleDragLeave(e, "receipt");
                            setActiveUploadType(null);
                          }}
                          onFocus={() => setActiveUploadType("receipt")}
                          onClick={() => setActiveUploadType("receipt")}
                        >
                          {(!upload.image && !upload.amount && !upload.accountId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newUploads = receiptUploads.filter((_, i) => i !== index);
                                setReceiptUploads(newUploads);
                                // If no uploads left, hide the section
                                if (newUploads.length === 0) {
                                  setShowReceiptUpload(false);
                                }
                              }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-300 flex items-center justify-center text-sm font-bold z-10"
                              title={t("common.delete")}
                            >
                              −
                            </button>
                          )}
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop file here (image or PDF), paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <div className="relative mb-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              key={`receipt-file-${receiptUploadKey}-${index}`}
                              ref={(el) => {
                                receiptFileInputRefs.current[index] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(file, index, "receipt");
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id={`receipt-file-input-${receiptUploadKey}-${index}`}
                            />
                            <label
                              htmlFor={`receipt-file-input-${receiptUploadKey}-${index}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 border-dashed rounded-lg text-blue-700 font-medium cursor-pointer transition-colors"
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
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                              </svg>
                              <span>Choose File (Image or PDF)</span>
                            </label>
                          </div>
                          {upload.image && (
                            <div className="relative mb-2">
                              {upload.image.startsWith('data:image/') ? (
                                <img
                                  src={upload.image}
                                  alt="Preview"
                                  className="max-w-full max-h-96 w-auto h-auto object-contain rounded"
                                />
                              ) : upload.image.startsWith('data:application/pdf') ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-slate-200 rounded-lg">
                                  <svg
                                    className="w-16 h-16 text-red-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                  <p className="text-xs text-slate-500 mt-1">Ready to upload</p>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newUploads = [...receiptUploads];
                                  newUploads[index] = { image: "", amount: "", accountId: "" };
                                  setReceiptUploads(newUploads);
                                  // Reset file input
                                  if (receiptFileInputRefs.current[index]) {
                                    receiptFileInputRefs.current[index]!.value = "";
                                  }
                                }}
                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                title={t("common.cancel")}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onWheel={handleNumberInputWheel}
                            onChange={(e) => {
                              const newUploads = [...receiptUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setReceiptUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                            required
                          />
                          {(() => {
                            const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                            return (
                              <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                                value={upload.accountId}
                                onChange={(e) => {
                                  const newUploads = [...receiptUploads];
                                  newUploads[index] = {
                                    ...newUploads[index],
                                    accountId: e.target.value,
                                  };
                                  setReceiptUploads(newUploads);
                                }}
                                required
                              >
                                <option value="">
                                  {t("orders.selectReceiptAccount")} ({currentOrder?.fromCurrency || ""}) *
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === currentOrder?.fromCurrency)
                                  .map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                    </option>
                                  ))}
                              </select>
                            );
                            })()}
                          <button
                            type="submit"
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors mt-2"
                          >
                            {t("orders.uploadReceipts")}
                          </button>
                          </div>
                        ))}
                      </form>
                        )}
                      </>
                    )}
                  </div>

                  {/* Payment Upload Section for Flex Orders */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Payment Uploads (Flex Order)
                    </h3>
                    {excessPaymentWarning && (
                      <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                        <p className="text-sm font-semibold text-amber-900 mb-2">
                          ⚠️ Payment Exceeds Expected Amount
                        </p>
                        <div className="text-sm text-amber-800 space-y-1">
                          <p>
                            Excess Payment: {excessPaymentWarning.excessAmount.toFixed(2)}{" "}
                            {orderDetails.order.toCurrency}
                          </p>
                          <p>
                            Additional Receipts Required: {excessPaymentWarning.additionalReceiptsNeeded.toFixed(2)}{" "}
                            {orderDetails.order.fromCurrency}
                          </p>
                          <p className="text-xs text-amber-700 mt-2">
                            Please upload receipts for the additional amount before completing this order.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountSell")}: -{orderDetails.order.actualAmountSell || orderDetails.order.amountSell}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountPaid")}: {orderDetails.totalPaymentAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.paymentBalance.toFixed(2)}
                    </div>

                    {orderDetails.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`mb-4 p-3 border rounded-lg ${
                          payment.status === 'draft' 
                            ? 'border-yellow-300 bg-yellow-50' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {payment.status === 'draft' && (
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">
                              Draft
                            </span>
                          )}
                          {payment.status === 'draft' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.confirmPaymentQuestion") || "Confirm this payment?")) {
                                    try {
                                      await confirmPayment(payment.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error confirming payment:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to confirm payment";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                              >
                                {t("common.confirm") || "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.deletePaymentQuestion") || "Delete this payment?")) {
                                    try {
                                      await deletePayment(payment.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error deleting payment:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to delete payment";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                              >
                                {t("common.delete") || "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                        {getFileType(payment.imagePath) === 'image' ? (
                          <img
                            src={payment.imagePath}
                            alt="Payment"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: payment.imagePath,
                              type: 'image',
                              title: t("orders.paymentUploads")
                            })}
                          />
                        ) : getFileType(payment.imagePath) === 'pdf' ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(payment.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {payment.amount}
                        </p>
                        {payment.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {payment.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                      <>
                        {!showPaymentUpload && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowPaymentUpload(true);
                              if (paymentUploads.length === 0) {
                                setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
                              }
                            }}
                            className="mt-4 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            {t("orders.addPayment") || "ADD PAYMENT"}
                          </button>
                        )}
                        {showPaymentUpload && (
                          <form onSubmit={handleAddPayment} className="mt-4">
                      {paymentUploads.map((upload, index) => (
                        <div
                          key={`${paymentUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                            paymentDragOver && index === paymentUploads.length - 1
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200"
                          }`}
                          onDrop={(e) => {
                            handleDrop(e, index, "payment");
                            setActiveUploadType(null);
                          }}
                          onDragOver={(e) => {
                            handleDragOver(e, "payment");
                            setActiveUploadType("payment");
                          }}
                          onDragLeave={(e) => {
                            handleDragLeave(e, "payment");
                            setActiveUploadType(null);
                          }}
                          onFocus={() => setActiveUploadType("payment")}
                          onClick={() => setActiveUploadType("payment")}
                        >
                          {(!upload.image && !upload.amount && !upload.accountId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newUploads = paymentUploads.filter((_, i) => i !== index);
                                setPaymentUploads(newUploads);
                                // If no uploads left, hide the section
                                if (newUploads.length === 0) {
                                  setShowPaymentUpload(false);
                                }
                              }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-300 flex items-center justify-center text-sm font-bold z-10"
                              title={t("common.delete")}
                            >
                              −
                            </button>
                          )}
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop file here (image or PDF), paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <div className="relative mb-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              key={`payment-file-${paymentUploadKey}-${index}`}
                              ref={(el) => {
                                paymentFileInputRefs.current[index] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(file, index, "payment");
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id={`payment-file-input-${paymentUploadKey}-${index}`}
                            />
                            <label
                              htmlFor={`payment-file-input-${paymentUploadKey}-${index}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-50 hover:bg-green-100 border-2 border-green-300 border-dashed rounded-lg text-green-700 font-medium cursor-pointer transition-colors"
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
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                              </svg>
                              <span>Choose File (Image or PDF)</span>
                            </label>
                          </div>
                          {upload.image && (
                            <div className="relative mb-2">
                              {upload.image.startsWith('data:image/') ? (
                                <img
                                  src={upload.image}
                                  alt="Preview"
                                  className="max-w-full max-h-96 w-auto h-auto object-contain rounded"
                                />
                              ) : upload.image.startsWith('data:application/pdf') ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-slate-200 rounded-lg">
                                  <svg
                                    className="w-16 h-16 text-red-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                  <p className="text-xs text-slate-500 mt-1">Ready to upload</p>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newUploads = [...paymentUploads];
                                  newUploads[index] = { image: "", amount: "", accountId: "" };
                                  setPaymentUploads(newUploads);
                                  // Reset file input
                                  if (paymentFileInputRefs.current[index]) {
                                    paymentFileInputRefs.current[index]!.value = "";
                                  }
                                }}
                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                title={t("common.cancel")}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onWheel={handleNumberInputWheel}
                            onChange={(e) => {
                              const newUploads = [...paymentUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setPaymentUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                            required
                          />
                          {(() => {
                            const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                            return (
                              <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                                value={upload.accountId}
                                onChange={(e) => {
                                  const newUploads = [...paymentUploads];
                                  newUploads[index] = {
                                    ...newUploads[index],
                                    accountId: e.target.value,
                                  };
                                  setPaymentUploads(newUploads);
                                }}
                                required
                              >
                                <option value="">
                                  {t("orders.selectPaymentAccount")} ({currentOrder?.toCurrency || ""}) *
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === currentOrder?.toCurrency)
                                  .map((account) => {
                                    const hasInsufficientBalance = currentOrder && account.balance < Number(upload.amount || 0);
                                    return (
                                      <option key={account.id} value={account.id}>
                                        {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                        {hasInsufficientBalance ? ` ⚠️ ${t("orders.insufficient")}` : ""}
                                      </option>
                                    );
                                  })}
                              </select>
                            );
                            })()}
                          </div>
                        ))}
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                        >
                          {t("orders.uploadPayments")}
                        </button>
                      </form>
                        )}
                      </>
                    )}
                  </div>
                  </div>

                  {/* Purple Section - Right Side, Sticky */}
                  {orderDetails.order.isFlexOrder && (
                    <div className="lg:col-span-1">
                      <div className="sticky top-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm font-semibold text-purple-900 mb-2">
                          Flex Order - Adjust Exchange Rate
                        </p>
                        <div className="grid grid-cols-1 gap-4 mb-2">
                          <div className="text-sm text-purple-700">
                            <span className="font-medium">Expected To Receive:</span>{" "}
                            {orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy}{" "}
                            {orderDetails.order.fromCurrency}
                          </div>
                          <div className="text-sm text-purple-700 flex items-center gap-2">
                            <span className="font-medium">Exchange Rate:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={flexOrderRate ?? String(orderDetails.order.actualRate ?? orderDetails.order.rate ?? "")}
                              onChange={(e) => setFlexOrderRate(e.target.value)}
                              onWheel={handleNumberInputWheel}
                              className="w-24 rounded border border-purple-300 px-2 py-1"
                              placeholder={String(orderDetails.order.actualRate || orderDetails.order.rate)}
                              disabled={orderDetails.order.status === "completed" || orderDetails.order.status === "cancelled"}
                            />
                            {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  const rateToUse =
                                    flexOrderRate ??
                                    String(orderDetails.order.actualRate ?? orderDetails.order.rate ?? "");
                                  if (!rateToUse) {
                                    alert(t("orders.pleaseEnterExchangeRate"));
                                    return;
                                  }
                                  const rateValue = Number(rateToUse);
                                  if (isNaN(rateValue) || rateValue <= 0) {
                                    alert(t("orders.pleaseEnterValidExchangeRate"));
                                    return;
                                  }
                                  try {
                                    await adjustFlexOrderRate({
                                      id: viewModalOrderId,
                                      rate: rateValue,
                                    }).unwrap();
                                    alert(t("orders.exchangeRateUpdatedSuccessfully"));
                                  } catch (error) {
                                    console.error("Error updating exchange rate:", error);
                                    alert(t("orders.failedToUpdateExchangeRate"));
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                              >
                                {t("orders.updateRate")}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-purple-800 font-medium mb-4">
                          {t("orders.expectedToPay")}:{" "}
                          {calculateAmountSell(
                            orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy,
                            resolvedFlexRate,
                            orderDetails.order.fromCurrency,
                            orderDetails.order.toCurrency
                          ).toFixed(2)}{" "}
                          {orderDetails.order.toCurrency}
                        </div>
                        <div className="mt-4 pt-4 border-t border-purple-300">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-purple-700 font-medium">{t("orders.amountBuy")}:</span>
                              <span className="text-purple-900 font-semibold">
                                {orderDetails.order.amountBuy}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Expected Amount Receipt:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Actual Amount Receipt:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.totalReceiptAmount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Balance Amount:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.receiptBalance.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between mt-3 pt-3 border-t border-purple-200">
                              <span className="text-purple-700 font-medium">{t("orders.amountSell")}:</span>
                              <span className="text-purple-900 font-semibold">
                                -{orderDetails.order.amountSell}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Expected Payment Amount:</span>
                              <span className="text-purple-800 text-xs">
                                {calculateAmountSell(
                                  orderDetails.totalReceiptAmount,
                                  resolvedFlexRate,
                                  orderDetails.order.fromCurrency,
                                  orderDetails.order.toCurrency
                                ).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Actual Payment Amount:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.totalPaymentAmount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Payment Balance:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.paymentBalance.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Display existing profit if it exists - For Flex Orders */}
                  {orderDetails.order.isFlexOrder && orderDetails.order.profitAmount !== null && orderDetails.order.profitAmount !== undefined && (
                    <div className="lg:col-span-2 border-t pt-4 mt-4">
                      <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                        <h3 className="font-semibold text-blue-900 mb-2">
                          {t("orders.profit") || "Profit"}
                        </h3>
                        <div className="text-sm text-slate-600 space-y-1">
                          <div>
                            {t("orders.profitAmount") || "Profit Amount"}: {orderDetails.order.profitAmount > 0 ? "+" : ""}{orderDetails.order.profitAmount.toFixed(2)} {orderDetails.order.profitCurrency || ""}
                          </div>
                          {orderDetails.order.profitAccountId && (
                            <div className="text-slate-500">
                              {t("orders.account") || "Account"}: {accounts.find(acc => acc.id === orderDetails.order.profitAccountId)?.name || `Account #${orderDetails.order.profitAccountId}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Display existing service charges if they exist - For Flex Orders */}
                  {orderDetails.order.isFlexOrder && orderDetails.order.serviceChargeAmount !== null && orderDetails.order.serviceChargeAmount !== undefined && (
                    <div className="lg:col-span-2 border-t pt-4 mt-4">
                      <div className="p-3 border border-green-200 rounded-lg bg-green-50">
                        <h3 className="font-semibold text-green-900 mb-2">
                          {t("orders.serviceCharges") || "Service Charges"}
                        </h3>
                        <div className="text-sm text-slate-600 space-y-1">
                          <div>
                            {t("orders.serviceChargeAmount") || "Service Charge Amount"}: {orderDetails.order.serviceChargeAmount > 0 ? "+" : ""}{orderDetails.order.serviceChargeAmount.toFixed(2)} {orderDetails.order.serviceChargeCurrency || ""}
                          </div>
                          {orderDetails.order.serviceChargeAccountId && (
                            <div className="text-slate-500">
                              {t("orders.account") || "Account"}: {accounts.find(acc => acc.id === orderDetails.order.serviceChargeAccountId)?.name || `Account #${orderDetails.order.serviceChargeAccountId}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Profit and Service Charges Section for Flex Orders - Before Complete Button */}
                  {orderDetails.order.isFlexOrder && orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                    <div className="lg:col-span-2 border-t pt-4 mt-4 space-y-4">
                      <div className="flex gap-2">
                        {!showProfitSection && (
                          <button
                            type="button"
                            onClick={() => setShowProfitSection(true)}
                            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            {t("orders.addProfit") || "ADD PROFIT"}
                          </button>
                        )}
                        {!showServiceChargeSection && (
                          <button
                            type="button"
                            onClick={() => setShowServiceChargeSection(true)}
                            className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            {t("orders.addServiceCharges") || "ADD SERVICE CHARGES"}
                          </button>
                        )}
                      </div>

                      {/* Profit Section */}
                      {showProfitSection && (
                        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-blue-900">
                              {t("orders.profit") || "Profit"}
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setShowProfitSection(false);
                                setProfitAmount("");
                                setProfitCurrency("");
                                setProfitAccountId("");
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              {t("common.remove") || "Remove"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-blue-900 mb-1">
                                {t("orders.profitAmount") || "Profit Amount"}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={profitAmount}
                                onChange={(e) => setProfitAmount(e.target.value)}
                                onWheel={handleNumberInputWheel}
                                className="w-full rounded-lg border border-blue-300 px-3 py-2"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-blue-900 mb-1">
                                {t("orders.profitCurrency") || "Profit Currency"}
                              </label>
                              <select
                                value={profitCurrency}
                                onChange={(e) => {
                                  setProfitCurrency(e.target.value);
                                  setProfitAccountId(""); // Reset account when currency changes
                                }}
                                className="w-full rounded-lg border border-blue-300 px-3 py-2"
                              >
                                <option value="">
                                  {t("orders.selectCurrency") || "Select Currency"}
                                </option>
                                {orderDetails?.order && (
                                  <>
                                    <option value={orderDetails.order.fromCurrency}>
                                      {orderDetails.order.fromCurrency}
                                    </option>
                                    <option value={orderDetails.order.toCurrency}>
                                      {orderDetails.order.toCurrency}
                                    </option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                          {profitCurrency && (
                            <div className="mt-3">
                              <label className="block text-sm font-medium text-blue-900 mb-1">
                                {t("orders.selectAccount") || "Select Account"} ({profitCurrency})
                              </label>
                              <select
                                value={profitAccountId}
                                onChange={(e) => setProfitAccountId(e.target.value)}
                                className="w-full rounded-lg border border-blue-300 px-3 py-2"
                                required
                              >
                                <option value="">
                                  {t("orders.selectAccount") || "Select Account"}
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === profitCurrency)
                                  .map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!viewModalOrderId || !orderDetails) return;
                              if (!profitAmount || !profitCurrency || !profitAccountId) {
                                alert(t("orders.pleaseFillAllFields") || "Please fill all fields");
                                return;
                              }
                              const amount = Number(profitAmount);
                              if (isNaN(amount) || amount <= 0) {
                                alert(t("orders.pleaseEnterValidAmount") || "Please enter a valid amount");
                                return;
                              }
                              try {
                                await updateOrder({
                                  id: viewModalOrderId,
                                  data: {
                                    profitAmount: amount,
                                    profitCurrency: profitCurrency,
                                    profitAccountId: Number(profitAccountId),
                                  },
                                }).unwrap();
                                alert(t("orders.profitUpdatedSuccessfully") || "Profit updated successfully");
                              } catch (error: any) {
                                console.error("Error updating profit:", error);
                                const errorMessage = error?.data?.message || error?.message || "Failed to update profit";
                                alert(errorMessage);
                              }
                            }}
                            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            {t("common.save") || "Save"}
                          </button>
                        </div>
                      )}

                      {/* Service Charge Section */}
                      {showServiceChargeSection && (
                        <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-green-900">
                              {t("orders.serviceCharges") || "Service Charges"}
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setShowServiceChargeSection(false);
                                setServiceChargeAmount("");
                                setServiceChargeCurrency("");
                                setServiceChargeAccountId("");
                              }}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              {t("common.remove") || "Remove"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-green-900 mb-1">
                                {t("orders.serviceChargeAmount") || "Service Charge Amount"}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={serviceChargeAmount}
                                onChange={(e) => setServiceChargeAmount(e.target.value)}
                                onWheel={handleNumberInputWheel}
                                className="w-full rounded-lg border border-green-300 px-3 py-2"
                                placeholder="0.00 (negative for paid by us)"
                              />
                              <p className="text-xs text-green-700 mt-1">
                                {t("orders.negativeForPaidByUs") || "Negative values indicate paid by us"}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-green-900 mb-1">
                                {t("orders.serviceChargeCurrency") || "Service Charge Currency"}
                              </label>
                              <select
                                value={serviceChargeCurrency}
                                onChange={(e) => {
                                  setServiceChargeCurrency(e.target.value);
                                  setServiceChargeAccountId(""); // Reset account when currency changes
                                }}
                                className="w-full rounded-lg border border-green-300 px-3 py-2"
                              >
                                <option value="">
                                  {t("orders.selectCurrency") || "Select Currency"}
                                </option>
                                {orderDetails?.order && (
                                  <>
                                    <option value={orderDetails.order.fromCurrency}>
                                      {orderDetails.order.fromCurrency}
                                    </option>
                                    <option value={orderDetails.order.toCurrency}>
                                      {orderDetails.order.toCurrency}
                                    </option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                          {serviceChargeCurrency && (
                            <div className="mt-3">
                              <label className="block text-sm font-medium text-green-900 mb-1">
                                {t("orders.selectAccount") || "Select Account"} ({serviceChargeCurrency})
                              </label>
                              <select
                                value={serviceChargeAccountId}
                                onChange={(e) => setServiceChargeAccountId(e.target.value)}
                                className="w-full rounded-lg border border-green-300 px-3 py-2"
                                required
                              >
                                <option value="">
                                  {t("orders.selectAccount") || "Select Account"}
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === serviceChargeCurrency)
                                  .map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!viewModalOrderId || !orderDetails) return;
                              if (!serviceChargeAmount || !serviceChargeCurrency || !serviceChargeAccountId) {
                                alert(t("orders.pleaseFillAllFields") || "Please fill all fields");
                                return;
                              }
                              const amount = Number(serviceChargeAmount);
                              if (isNaN(amount) || amount === 0) {
                                alert(t("orders.pleaseEnterValidAmount") || "Please enter a valid amount");
                                return;
                              }
                              try {
                                await updateOrder({
                                  id: viewModalOrderId,
                                  data: {
                                    serviceChargeAmount: amount,
                                    serviceChargeCurrency: serviceChargeCurrency,
                                    serviceChargeAccountId: Number(serviceChargeAccountId),
                                  },
                                }).unwrap();
                                alert(t("orders.serviceChargeUpdatedSuccessfully") || "Service charge updated successfully");
                              } catch (error: any) {
                                console.error("Error updating service charge:", error);
                                const errorMessage = error?.data?.message || error?.message || "Failed to update service charge";
                                alert(errorMessage);
                              }
                            }}
                            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            {t("common.save") || "Save"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Complete Order Button for Flex Orders */}
                  {orderDetails.order.isFlexOrder && orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                    <div className="lg:col-span-2 mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-emerald-900 mb-1">
                            Ready to Complete Order
                          </p>
                          <p className="text-xs text-emerald-700">
                            Total Receipts: {orderDetails.totalReceiptAmount.toFixed(2)} {orderDetails.order.fromCurrency} | 
                            Total Payments: {orderDetails.totalPaymentAmount.toFixed(2)} {orderDetails.order.toCurrency}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!viewModalOrderId) return;
                            
                            const currentOrderDetails = orderDetails;
                            if (!currentOrderDetails) return;
                            
                            // Validate that receipts have been uploaded
                            if (currentOrderDetails.totalReceiptAmount <= 0) {
                              alert(t("orders.pleaseUploadReceipts") || "Please upload at least one receipt before completing the order.");
                              return;
                            }
                            
                            // Validate that payments have been uploaded
                            if (currentOrderDetails.totalPaymentAmount <= 0) {
                              alert(t("orders.pleaseUploadPayments") || "Please upload at least one payment before completing the order.");
                              return;
                            }
                            
                            // Validate amounts match according to exchange rate
                            // Use the same calculation as the view window (calculateAmountSell helper)
                            // Use flexOrderRate if set (user may have adjusted but not saved), otherwise use saved actualRate or original rate
                            const effectiveRate = resolveFlexOrderRate(currentOrderDetails);
                            // For flex orders, use totalReceiptAmount (actual receipts) to calculate expected payment
                            // This ensures we're checking against what was actually received, not adjusted amounts
                            const actualAmountBuy = currentOrderDetails.totalReceiptAmount || currentOrderDetails.order.actualAmountBuy || 0;
                            // Use the same calculation logic as the view window instead of simple multiplication
                            const expectedPaymentAmount = calculateAmountSell(
                              actualAmountBuy,
                              effectiveRate,
                              currentOrderDetails.order.fromCurrency,
                              currentOrderDetails.order.toCurrency
                            );
                            const actualPaymentAmount = currentOrderDetails.totalPaymentAmount;
                            
                            // Debug logging
                            console.log("Completion check:", {
                              actualAmountBuy,
                              effectiveRate,
                              expectedPaymentAmount,
                              actualPaymentAmount,
                              difference: Math.abs(actualPaymentAmount - expectedPaymentAmount),
                            });
                            
                            // Allow small rounding difference (0.01)
                            const difference = Math.abs(actualPaymentAmount - expectedPaymentAmount);
                            
                            if (difference > 0.01) {
                              const missing = expectedPaymentAmount - actualPaymentAmount;
                              if (missing > 0) {
                                // Show missing payment modal - use the calculated expectedPaymentAmount
                                console.log("Showing missing payment modal:", {
                                  expectedPayment: expectedPaymentAmount,
                                  actualPayment: actualPaymentAmount,
                                  missing: missing,
                                });
                                setMissingPaymentModalData({
                                  expectedPayment: expectedPaymentAmount,
                                  actualPayment: actualPaymentAmount,
                                  missing: missing,
                                  toCurrency: currentOrderDetails.order.toCurrency,
                                });
                                setShowMissingPaymentModal(true);
                                return;
                              } else {
                                // Excess payment - user must upload additional receipts
                                const excess = actualPaymentAmount - expectedPaymentAmount;
                                // Calculate additional receipts needed: excess amount converted back to fromCurrency
                                // Reverse the calculation: if we calculated toCurrency = fromCurrency * rate (when base is from)
                                // then fromCurrency = toCurrency / rate
                                // If we calculated toCurrency = fromCurrency / rate (when base is to)
                                // then fromCurrency = toCurrency * rate
                                const getCurrencyRate = (code: string) => {
                                  const currency = currencies.find((c) => c.code === code);
                                  const candidate =
                                    currency?.conversionRateBuy ??
                                    currency?.baseRateBuy ??
                                    currency?.baseRateSell ??
                                    currency?.conversionRateSell;
                                  return typeof candidate === "number" ? candidate : null;
                                };
                                const fromRate = getCurrencyRate(currentOrderDetails.order.fromCurrency);
                                const toRate = getCurrencyRate(currentOrderDetails.order.toCurrency);
                                const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : currentOrderDetails.order.fromCurrency === "USDT";
                                const inferredToIsUSDT = toRate !== null ? toRate <= 1 : currentOrderDetails.order.toCurrency === "USDT";
                                let baseIsFrom: boolean;
                                if (inferredFromIsUSDT !== inferredToIsUSDT) {
                                  baseIsFrom = inferredFromIsUSDT;
                                } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
                                  baseIsFrom = fromRate < toRate;
                                } else {
                                  baseIsFrom = true; // default
                                }
                                const additionalReceipts = baseIsFrom ? excess / effectiveRate : excess * effectiveRate;
                                setExcessPaymentModalData({
                                  expectedPayment: expectedPaymentAmount,
                                  actualPayment: actualPaymentAmount,
                                  excess: excess,
                                  additionalReceipts: additionalReceipts,
                                  fromCurrency: currentOrderDetails.order.fromCurrency,
                                  toCurrency: currentOrderDetails.order.toCurrency,
                                });
                                setShowExcessPaymentModal(true);  
                                return; // Do not allow completion until receipts are uploaded
                              }
                            }
                            
                            if (window.confirm("Are you sure you want to complete this flex order?")) {
                              await updateOrderStatus({
                                id: viewModalOrderId,
                                status: "completed",
                              }).unwrap();
                            }
                          }}
                          className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Complete Order
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Regular order flow - show sections based on status */}
                  {/* Regular order flow - show sections based on status */}
              {isUnderProcess && !orderDetails.order.isFlexOrder && (
                <>
                  {/* Regular orders in under_process status - show both receipt and payment uploads */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      {t("orders.receiptUploads")}
                    </h3>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountBuy")}: {orderDetails.order.amountBuy}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountReceived")}: {orderDetails.totalReceiptAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.receiptBalance.toFixed(2)}
                    </div>

                    {orderDetails.receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className={`mb-4 p-3 border rounded-lg ${
                          receipt.status === 'draft' 
                            ? 'border-yellow-300 bg-yellow-50' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {receipt.status === 'draft' && (
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">
                              Draft
                            </span>
                          )}
                          {receipt.status === 'draft' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.confirmReceiptQuestion") || "Confirm this receipt?")) {
                                    try {
                                      await confirmReceipt(receipt.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error confirming receipt:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to confirm receipt";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                              >
                                {t("common.confirm") || "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.deleteReceiptQuestion") || "Delete this receipt?")) {
                                    try {
                                      await deleteReceipt(receipt.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error deleting receipt:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to delete receipt";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                              >
                                {t("common.delete") || "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                        {getFileType(receipt.imagePath) === 'image' ? (
                          <img
                            src={receipt.imagePath}
                            alt="Receipt"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: receipt.imagePath,
                              type: 'image',
                              title: t("orders.receiptUploads")
                            })}
                          />
                        ) : getFileType(receipt.imagePath) === 'pdf' ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(receipt.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {receipt.amount}
                        </p>
                        {receipt.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {receipt.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                      <>
                        {!showReceiptUpload && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowReceiptUpload(true);
                              if (receiptUploads.length === 0) {
                                setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
                              }
                            }}
                            className="mt-4 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            {t("orders.addReceipt") || "ADD RECEIPT"}
                          </button>
                        )}
                        {showReceiptUpload && (
                          <form onSubmit={handleAddReceipt} className="mt-4">
                            {receiptUploads.map((upload, index) => (
                              <div
                                key={`${receiptUploadKey}-${index}`}
                                className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                                  receiptDragOver && index === receiptUploads.length - 1
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-slate-200"
                                }`}
                                onDrop={(e) => {
                                  handleDrop(e, index, "receipt");
                                  setActiveUploadType(null);
                                }}
                                onDragOver={(e) => {
                                  handleDragOver(e, "receipt");
                                  setActiveUploadType("receipt");
                                }}
                                onDragLeave={(e) => {
                                  handleDragLeave(e, "receipt");
                                  setActiveUploadType(null);
                                }}
                                onFocus={() => setActiveUploadType("receipt")}
                                onClick={() => setActiveUploadType("receipt")}
                              >
                                {(!upload.image && !upload.amount && !upload.accountId) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newUploads = receiptUploads.filter((_, i) => i !== index);
                                      setReceiptUploads(newUploads);
                                      if (newUploads.length === 0) {
                                        setShowReceiptUpload(false);
                                      }
                                    }}
                                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  ref={(el) => {
                                    if (el) {
                                      const key: string = `receipt-${receiptUploadKey}-${index}`;
                                      receiptFileInputRefs.current[key] = el;
                                    }
                                  }}
                                  key={`receipt-file-${receiptUploadKey}-${index}`}
                                  className="hidden"
                                  id={`receipt-file-input-${receiptUploadKey}-${index}`}
                                  onChange={(e) => handleFileChange(e, index, "receipt")}
                                />
                                <label
                                  htmlFor={`receipt-file-input-${receiptUploadKey}-${index}`}
                                  className="block cursor-pointer"
                                >
                                  {upload.image ? (
                                    <div className="relative">
                                      {getFileType(upload.image) === 'image' ? (
                                        <img
                                          src={upload.image}
                                          alt="Receipt preview"
                                          className="max-w-full max-h-48 w-auto h-auto mb-2 object-contain rounded"
                                        />
                                      ) : (
                                        <div className="flex items-center justify-center gap-2 p-4 bg-slate-50 border-2 border-slate-200 rounded-lg mb-2">
                                          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                          </svg>
                                          <span className="text-sm text-slate-700">PDF Document</span>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newUploads = [...receiptUploads];
                                          newUploads[index] = { image: "", amount: newUploads[index].amount, accountId: newUploads[index].accountId };
                                          setReceiptUploads(newUploads);
                                        }}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 transition-colors">
                                      <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      <p className="mt-2 text-sm text-slate-600">Click or drag to upload receipt</p>
                                    </div>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder={t("orders.amount")}
                                  value={upload.amount}
                                  onChange={(e) => {
                                    const newUploads = [...receiptUploads];
                                    newUploads[index] = { ...newUploads[index], amount: e.target.value };
                                    setReceiptUploads(newUploads);
                                  }}
                                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
                                  required={!!upload.image}
                                  onWheel={handleNumberInputWheel}
                                />
                                {(() => {
                                  const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                                  return (
                                    <select
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                                      value={upload.accountId}
                                      onChange={(e) => {
                                        const newUploads = [...receiptUploads];
                                        newUploads[index] = {
                                          ...newUploads[index],
                                          accountId: e.target.value,
                                        };
                                        setReceiptUploads(newUploads);
                                      }}
                                      required={!!upload.image}
                                    >
                                      <option value="">
                                        {t("orders.selectReceiptAccount")} ({currentOrder?.fromCurrency || ""}) *
                                      </option>
                                      {accounts
                                        .filter((acc) => acc.currencyCode === currentOrder?.fromCurrency)
                                        .map((account) => (
                                          <option key={account.id} value={account.id}>
                                            {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                          </option>
                                        ))}
                                    </select>
                                  );
                                })()}
                                {index === receiptUploads.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newUploads = [...receiptUploads, { image: "", amount: "", accountId: "" }];
                                      setReceiptUploads(newUploads);
                                    }}
                                    className="mt-2 text-sm text-blue-600 hover:underline"
                                  >
                                    {t("orders.addAnotherReceipt") || "+ Add another receipt"}
                                  </button>
                                )}
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                {t("orders.uploadReceipts")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
                                  setShowReceiptUpload(false);
                                }}
                                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                {t("common.cancel")}
                              </button>
                            </div>
                          </form>
                        )}
                      </>
                    )}
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      {t("orders.paymentUploads")}
                    </h3>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountSell")}: -{orderDetails.order.amountSell}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountPaid")}: {orderDetails.totalPaymentAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.paymentBalance.toFixed(2)}
                    </div>

                    {orderDetails.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`mb-4 p-3 border rounded-lg ${
                          payment.status === 'draft' 
                            ? 'border-yellow-300 bg-yellow-50' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {payment.status === 'draft' && (
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">
                              Draft
                            </span>
                          )}
                          {payment.status === 'draft' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.confirmPaymentQuestion") || "Confirm this payment?")) {
                                    try {
                                      await confirmPayment(payment.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error confirming payment:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to confirm payment";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                              >
                                {t("common.confirm") || "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  if (window.confirm(t("orders.deletePaymentQuestion") || "Delete this payment?")) {
                                    try {
                                      await deletePayment(payment.id).unwrap();
                                    } catch (error: any) {
                                      console.error("Error deleting payment:", error);
                                      const errorMessage = error?.data?.message || error?.message || "Failed to delete payment";
                                      alert(errorMessage);
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                              >
                                {t("common.delete") || "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                        {getFileType(payment.imagePath) === 'image' ? (
                          <img
                            src={payment.imagePath}
                            alt="Payment"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: payment.imagePath,
                              type: 'image',
                              title: t("orders.paymentUploads")
                            })}
                          />
                        ) : getFileType(payment.imagePath) === 'pdf' ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(payment.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {payment.amount}
                        </p>
                        {payment.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {payment.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                      <>
                        {!showPaymentUpload && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowPaymentUpload(true);
                              if (paymentUploads.length === 0) {
                                setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
                              }
                            }}
                            className="mt-4 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            {t("orders.addPayment") || "ADD PAYMENT"}
                          </button>
                        )}
                        {showPaymentUpload && (
                          <form onSubmit={handleAddPayment} className="mt-4">
                            {paymentUploads.map((upload, index) => (
                              <div
                                key={`${paymentUploadKey}-${index}`}
                                className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                                  paymentDragOver && index === paymentUploads.length - 1
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-slate-200"
                                }`}
                                onDrop={(e) => {
                                  handleDrop(e, index, "payment");
                                  setActiveUploadType(null);
                                }}
                                onDragOver={(e) => {
                                  handleDragOver(e, "payment");
                                  setActiveUploadType("payment");
                                }}
                                onDragLeave={(e) => {
                                  handleDragLeave(e, "payment");
                                  setActiveUploadType(null);
                                }}
                                onFocus={() => setActiveUploadType("payment")}
                                onClick={() => setActiveUploadType("payment")}
                              >
                                {(!upload.image && !upload.amount && !upload.accountId) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newUploads = paymentUploads.filter((_, i) => i !== index);
                                      setPaymentUploads(newUploads);
                                      if (newUploads.length === 0) {
                                        setShowPaymentUpload(false);
                                      }
                                    }}
                                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  ref={(el) => {
                                    if (el) {
                                      const key: string = `payment-${paymentUploadKey}-${index}`;
                                      paymentFileInputRefs.current[key] = el;
                                    }
                                  }}
                                  key={`payment-file-${paymentUploadKey}-${index}`}
                                  className="hidden"
                                  id={`payment-file-input-${paymentUploadKey}-${index}`}
                                  onChange={(e) => handleFileChange(e, index, "payment")}
                                />
                                <label
                                  htmlFor={`payment-file-input-${paymentUploadKey}-${index}`}
                                  className="block cursor-pointer"
                                >
                                  {upload.image ? (
                                    <div className="relative">
                                      {getFileType(upload.image) === 'image' ? (
                                        <img
                                          src={upload.image}
                                          alt="Payment preview"
                                          className="max-w-full max-h-48 w-auto h-auto mb-2 object-contain rounded"
                                        />
                                      ) : (
                                        <div className="flex items-center justify-center gap-2 p-4 bg-slate-50 border-2 border-slate-200 rounded-lg mb-2">
                                          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                          </svg>
                                          <span className="text-sm text-slate-700">PDF Document</span>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newUploads = [...paymentUploads];
                                          newUploads[index] = { ...newUploads[index], image: "", amount: newUploads[index].amount, accountId: newUploads[index].accountId };
                                          setPaymentUploads(newUploads);
                                        }}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 transition-colors">
                                      <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      <p className="mt-2 text-sm text-slate-600">Click or drag to upload payment</p>
                                    </div>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder={t("orders.amount")}
                                  value={upload.amount}
                                  onChange={(e) => {
                                    const newUploads = [...paymentUploads];
                                    newUploads[index] = { ...newUploads[index], amount: e.target.value };
                                    setPaymentUploads(newUploads);
                                  }}
                                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
                                  required={!!upload.image}
                                  onWheel={handleNumberInputWheel}
                                />
                                {(() => {
                                  const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                                  return (
                                    <select
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                                      value={upload.accountId}
                                      onChange={(e) => {
                                        const newUploads = [...paymentUploads];
                                        newUploads[index] = {
                                          ...newUploads[index],
                                          accountId: e.target.value,
                                        };
                                        setPaymentUploads(newUploads);
                                      }}
                                      required={!!upload.image}
                                    >
                                      <option value="">
                                        {t("orders.selectPaymentAccount")} ({currentOrder?.toCurrency || ""}) *
                                      </option>
                                      {accounts
                                        .filter((acc) => acc.currencyCode === currentOrder?.toCurrency)
                                        .map((account) => (
                                          <option key={account.id} value={account.id}>
                                            {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                          </option>
                                        ))}
                                    </select>
                                  );
                                })()}
                                {index === paymentUploads.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newUploads = [...paymentUploads, { image: "", amount: "", accountId: "" }];
                                      setPaymentUploads(newUploads);
                                    }}
                                    className="mt-2 text-sm text-blue-600 hover:underline"
                                  >
                                    {t("orders.addAnotherPayment") || "+ Add another payment"}
                                  </button>
                                )}
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                {t("orders.uploadPayments")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
                                  setShowPaymentUpload(false);
                                }}
                                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                {t("common.cancel")}
                              </button>
                            </div>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              {!isUnderProcess && orderDetails && !orderDetails.order.isFlexOrder && (
                <>
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      {t("orders.orderSummary")}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div>
                          <span className="text-slate-500">{t("orders.status")}:</span>
                          <span className="ml-2 font-semibold text-slate-900 capitalize">
                            {t(`orders.${orderDetails.order.status}`)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.customer")}:</span>
                          <span className="ml-2 text-slate-700">
                            {orderDetails.order.customerName || orderDetails.order.customerId}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.currencyPair")}:</span>
                          <span className="ml-2 text-slate-700">
                            {orderDetails.order.fromCurrency} → {orderDetails.order.toCurrency}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.exchangeRate")}:</span>
                          <span className="ml-2 text-slate-700">
                            {orderDetails.order.rate}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-slate-500">{t("orders.amountBuy")}:</span>
                          <span className="ml-2 font-semibold text-slate-900">
                            {orderDetails.order.amountBuy}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.amountSell")}:</span>
                          <span className="ml-2 font-semibold text-slate-900">
                            -{orderDetails.order.amountSell}
                          </span>
                        </div>
                        {orderDetails.order.handlerName && (
                          <div>
                            <span className="text-slate-500">{t("orders.handler")}:</span>
                            <span className="ml-2 text-slate-700">
                              {orderDetails.order.handlerName}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">{t("orders.date")}:</span>
                          <span className="ml-2 text-slate-700">
                            {formatDate(orderDetails.order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {orderDetails.order.handlerName && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Handler Information
                      </h3>
                      <p className="text-sm text-slate-600">
                        Handler: {orderDetails.order.handlerName}
                      </p>
                      {orderDetails.order.paymentType === "CRYPTO" ? (
                        <div className="mt-2">
                          <p className="text-sm text-slate-600">
                            Network: {orderDetails.order.networkChain || "N/A"}
                          </p>
                          {orderDetails.order.walletAddresses && orderDetails.order.walletAddresses.length > 0 && (
                            <>
                              <p className="text-sm text-slate-600 mt-1">
                                Wallet Addresses:
                              </p>
                              <ul className="list-disc list-inside text-sm text-slate-600 ml-4">
                                {orderDetails.order.walletAddresses.map(
                                  (addr, idx) => (
                                    <li key={idx}>{addr}</li>
                                  )
                                )}
                              </ul>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-600">
                          {orderDetails.order.bankDetails && (
                            <>
                              <p>Bank: {orderDetails.order.bankDetails.bankName || "N/A"}</p>
                              <p>Account Title: {orderDetails.order.bankDetails.accountTitle || "N/A"}</p>
                              <p>Account Number: {orderDetails.order.bankDetails.accountNumber || "N/A"}</p>
                              <p>IBAN: {orderDetails.order.bankDetails.accountIban || "N/A"}</p>
                              <p>Swift Code: {orderDetails.order.bankDetails.swiftCode || "N/A"}</p>
                              <p>Bank Address: {orderDetails.order.bankDetails.bankAddress || "N/A"}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {orderDetails.beneficiaries.length > 0 && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Customer Beneficiary Details
                      </h3>
                      {orderDetails.beneficiaries.map((beneficiary) => (
                        <div key={beneficiary.id} className="mb-4">
                          {beneficiary.paymentType === "CRYPTO" ? (
                            <div className="text-sm text-slate-600">
                              <p>Type: CRYPTO</p>
                              <p>Network: {beneficiary.networkChain || "N/A"}</p>
                              {beneficiary.walletAddresses && beneficiary.walletAddresses.length > 0 && (
                                <>
                                  <p>{t("orders.walletAddresses")}:</p>
                                  <ul className="list-disc list-inside ml-4">
                                    {beneficiary.walletAddresses.map((addr, idx) => (
                                      <li key={idx}>{addr}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600">
                              <p>Type: FIAT</p>
                              <p>Bank: {beneficiary.bankName || "N/A"}</p>
                              <p>Account Title: {beneficiary.accountTitle || "N/A"}</p>
                              <p>Account Number: {beneficiary.accountNumber || "N/A"}</p>
                              <p>IBAN: {beneficiary.accountIban || "N/A"}</p>
                              <p>Swift Code: {beneficiary.swiftCode || "N/A"}</p>
                              <p>Bank Address: {beneficiary.bankAddress || "N/A"}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {orderDetails.receipts.length > 0 && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Receipt Uploads
                      </h3>
                      <div className="text-sm text-slate-600 mb-2">
                        Amount Received: {orderDetails.totalReceiptAmount.toFixed(2)}
                      </div>
                      {orderDetails.receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className={`mb-4 p-3 border rounded-lg ${
                            receipt.status === 'draft' 
                              ? 'border-yellow-300 bg-yellow-50' 
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            {receipt.status === 'draft' && (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">
                                Draft
                              </span>
                            )}
                            {receipt.status === 'draft' && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!viewModalOrderId) return;
                                    if (window.confirm(t("orders.confirmReceiptQuestion") || "Confirm this receipt?")) {
                                      try {
                                        await confirmReceipt(receipt.id).unwrap();
                                      } catch (error) {
                                        console.error("Error confirming receipt:", error);
                                        alert(t("orders.failedToConfirmReceipt") || "Failed to confirm receipt");
                                      }
                                    }
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                                >
                                  {t("common.confirm") || "Confirm"}
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!viewModalOrderId) return;
                                    if (window.confirm(t("orders.deleteReceiptQuestion") || "Delete this receipt?")) {
                                      try {
                                        await deleteReceipt(receipt.id).unwrap();
                                      } catch (error: any) {
                                        console.error("Error deleting receipt:", error);
                                        const errorMessage = error?.data?.message || error?.message || "Failed to delete receipt";
                                        alert(errorMessage);
                                      }
                                    }
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                                >
                                  {t("common.delete") || "Delete"}
                                </button>
                              </div>
                            )}
                          </div>
                          {getFileType(receipt.imagePath) === 'image' ? (
                            <img
                              src={receipt.imagePath}
                              alt="Receipt"
                              className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewerModal({
                                isOpen: true,
                                src: receipt.imagePath,
                                type: 'image',
                                title: t("orders.receiptUploads")
                              })}
                            />
                          ) : getFileType(receipt.imagePath) === 'pdf' ? (
                            <div
                              className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                              onClick={() => openPdfInNewTab(receipt.imagePath)}
                            >
                              <svg
                                className="w-12 h-12 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                <p className="text-xs text-slate-500">Click to view</p>
                              </div>
                            </div>
                          ) : null}
                          <p className="text-sm text-slate-600">
                            {t("orders.amount")}: {receipt.amount}
                          </p>
                          {receipt.accountName && (
                            <p className="text-sm text-slate-500">
                              {t("orders.account")}: {receipt.accountName}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {orderDetails.payments.length > 0 && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Payment Uploads
                      </h3>
                      <div className="text-sm text-slate-600 mb-2">
                        Amount Paid: {orderDetails.totalPaymentAmount.toFixed(2)}
                      </div>
                      {orderDetails.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className={`mb-4 p-3 border rounded-lg ${
                            payment.status === 'draft' 
                              ? 'border-yellow-300 bg-yellow-50' 
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            {payment.status === 'draft' && (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">
                                Draft
                              </span>
                            )}
                            {payment.status === 'draft' && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!viewModalOrderId) return;
                                    if (window.confirm(t("orders.confirmPaymentQuestion") || "Confirm this payment?")) {
                                      try {
                                        await confirmPayment(payment.id).unwrap();
                                      } catch (error) {
                                        console.error("Error confirming payment:", error);
                                        alert(t("orders.failedToConfirmPayment") || "Failed to confirm payment");
                                      }
                                    }
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                                >
                                  {t("common.confirm") || "Confirm"}
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!viewModalOrderId) return;
                                    if (window.confirm(t("orders.deletePaymentQuestion") || "Delete this payment?")) {
                                      try {
                                        await deletePayment(payment.id).unwrap();
                                      } catch (error: any) {
                                        console.error("Error deleting payment:", error);
                                        const errorMessage = error?.data?.message || error?.message || "Failed to delete payment";
                                        alert(errorMessage);
                                      }
                                    }
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                                >
                                  {t("common.delete") || "Delete"}
                                </button>
                              </div>
                            )}
                          </div>
                          {getFileType(payment.imagePath) === 'image' ? (
                            <img
                              src={payment.imagePath}
                              alt="Payment"
                              className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewerModal({
                                isOpen: true,
                                src: payment.imagePath,
                                type: 'image',
                                title: t("orders.paymentUploads")
                              })}
                            />
                          ) : getFileType(payment.imagePath) === 'pdf' ? (
                            <div
                              className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                              onClick={() => openPdfInNewTab(payment.imagePath)}
                            >
                              <svg
                                className="w-12 h-12 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                <p className="text-xs text-slate-500">Click to view</p>
                              </div>
                            </div>
                          ) : null}
                          <p className="text-sm text-slate-600">
                            {t("orders.amount")}: {payment.amount}
                          </p>
                          {payment.accountName && (
                            <p className="text-sm text-slate-500">
                              {t("orders.account")}: {payment.accountName}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Display existing profit if it exists - For Non-Flex Orders */}
              {!orderDetails.order.isFlexOrder && orderDetails.order.profitAmount !== null && orderDetails.order.profitAmount !== undefined && (
                <div className="border-t pt-4 mt-4">
                  <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      {t("orders.profit") || "Profit"}
                    </h3>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div>
                        {t("orders.profitAmount") || "Profit Amount"}: {orderDetails.order.profitAmount > 0 ? "+" : ""}{orderDetails.order.profitAmount.toFixed(2)} {orderDetails.order.profitCurrency || ""}
                      </div>
                      {orderDetails.order.profitAccountId && (
                        <div className="text-slate-500">
                          {t("orders.account") || "Account"}: {accounts.find(acc => acc.id === orderDetails.order.profitAccountId)?.name || `Account #${orderDetails.order.profitAccountId}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Display existing service charges if they exist - For Non-Flex Orders */}
              {!orderDetails.order.isFlexOrder && orderDetails.order.serviceChargeAmount !== null && orderDetails.order.serviceChargeAmount !== undefined && (
                <div className="border-t pt-4 mt-4">
                  <div className="p-3 border border-green-200 rounded-lg bg-green-50">
                    <h3 className="font-semibold text-green-900 mb-2">
                      {t("orders.serviceCharges") || "Service Charges"}
                    </h3>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div>
                        {t("orders.serviceChargeAmount") || "Service Charge Amount"}: {orderDetails.order.serviceChargeAmount > 0 ? "+" : ""}{orderDetails.order.serviceChargeAmount.toFixed(2)} {orderDetails.order.serviceChargeCurrency || ""}
                      </div>
                      {orderDetails.order.serviceChargeAccountId && (
                        <div className="text-slate-500">
                          {t("orders.account") || "Account"}: {accounts.find(acc => acc.id === orderDetails.order.serviceChargeAccountId)?.name || `Account #${orderDetails.order.serviceChargeAccountId}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Profit and Service Charges Section - At the bottom */}
              {orderDetails?.order?.status !== "completed" && (
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="flex gap-2">
                  {!showProfitSection && (
                    <button
                      type="button"
                      onClick={() => setShowProfitSection(true)}
                      className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      {t("orders.addProfit") || "ADD PROFIT"}
                    </button>
                  )}
                  {!showServiceChargeSection && (
                    <button
                      type="button"
                      onClick={() => setShowServiceChargeSection(true)}
                      className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      {t("orders.addServiceCharges") || "ADD SERVICE CHARGES"}
                    </button>
                  )}
                </div>

                {/* Profit Section */}
                {showProfitSection && (
                  <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-blue-900">
                        {t("orders.profit") || "Profit"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfitSection(false);
                          setProfitAmount("");
                          setProfitCurrency("");
                          setProfitAccountId("");
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {t("common.remove") || "Remove"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                          {t("orders.profitAmount") || "Profit Amount"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={profitAmount}
                          onChange={(e) => setProfitAmount(e.target.value)}
                          onWheel={handleNumberInputWheel}
                          className="w-full rounded-lg border border-blue-300 px-3 py-2"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                          {t("orders.profitCurrency") || "Profit Currency"}
                        </label>
                        <select
                          value={profitCurrency}
                          onChange={(e) => {
                            setProfitCurrency(e.target.value);
                            setProfitAccountId(""); // Reset account when currency changes
                          }}
                          className="w-full rounded-lg border border-blue-300 px-3 py-2"
                        >
                          <option value="">
                            {t("orders.selectCurrency") || "Select Currency"}
                          </option>
                          {orderDetails?.order && (
                            <>
                              <option value={orderDetails.order.fromCurrency}>
                                {orderDetails.order.fromCurrency}
                              </option>
                              <option value={orderDetails.order.toCurrency}>
                                {orderDetails.order.toCurrency}
                              </option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                    {profitCurrency && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                          {t("orders.selectAccount") || "Select Account"} ({profitCurrency})
                        </label>
                        <select
                          value={profitAccountId}
                          onChange={(e) => setProfitAccountId(e.target.value)}
                          className="w-full rounded-lg border border-blue-300 px-3 py-2"
                          required
                        >
                          <option value="">
                            {t("orders.selectAccount") || "Select Account"}
                          </option>
                          {accounts
                            .filter((acc) => acc.currencyCode === profitCurrency)
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!viewModalOrderId || !orderDetails) return;
                        if (!profitAmount || !profitCurrency || !profitAccountId) {
                          alert(t("orders.pleaseFillAllFields") || "Please fill all fields");
                          return;
                        }
                        const amount = Number(profitAmount);
                        if (isNaN(amount) || amount <= 0) {
                          alert(t("orders.pleaseEnterValidAmount") || "Please enter a valid amount");
                          return;
                        }
                        try {
                          await updateOrder({
                            id: viewModalOrderId,
                            data: {
                              profitAmount: amount,
                              profitCurrency: profitCurrency,
                              profitAccountId: Number(profitAccountId),
                            },
                          }).unwrap();
                          alert(t("orders.profitUpdatedSuccessfully") || "Profit updated successfully");
                        } catch (error: any) {
                          console.error("Error updating profit:", error);
                          const errorMessage = error?.data?.message || error?.message || "Failed to update profit";
                          alert(errorMessage);
                        }
                      }}
                      className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {t("common.save") || "Save"}
                    </button>
                  </div>
                )}

                {/* Service Charge Section */}
                {showServiceChargeSection && (
                  <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-green-900">
                        {t("orders.serviceCharges") || "Service Charges"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowServiceChargeSection(false);
                          setServiceChargeAmount("");
                          setServiceChargeCurrency("");
                          setServiceChargeAccountId("");
                        }}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        {t("common.remove") || "Remove"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-green-900 mb-1">
                          {t("orders.serviceChargeAmount") || "Service Charge Amount"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={serviceChargeAmount}
                          onChange={(e) => setServiceChargeAmount(e.target.value)}
                          onWheel={handleNumberInputWheel}
                          className="w-full rounded-lg border border-green-300 px-3 py-2"
                          placeholder="0.00 (negative for paid by us)"
                        />
                        <p className="text-xs text-green-700 mt-1">
                          {t("orders.negativeForPaidByUs") || "Negative values indicate paid by us"}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-green-900 mb-1">
                          {t("orders.serviceChargeCurrency") || "Service Charge Currency"}
                        </label>
                        <select
                          value={serviceChargeCurrency}
                          onChange={(e) => {
                            setServiceChargeCurrency(e.target.value);
                            setServiceChargeAccountId(""); // Reset account when currency changes
                          }}
                          className="w-full rounded-lg border border-green-300 px-3 py-2"
                        >
                          <option value="">
                            {t("orders.selectCurrency") || "Select Currency"}
                          </option>
                          {orderDetails?.order && (
                            <>
                              <option value={orderDetails.order.fromCurrency}>
                                {orderDetails.order.fromCurrency}
                              </option>
                              <option value={orderDetails.order.toCurrency}>
                                {orderDetails.order.toCurrency}
                              </option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                    {serviceChargeCurrency && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-green-900 mb-1">
                          {t("orders.selectAccount") || "Select Account"} ({serviceChargeCurrency})
                        </label>
                        <select
                          value={serviceChargeAccountId}
                          onChange={(e) => setServiceChargeAccountId(e.target.value)}
                          className="w-full rounded-lg border border-green-300 px-3 py-2"
                          required
                        >
                          <option value="">
                            {t("orders.selectAccount") || "Select Account"}
                          </option>
                          {accounts
                            .filter((acc) => acc.currencyCode === serviceChargeCurrency)
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!viewModalOrderId || !orderDetails) return;
                        if (!serviceChargeAmount || !serviceChargeCurrency || !serviceChargeAccountId) {
                          alert(t("orders.pleaseFillAllFields") || "Please fill all fields");
                          return;
                        }
                        const amount = Number(serviceChargeAmount);
                        if (isNaN(amount) || amount === 0) {
                          alert(t("orders.pleaseEnterValidAmount") || "Please enter a valid amount");
                          return;
                        }
                        try {
                          await updateOrder({
                            id: viewModalOrderId,
                            data: {
                              serviceChargeAmount: amount,
                              serviceChargeCurrency: serviceChargeCurrency,
                              serviceChargeAccountId: Number(serviceChargeAccountId),
                            },
                          }).unwrap();
                          alert(t("orders.serviceChargeUpdatedSuccessfully") || "Service charge updated successfully");
                        } catch (error: any) {
                          console.error("Error updating service charge:", error);
                          const errorMessage = error?.data?.message || error?.message || "Failed to update service charge";
                          alert(errorMessage);
                        }
                      }}
                      className="mt-3 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      {t("common.save") || "Save"}
                    </button>
                  </div>
                )}
              </div>
              )}

              {/* Complete Order Button for Regular Orders */}
              {!orderDetails.order.isFlexOrder && orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900 mb-1">
                        Ready to Complete Order
                      </p>
                      <p className="text-xs text-emerald-700">
                        Total Receipts: {orderDetails.totalReceiptAmount.toFixed(2)} {orderDetails.order.fromCurrency} | 
                        Total Payments: {orderDetails.totalPaymentAmount.toFixed(2)} {orderDetails.order.toCurrency}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!viewModalOrderId) return;
                        
                        const currentOrderDetails = orderDetails;
                        if (!currentOrderDetails) return;
                        
                        // Validate that receipts have been uploaded
                        if (currentOrderDetails.totalReceiptAmount <= 0) {
                          alert(t("orders.pleaseUploadReceipts") || "Please upload at least one receipt before completing the order.");
                          return;
                        }
                        
                        // Validate that payments have been uploaded
                        if (currentOrderDetails.totalPaymentAmount <= 0) {
                          alert(t("orders.pleaseUploadPayments") || "Please upload at least one payment before completing the order.");
                          return;
                        }
                        
                        // Validate amounts match according to exchange rate
                        const expectedPaymentAmount = calculateAmountSell(
                          currentOrderDetails.order.amountBuy,
                          currentOrderDetails.order.rate,
                          currentOrderDetails.order.fromCurrency,
                          currentOrderDetails.order.toCurrency
                        );
                        const actualPaymentAmount = currentOrderDetails.totalPaymentAmount;
                        const actualReceiptAmount = currentOrderDetails.totalReceiptAmount;
                        
                        // Check if receipt amount matches expected
                        const receiptDifference = Math.abs(actualReceiptAmount - currentOrderDetails.order.amountBuy);
                        if (receiptDifference > 0.01) {
                          const missing = currentOrderDetails.order.amountBuy - actualReceiptAmount;
                          if (missing > 0) {
                            alert(`Please upload receipts for the remaining amount: ${missing.toFixed(2)} ${currentOrderDetails.order.fromCurrency}`);
                            return;
                          }
                        }
                        
                        // Check if payment amount matches expected
                        const paymentDifference = Math.abs(actualPaymentAmount - expectedPaymentAmount);
                        if (paymentDifference > 0.01) {
                          const missing = expectedPaymentAmount - actualPaymentAmount;
                          if (missing > 0) {
                            alert(`Please upload payments for the remaining amount: ${missing.toFixed(2)} ${currentOrderDetails.order.toCurrency}`);
                            return;
                          } else {
                            // Excess payment - user must upload additional receipts
                            const excess = actualPaymentAmount - expectedPaymentAmount;
                            // Calculate additional receipts needed: excess amount converted back to fromCurrency
                            const getCurrencyRate = (code: string) => {
                              const currency = currencies.find((c) => c.code === code);
                              const candidate =
                                currency?.conversionRateBuy ??
                                currency?.baseRateBuy ??
                                currency?.baseRateSell ??
                                currency?.conversionRateSell;
                              return typeof candidate === "number" ? candidate : null;
                            };
                            const fromRate = getCurrencyRate(currentOrderDetails.order.fromCurrency);
                            const toRate = getCurrencyRate(currentOrderDetails.order.toCurrency);
                            const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : currentOrderDetails.order.fromCurrency === "USDT";
                            const inferredToIsUSDT = toRate !== null ? toRate <= 1 : currentOrderDetails.order.toCurrency === "USDT";
                            let baseIsFrom: boolean;
                            if (inferredFromIsUSDT !== inferredToIsUSDT) {
                              baseIsFrom = inferredFromIsUSDT;
                            } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
                              baseIsFrom = fromRate < toRate;
                            } else {
                              baseIsFrom = true; // default
                            }
                            const additionalReceipts = baseIsFrom ? excess / currentOrderDetails.order.rate : excess * currentOrderDetails.order.rate;
                            alert(`Payment exceeds expected amount. Please upload additional receipts: ${additionalReceipts.toFixed(2)} ${currentOrderDetails.order.fromCurrency}`);
                            return;
                          }
                        }
                        
                        if (window.confirm("Are you sure you want to complete this order?")) {
                          await updateOrderStatus({
                            id: viewModalOrderId,
                            status: "completed",
                          }).unwrap();
                        }
                      }}
                      className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Complete Order
                    </button>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Make Payment Modal - Removed: Accounts are now selected per payment upload */}
      {false && makePaymentModalOrderId && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.makePaymentTitle")}
              </h2>
              <button
                onClick={closeMakePaymentModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={handleAddBeneficiary}>
              {/* Payment Account Selection - We pay customer in toCurrency */}
              {(() => {
                const paymentOrderData = orders.find((o) => o.id === makePaymentModalOrderId);
                return (
                  <select
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    value={beneficiaryForm.paymentAccountId}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({ ...p, paymentAccountId: e.target.value }))
                    }
                    required
                  >
                    <option value="">
                      {t("orders.selectPaymentAccount")} ({paymentOrderData?.toCurrency || t("orders.to")})
                    </option>
                    {accounts
                      .filter((acc) => acc.currencyCode === paymentOrderData?.toCurrency)
                      .map((account) => {
                        const hasInsufficientBalance = paymentOrderData && account.balance < paymentOrderData.amountSell;
                        return (
                          <option key={account.id} value={account.id}>
                            {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                            {hasInsufficientBalance ? ` ⚠️ ${t("orders.insufficient")}` : ""}
                          </option>
                        );
                      })}
                  </select>
                );
              })()}

              {/* Commented out for future use - CRYPTO/FIAT beneficiary details */}
              {/* 
              {customerBeneficiaries.length > 0 && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("orders.savedBeneficiary")}
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={selectedCustomerBeneficiaryId}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : "";
                      setSelectedCustomerBeneficiaryId(val);
                      if (val) {
                        applyCustomerBeneficiaryToForm(val);
                      }
                    }}
                  >
                    <option value="">{t("orders.selectSavedBeneficiary")}</option>
                    {customerBeneficiaries.map((beneficiary) => (
                      <option key={beneficiary.id} value={beneficiary.id}>
                        {beneficiary.paymentType === "CRYPTO"
                          ? `${t("orders.crypto")} - ${beneficiary.networkChain || t("orders.network")}`
                          : `${t("orders.fiat")} - ${beneficiary.bankName || t("orders.bank")}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-span-full">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("orders.paymentType")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="beneficiaryPaymentType"
                      value="CRYPTO"
                      checked={beneficiaryForm.paymentType === "CRYPTO"}
                      onChange={(e) =>
                        setBeneficiaryForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.crypto")}
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="beneficiaryPaymentType"
                      value="FIAT"
                      checked={beneficiaryForm.paymentType === "FIAT"}
                      onChange={(e) =>
                        setBeneficiaryForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.fiat")}
                  </label>
                </div>
              </div>

              {beneficiaryForm.paymentType === "CRYPTO" ? (
                <>
                  <select
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    value={beneficiaryForm.networkChain}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        networkChain: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">{t("orders.selectNetworkChain")}</option>
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                    <option value="POLYGON">POLYGON</option>
                  </select>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("orders.walletAddresses")}
                    </label>
                    {beneficiaryForm.walletAddresses.map((addr, index) => (
                      <div key={index} className="mb-2">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          placeholder={t("orders.walletAddress")}
                          value={addr}
                          onChange={(e) => {
                            const newAddresses = [...beneficiaryForm.walletAddresses];
                            newAddresses[index] = e.target.value;
                            setBeneficiaryForm((p) => ({
                              ...p,
                              walletAddresses: newAddresses,
                            }));
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setBeneficiaryForm((p) => ({
                          ...p,
                          walletAddresses: [...p.walletAddresses, ""],
                        }))
                      }
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {t("orders.addAnotherAddress")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankName")}
                    value={beneficiaryForm.bankName}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        bankName: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountTitle")}
                    value={beneficiaryForm.accountTitle}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        accountTitle: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountNumber")}
                    value={beneficiaryForm.accountNumber}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        accountNumber: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountIban")}
                    value={beneficiaryForm.accountIban}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        accountIban: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.swiftCode")}
                    value={beneficiaryForm.swiftCode}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        swiftCode: e.target.value,
                      }))
                    }
                  />
                  <textarea
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankAddress")}
                    value={beneficiaryForm.bankAddress}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        bankAddress: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </>
              )}

              <div className="col-span-full flex items-center gap-3">
                <input
                  id="save-beneficiary-to-customer"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={saveBeneficiaryToCustomer}
                  onChange={(e) => setSaveBeneficiaryToCustomer(e.target.checked)}
                />
                <label htmlFor="save-beneficiary-to-customer" className="text-sm text-slate-700">
                  {t("orders.saveBeneficiaryToCustomer")}
                </label>
              </div>
              */}

              <div className="col-span-full flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeMakePaymentModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                  >
                    {t("common.submit")}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excess Payment Warning Modal */}
      {showExcessPaymentModal && excessPaymentModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <svg
                    className="h-6 w-6 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Payment Exceeds Expected Amount
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowExcessPaymentModal(false);
                  setExcessPaymentModalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-amber-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-medium">{t("orders.expectedPayment")}:</span>
                    <span className="text-amber-900 font-semibold">
                      {excessPaymentModalData.expectedPayment.toFixed(2)} {excessPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-medium">{t("orders.actualPayment")}:</span>
                    <span className="text-amber-900 font-semibold">
                      {excessPaymentModalData.actualPayment.toFixed(2)} {excessPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-amber-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-amber-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-amber-900 font-bold">
                        {excessPaymentModalData.excess.toFixed(2)} {excessPaymentModalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.actionRequired")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.youMustUpload")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessPaymentModalData.additionalReceipts.toFixed(2)} {excessPaymentModalData.fromCurrency}
                  </span>{" "}
                  {t("orders.additionalReceipts")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowExcessPaymentModal(false);
                  setExcessPaymentModalData(null);
                }}
                className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Payment Warning Modal */}
      {showMissingPaymentModal && missingPaymentModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.amountsDoNotMatch")}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowMissingPaymentModal(false);
                  setMissingPaymentModalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-800 font-medium">{t("orders.expectedPayment")}:</span>
                    <span className="text-blue-900 font-semibold">
                      {missingPaymentModalData.expectedPayment.toFixed(2)} {missingPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-800 font-medium">{t("orders.actualPayment")}:</span>
                    <span className="text-blue-900 font-semibold">
                      {missingPaymentModalData.actualPayment.toFixed(2)} {missingPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-blue-900 font-semibold">{t("orders.missing")}:</span>
                      <span className="text-blue-900 font-bold">
                        {missingPaymentModalData.missing.toFixed(2)} {missingPaymentModalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.actionRequired")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.pleaseUploadRemaining")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowMissingPaymentModal(false);
                  setMissingPaymentModalData(null);
                }}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excess Receipt Warning Modal */}
      {showExcessReceiptModal && excessReceiptModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.receiptAmountExceedsOrderAmount")}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowExcessReceiptModal(false);
                  setExcessReceiptModalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.expectedReceiptAmount")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessReceiptModalData.expectedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.attemptToReceive")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessReceiptModalData.attemptedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                    </span>
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-red-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-red-900 font-bold">
                        {excessReceiptModalData.excess.toFixed(2)} {excessReceiptModalData.fromCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.cannotUpload")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.forNormalOrdersCannotUploadReceipts")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessReceiptModalData.expectedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                  </span>.
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold text-slate-900">{t("orders.note")}:</span> {t("orders.excessReceiptsOnlyAllowed")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowExcessReceiptModal(false);
                  setExcessReceiptModalData(null);
                }}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excess Payment Warning Modal for Normal Orders */}
      {showExcessPaymentModalNormal && excessPaymentModalNormalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.paymentAmountExceedsOrderAmount")}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowExcessPaymentModalNormal(false);
                  setExcessPaymentModalNormalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.expectedPaymentAmount")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessPaymentModalNormalData.expectedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.attemptToPay")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessPaymentModalNormalData.attemptedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-red-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-red-900 font-bold">
                        {excessPaymentModalNormalData.excess.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.cannotUpload")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.forNormalOrdersCannotUpload")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessPaymentModalNormalData.expectedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                  </span>.
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold text-slate-900">{t("orders.note")}:</span> {t("orders.excessPaymentsOnlyAllowed")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowExcessPaymentModalNormal(false);
                  setExcessPaymentModalNormalData(null);
                }}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image/PDF Viewer Modal */}
      {viewerModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-75" style={{ margin: 0, padding: 0 }}
          onClick={() => setViewerModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewerModal(null)}
              className="absolute top-2 right-2 z-10 bg-white hover:bg-slate-100 rounded-full p-2 shadow-lg transition-colors"
              aria-label={t("orders.close")}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={viewerModal.src}
              alt={viewerModal.title}
              className="max-w-full max-h-[95vh] w-auto h-auto mx-auto object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type || "error"}
        onClose={() => setAlertModal({ isOpen: false, message: "", type: "error" })}
      />

      {/* Tag Selection Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">
              {t("orders.selectTags") || "Select Tags"}
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {tags.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  {t("orders.noTagsAvailable") || "No tags available. Create tags in the Tags page."}
                </p>
              ) : (
                tags.map((tag: { id: number; name: string; color: string }) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTagIds((prev) => [...prev, tag.id]);
                        } else {
                          setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
                        }
                      }}
                      className="h-4 w-4"
                    />
                    <Badge tone="slate" backgroundColor={tag.color}>
                      {tag.name}
                    </Badge>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsTagModalOpen(false);
                  setSelectedTagIds([]);
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={async () => {
                  if (selectedTagIds.length === 0) {
                    setAlertModal({
                      isOpen: true,
                      message: t("orders.selectAtLeastOneTag") || "Please select at least one tag",
                      type: "error",
                    });
                    return;
                  }
                  try {
                    await batchUnassignTags({
                      entityType: "order",
                      entityIds: selectedOrderIds,
                      tagIds: selectedTagIds,
                    }).unwrap();

                    setIsTagModalOpen(false);
                    setSelectedTagIds([]);
                    setSelectedOrderIds([]);
                    setIsBatchTagMode(false);

                    setAlertModal({
                      isOpen: true,
                      message: t("orders.tagsRemovedSuccess") || "Tags removed successfully",
                      type: "success",
                    });

                    setTimeout(async () => {
                      try {
                        await refetchOrders();
                      } catch (err) {
                        console.error("Error refetching orders:", err);
                      }
                    }, 100);
                  } catch (error: any) {
                    setAlertModal({
                      isOpen: true,
                      message:
                        error?.data?.message ||
                        error?.message ||
                        t("orders.failedToRemoveTags") ||
                        "Failed to remove tags",
                      type: "error",
                    });
                  }
                }}
                disabled={isUntagging || selectedTagIds.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isUntagging ? t("common.saving") || "Saving..." : t("orders.remove") || "Remove"}
              </button>
              <button
                onClick={async () => {
                  if (selectedTagIds.length === 0) {
                    setAlertModal({
                      isOpen: true,
                      message: t("orders.selectAtLeastOneTag") || "Please select at least one tag",
                      type: "error",
                    });
                    return;
                  }
                  try {
                    await batchAssignTags({
                      entityType: "order",
                      entityIds: selectedOrderIds,
                      tagIds: selectedTagIds,
                    }).unwrap();
                    
                    // Close modal and reset state
                    setIsTagModalOpen(false);
                    setSelectedTagIds([]);
                    setSelectedOrderIds([]);
                    setIsBatchTagMode(false);
                    
                    // Show success message
                    setAlertModal({
                      isOpen: true,
                      message: t("orders.tagsApplied") || "Tags applied successfully",
                      type: "success",
                    });
                    
                    // Force refetch - RTK Query should auto-refetch on cache invalidation,
                    // but we explicitly refetch to ensure tags appear immediately
                    // Use a small delay to ensure backend transaction completes
                    setTimeout(async () => {
                      try {
                        await refetchOrders();
                      } catch (err) {
                        console.error("Error refetching orders:", err);
                      }
                    }, 100);
                  } catch (error: any) {
                    setAlertModal({
                      isOpen: true,
                      message: error?.data?.message || t("orders.tagError") || "Failed to apply tags",
                      type: "error",
                    });
                  }
                }}
                disabled={isTagging || selectedTagIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isTagging ? t("orders.applying") || "Applying..." : t("orders.apply") || "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={() => {
          if (confirmModal.isBulk) {
            handleBulkDelete();
          } else if (confirmModal.orderId && confirmModal.orderId > 0) {
            handleDelete(confirmModal.orderId);
          }
        }}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />

      {/* Import Orders Modal */}
      {importModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.importOrders") || "Import Orders"}
              </h2>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-4">
                {t("orders.importDescription") || "Select an Excel file (.xlsx) to import orders. The file should contain an 'Orders' sheet with columns: Customer, Handler (optional), Currency Pair, Amount Buy, Amount Sell, Rate, Status."}
              </p>
              <div className="flex items-center gap-3">
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFile}
                    disabled={isImporting}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap"
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
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {t("orders.downloadTemplate") || "Download Template"}
                </button>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                }}
                disabled={isImporting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
            </div>
            {isImporting && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("orders.importing") || "Importing..."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OTC Order Modal */}
      {isOtcOrderModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {isOtcCompleted ? "View OTC Order" : otcEditingOrderId ? "Edit OTC Order" : "Create OTC Order"}
              </h2>
              <button
                onClick={closeOtcModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {isOtcCompleted && otcOrderDetails?.order ? (() => {
              const order = otcOrderDetails.order;
              const customerName = customers.find(c => c.id === order.customerId)?.name || "";
              const handlerName = users.find(u => u.id === order.handlerId)?.name || "";
              return (
              /* View Mode - Completed/Cancelled Order */
              <div className="space-y-6">
                {/* Order Details */}
                <div className="space-y-3 border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-600">Customer</label>
                      <p className="mt-1 text-sm text-slate-900">{customerName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Handler</label>
                      <p className="mt-1 text-sm text-slate-900">{handlerName || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Currency Pair</label>
                      <p className="mt-1 text-sm text-slate-900">{order.fromCurrency} / {order.toCurrency}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Rate</label>
                      <p className="mt-1 text-sm text-slate-900">{order.rate}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Amount Buy</label>
                      <p className="mt-1 text-sm text-slate-900">{order.amountBuy.toFixed(2)} {order.fromCurrency}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Amount Sell</label>
                      <p className="mt-1 text-sm text-slate-900">{order.amountSell.toFixed(2)} {order.toCurrency}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Status</label>
                      <p className="mt-1">
                        <Badge tone={order.status === "completed" ? "emerald" : "rose"}>{order.status}</Badge>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Date</label>
                      <p className="mt-1 text-sm text-slate-900">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Receipts */}
                {otcOrderDetails.receipts && otcOrderDetails.receipts.length > 0 && (
                  <div className="space-y-3 border-b border-slate-200 pb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Receipts ({order.fromCurrency})</h3>
                    <div className="space-y-2">
                      {otcOrderDetails.receipts.map((receipt, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm text-slate-900">{receipt.accountName || "-"}</span>
                          <span className="text-sm font-medium text-slate-900">{receipt.amount.toFixed(2)} {order.fromCurrency}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-sm font-semibold text-slate-900">Total</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {otcOrderDetails.receipts.reduce((sum, r) => sum + r.amount, 0).toFixed(2)} {order.fromCurrency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payments */}
                {otcOrderDetails.payments && otcOrderDetails.payments.length > 0 && (
                  <div className="space-y-3 border-b border-slate-200 pb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Payments ({order.toCurrency})</h3>
                    <div className="space-y-2">
                      {otcOrderDetails.payments.map((payment, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm text-slate-900">{payment.accountName || "-"}</span>
                          <span className="text-sm font-medium text-slate-900">{payment.amount.toFixed(2)} {order.toCurrency}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-sm font-semibold text-slate-900">Total</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {otcOrderDetails.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} {order.toCurrency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profit */}
                {order.profitAmount !== null && order.profitAmount !== undefined && order.profitAccountId && (
                  <div className="space-y-3 border-b border-slate-200 pb-4">
                    <h3 className="text-lg font-semibold text-blue-900">Profit</h3>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-900">
                          {accounts.find(a => a.id === order.profitAccountId)?.name || "-"} ({order.profitCurrency})
                        </span>
                        <span className="text-sm font-semibold text-blue-900">
                          {order.profitAmount > 0 ? "+" : ""}{order.profitAmount.toFixed(2)} {order.profitCurrency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Service Charges */}
                {order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined && order.serviceChargeAccountId && (
                  <div className="space-y-3 border-b border-slate-200 pb-4">
                    <h3 className="text-lg font-semibold text-green-900">Service Charges</h3>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-900">
                          {accounts.find(a => a.id === order.serviceChargeAccountId)?.name || "-"} ({order.serviceChargeCurrency})
                        </span>
                        <span className={`text-sm font-semibold ${order.serviceChargeAmount < 0 ? "text-red-600" : "text-green-700"}`}>
                          {order.serviceChargeAmount > 0 ? "+" : ""}{order.serviceChargeAmount.toFixed(2)} {order.serviceChargeCurrency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeOtcModal}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
              );
            })() : (
              /* Edit Mode - Form */
              <form className="space-y-6" onSubmit={handleOtcOrderSave}>
              {/* Order Creation Form Section */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                    value={otcForm.customerId}
                    onChange={(e) => setOtcForm((p) => ({ ...p, customerId: e.target.value }))}
                    required
                  >
                    <option value="">{t("orders.selectCustomer")}</option>
                    {customers.map((customer) => (
                      <option value={customer.id} key={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCreateCustomerModalOpen(true)}
                    className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
                  >
                    {t("orders.createNewCustomer")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={otcForm.fromCurrency}
                    onChange={(e) => setOtcForm((p) => ({ ...p, fromCurrency: e.target.value }))}
                    required
                  >
                    <option value="">{t("orders.from")}</option>
                    {currencies.filter((c) => Boolean(c.active) && c.code !== otcForm.toCurrency).map((c) => (
                      <option key={c.id} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={otcForm.toCurrency}
                    onChange={(e) => setOtcForm((p) => ({ ...p, toCurrency: e.target.value }))}
                    required
                  >
                    <option value="">{t("orders.to")}</option>
                    {currencies.filter((c) => Boolean(c.active) && c.code !== otcForm.fromCurrency).map((c) => (
                      <option key={c.id} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder={t("orders.exchangeRate")}
                  value={otcForm.rate}
                  onChange={(e) => setOtcForm((p) => ({ ...p, rate: e.target.value }))}
                  required
                  type="number"
                  step="0.0001"
                  onWheel={handleNumberInputWheel}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.amountBuy")}
                    value={otcForm.amountBuy}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOtcForm((p) => ({ ...p, amountBuy: value }));
                      if (value && otcForm.rate && otcForm.fromCurrency && otcForm.toCurrency) {
                        const rate = Number(otcForm.rate);
                        if (!isNaN(rate) && rate > 0) {
                          const baseIsFrom = getBaseCurrency(otcForm.fromCurrency, otcForm.toCurrency);
                          let sellAmount: string;
                          if (baseIsFrom === true) {
                            // Stronger/base currency (fromCurrency) → weaker (toCurrency): multiply by rate
                            sellAmount = (Number(value) * rate).toFixed(4);
                          } else if (baseIsFrom === false) {
                            // Weaker (fromCurrency) → stronger/base (toCurrency): divide by rate
                            sellAmount = (Number(value) / rate).toFixed(4);
                          } else {
                            // Fallback: if we can't determine, use simple multiplication
                            sellAmount = (Number(value) * rate).toFixed(4);
                          }
                          setOtcForm((p) => ({ ...p, amountSell: sellAmount }));
                        }
                      }
                    }}
                    required
                    type="number"
                    onWheel={handleNumberInputWheel}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.amountSell")}
                    value={otcForm.amountSell}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOtcForm((p) => ({ ...p, amountSell: value }));
                      if (value && otcForm.rate && otcForm.fromCurrency && otcForm.toCurrency) {
                        const rate = Number(otcForm.rate);
                        if (!isNaN(rate) && rate > 0) {
                          const baseIsFrom = getBaseCurrency(otcForm.fromCurrency, otcForm.toCurrency);
                          let buyAmount: string;
                          if (baseIsFrom === true) {
                            // Stronger/base currency (fromCurrency) → weaker (toCurrency): divide to get base amount
                            buyAmount = (Number(value) / rate).toFixed(4);
                          } else if (baseIsFrom === false) {
                            // Weaker (fromCurrency) → stronger/base (toCurrency): multiply to get base amount
                            buyAmount = (Number(value) * rate).toFixed(4);
                          } else {
                            // Fallback: if we can't determine, use simple division
                            buyAmount = (Number(value) / rate).toFixed(4);
                          }
                          setOtcForm((p) => ({ ...p, amountBuy: buyAmount }));
                        }
                      }
                    }}
                    required
                    type="number"
                    onWheel={handleNumberInputWheel}
                  />
                </div>
              </div>

              {/* Handler Assignment Section */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Handler Assignment</h3>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={otcForm.handlerId}
                  onChange={(e) => setOtcForm((p) => ({ ...p, handlerId: e.target.value }))}
                  required
                >
                  <option value="">{t("orders.selectHandler")}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              {/* Receipts Section */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Receipts ({otcForm.fromCurrency})</h3>
                  <button
                    type="button"
                    onClick={() => setOtcReceipts([...otcReceipts, { amount: "", accountId: "" }])}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Add Receipt
                  </button>
                </div>
                {otcReceipts.map((receipt, index) => (
                  <div key={index} className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={receipt.amount}
                      onChange={(e) => {
                        const newReceipts = [...otcReceipts];
                        newReceipts[index] = { ...newReceipts[index], amount: e.target.value };
                        setOtcReceipts(newReceipts);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2"
                      required
                      onWheel={handleNumberInputWheel}
                    />
                    <div className="flex gap-2">
                      <select
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                        value={receipt.accountId}
                        onChange={(e) => {
                          const newReceipts = [...otcReceipts];
                          newReceipts[index] = { ...newReceipts[index], accountId: e.target.value };
                          setOtcReceipts(newReceipts);
                        }}
                        required
                      >
                        <option value="">Select Account ({otcForm.fromCurrency})</option>
                        {accounts.filter((a) => a.currencyCode === otcForm.fromCurrency).map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setOtcReceipts(otcReceipts.filter((_, i) => i !== index))}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-sm text-slate-600">
                  Total: {otcReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toFixed(2)} {otcForm.fromCurrency}
                </div>
              </div>

              {/* Payments Section */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Payments ({otcForm.toCurrency})</h3>
                  <button
                    type="button"
                    onClick={() => setOtcPayments([...otcPayments, { amount: "", accountId: "" }])}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                  >
                    Add Payment
                  </button>
                </div>
                {otcPayments.map((payment, index) => (
                  <div key={index} className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={payment.amount}
                      onChange={(e) => {
                        const newPayments = [...otcPayments];
                        newPayments[index] = { ...newPayments[index], amount: e.target.value };
                        setOtcPayments(newPayments);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2"
                      required
                      onWheel={handleNumberInputWheel}
                    />
                    <div className="flex gap-2">
                      <select
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                        value={payment.accountId}
                        onChange={(e) => {
                          const newPayments = [...otcPayments];
                          newPayments[index] = { ...newPayments[index], accountId: e.target.value };
                          setOtcPayments(newPayments);
                        }}
                        required
                      >
                        <option value="">Select Account ({otcForm.toCurrency})</option>
                        {accounts.filter((a) => a.currencyCode === otcForm.toCurrency).map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setOtcPayments(otcPayments.filter((_, i) => i !== index))}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-sm text-slate-600">
                  Total: {otcPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2)} {otcForm.toCurrency}
                </div>
              </div>

              {/* Profit Section */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                {!showOtcProfitSection ? (
                  <button
                    type="button"
                    onClick={() => setShowOtcProfitSection(true)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Add Profit
                  </button>
                ) : (
                  <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-blue-900">Profit</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOtcProfitSection(false);
                          setOtcProfitAmount("");
                          setOtcProfitCurrency("");
                          setOtcProfitAccountId("");
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={otcProfitAmount}
                        onChange={(e) => setOtcProfitAmount(e.target.value)}
                        className="rounded-lg border border-blue-300 px-3 py-2"
                        onWheel={handleNumberInputWheel}
                      />
                      <select
                        value={otcProfitCurrency}
                        onChange={(e) => {
                          setOtcProfitCurrency(e.target.value);
                          setOtcProfitAccountId("");
                        }}
                        className="rounded-lg border border-blue-300 px-3 py-2"
                      >
                        <option value="">Select Currency</option>
                        {otcForm.fromCurrency && <option value={otcForm.fromCurrency}>{otcForm.fromCurrency}</option>}
                        {otcForm.toCurrency && <option value={otcForm.toCurrency}>{otcForm.toCurrency}</option>}
                      </select>
                    </div>
                    {otcProfitCurrency && (
                      <select
                        className="w-full mt-3 rounded-lg border border-blue-300 px-3 py-2"
                        value={otcProfitAccountId}
                        onChange={(e) => setOtcProfitAccountId(e.target.value)}
                      >
                        <option value="">Select Account ({otcProfitCurrency})</option>
                        {accounts.filter((a) => a.currencyCode === otcProfitCurrency).map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Service Charges Section */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                {!showOtcServiceChargeSection ? (
                  <button
                    type="button"
                    onClick={() => setShowOtcServiceChargeSection(true)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                  >
                    Add Service Charges
                  </button>
                ) : (
                  <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-green-900">Service Charges</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOtcServiceChargeSection(false);
                          setOtcServiceChargeAmount("");
                          setOtcServiceChargeCurrency("");
                          setOtcServiceChargeAccountId("");
                        }}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount (negative if paid by us)"
                        value={otcServiceChargeAmount}
                        onChange={(e) => setOtcServiceChargeAmount(e.target.value)}
                        className="rounded-lg border border-green-300 px-3 py-2"
                        onWheel={handleNumberInputWheel}
                      />
                      <select
                        value={otcServiceChargeCurrency}
                        onChange={(e) => {
                          setOtcServiceChargeCurrency(e.target.value);
                          setOtcServiceChargeAccountId("");
                        }}
                        className="rounded-lg border border-green-300 px-3 py-2"
                      >
                        <option value="">Select Currency</option>
                        {otcForm.fromCurrency && <option value={otcForm.fromCurrency}>{otcForm.fromCurrency}</option>}
                        {otcForm.toCurrency && <option value={otcForm.toCurrency}>{otcForm.toCurrency}</option>}
                      </select>
                    </div>
                    {otcServiceChargeCurrency && (
                      <select
                        className="w-full mt-3 rounded-lg border border-green-300 px-3 py-2"
                        value={otcServiceChargeAccountId}
                        onChange={(e) => setOtcServiceChargeAccountId(e.target.value)}
                      >
                        <option value="">Select Account ({otcServiceChargeCurrency})</option>
                        {accounts.filter((a) => a.currencyCode === otcServiceChargeCurrency).map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeOtcModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isSaving ? t("common.saving") : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleOtcOrderComplete}
                  disabled={isSaving}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60 transition-colors"
                >
                  Complete
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
