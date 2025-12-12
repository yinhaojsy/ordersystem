import { useMemo, useState, type FormEvent } from "react";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import {
  useAddRoleMutation,
  useDeleteRoleMutation,
  useGetRolesQuery,
  useUpdateRoleMutation,
} from "../services/api";
import type { RolePermissions } from "../types";

const SECTION_OPTIONS = ["dashboard", "currencies", "customers", "users", "roles", "orders"];
const ACTION_OPTIONS = [
  { key: "createCurrency", label: "Create currency" },
  { key: "createCustomer", label: "Create customer" },
  { key: "createUser", label: "Create user" },
  { key: "createOrder", label: "Create order" },
  { key: "editCurrency", label: "Edit currency" },
  { key: "processOrder", label: "Process order" },
  { key: "cancelOrder", label: "Cancel order" },
];

export default function RolesPage() {
  const { data: roles = [], isLoading } = useGetRolesQuery();
  const [addRole, { isLoading: isSaving }] = useAddRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

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
    await updateRole({
      id: editingId,
      data: editForm,
    });
    cancelEdit();
  };

  const remove = async (id: number) => {
    await deleteRole(id);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Roles & permissions"
        description="Granular access control per section and action."
        actions={isLoading ? "Loading..." : `${roles.length} roles`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">Name</th>
                <th className="py-2">Display</th>
                <th className="py-2">Sections</th>
                <th className="py-2">Actions</th>
                <th className="py-2">Manage</th>
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
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(role.permissions.actions || {})
                        .filter(([, allowed]) => allowed)
                        .map(([actionKey]) => (
                          <Badge key={actionKey} tone="emerald">
                            {actionKey}
                          </Badge>
                        ))}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2 text-sm font-semibold">
                      <button
                        className="text-amber-600 hover:text-amber-700"
                        onClick={() => startEdit(role.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => remove(role.id)}
                        disabled={isDeleting}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!roles.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={5}>
                    No roles yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title="Edit role (Admin)"
          description="Adjust permissions and labels."
          actions={<button onClick={cancelEdit} className="text-sm text-slate-600">Cancel</button>}
        >
          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Name (identifier)"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => (p ? { ...p, name: e.target.value } : p))}
                required
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Display name"
                value={editForm.displayName}
                onChange={(e) =>
                  setEditForm((p) => (p ? { ...p, displayName: e.target.value } : p))
                }
                required
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">Sections</div>
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
                    {section}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">Actions</div>
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
                    {action.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              Update role
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Add role">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Name (identifier)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Display name"
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              required
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">Sections</div>
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
                  {section}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">Actions</div>
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
                  {action.label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save role"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}


