import React from "react";
import { ReceiptDisplay } from "./ReceiptDisplay";
import { PaymentDisplay } from "./PaymentDisplay";
import { ReceiptUploadSection } from "./ReceiptUploadSection";
import { PaymentUploadSection } from "./PaymentUploadSection";
import type { Account, Order, AuthResponse } from "../../types";
import type { UploadItem } from "../../hooks/orders/useViewOrderModal";
import { canPerformOrderActions } from "../../utils/orderPermissions";

interface OnlineOrderUploadsSectionProps {
  orderDetails: any; // Order details with receipts, payments, order, etc.
  accounts: Account[];
  orders: Order[];
  viewModalOrderId: number | null;
  authUser: AuthResponse | null;
  
  // Receipt props
  receipts: any[]; // OrderReceipt[]
  totalReceiptAmount: number;
  receiptBalance: number;
  showReceiptUpload: boolean;
  setShowReceiptUpload: (show: boolean) => void;
  receiptUploads: UploadItem[];
  setReceiptUploads: React.Dispatch<React.SetStateAction<UploadItem[]>>;
  receiptUploadKey: number;
  receiptDragOver: boolean;
  setReceiptDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  receiptFileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  handleAddReceipt: (event: React.FormEvent) => Promise<void>;
  confirmReceipt: (receiptId: number) => { unwrap: () => Promise<any> };
  deleteReceipt: (receiptId: number) => { unwrap: () => Promise<any> };
  
  // Payment props
  payments: any[]; // OrderPayment[]
  totalPaymentAmount: number;
  paymentBalance: number;
  excessPaymentWarning?: { excessAmount: number; additionalReceiptsNeeded: number } | null;
  showPaymentUpload: boolean;
  setShowPaymentUpload: (show: boolean) => void;
  paymentUploads: UploadItem[];
  setPaymentUploads: React.Dispatch<React.SetStateAction<UploadItem[]>>;
  paymentUploadKey: number;
  paymentDragOver: boolean;
  setPaymentDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  paymentFileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  handleAddPayment: (event: React.FormEvent) => Promise<void>;
  confirmPayment: (paymentId: number) => { unwrap: () => Promise<any> };
  deletePayment: (paymentId: number) => { unwrap: () => Promise<any> };
  
  // File upload handlers
  handleImageUpload: (file: File, index: number, type: "receipt" | "payment") => void;
  handleDrop: (e: React.DragEvent, index: number, type: "receipt" | "payment") => void;
  handleDragOver: (e: React.DragEvent, type: "receipt" | "payment") => void;
  handleDragLeave: (e: React.DragEvent, type: "receipt" | "payment") => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, index: number, type: "receipt" | "payment") => void;
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  setActiveUploadType: (type: "receipt" | "payment" | null) => void;
  getFileType: (imagePath: string) => 'image' | 'pdf' | null;
  
  // Viewer modal
  setViewerModal: (modal: { isOpen: boolean; src: string; type: 'image' | 'pdf'; title: string } | null) => void;
  openPdfInNewTab: (dataUri: string) => void;
  
  // Configuration props
  isFlexOrder?: boolean;
  showCancelButtons?: boolean;
  layout?: "grid" | "vertical";
  
  t: (key: string) => string | undefined;
}

