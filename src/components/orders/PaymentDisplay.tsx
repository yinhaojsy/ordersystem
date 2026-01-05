import React from "react";
import type { OrderPayment } from "../../types";

interface PaymentDisplayProps {
  payment: OrderPayment;
  onConfirm: (paymentId: number) => Promise<void>;
  onDelete: (paymentId: number) => Promise<void>;
  getFileType: (imagePath: string) => 'image' | 'pdf' | null;
  onViewImage: (src: string, type: 'image' | 'pdf', title: string) => void;
  onViewPdf: (dataUri: string) => void;
  t: (key: string) => string | undefined;
}

export const PaymentDisplay: React.FC<PaymentDisplayProps> = ({
  payment,
  onConfirm,
  onDelete,
  getFileType,
  onViewImage,
  onViewPdf,
  t,
}) => {
  return (
    <div
      key={payment.id}
      className={`mb-4 p-3 border rounded-lg ${
        payment.status === 'draft' 
          ? 'border-yellow-300 bg-yellow-50' 
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        {payment.status === 'draft' && (
          <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-200 text-yellow-800">
            Draft
          </span>
        )}
        {payment.status === 'draft' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(t("orders.confirmPaymentQuestion") || "Confirm this payment?")) {
                  try {
                    await onConfirm(payment.id);
                  } catch (error: any) {
                    console.error("Error confirming payment:", error);
                    const errorMessage = error?.data?.message || error?.message || "Failed to confirm payment";
                    alert(errorMessage);
                  }
                }
              }}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
            >
              {t("common.confirm") || "Confirm"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(t("orders.deletePaymentQuestion") || "Delete this payment?")) {
                  try {
                    await onDelete(payment.id);
                  } catch (error: any) {
                    console.error("Error deleting payment:", error);
                    const errorMessage = error?.data?.message || error?.message || "Failed to delete payment";
                    alert(errorMessage);
                  }
                }
              }}
              className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
            >
              {t("common.delete") || "Delete"}
            </button>
          </div>
        )}
      </div>
      {getFileType(payment.imagePath) === 'image' ? (
        <img
          src={payment.imagePath}
          alt="Payment"
          className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onViewImage(payment.imagePath, 'image', t("orders.paymentUploads") || "Payment Uploads")}
        />
      ) : getFileType(payment.imagePath) === 'pdf' ? (
        <div
          className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
          onClick={() => onViewPdf(payment.imagePath)}
        >
          <svg
            className="w-12 h-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-slate-700">PDF Document</p>
            <p className="text-xs text-slate-500">Click to view</p>
          </div>
        </div>
      ) : null}
      <p className="text-sm text-slate-600">
        {t("orders.amount")}: {payment.amount}
      </p>
      {payment.accountName && (
        <p className="text-sm text-slate-500">
          {t("orders.account")}: {payment.accountName}
        </p>
      )}
    </div>
  );
};

