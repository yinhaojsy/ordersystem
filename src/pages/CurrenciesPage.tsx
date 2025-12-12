import { useState, type FormEvent } from "react";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import {
  useAddCurrencyMutation,
  useGetCurrenciesQuery,
  useUpdateCurrencyMutation,
  useDeleteCurrencyMutation,
} from "../services/api";

export default function CurrenciesPage() {
  const { data: currencies = [], isLoading } = useGetCurrenciesQuery();
  const [addCurrency, { isLoading: isSaving }] = useAddCurrencyMutation();
  const [updateCurrency] = useUpdateCurrencyMutation();
  const [deleteCurrency, { isLoading: isDeleting }] = useDeleteCurrencyMutation();

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
    });
    cancelEdit();
  };

  const remove = async (id: number) => {
    await deleteCurrency(id);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Currencies"
        description="Backed by SQLite. Toggle active status or add a new pair."
        actions={isLoading ? "Loading..." : `${currencies.length} items`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">Code</th>
                <th className="py-2">Name</th>
                <th className="py-2">Buy</th>
                <th className="py-2">Sell</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
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
                      {currency.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-3 text-sm font-semibold">
                      <button
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => toggleActive(currency.id, Boolean(currency.active))}
                      >
                        Set {currency.active ? "inactive" : "active"}
                      </button>
                      <button
                        className="text-amber-600 hover:text-amber-700"
                        onClick={() => startEdit(currency.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => remove(currency.id)}
                        disabled={isDeleting}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!currencies.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={6}>
                    No currencies yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title="Edit currency (Admin)"
          description="Only admins should edit or delete."
          actions={<button onClick={cancelEdit} className="text-sm text-slate-600">Cancel</button>}
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEdit}>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Code (e.g. USD)"
              value={editForm.code}
              onChange={(e) => setEditForm((p) => (p ? { ...p, code: e.target.value } : p))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Name"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => (p ? { ...p, name: e.target.value } : p))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Base rate buy"
              value={editForm.baseRateBuy}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, baseRateBuy: e.target.value } : p))
              }
              required
              type="number"
              step="0.0001"
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Base rate sell"
              value={editForm.baseRateSell}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, baseRateSell: e.target.value } : p))
              }
              required
              type="number"
              step="0.0001"
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Conversion rate buy"
              value={editForm.conversionRateBuy}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, conversionRateBuy: e.target.value } : p))
              }
              type="number"
              step="0.0001"
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Conversion rate sell"
              value={editForm.conversionRateSell}
              onChange={(e) =>
                setEditForm((p) => (p ? { ...p, conversionRateSell: e.target.value } : p))
              }
              type="number"
              step="0.0001"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) =>
                  setEditForm((p) => (p ? { ...p, active: e.target.checked } : p))
                }
              />
              Active
            </label>
            <button
              type="submit"
              className="col-span-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              Update currency
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard
        title="Add currency"
        description="Saved directly to the embedded database."
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Code (e.g. USD)"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Base rate buy"
            value={form.baseRateBuy}
            onChange={(e) => setForm((p) => ({ ...p, baseRateBuy: e.target.value }))}
            required
            type="number"
            step="0.0001"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Base rate sell"
            value={form.baseRateSell}
            onChange={(e) => setForm((p) => ({ ...p, baseRateSell: e.target.value }))}
            required
            type="number"
            step="0.0001"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Conversion rate buy"
            value={form.conversionRateBuy}
            onChange={(e) =>
              setForm((p) => ({ ...p, conversionRateBuy: e.target.value }))
            }
            type="number"
            step="0.0001"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Conversion rate sell"
            value={form.conversionRateSell}
            onChange={(e) =>
              setForm((p) => ({ ...p, conversionRateSell: e.target.value }))
            }
            type="number"
            step="0.0001"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
            />
            Active
          </label>
          <button
            type="submit"
            disabled={isSaving}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save currency"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}


