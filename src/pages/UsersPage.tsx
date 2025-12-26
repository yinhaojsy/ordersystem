import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useAddUserMutation,
  useDeleteUserMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
  useGetRolesQuery,
} from "../services/api";

export default function UsersPage() {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useGetUsersQuery();
  const { data: roles = [] } = useGetRolesQuery();
  const [addUser, { isLoading: isSaving }] = useAddUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; userId: number | null }>({
    isOpen: false,
    message: "",
    userId: null,
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "manager",
  });

  // When roles are loaded, ensure the create-user form defaults to a valid role
  useEffect(() => {
    if (!roles.length) return;
    setForm((prev) => {
      // If the current role isn't in the roles list, default to the first role
      const hasCurrent = roles.some((r) => r.name === prev.role);
      if (hasCurrent) return prev;
      return { ...prev, role: roles[0]?.name ?? prev.role };
    });
  }, [roles]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email) return;
    await addUser(form);
    setForm({ name: "", email: "", password: "", role: "manager" });
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
      password: "",
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
    const payload: any = { ...editForm };
    if (!payload.password) {
      delete payload.password;
    }
    await updateUser({ id: editingId, data: payload });
    cancelEdit();
  };

  const handleDeleteClick = (id: number) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    
    setConfirmModal({
      isOpen: true,
      message: t("users.confirmDelete") || `Are you sure you want to delete ${user.name}?`,
      userId: id,
    });
  };

  const remove = async (id: number) => {
    try {
      await deleteUser(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", userId: null });
    } catch (err: any) {
      // Surface backend validation errors (e.g. foreign key constraint)
      let message = t("users.cannotDeleteReferenced");
      
      if (err?.data) {
        let errorMessage = '';
        if (typeof err.data === 'string') {
          errorMessage = err.data;
        } else if (err.data.message) {
          errorMessage = err.data.message;
        }
        
        // Check if it's the generic server error message and translate it
        if (errorMessage === "Cannot delete this item because it is referenced by other records.") {
          message = t("users.cannotDeleteReferenced");
        } else if (errorMessage) {
          message = errorMessage;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", userId: null });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("users.title")}
        description={t("users.description")}
        actions={isLoading ? t("common.loading") : `${users.length} ${t("users.users")}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">{t("users.name")}</th>
                <th className="py-2">{t("users.email")}</th>
                <th className="py-2">{t("users.role")}</th>
                <th className="py-2">{t("users.actions")}</th>
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
                        {t("common.edit")}
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => handleDeleteClick(user.id)}
                        disabled={isDeleting}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={4}>
                    {t("users.noUsers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title={t("users.editTitle")}
          actions={<button onClick={cancelEdit} className="text-sm text-slate-600">{t("common.cancel")}</button>}
        >
          <form className="grid gap-3 md:grid-cols-3" onSubmit={submitEdit}>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("users.namePlaceholder")}
              value={editForm.name}
              onChange={(e) => setEditForm((p) => (p ? { ...p, name: e.target.value } : p))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("users.emailPlaceholder")}
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
              {roles.length
                ? roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.displayName}
                    </option>
                  ))
                : (
                    <>
                      <option value="admin">{t("users.admin")}</option>
                      <option value="manager">{t("users.manager")}</option>
                      <option value="viewer">{t("users.viewer")}</option>
                    </>
                  )}
            </select>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("users.passwordPlaceholder") ?? "Password (leave blank to keep current)"}
              type="password"
              value={editForm.password}
              onChange={(e) => setEditForm((p) => (p ? { ...p, password: e.target.value } : p))}
            />
            <button
              type="submit"
              className="col-span-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              {t("users.updateUser")}
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard title={t("users.addTitle")}>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("users.namePlaceholder")}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("users.emailPlaceholder")}
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
            {roles.length
              ? roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.displayName}
                  </option>
                ))
              : (
                  <>
                    <option value="admin">{t("users.admin")}</option>
                    <option value="manager">{t("users.manager")}</option>
                    <option value="viewer">{t("users.viewer")}</option>
                  </>
                )}
          </select>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("users.passwordPlaceholder") ?? "Password"}
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            required
          />
          <button
            type="submit"
            disabled={isSaving}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? t("common.saving") : t("users.saveUser")}
          </button>
        </form>
      </SectionCard>

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type || "error"}
        onClose={() => setAlertModal({ isOpen: false, message: "", type: "error" })}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={() => confirmModal.userId && remove(confirmModal.userId)}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", userId: null })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}


