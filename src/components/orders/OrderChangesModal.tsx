import React from "react";
import { useTranslation } from "react-i18next";

interface OrderChangesModalProps {
  isOpen: boolean;
  order: any; // Original order
  amendedData: any; // Amended order data
  reason?: string; // Reason for the change request
  accounts?: any[];
  onClose: () => void;
  onApprove?: () => void;
  onReject?: (reason?: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  showActions?: boolean; // Whether to show approve/reject buttons
}

export function OrderChangesModal({
  isOpen,
  order,
  amendedData,
  reason,
  accounts = [],
  onClose,
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
  showActions = false,
}: OrderChangesModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !order) return null;

  const originalReceipts = Array.isArray(order.originalReceipts) ? order.originalReceipts : [];
  const originalPayments = Array.isArray(order.originalPayments) ? order.originalPayments : [];
  const amendedReceipts = Array.isArray(amendedData?.receipts) ? amendedData.receipts : [];
  const amendedPayments = Array.isArray(amendedData?.payments) ? amendedData.payments : [];

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {showActions 
              ? (t("approvals.requestDetails") || "Request Details")
              : (t("orders.viewChanges") || "View Pending Changes")}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {/* Reason */}
          {reason && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                {t("approvals.reason") || "Reason"}
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
                {reason}
              </div>
            </div>
          )}

          {/* Comparison View */}
          <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {t("approvals.originalOrder") || "Original Order"}
            </h3>
            <OrderComparisonView 
              order={order} 
              accounts={accounts}
              originalReceipts={originalReceipts}
              originalPayments={originalPayments}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {t("approvals.amendedOrder") || "Amended Order"}
            </h3>
            <OrderComparisonView 
              order={{
                ...order, // Start with original order data
                ...amendedData, // Override with amended data
                // Clear account names if account IDs changed or were cleared
                profitAccountName: ('profitAccountId' in amendedData && 
                                   amendedData.profitAccountId !== order.profitAccountId)
                  ? undefined 
                  : order.profitAccountName,
                serviceChargeAccountName: ('serviceChargeAccountId' in amendedData && 
                                           amendedData.serviceChargeAccountId !== order.serviceChargeAccountId)
                  ? undefined 
                  : order.serviceChargeAccountName,
              }} 
              accounts={accounts} 
              isAmended={true}
              originalOrder={order}
              amendedReceipts={amendedReceipts}
              amendedPayments={amendedPayments}
              originalReceipts={originalReceipts}
              originalPayments={originalPayments}
            />
          </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            {t("common.close") || "Close"}
          </button>
          {showActions && (
            <>
              <button
                onClick={() => {
                  const rejectionReason = prompt(t("approvals.rejectionReason") || "Rejection reason (optional):");
                  if (rejectionReason !== null && onReject) {
                    onReject(rejectionReason || undefined);
                  }
                }}
                disabled={isApproving || isRejecting}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {t("approvals.reject") || "Reject"}
              </button>
              <button
                onClick={onApprove}
                disabled={isApproving || isRejecting}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {t("approvals.approve") || "Approve"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderComparisonView({ 
  order, 
  accounts = [], 
  isAmended = false, 
  originalOrder,
  originalReceipts = [],
  originalPayments = [],
  amendedReceipts = [],
  amendedPayments = [],
}: { 
  order: any; 
  accounts?: any[]; 
  isAmended?: boolean; 
  originalOrder?: any;
  originalReceipts?: any[];
  originalPayments?: any[];
  amendedReceipts?: any[];
  amendedPayments?: any[];
}) {
  const { t } = useTranslation();
  
  // Use receipts/payments based on whether this is the original or amended view
  const receipts = isAmended ? amendedReceipts : originalReceipts;
  const payments = isAmended ? amendedPayments : originalPayments;
  
  // For comparison, always compare against the stored original
  const compareReceipts = isAmended ? originalReceipts : originalReceipts;
  const comparePayments = isAmended ? originalPayments : originalPayments;
  
  // Look up account names from accounts array if not provided in order
  const profitAccountName = order.profitAccountName || 
    (order.profitAccountId && accounts.find((a: any) => a.id === order.profitAccountId)?.name) || 
    null;
  
  const serviceChargeAccountName = order.serviceChargeAccountName || 
    (order.serviceChargeAccountId && accounts.find((a: any) => a.id === order.serviceChargeAccountId)?.name) || 
    null;
  
  // Helper function to get account name
  const getAccountName = (accountId: number | null) => {
    if (!accountId) return null;
    return accounts.find((a: any) => a.id === accountId)?.name || null;
  };
  
  // Helper function to get image URL from receipt/payment
  const getImageUrl = (receiptOrPayment: any) => {
    if (!receiptOrPayment) return null;
    
    const imagePath = receiptOrPayment.newImagePath || receiptOrPayment.currentImagePath || receiptOrPayment.imagePath;
    
    if (!imagePath) return null;
    
    // If it's already a data URL or full URL, return as-is
    if (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('/api/uploads/')) {
      return imagePath;
    }
    
    // Convert relative path to URL
    return `/api/uploads/${imagePath}`;
  };
  
  // Helper function to get file type
  const getFileType = (imagePath: string | null): 'image' | 'pdf' | null => {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('data:image/')) return 'image';
    if (imagePath.startsWith('data:application/pdf')) return 'pdf';
    
    const lowerPath = imagePath.toLowerCase();
    if (lowerPath.endsWith('.pdf')) return 'pdf';
    if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || 
        lowerPath.endsWith('.png') || lowerPath.endsWith('.gif') || 
        lowerPath.endsWith('.webp')) return 'image';
    
    return null;
  };
  
  // Helper function to check if receipts/payments have changed
  const receiptsChanged = isAmended && originalOrder && (
    receipts.length !== compareReceipts.length ||
    receipts.some((r: any, idx: number) => {
      const orig = compareReceipts[idx];
      return !orig || 
        Math.abs((r.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (r.accountId || null) !== (orig.accountId || null);
    }) ||
    compareReceipts.some((orig: any, idx: number) => {
      const r = receipts[idx];
      return !r || 
        Math.abs((r.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (r.accountId || null) !== (orig.accountId || null);
    })
  );
  
  const paymentsChanged = isAmended && originalOrder && (
    payments.length !== comparePayments.length ||
    payments.some((p: any, idx: number) => {
      const orig = comparePayments[idx];
      return !orig || 
        Math.abs((p.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (p.accountId || null) !== (orig.accountId || null);
    }) ||
    comparePayments.some((orig: any, idx: number) => {
      const p = payments[idx];
      return !p || 
        Math.abs((p.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (p.accountId || null) !== (orig.accountId || null);
    })
  );
  
  // Helper function to check if a value has changed
  const isChanged = (field: string, currentValue: any) => {
    if (!isAmended || !originalOrder) return false;
    const originalValue = originalOrder[field];
    
    if (currentValue === null || currentValue === undefined) {
      return originalValue !== null && originalValue !== undefined;
    }
    if (originalValue === null || originalValue === undefined) {
      return true;
    }
    
    if (typeof currentValue === 'number' && typeof originalValue === 'number') {
      return Math.abs(currentValue - originalValue) > 0.01;
    }
    return currentValue !== originalValue;
  };
  
  const getValueStyle = (field: string, value: any) => {
    if (isChanged(field, value)) {
      return "bg-red-100 text-red-900 font-bold";
    }
    return "";
  };
  
  // Check if profit/service charge has changed
  const profitChanged = isAmended && originalOrder && (
    isChanged("profitAmount", order.profitAmount) ||
    isChanged("profitCurrency", order.profitCurrency) ||
    isChanged("profitAccountId", order.profitAccountId)
  );
  
  const serviceChargeChanged = isAmended && originalOrder && (
    isChanged("serviceChargeAmount", order.serviceChargeAmount) ||
    isChanged("serviceChargeCurrency", order.serviceChargeCurrency) ||
    isChanged("serviceChargeAccountId", order.serviceChargeAccountId)
  );
  
  const amountBuyChanged = isAmended && originalOrder && isChanged("amountBuy", order.amountBuy);
  const amountSellChanged = isAmended && originalOrder && isChanged("amountSell", order.amountSell);
  const rateChanged = isAmended && originalOrder && isChanged("rate", order.rate);
  
  return (
    <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-3">
      <div><strong>{t("orders.customer") || "Customer"}:</strong> {order.customerName || order.customerId || "-"}</div>
      <div><strong>{t("orders.currencyPair") || "Currency Pair"}:</strong> {order.fromCurrency || ""} / {order.toCurrency || ""}</div>
      
      <div className="flex items-center justify-between">
        <div>
          <strong>{t("orders.amountBuy") || "Amount Buy"}:</strong>{" "}
          <span className={getValueStyle("amountBuy", order.amountBuy)}>
            {order.amountBuy}
          </span>
        </div>
        {amountBuyChanged && (
          <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
            {t("approvals.changed") || "CHANGED"}
          </span>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <strong>{t("orders.amountSell") || "Amount Sell"}:</strong>{" "}
          <span className={getValueStyle("amountSell", order.amountSell)}>
            {order.amountSell}
          </span>
        </div>
        {amountSellChanged && (
          <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
            {t("approvals.changed") || "CHANGED"}
          </span>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <strong>{t("orders.rate") || "Rate"}:</strong>{" "}
          <span className={getValueStyle("rate", order.rate)}>
            {order.rate}
          </span>
        </div>
        {rateChanged && (
          <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
            {t("approvals.changed") || "CHANGED"}
          </span>
        )}
      </div>
      
      {/* Receipts Section */}
      <div className={`border-t pt-2 ${receiptsChanged ? "border-red-300" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <strong>{t("orders.receipts") || "Receipts"}:</strong>
          {receiptsChanged && (
            <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
              {t("approvals.changed") || "CHANGED"}
            </span>
          )}
        </div>
        {receipts.length > 0 ? (
          <div className="space-y-3 ml-4">
            {receipts.map((receipt: any, idx: number) => {
              const accountName = getAccountName(receipt.accountId) || receipt.accountName;
              const imageUrl = getImageUrl(receipt);
              const fileType = getFileType(imageUrl || receipt.newImagePath || receipt.currentImagePath || receipt.imagePath);
              
              const hasExactMatch = isAmended && compareReceipts.some((orig: any) => 
                Math.abs((receipt.amount || 0) - (orig.amount || 0)) < 0.01 &&
                (receipt.accountId || null) === (orig.accountId || null)
              );
              
              const isReceiptChanged = isAmended && !hasExactMatch;
              
              return (
                <div key={idx} className={`${isReceiptChanged ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"} rounded-lg p-2`}>
                  <div className="flex gap-3">
                    {imageUrl && fileType === 'image' ? (
                      <img
                        src={imageUrl}
                        alt="Receipt"
                        className="w-24 h-32 object-cover rounded border border-slate-300 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : imageUrl && fileType === 'pdf' ? (
                      <div className="w-24 h-32 flex flex-col items-center justify-center bg-slate-100 border-2 border-slate-300 rounded flex-shrink-0">
                        <svg className="w-6 h-6 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs text-slate-600">PDF</p>
                      </div>
                    ) : null}
                    
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${isReceiptChanged ? "text-red-900 font-bold" : "text-slate-700"}`}>
                        <div className="font-medium mb-1">
                          {t("orders.amount") || "Amount"}: {receipt.amount || 0} {order.fromCurrency}
                        </div>
                        {accountName && (
                          <div className="text-slate-600">
                            {t("orders.account") || "Account"}: {accountName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 ml-4 italic">{t("orders.noReceipts") || "No receipts"}</div>
        )}
      </div>
      
      {/* Payments Section */}
      <div className={`border-t pt-2 ${paymentsChanged ? "border-red-300" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <strong>{t("orders.payments") || "Payments"}:</strong>
          {paymentsChanged && (
            <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
              {t("approvals.changed") || "CHANGED"}
            </span>
          )}
        </div>
        {payments.length > 0 ? (
          <div className="space-y-3 ml-4">
            {payments.map((payment: any, idx: number) => {
              const accountName = getAccountName(payment.accountId) || payment.accountName;
              const imageUrl = getImageUrl(payment);
              const fileType = getFileType(imageUrl || payment.newImagePath || payment.currentImagePath || payment.imagePath);
              
              const hasExactMatch = isAmended && comparePayments.some((orig: any) => 
                Math.abs((payment.amount || 0) - (orig.amount || 0)) < 0.01 &&
                (payment.accountId || null) === (orig.accountId || null)
              );
              
              const isPaymentChanged = isAmended && !hasExactMatch;
              
              return (
                <div key={idx} className={`${isPaymentChanged ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"} rounded-lg p-2`}>
                  <div className="flex gap-3">
                    {imageUrl && fileType === 'image' ? (
                      <img
                        src={imageUrl}
                        alt="Payment"
                        className="w-24 h-32 object-cover rounded border border-slate-300 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : imageUrl && fileType === 'pdf' ? (
                      <div className="w-24 h-32 flex flex-col items-center justify-center bg-slate-100 border-2 border-slate-300 rounded flex-shrink-0">
                        <svg className="w-6 h-6 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs text-slate-600">PDF</p>
                      </div>
                    ) : null}
                    
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${isPaymentChanged ? "text-red-900 font-bold" : "text-slate-700"}`}>
                        <div className="font-medium mb-1">
                          {t("orders.amount") || "Amount"}: {payment.amount || 0} {order.toCurrency}
                        </div>
                        {accountName && (
                          <div className="text-slate-600">
                            {t("orders.account") || "Account"}: {accountName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 ml-4 italic">{t("orders.noPayments") || "No payments"}</div>
        )}
      </div>
      
      {/* Profit Section */}
      {(order.profitAmount !== null && order.profitAmount !== undefined) && (
        <div className={`border-t pt-2 ${profitChanged ? "border-red-300" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <strong>{t("orders.profitAmount") || "Profit Amount"}:</strong>
            {profitChanged && (
              <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
                {t("approvals.changed") || "CHANGED"}
              </span>
            )}
          </div>
          <div className={`text-xs ml-4 ${profitChanged ? "bg-red-100 text-red-900 font-bold px-2 py-1 rounded" : ""}`}>
            {order.profitAmount} {order.profitCurrency || ""}
            {profitAccountName ? (
              <span className="text-slate-500 ml-1">({profitAccountName})</span>
            ) : order.profitAccountId ? (
              <span className="text-slate-500 ml-1">({t("orders.account") || "Account"} #{order.profitAccountId})</span>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Service Charge Section */}
      {(order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined) && (
        <div className={`border-t pt-2 ${serviceChargeChanged ? "border-red-300" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <strong>{t("orders.serviceChargeAmount") || "Service Charge Amount"}:</strong>
            {serviceChargeChanged && (
              <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
                {t("approvals.changed") || "CHANGED"}
              </span>
            )}
          </div>
          <div className={`text-xs ml-4 ${serviceChargeChanged ? "bg-red-100 text-red-900 font-bold px-2 py-1 rounded" : ""}`}>
            {order.serviceChargeAmount} {order.serviceChargeCurrency || ""}
            {serviceChargeAccountName ? (
              <span className="text-slate-500 ml-1">({serviceChargeAccountName})</span>
            ) : order.serviceChargeAccountId ? (
              <span className="text-slate-500 ml-1">({t("orders.account") || "Account"} #{order.serviceChargeAccountId})</span>
            ) : null}
          </div>
        </div>
      )}
      
      {order.remarks && (
        <div>
          <strong>{t("orders.remarks") || "Remarks"}:</strong>{" "}
          <span className={getValueStyle("remarks", order.remarks)}>
            {order.remarks}
          </span>
        </div>
      )}
    </div>
  );
}
