import React from "react";
import { useTranslation } from "react-i18next";

interface ExcessPaymentModalData {
  expectedPayment: number;
  actualPayment: number;
  excess: number;
  additionalReceipts: number;
  fromCurrency: string;
  toCurrency: string;
}

interface MissingPaymentModalData {
  expectedPayment: number;
  actualPayment: number;
  missing: number;
  toCurrency: string;
}

interface ExcessReceiptModalData {
  expectedReceipt: number;
  attemptedReceipt: number;
  excess: number;
  fromCurrency: string;
}

interface ExcessPaymentModalNormalData {
  expectedPayment: number;
  attemptedPayment: number;
  excess: number;
  toCurrency: string;
}

interface OrderWarningModalsProps {
  showExcessPaymentModal: boolean;
  excessPaymentModalData: ExcessPaymentModalData | null;
  onCloseExcessPayment: () => void;
  showMissingPaymentModal: boolean;
  missingPaymentModalData: MissingPaymentModalData | null;
  onCloseMissingPayment: () => void;
  showExcessReceiptModal: boolean;
  excessReceiptModalData: ExcessReceiptModalData | null;
  onCloseExcessReceipt: () => void;
  showExcessPaymentModalNormal: boolean;
  excessPaymentModalNormalData: ExcessPaymentModalNormalData | null;
  onCloseExcessPaymentNormal: () => void;
}

export function OrderWarningModals({
  showExcessPaymentModal,
  excessPaymentModalData,
  onCloseExcessPayment,
  showMissingPaymentModal,
  missingPaymentModalData,
  onCloseMissingPayment,
  showExcessReceiptModal,
  excessReceiptModalData,
  onCloseExcessReceipt,
  showExcessPaymentModalNormal,
  excessPaymentModalNormalData,
  onCloseExcessPaymentNormal,
}: OrderWarningModalsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Excess Payment Warning Modal */}
      {showExcessPaymentModal && excessPaymentModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <svg
                    className="h-6 w-6 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Payment Exceeds Expected Amount
                </h2>
              </div>
              <button
                onClick={onCloseExcessPayment}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-amber-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-medium">{t("orders.expectedPayment")}:</span>
                    <span className="text-amber-900 font-semibold">
                      {excessPaymentModalData.expectedPayment.toFixed(2)} {excessPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-medium">{t("orders.actualPayment")}:</span>
                    <span className="text-amber-900 font-semibold">
                      {excessPaymentModalData.actualPayment.toFixed(2)} {excessPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-amber-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-amber-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-amber-900 font-bold">
                        {excessPaymentModalData.excess.toFixed(2)} {excessPaymentModalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.actionRequired")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.youMustUpload")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessPaymentModalData.additionalReceipts.toFixed(2)} {excessPaymentModalData.fromCurrency}
                  </span>{" "}
                  {t("orders.additionalReceipts")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onCloseExcessPayment}
                className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Payment Warning Modal */}
      {showMissingPaymentModal && missingPaymentModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.amountsDoNotMatch")}
                </h2>
              </div>
              <button
                onClick={onCloseMissingPayment}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-800 font-medium">{t("orders.expectedPayment")}:</span>
                    <span className="text-blue-900 font-semibold">
                      {missingPaymentModalData.expectedPayment.toFixed(2)} {missingPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-800 font-medium">{t("orders.actualPayment")}:</span>
                    <span className="text-blue-900 font-semibold">
                      {missingPaymentModalData.actualPayment.toFixed(2)} {missingPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-blue-900 font-semibold">{t("orders.missing")}:</span>
                      <span className="text-blue-900 font-bold">
                        {missingPaymentModalData.missing.toFixed(2)} {missingPaymentModalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.actionRequired")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.pleaseUploadRemaining")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onCloseMissingPayment}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excess Receipt Warning Modal */}
      {showExcessReceiptModal && excessReceiptModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.receiptAmountExceedsOrderAmount")}
                </h2>
              </div>
              <button
                onClick={onCloseExcessReceipt}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.expectedReceiptAmount")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessReceiptModalData.expectedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.attemptToReceive")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessReceiptModalData.attemptedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                    </span>
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-red-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-red-900 font-bold">
                        {excessReceiptModalData.excess.toFixed(2)} {excessReceiptModalData.fromCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.cannotUpload")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.forNormalOrdersCannotUploadReceipts")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessReceiptModalData.expectedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                  </span>.
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold text-slate-900">{t("orders.note")}:</span> {t("orders.excessReceiptsOnlyAllowed")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onCloseExcessReceipt}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excess Payment Warning Modal for Normal Orders */}
      {showExcessPaymentModalNormal && excessPaymentModalNormalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.paymentAmountExceedsOrderAmount")}
                </h2>
              </div>
              <button
                onClick={onCloseExcessPaymentNormal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.expectedPaymentAmount")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessPaymentModalNormalData.expectedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.attemptToPay")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessPaymentModalNormalData.attemptedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-red-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-red-900 font-bold">
                        {excessPaymentModalNormalData.excess.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.cannotUpload")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.forNormalOrdersCannotUpload")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessPaymentModalNormalData.expectedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                  </span>.
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold text-slate-900">{t("orders.note")}:</span> {t("orders.excessPaymentsOnlyAllowed")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onCloseExcessPaymentNormal}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

