import { useState, type FormEvent } from "react";
import SectionCard from "../components/common/SectionCard";
import {
  useAddCustomerMutation,
  useGetCustomersQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} from "../services/api";

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useGetCustomersQuery();
  const [addCustomer, { isLoading: isSaving }] = useAddCustomerMutation();
  const [updateCustomer] = useUpdateCustomerMutation();
  const [deleteCustomer, { isLoading: isDeleting }] = useDeleteCustomerMutation();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name) return;
    await addCustomer({
      name: form.name,
      email: form.email,
      phone: form.phone,
      id: undefined,
    });
    setForm({ name: "", email: "", phone: "" });
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<typeof form | null>(null);

  const startEdit = (id: number) => {
    const current = customers.find((c) => c.id === id);
    if (!current) return;
    setEditingId(id);
    setEditForm({
      name: current.name,
      email: current.email,
      phone: current.phone,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    await updateCustomer({ id: editingId, data: editForm });
    cancelEdit();
  };

  const remove = async (id: number) => {
    await deleteCustomer(id);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Customers"
        description="CRM-style list persisted in SQLite."
        actions={isLoading ? "Loading..." : `${customers.length} records`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Phone</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-100">
                  <td className="py-2 font-semibold">{customer.name}</td>
                  <td className="py-2">{customer.email}</td>
                  <td className="py-2">{customer.phone}</td>
                  <td className="py-2">
                    <div className="flex gap-2 text-sm font-semibold">
                      <button
                        className="text-amber-600 hover:text-amber-700"
                        onClick={() => startEdit(customer.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => remove(customer.id)}
                        disabled={isDeleting}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!customers.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={4}>
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title="Edit customer (Admin)"
          actions={<button onClick={cancelEdit} className="text-sm text-slate-600">Cancel</button>}
        >
          <form className="grid gap-3 md:grid-cols-3" onSubmit={submitEdit}>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Name"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => (p ? { ...p, name: e.target.value } : p))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Email"
              value={editForm.email}
              onChange={(e) => setEditForm((p) => (p ? { ...p, email: e.target.value } : p))}
              type="email"
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm((p) => (p ? { ...p, phone: e.target.value } : p))}
            />
            <button
              type="submit"
              className="col-span-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              Update customer
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Add customer">
        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            type="email"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
          <button
            type="submit"
            disabled={isSaving}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save customer"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}


