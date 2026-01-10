import React, { type FormEvent } from "react";
import { useTranslation } from "react-i18next";

interface CreateCustomerModalProps {
  isOpen: boolean;
  customerForm: {
    name: string;
    email: string;
    phone: string;
    remarks: string;
  };
  setCustomerForm: React.Dispatch<React.SetStateAction<{
    name: string;
    email: string;
    phone: string;
    remarks: string;
  }>>;
  isCreatingCustomer: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function CreateCustomerModal({
  isOpen,
  customerForm,
  setCustomerForm,
  isCreatingCustomer,
  onClose,
  onSubmit,
}: CreateCustomerModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[10000] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {t("orders.createNewCustomerTitle")}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={t("common.close")}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.name")}
            value={customerForm.name}
            onChange={(e) =>
              setCustomerForm((p) => ({ ...p, name: e.target.value }))
            }
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.email")}
            type="email"
            value={customerForm.email}
            onChange={(e) =>
              setCustomerForm((p) => ({ ...p, email: e.target.value }))
            }
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.phone")}
            type="tel"
            value={customerForm.phone}
            onChange={(e) =>
              setCustomerForm((p) => ({ ...p, phone: e.target.value }))
            }
          />
          <textarea
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.remarksPlaceholder") || "Remarks (optional)"}
            value={customerForm.remarks}
            onChange={(e) =>
              setCustomerForm((p) => ({ ...p, remarks: e.target.value }))
            }
            rows={3}
          />
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isCreatingCustomer}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isCreatingCustomer ? t("common.saving") : t("customers.createCustomer")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

