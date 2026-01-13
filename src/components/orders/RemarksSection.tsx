import React from "react";

interface RemarksSectionProps {
  remarks: string;
  setRemarks: (remarks: string) => void;
  showRemarks: boolean;
  setShowRemarks: (show: boolean) => void;
  onSave?: () => void;
  onRemove?: () => Promise<void>;
  showSaveButton?: boolean;
  isSaving?: boolean;
  canEdit?: boolean;
  t: (key: string) => string;
}

export function RemarksSection({
  remarks,
  setRemarks,
  showRemarks,
  setShowRemarks,
  onSave,
  onRemove,
  showSaveButton = false,
  isSaving = false,
  canEdit = true,
  t,
}: RemarksSectionProps) {
  return (
    <div className="space-y-3 border-b border-slate-200 pb-4">
      {!showRemarks ? (
        <button
          type="button"
          onClick={() => setShowRemarks(true)}
          disabled={!canEdit}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("orders.addRemarks") || "Add Remarks"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              {t("orders.remarks") || "Remarks"}
            </label>
            <button
              type="button"
              onClick={async () => {
                if (onRemove) {
                  await onRemove();
                } else {
                  setRemarks("");
                  setShowRemarks(false);
                }
              }}
              className="text-slate-600 hover:text-slate-800 text-sm"
            >
              {t("orders.remove") || "Remove"}
            </button>
          </div>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={t("orders.remarksPlaceholder") || "Add any notes or remarks about this order for the team..."}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            onBlur={showSaveButton ? undefined : onSave}
            disabled={!canEdit}
            rows={4}
          />
          {showSaveButton && canEdit && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? t("common.saving") || "Saving..." : t("common.save") || "Save Remarks"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

