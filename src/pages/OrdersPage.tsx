import React, { useState, type FormEvent, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import OtcOrderModal from "../components/orders/OtcOrderModal";
import OnlineOrderModal from "../components/orders/OnlineOrderModal";
import { AccountTooltip } from "../components/orders/AccountTooltip";
import { SearchableSelect } from "../components/common/SearchableSelect";
import { OrdersFilters } from "../components/orders/OrdersFilters";
import { OrdersTable } from "../components/orders/OrdersTable";
import { OrdersColumnDropdown } from "../components/orders/OrdersColumnDropdown";
import { CreateCustomerModal } from "../components/orders/CreateCustomerModal";
import { ProcessOrderModal } from "../components/orders/ProcessOrderModal";
import { ImportOrdersModal } from "../components/orders/ImportOrdersModal";
import { OrderWarningModals } from "../components/orders/OrderWarningModals";
import { calculateAmountSell as calculateAmountSellUtil } from "../utils/orders/orderCalculations";
import { processImportFile } from "../utils/orders/orderImport";
import { exportOrdersToExcel } from "../utils/orders/orderExport";
import { useOrdersFilters } from "../hooks/orders/useOrdersFilters";
import { useOrdersTable } from "../hooks/orders/useOrdersTable";
import { useOrderForm } from "../hooks/orders/useOrderForm";
import { useProcessOrderModal } from "../hooks/orders/useProcessOrderModal";
import { useViewOrderModal } from "../hooks/orders/useViewOrderModal";
import { useOtcOrder } from "../hooks/orders/useOtcOrder";
import { useBeneficiaryForm } from "../hooks/orders/useBeneficiaryForm";

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

export default function OrdersPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: roles = [] } = useGetRolesQuery();

  // Page state
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Filter state and handlers
  const {
    filters,
    setFilters,
    updateFilter,
    handleDatePresetChange,
    handleClearFilters,
    queryParams,
    exportQueryParams,
    isTagFilterOpen,
    setIsTagFilterOpen,
    tagFilterHighlight,
    setTagFilterHighlight,
    tagFilterListRef,
  } = useOrdersFilters(currentPage, setCurrentPage);

  const { data: ordersData, isLoading, refetch: refetchOrders } = useGetOrdersQuery(queryParams);
  const orders = ordersData?.orders || [];
  const totalOrders = ordersData?.total || 0;
  const totalPages = ordersData?.totalPages || 1;

  const { data: customers = [] } = useGetCustomersQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: users = [] } = useGetUsersQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: tags = [] } = useGetTagsQuery();
  const [addOrder, { isLoading: isSaving }] = useAddOrderMutation();

  // Order form state and handlers
  const {
    form,
    setForm,
    calculatedField,
    setCalculatedField,
    isFlexOrderMode,
    setIsFlexOrderMode,
    editingOrderId,
    setEditingOrderId,
    isModalOpen,
    setIsModalOpen,
    resetForm,
    closeModal,
  } = useOrderForm(currencies);

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


  // Export orders function
  const [isExporting, setIsExporting] = useState(false);
  const handleExportOrders = useCallback(async () => {
    try {
      setIsExporting(true);
      const result = await exportOrdersToExcel(exportQueryParams, t);
      setAlertModal({
        isOpen: true,
        message: (t("orders.exportSuccess") || "Successfully exported {{count}} orders to {{fileName}}")
          .replace("{{count}}", result.count.toString())
          .replace("{{fileName}}", result.fileName),
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
        "Order ID": "EXT-1001",
        "Customer": "Example Customer",
        "Handler": "John Doe",
        "Currency Pair": "USD/HKD",
        "Amount Buy": 1000,
        "Buy Account": "Main USD",
        "Amount Sell": 7800,
        "Sell Account": "Main HKD",
        "Rate": 7.8,
        "Profit Amount": 50,
        "Profit Currency": "USD",
        "Profit Account": "Main USD",
        "Service Charges Amount": -10,
        "Service Charges Currency": "HKD",
        "Service Charges Account": "Main HKD",
        "Status": "completed",
        "Order Type": "online",
        "Tags": "Priority, VIP"
      },
      {
        "Order ID": "EXT-1002",
        "Customer": "Another Customer",
        "Handler": "Jane Smith",
        "Currency Pair": "USDT/USD",
        "Amount Buy": 500,
        "Buy Account": "USDT Wallet",
        "Amount Sell": 500,
        "Sell Account": "USD Wallet",
        "Rate": 1.0,
        "Profit Amount": "",
        "Profit Currency": "",
        "Profit Account": "",
        "Service Charges Amount": "",
        "Service Charges Currency": "",
        "Service Charges Account": "",
        "Status": "completed",
        "Order Type": "otc",
        "Tags": ""
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

      // Process import file
      const { orders: validatedOrders, errors: validationErrors } = await processImportFile(
        file,
        customers,
        users,
        currencies,
        currencyPairs,
        accounts,
        tags
      );

      // Import validated orders
      let successCount = 0;
      let errorCount = validationErrors.length;
      const errors = [...validationErrors];

      for (const orderData of validatedOrders) {
        try {
          // Convert null values to undefined for API compatibility
          const apiOrderData = {
            ...orderData,
            profitAmount: orderData.profitAmount ?? undefined,
            profitCurrency: orderData.profitCurrency ?? undefined,
            profitAccountId: orderData.profitAccountId ?? undefined,
            serviceChargeAmount: orderData.serviceChargeAmount ?? undefined,
            serviceChargeCurrency: orderData.serviceChargeCurrency ?? undefined,
            serviceChargeAccountId: orderData.serviceChargeAccountId ?? undefined,
          };
          await addOrder(apiOrderData).unwrap();
          successCount++;
        } catch (error: any) {
          errors.push(`Order ${orderData.customerId}: ${error.message || "Unknown error"}`);
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
      const errorMessage = error.message || "Unknown error";
      if (errorMessage.includes("Orders sheet not found")) {
        setAlertModal({
          isOpen: true,
          message: t("orders.ordersSheetNotFound") || "Orders sheet not found in the file",
          type: "error",
        });
      } else if (errorMessage.includes("No orders found")) {
        setAlertModal({
          isOpen: true,
          message: t("orders.noOrdersInFile") || "No orders found in the file",
          type: "error",
        });
      } else {
        setAlertModal({
          isOpen: true,
          message: t("orders.importError") || `Failed to import orders: ${errorMessage}`,
          type: "error",
        });
      }
    } finally {
      setIsImporting(false);
    }
  }, [customers, users, currencies, currencyPairs, accounts, tags, addOrder, t]);

  // Helper function to prevent number input from changing value on scroll
  const handleNumberInputWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (document.activeElement === target) {
      target.blur();
    }
  }, []);

  // Helper function to calculate amountSell from amountBuy using the same logic as order creation
  const calculateAmountSell = useCallback((amountBuy: number, rate: number, fromCurrency: string, toCurrency: string): number => {
    return calculateAmountSellUtil(amountBuy, rate, fromCurrency, toCurrency, currencies);
  }, [currencies]);

  const [updateOrder] = useUpdateOrderMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();
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
  // Tag filter helpers (needs tags from query)
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
        const exists = filters.tagIds.includes(tag.id);
        const next = exists ? filters.tagIds.filter((id) => id !== tag.id) : [...filters.tagIds, tag.id];
        updateFilter('tagIds', next);
      }
    }
  };
  
  // Column management via hook
  const {
    isColumnDropdownOpen,
    setIsColumnDropdownOpen,
    columnDropdownRef,
    availableColumns,
    visibleColumns,
    toggleColumnVisibility,
    draggedColumnIndex,
    dragOverIndex,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleColumnDragLeave,
  } = useOrdersTable();

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
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  // Process order modal state and handlers
  const {
    processModalOrderId,
    setProcessModalOrderId,
    processForm,
    setProcessForm,
    resetProcessForm,
    closeProcessModal,
  } = useProcessOrderModal();
  
  // View order modal state and handlers
  const {
    viewModalOrderId,
    setViewModalOrderId,
    makePaymentModalOrderId,
    setMakePaymentModalOrderId,
    closeViewModal,
    receiptUploads,
    setReceiptUploads,
    paymentUploads,
    setPaymentUploads,
    receiptUploadKey,
    setReceiptUploadKey,
    paymentUploadKey,
    setPaymentUploadKey,
    showReceiptUpload,
    setShowReceiptUpload,
    showPaymentUpload,
    setShowPaymentUpload,
    receiptDragOver,
    setReceiptDragOver,
    paymentDragOver,
    setPaymentDragOver,
    activeUploadType,
    setActiveUploadType,
    receiptFileInputRefs,
    paymentFileInputRefs,
    flexOrderRate,
    setFlexOrderRate,
    excessPaymentWarning,
    setExcessPaymentWarning,
    profitAmount,
    setProfitAmount,
    profitCurrency,
    setProfitCurrency,
    profitAccountId,
    setProfitAccountId,
    serviceChargeAmount,
    setServiceChargeAmount,
    serviceChargeCurrency,
    setServiceChargeCurrency,
    serviceChargeAccountId,
    setServiceChargeAccountId,
    showProfitSection,
    setShowProfitSection,
    showServiceChargeSection,
    setShowServiceChargeSection,
    showExcessPaymentModal,
    setShowExcessPaymentModal,
    excessPaymentModalData,
    setExcessPaymentModalData,
    showMissingPaymentModal,
    setShowMissingPaymentModal,
    missingPaymentModalData,
    setMissingPaymentModalData,
    showExcessReceiptModal,
    setShowExcessReceiptModal,
    excessReceiptModalData,
    setExcessReceiptModalData,
    showExcessPaymentModalNormal,
    setShowExcessPaymentModalNormal,
    excessPaymentModalNormalData,
    setExcessPaymentModalNormalData,
  } = useViewOrderModal();
  
  const previousOrderStatusRef = useRef<string | null>(null);
  
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const menuElementRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    src: string;
    type: 'image' | 'pdf';
    title: string;
  } | null>(null);

  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // processForm is now provided by useProcessOrderModal hook

  // Beneficiary form state and handlers
  const {
    beneficiaryForm,
    setBeneficiaryForm,
    saveBeneficiaryToCustomer,
    setSaveBeneficiaryToCustomer,
    selectedCustomerBeneficiaryId,
    setSelectedCustomerBeneficiaryId,
    applyCustomerBeneficiaryToForm,
    resetBeneficiaryForm,
    closeMakePaymentModal,
    handleAddBeneficiary,
  } = useBeneficiaryForm(
    orders,
    accounts,
    makePaymentModalOrderId,
    setOpenMenuId,
    setViewModalOrderId,
    setMakePaymentModalOrderId,
    t
  );

  // receiptUploads and paymentUploads are now provided by useViewOrderModal hook
  
  // OTC Order state and handlers
  const {
    isOtcOrderModalOpen,
    setIsOtcOrderModalOpen,
    otcEditingOrderId,
    setOtcEditingOrderId,
    otcForm,
    setOtcForm,
    otcReceipts,
    setOtcReceipts,
    otcPayments,
    setOtcPayments,
    otcProfitAmount,
    setOtcProfitAmount,
    otcProfitCurrency,
    setOtcProfitCurrency,
    otcProfitAccountId,
    setOtcProfitAccountId,
    otcServiceChargeAmount,
    setOtcServiceChargeAmount,
    otcServiceChargeCurrency,
    setOtcServiceChargeCurrency,
    otcServiceChargeAccountId,
    setOtcServiceChargeAccountId,
    showOtcProfitSection,
    setShowOtcProfitSection,
    showOtcServiceChargeSection,
    setShowOtcServiceChargeSection,
    otcCalculatedField,
    setOtcCalculatedField,
    otcOrderDetails,
    isOtcCompleted,
    handleOtcOrderSave,
    handleOtcOrderComplete,
    closeOtcModal,
  } = useOtcOrder(accounts, setOpenMenuId, setIsCreateCustomerModalOpen);

  const { data: orderDetails } = useGetOrderDetailsQuery(viewModalOrderId || 0, {
    skip: !viewModalOrderId,
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

  // OTC order state and handlers are now provided by useOtcOrder hook

  // resetForm is now provided by useOrderForm hook

  // resetProcessForm is now provided by useProcessOrderModal hook

  // resetBeneficiaryForm is now provided by useBeneficiaryForm hook

  // resetOtcForm and closeOtcModal are now provided by useOtcOrder hook
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



  // Auto-calculation logic is now handled by useOrderForm hook

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
      // Form will be loaded automatically by useOtcOrder hook when otcEditingOrderId changes
      setOtcEditingOrderId(orderId);
      setIsOtcOrderModalOpen(true);
      setOpenMenuId(null);
      // Load receipts, payments, profit, service charges via orderDetails query (handled by useOtcOrder hook)
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

  // closeProcessModal is now provided by useProcessOrderModal hook

  // closeViewModal is now provided by useViewOrderModal hook

  // closeMakePaymentModal is now provided by useBeneficiaryForm hook

  // OTC Order handlers are now provided by useOtcOrder hook

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
        handlerId: authUser?.id ?? undefined,
        orderType: "online",
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

  // handleAddBeneficiary is now provided by useBeneficiaryForm hook

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

  // Action buttons and status tone are now handled by OrderActionsMenu component

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

  // Column management and rendering is now handled by OrdersTable component

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
            <OrdersColumnDropdown
              isOpen={isColumnDropdownOpen}
              onToggle={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
              availableColumns={availableColumns}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumnVisibility}
              draggedColumnIndex={draggedColumnIndex}
              dragOverIndex={dragOverIndex}
              onDragStart={handleColumnDragStart}
              onDragOver={handleColumnDragOver}
              onDragEnd={handleColumnDragEnd}
              onDragLeave={handleColumnDragLeave}
              dropdownRef={columnDropdownRef}
              t={t}
            />
          </div>
        }
      >
        {/* Filter Section */}
        <OrdersFilters
          filters={filters}
          isExpanded={isFilterExpanded}
          onToggleExpanded={() => setIsFilterExpanded(!isFilterExpanded)}
          onDatePresetChange={handleDatePresetChange}
          onFilterChange={updateFilter}
          onClearFilters={handleClearFilters}
          onExport={handleExportOrders}
          isExporting={isExporting}
          isTagFilterOpen={isTagFilterOpen}
          setIsTagFilterOpen={setIsTagFilterOpen}
          tagFilterHighlight={tagFilterHighlight}
          setTagFilterHighlight={setTagFilterHighlight}
          tagFilterListRef={tagFilterListRef}
          onTagFilterKeyDown={handleTagFilterKeyDown}
          users={users}
          customers={customers}
          accounts={accounts}
          currencyPairs={currencyPairs}
          tags={tags}
          selectedTagNames={selectedTagNames}
          tagFilterLabel={tagFilterLabel}
        />

        <OrdersTable
          orders={orders}
          accounts={accounts}
          showCheckbox={isBatchTagMode || (canDeleteManyOrders && isBatchDeleteMode)}
          selectedOrderIds={selectedOrderIds}
          onSelectOrder={(orderId, selected) => {
            if (selected) {
              setSelectedOrderIds((prev) =>
                prev.includes(orderId) ? prev : [...prev, orderId]
              );
            } else {
              setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
            }
          }}
          onSelectAll={(selected) => {
            setSelectedOrderIds(selected ? orders.map((o) => o.id) : []);
          }}
          openMenuId={openMenuId}
          menuPositionAbove={menuPositionAbove}
          menuRefs={menuRefs}
          menuElementRefs={menuElementRefs}
          onMenuToggle={(orderId) => setOpenMenuId(openMenuId === orderId ? null : orderId)}
          onEdit={startEdit}
          onProcess={(orderId) => {
            setProcessModalOrderId(orderId);
            setOpenMenuId(null);
          }}
          onView={(orderId) => {
            setViewModalOrderId(orderId);
            setOpenMenuId(null);
          }}
          onCancel={(orderId) => setStatus(orderId, "cancelled")}
          onDelete={handleDeleteClick}
          canCancelOrder={canCancelOrder}
          canDeleteOrder={canDeleteOrder}
          isDeleting={isDeleting}
          currentPage={currentPage}
          totalPages={totalPages}
          totalOrders={totalOrders}
          onPageChange={setCurrentPage}
        />
      </SectionCard>

      <OnlineOrderModal
        isOpen={isModalOpen}
        isFlexOrderMode={isFlexOrderMode}
        editingOrderId={editingOrderId}
        isSaving={isSaving}
        form={form}
        setForm={setForm}
        calculatedField={calculatedField}
        setCalculatedField={setCalculatedField}
        customers={customers}
        currencies={currencies}
        handleNumberInputWheel={handleNumberInputWheel}
        onSubmit={submit}
        onClose={closeModal}
        setIsCreateCustomerModalOpen={setIsCreateCustomerModalOpen}
        t={t}
      />

      {/* Create Customer Modal */}
      <CreateCustomerModal
        isOpen={isCreateCustomerModalOpen}
        customerForm={customerForm}
        setCustomerForm={setCustomerForm}
        isCreatingCustomer={isCreatingCustomer}
        onClose={() => {
          setIsCreateCustomerModalOpen(false);
          resetCustomerForm();
        }}
        onSubmit={handleCreateCustomer}
      />

      {/* Process Order Modal */}
      <ProcessOrderModal
        isOpen={!!processModalOrderId}
        processForm={processForm}
        setProcessForm={setProcessForm}
        users={users}
        onClose={closeProcessModal}
        onSubmit={handleProcess}
      />

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

      {/* Order Warning Modals */}
      <OrderWarningModals
        showExcessPaymentModal={showExcessPaymentModal}
        excessPaymentModalData={excessPaymentModalData}
        onCloseExcessPayment={() => {
          setShowExcessPaymentModal(false);
          setExcessPaymentModalData(null);
        }}
        showMissingPaymentModal={showMissingPaymentModal}
        missingPaymentModalData={missingPaymentModalData}
        onCloseMissingPayment={() => {
          setShowMissingPaymentModal(false);
          setMissingPaymentModalData(null);
        }}
        showExcessReceiptModal={showExcessReceiptModal}
        excessReceiptModalData={excessReceiptModalData}
        onCloseExcessReceipt={() => {
          setShowExcessReceiptModal(false);
          setExcessReceiptModalData(null);
        }}
        showExcessPaymentModalNormal={showExcessPaymentModalNormal}
        excessPaymentModalNormalData={excessPaymentModalNormalData}
        onCloseExcessPaymentNormal={() => {
          setShowExcessPaymentModalNormal(false);
          setExcessPaymentModalNormalData(null);
        }}
      />

      {/* Excess Payment Warning Modal - Replaced by OrderWarningModals */}
      {/* Removed old modal code - now using OrderWarningModals component */}

      {/* Excess Receipt Warning Modal - Replaced by OrderWarningModals */}
      {/* Removed old modal code - now using OrderWarningModals component */}

      {/* Excess Payment Warning Modal for Normal Orders - Replaced by OrderWarningModals */}
      {/* Removed old modal code - now using OrderWarningModals component */}

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
      <ImportOrdersModal
        isOpen={importModalOpen}
        isImporting={isImporting}
        onClose={() => setImportModalOpen(false)}
        onFileChange={handleImportFile}
        onDownloadTemplate={handleDownloadTemplate}
      />

      <OtcOrderModal
        isOpen={isOtcOrderModalOpen}
        isSaving={isSaving}
        isOtcCompleted={isOtcCompleted}
        otcEditingOrderId={otcEditingOrderId}
        otcOrderDetails={otcOrderDetails}
        customers={customers}
        users={users}
        currencies={currencies}
        accounts={accounts}
        otcForm={otcForm}
        setOtcForm={setOtcForm}
        otcReceipts={otcReceipts}
        setOtcReceipts={setOtcReceipts}
        otcPayments={otcPayments}
        setOtcPayments={setOtcPayments}
        showOtcProfitSection={showOtcProfitSection}
        setShowOtcProfitSection={setShowOtcProfitSection}
        showOtcServiceChargeSection={showOtcServiceChargeSection}
        setShowOtcServiceChargeSection={setShowOtcServiceChargeSection}
        otcProfitAmount={otcProfitAmount}
        setOtcProfitAmount={setOtcProfitAmount}
        otcProfitCurrency={otcProfitCurrency}
        setOtcProfitCurrency={setOtcProfitCurrency}
        otcProfitAccountId={otcProfitAccountId}
        setOtcProfitAccountId={setOtcProfitAccountId}
        otcServiceChargeAmount={otcServiceChargeAmount}
        setOtcServiceChargeAmount={setOtcServiceChargeAmount}
        otcServiceChargeCurrency={otcServiceChargeCurrency}
        setOtcServiceChargeCurrency={setOtcServiceChargeCurrency}
        otcServiceChargeAccountId={otcServiceChargeAccountId}
        setOtcServiceChargeAccountId={setOtcServiceChargeAccountId}
        handleNumberInputWheel={handleNumberInputWheel}
        getBaseCurrency={getBaseCurrency}
        onSave={handleOtcOrderSave}
        onComplete={handleOtcOrderComplete}
        onClose={closeOtcModal}
        setIsCreateCustomerModalOpen={setIsCreateCustomerModalOpen}
        t={t}
      />
    </div>
  );
}

