import { useState, type FormEvent, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import { ColumnDropdown } from "../components/common/ColumnDropdown";
import { TagSelectionModal } from "../components/common/TagSelectionModal";
import { ActionsMenu } from "../components/common/ActionsMenu";
import type { ActionMenuItem } from "../components/common/ActionsMenu";
import { ExpensesFilters } from "../components/expenses/ExpensesFilters";
import { ImportExpensesModal } from "../components/expenses/ImportExpensesModal";
import { Pagination } from "../components/common/Pagination";
import Badge from "../components/common/Badge";
import { AccountSelect } from "../components/common/AccountSelect";
import { Tooltip } from "../components/common/Tooltip";
import { useExpensesTable } from "../hooks/expenses/useExpensesTable";
import { useExpensesFilters } from "../hooks/expenses/useExpensesFilters";
import { useExpensesImportExport } from "../hooks/expenses/useExpensesImportExport";
import { useBatchDelete } from "../hooks/useBatchDelete";
import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetAccountsQuery,
  useGetExpenseChangesQuery,
  useGetTagsQuery,
  useGetUsersQuery,
  useGetCurrenciesQuery,
  useBatchAssignTagsMutation,
  useBatchUnassignTagsMutation,
} from "../services/api";
import { useAppSelector } from "../app/hooks";
import { formatDate, formatDateTime } from "../utils/format";
import { hasActionPermission } from "../utils/permissions";

// Helper function to format currency with proper number formatting
const formatCurrency = (amount: number, currencyCode: string) => {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
};

