import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useGetTagsQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from "../services/api";
import type { Tag, TagInput } from "../types";

export default function TagsPage() {
  const { t } = useTranslation();
  const { data: tags = [], isLoading } = useGetTagsQuery();
  const [createTag, { isLoading: isCreating }] = useCreateTagMutation();
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();
  const [deleteTag, { isLoading: isDeleting }] = useDeleteTagMutation();

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type?: "error" | "warning" | "info" | "success";
  }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    tagId: number | null;
  }>({
    isOpen: false,
    message: "",
    tagId: null,
  });

  const [form, setForm] = useState<TagInput>({
    name: "",
    color: "#3b82f6", // Default blue color
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TagInput | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.color) {
      setAlertModal({
        isOpen: true,
        message: t("tags.nameAndColorRequired"),
        type: "error",
      });
      return;
    }

    try {
      await createTag(form).unwrap();
      setForm({ name: "", color: "#3b82f6" });
      setAlertModal({
        isOpen: true,
        message: t("tags.tagCreated"),
        type: "success",
      });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("tags.createError"),
        type: "error",
      });
    }
  };

  const startEdit = (id: number) => {
    const current = tags.find((t) => t.id === id);
    if (!current) return;
    setEditingId(id);
    setEditForm({
      name: current.name,
      color: current.color,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    if (!editForm.name || !editForm.color) {
      setAlertModal({
        isOpen: true,
        message: t("tags.nameAndColorRequired"),
        type: "error",
      });
      return;
    }

    try {
      await updateTag({ id: editingId, data: editForm }).unwrap();
      cancelEdit();
      setAlertModal({
        isOpen: true,
        message: t("tags.tagUpdated"),
        type: "success",
      });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("tags.updateError"),
        type: "error",
      });
    }
  };

  const handleDeleteClick = (id: number) => {
    const tag = tags.find((t) => t.id === id);
    if (!tag) return;

    setConfirmModal({
      isOpen: true,
      message: t("tags.confirmDelete").replace("{{tagName}}", tag.name),
      tagId: id,
    });
  };

  const remove = async (id: number) => {
    try {
      const result = await deleteTag(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", tagId: null });
      setAlertModal({
        isOpen: true,
        message: result?.message || t("tags.tagDeleted"),
        type: "success",
      });
    } catch (error: any) {
      setConfirmModal({ isOpen: false, message: "", tagId: null });
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("tags.deleteError"),
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title={t("tags.title")}>
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t("tags.name")}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("tags.namePlaceholder")}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t("tags.color")}
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-20 border border-slate-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#3b82f6"
                  pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? t("tags.creating") : t("tags.create")}
              </button>
            </div>
          </div>
        </form>

        {isLoading ? (
          <div className="text-center py-8 text-slate-500">
            {t("tags.loading")}
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {t("tags.noTags")}
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                {editingId === tag.id && editForm ? (
                  <form
                    onSubmit={submitEdit}
                    className="flex items-center gap-4 flex-1"
                  >
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={editForm.color}
                        onChange={(e) =>
                          setEditForm({ ...editForm, color: e.target.value })
                        }
                        className="h-10 w-20 border border-slate-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editForm.color}
                        onChange={(e) =>
                          setEditForm({ ...editForm, color: e.target.value })
                        }
                        className="w-24 px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isUpdating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {t("tags.save")}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                      >
                        {t("tags.cancel")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Badge
                        tone="slate"
                        backgroundColor={tag.color}
                      >
                        {tag.name}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(tag.id)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                      >
                        {t("tags.edit")}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tag.id)}
                        className="px-3 py-1 text-sm bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200"
                      >
                        {t("tags.delete")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ isOpen: false, message: "", type: "error" })}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={() => {
          if (confirmModal.tagId) {
            remove(confirmModal.tagId);
          }
        }}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", tagId: null })}
      />
    </div>
  );
}

