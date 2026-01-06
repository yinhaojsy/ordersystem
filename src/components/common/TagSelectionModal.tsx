import React from "react";
import Badge from "./Badge";

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface TagSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  selectedTagIds: number[];
  onTagSelectionChange: (tagId: number, checked: boolean) => void;
  onApply: () => void;
  onRemove: () => void;
  isApplying?: boolean;
  isRemoving?: boolean;
  title?: string;
  noTagsMessage?: string;
  selectAtLeastOneMessage?: string;
  applyButtonText?: string;
  removeButtonText?: string;
  cancelButtonText?: string;
  applyingText?: string;
  savingText?: string;
  t?: (key: string) => string | undefined;
}

export const TagSelectionModal: React.FC<TagSelectionModalProps> = ({
  isOpen,
  onClose,
  tags,
  selectedTagIds,
  onTagSelectionChange,
  onApply,
  onRemove,
  isApplying = false,
  isRemoving = false,
  title,
  noTagsMessage,
  selectAtLeastOneMessage,
  applyButtonText,
  removeButtonText,
  cancelButtonText,
  applyingText,
  savingText,
  t,
}) => {
  if (!isOpen) return null;

  const handleTagToggle = (tagId: number, checked: boolean) => {
    onTagSelectionChange(tagId, checked);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold mb-4">
          {title || t?.("orders.selectTags") || "Select Tags"}
        </h2>
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
          {tags.length === 0 ? (
            <p className="text-slate-500 text-sm">
              {noTagsMessage || t?.("orders.noTagsAvailable") || "No tags available. Create tags in the Tags page."}
            </p>
          ) : (
            tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={(e) => handleTagToggle(tag.id, e.target.checked)}
                  className="h-4 w-4"
                />
                <Badge tone="slate" backgroundColor={tag.color}>
                  {tag.name}
                </Badge>
              </label>
            ))
          )}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
          >
            {cancelButtonText || t?.("common.cancel") || "Cancel"}
          </button>
          <button
            onClick={onRemove}
            disabled={isRemoving || selectedTagIds.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isRemoving ? (savingText || t?.("common.saving") || "Saving...") : (removeButtonText || t?.("orders.remove") || "Remove")}
          </button>
          <button
            onClick={onApply}
            disabled={isApplying || selectedTagIds.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isApplying ? (applyingText || t?.("orders.applying") || "Applying...") : (applyButtonText || t?.("orders.apply") || "Apply")}
          </button>
        </div>
      </div>
    </div>
  );
};

