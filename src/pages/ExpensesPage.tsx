import { useState, type FormEvent, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetAccountsQuery,
  useGetExpenseChangesQuery,
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

export default function ExpensesPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: expenses = [], isLoading } = useGetExpensesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
  const [deleteExpense, { isLoading: isDeleting }] = useDeleteExpenseMutation();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; expenseId: number | null; isBulk?: boolean }>({
    isOpen: false,
    message: "",
    expenseId: null,
    isBulk: false,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  const [viewImageExpenseId, setViewImageExpenseId] = useState<number | null>(null);
  const [viewAuditTrailExpenseId, setViewAuditTrailExpenseId] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const [imageDragOver, setImageDragOver] = useState(false);

  const { data: expenseChanges = [], isLoading: isLoadingChanges } = 
    useGetExpenseChangesQuery(viewAuditTrailExpenseId || 0, { skip: !viewAuditTrailExpenseId });

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
    const expense = expenses.find((e) => e.id === expenseId);
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
        message: t("expenses.invalidImageFile") || "Please upload an image file or PDF", 
        type: "error" 
      });
      return;
    }

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

  // Helper function to open PDF data URI in a new tab
  const openPdfInNewTab = (dataUri: string) => {
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
      window.open(url, '_blank');
      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error opening PDF:', error);
      // Fallback: try opening directly
      window.open(dataUri, '_blank');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.accountId || !form.amount || !form.description) return;

    try {
      if (editingExpenseId) {
        // Update existing expense
        await updateExpense({
          id: editingExpenseId,
          data: {
            accountId: Number(form.accountId),
            amount: Number(form.amount),
            description: form.description,
            imagePath: form.imagePath || undefined,
            updatedBy: authUser?.id,
          },
        }).unwrap();
      } else {
        // Create new expense
        await createExpense({
          accountId: Number(form.accountId),
          amount: Number(form.amount),
          description: form.description,
          imagePath: form.imagePath || undefined,
          createdBy: authUser?.id,
        }).unwrap();
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

  const handleDeleteClick = (expenseId: number) => {
    setConfirmModal({
      isOpen: true,
      message: t("expenses.confirmDelete") || "Are you sure you want to delete this expense?",
      expenseId: expenseId,
      isBulk: false,
    });
  };

  const handleDelete = async (expenseId: number) => {
    try {
      await deleteExpense({
        id: expenseId,
        deletedBy: authUser?.id,
      }).unwrap();
      setConfirmModal({ isOpen: false, message: "", expenseId: null, isBulk: false });
    } catch (error: any) {
      let message = error?.data?.message || t("expenses.errorDeleting");
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", expenseId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedExpenseIds.map((id) =>
          deleteExpense({
            id,
            deletedBy: authUser?.id,
          }).unwrap()
        )
      );
      setSelectedExpenseIds([]);
      setIsBatchDeleteMode(false);
      setConfirmModal({ isOpen: false, message: "", expenseId: null, isBulk: false });
    } catch (error: any) {
      let message = error?.data?.message || t("expenses.errorDeleting");
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", expenseId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const selectedAccount = accounts.find((a) => a.id === Number(form.accountId));
  
  // When editing, get the expense's currency to filter accounts
  const editingExpense = editingExpenseId 
    ? expenses.find((e) => e.id === editingExpenseId)
    : null;
  const expenseCurrencyCode = editingExpense?.currencyCode;
  
  // Filter accounts: when editing, only show accounts with same currency
  const baseAvailableAccounts = editingExpenseId && expenseCurrencyCode
    ? accounts.filter((a) => a.currencyCode === expenseCurrencyCode)
    : accounts;

  // Filter by search query
  const filteredAccounts = useMemo(() => {
    if (!accountSearchQuery.trim()) return baseAvailableAccounts;
    const query = accountSearchQuery.toLowerCase();
    return baseAvailableAccounts.filter(
      (account) =>
        account.name.toLowerCase().includes(query) ||
        account.currencyCode.toLowerCase().includes(query) ||
        account.currencyName?.toLowerCase().includes(query)
    );
  }, [baseAvailableAccounts, accountSearchQuery]);

  // Sort accounts: favorites first, then alphabetically
  const sortedAccounts = useMemo(() => {
    const favorites = filteredAccounts.filter((a) => favoriteAccountIds.includes(a.id));
    const nonFavorites = filteredAccounts.filter((a) => !favoriteAccountIds.includes(a.id));
    
    const sortByName = (a: Account, b: Account) => a.name.localeCompare(b.name);
    
    return [
      ...favorites.sort(sortByName),
      ...nonFavorites.sort(sortByName),
    ];
  }, [filteredAccounts, favoriteAccountIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAccountDropdownOpen(false);
      }
    };

    if (isAccountDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isAccountDropdownOpen]);

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
        description={t("expenses.description")}
        actions={
          <div className="flex items-center gap-4">
            {isLoading ? t("common.loading") : `${expenses.length} ${t("expenses.expenses")}`}
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
            >
              {t("expenses.createExpense")}
            </button>
            {hasActionPermission(authUser, "deleteExpense") && (
              <button
                onClick={async () => {
                  if (!isBatchDeleteMode) {
                    setIsBatchDeleteMode(true);
                  } else {
                    if (!selectedExpenseIds.length) return;
                    if (!selectedExpenseIds.length) return;
                    setConfirmModal({
                      isOpen: true,
                      message: t("expenses.confirmDeleteSelected") || "Are you sure you want to delete the selected expenses?",
                      expenseId: -1,
                      isBulk: true,
                    });
                    return;
                  }
                }}
                disabled={isDeleting || (isBatchDeleteMode && !selectedExpenseIds.length)}
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
              {isDeleting
                ? t("common.deleting")
                : isBatchDeleteMode
                ? t("expenses.deleteSelected")
                : t("expenses.batchDelete")}
              </button>
            )}
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
                        !!expenses.length &&
                        selectedExpenseIds.length === expenses.length
                      }
                      onChange={(e) =>
                        setSelectedExpenseIds(
                          e.target.checked ? expenses.map((e) => e.id) : []
                        )
                      }
                    />
                  </th>
                )}
                <th className="py-2">{t("expenses.date")}</th>
                <th className="py-2">{t("expenses.description")}</th>
                <th className="py-2">{t("expenses.account")}</th>
                <th className="py-2">{t("expenses.amount")}</th>
                <th className="py-2">{t("expenses.currency")}</th>
                <th className="py-2">{t("expenses.proof")}</th>
                <th className="py-2">{t("expenses.createdBy")}</th>
                <th className="py-2">{t("expenses.updatedBy")}</th>
                <th className="py-2">{t("expenses.updatedAt")}</th>
                <th className="py-2">{t("expenses.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-slate-100">
                  {isBatchDeleteMode && (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedExpenseIds.includes(expense.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExpenseIds((prev) =>
                              prev.includes(expense.id)
                                ? prev
                                : [...prev, expense.id]
                            );
                          } else {
                            setSelectedExpenseIds((prev) =>
                              prev.filter((id) => id !== expense.id)
                            );
                          }
                        }}
                      />
                    </td>
                  )}
                  <td className="py-2">{formatDate(expense.createdAt)}</td>
                  <td className="py-2 text-slate-600">
                    {expense.description ? (
                      <div className="relative group inline-block">
                        <span className="inline-block max-w-[10ch] truncate cursor-help">
                          {expense.description.length > 10
                            ? expense.description.substring(0, 10) + "..."
                            : expense.description}
                        </span>
                        {expense.description.length > 10 && (
                          <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-3 py-2 whitespace-normal max-w-xs shadow-lg border border-slate-700">
                            {expense.description}
                            <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"></div>
                          </div>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 font-semibold text-slate-900">
                    {expense.accountName || expense.accountId}
                  </td>
                  <td className="py-2 font-semibold text-slate-900">
                    {formatCurrency(expense.amount, expense.currencyCode)}
                  </td>
                  <td className="py-2">{expense.currencyCode}</td>
                  <td className="py-2">
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
                  <td className="py-2 text-slate-600">
                    {expense.createdByName || "-"}
                  </td>
                  <td className="py-2 text-slate-600">
                    {expense.updatedByName || "-"}
                  </td>
                  <td className="py-2 text-slate-600 text-xs">
                    {expense.updatedAt ? formatDate(expense.updatedAt) : "-"}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewAuditTrailExpenseId(expense.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                        title={t("expenses.viewAuditTrail")}
                      >
                        {t("expenses.auditTrail")}
                      </button>
                      <button
                        onClick={() => startEdit(expense.id)}
                        className="text-amber-600 hover:text-amber-700 text-sm"
                      >
                        {t("common.edit")}
                      </button>
                      {hasActionPermission(authUser, "deleteExpense") && (
                        <button
                          onClick={() => handleDeleteClick(expense.id)}
                          disabled={isDeleting}
                          className="text-rose-600 hover:text-rose-700 text-sm disabled:opacity-60"
                        >
                          {t("common.delete")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!expenses.length && (
                <tr>
                  <td
                    className="py-4 text-sm text-slate-500"
                    // This line sets the "colSpan" attribute of the <td> element to either 11 or 10 depending on whether batch delete mode is enabled (isBatchDeleteMode). If batch delete mode is active, the cell will span 11 columns; otherwise, it will span 10 columns.
                    colSpan={isBatchDeleteMode ? 11 : 10}
                  >
                    {t("expenses.noExpenses")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Create/Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
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
            <form className="grid gap-3" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("expenses.account")}
                </label>
                <div className="relative" ref={accountDropdownRef}>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10"
                    placeholder={t("expenses.selectAccount")}
                    value={
                      isAccountDropdownOpen
                        ? accountSearchQuery
                        : form.accountId
                        ? accounts.find((a) => a.id === Number(form.accountId))?.name || ""
                        : ""
                    }
                    onFocus={() => {
                      setIsAccountDropdownOpen(true);
                      if (form.accountId) {
                        const selected = accounts.find((a) => a.id === Number(form.accountId));
                        setAccountSearchQuery(selected?.name || "");
                      }
                    }}
                    onChange={(e) => {
                      setAccountSearchQuery(e.target.value);
                      setIsAccountDropdownOpen(true);
                      if (!e.target.value) {
                        setForm((p) => ({ ...p, accountId: "" }));
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
                  
                  {isAccountDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {sortedAccounts.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          {t("expenses.noAccountsFound")}
                        </div>
                      ) : (
                        sortedAccounts.map((account) => {
                          const isFavorite = favoriteAccountIds.includes(account.id);
                          const isSelected = form.accountId === String(account.id);
                          return (
                            <div
                              key={account.id}
                              className={`px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between ${
                                isSelected ? "bg-blue-50" : ""
                              }`}
                              onClick={() => {
                                setForm((p) => ({ ...p, accountId: String(account.id) }));
                                setAccountSearchQuery("");
                                setIsAccountDropdownOpen(false);
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
                                title={isFavorite ? t("expenses.removeFavorite") : t("expenses.addFavorite")}
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
                {selectedAccount && (
                  <div className="mt-1 text-xs text-slate-500">
                    {t("expenses.currentBalance")}:{" "}
                    <span
                      className={
                        selectedAccount.balance < 0
                          ? "text-red-600"
                          : "text-slate-900"
                      }
                    >
                      {formatCurrency(
                        selectedAccount.balance,
                        selectedAccount.currencyCode
                      )}
                    </span>
                  </div>
                )}
              </div>

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
                      ) : form.imagePath.startsWith('data:application/pdf') ? (
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
      )}

      {/* View Image/PDF Modal */}
      {viewImageExpenseId && (() => {
        const expense = expenses.find((e) => e.id === viewImageExpenseId);
        const imagePath = expense?.imagePath || "";
        const isPDF = imagePath.startsWith('data:application/pdf');
        
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
                (e) => e.id === viewAuditTrailExpenseId
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
          } else if (confirmModal.expenseId && confirmModal.expenseId > 0) {
            handleDelete(confirmModal.expenseId);
          }
        }}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", expenseId: null, isBulk: false })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}

