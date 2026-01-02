import { useState, type FormEvent, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useGetTransfersQuery,
  useCreateTransferMutation,
  useUpdateTransferMutation,
  useDeleteTransferMutation,
  useGetAccountsQuery,
  useGetTransferChangesQuery,
} from "../services/api";
import { useAppSelector } from "../app/hooks";
import { formatDate, formatDateTime } from "../utils/format";
import { hasActionPermission } from "../utils/permissions";
import type { Account } from "../types";

// Helper function to format currency with proper number formatting
const formatCurrency = (amount: number, currencyCode: string) => {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
};

export default function TransfersPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: transfers = [], isLoading } = useGetTransfersQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const [createTransfer, { isLoading: isCreating }] = useCreateTransferMutation();
  const [updateTransfer, { isLoading: isUpdating }] = useUpdateTransferMutation();
  const [deleteTransfer, { isLoading: isDeleting }] = useDeleteTransferMutation();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; transferId: number | null; isBulk?: boolean }>({
    isOpen: false,
    message: "",
    transferId: null,
    isBulk: false,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState<number | null>(null);
  const [selectedTransferIds, setSelectedTransferIds] = useState<number[]>([]);
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  const [viewAuditTrailTransferId, setViewAuditTrailTransferId] = useState<number | null>(null);
  
  // Column visibility state
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
  
  // Define all available column keys (used for initialization)
  const columnKeys = ["id", "date", "description", "fromAccount", "toAccount", "amount", "transactionFee", "currency", "createdBy"];
  
  // Define all available columns (with translated labels) - this is the master list
  const getAvailableColumns = () => [
    { key: "id", label: t("transfers.transferId") },
    { key: "date", label: t("transfers.date") },
    { key: "description", label: t("transfers.description") },
    { key: "fromAccount", label: t("transfers.fromAccount") },
    { key: "toAccount", label: t("transfers.toAccount") },
    { key: "amount", label: t("transfers.amount") },
    { key: "transactionFee", label: t("transfers.transactionFee") },
    { key: "currency", label: t("transfers.currency") },
    { key: "createdBy", label: t("transfers.createdBy") },
  ];
  
  // Initialize column order from localStorage or default order
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("transfersPage_columnOrder");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
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
    return [...columnKeys];
  });
  
  // Get ordered columns based on columnOrder
  const availableColumns = columnOrder.map(key => {
    const column = getAvailableColumns().find(col => col.key === key);
    return column || { key, label: key };
  }).filter(col => col);
  
  // Initialize column visibility from localStorage or default to all visible
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("transfersPage_visibleColumns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return new Set(parsed);
      } catch {
        return new Set(columnKeys);
      }
    }
    return new Set(columnKeys);
  });
  
  // Drag and drop state
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Searchable dropdown states
  const [fromAccountSearchQuery, setFromAccountSearchQuery] = useState("");
  const [isFromAccountDropdownOpen, setIsFromAccountDropdownOpen] = useState(false);
  const fromAccountDropdownRef = useRef<HTMLDivElement>(null);

  const { data: transferChanges = [], isLoading: isLoadingChanges } = 
    useGetTransferChangesQuery(viewAuditTrailTransferId || 0, { skip: !viewAuditTrailTransferId });

  // Favorite accounts management (stored in localStorage)
  const [favoriteAccountIds, setFavoriteAccountIds] = useState<number[]>(() => {
    const stored = localStorage.getItem("favoriteAccountIds");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem("favoriteAccountIds", JSON.stringify(favoriteAccountIds));
  }, [favoriteAccountIds]);

  const toggleFavorite = (accountId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteAccountIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  const [form, setForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    description: "",
    transactionFee: "",
  });

  const resetForm = () => {
    setForm({
      fromAccountId: "",
      toAccountId: "",
      amount: "",
      description: "",
      transactionFee: "",
    });
    setFromAccountSearchQuery("");
    setIsFromAccountDropdownOpen(false);
    setEditingTransferId(null);
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const startEdit = (transferId: number) => {
    const transfer = transfers.find((t) => t.id === transferId);
    if (!transfer) return;
    
    setEditingTransferId(transferId);
    setForm({
      fromAccountId: String(transfer.fromAccountId),
      toAccountId: String(transfer.toAccountId),
      amount: String(transfer.amount),
      description: transfer.description || "",
      transactionFee: transfer.transactionFee ? String(transfer.transactionFee) : "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.fromAccountId || !form.toAccountId || !form.amount || !form.description) return;

    try {
      if (editingTransferId) {
        await updateTransfer({
          id: editingTransferId,
          data: {
            fromAccountId: Number(form.fromAccountId),
            toAccountId: Number(form.toAccountId),
            amount: Number(form.amount),
            description: form.description,
            transactionFee: form.transactionFee ? Number(form.transactionFee) : undefined,
            updatedBy: authUser?.id,
          },
        }).unwrap();
      } else {
        await createTransfer({
          fromAccountId: Number(form.fromAccountId),
          toAccountId: Number(form.toAccountId),
          amount: Number(form.amount),
          description: form.description,
          transactionFee: form.transactionFee ? Number(form.transactionFee) : undefined,
          createdBy: authUser?.id,
        }).unwrap();
      }
      closeModal();
    } catch (error: any) {
      setAlertModal({ 
        isOpen: true, 
        message: error?.data?.message || t("transfers.errorCreating"), 
        type: "error" 
      });
    }
  };

  const handleDeleteClick = (transferId: number) => {
    setConfirmModal({
      isOpen: true,
      message: t("transfers.confirmDelete") || "Are you sure you want to delete this transfer?",
      transferId: transferId,
    });
  };

  const handleDelete = async (transferId: number) => {
    try {
      await deleteTransfer(transferId).unwrap();
      setConfirmModal({ isOpen: false, message: "", transferId: null, isBulk: false });
    } catch (error: any) {
      let message = error?.data?.message || t("transfers.errorDeleting");
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", transferId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const handleBulkDelete = async () => {
    try {
      setConfirmModal({ isOpen: false, message: "", transferId: null, isBulk: false });
      
      // Delete all selected transfers
      const deletePromises = selectedTransferIds.map((id) => deleteTransfer(id).unwrap());
      await Promise.all(deletePromises);
      
      // Clear selection and exit batch delete mode
      setSelectedTransferIds([]);
      setIsBatchDeleteMode(false);
    } catch (error: any) {
      let message = error?.data?.message || t("transfers.errorDeleting");
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", transferId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
      
      // Clear selection and exit batch delete mode even on error
      setSelectedTransferIds([]);
      setIsBatchDeleteMode(false);
    }
  };

  // Get selected accounts for validation
  const fromAccount = accounts.find((a) => a.id === Number(form.fromAccountId));
  const toAccount = accounts.find((a) => a.id === Number(form.toAccountId));

  // Filter accounts for "to" dropdown based on "from" account currency
  const availableToAccounts = form.fromAccountId
    ? accounts.filter(
        (acc) =>
          acc.id !== Number(form.fromAccountId) &&
          acc.currencyCode === fromAccount?.currencyCode
      )
    : [];

  // Filter by search query for From Account
  const filteredFromAccounts = useMemo(() => {
    if (!fromAccountSearchQuery.trim()) return accounts;
    const query = fromAccountSearchQuery.toLowerCase();
    return accounts.filter(
      (account) =>
        account.name.toLowerCase().includes(query) ||
        account.currencyCode.toLowerCase().includes(query) ||
        account.currencyName?.toLowerCase().includes(query)
    );
  }, [accounts, fromAccountSearchQuery]);

  // Sort accounts: favorites first, then alphabetically
  const sortedFromAccounts = useMemo(() => {
    const favorites = filteredFromAccounts.filter((a) => favoriteAccountIds.includes(a.id));
    const nonFavorites = filteredFromAccounts.filter((a) => !favoriteAccountIds.includes(a.id));
    
    const sortByName = (a: Account, b: Account) => a.name.localeCompare(b.name);
    
    return [
      ...favorites.sort(sortByName),
      ...nonFavorites.sort(sortByName),
    ];
  }, [filteredFromAccounts, favoriteAccountIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        fromAccountDropdownRef.current &&
        !fromAccountDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFromAccountDropdownOpen(false);
      }
    };

    if (isFromAccountDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isFromAccountDropdownOpen]);

  // Handle Esc key to close create/edit transfer modal
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

  // Handle Esc key to close audit trail modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewAuditTrailTransferId) {
        setViewAuditTrailTransferId(null);
      }
    };

    if (viewAuditTrailTransferId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [viewAuditTrailTransferId]);

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem("transfersPage_visibleColumns", JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // Save column order to localStorage
  useEffect(() => {
    localStorage.setItem("transfersPage_columnOrder", JSON.stringify(columnOrder));
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

  // Helper function to render cell content for a column
  const renderCellContent = (columnKey: string, transfer: typeof transfers[0]) => {
    switch (columnKey) {
      case "id":
        return <td key={columnKey} className="py-2 font-mono text-slate-600">#{transfer.id}</td>;
      case "date":
        return <td key={columnKey} className="py-2">{formatDate(transfer.createdAt)}</td>;
      case "description":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {transfer.description ? (
              <div className="relative group inline-block">
                <span className="inline-block max-w-[10ch] truncate cursor-help">
                  {transfer.description.length > 10 
                    ? transfer.description.substring(0, 10) + "..."
                    : transfer.description}
                </span>
                {transfer.description.length > 10 && (
                  <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-3 py-2 whitespace-normal max-w-xs shadow-lg border border-slate-700">
                    {transfer.description}
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"></div>
                  </div>
                )}
              </div>
            ) : (
              "-"
            )}
          </td>
        );
      case "fromAccount":
        return (
          <td key={columnKey} className="py-2 font-semibold text-slate-900">
            {transfer.fromAccountName || transfer.fromAccountId}
          </td>
        );
      case "toAccount":
        return (
          <td key={columnKey} className="py-2 font-semibold text-slate-900">
            {transfer.toAccountName || transfer.toAccountId}
          </td>
        );
      case "amount":
        return (
          <td key={columnKey} className="py-2 font-semibold text-slate-900">
            {formatCurrency(transfer.amount, transfer.currencyCode)}
          </td>
        );
      case "transactionFee":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {transfer.transactionFee !== null && transfer.transactionFee !== undefined ? formatCurrency(transfer.transactionFee, transfer.currencyCode) : "-"}
          </td>
        );
      case "currency":
        return <td key={columnKey} className="py-2">{transfer.currencyCode}</td>;
      case "createdBy":
        return (
          <td key={columnKey} className="py-2 text-slate-600">
            {transfer.createdByName || "-"}
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("transfers.title")}
        description={t("transfers.description")}
        actions={
          <div className="flex items-center gap-4">
            {isLoading ? t("common.loading") : `${transfers.length} ${t("transfers.transfers")}`}
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
            >
              {t("transfers.createTransfer")}
            </button>
            {hasActionPermission(authUser, "deleteTransfer") && (
              <button
                onClick={async () => {
                  if (!isBatchDeleteMode) {
                    // Enable batch delete mode
                    setIsBatchDeleteMode(true);
                  } else {
                    // If no transfers selected, exit batch delete mode
                    if (!selectedTransferIds.length) {
                      setIsBatchDeleteMode(false);
                      setSelectedTransferIds([]);
                      return;
                    }
                    // Delete selected transfers
                    setConfirmModal({
                      isOpen: true,
                      message: t("transfers.confirmDelete") || "Are you sure you want to delete the selected transfers?",
                      transferId: -1,
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
                    ? (selectedTransferIds.length > 0 ? t("transfers.deleteSelected") : t("common.cancel"))
                    : t("transfers.batchDelete")}
              </button>
            )}
            <div className="relative" ref={columnDropdownRef}>
              <button
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                aria-label={t("transfers.columns") || "Columns"}
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
                {t("transfers.columns") || "Columns"}
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
                    {t("transfers.showColumns") || "Show Columns"}
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
        <div className="overflow-x-auto min-h-[60vh]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                {isBatchDeleteMode && (
                  <th className="py-2 w-8">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={
                        !!transfers.length &&
                        selectedTransferIds.length === transfers.length
                      }
                      onChange={(e) =>
                        setSelectedTransferIds(
                          e.target.checked ? transfers.map((t) => t.id) : [],
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
                {!isBatchDeleteMode && <th className="py-2">{t("transfers.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="border-b border-slate-100">
                  {isBatchDeleteMode && (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedTransferIds.includes(transfer.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTransferIds((prev) =>
                              prev.includes(transfer.id)
                                ? prev
                                : [...prev, transfer.id],
                            );
                          } else {
                            setSelectedTransferIds((prev) =>
                              prev.filter((id) => id !== transfer.id),
                            );
                          }
                        }}
                      />
                    </td>
                  )}
                  {columnOrder.map((columnKey) => 
                    visibleColumns.has(columnKey) ? renderCellContent(columnKey, transfer) : null
                  )}
                  {!isBatchDeleteMode && (
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewAuditTrailTransferId(transfer.id)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                          title={t("transfers.viewAuditTrail")}
                        >
                          {t("transfers.auditTrail")}
                        </button>
                        <button
                          onClick={() => startEdit(transfer.id)}
                          className="text-amber-600 hover:text-amber-700 text-sm"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(transfer.id)}
                          disabled={isDeleting}
                          className="text-rose-600 hover:text-rose-700 text-sm disabled:opacity-60"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!transfers.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={isBatchDeleteMode ? 9 : 10}>
                    {t("transfers.noTransfers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Create/Edit Transfer Modal */}
      {isModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingTransferId
                  ? t("transfers.editTransferTitle")
                  : t("transfers.createTransferTitle")}
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
            <form className="grid gap-3" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("transfers.fromAccount")}
                </label>
                <div className="relative" ref={fromAccountDropdownRef}>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10"
                    placeholder={t("transfers.selectFromAccount")}
                    value={
                      isFromAccountDropdownOpen
                        ? fromAccountSearchQuery
                        : form.fromAccountId
                        ? accounts.find((a) => a.id === Number(form.fromAccountId))?.name || ""
                        : ""
                    }
                    onFocus={() => {
                      setIsFromAccountDropdownOpen(true);
                      if (form.fromAccountId) {
                        const selected = accounts.find((a) => a.id === Number(form.fromAccountId));
                        setFromAccountSearchQuery(selected?.name || "");
                      }
                    }}
                    onChange={(e) => {
                      setFromAccountSearchQuery(e.target.value);
                      setIsFromAccountDropdownOpen(true);
                      if (!e.target.value) {
                        setForm((p) => ({ ...p, fromAccountId: "", toAccountId: "" }));
                      }
                    }}
                    required
                  />
                  <svg
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
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
                  
                  {isFromAccountDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {sortedFromAccounts.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          {t("transfers.noAccountsFound")}
                        </div>
                      ) : (
                        sortedFromAccounts.map((account) => {
                          const isFavorite = favoriteAccountIds.includes(account.id);
                          const isSelected = form.fromAccountId === String(account.id);
                          return (
                            <div
                              key={account.id}
                              className={`px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between ${
                                isSelected ? "bg-blue-50" : ""
                              }`}
                              onClick={() => {
                                setForm((p) => ({ ...p, fromAccountId: String(account.id), toAccountId: "" }));
                                setFromAccountSearchQuery("");
                                setIsFromAccountDropdownOpen(false);
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  {account.name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {formatCurrency(account.balance, account.currencyCode)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => toggleFavorite(account.id, e)}
                                className="ml-2 flex-shrink-0 p-1 hover:bg-slate-100 rounded transition-colors"
                                title={isFavorite ? t("transfers.removeFavorite") : t("transfers.addFavorite")}
                              >
                                <svg
                                  className={`w-5 h-5 ${
                                    isFavorite
                                      ? "text-amber-500 fill-amber-500"
                                      : "text-slate-300"
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {fromAccount && (
                  <div className="mt-1 text-xs text-slate-500">
                    {t("transfers.currentBalance")}:{" "}
                    <span className={fromAccount.balance < 0 ? "text-red-600" : "text-slate-900"}>
                      {formatCurrency(fromAccount.balance, fromAccount.currencyCode)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("transfers.toAccount")}
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={form.toAccountId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, toAccountId: e.target.value }))
                  }
                  required
                  disabled={!form.fromAccountId}
                >
                  <option value="">
                    {form.fromAccountId
                      ? t("transfers.selectToAccount")
                      : t("transfers.selectFromAccountFirst")}
                  </option>
                  {availableToAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({formatCurrency(account.balance, account.currencyCode)})
                    </option>
                  ))}
                </select>
                {toAccount && (
                  <div className="mt-1 text-xs text-slate-500">
                    {t("transfers.currentBalance")}:{" "}
                    <span className={toAccount.balance < 0 ? "text-red-600" : "text-slate-900"}>
                      {formatCurrency(toAccount.balance, toAccount.currencyCode)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("transfers.amount")} {fromAccount && `(${fromAccount.currencyCode})`}
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  required
                  disabled={!form.fromAccountId}
                />
                {fromAccount && form.amount && (() => {
                  const amount = Number(form.amount);
                  const fee = form.transactionFee ? Number(form.transactionFee) : 0;
                  const totalDeduction = amount + fee;
                  return totalDeduction > fromAccount.balance && (
                    <div className="mt-1 text-xs text-amber-600">
                      {t("transfers.insufficientBalance")} -{" "}
                      {t("transfers.newBalanceWillBe")}:{" "}
                      {formatCurrency(
                        fromAccount.balance - totalDeduction,
                        fromAccount.currencyCode
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("transfers.transactionFee")} ({t("common.optional")})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={form.transactionFee}
                  onChange={(e) => setForm((p) => ({ ...p, transactionFee: e.target.value }))}
                  placeholder={t("transfers.transactionFeePlaceholder") || "0.00"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("transfers.description")} *
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder={t("transfers.descriptionPlaceholder")}
                  required
                />
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
                  disabled={isCreating || isUpdating || !form.fromAccountId || !form.toAccountId || !form.amount || !form.description}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isCreating || isUpdating
                    ? t("common.saving")
                    : editingTransferId
                    ? t("transfers.updateTransfer")
                    : t("transfers.createTransfer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {viewAuditTrailTransferId && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("transfers.auditTrailTitle", {
                  id: viewAuditTrailTransferId,
                })}
              </h2>
              <button
                onClick={() => setViewAuditTrailTransferId(null)}
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
              const transfer = transfers.find(
                (t) => t.id === viewAuditTrailTransferId
              );
              if (!transfer) return null;

              return (
                <div className="space-y-4">
                  {/* Summary Section */}
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      {t("transfers.description")}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">
                          {t("transfers.created")}:
                        </span>{" "}
                        <span className="text-slate-600">
                          {formatDateTime(transfer.createdAt)} {t("transfers.by")} {transfer.createdByName || "-"}
                        </span>
                      </div>
                      {transfer.updatedAt && (
                        <div>
                          <span className="font-medium text-slate-700">
                            {t("transfers.updated")}:
                          </span>{" "}
                          <span className="text-slate-600">
                            {formatDateTime(transfer.updatedAt)} {t("transfers.by")} {transfer.updatedByName || "-"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Change History Table */}
                  <div className="mt-6">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      {t("transfers.changeHistory")}
                    </h3>
                    {isLoadingChanges ? (
                      <div className="text-center py-4 text-slate-500">
                        {t("common.loading")}
                      </div>
                    ) : transferChanges.length === 0 ? (
                      <div className="text-center py-4 text-slate-500">
                        {t("transfers.noTransfers")}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border border-slate-200 rounded-lg">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("transfers.date")} & {t("transfers.updatedAt")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("transfers.updatedBy")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("transfers.fromAccount")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("transfers.toAccount")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("transfers.amount")}
                              </th>
                              <th className="py-2 px-3 border-b border-slate-200 font-semibold text-slate-700">
                                {t("transfers.description")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {transferChanges.map((change, index) => (
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
                                  {change.fromAccountName || change.fromAccountId}
                                </td>
                                <td className="py-2 px-3 border-b border-slate-100 text-slate-600">
                                  {change.toAccountName || change.toAccountId}
                                </td>
                                <td className="py-2 px-3 border-b border-slate-100 font-semibold text-slate-900">
                                  {formatCurrency(change.amount, transfer.currencyCode)}
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
          } else if (confirmModal.transferId && confirmModal.transferId > 0) {
            handleDelete(confirmModal.transferId);
          }
        }}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", transferId: null, isBulk: false })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}
