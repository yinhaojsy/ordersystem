import React, { useState, FormEvent, useEffect, useCallback } from "react";
import type { Order, Account, Currency } from "../../types";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";

interface ReceiptEntry {
  amount: number;
  accountId: number | null;
  currentImagePath?: string | null; // Current image path from database
  newImageFile?: File | null; // New image file to upload
  imagePreview?: string | null; // Preview URL for new image
}

interface PaymentEntry {
  amount: number;
  accountId: number | null;
  currentImagePath?: string | null; // Current image path from database
  newImageFile?: File | null; // New image file to upload
  imagePreview?: string | null; // Preview URL for new image
}

interface RequestApprovalModalProps {
  isOpen: boolean;
  order: Order | null;
  requestType: "delete" | "edit";
  onClose: () => void;
  onSubmit: (reason: string, amendedData?: Partial<Order>) => void;
  isSubmitting?: boolean;
  accounts?: Account[];
  currencies?: Currency[];
}

export function RequestApprovalModal({
  isOpen,
  order,
  requestType,
  onClose,
  onSubmit,
  isSubmitting = false,
  accounts = [],
  currencies = [],
}: RequestApprovalModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [amendedData, setAmendedData] = useState<Partial<Order>>({});
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch order details when modal opens
  const { data: orderDetails } = api.useGetOrderDetailsQuery(order?.id ?? 0, {
    skip: !isOpen || !order || requestType !== "edit",
  });

  // Initialize amendedData and receipts/payments with order data when modal opens
  useEffect(() => {
    if (isOpen && order && requestType === "edit") {
      setAmendedData({
        amountBuy: order.amountBuy,
        amountSell: order.amountSell,
        rate: order.rate,
        remarks: order.remarks ?? "",
        // Don't set profit/serviceCharge fields initially - let them fall back to order values
        // This allows the clear button to work correctly by setting them to null
      });

      // Initialize receipts and payments from order details
      if (orderDetails) {
        const initialReceipts: ReceiptEntry[] = orderDetails.receipts
          .filter((r) => r.status === "confirmed" && r.accountId)
          .map((r) => ({
            amount: r.amount,
            accountId: r.accountId ?? null,
            currentImagePath: r.imagePath || null,
            newImageFile: null,
            imagePreview: null,
          }));
        if (initialReceipts.length === 0) {
          initialReceipts.push({ amount: 0, accountId: null, currentImagePath: null, newImageFile: null, imagePreview: null });
        }
        setReceipts(initialReceipts);

        const initialPayments: PaymentEntry[] = orderDetails.payments
          .filter((p) => p.status === "confirmed" && p.accountId)
          .map((p) => ({
            amount: p.amount,
            accountId: p.accountId ?? null,
            currentImagePath: p.imagePath || null,
            newImageFile: null,
            imagePreview: null,
          }));
        if (initialPayments.length === 0) {
          initialPayments.push({ amount: 0, accountId: null, currentImagePath: null, newImageFile: null, imagePreview: null });
        }
        setPayments(initialPayments);
      } else {
        // If no order details yet, initialize with empty entries
        setReceipts([{ amount: 0, accountId: null, currentImagePath: null, newImageFile: null, imagePreview: null }]);
        setPayments([{ amount: 0, accountId: null, currentImagePath: null, newImageFile: null, imagePreview: null }]);
      }
    } else {
      setAmendedData({});
      setReceipts([]);
      setPayments([]);
    }
  }, [isOpen, order, requestType, orderDetails]);

  const handleClose = useCallback(() => {
    setReason("");
    setAmendedData({});
    setReceipts([]);
    setPayments([]);
    onClose();
  }, [onClose]);

  // Handle Esc key to close modal
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, isSubmitting, handleClose]);

  if (!isOpen || !order) return null;

  // Check if this is an OTC order (OTC orders don't require images)
  const isOtcOrder = order.orderType === "otc";

  // Calculate totals for validation
  const totalReceipts = receipts
    .filter((r) => r.amount > 0 && r.accountId !== null)
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPayments = payments
    .filter((p) => p.amount > 0 && p.accountId !== null)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const newAmountBuy = amendedData.amountBuy ?? order.amountBuy;
  const newAmountSell = amendedData.amountSell ?? order.amountSell;

  // Check if any field has changed
  const originalReceipts = orderDetails?.receipts?.filter((r: any) => r.status === "confirmed" && r.accountId) || [];
  const originalPayments = orderDetails?.payments?.filter((p: any) => p.status === "confirmed" && p.accountId) || [];
  
  const validReceipts = receipts.filter((r) => r.amount > 0 && r.accountId !== null);
  const validPayments = payments.filter((p) => p.amount > 0 && p.accountId !== null);
  
  // Compare receipts - check if counts or totals differ, or if any entry differs
  const receiptsChanged = 
    validReceipts.length !== originalReceipts.length ||
    validReceipts.reduce((sum, r) => sum + r.amount, 0) !== originalReceipts.reduce((sum: number, r: any) => sum + Number(r.amount), 0) ||
    validReceipts.some((r, idx) => {
      const orig = originalReceipts[idx];
      return !orig || Math.abs(r.amount - Number(orig.amount)) > 0.01 || r.accountId !== orig.accountId;
    });
  
  // Compare payments - check if counts or totals differ, or if any entry differs
  const paymentsChanged = 
    validPayments.length !== originalPayments.length ||
    validPayments.reduce((sum, p) => sum + p.amount, 0) !== originalPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) ||
    validPayments.some((p, idx) => {
      const orig = originalPayments[idx];
      return !orig || Math.abs(p.amount - Number(orig.amount)) > 0.01 || p.accountId !== orig.accountId;
    });
  
  const hasChanges = 
    (amendedData.amountBuy !== undefined && Math.abs((amendedData.amountBuy ?? 0) - order.amountBuy) > 0.01) ||
    (amendedData.amountSell !== undefined && Math.abs((amendedData.amountSell ?? 0) - order.amountSell) > 0.01) ||
    (amendedData.rate !== undefined && Math.abs((amendedData.rate ?? 0) - order.rate) > 0.0001) ||
    (amendedData.remarks !== undefined && amendedData.remarks !== (order.remarks ?? "")) ||
    // Check profit changes - compare with null to handle clearing
    (amendedData.profitAmount !== undefined && (amendedData.profitAmount === null ? order.profitAmount !== null : amendedData.profitAmount !== order.profitAmount)) ||
    (amendedData.profitCurrency !== undefined && (amendedData.profitCurrency === null ? order.profitCurrency !== null : amendedData.profitCurrency !== order.profitCurrency)) ||
    (amendedData.profitAccountId !== undefined && (amendedData.profitAccountId === null ? order.profitAccountId !== null : amendedData.profitAccountId !== order.profitAccountId)) ||
    // Check service charge changes - compare with null to handle clearing
    (amendedData.serviceChargeAmount !== undefined && (amendedData.serviceChargeAmount === null ? order.serviceChargeAmount !== null : amendedData.serviceChargeAmount !== order.serviceChargeAmount)) ||
    (amendedData.serviceChargeCurrency !== undefined && (amendedData.serviceChargeCurrency === null ? order.serviceChargeCurrency !== null : amendedData.serviceChargeCurrency !== order.serviceChargeCurrency)) ||
    (amendedData.serviceChargeAccountId !== undefined && (amendedData.serviceChargeAccountId === null ? order.serviceChargeAccountId !== null : amendedData.serviceChargeAccountId !== order.serviceChargeAccountId)) ||
    receiptsChanged ||
    paymentsChanged;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    
    const errors: string[] = [];
    
    if (!reason.trim()) {
      errors.push(t("orders.reasonRequired") || "Reason is required");
    }

    if (requestType === "edit") {
      // Check if there are any changes
      if (!hasChanges) {
        errors.push(t("orders.noChangesError") || "You must make at least one change to the order");
      }

      // Validate receipts total equals amountBuy
      const validReceipts = receipts.filter((r) => r.amount > 0 && r.accountId !== null);
      if (validReceipts.length > 0) {
        const receiptTotal = validReceipts.reduce((sum, r) => sum + r.amount, 0);
        if (Math.abs(receiptTotal - newAmountBuy) > 0.01) {
          errors.push(
            t("orders.receiptsTotalMismatch", { 
              total: receiptTotal.toFixed(2), 
              expected: newAmountBuy.toFixed(2),
              currency: order.fromCurrency
            }) || 
            `Total receipts (${receiptTotal.toFixed(2)} ${order.fromCurrency}) must equal Amount Buy (${newAmountBuy.toFixed(2)} ${order.fromCurrency})`
          );
        }
      }

      // Validate payments total equals amountSell
      const validPayments = payments.filter((p) => p.amount > 0 && p.accountId !== null);
      if (validPayments.length > 0) {
        const paymentTotal = validPayments.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(paymentTotal - newAmountSell) > 0.01) {
          errors.push(
            t("orders.paymentsTotalMismatch", {
              total: paymentTotal.toFixed(2),
              expected: newAmountSell.toFixed(2),
              currency: order.toCurrency
            }) ||
            `Total payments (${paymentTotal.toFixed(2)} ${order.toCurrency}) must equal Amount Sell (${newAmountSell.toFixed(2)} ${order.toCurrency})`
          );
        }
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (requestType === "edit") {
      // Include receipts and payments in amendedData with image information
      // For OTC orders, don't include image information
      const finalAmendedData = {
        ...amendedData,
        receipts: receipts
          .filter((r) => r.amount > 0 && r.accountId !== null)
          .map((r) => ({
            amount: r.amount,
            accountId: r.accountId,
            ...(isOtcOrder ? {} : {
              currentImagePath: r.currentImagePath,
              hasNewImage: !!r.newImageFile,
            }),
          })),
        payments: payments
          .filter((p) => p.amount > 0 && p.accountId !== null)
          .map((p) => ({
            amount: p.amount,
            accountId: p.accountId,
            ...(isOtcOrder ? {} : {
              currentImagePath: p.currentImagePath,
              hasNewImage: !!p.newImageFile,
            }),
          })),
        // Only include files for non-OTC orders
        ...(isOtcOrder ? {} : {
          receiptFiles: receipts
            .filter((r) => r.amount > 0 && r.accountId !== null && r.newImageFile)
            .map((r) => r.newImageFile!),
          paymentFiles: payments
            .filter((p) => p.amount > 0 && p.accountId !== null && p.newImageFile)
            .map((p) => p.newImageFile!),
        }),
      };
      onSubmit(reason, finalAmendedData);
    } else {
      onSubmit(reason);
    }
  };

  const addReceipt = () => {
    setReceipts([...receipts, { amount: 0, accountId: null, currentImagePath: null, newImageFile: null, imagePreview: null }]);
  };

  const removeReceipt = (index: number) => {
    if (receipts.length > 1) {
      setReceipts(receipts.filter((_, i) => i !== index));
    }
  };

  const updateReceipt = (index: number, field: keyof ReceiptEntry, value: number | null | File | string) => {
    const updated = [...receipts];
    if (field === 'newImageFile' && value instanceof File) {
      // Create preview for new image
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setReceipts(prev => {
          const newReceipts = [...prev];
          newReceipts[index] = { ...newReceipts[index], newImageFile: value, imagePreview: preview };
          return newReceipts;
        });
      };
      reader.readAsDataURL(value);
    } else {
      updated[index] = { ...updated[index], [field]: value };
      setReceipts(updated);
    }
  };

  const removeReceiptImage = (index: number) => {
    const updated = [...receipts];
    updated[index] = { ...updated[index], newImageFile: null, imagePreview: null, currentImagePath: null };
    setReceipts(updated);
  };

  const addPayment = () => {
    setPayments([...payments, { amount: 0, accountId: null, currentImagePath: null, newImageFile: null, imagePreview: null }]);
  };

  const removePayment = (index: number) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index));
    }
  };

  const updatePayment = (index: number, field: keyof PaymentEntry, value: number | null | File | string) => {
    const updated = [...payments];
    if (field === 'newImageFile' && value instanceof File) {
      // Create preview for new image
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setPayments(prev => {
          const newPayments = [...prev];
          newPayments[index] = { ...newPayments[index], newImageFile: value, imagePreview: preview };
          return newPayments;
        });
      };
      reader.readAsDataURL(value);
    } else {
      updated[index] = { ...updated[index], [field]: value };
      setPayments(updated);
    }
  };

  const removePaymentImage = (index: number) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], newImageFile: null, imagePreview: null, currentImagePath: null };
    setPayments(updated);
  };

  // Filter accounts by currency
  const receiptAccounts = accounts.filter((a) => a.currencyCode === order.fromCurrency);
  const paymentAccounts = accounts.filter((a) => a.currencyCode === order.toCurrency);

  const title = requestType === "delete" 
    ? t("orders.requestDelete") || "Request Delete Order"
    : t("orders.requestEdit") || "Request Edit Order";

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      style={{ margin: 0, padding: 0 }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={t("common.close")}
            disabled={isSubmitting}
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

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              {t("orders.orderInfo") || "Order Information"}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-600">{t("orders.orderId") || "Order ID"}:</span>{" "}
                <span className="font-medium">#{order.id}</span>
              </div>
              <div>
                <span className="text-slate-600">{t("orders.status") || "Status"}:</span>{" "}
                <span className="font-medium">{order.status}</span>
              </div>
              <div>
                <span className="text-slate-600">{t("orders.customer") || "Customer"}:</span>{" "}
                <span className="font-medium">{order.customerName || order.customerId}</span>
              </div>
              <div>
                <span className="text-slate-600">{t("orders.currencyPair") || "Currency Pair"}:</span>{" "}
                <span className="font-medium">
                  {order.fromCurrency} / {order.toCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Form - Show editable fields for edit requests */}
          {requestType === "edit" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">
                {t("orders.amendedOrderData") || "Amended Order Data"}
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                {t("orders.editRequestNote") || "Modify the fields below. These changes will be applied after approval."}
              </p>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("orders.amountBuy") || "Amount Buy"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={amendedData.amountBuy ?? order.amountBuy}
                    onChange={(e) =>
                      setAmendedData({ ...amendedData, amountBuy: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("orders.amountSell") || "Amount Sell"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={amendedData.amountSell ?? order.amountSell}
                    onChange={(e) =>
                      setAmendedData({ ...amendedData, amountSell: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("orders.rate") || "Rate"}
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={amendedData.rate ?? order.rate}
                    onChange={(e) =>
                      setAmendedData({ ...amendedData, rate: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("orders.remarks") || "Remarks"}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={amendedData.remarks ?? order.remarks ?? ""}
                    onChange={(e) =>
                      setAmendedData({ ...amendedData, remarks: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Receipts Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
                    {t("orders.receipts") || "Receipts"} ({order.fromCurrency})
                  </h4>
                  <button
                    type="button"
                    onClick={addReceipt}
                    className="text-xs px-2 py-1 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + {t("orders.addReceipt") || "Add Receipt"}
                  </button>
                </div>
                <div className="space-y-4">
                  {receipts.map((receipt, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t("orders.amount") || "Amount"}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={receipt.amount || ""}
                            onChange={(e) =>
                              updateReceipt(index, "amount", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t("orders.account") || "Account"}
                          </label>
                          <div className="flex gap-2">
                            <select
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={receipt.accountId ?? ""}
                              onChange={(e) =>
                                updateReceipt(index, "accountId", e.target.value ? Number(e.target.value) : null)
                              }
                            >
                              <option value="">{t("orders.selectAccount") || "Select Account"}</option>
                              {receiptAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                                </option>
                              ))}
                            </select>
                            {receipts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeReceipt(index)}
                                className="px-2 py-2 text-red-600 hover:text-red-700"
                                aria-label={t("common.remove") || "Remove"}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Image Upload Section - Only show for online orders, not OTC */}
                      {!isOtcOrder && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t("orders.image") || "Image"}
                          </label>
                          {(receipt.currentImagePath || receipt.imagePreview) ? (
                            <div className="relative">
                              <img
                                src={receipt.imagePreview || receipt.currentImagePath || ""}
                                alt="Receipt"
                                className="w-full h-48 object-contain border border-slate-300 rounded-lg mb-2"
                              />
                              <button
                                type="button"
                                onClick={() => removeReceiptImage(index)}
                                className="absolute top-2 right-2 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                {t("common.remove") || "Remove"}
                              </button>
                            </div>
                          ) : null}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                updateReceipt(index, "newImageFile", file);
                              }
                            }}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            {t("orders.imageUploadHelp") || "Upload a new image to replace the current one"}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Receipts Total */}
                {receipts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {t("orders.totalReceipts") || "Total Receipts"}:
                      </span>
                      <span className={`font-semibold ${Math.abs(totalReceipts - newAmountBuy) > 0.01 ? 'text-red-600' : 'text-slate-900'}`}>
                        {totalReceipts.toFixed(2)} {order.fromCurrency}
                        {Math.abs(totalReceipts - newAmountBuy) > 0.01 && (
                          <span className="text-xs text-red-600 ml-1">
                            ({t("orders.expected") || "Expected"}: {newAmountBuy.toFixed(2)})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payments Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
                    {t("orders.payments") || "Payments"} ({order.toCurrency})
                  </h4>
                  <button
                    type="button"
                    onClick={addPayment}
                    className="text-xs px-2 py-1 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + {t("orders.addPayment") || "Add Payment"}
                  </button>
                </div>
                <div className="space-y-4">
                  {payments.map((payment, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t("orders.amount") || "Amount"}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={payment.amount || ""}
                            onChange={(e) =>
                              updatePayment(index, "amount", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t("orders.account") || "Account"}
                          </label>
                          <div className="flex gap-2">
                            <select
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={payment.accountId ?? ""}
                              onChange={(e) =>
                                updatePayment(index, "accountId", e.target.value ? Number(e.target.value) : null)
                              }
                            >
                              <option value="">{t("orders.selectAccount") || "Select Account"}</option>
                              {paymentAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                                </option>
                              ))}
                            </select>
                            {payments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePayment(index)}
                                className="px-2 py-2 text-red-600 hover:text-red-700"
                                aria-label={t("common.remove") || "Remove"}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Image Upload Section - Only show for online orders, not OTC */}
                      {!isOtcOrder && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t("orders.image") || "Image"}
                          </label>
                          {(payment.currentImagePath || payment.imagePreview) ? (
                            <div className="relative">
                              <img
                                src={payment.imagePreview || payment.currentImagePath || ""}
                                alt="Payment"
                                className="w-full h-48 object-contain border border-slate-300 rounded-lg mb-2"
                              />
                              <button
                                type="button"
                                onClick={() => removePaymentImage(index)}
                                className="absolute top-2 right-2 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                {t("common.remove") || "Remove"}
                              </button>
                            </div>
                          ) : null}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                updatePayment(index, "newImageFile", file);
                              }
                            }}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            {t("orders.imageUploadHelp") || "Upload a new image to replace the current one"}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Payments Total */}
                {payments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {t("orders.totalPayments") || "Total Payments"}:
                      </span>
                      <span className={`font-semibold ${Math.abs(totalPayments - newAmountSell) > 0.01 ? 'text-red-600' : 'text-slate-900'}`}>
                        {totalPayments.toFixed(2)} {order.toCurrency}
                        {Math.abs(totalPayments - newAmountSell) > 0.01 && (
                          <span className="text-xs text-red-600 ml-1">
                            ({t("orders.expected") || "Expected"}: {newAmountSell.toFixed(2)})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Profit Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
                    {t("orders.profit") || "Profit"}
                  </h4>
                  {(amendedData.profitAmount || order.profitAmount) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmendedData({
                          ...amendedData,
                          profitAmount: null,
                          profitCurrency: null,
                          profitAccountId: null,
                        });
                      }}
                      className="text-xs px-2 py-1 text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {t("orders.clearProfit") || "Clear Profit"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t("orders.profitAmount") || "Profit Amount"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={amendedData.profitAmount !== undefined ? (amendedData.profitAmount ?? "") : (order.profitAmount ?? "")}
                      onChange={(e) =>
                        setAmendedData({ 
                          ...amendedData, 
                          profitAmount: e.target.value ? parseFloat(e.target.value) : null 
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t("orders.profitCurrency") || "Profit Currency"}
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={amendedData.profitCurrency !== undefined ? (amendedData.profitCurrency ?? "") : (order.profitCurrency ?? "")}
                      onChange={(e) => {
                        const newCurrency: string | null = e.target.value || null;
                        setAmendedData({ 
                          ...amendedData, 
                          profitCurrency: newCurrency,
                          // Clear account if currency changes and account doesn't match new currency
                          profitAccountId: newCurrency && amendedData.profitAccountId 
                            ? (accounts.find(a => a.id === amendedData.profitAccountId && a.currencyCode === newCurrency) 
                                ? amendedData.profitAccountId 
                                : null)
                            : null
                        });
                      }}
                    >
                      <option value="">{t("orders.selectCurrency") || "Select Currency"}</option>
                      {currencies
                        .filter((c) => c.active && (c.code === order.fromCurrency || c.code === order.toCurrency))
                        .map((curr) => (
                          <option key={curr.id} value={curr.code}>
                            {curr.code}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t("orders.profitAccount") || "Profit Account"}
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={amendedData.profitAccountId !== undefined ? (amendedData.profitAccountId ?? "") : (order.profitAccountId ?? "")}
                      onChange={(e) =>
                        setAmendedData({ 
                          ...amendedData, 
                          profitAccountId: e.target.value ? Number(e.target.value) : null 
                        })
                      }
                    >
                      <option value="">{t("orders.selectAccount") || "Select Account"}</option>
                      {accounts
                        .filter((a) => {
                          const profitCurrency = amendedData.profitCurrency ?? order.profitCurrency;
                          return profitCurrency ? a.currencyCode === profitCurrency : true;
                        })
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Service Charge Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
                    {t("orders.serviceCharges") || "Service Charges"}
                  </h4>
                  {(amendedData.serviceChargeAmount || order.serviceChargeAmount) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmendedData({
                          ...amendedData,
                          serviceChargeAmount: null,
                          serviceChargeCurrency: null,
                          serviceChargeAccountId: null,
                        });
                      }}
                      className="text-xs px-2 py-1 text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {t("orders.clearServiceCharge") || "Clear Service Charge"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t("orders.serviceChargeAmount") || "Service Charge Amount"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={amendedData.serviceChargeAmount !== undefined ? (amendedData.serviceChargeAmount ?? "") : (order.serviceChargeAmount ?? "")}
                      onChange={(e) =>
                        setAmendedData({ 
                          ...amendedData, 
                          serviceChargeAmount: e.target.value ? parseFloat(e.target.value) : null 
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t("orders.serviceChargeCurrency") || "Service Charge Currency"}
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={amendedData.serviceChargeCurrency !== undefined ? (amendedData.serviceChargeCurrency ?? "") : (order.serviceChargeCurrency ?? "")}
                      onChange={(e) => {
                        const newCurrency: string | null = e.target.value || null;
                        setAmendedData({ 
                          ...amendedData, 
                          serviceChargeCurrency: newCurrency,
                          // Clear account if currency changes and account doesn't match new currency
                          serviceChargeAccountId: newCurrency && amendedData.serviceChargeAccountId 
                            ? (accounts.find(a => a.id === amendedData.serviceChargeAccountId && a.currencyCode === newCurrency) 
                                ? amendedData.serviceChargeAccountId 
                                : null)
                            : null
                        });
                      }}
                    >
                      <option value="">{t("orders.selectCurrency") || "Select Currency"}</option>
                      {currencies
                        .filter((c) => c.active && (c.code === order.fromCurrency || c.code === order.toCurrency))
                        .map((curr) => (
                          <option key={curr.id} value={curr.code}>
                            {curr.code}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t("orders.serviceChargeAccount") || "Service Charge Account"}
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={amendedData.serviceChargeAccountId !== undefined ? (amendedData.serviceChargeAccountId ?? "") : (order.serviceChargeAccountId ?? "")}
                      onChange={(e) =>
                        setAmendedData({ 
                          ...amendedData, 
                          serviceChargeAccountId: e.target.value ? Number(e.target.value) : null 
                        })
                      }
                    >
                      <option value="">{t("orders.selectAccount") || "Select Account"}</option>
                      {accounts
                        .filter((a) => {
                          const serviceChargeCurrency = amendedData.serviceChargeCurrency ?? order.serviceChargeCurrency;
                          return serviceChargeCurrency ? a.currencyCode === serviceChargeCurrency : true;
                        })
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reason Field - Required */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("orders.reason") || "Reason"} <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t("orders.reasonPlaceholder") || "Please provide a reason for this request..."}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              {t("orders.reasonHelp") || "This reason will be visible to approvers."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting
                ? t("common.submitting") || "Submitting..."
                : t("orders.submitRequest") || "Submit Request"}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}
