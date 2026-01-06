import React, { useState, type FormEvent, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
import { ReceiptDisplay } from "../components/orders/ReceiptDisplay";
import { PaymentDisplay } from "../components/orders/PaymentDisplay";
import { ReceiptUploadSection } from "../components/orders/ReceiptUploadSection";
import { PaymentUploadSection } from "../components/orders/PaymentUploadSection";
import { ProfitServiceChargeSection } from "../components/orders/ProfitServiceChargeSection";
import { FlexOrderRatePanel } from "../components/orders/FlexOrderRatePanel";
import { ViewOrderModal } from "../components/orders/ViewOrderModal";
import { OnlineOrderUploadsSection } from "../components/orders/OnlineOrderUploadsSection";
import { CompleteOrderButton } from "../components/orders/CompleteOrderButton";
import { OnlineOrderSummary } from "../components/orders/OnlineOrderSummary";
import { TagSelectionModal } from "../components/common/TagSelectionModal";
import { calculateAmountSell as calculateAmountSellUtil } from "../utils/orders/orderCalculations";
import { useOrdersFilters } from "../hooks/orders/useOrdersFilters";
import { useOrdersTable } from "../hooks/orders/useOrdersTable";
import { useOrderForm } from "../hooks/orders/useOrderForm";
import { useProcessOrderModal } from "../hooks/orders/useProcessOrderModal";
import { useViewOrderModal } from "../hooks/orders/useViewOrderModal";
import { useOtcOrder } from "../hooks/orders/useOtcOrder";
import { useBeneficiaryForm } from "../hooks/orders/useBeneficiaryForm";
import { useOrdersModals } from "../hooks/orders/useOrdersModals";
import { useOrdersImportExport } from "../hooks/orders/useOrdersImportExport";
import { useOrdersCustomer } from "../hooks/orders/useOrdersCustomer";
import { useOrdersActions } from "../hooks/orders/useOrdersActions";
import { useOrdersFileUpload } from "../hooks/orders/useOrdersFileUpload";
import { useBatchDelete } from "../hooks/useBatchDelete";

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

  // Modal state management
  const {
    alertModal,
    setAlertModal,
    confirmModal,
    setConfirmModal,
    isCreateCustomerModalOpen,
    setIsCreateCustomerModalOpen,
    importModalOpen,
    setImportModalOpen,
    isImporting,
    setIsImporting,
    viewerModal,
    setViewerModal,
  } = useOrdersModals();

  // Import/Export functionality
  const {
    isExporting,
    handleExportOrders,
    handleDownloadTemplate,
    handleImportFile,
  } = useOrdersImportExport({
    exportQueryParams,
    customers,
    users,
    currencies,
    currencyPairs,
    accounts,
    tags,
    addOrder,
    setAlertModal,
    setIsImporting,
    setImportModalOpen,
    t,
  });


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

  // Batch delete hook
  const {
    isBatchDeleteMode,
    selectedIds: selectedOrderIds,
    setSelectedIds: setSelectedOrderIds,
    setIsBatchDeleteMode,
    handleDeleteClick: batchDeleteHandleDeleteClick,
    handleDelete: batchDeleteHandleDelete,
    handleBulkDelete: batchDeleteHandleBulkDelete,
    toggleBatchDeleteMode,
    exitBatchDeleteMode,
    confirmModal: batchDeleteConfirmModal,
    setConfirmModal: setBatchDeleteConfirmModal,
  } = useBatchDelete({
    deleteSingle: (id: number) => deleteOrder(id),
    confirmMessage: t("orders.confirmDeleteOrder") || "Are you sure you want to delete this order?",
    confirmBulkMessage: t("orders.confirmDeleteSelected") || "Are you sure you want to delete the selected orders?",
    errorMessage: t("orders.errorDeleting"),
    t,
    setAlertModal,
  });

  // Adapter for confirm modal to match existing structure
  // Use batch delete modal for delete operations
  const deleteConfirmModal = {
    isOpen: batchDeleteConfirmModal.isOpen,
    message: batchDeleteConfirmModal.message,
    orderId: batchDeleteConfirmModal.entityId,
    isBulk: batchDeleteConfirmModal.isBulk,
  };
  const setDeleteConfirmModal = (modal: { isOpen: boolean; message: string; orderId: number | null; isBulk?: boolean }) => {
    setBatchDeleteConfirmModal({
      isOpen: modal.isOpen,
      message: modal.message,
      entityId: modal.orderId,
      isBulk: modal.isBulk || false,
    });
  };
  const [batchAssignTags, { isLoading: isTagging }] = useBatchAssignTagsMutation();
  const [batchUnassignTags, { isLoading: isUntagging }] = useBatchUnassignTagsMutation();
  const [addCustomer, { isLoading: isCreatingCustomer }] = useAddCustomerMutation();

  // Customer creation functionality
  const {
    customerForm,
    setCustomerForm,
    resetCustomerForm,
    handleCreateCustomer,
  } = useOrdersCustomer({
    addCustomer,
    setForm,
    setIsCreateCustomerModalOpen,
  });
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
    columnOrder,
    visibleColumns,
    getColumnLabel,
    toggleColumnVisibility,
    draggedColumnIndex,
    dragOverIndex,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleColumnDragLeave,
  } = useOrdersTable();

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

  // Order actions (edit, delete, status updates, process)
  const {
    setStatus,
    startEdit,
    submit,
    handleProcess,
  } = useOrdersActions({
    orders,
    updateOrderStatus,
    deleteOrder,
    updateOrder,
    addOrder,
    processOrder,
    setOpenMenuId,
    setConfirmModal: setDeleteConfirmModal,
    setAlertModal,
    setOtcEditingOrderId,
    setIsOtcOrderModalOpen,
    setEditingOrderId,
    setForm,
    setIsModalOpen,
    form,
    editingOrderId,
    resetForm,
    isFlexOrderMode,
    authUser,
    setProcessModalOrderId,
    setIsFlexOrderMode,
    processModalOrderId,
    processForm,
    resetProcessForm,
    selectedOrderIds,
    setSelectedOrderIds,
    setIsBatchDeleteMode,
    t,
  });

  // Use batch delete handlers from hook
  const handleDeleteClick = batchDeleteHandleDeleteClick;
  const handleDelete = batchDeleteHandleDelete;
  const handleBulkDelete = batchDeleteHandleBulkDelete;

  const { data: orderDetails } = useGetOrderDetailsQuery(viewModalOrderId || 0, {
    skip: !viewModalOrderId,
  });

  // File upload handling
  const {
    handleAddReceipt,
    handleAddPayment,
    handleImageUpload,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileChange,
    getFileType,
  } = useOrdersFileUpload({
    viewModalOrderId,
    makePaymentModalOrderId,
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
    orderDetails,
    addReceipt,
    addPayment,
    setExcessReceiptModalData,
    setShowExcessReceiptModal,
    setExcessPaymentModalNormalData,
    setShowExcessPaymentModalNormal,
    setExcessPaymentWarning,
    t,
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



  // closeProcessModal is now provided by useProcessOrderModal hook

  // closeViewModal is now provided by useViewOrderModal hook

  // closeMakePaymentModal is now provided by useBeneficiaryForm hook

  // OTC Order handlers are now provided by useOtcOrder hook



  // handleAddBeneficiary is now provided by useBeneficiaryForm hook

  // Tag selection handlers
  const handleTagSelectionChange = useCallback((tagId: number, checked: boolean) => {
    if (checked) {
      setSelectedTagIds((prev) => [...prev, tagId]);
    } else {
      setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    }
  }, []);

  const handleApplyTags = useCallback(async () => {
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
      
      // Force refetch
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
  }, [selectedTagIds, selectedOrderIds, batchAssignTags, t, setAlertModal, refetchOrders]);

  const handleRemoveTags = useCallback(async () => {
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
  }, [selectedTagIds, selectedOrderIds, batchUnassignTags, t, setAlertModal, refetchOrders]);

  const handleCloseTagModal = useCallback(() => {
    setIsTagModalOpen(false);
    setSelectedTagIds([]);
  }, []);

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
                onClick={() => {
                  if (!isBatchDeleteMode) {
                    setIsBatchDeleteMode(true);
                    setIsBatchTagMode(false); // Exit batch tag mode if active
                    setSelectedOrderIds([]);
                  } else {
                    // Toggle will handle confirmation modal
                    toggleBatchDeleteMode();
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
          columnOrder={columnOrder}
          visibleColumns={visibleColumns}
          getColumnLabel={getColumnLabel}
          showCheckbox={isBatchTagMode || (canDeleteManyOrders && isBatchDeleteMode)}
          selectedOrderIds={selectedOrderIds}
          onSelectOrder={(orderId, selected) => {
            if (selected) {
              setSelectedOrderIds((prev: number[]) =>
                prev.includes(orderId) ? prev : [...prev, orderId]
              );
            } else {
              setSelectedOrderIds((prev: number[]) => prev.filter((id: number) => id !== orderId));
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
        <ViewOrderModal
          isOpen={!!viewModalOrderId}
          onClose={closeViewModal}
          title={t("orders.orderDetails")}
        >
          <div className={orderDetails.order.isFlexOrder ? "grid grid-cols-1 lg:grid-cols-3 gap-4" : "space-y-4"}>
              {/* For flex orders, show both receipt and payment sections */}
              {orderDetails.order.isFlexOrder ? (
                <>
                  {/* For flex orders: Show upload section when under_process, summary when not */}
                  {isUnderProcess ? (
                    <OnlineOrderUploadsSection
                    orderDetails={orderDetails}
                    accounts={accounts}
                    orders={orders}
                    viewModalOrderId={viewModalOrderId}
                    receipts={orderDetails.receipts}
                    totalReceiptAmount={orderDetails.totalReceiptAmount}
                    receiptBalance={orderDetails.receiptBalance}
                    showReceiptUpload={showReceiptUpload}
                    setShowReceiptUpload={setShowReceiptUpload}
                    receiptUploads={receiptUploads}
                    setReceiptUploads={setReceiptUploads}
                    receiptUploadKey={receiptUploadKey}
                    receiptDragOver={receiptDragOver}
                    setReceiptDragOver={setReceiptDragOver}
                    receiptFileInputRefs={receiptFileInputRefs}
                    handleAddReceipt={handleAddReceipt}
                    confirmReceipt={confirmReceipt}
                    deleteReceipt={deleteReceipt}
                    payments={orderDetails.payments}
                    totalPaymentAmount={orderDetails.totalPaymentAmount}
                    paymentBalance={orderDetails.paymentBalance}
                    excessPaymentWarning={excessPaymentWarning}
                    showPaymentUpload={showPaymentUpload}
                    setShowPaymentUpload={setShowPaymentUpload}
                    paymentUploads={paymentUploads}
                    setPaymentUploads={setPaymentUploads}
                    paymentUploadKey={paymentUploadKey}
                    paymentDragOver={paymentDragOver}
                    setPaymentDragOver={setPaymentDragOver}
                    paymentFileInputRefs={paymentFileInputRefs}
                    handleAddPayment={handleAddPayment}
                    confirmPayment={confirmPayment}
                    deletePayment={deletePayment}
                    handleImageUpload={handleImageUpload}
                    handleDrop={handleDrop}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleFileChange={handleFileChange}
                    handleNumberInputWheel={handleNumberInputWheel}
                    setActiveUploadType={setActiveUploadType}
                    getFileType={getFileType}
                    setViewerModal={setViewerModal}
                    openPdfInNewTab={openPdfInNewTab}
                    isFlexOrder={true}
                    showCancelButtons={false}
                    layout="grid"
                    t={t}
                  />
                  ) : (
                    <>
                      {/* Order Summary for Flex Orders - When not in under_process */}
                      <div className="lg:col-span-3">
                        <OnlineOrderSummary
                          orderDetails={orderDetails}
                          accounts={accounts}
                          viewModalOrderId={viewModalOrderId}
                          confirmReceipt={confirmReceipt}
                          deleteReceipt={deleteReceipt}
                          confirmPayment={confirmPayment}
                          deletePayment={deletePayment}
                          getFileType={getFileType}
                          setViewerModal={setViewerModal}
                          openPdfInNewTab={openPdfInNewTab}
                          t={t}
                        />
                      </div>

                      {/* Purple Section - Right Side, Sticky */}
                      {orderDetails.order.status !== "completed" && 
                       orderDetails.order.status !== "cancelled" && (
                        <FlexOrderRatePanel
                          orderId={viewModalOrderId}
                          flexOrderRate={flexOrderRate}
                          setFlexOrderRate={setFlexOrderRate}
                          orderDetails={orderDetails}
                          currencies={currencies}
                          adjustFlexOrderRate={adjustFlexOrderRate}
                          handleNumberInputWheel={handleNumberInputWheel}
                          t={t}
                        />
                      )}

                      {/* Display existing profit if it exists - For Flex Orders */}
                      {orderDetails.order.profitAmount !== null && orderDetails.order.profitAmount !== undefined && (
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
                      {orderDetails.order.serviceChargeAmount !== null && orderDetails.order.serviceChargeAmount !== undefined && (
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
                      {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                        <ProfitServiceChargeSection
                          orderId={viewModalOrderId}
                          order={orderDetails?.order}
                          accounts={accounts}
                          profitAmount={profitAmount}
                          setProfitAmount={setProfitAmount}
                          profitCurrency={profitCurrency}
                          setProfitCurrency={setProfitCurrency}
                          profitAccountId={profitAccountId}
                          setProfitAccountId={setProfitAccountId}
                          showProfitSection={showProfitSection}
                          setShowProfitSection={setShowProfitSection}
                          serviceChargeAmount={serviceChargeAmount}
                          setServiceChargeAmount={setServiceChargeAmount}
                          serviceChargeCurrency={serviceChargeCurrency}
                          setServiceChargeCurrency={setServiceChargeCurrency}
                          serviceChargeAccountId={serviceChargeAccountId}
                          setServiceChargeAccountId={setServiceChargeAccountId}
                          showServiceChargeSection={showServiceChargeSection}
                          setShowServiceChargeSection={setShowServiceChargeSection}
                          updateOrder={updateOrder}
                          handleNumberInputWheel={handleNumberInputWheel}
                          layout="grid"
                          t={t}
                        />
                      )}

                      {/* Complete Order Button for Flex Orders */}
                      <CompleteOrderButton
                        orderId={viewModalOrderId}
                        orderDetails={orderDetails}
                        currencies={currencies}
                        flexOrderRate={flexOrderRate}
                        updateOrderStatus={updateOrderStatus}
                        calculateAmountSell={calculateAmountSell}
                        resolveFlexOrderRate={resolveFlexOrderRate}
                        setMissingPaymentModalData={setMissingPaymentModalData}
                        setShowMissingPaymentModal={setShowMissingPaymentModal}
                        setExcessPaymentModalData={setExcessPaymentModalData}
                        setShowExcessPaymentModal={setShowExcessPaymentModal}
                        layout="grid"
                        t={t}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Regular order flow - show sections based on status */}
                  {/* Regular order flow - show sections based on status */}
              {isUnderProcess && !orderDetails.order.isFlexOrder && (
                <OnlineOrderUploadsSection
                  orderDetails={orderDetails}
                  accounts={accounts}
                  orders={orders}
                  viewModalOrderId={viewModalOrderId}
                  receipts={orderDetails.receipts}
                  totalReceiptAmount={orderDetails.totalReceiptAmount}
                  receiptBalance={orderDetails.receiptBalance}
                  showReceiptUpload={showReceiptUpload}
                  setShowReceiptUpload={setShowReceiptUpload}
                  receiptUploads={receiptUploads}
                  setReceiptUploads={setReceiptUploads}
                  receiptUploadKey={receiptUploadKey}
                  receiptDragOver={receiptDragOver}
                  setReceiptDragOver={setReceiptDragOver}
                  receiptFileInputRefs={receiptFileInputRefs}
                  handleAddReceipt={handleAddReceipt}
                  confirmReceipt={confirmReceipt}
                  deleteReceipt={deleteReceipt}
                  payments={orderDetails.payments}
                  totalPaymentAmount={orderDetails.totalPaymentAmount}
                  paymentBalance={orderDetails.paymentBalance}
                  showPaymentUpload={showPaymentUpload}
                  setShowPaymentUpload={setShowPaymentUpload}
                  paymentUploads={paymentUploads}
                  setPaymentUploads={setPaymentUploads}
                  paymentUploadKey={paymentUploadKey}
                  paymentDragOver={paymentDragOver}
                  setPaymentDragOver={setPaymentDragOver}
                  paymentFileInputRefs={paymentFileInputRefs}
                  handleAddPayment={handleAddPayment}
                  confirmPayment={confirmPayment}
                  deletePayment={deletePayment}
                  handleImageUpload={handleImageUpload}
                  handleDrop={handleDrop}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleFileChange={handleFileChange}
                  handleNumberInputWheel={handleNumberInputWheel}
                  setActiveUploadType={setActiveUploadType}
                  getFileType={getFileType}
                  setViewerModal={setViewerModal}
                  openPdfInNewTab={openPdfInNewTab}
                  isFlexOrder={false}
                  showCancelButtons={true}
                  layout="vertical"
                  t={t}
                />
              )}

              {/* Order Summary - For both flex and regular orders when not in under_process */}
              {!isUnderProcess && orderDetails && (
                <OnlineOrderSummary
                  orderDetails={orderDetails}
                  accounts={accounts}
                  viewModalOrderId={viewModalOrderId}
                  confirmReceipt={confirmReceipt}
                  deleteReceipt={deleteReceipt}
                  confirmPayment={confirmPayment}
                  deletePayment={deletePayment}
                  getFileType={getFileType}
                  setViewerModal={setViewerModal}
                  openPdfInNewTab={openPdfInNewTab}
                  t={t}
                />
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
              {!orderDetails.order.isFlexOrder && orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                <ProfitServiceChargeSection
                  orderId={viewModalOrderId}
                  order={orderDetails?.order}
                  accounts={accounts}
                  profitAmount={profitAmount}
                  setProfitAmount={setProfitAmount}
                  profitCurrency={profitCurrency}
                  setProfitCurrency={setProfitCurrency}
                  profitAccountId={profitAccountId}
                  setProfitAccountId={setProfitAccountId}
                  showProfitSection={showProfitSection}
                  setShowProfitSection={setShowProfitSection}
                  serviceChargeAmount={serviceChargeAmount}
                  setServiceChargeAmount={setServiceChargeAmount}
                  serviceChargeCurrency={serviceChargeCurrency}
                  setServiceChargeCurrency={setServiceChargeCurrency}
                  serviceChargeAccountId={serviceChargeAccountId}
                  setServiceChargeAccountId={setServiceChargeAccountId}
                  showServiceChargeSection={showServiceChargeSection}
                  setShowServiceChargeSection={setShowServiceChargeSection}
                  updateOrder={updateOrder}
                  handleNumberInputWheel={handleNumberInputWheel}
                  layout="vertical"
                  t={t}
                />
              )}

              {/* Complete Order Button for Regular Orders */}
              {!orderDetails.order.isFlexOrder && (
                <CompleteOrderButton
                  orderId={viewModalOrderId}
                  orderDetails={orderDetails}
                  currencies={currencies}
                  flexOrderRate={null}
                  updateOrderStatus={updateOrderStatus}
                  calculateAmountSell={calculateAmountSell}
                  layout="vertical"
                  t={t}
                />
              )}
                </>
              )}
            </div>
        </ViewOrderModal>
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
      <TagSelectionModal
        isOpen={isTagModalOpen}
        onClose={handleCloseTagModal}
        tags={tags}
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
        onApply={handleApplyTags}
        onRemove={handleRemoveTags}
        isApplying={isTagging}
        isRemoving={isUntagging}
        t={t}
      />

      {/* Delete confirmation modal (for delete operations) */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        message={deleteConfirmModal.message}
        onConfirm={() => {
          if (deleteConfirmModal.isBulk) {
            handleBulkDelete();
          } else if (deleteConfirmModal.orderId !== null && deleteConfirmModal.orderId > 0) {
            handleDelete(deleteConfirmModal.orderId);
          }
        }}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false })}
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

