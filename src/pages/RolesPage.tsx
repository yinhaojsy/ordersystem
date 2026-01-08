import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useAddRoleMutation,
  useDeleteRoleMutation,
  useGetRolesQuery,
  useUpdateRoleMutation,
  useForceLogoutUsersByRoleMutation,
} from "../services/api";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { setUser } from "../app/authSlice";
import type { RolePermissions } from "../types";

const SECTION_OPTIONS = ["dashboard", "currencies", "customers", "users", "roles", "orders", "transfers", "accounts", "expenses", "profit", "tags"];

export default function RolesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.auth.user);
  const { data: roles = [], isLoading } = useGetRolesQuery();
  
  const ACTION_OPTIONS = [
    { key: "createCurrency", labelKey: "roles.createCurrency" },
    { key: "createCustomer", labelKey: "roles.createCustomer" },
    { key: "createUser", labelKey: "roles.createUser" },
    { key: "createOrder", labelKey: "roles.createOrder" },
    { key: "editCurrency", labelKey: "roles.editCurrency" },
    { key: "processOrder", labelKey: "roles.processOrder" },
    { key: "cancelOrder", labelKey: "roles.cancelOrder" },
    { key: "deleteOrder", labelKey: "roles.deleteOrder" },
    { key: "deleteManyOrders", labelKey: "roles.deleteManyOrders" },
    { key: "deleteExpense", labelKey: "roles.deleteExpense" },
    { key: "deleteAccount", labelKey: "roles.deleteAccount" },
    { key: "deleteTransfer", labelKey: "roles.deleteTransfer" },
    { key: "createFlexOrder", labelKey: "roles.createFlexOrder" },
    { key: "manageAccountsDisplay", labelKey: "roles.manageAccountsDisplay" },
    { key: "createTag", labelKey: "roles.createTag" },
    { key: "deleteTag", labelKey: "roles.deleteTag" }, // edit/delete tag
  ];
  const [addRole, { isLoading: isSaving }] = useAddRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();
  const [forceLogoutUsers, { isLoading: isLoggingOut }] = useForceLogoutUsersByRoleMutation();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; roleId: number | null }>({
    isOpen: false,
    message: "",
    roleId: null,
  });

  const [logoutConfirmModal, setLogoutConfirmModal] = useState<{ 
    isOpen: boolean; 
    message: string; 
    roleId: number | null;
    roleName: string;
  }>({
    isOpen: false,
    message: "",
    roleId: null,
    roleName: "",
  });

  const [form, setForm] = useState<{
    name: string;
    displayName: string;
    permissions: RolePermissions;
  }>({
    name: "",
    displayName: "",
    permissions: {
      sections: ["dashboard", "orders"],
      actions: { createOrder: true, processOrder: true },
    },
  });

  const actionEnabled = useMemo(
    () => (action: string) => Boolean(form.permissions.actions[action]),
    [form.permissions.actions],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.displayName) return;
    await addRole(form);
    setForm({
      name: "",
      displayName: "",
      permissions: { sections: ["dashboard"], actions: {} },
    });
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<typeof form | null>(null);

  const startEdit = (id: number) => {
    const current = roles.find((r) => r.id === id);
    if (!current) return;
    setEditingId(id);
    setEditForm({
      name: current.name,
      displayName: current.displayName,
      permissions: current.permissions,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    
    const updatedRole = await updateRole({
      id: editingId,
      data: editForm,
    }).unwrap();
    
    // Check if the updated role matches the current user's role
    // If so, force logout so they need to login again with new permissions
    // Note: Other users with this role will be logged out automatically via SSE in AppLayout
    if (currentUser && updatedRole.name === currentUser.role) {
      dispatch(setUser(null));
      setAlertModal({
        isOpen: true,
        message: t("roles.roleUpdatedLogout") || "Your role permissions have been updated. Please login again to apply the new permissions.",
        type: "info",
      });
      // Navigate to login after a short delay
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
      return;
    }
    
    cancelEdit();
  };

  const handleDeleteClick = (id: number) => {
    const role = roles.find((r) => r.id === id);
    if (!role) return;
    
    setConfirmModal({
      isOpen: true,
      message: t("roles.confirmDelete") || `Are you sure you want to delete ${role.displayName}?`,
      roleId: id,
    });
  };

  const remove = async (id: number) => {
    try {
      await deleteRole(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", roleId: null });
    } catch (err: any) {
      let message = t("roles.cannotDeleteReferenced");
      
      if (err?.data) {
        let errorMessage = '';
        if (typeof err.data === 'string') {
          errorMessage = err.data;
        } else if (err.data.message) {
          errorMessage = err.data.message;
        }
        
        // Check if it's the generic server error message and translate it
        if (errorMessage === "Cannot delete this item because it is referenced by other records.") {
          message = t("roles.cannotDeleteReferenced");
        } else if (errorMessage) {
          // Check if it's the role deletion error with users
          const roleErrorMatch = errorMessage.match(/Cannot delete role "([^"]+)" because it is assigned to (\d+) user\(s\)\. Please reassign or remove those users first\./);
          if (roleErrorMatch) {
            const [, roleName, userCount] = roleErrorMatch;
            message = t("roles.cannotDeleteRoleWithUsers", { roleName, count: Number(userCount) });
          } else {
            message = errorMessage;
          }
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", roleId: null });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const handleForceLogoutClick = (id: number) => {
    const role = roles.find((r) => r.id === id);
    if (!role) return;
    
    setLogoutConfirmModal({
      isOpen: true,
      message: t("roles.confirmForceLogout") || `Are you sure you want to force logout all users with role "${role.displayName}"?`,
      roleId: id,
      roleName: role.name,
    });
  };

  const confirmForceLogout = async (id: number) => {
    try {
      const result = await forceLogoutUsers(id).unwrap();
      setLogoutConfirmModal({ isOpen: false, message: "", roleId: null, roleName: "" });
      setAlertModal({
        isOpen: true,
        message: result.message || t("roles.forceLogoutSuccess") || "Users will be logged out immediately.",
        type: "success",
      });
      
      // If current user has this role, they will be logged out automatically via SSE
      // But let's also handle it locally for immediate feedback
      const role = roles.find((r) => r.id === id);
      if (currentUser && role && currentUser.role === role.name) {
        setTimeout(() => {
          dispatch(setUser(null));
          navigate("/login", { replace: true });
        }, 2000);
      }
    } catch (err: any) {
      setLogoutConfirmModal({ isOpen: false, message: "", roleId: null, roleName: "" });
      setAlertModal({
        isOpen: true,
        message: err?.data?.message || t("roles.forceLogoutError") || "Failed to force logout users.",
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("roles.title")}
           // 我 REMOVED DESCRIPTION UNDER THE TITLE BEING DISPLAYED
        // description={t("roles.description")}
        actions={isLoading ? t("common.loading") : `${roles.length} ${t("roles.roles")}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">{t("roles.name")}</th>
                <th className="py-2">{t("roles.display")}</th>
                <th className="py-2">{t("roles.sections")}</th>
                <th className="py-2">{t("roles.actions")}</th>
                <th className="py-2">{t("roles.manage")}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 font-semibold">{role.name}</td>
                  <td className="py-2">{role.displayName}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.sections.map((section) => (
                        <Badge key={section} tone="slate">
                          {t(`sections.${section}`) || section}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(role.permissions.actions || {})
                        .filter(([, allowed]) => allowed)
                        .map(([actionKey]) => {
                          const actionOption = ACTION_OPTIONS.find(opt => opt.key === actionKey);
                          return (
                            <Badge key={actionKey} tone="emerald">
                              {actionOption ? t(actionOption.labelKey) : actionKey}
                            </Badge>
                          );
                        })}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2 text-sm font-semibold">
                      <button
                        className="text-amber-600 hover:text-amber-700"
                        onClick={() => startEdit(role.id)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => handleForceLogoutClick(role.id)}
                        disabled={isLoggingOut}
                      >
                        {t("roles.forceLogout") || "Force Logout"}
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => handleDeleteClick(role.id)}
                        disabled={isDeleting}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!roles.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={5}>
                    {t("roles.noRoles")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title={t("roles.editTitle")}
          description={t("roles.editDesc")}
          actions={<button onClick={cancelEdit} className="text-sm text-slate-600">{t("common.cancel")}</button>}
        >
          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("roles.namePlaceholder")}
                value={editForm.name}
                onChange={(e) => setEditForm((p) => (p ? { ...p, name: e.target.value } : p))}
                required
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("roles.displayNamePlaceholder")}
                value={editForm.displayName}
                onChange={(e) =>
                  setEditForm((p) => (p ? { ...p, displayName: e.target.value } : p))
                }
                required
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">{t("roles.sectionsLabel")}</div>
              <div className="flex flex-wrap gap-3">
                {SECTION_OPTIONS.map((section) => (
                  <label key={section} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editForm.permissions.sections.includes(section)}
                      onChange={(e) => {
                        const { checked } = e.target;
                        setEditForm((prev) => {
                          if (!prev) return prev;
                          const nextSections = checked
                            ? [...prev.permissions.sections, section]
                            : prev.permissions.sections.filter((s) => s !== section);
                          return {
                            ...prev,
                            permissions: { ...prev.permissions, sections: nextSections },
                          };
                        });
                      }}
                    />
                    {t(`sections.${section}`) || section}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">{t("roles.actionsLabel")}</div>
              <div className="flex flex-wrap gap-3">
                {ACTION_OPTIONS.map((action) => (
                  <label key={action.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.permissions.actions[action.key])}
                      onChange={(e) => {
                        const { checked } = e.target;
                        setEditForm((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              actions: {
                                ...prev.permissions.actions,
                                [action.key]: checked,
                              },
                            },
                          };
                        });
                      }}
                    />
                    {t(action.labelKey)}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              {t("roles.updateRole")}
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard title={t("roles.addTitle")}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("roles.namePlaceholder")}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("roles.displayNamePlaceholder")}
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              required
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">{t("roles.sectionsLabel")}</div>
            <div className="flex flex-wrap gap-3">
              {SECTION_OPTIONS.map((section) => (
                <label key={section} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.permissions.sections.includes(section)}
                    onChange={(e) => {
                      const { checked } = e.target;
                      setForm((prev) => {
                        const nextSections = checked
                          ? [...prev.permissions.sections, section]
                          : prev.permissions.sections.filter((s) => s !== section);
                        return {
                          ...prev,
                          permissions: { ...prev.permissions, sections: nextSections },
                        };
                      });
                    }}
                  />
                  {t(`sections.${section}`) || section}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">{t("roles.actionsLabel")}</div>
            <div className="flex flex-wrap gap-3">
              {ACTION_OPTIONS.map((action) => (
                <label key={action.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={actionEnabled(action.key)}
                    onChange={(e) => {
                      const { checked } = e.target;
                      setForm((prev) => ({
                        ...prev,
                        permissions: {
                          ...prev.permissions,
                          actions: {
                            ...prev.permissions.actions,
                            [action.key]: checked,
                          },
                        },
                      }));
                    }}
                  />
                  {t(action.labelKey)}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? t("common.saving") : t("roles.saveRole")}
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
        onConfirm={() => confirmModal.roleId && remove(confirmModal.roleId)}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", roleId: null })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />

      <ConfirmModal
        isOpen={logoutConfirmModal.isOpen}
        message={logoutConfirmModal.message}
        onConfirm={() => logoutConfirmModal.roleId && confirmForceLogout(logoutConfirmModal.roleId)}
        onCancel={() => setLogoutConfirmModal({ isOpen: false, message: "", roleId: null, roleName: "" })}
        confirmText={t("common.confirm") || "Confirm"}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}