export default function ExpensesPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state and handlers
  const {
    filters,
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
  } = useExpensesFilters(currentPage, setCurrentPage);

  const { data: expensesData, isLoading, refetch: refetchExpenses } = useGetExpensesQuery(queryParams);
  // Handle both paginated response (object) and array response
  const expenses = Array.isArray(expensesData) ? expensesData : (expensesData as any)?.expenses || [];
  const totalExpenses = Array.isArray(expensesData) ? expenses.length : (expensesData as any)?.total || expenses.length;
  const totalPages = Math.ceil(totalExpenses / 20);
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: tags = [] } = useGetTagsQuery();
  const { data: users = [] } = useGetUsersQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
  const [deleteExpense, { isLoading: isDeleting }] = useDeleteExpenseMutation();
  const [batchAssignTags, { isLoading: isTagging }] = useBatchAssignTagsMutation();
  const [batchUnassignTags, { isLoading: isUntagging }] = useBatchUnassignTagsMutation();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  // Batch delete hook
  const {
    isBatchDeleteMode,
    selectedIds: selectedExpenseIds,
    setSelectedIds: setSelectedExpenseIds,
    setIsBatchDeleteMode,
    handleDeleteClick,
    handleDelete,
    handleBulkDelete,
    toggleBatchDeleteMode,
    exitBatchDeleteMode,
    confirmModal: batchDeleteConfirmModal,
    setConfirmModal: setBatchDeleteConfirmModal,
  } = useBatchDelete({
    deleteSingle: (id: number) => deleteExpense({ id, deletedBy: authUser?.id }),
    confirmMessage: t("expenses.confirmDelete"),
    confirmBulkMessage: t("expenses.confirmDeleteSelected"),
    errorMessage: t("expenses.errorDeleting"),
    t,
    setAlertModal,
  });

  // Adapter for confirm modal to match existing structure
  const confirmModal = {
    isOpen: batchDeleteConfirmModal.isOpen,
    message: batchDeleteConfirmModal.message,
    expenseId: batchDeleteConfirmModal.entityId,
    isBulk: batchDeleteConfirmModal.isBulk,
  };
  const setConfirmModal = (modal: { isOpen: boolean; message: string; expenseId: number | null; isBulk?: boolean }) => {
    setBatchDeleteConfirmModal({
      isOpen: modal.isOpen,
      message: modal.message,
      entityId: modal.expenseId,
      isBulk: modal.isBulk || false,
    });
  };


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [isBatchTagMode, setIsBatchTagMode] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [viewImageExpenseId, setViewImageExpenseId] = useState<number | null>(null);
  const [viewAuditTrailExpenseId, setViewAuditTrailExpenseId] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageDragOver, setImageDragOver] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // Import/Export functionality
  const {
    isExporting,
    handleExportExpenses,
    handleDownloadTemplate,
    handleImportFile,
  } = useExpensesImportExport({
    exportQueryParams: exportQueryParams,
    accounts,
    tags,
    users,
    addExpense: createExpense,
    setAlertModal,
    setIsImporting,
    setImportModalOpen: setIsImportModalOpen,
    t,
  });
  
  // Column management via hook
  const {
    availableColumns,
    columnOrder,
    visibleColumns,
    getColumnLabel,
    toggleColumnVisibility,
    isColumnDropdownOpen,
    setIsColumnDropdownOpen,
    columnDropdownRef,
    draggedColumnIndex,
    dragOverIndex,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleColumnDragLeave,
  } = useExpensesTable();

  const { data: expenseChanges = [], isLoading: isLoadingChanges } = 
    useGetExpenseChangesQuery(viewAuditTrailExpenseId || 0, { skip: !viewAuditTrailExpenseId });

  // Check if user has any of the action permissions to show Actions column
  const canDeleteExpense = hasActionPermission(authUser, "deleteExpense");
  const canEditExpense = hasActionPermission(authUser, "editExpense");
  const canViewExpenseAuditTrail = hasActionPermission(authUser, "viewExpenseAuditTrail");
  const hasAnyActionPermission = canDeleteExpense || canEditExpense || canViewExpenseAuditTrail;

  const [form, setForm] = useState<{
    accountId: string;
    amount: string;
    description: string;
    imagePath: string;
    file?: File;
  }>({
    accountId: "",
    amount: "",
    description: "",
    imagePath: "",
  });

  const resetForm = () => {
    setForm({
      accountId: "",
      amount: "",
      description: "",
      imagePath: "",
      file: undefined,
    });
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
    setEditingExpenseId(null);
  };

  const startEdit = (expenseId: number) => {
    const expense = expenses.find((e: any) => e.id === expenseId);
    if (!expense) return;
    
    setEditingExpenseId(expenseId);
    setForm({
      accountId: String(expense.accountId),
      amount: String(expense.amount),
      description: expense.description || "",
      imagePath: expense.imagePath || "",
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = (file: File) => {
    // Check if file is an image or PDF
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    
    if (!isImage && !isPDF) {
      setAlertModal({ 
        isOpen: true, 
        message: t("expenses.invalidImageFile"), 
        type: "error" 
      });
      return;
    }

    // Store File object
    setForm((p) => ({ ...p, file }));

    // Convert to base64 for preview (keep existing behavior)
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setForm((p) => ({ ...p, imagePath: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImageDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
    if (validFiles.length > 0) {
      handleImageUpload(validFiles[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragOver(false);
  };

  // Helper function to check if a path is a PDF (handles both data URIs and file paths)
  const isPdfFile = (path: string): boolean => {
    if (!path) return false;
    // Check for data URI format
    if (path.startsWith('data:application/pdf')) return true;
    // Check for file path ending in .pdf
    if (path.toLowerCase().endsWith('.pdf')) return true;
    return false;
  };

  // Helper function to open PDF in a new tab (handles both data URIs and file URLs)
  const openPdfInNewTab = (pdfPath: string) => {
    try {
      // If it's a data URI, convert to blob
      if (pdfPath.startsWith('data:')) {
        const byteString = atob(pdfPath.split(',')[1]);
        const mimeString = pdfPath.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Clean up the URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } else {
        // It's a file path/URL - open directly
        window.open(pdfPath, '_blank');
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      // Fallback: try opening directly
      window.open(pdfPath, '_blank');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    
    // Validate form fields - check for empty strings and ensure values are valid
    const accountId = form.accountId?.trim();
    const amount = form.amount?.trim();
    const description = form.description?.trim();
    
    if (!accountId || !amount || !description) {
      setAlertModal({ 
        isOpen: true, 
        message: t("expenses.accountAndAmountRequired"), 
        type: "warning" 
      });
      return;
    }
    
    // Validate that accountId and amount are valid numbers
    const accountIdNum = Number(accountId);
    const amountNum = Number(amount);
    
    if (isNaN(accountIdNum) || accountIdNum <= 0) {
      setAlertModal({ 
        isOpen: true, 
        message: t("expenses.invalidAccount"), 
        type: "warning" 
      });
      return;
    }
    
    if (isNaN(amountNum) || amountNum <= 0) {
      setAlertModal({ 
        isOpen: true, 
        message: t("expenses.invalidAmount"), 
        type: "warning" 
      });
      return;
    }

    try {
      if (editingExpenseId) {
        // Update existing expense
        const updateData: any = {
          accountId: accountIdNum,
          amount: amountNum,
          description: description,
          updatedBy: authUser?.id,
        };
        // Send File object if available, otherwise fallback to base64 (backward compatibility)
        if (form.file) {
          updateData.file = form.file;
        } else if (form.imagePath) {
          updateData.imagePath = form.imagePath;
        }
        await updateExpense({
          id: editingExpenseId,
          data: updateData,
        }).unwrap();
      } else {
        // Create new expense
        const createData: any = {
          accountId: accountIdNum,
          amount: amountNum,
          description: description,
          createdBy: authUser?.id,
        };
        // Send File object if available, otherwise fallback to base64 (backward compatibility)
        if (form.file) {
          createData.file = form.file;
        } else if (form.imagePath) {
          createData.imagePath = form.imagePath;
        }
        await createExpense(createData).unwrap();
      }
      closeModal();
    } catch (error: any) {
      setAlertModal({ 
        isOpen: true, 
        message: error?.data?.message || t("expenses.errorCreating"), 
        type: "error" 
      });
    }
  };


  const selectedAccount = accounts.find((a) => a.id === Number(form.accountId));
  
  // When editing, get the expense's currency to filter accounts
  const editingExpense = editingExpenseId 
    ? expenses.find((e: any) => e.id === editingExpenseId)
    : null;
  const expenseCurrencyCode = editingExpense?.currencyCode;

  // Handle Esc key to close create/edit expense modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [isModalOpen]);

  // Handle Esc key to close view image modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewImageExpenseId) {
        setViewImageExpenseId(null);
      }
    };

    if (viewImageExpenseId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [viewImageExpenseId]);

  // Handle Esc key to close audit trail modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewAuditTrailExpenseId) {
        setViewAuditTrailExpenseId(null);
      }
    };

    if (viewAuditTrailExpenseId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [viewAuditTrailExpenseId]);

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
        message: t("expenses.selectAtLeastOneTag"),
        type: "error",
      });
      return;
    }
    try {
      await batchAssignTags({
        entityType: "expense",
        entityIds: selectedExpenseIds,
        tagIds: selectedTagIds,
      }).unwrap();
      
      setIsTagModalOpen(false);
      setSelectedTagIds([]);
      setSelectedExpenseIds([]);
      setIsBatchTagMode(false);
      
      setAlertModal({
        isOpen: true,
        message: t("expenses.tagsApplied"),
        type: "success",
      });
      
      setTimeout(async () => {
        try {
          await refetchExpenses();
        } catch (err) {
          console.error("Error refetching expenses:", err);
        }
      }, 100);
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("expenses.tagError"),
        type: "error",
      });
    }
  }, [selectedTagIds, selectedExpenseIds, batchAssignTags, t, refetchExpenses]);

  const handleRemoveTags = useCallback(async () => {
    if (selectedTagIds.length === 0) {
      setAlertModal({
        isOpen: true,
        message: t("expenses.selectAtLeastOneTag"),
        type: "error",
      });
      return;
    }
    try {
      await batchUnassignTags({
        entityType: "expense",
        entityIds: selectedExpenseIds,
        tagIds: selectedTagIds,
      }).unwrap();

      setIsTagModalOpen(false);
      setSelectedTagIds([]);
      setSelectedExpenseIds([]);
      setIsBatchTagMode(false);

      setAlertModal({
        isOpen: true,
        message: t("expenses.tagsRemovedSuccess"),
        type: "success",
      });

      setTimeout(async () => {
        try {
          await refetchExpenses();
        } catch (err) {
          console.error("Error refetching expenses:", err);
        }
      }, 100);
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message:
          error?.data?.message ||
          error?.message ||
          t("expenses.failedToRemoveTags"),
        type: "error",
      });
    }
  }, [selectedTagIds, selectedExpenseIds, batchUnassignTags, t, refetchExpenses]);

  const handleCloseTagModal = useCallback(() => {
    setIsTagModalOpen(false);
    setSelectedTagIds([]);
  }, []);

  // Tag filter helpers
  const selectedTagNames = useMemo(
    () =>
      filters.tagIds
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    [filters.tagIds, tags],
  );

  const tagFilterLabel = useMemo(() => {
    if (selectedTagNames.length === 0) {
      return t("expenses.selectTag") || t("orders.selectTag") || "Select Tag";
    }
    return selectedTagNames.join(", ");
  }, [selectedTagNames, t]);

  const handleTagFilterKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [isTagFilterOpen, tags, tagFilterHighlight, filters.tagIds, updateFilter, setIsTagFilterOpen, setTagFilterHighlight]);

  // Helper function to get action menu items for an expense
  const getExpenseActions = (expense: typeof expenses[0]): ActionMenuItem[] => {
    const actions: ActionMenuItem[] = [];

    if (canViewExpenseAuditTrail) {
      actions.push({
        key: "audit",
        label: t("expenses.auditTrail"),
        onClick: () => setViewAuditTrailExpenseId(expense.id),
        color: "blue",
      });
    }

    if (canEditExpense) {
      actions.push({
        key: "edit",
        label: t("common.edit"),
        onClick: () => startEdit(expense.id),
        color: "amber",
      });
    }

    if (canDeleteExpense) {
      actions.push({
        key: "delete",
        label: t("common.delete"),
        onClick: () => handleDeleteClick(expense.id),
        color: "rose",
        disabled: isDeleting,
        separator: true, // Add separator before delete
      });
    }

    return actions;
  };

  // Helper function to render cell content for a column
  const renderCellContent = (columnKey: string, expense: typeof expenses[0]) => {
    switch (columnKey) {
      case "id":
        return <td key={columnKey} className="py-2 font-mono text-slate-600">#{expense.id}</td>;
      case "date":
        return <td key={columnKey} className="py-2">{formatDate(expense.createdAt)}</td>;
      case "description":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {expense.description ? (
              expense.description.length > 10 ? (
                <Tooltip 
                  content={<div className="text-sm text-slate-700">{expense.description}</div>}
                  copyText={expense.description}
                >
                  <span className="inline-block max-w-[10ch] truncate cursor-help">
                    {expense.description.substring(0, 10) + "..."}
                  </span>
                </Tooltip>
              ) : (
                <span>{expense.description}</span>
              )
            ) : (
              "-"
            )}
          </td>
        );
      case "account":
        return (
          <td key={columnKey} className="py-2 font-semibold text-slate-900">
            {expense.accountName || expense.accountId}
          </td>
        );
      case "amount":
        return (
          <td key={columnKey} className="py-2 font-semibold text-slate-900">
            {formatCurrency(expense.amount, expense.currencyCode)}
          </td>
        );
      case "currency":
        return <td key={columnKey} className="py-2">{expense.currencyCode}</td>;
      case "proof":
        return (
          <td key={columnKey} className="py-2">
            {expense.imagePath ? (
              <button
                onClick={() => setViewImageExpenseId(expense.id)}
                className="text-blue-600 hover:text-blue-700 underline text-sm"
              >
                {t("expenses.viewProof")}
              </button>
            ) : (
              "-"
            )}
          </td>
        );
      case "tags":
        return (
          <td key={columnKey} className="py-2">
            <div className="flex flex-wrap gap-1">
              {expense.tags && Array.isArray(expense.tags) && expense.tags.length > 0 ? (
                expense.tags.map((tag: { id: number; name: string; color: string }) => (
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
      case "createdBy":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {expense.createdByName || "-"}
          </td>
        );
      case "updatedBy":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {expense.updatedByName || "-"}
          </td>
        );
      case "updatedAt":
        return (
          <td key={columnKey} className="py-2 text-slate-600 text-xs">
            {expense.updatedAt ? formatDate(expense.updatedAt) : "-"}
          </td>
        );
      default:
        return null;
    }
  };

  // Handle paste event for image upload
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste when modal is open
      if (!isModalOpen) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageUpload(file);
          }
          break;
        }
      }
    };

    if (isModalOpen) {
      window.addEventListener('paste', handlePaste);
      return () => {
        window.removeEventListener('paste', handlePaste);
      };
    }
  }, [isModalOpen]);

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("expenses.title")}
        // 我 REMOVED DESCRIPTION UNDER THE TITLE BEING DISPLAYED
        //  description={t("expenses.titledescription")}
        actions={
          <div className="flex items-center gap-4">
            {isLoading ? t("common.loading") : `${totalExpenses} ${t("expenses.expenses")}`}
            {hasActionPermission(authUser, "createExpense") && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                {t("expenses.createExpense")}
              </button>
            )}
            {hasActionPermission(authUser, "assignUnassignExpenseTag") && (
              <button
                onClick={async () => {
                  if (!isBatchTagMode) {
                    // Enable batch tag mode
                    setIsBatchTagMode(true);
                    setIsBatchDeleteMode(false); // Exit batch delete mode if active
                    setSelectedExpenseIds([]);
                  } else {
                    // If no expenses selected, exit batch tag mode
                    if (!selectedExpenseIds.length) {
                      setIsBatchTagMode(false);
                      setSelectedExpenseIds([]);
                      return;
                    }
                    // Open tag selection modal
                    setIsTagModalOpen(true);
                  }
                }}
                disabled={isTagging || isUntagging}
                className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
              >
                {isTagging || isUntagging
                  ? t("expenses.tagging")
                  : isBatchTagMode
                    ? (selectedExpenseIds.length > 0 ? t("expenses.addTags") : t("common.cancel"))
                    : t("expenses.addTag")}
              </button>
            )}
            {hasActionPermission(authUser, "deleteExpense") && (
              <button
                onClick={async () => {
                  if (!isBatchDeleteMode) {
                    // Enable batch delete mode
                    setIsBatchDeleteMode(true);
                    setIsBatchTagMode(false); // Exit batch tag mode if active
                    setSelectedExpenseIds([]);
                  } else {
                    // Toggle will handle the confirmation modal
                    toggleBatchDeleteMode();
                  }
                }}
                disabled={isDeleting}
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                {isDeleting
                  ? t("common.deleting")
                  : isBatchDeleteMode
                  ? (selectedExpenseIds.length > 0 ? t("expenses.deleteSelected") : t("common.cancel"))
                  : t("expenses.batchDelete")}
              </button>
            )}
            {hasActionPermission(authUser, "importExpense") && (
              <button
                onClick={() => setIsImportModalOpen(true)}
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
                {t("expenses.import")}
              </button>
            )}
            <ColumnDropdown
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
              translationKeys={{
                columns: "expenses.columns",
                showColumns: "expenses.showColumns",
              }}
            />
          </div>
        }
      >
        {/* Filter Section */}
        <ExpensesFilters
          filters={filters}
          isExpanded={isFilterExpanded}
          onToggleExpanded={() => setIsFilterExpanded(!isFilterExpanded)}
          onDatePresetChange={handleDatePresetChange}
          onFilterChange={updateFilter}
          onClearFilters={handleClearFilters}
          onExport={handleExportExpenses}
          isExporting={isExporting}
          canExport={hasActionPermission(authUser, "exportExpense")}
          isTagFilterOpen={isTagFilterOpen}
          setIsTagFilterOpen={setIsTagFilterOpen}
          tagFilterHighlight={tagFilterHighlight}
          setTagFilterHighlight={setTagFilterHighlight}
          tagFilterListRef={tagFilterListRef}
          onTagFilterKeyDown={handleTagFilterKeyDown}
          users={users}
          accounts={accounts}
          currencies={currencies}
          tags={tags}
          selectedTagNames={selectedTagNames}
          tagFilterLabel={tagFilterLabel}
        />

        <div className="overflow-x-auto min-h-[60vh]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                {(isBatchDeleteMode || isBatchTagMode) && (
                  <th className="py-2 w-8">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={
                        !!expenses.length &&
                        selectedExpenseIds.length === expenses.length
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSelectedExpenseIds(
                          e.target.checked ? expenses.map((e: any) => e.id) : []
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
                {!isBatchDeleteMode && !isBatchTagMode && hasAnyActionPermission && (
                  <th className="py-2">{t("expenses.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense: any) => (
                <tr key={expense.id} className="border-b border-slate-100">
                  {(isBatchDeleteMode || isBatchTagMode) && (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedExpenseIds.includes(expense.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExpenseIds((prev: number[]) =>
                              prev.includes(expense.id)
                                ? prev
                                : [...prev, expense.id]
                            );
                          } else {
                            setSelectedExpenseIds((prev: number[]) =>
                              prev.filter((id: number) => id !== expense.id)
                            );
                          }
                        }}
                      />
                    </td>
                  )}
                  {columnOrder.map((columnKey) => 
                    visibleColumns.has(columnKey) ? renderCellContent(columnKey, expense) : null
                  )}
                  {!isBatchDeleteMode && !isBatchTagMode && hasAnyActionPermission && (
                    <td className="py-2">
                      <ActionsMenu
                        actions={getExpenseActions(expense)}
                        entityId={expense.id}
                        t={t}
                        buttonAriaLabel={t("expenses.actions")}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {!expenses.length && (
                <tr>
                  <td
                    className="py-4 text-sm text-slate-500"
                    colSpan={
                      (isBatchDeleteMode || isBatchTagMode ? 1 : 0) +
                      columnOrder.filter((key) => visibleColumns.has(key)).length +
                      (hasAnyActionPermission && !isBatchDeleteMode && !isBatchTagMode ? 1 : 0)
                    }
                  >
                    {t("expenses.noExpenses")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalExpenses}
          onPageChange={setCurrentPage}
          t={t}
          entityName={t("expenses.expenses")}
        />
      </SectionCard>

      {/* Create/Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white z-10 p-6 pb-4 border-b border-slate-200 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingExpenseId
                  ? t("expenses.editExpenseTitle")
                  : t("expenses.createExpenseTitle")}
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
            <div className="overflow-y-auto flex-1 p-6 pt-4">
              <form className="grid gap-3" onSubmit={handleSubmit}>
              <AccountSelect
                value={form.accountId}
                onChange={(accountId) => setForm((p) => ({ ...p, accountId }))}
                accounts={accounts}
                label={t("expenses.account")}
                placeholder={t("expenses.selectAccount")}
                required
                showBalance={true}
                filterByCurrency={expenseCurrencyCode}
                t={t}
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("expenses.amount")}{" "}
                  {selectedAccount && `(${selectedAccount.currencyCode})`}
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  required
                  disabled={!form.accountId}
                />
                {selectedAccount &&
                  form.amount &&
                  Number(form.amount) > selectedAccount.balance && (
                    <div className="mt-1 text-xs text-amber-600">
                      {t("expenses.insufficientBalance")} -{" "}
                      {t("expenses.newBalanceWillBe")}:{" "}
                      {formatCurrency(
                        selectedAccount.balance - Number(form.amount),
                        selectedAccount.currencyCode
                      )}
                    </div>
                  )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("expenses.description")} *
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder={t("expenses.descriptionPlaceholder")}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("expenses.proofOfPayment")} ({t("common.optional")})
                </label>
                <div
                  className={`p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                    imageDragOver
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {!form.imagePath && (
                    <div className="text-center py-4 text-slate-500 text-sm mb-2">
                      <p className="mb-2">Drag & drop file here (image or PDF), paste (Ctrl+V), or</p>
                    </div>
                  )}
                  <div className="relative mb-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="expense-file-input"
                    />
                    <label
                      htmlFor="expense-file-input"
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
                  {form.imagePath && (
                    <div className="relative mt-2">
                      {form.imagePath.startsWith('data:image/') ? (
                        <img
                          src={form.imagePath}
                          alt="Proof of payment"
                          className="max-w-full max-h-96 w-auto h-auto object-contain rounded"
                        />
                      ) : isPdfFile(form.imagePath) ? (
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
                        onClick={() => {
                          setForm((p) => ({ ...p, imagePath: "" }));
                          if (imageInputRef.current) {
                            imageInputRef.current.value = "";
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
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={
                    isCreating ||
                    isUpdating ||
                    !form.accountId ||
                    !form.amount ||
                    !form.description
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isCreating || isUpdating
                    ? t("common.saving")
                    : editingExpenseId
                    ? t("expenses.updateExpense")
                    : t("expenses.createExpense")}
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Image/PDF Modal */}
      {viewImageExpenseId && (() => {
        const expense = expenses.find((e: any) => e.id === viewImageExpenseId);
        const imagePath = expense?.imagePath || "";
        const isPDF = isPdfFile(imagePath);
        
        return (
          <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-75" style={{ margin: 0, padding: 0 }}>
            <div
              className="relative max-w-4xl max-h-[90vh] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setViewImageExpenseId(null)}
                className="absolute top-2 right-2 z-10 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
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
              {isPDF ? (
                <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg">
                  <svg
                    className="w-24 h-24 text-red-500 mb-4"
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
                  <p className="text-lg font-medium text-slate-700 mb-2">PDF Document</p>
                  <p className="text-sm text-slate-500 mb-4">Click the button below to view the PDF</p>
                  <button
                    onClick={() => openPdfInNewTab(imagePath)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Open PDF in New Tab
                  </button>
                </div>
              ) : (
                <img
                  src={imagePath}
                  alt="Proof of payment"
                  className="max-w-full max-h-[90vh] rounded-lg"
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* Audit Trail Modal */}
      {viewAuditTrailExpenseId && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("expenses.auditTrailTitle", {
                  id: viewAuditTrailExpenseId,
                })}
              </h2>
              <button
                onClick={() => setViewAuditTrailExpenseId(null)}
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

            {(() => {
              const expense = expenses.find(
                (e: any) => e.id === viewAuditTrailExpenseId
              );
              if (!expense) return null;

              return (
                <div className="space-y-4">
                  {/* Summary Section */}
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      {t("expenses.description")}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">
                          {t("expenses.created")}:
                        </span>{" "}
                        <span className="text-slate-600">
                          {formatDateTime(expense.createdAt)} {t("expenses.by")} {expense.createdByName || "-"}
                        </span>
                      </div>
                      {expense.updatedAt && (
                        <div>
                          <span className="font-medium text-slate-700">
                            {t("expenses.updated")}:
                          </span>{" "}
                          <span className="text-slate-600">
                            {formatDateTime(expense.updatedAt)} {t("expenses.by")} {expense.updatedByName || "-"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Change History Table */}
                  <div className="mt-6">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      {t("expenses.changeHistory")}
                    </h3>
                    {isLoadingChanges ? (
                      <div className="text-center py-4 text-slate-500">
                        {t("common.loading")}
                      </div>
                    ) : expenseChanges.length === 0 ? (
                      <div className="text-center py-4 text-slate-500">
                        {t("expenses.noExpenses")}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border border-slate-200 rounded-lg">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("expenses.date")} & {t("expenses.updatedAt")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("expenses.updatedBy")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("expenses.account")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("expenses.amount")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("expenses.description")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {expenseChanges.map((change, index) => (
                              <tr
                                key={change.id}
                                className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                              >
                                <td className="py-2 px-3 border-b border-slate-100 text-slate-600">
                                  {formatDateTime(change.changedAt)}
                                </td>
                                <td className="py-2 px-3 border-b border-slate-100 text-slate-600">
                                  {change.changedByName || "-"}
                                </td>
                                <td className="py-2 px-3 border-b border-slate-100 text-slate-600">
                                  {change.accountName || change.accountId}
                                </td>
                                <td className="py-2 px-3 border-b border-slate-100 font-semibold text-slate-900">
                                  {formatCurrency(change.amount, expense.currencyCode)}
                                </td>
                                <td className="py-2 px-3 border-b border-slate-100 text-slate-600">
                                  {change.description || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type || "error"}
        onClose={() => setAlertModal({ isOpen: false, message: "", type: "error" })}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={() => {
          if (confirmModal.isBulk) {
            handleBulkDelete();
          } else if (confirmModal.expenseId !== null && confirmModal.expenseId > 0) {
            handleDelete(confirmModal.expenseId);
          }
        }}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", expenseId: null, isBulk: false })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />

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
        title={t("expenses.selectTags")}
        noTagsMessage={t("expenses.noTagsAvailable")}
        selectAtLeastOneMessage={t("expenses.selectAtLeastOneTag")}
        applyButtonText={t("expenses.apply")}
        removeButtonText={t("expenses.remove")}
        cancelButtonText={t("common.cancel")}
        applyingText={t("expenses.applying")}
        savingText={t("common.saving")}
        t={t}
      />

      {/* Import Expenses Modal */}
      <ImportExpensesModal
        isOpen={isImportModalOpen}
        isImporting={isImporting}
        onClose={() => setIsImportModalOpen(false)}
        onFileChange={handleImportFile}
        onDownloadTemplate={handleDownloadTemplate}
      />
    </div>
  );
}