const OnlineOrderUploadsSectionComponent: React.FC<OnlineOrderUploadsSectionProps> = ({
  orderDetails,
  accounts,
  orders,
  viewModalOrderId,
  authUser,
  receipts,
  totalReceiptAmount,
  receiptBalance,
  showReceiptUpload,
  setShowReceiptUpload,
  receiptUploads,
  setReceiptUploads,
  receiptUploadKey,
  receiptDragOver,
  setReceiptDragOver,
  receiptFileInputRefs,
  handleAddReceipt,
  confirmReceipt,
  deleteReceipt,
  payments,
  totalPaymentAmount,
  paymentBalance,
  excessPaymentWarning,
  showPaymentUpload,
  setShowPaymentUpload,
  paymentUploads,
  setPaymentUploads,
  paymentUploadKey,
  paymentDragOver,
  setPaymentDragOver,
  paymentFileInputRefs,
  handleAddPayment,
  confirmPayment,
  deletePayment,
  handleImageUpload,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  handleFileChange,
  handleNumberInputWheel,
  setActiveUploadType,
  getFileType,
  setViewerModal,
  openPdfInNewTab,
  isFlexOrder = false,
  showCancelButtons = false,
  layout = "vertical",
  t,
}) => {
  const isDisabled = orderDetails.order.status === "completed" || orderDetails.order.status === "cancelled";
  const canPerformActions = canPerformOrderActions(orderDetails.order, authUser);
  
  const containerClassName = layout === "grid" ? "lg:col-span-2 space-y-4" : "space-y-4";
  const receiptTitleSuffix = isFlexOrder ? ` (${t("orders.flexOrder")})` : "";
  const paymentTitleSuffix = isFlexOrder ? ` (${t("orders.flexOrder")})` : "";
  const receiptAmountBuy = isFlexOrder 
    ? (orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy)
    : orderDetails.order.amountBuy;
  const paymentAmountSell = isFlexOrder
    ? (orderDetails.order.actualAmountSell || orderDetails.order.amountSell)
    : orderDetails.order.amountSell;

  const handleCancelReceipt = () => {
    setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
    setShowReceiptUpload(false);
  };

  const handleCancelPayment = () => {
    setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
    setShowPaymentUpload(false);
  };

  return (
    <div className={containerClassName}>
      {/* Receipt Upload Section */}
      <div className="border-b pb-4">
        <h3 className="font-semibold text-slate-900 mb-2">
          {t("orders.receiptUploads")}{receiptTitleSuffix}
        </h3>
        <div className="text-sm text-slate-600 mb-2">
          {t("orders.amountBuy")}: {orderDetails.order.amountBuy} {orderDetails.order.fromCurrency}
          {isFlexOrder && orderDetails.order.actualAmountBuy && (
            <span className="ml-2 text-purple-600">
              (Actual: {orderDetails.order.actualAmountBuy} {orderDetails.order.fromCurrency})
            </span>
          )}
        </div>
        <div className="text-sm text-slate-600 mb-2">
          {t("orders.amountReceived")}: {totalReceiptAmount.toFixed(2)} {orderDetails.order.fromCurrency}
        </div>
        <div className="text-sm text-slate-600 mb-4">
          {t("orders.balance")}: {receiptBalance.toFixed(2)} {orderDetails.order.fromCurrency}
        </div>

        <div className={`grid ${isFlexOrder ? "grid-cols-3" : "grid-cols-4"} gap-4`}>
          {receipts.map((receipt) => (
            <ReceiptDisplay
              key={receipt.id}
              receipt={receipt}
              onConfirm={async (receiptId) => {
                await confirmReceipt(receiptId).unwrap();
              }}
              onDelete={async (receiptId) => {
                await deleteReceipt(receiptId).unwrap();
              }}
              getFileType={getFileType}
              onViewImage={(src, type, title) => setViewerModal({ isOpen: true, src, type, title })}
              onViewPdf={openPdfInNewTab}
              t={t}
            />
          ))}
          {!isDisabled && canPerformActions && showReceiptUpload && (
            <ReceiptUploadSection
              uploads={receiptUploads}
              setUploads={setReceiptUploads}
              uploadKey={receiptUploadKey}
              dragOver={receiptDragOver}
              setDragOver={setReceiptDragOver}
              fileInputRefs={receiptFileInputRefs}
              onImageUpload={handleImageUpload}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileChange={handleFileChange}
              handleNumberInputWheel={handleNumberInputWheel}
              setActiveUploadType={setActiveUploadType}
              setShowReceiptUpload={setShowReceiptUpload}
              accounts={accounts}
              orders={orders}
              viewModalOrderId={viewModalOrderId}
              onFormSubmit={async (e) => {
                e.preventDefault();
                const formEvent = e as unknown as React.FormEvent;
                await handleAddReceipt(formEvent);
              }}
              onCancel={handleCancelReceipt}
              showCancelButtons={showCancelButtons}
              isFlexOrder={isFlexOrder}
              t={t}
            />
          )}
        </div>

        {!isDisabled && canPerformActions && !showReceiptUpload && (
          <button
            type="button"
            onClick={() => {
              setShowReceiptUpload(true);
              if (receiptUploads.length === 0) {
                setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
              }
            }}
            className="mt-4 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {t("orders.addReceipt")}
          </button>
        )}
      </div>

      {/* Payment Upload Section */}
      <div className="border-b pb-4">
        <h3 className="font-semibold text-slate-900 mb-2">
          {t("orders.paymentUploads")}{paymentTitleSuffix}
        </h3>
        {isFlexOrder && excessPaymentWarning && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 mb-2">
              ⚠️ Payment Exceeds Expected Amount
            </p>
            <div className="text-sm text-amber-800 space-y-1">
              <p>
                Excess Payment: {excessPaymentWarning.excessAmount.toFixed(2)}{" "}
                {orderDetails.order.toCurrency}
              </p>
              <p>
                Additional Receipts Required: {excessPaymentWarning.additionalReceiptsNeeded.toFixed(2)}{" "}
                {orderDetails.order.fromCurrency}
              </p>
              <p className="text-xs text-amber-700 mt-2">
                Please upload receipts for the additional amount before completing this order.
              </p>
            </div>
          </div>
        )}
        <div className="text-sm text-slate-600 mb-2">
          {t("orders.amountSell")}: -{paymentAmountSell} {orderDetails.order.toCurrency}
        </div>
        <div className="text-sm text-slate-600 mb-2">
          {t("orders.amountPaid")}: {totalPaymentAmount.toFixed(2)} {orderDetails.order.toCurrency}
        </div>
        <div className="text-sm text-slate-600 mb-4">
          {t("orders.balance")}: {paymentBalance.toFixed(2)} {orderDetails.order.toCurrency}
        </div>

        <div className={`grid ${isFlexOrder ? "grid-cols-3" : "grid-cols-4"} gap-4`}>
          {payments.map((payment) => (
            <PaymentDisplay
              key={payment.id}
              payment={payment}
              onConfirm={async (paymentId) => {
                await confirmPayment(paymentId).unwrap();
              }}
              onDelete={async (paymentId) => {
                await deletePayment(paymentId).unwrap();
              }}
              getFileType={getFileType}
              onViewImage={(src, type, title) => setViewerModal({ isOpen: true, src, type, title })}
              onViewPdf={openPdfInNewTab}
              t={t}
            />
          ))}
          {!isDisabled && canPerformActions && showPaymentUpload && (
            <PaymentUploadSection
              uploads={paymentUploads}
              setUploads={setPaymentUploads}
              uploadKey={paymentUploadKey}
              dragOver={paymentDragOver}
              setDragOver={setPaymentDragOver}
              fileInputRefs={paymentFileInputRefs}
              onImageUpload={handleImageUpload}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileChange={handleFileChange}
              handleNumberInputWheel={handleNumberInputWheel}
              setActiveUploadType={setActiveUploadType}
              setShowPaymentUpload={setShowPaymentUpload}
              accounts={accounts}
              orders={orders}
              viewModalOrderId={viewModalOrderId}
              onFormSubmit={async (e) => {
                e.preventDefault();
                const formEvent = e as unknown as React.FormEvent;
                await handleAddPayment(formEvent);
              }}
              onCancel={handleCancelPayment}
              showCancelButtons={showCancelButtons}
              isFlexOrder={isFlexOrder}
              t={t}
            />
          )}
        </div>

        {!isDisabled && canPerformActions && !showPaymentUpload && (
          <button
            type="button"
            onClick={() => {
              setShowPaymentUpload(true);
              if (paymentUploads.length === 0) {
                setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
              }
            }}
            className={`mt-4 px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${
              isFlexOrder
                ? "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                : "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
            }`}
          >
            {t("orders.addPayment")}
          </button>
        )}
      </div>
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders when props haven't changed
export const OnlineOrderUploadsSection = React.memo(OnlineOrderUploadsSectionComponent);

