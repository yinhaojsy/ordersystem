import React from "react";
import { formatDate } from "../../utils/format";
import type { Account } from "../../types";

interface OrderDetails {
  order: {
    status: string;
    customerName?: string;
    customerId: number;
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    amountBuy: number;
    amountSell: number;
    handlerName?: string;
    createdAt: string;
    paymentType?: "CRYPTO" | "FIAT";
    networkChain?: string;
    walletAddresses?: string[];
    bankDetails?: {
      bankName?: string;
      accountTitle?: string;
      accountNumber?: string;
      accountIban?: string;
      swiftCode?: string;
      bankAddress?: string;
    };
    remarks?: string | null;
  };
  receipts: any[]; // OrderReceipt[]
  beneficiaries: any[]; // OrderBeneficiary[]
  payments: any[]; // OrderPayment[]
  totalReceiptAmount: number;
  totalPaymentAmount: number;
}

interface OnlineOrderSummaryProps {
  orderDetails: OrderDetails;
  accounts: Account[];
  viewModalOrderId: number | null;
  confirmReceipt: (receiptId: number) => { unwrap: () => Promise<any> };
  deleteReceipt: (receiptId: number) => { unwrap: () => Promise<any> };
  confirmPayment: (paymentId: number) => { unwrap: () => Promise<any> };
  deletePayment: (paymentId: number) => { unwrap: () => Promise<any> };
  getFileType: (imagePath: string) => 'image' | 'pdf' | null;
  setViewerModal: (modal: { isOpen: boolean; src: string; type: 'image' | 'pdf'; title: string } | null) => void;
  openPdfInNewTab: (dataUri: string) => void;
  t: (key: string) => string | undefined;
}

