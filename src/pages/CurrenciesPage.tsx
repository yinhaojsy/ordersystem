import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useAddCurrencyMutation,
  useGetCurrenciesQuery,
  useUpdateCurrencyMutation,
  useDeleteCurrencyMutation,
} from "../services/api";
import { useAppSelector } from "../app/hooks";
import { hasActionPermission } from "../utils/permissions";

export default function CurrenciesPage() {
  const { t } = useTranslation();
  const currentUser = useAppSelector((s) => s.auth.user);
  const { data: currencies = [], isLoading } = useGetCurrenciesQuery();
  
  const canCreateCurrency = hasActionPermission(currentUser, "createCurrency");
  const canUpdateCurrency = hasActionPermission(currentUser, "updateCurrency");
  const [addCurrency, { isLoading: isSaving }] = useAddCurrencyMutation();
  const [updateCurrency] = useUpdateCurrencyMutation();
  const [deleteCurrency, { isLoading: isDeleting }] = useDeleteCurrencyMutation();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; currencyId: number | null }>({
    isOpen: false,
    message: "",
    currencyId: null,
  });

  const [form, setForm] = useState({
    code: "",
    name: "",
    baseRateBuy: "",
    baseRateSell: "",
    conversionRateBuy: "",
    conversionRateSell: "",
    active: true,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.code || !form.name) return;

    await addCurrency({
      code: form.code.toUpperCase(),
      name: form.name,
      baseRateBuy: Number(form.baseRateBuy || 0),
      baseRateSell: Number(form.baseRateSell || 0),
      conversionRateBuy: Number(form.conversionRateBuy || form.baseRateBuy || 0),
      conversionRateSell: Number(form.conversionRateSell || form.baseRateSell || 0),
      active: Boolean(form.active),
    });

    setForm({
      code: "",
      name: "",
      baseRateBuy: "",
      baseRateSell: "",
      conversionRateBuy: "",
      conversionRateSell: "",
      active: true,
    });
  };

  const toggleActive = async (id: number, active: boolean) => {
    await updateCurrency({ id, data: { active: !active } });
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<typeof form | null>(null);

  const startEdit = (currencyId: number) => {
    const current = currencies.find((c) => c.id === currencyId);
    if (!current) return;
    setEditingId(currencyId);
    setEditForm({
      code: current.code,
      name: current.name,
      baseRateBuy: String(current.baseRateBuy),
      baseRateSell: String(current.baseRateSell),
      conversionRateBuy: String(current.conversionRateBuy),
      conversionRateSell: String(current.conversionRateSell),
      active: Boolean(current.active),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    try {
      await updateCurrency({
        id: editingId,
        data: {
          code: editForm.code.toUpperCase(),
          name: editForm.name,
          baseRateBuy: Number(editForm.baseRateBuy || 0),
          baseRateSell: Number(editForm.baseRateSell || 0),
          conversionRateBuy: Number(editForm.conversionRateBuy || editForm.baseRateBuy || 0),
          conversionRateSell: Number(editForm.conversionRateSell || editForm.baseRateSell || 0),
          active: Boolean(editForm.active),
        },
      }).unwrap();
      cancelEdit();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("currencies.errorUpdating") || "Error updating currency",
        type: "error",
      });
    }
  };

  const handleDeleteClick = (id: number) => {
    const currency = currencies.find((c) => c.id === id);
    if (!currency) return;
    
    setConfirmModal({
      isOpen: true,
      message: t("currencies.confirmDelete") || `Are you sure you want to delete ${currency.code}?`,
      currencyId: id,
    });
  };

  const remove = async (id: number) => {
    try {
      await deleteCurrency(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", currencyId: null });
    } catch (err: any) {
      let message = t("currencies.cannotDeleteReferenced");
      
      if (err?.data) {
        let errorMessage = '';
        if (typeof err.data === 'string') {
          errorMessage = err.data;
        } else if (err.data.message) {
          errorMessage = err.data.message;
        }
        
        // Check if it's the generic server error message and translate it
        if (errorMessage === "Cannot delete this item because it is referenced by other records.") {
          message = t("currencies.cannotDeleteReferenced");
        } else if (errorMessage) {
          message = errorMessage;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", currencyId: null });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("currencies.title")}
           // 我 REMOVED DESCRIPTION UNDER THE TITLE BEING DISPLAYED
        // description={t("currencies.description")}
        actions={isLoading ? t("common.loading") : `${currencies.length} ${t("currencies.items")}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">{t("currencies.code")}</th>
                <th className="py-2">{t("currencies.name")}</th>
                <th className="py-2">{t("currencies.buy")}</th>
                <th className="py-2">{t("currencies.sell")}</th>
                <th className="py-2">{t("currencies.status")}</th>
                {canUpdateCurrency && <th className="py-2">{t("currencies.action")}</th>}
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => (
                <tr key={currency.id} className="border-b border-slate-100">
                  <td className="py-2 font-semibold">{currency.code}</td>
                  <td className="py-2">{currency.name}</td>
                  <td className="py-2">{currency.baseRateBuy}</td>
                  <td className="py-2">{currency.baseRateSell}</td>
                  <td className="py-2">
                    <Badge tone={currency.active ? "emerald" : "slate"}>
                      {currency.active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </td>
                  {canUpdateCurrency && (
                    <td className="py-2">
                      <div className="flex gap-3 text-sm font-semibold">
                        <button
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() => toggleActive(currency.id, Boolean(currency.active))}
                        >
                          {currency.active ? t("currencies.setInactive") : t("currencies.setActive")}
                        </button>
                        <button
                          className="text-amber-600 hover:text-amber-700"
                          onClick={() => startEdit(currency.id)}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => handleDeleteClick(currency.id)}
                          disabled={isDeleting}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!currencies.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={canUpdateCurrency ? 6 : 5}>
                    {t("currencies.noCurrencies")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title={t("currencies.editTitle")}
             // 我 REMOVED DESCRIPTION UNDER THE TITLE BEING DISPLAYED
          // description={t("currencies.editDesc")}
          actions={<button onClick={cancelEdit} className="text-sm text-slate-600">{t("common.cancel")}</button>}
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEdit}>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("currencies.codePlaceholder")}
              value={editForm.code}
              onChange={(e) => setEditForm((p) => (p ? { ...p, code: e.target.value } : p))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("currencies.namePlaceholder")}
              value={editForm.name}
              onChange={(e) => setEditForm((p) => (p ? { ...p, name: e.target.value } : p))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("currencies.baseRateBuyPlaceholder")}
              value={editForm.baseRateBuy}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, baseRateBuy: e.target.value } : p))
              }
              required
              type="number"
              step="0.0001"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("currencies.baseRateSellPlaceholder")}
              value={editForm.baseRateSell}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, baseRateSell: e.target.value } : p))
              }
              required
              type="number"
              step="0.0001"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("currencies.conversionRateBuyPlaceholder")}
              value={editForm.conversionRateBuy}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, conversionRateBuy: e.target.value } : p))
              }
              type="number"
              step="0.0001"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("currencies.conversionRateSellPlaceholder")}
              value={editForm.conversionRateSell}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, conversionRateSell: e.target.value } : p))
              }
              type="number"
              step="0.0001"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) =>
                  setEditForm((p) => (p ? { ...p, active: e.target.checked } : p))
                }
              />
              {t("common.active")}
            </label>
            <button
              type="submit"
              className="col-span-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              {t("currencies.updateCurrency")}
            </button>
          </form>
        </SectionCard>
      )}

      {canCreateCurrency && (
        <SectionCard
          title={t("currencies.addTitle")}
             // 我 REMOVED DESCRIPTION UNDER THE TITLE BEING DISPLAYED
          // description={t("currencies.addDesc")}
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("currencies.codePlaceholder")}
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("currencies.namePlaceholder")}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("currencies.baseRateBuyPlaceholder")}
            value={form.baseRateBuy}
            onChange={(e) => setForm((p) => ({ ...p, baseRateBuy: e.target.value }))}
            required
            type="number"
            step="0.0001"
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("currencies.baseRateSellPlaceholder")}
            value={form.baseRateSell}
            onChange={(e) => setForm((p) => ({ ...p, baseRateSell: e.target.value }))}
            required
            type="number"
            step="0.0001"
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("currencies.conversionRateBuyPlaceholder")}
            value={form.conversionRateBuy}
            onChange={(e) =>
              setForm((p) => ({ ...p, conversionRateBuy: e.target.value }))
            }
            type="number"
            step="0.0001"
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("currencies.conversionRateSellPlaceholder")}
            value={form.conversionRateSell}
            onChange={(e) =>
              setForm((p) => ({ ...p, conversionRateSell: e.target.value }))
            }
            type="number"
            step="0.0001"
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
            />
            {t("common.active")}
          </label>
          <button
            type="submit"
            disabled={isSaving}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? t("common.saving") : t("currencies.saveCurrency")}
          </button>
        </form>
        </SectionCard>
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
        onConfirm={() => confirmModal.currencyId && remove(confirmModal.currencyId)}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", currencyId: null })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}


