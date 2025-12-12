import { useState, type FormEvent } from "react";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import {
  useAddUserMutation,
  useDeleteUserMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
} from "../services/api";

export default function UsersPage() {
  const { data: users = [], isLoading } = useGetUsersQuery();
  const [addUser, { isLoading: isSaving }] = useAddUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "manager",
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email) return;
    await addUser(form);
    setForm({ name: "", email: "", role: "manager" });
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<typeof form | null>(null);

  const startEdit = (id: number) => {
    const current = users.find((u) => u.id === id);
    if (!current) return;
    setEditingId(id);
    setEditForm({
      name: current.name,
      email: current.email,
      role: current.role,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    await updateUser({ id: editingId, data: editForm });
    cancelEdit();
  };

  const remove = async (id: number) => {
    await deleteUser(id);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Users"
        description="Team members with roles."
        actions={isLoading ? "Loading..." : `${users.length} users`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-2 font-semibold">{user.name}</td>
                  <td className="py-2">{user.email}</td>
                  <td className="py-2">
                    <Badge tone="slate">{user.role}</Badge>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2 text-sm font-semibold">
                      <button
                        className="text-amber-600 hover:text-amber-700"
                        onClick={() => startEdit(user.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => remove(user.id)}
                        disabled={isDeleting}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={4}>
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title="Edit user (Admin)"
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
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((p) => (p ? { ...p, email: e.target.value } : p))}
              required
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={editForm.role}
              onChange={(e) => setEditForm((p) => (p ? { ...p, role: e.target.value } : p))}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              className="col-span-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              Update user
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Add user">
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
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={isSaving}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save user"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}