export const OnlineOrderSummary: React.FC<OnlineOrderSummaryProps> = ({
  orderDetails,
  accounts,
  viewModalOrderId,
  confirmReceipt,
  deleteReceipt,
  confirmPayment,
  deletePayment,
  getFileType,
  setViewerModal,
  openPdfInNewTab,
  t,
}) => {
  return (
    <>
      {/* Order Summary */}
      <div className="border-b pb-4">
        <h3 className="font-semibold text-slate-900 mb-3">
          {t("orders.orderSummary")}
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div>
              <span className="text-slate-500">{t("orders.status")}:</span>
              <span className="ml-2 font-semibold text-slate-900 capitalize">
                {t(`orders.${orderDetails.order.status}`)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t("orders.customer")}:</span>
              <span className="ml-2 text-slate-700">
                {orderDetails.order.customerName || orderDetails.order.customerId}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t("orders.currencyPair")}:</span>
              <span className="ml-2 text-slate-700">
                {orderDetails.order.fromCurrency} → {orderDetails.order.toCurrency}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t("orders.exchangeRate")}:</span>
              <span className="ml-2 text-slate-700">
                {orderDetails.order.rate}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-slate-500">{t("orders.amountBuy")}:</span>
              <span className="ml-2 font-semibold text-slate-900">
                {orderDetails.order.amountBuy} {orderDetails.order.fromCurrency}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t("orders.amountSell")}:</span>
              <span className="ml-2 font-semibold text-slate-900">
                -{orderDetails.order.amountSell} {orderDetails.order.toCurrency}
              </span>
            </div>
            {orderDetails.order.handlerName && (
              <div>
                <span className="text-slate-500">{t("orders.handler")}:</span>
                <span className="ml-2 text-slate-700">
                  {orderDetails.order.handlerName}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-500">{t("orders.date")}:</span>
              <span className="ml-2 text-slate-700">
                {formatDate(orderDetails.order.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Beneficiary Details */}
      {orderDetails.beneficiaries.length > 0 && (
        <div className="border-b pb-4">
          <h3 className="font-semibold text-slate-900 mb-2">
            Customer Beneficiary Details
          </h3>
          {orderDetails.beneficiaries.map((beneficiary) => (
            <div key={beneficiary.id} className="mb-4">
              {beneficiary.paymentType === "CRYPTO" ? (
                <div className="text-sm text-slate-600">
                  <p>Type: CRYPTO</p>
                  <p>Network: {beneficiary.networkChain || "N/A"}</p>
                  {beneficiary.walletAddresses && beneficiary.walletAddresses.length > 0 && (
                    <>
                      <p>{t("orders.walletAddresses")}:</p>
                      <ul className="list-disc list-inside ml-4">
                        {beneficiary.walletAddresses.map((addr: string, idx: number) => (
                          <li key={idx}>{addr}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-600">
                  <p>Type: FIAT</p>
                  <p>Bank: {beneficiary.bankName || "N/A"}</p>
                  <p>Account Title: {beneficiary.accountTitle || "N/A"}</p>
                  <p>Account Number: {beneficiary.accountNumber || "N/A"}</p>
                  <p>IBAN: {beneficiary.accountIban || "N/A"}</p>
                  <p>Swift Code: {beneficiary.swiftCode || "N/A"}</p>
                  <p>Bank Address: {beneficiary.bankAddress || "N/A"}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receipt Uploads Display */}
      {orderDetails.receipts.length > 0 && (
        <div className="border-b pb-4">
          <h3 className="font-semibold text-slate-900 mb-2">
            {t("orders.receiptUploads")}
          </h3>
          <div className="text-sm text-slate-600 mb-3">
            {t("orders.amountReceived")}: {orderDetails.totalReceiptAmount.toFixed(2)} {orderDetails.order.fromCurrency}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {orderDetails.receipts.map((receipt) => (
              <div key={receipt.id} className="flex flex-col">
                {getFileType(receipt.imagePath) === 'image' ? (
                  <img
                    src={receipt.imagePath}
                    alt="Receipt"
                    className="w-48 h-72 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity mb-2"
                    onClick={() => setViewerModal({ isOpen: true, src: receipt.imagePath, type: 'image', title: t("orders.receiptUploads") })}
                  />
                ) : getFileType(receipt.imagePath) === 'pdf' ? (
                  <div
                    className="w-48 h-72 flex flex-col items-center justify-center bg-slate-50 border-2 border-slate-200 rounded cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                    onClick={() => openPdfInNewTab(receipt.imagePath)}
                  >
                    <svg
                      className="w-8 h-8 text-red-500 mb-1"
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
                    <p className="text-xs text-slate-600">PDF</p>
                  </div>
                ) : null}
                <p className="text-xs text-slate-700 font-medium">
                  {t("orders.amount")}: {receipt.amount} {orderDetails.order.fromCurrency}
                </p>
                {receipt.accountName && (
                  <p className="text-xs text-slate-500">
                    {t("orders.account")}: {receipt.accountName}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Uploads Display */}
      {orderDetails.payments.length > 0 && (
        <div className="border-b pb-4">
          <h3 className="font-semibold text-slate-900 mb-2">
            {t("orders.paymentUploads")}
          </h3>
          <div className="text-sm text-slate-600 mb-3">
            {t("orders.amountPaid")}: {orderDetails.totalPaymentAmount.toFixed(2)} {orderDetails.order.toCurrency}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {orderDetails.payments.map((payment) => (
              <div key={payment.id} className="flex flex-col">
                {getFileType(payment.imagePath) === 'image' ? (
                  <img
                    src={payment.imagePath}
                    alt="Payment"
                    className="w-48 h-72 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity mb-2"
                    onClick={() => setViewerModal({ isOpen: true, src: payment.imagePath, type: 'image', title: t("orders.paymentUploads") })}
                  />
                ) : getFileType(payment.imagePath) === 'pdf' ? (
                  <div
                    className="w-48 h-72 flex flex-col items-center justify-center bg-slate-50 border-2 border-slate-200 rounded cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                    onClick={() => openPdfInNewTab(payment.imagePath)}
                  >
                    <svg
                      className="w-8 h-8 text-red-500 mb-1"
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
                    <p className="text-xs text-slate-600">PDF</p>
                  </div>
                ) : null}
                <p className="text-xs text-slate-700 font-medium">
                  {t("orders.amount")}: {payment.amount} {orderDetails.order.toCurrency}
                </p>
                {payment.accountName && (
                  <p className="text-xs text-slate-500">
                    {t("orders.account")}: {payment.accountName}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remarks Display */}
      {orderDetails.order.remarks && (
        <div className="border-b pb-4">
          <h3 className="font-semibold text-slate-900 mb-2">
            {t("orders.remarks")}
          </h3>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-900 whitespace-pre-wrap">
              {orderDetails.order.remarks}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

