import React, { type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ProcessOrderFormState } from "../../hooks/orders/useProcessOrderModal";
import type { User } from "../../types";

interface ProcessOrderModalProps {
  isOpen: boolean;
  processForm: ProcessOrderFormState;
  setProcessForm: React.Dispatch<React.SetStateAction<ProcessOrderFormState>>;
  users: User[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function ProcessOrderModal({
  isOpen,
  processForm,
  setProcessForm,
  users,
  onClose,
  onSubmit,
}: ProcessOrderModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {t("orders.processOrderTitle")}
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
          <select
            className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
            value={processForm.handlerId}
            onChange={(e) =>
              setProcessForm((p) => ({ ...p, handlerId: e.target.value }))
            }
            required
          >
            <option value="">{t("orders.selectHandler")}</option>
            {users.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </select>

          {/* Commented out for future use - CRYPTO/FIAT payment type selection */}
          {/* 
          <div className="col-span-full">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t("orders.paymentType")}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentType"
                  value="CRYPTO"
                  checked={processForm.paymentType === "CRYPTO"}
                  onChange={(e) =>
                    setProcessForm((p) => ({
                      ...p,
                      paymentType: e.target.value as "CRYPTO" | "FIAT",
                    }))
                  }
                  className="mr-2"
                />
                {t("orders.crypto")}
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentType"
                  value="FIAT"
                  checked={processForm.paymentType === "FIAT"}
                  onChange={(e) =>
                    setProcessForm((p) => ({
                      ...p,
                      paymentType: e.target.value as "CRYPTO" | "FIAT",
                    }))
                  }
                  className="mr-2"
                />
                {t("orders.fiat")}
              </label>
            </div>
          </div>

          {processForm.paymentType === "CRYPTO" ? (
            <>
              <select
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                value={processForm.networkChain}
                onChange={(e) =>
                  setProcessForm((p) => ({
                    ...p,
                    networkChain: e.target.value,
                  }))
                }
              >
                <option value="">{t("orders.selectNetworkChain")}</option>
                <option value="TRC20">TRC20</option>
                <option value="ERC20">ERC20</option>
                <option value="BEP20">BEP20</option>
                <option value="POLYGON">POLYGON</option>
              </select>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("orders.walletAddresses")}
                </label>
                {processForm.walletAddresses.map((addr, index) => (
                  <div key={index} className="mb-2">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      placeholder={t("orders.walletAddress")}
                      value={addr}
                      onChange={(e) => {
                        const newAddresses = [...processForm.walletAddresses];
                        newAddresses[index] = e.target.value;
                        setProcessForm((p) => ({
                          ...p,
                          walletAddresses: newAddresses,
                        }));
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProcessForm((p) => ({
                      ...p,
                      walletAddresses: [...p.walletAddresses, ""],
                    }))
                  }
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t("orders.addAnotherAddress")}
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.bankName")}
                value={processForm.bankName}
                onChange={(e) =>
                  setProcessForm((p) => ({
                    ...p,
                    bankName: e.target.value,
                  }))
                }
              />
              <input
                type="text"
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.accountTitle")}
                value={processForm.accountTitle}
                onChange={(e) =>
                  setProcessForm((p) => ({
                    ...p,
                    accountTitle: e.target.value,
                  }))
                }
              />
              <input
                type="text"
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.accountNumber")}
                value={processForm.accountNumber}
                onChange={(e) =>
                  setProcessForm((p) => ({
                    ...p,
                    accountNumber: e.target.value,
                  }))
                }
              />
              <input
                type="text"
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.accountIban")}
                value={processForm.accountIban}
                onChange={(e) =>
                  setProcessForm((p) => ({
                    ...p,
                    accountIban: e.target.value,
                  }))
                }
              />
              <input
                type="text"
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.swiftCode")}
                value={processForm.swiftCode}
                onChange={(e) =>
                  setProcessForm((p) => ({
                    ...p,
                    swiftCode: e.target.value,
                  }))
                }
              />
              <textarea
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.bankAddress")}
                value={processForm.bankAddress}
                onChange={(e) =>
                  setProcessForm((p) => ({
                    ...p,
                    bankAddress: e.target.value,
                  }))
                }
                rows={3}
              />
            </>
          )}
          */}

          <div className="col-span-full flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
            >
              {t("orders.processOrder")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

