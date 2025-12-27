import { useState, type FormEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useGetAccountsQuery,
  useGetAccountsSummaryQuery,
  useGetAccountsByCurrencyQuery,
  useGetCurrenciesQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useAddFundsMutation,
  useWithdrawFundsMutation,
  useGetAccountTransactionsQuery,
} from "../services/api";
import { formatDate } from "../utils/format";
import { useAppSelector } from "../app/hooks";
import { hasActionPermission } from "../utils/permissions";

// Helper function to format currency with proper number formatting
const formatCurrency = (amount: number, currencyCode: string) => {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
};

export default function AccountsPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccountsQuery();
  const { data: summary = [], isLoading: isLoadingSummary } = useGetAccountsSummaryQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();
  const [updateAccount] = useUpdateAccountMutation();
  const [deleteAccount, { isLoading: isDeleting }] = useDeleteAccountMutation();
  const [addFunds] = useAddFundsMutation();
  const [withdrawFunds] = useWithdrawFundsMutation();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; accountId: number | null }>({
    isOpen: false,
    message: "",
    accountId: null,
  });

  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fundsModalAccountId, setFundsModalAccountId] = useState<number | null>(null);
  const [fundsModalType, setFundsModalType] = useState<"add" | "withdraw" | null>(null);
  const [transactionsModalAccountId, setTransactionsModalAccountId] = useState<number | null>(null);

  const { data: accountsByCurrency = [] } = useGetAccountsByCurrencyQuery(
    selectedCurrency || "",
    { skip: !selectedCurrency }
  );
  const { data: transactions = [] } = useGetAccountTransactionsQuery(
    transactionsModalAccountId || 0,
    { skip: !transactionsModalAccountId }
  );

  const [form, setForm] = useState({
    currencyCode: "",
    name: "",
    initialFunds: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
  });

  const [fundsForm, setFundsForm] = useState({
    amount: "",
    description: "",
  });

  const resetForm = () => {
    setForm({
      currencyCode: "",
      name: "",
      initialFunds: "",
    });
  };

  const resetFundsForm = () => {
    setFundsForm({
      amount: "",
      description: "",
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.currencyCode || !form.name) return;

    await createAccount({
      currencyCode: form.currencyCode,
      name: form.name,
      initialFunds: form.initialFunds ? parseFloat(form.initialFunds) : 0,
    });

    resetForm();
  };

  const startEdit = (accountId: number) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    setEditingId(accountId);
    setEditForm({ name: account.name });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "" });
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    try {
      await updateAccount({ id: editingId, name: editForm.name });
      cancelEdit();
    } catch (error: any) {
      setAlertModal({ 
        isOpen: true, 
        message: error?.data?.message || t("accounts.errorUpdating"), 
        type: "error" 
      });
    }
  };

  const handleDeleteClick = (id: number) => {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    
    setConfirmModal({
      isOpen: true,
      message: t("accounts.confirmDelete") || `Are you sure you want to delete ${account.name}?`,
      accountId: id,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAccount(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", accountId: null });
    } catch (error: any) {
      let message = t("accounts.cannotDeleteReferenced");
      
      if (error?.data) {
        let errorMessage = '';
        if (typeof error.data === 'string') {
          errorMessage = error.data;
        } else if (error.data.message) {
          errorMessage = error.data.message;
        }
        
        // Check for specific error messages and translate them
        if (errorMessage === "Cannot delete this item because it is referenced by other records.") {
          message = t("accounts.cannotDeleteReferenced");
        } else if (errorMessage === "Cannot delete account that is linked to existing orders") {
          message = t("accounts.cannotDeleteLinkedToOrders");
        } else if (errorMessage === "Cannot delete account that is linked to existing transfers") {
          message = t("accounts.cannotDeleteLinkedToTransfers");
        } else if (errorMessage === "Cannot delete account that is linked to existing expenses") {
          message = t("accounts.cannotDeleteLinkedToExpenses");
        } else if (errorMessage) {
          message = errorMessage;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", accountId: null });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const openFundsModal = (accountId: number, type: "add" | "withdraw") => {
    setFundsModalAccountId(accountId);
    setFundsModalType(type);
    resetFundsForm();
  };

  const closeFundsModal = () => {
    setFundsModalAccountId(null);
    setFundsModalType(null);
    resetFundsForm();
  };

  const handleFundsSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fundsModalAccountId || !fundsModalType || !fundsForm.amount) return;

    try {
      if (fundsModalType === "add") {
        await addFunds({
          id: fundsModalAccountId,
          amount: parseFloat(fundsForm.amount),
          description: fundsForm.description || undefined,
        });
      } else {
        await withdrawFunds({
          id: fundsModalAccountId,
          amount: parseFloat(fundsForm.amount),
          description: fundsForm.description || undefined,
        });
      }
      closeFundsModal();
    } catch (error: any) {
      setAlertModal({ 
        isOpen: true, 
        message: error?.data?.message || t("accounts.errorProcessing"), 
        type: "error" 
      });
    }
  };

  const accountsByCurrencyMap = accounts.reduce((acc, account) => {
    if (!acc[account.currencyCode]) {
      acc[account.currencyCode] = [];
    }
    acc[account.currencyCode].push(account);
    return acc;
  }, {} as Record<string, typeof accounts>);

  const selectedAccount = accounts.find((a) => a.id === transactionsModalAccountId);

  // Handle Esc key to close edit account modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editingId) {
        cancelEdit();
      }
    };

    if (editingId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [editingId]);

  // Handle Esc key to close funds modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fundsModalAccountId) {
        closeFundsModal();
      }
    };

    if (fundsModalAccountId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [fundsModalAccountId]);

  // Handle Esc key to close transactions modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && transactionsModalAccountId) {
        setTransactionsModalAccountId(null);
      }
    };

    if (transactionsModalAccountId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [transactionsModalAccountId]);

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <SectionCard
        title={t("accounts.summaryTitle")}
        description={t("accounts.summaryDescription")}
      >
        {isLoadingSummary ? (
          <div className="text-sm text-slate-500">{t("common.loading")}</div>
        ) : summary.length === 0 ? (
          <div className="text-sm text-slate-500">{t("accounts.noAccounts")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.map((item) => (
              <div
                key={item.currencyCode}
                className="p-4 border border-slate-200 rounded-lg bg-slate-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">
                    {item.currencyCode}
                  </span>
                  <Badge tone="blue">{item.accountCount} {t("accounts.accounts")}</Badge>
                </div>
                <div className={`text-2xl font-bold ${
                  item.totalBalance < 0 ? "text-red-600" : "text-slate-900"
                }`}>
                  {formatCurrency(item.totalBalance, item.currencyCode)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {item.currencyName || item.currencyCode}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Currency Pools */}
      <SectionCard
        title={t("accounts.currencyPoolsTitle")}
        description={t("accounts.currencyPoolsDescription")}
      >
        {isLoadingAccounts ? (
          <div className="text-sm text-slate-500">{t("common.loading")}</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(accountsByCurrencyMap).map(([currencyCode, currencyAccounts]) => {
              const totalBalance = currencyAccounts.reduce((sum, acc) => sum + acc.balance, 0);
              const currency = currencies.find((c) => c.code === currencyCode);
              return (
                <div
                  key={currencyCode}
                  className="border border-slate-200 rounded-lg p-4 bg-white"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {currencyCode} {t("accounts.currencyPool")}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {currency?.name || currencyCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        totalBalance < 0 ? "text-red-600" : "text-slate-900"
                      }`}>
                        {formatCurrency(totalBalance, currencyCode)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {currencyAccounts.length} {t("accounts.accounts")}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2">{t("accounts.accountName")}</th>
                          <th className="py-2">{t("accounts.balance")}</th>
                          <th className="py-2">{t("accounts.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currencyAccounts.map((account) => (
                          <tr key={account.id} className="border-b border-slate-100">
                            <td className="py-2 font-semibold">{account.name}</td>
                            <td className="py-2">
                              <span className={`font-semibold ${
                                account.balance < 0 ? "text-red-600" : "text-slate-900"
                              }`}>
                                {formatCurrency(account.balance, currencyCode)}
                              </span>
                            </td>
                            <td className="py-2">
                              <div className="flex gap-2 text-sm">
                                <button
                                  className="text-blue-600 hover:text-blue-700"
                                  onClick={() => openFundsModal(account.id, "add")}
                                >
                                  {t("accounts.addFunds")}
                                </button>
                                <button
                                  className="text-amber-600 hover:text-amber-700"
                                  onClick={() => openFundsModal(account.id, "withdraw")}
                                >
                                  {t("accounts.withdrawFunds")}
                                </button>
                                <button
                                  className="text-purple-600 hover:text-purple-700"
                                  onClick={() => setTransactionsModalAccountId(account.id)}
                                >
                                  {t("accounts.transactions")}
                                </button>
                                <button
                                  className="text-amber-600 hover:text-amber-700"
                                  onClick={() => startEdit(account.id)}
                                >
                                  {t("common.edit")}
                                </button>
                                {hasActionPermission(authUser, "deleteAccount") && (
                                  <button
                                    className="text-rose-600 hover:text-rose-700"
                                    onClick={() => handleDeleteClick(account.id)}
                                    disabled={isDeleting}
                                  >
                                    {t("common.delete")}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {Object.keys(accountsByCurrencyMap).length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">
                {t("accounts.noAccounts")}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Create Account Form */}
      <SectionCard
        title={t("accounts.createAccountTitle")}
        description={t("accounts.createAccountDescription")}
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.currencyCode}
            onChange={(e) => setForm((p) => ({ ...p, currencyCode: e.target.value }))}
            required
          >
            <option value="">{t("accounts.selectCurrency")}</option>
            {currencies
              .filter((c) => Boolean(c.active))
              .map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
          </select>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("accounts.accountNamePlaceholder")}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("accounts.initialFundsPlaceholder")}
            value={form.initialFunds}
            onChange={(e) => setForm((p) => ({ ...p, initialFunds: e.target.value }))}
            type="number"
            step="0.01"
            min="0"
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
          <button
            type="submit"
            disabled={isCreating}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isCreating ? t("common.saving") : t("accounts.createAccount")}
          </button>
        </form>
      </SectionCard>

      {/* Edit Account Form */}
      {editingId && (
        <SectionCard
          title={t("accounts.editAccountTitle")}
          description={t("accounts.editAccountDescription")}
          actions={
            <button onClick={cancelEdit} className="text-sm text-slate-600">
              {t("common.cancel")}
            </button>
          }
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEdit}>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("accounts.accountNamePlaceholder")}
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <button
              type="submit"
              className="col-span-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              {t("accounts.updateAccount")}
            </button>
          </form>
        </SectionCard>
      )}

      {/* Add/Withdraw Funds Modal */}
      {fundsModalAccountId && fundsModalType && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {fundsModalType === "add"
                  ? t("accounts.addFundsTitle")
                  : t("accounts.withdrawFundsTitle")}
              </h2>
              <button
                onClick={closeFundsModal}
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
            <form className="grid gap-3" onSubmit={handleFundsSubmit}>
              <div className="text-sm text-slate-600">
                {t("accounts.account")}:{" "}
                <span className="font-semibold">
                  {accounts.find((a) => a.id === fundsModalAccountId)?.name}
                </span>
              </div>
              {fundsModalType === "withdraw" && (() => {
                const account = accounts.find((a) => a.id === fundsModalAccountId);
                return account ? (
                  <div className="text-sm text-slate-600">
                    {t("accounts.currentBalance")}:{" "}
                    <span className={`font-semibold ${
                      account.balance < 0 ? "text-red-600" : "text-slate-900"
                    }`}>
                      {formatCurrency(account.balance, account.currencyCode)}
                    </span>
                  </div>
                ) : null;
              })()}
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("accounts.amount")}
                value={fundsForm.amount}
                onChange={(e) =>
                  setFundsForm((p) => ({ ...p, amount: e.target.value }))
                }
                required
                type="number"
                step="0.01"
                min="0"
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("accounts.description")}
                value={fundsForm.description}
                onChange={(e) =>
                  setFundsForm((p) => ({ ...p, description: e.target.value }))
                }
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeFundsModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition-colors ${
                    fundsModalType === "add"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {fundsModalType === "add"
                    ? t("accounts.addFunds")
                    : t("accounts.withdrawFunds")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transactions Modal */}
      {transactionsModalAccountId && selectedAccount && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("accounts.transactionsTitle")} - {selectedAccount.name}
              </h2>
              <button
                onClick={() => setTransactionsModalAccountId(null)}
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2">{t("accounts.date")}</th>
                    <th className="py-2">{t("accounts.type")}</th>
                    <th className="py-2">{t("accounts.amount")}</th>
                    <th className="py-2">{t("accounts.description")}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-slate-100">
                      <td className="py-2">{formatDate(transaction.createdAt)}</td>
                      <td className="py-2">
                        <Badge tone={transaction.type === "add" ? "emerald" : "rose"}>
                          {transaction.type === "add"
                            ? t("accounts.add")
                            : t("accounts.withdraw")}
                        </Badge>
                      </td>
                      <td className={`py-2 font-semibold ${
                        transaction.type === "add" ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {transaction.type === "add" ? "+" : "-"}
                        {transaction.amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {selectedAccount.currencyCode}
                      </td>
                      <td className="py-2 text-slate-600">
                        {transaction.description || "-"}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td className="py-4 text-sm text-slate-500" colSpan={4}>
                        {t("accounts.noTransactions")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
        onConfirm={() => confirmModal.accountId && handleDelete(confirmModal.accountId)}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", accountId: null })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}

