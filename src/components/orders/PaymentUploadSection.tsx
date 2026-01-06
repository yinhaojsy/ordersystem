import React from "react";
import type { UploadItem } from "../../hooks/orders/useViewOrderModal";
import type { Account, Order } from "../../types";

interface PaymentUploadSectionProps {
  uploads: UploadItem[];
  setUploads: React.Dispatch<React.SetStateAction<UploadItem[]>>;
  uploadKey: number;
  dragOver: boolean;
  setDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  fileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  onImageUpload: (file: File, index: number, type: "receipt" | "payment") => void;
  onDrop: (e: React.DragEvent, index: number, type: "receipt" | "payment") => void;
  onDragOver: (e: React.DragEvent, type: "receipt" | "payment") => void;
  onDragLeave: (e: React.DragEvent, type: "receipt" | "payment") => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, index: number, type: "receipt" | "payment") => void;
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  setActiveUploadType: (type: "receipt" | "payment" | null) => void;
  setShowPaymentUpload?: (show: boolean) => void;
  accounts: Account[];
  orders: Order[];
  viewModalOrderId: number | null;
  onFormSubmit?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCancel?: () => void;
  showCancelButtons?: boolean;
  isFlexOrder?: boolean;
  t: (key: string) => string | undefined;
}

export const PaymentUploadSection: React.FC<PaymentUploadSectionProps> = ({
  uploads,
  setUploads,
  uploadKey,
  dragOver,
  setDragOver,
  fileInputRefs,
  onImageUpload,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileChange,
  handleNumberInputWheel,
  setActiveUploadType,
  setShowPaymentUpload,
  accounts,
  orders,
  viewModalOrderId,
  onFormSubmit,
  onCancel,
  showCancelButtons = false,
  isFlexOrder = false,
  t,
}) => {
  const currentOrder = orders.find((o) => o.id === viewModalOrderId);

  return (
    <>
      {uploads.map((upload, index) => (
        <div
          key={`${uploadKey}-${index}`}
          className={`flex flex-col p-3 border-2 border-dashed rounded-lg transition-colors relative ${
            dragOver && index === uploads.length - 1
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200"
          }`}
          onDrop={(e) => {
            onDrop(e, index, "payment");
            setActiveUploadType(null);
          }}
          onDragOver={(e) => {
            onDragOver(e, "payment");
            setActiveUploadType("payment");
          }}
          onDragLeave={(e) => {
            onDragLeave(e, "payment");
            setActiveUploadType(null);
          }}
          onFocus={() => setActiveUploadType("payment")}
          onClick={() => setActiveUploadType("payment")}
        >
          {(!upload.image && !upload.amount && !upload.accountId) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const newUploads = uploads.filter((_, i) => i !== index);
                setUploads(newUploads);
                if (newUploads.length === 0 && setShowPaymentUpload) {
                  setShowPaymentUpload(false);
                }
              }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-300 flex items-center justify-center text-sm font-bold z-10"
              title={t("common.delete")}
            >
              −
            </button>
          )}
          <input
            type="file"
            accept="image/*,.pdf"
            ref={(el) => {
              if (el) {
                const key: string = `payment-${uploadKey}-${index}`;
                fileInputRefs.current[key] = el;
              }
            }}
            key={`payment-file-${uploadKey}-${index}`}
            className="hidden"
            id={`payment-file-input-${uploadKey}-${index}`}
            onChange={(e) => onFileChange(e, index, "payment")}
          />
          <label
            htmlFor={`payment-file-input-${uploadKey}-${index}`}
            className="block cursor-pointer w-full h-72"
          >
            {upload.image ? (
              <div className="relative w-full h-full">
                {upload.image.startsWith('data:image/') ? (
                  <img
                    src={upload.image}
                    alt="Payment preview"
                    className="w-full h-full object-cover rounded"
                  />
                ) : upload.image.startsWith('data:application/pdf') ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border-2 border-slate-200 rounded">
                    <svg className="w-8 h-8 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-slate-600">PDF</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newUploads = [...uploads];
                    newUploads[index] = { ...newUploads[index], image: "", amount: newUploads[index].amount, accountId: newUploads[index].accountId };
                    setUploads(newUploads);
                    const key: string = `payment-${uploadKey}-${index}`;
                    if (fileInputRefs.current[key]) {
                      fileInputRefs.current[key]!.value = "";
                    }
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 transition-colors">
                <svg className="h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-xs text-slate-600">Click or drag to upload</p>
              </div>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={t("orders.amount")}
            value={upload.amount}
            onChange={(e) => {
              const newUploads = [...uploads];
              newUploads[index] = { ...newUploads[index], amount: e.target.value };
              setUploads(newUploads);
            }}
            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
            required={!!upload.image}
            onWheel={handleNumberInputWheel}
          />
          {(() => {
            return (
              <select
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs mt-2"
                value={upload.accountId}
                onChange={(e) => {
                  const newUploads = [...uploads];
                  newUploads[index] = {
                    ...newUploads[index],
                    accountId: e.target.value,
                  };
                  setUploads(newUploads);
                }}
                required={!!upload.image}
              >
            <option value="">
              {t("orders.selectPaymentAccount")} ({currentOrder?.toCurrency || ""}) *
            </option>
            {accounts
              .filter((acc) => acc.currencyCode === currentOrder?.toCurrency)
              .map((account) => {
                const hasInsufficientBalance = currentOrder && account.balance < Number(upload.amount || 0);
                return (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                    {hasInsufficientBalance ? ` ⚠️ ${t("orders.insufficient")}` : ""}
                  </option>
                );
              })}
              </select>
            );
          })()}
          {index === uploads.length - 1 && onFormSubmit && (
            <div className={`mt-2 ${showCancelButtons ? "flex gap-2" : ""}`}>
              <button
                type="button"
                onClick={onFormSubmit}
                className={showCancelButtons
                  ? "px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  : "w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                }
              >
                {t("orders.uploadPayments")}
              </button>
              {showCancelButtons && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
};

