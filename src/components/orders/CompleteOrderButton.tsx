import React from "react";
import { calculateAmountSell as calculateAmountSellUtil } from "../../utils/orders/orderCalculations";
import type { Currency, AuthResponse } from "../../types";
import { canPerformOrderActions } from "../../utils/orderPermissions";

interface OrderDetails {
  order: {
    isFlexOrder?: boolean;
    amountBuy: number;
    actualAmountBuy?: number;
    amountSell: number;
    actualAmountSell?: number;
    rate: number;
    actualRate?: number;
    fromCurrency: string;
    toCurrency: string;
    status: string;
  };
  totalReceiptAmount: number;
  totalPaymentAmount: number;
}

interface CompleteOrderButtonProps {
  orderId: number | null;
  orderDetails: OrderDetails;
  currencies: Currency[];
  flexOrderRate: string | null;
  updateOrderStatus: (payload: { id: number; status: "completed" }) => { unwrap: () => Promise<any> };
  calculateAmountSell: (amountBuy: number, rate: number, fromCurrency: string, toCurrency: string) => number;
  resolveFlexOrderRate?: (details?: any) => number;
  setMissingPaymentModalData?: (data: {
    expectedPayment: number;
    actualPayment: number;
    missing: number;
    toCurrency: string;
  }) => void;
  setShowMissingPaymentModal?: (show: boolean) => void;
  setExcessPaymentModalData?: (data: {
    expectedPayment: number;
    actualPayment: number;
    excess: number;
    additionalReceipts: number;
    fromCurrency: string;
    toCurrency: string;
  }) => void;
  setShowExcessPaymentModal?: (show: boolean) => void;
  authUser?: AuthResponse | null;
  layout?: "grid" | "vertical";
  t: (key: string) => string | undefined;
}

const CompleteOrderButtonComponent: React.FC<CompleteOrderButtonProps> = ({
  orderId,
  orderDetails,
  currencies,
  flexOrderRate,
  updateOrderStatus,
  calculateAmountSell,
  resolveFlexOrderRate,
  setMissingPaymentModalData,
  setShowMissingPaymentModal,
  setExcessPaymentModalData,
  setShowExcessPaymentModal,
  authUser,
  layout = "vertical",
  t,
}) => {
  const isFlexOrder = orderDetails.order.isFlexOrder ?? false;
  const isDisabled = orderDetails.order.status === "completed" || orderDetails.order.status === "cancelled";
  const canPerformActions = canPerformOrderActions(orderDetails.order as any, authUser || null);

  if (isDisabled || !canPerformActions) return null;

  const handleCompleteOrder = async () => {
    if (!orderId) return;

    const currentOrderDetails = orderDetails;
    if (!currentOrderDetails) return;

    // Validate that receipts have been uploaded
    if (currentOrderDetails.totalReceiptAmount <= 0) {
      alert(t("orders.pleaseUploadReceipts") || "Please upload at least one receipt before completing the order.");
      return;
    }

    // Validate that payments have been uploaded
    if (currentOrderDetails.totalPaymentAmount <= 0) {
      alert(t("orders.pleaseUploadPayments") || "Please upload at least one payment before completing the order.");
      return;
    }

    // Get effective rate and amount buy based on order type
    let effectiveRate: number;
    let actualAmountBuy: number;
    let expectedPaymentAmount: number;

    if (isFlexOrder) {
      // For flex orders, use resolveFlexOrderRate if provided, otherwise use actualRate or rate
      effectiveRate = resolveFlexOrderRate
        ? resolveFlexOrderRate(currentOrderDetails)
        : currentOrderDetails.order.actualRate ?? currentOrderDetails.order.rate ?? 0;

      // For flex orders, use totalReceiptAmount (actual receipts) to calculate expected payment
      actualAmountBuy = currentOrderDetails.totalReceiptAmount || currentOrderDetails.order.actualAmountBuy || 0;

      // Use the same calculation logic as the view window
      expectedPaymentAmount = calculateAmountSell(
        actualAmountBuy,
        effectiveRate,
        currentOrderDetails.order.fromCurrency,
        currentOrderDetails.order.toCurrency
      );
    } else {
      // For regular orders, use the order's rate and amountBuy
      effectiveRate = currentOrderDetails.order.rate;
      actualAmountBuy = currentOrderDetails.order.amountBuy;

      // Validate receipt amount matches expected
      const actualReceiptAmount = currentOrderDetails.totalReceiptAmount;
      const receiptDifference = Math.abs(actualReceiptAmount - actualAmountBuy);
      if (receiptDifference > 0.50) {
        const missing = actualAmountBuy - actualReceiptAmount;
        if (missing > 0) {
          alert(
            `Please upload receipts for the remaining amount: ${missing.toFixed(2)} ${currentOrderDetails.order.fromCurrency}`
          );
          return;
        }
      }

      expectedPaymentAmount = calculateAmountSell(
        actualAmountBuy,
        effectiveRate,
        currentOrderDetails.order.fromCurrency,
        currentOrderDetails.order.toCurrency
      );
    }

    const actualPaymentAmount = currentOrderDetails.totalPaymentAmount;

    // Allow small rounding difference (0.50) to account for floating-point precision
    const difference = Math.abs(actualPaymentAmount - expectedPaymentAmount);

    if (difference > 0.50) {
      const missing = expectedPaymentAmount - actualPaymentAmount;
      if (missing > 0) {
        // Missing payment
        if (isFlexOrder && setMissingPaymentModalData && setShowMissingPaymentModal) {
          // Show modal for flex orders
          console.log("Showing missing payment modal:", {
            expectedPayment: expectedPaymentAmount,
            actualPayment: actualPaymentAmount,
            missing: missing,
          });
          setMissingPaymentModalData({
            expectedPayment: expectedPaymentAmount,
            actualPayment: actualPaymentAmount,
            missing: missing,
            toCurrency: currentOrderDetails.order.toCurrency,
          });
          setShowMissingPaymentModal(true);
        } else {
          // Show alert for regular orders
          alert(
            `Please upload payments for the remaining amount: ${missing.toFixed(2)} ${currentOrderDetails.order.toCurrency}`
          );
        }
        return;
      } else {
        // Excess payment - user must upload additional receipts
        const excess = actualPaymentAmount - expectedPaymentAmount;

        // Calculate additional receipts needed: excess amount converted back to fromCurrency
        const getCurrencyRate = (code: string) => {
          const currency = currencies.find((c) => c.code === code);
          const candidate =
            currency?.conversionRateBuy ??
            currency?.baseRateBuy ??
            currency?.baseRateSell ??
            currency?.conversionRateSell;
          return typeof candidate === "number" ? candidate : null;
        };

        const fromRate = getCurrencyRate(currentOrderDetails.order.fromCurrency);
        const toRate = getCurrencyRate(currentOrderDetails.order.toCurrency);
        const inferredFromIsUSDT =
          fromRate !== null ? fromRate <= 1 : currentOrderDetails.order.fromCurrency === "USDT";
        const inferredToIsUSDT =
          toRate !== null ? toRate <= 1 : currentOrderDetails.order.toCurrency === "USDT";

        let baseIsFrom: boolean;
        if (inferredFromIsUSDT !== inferredToIsUSDT) {
          baseIsFrom = inferredFromIsUSDT;
        } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
          baseIsFrom = fromRate < toRate;
        } else {
          baseIsFrom = true; // default
        }

        const additionalReceipts = baseIsFrom ? excess / effectiveRate : excess * effectiveRate;

        if (isFlexOrder && setExcessPaymentModalData && setShowExcessPaymentModal) {
          // Show modal for flex orders
          setExcessPaymentModalData({
            expectedPayment: expectedPaymentAmount,
            actualPayment: actualPaymentAmount,
            excess: excess,
            additionalReceipts: additionalReceipts,
            fromCurrency: currentOrderDetails.order.fromCurrency,
            toCurrency: currentOrderDetails.order.toCurrency,
          });
          setShowExcessPaymentModal(true);
        } else {
          // Show alert for regular orders
          alert(
            `Payment exceeds expected amount. Please upload additional receipts: ${additionalReceipts.toFixed(2)} ${currentOrderDetails.order.fromCurrency}`
          );
        }
        return; // Do not allow completion until receipts are uploaded
      }
    }

    // All validations passed - confirm and complete
    const confirmMessage = isFlexOrder
      ? "Are you sure you want to complete this flex order?"
      : "Are you sure you want to complete this order?";

    if (window.confirm(confirmMessage)) {
      await updateOrderStatus({
        id: orderId,
        status: "completed",
      }).unwrap();
    }
  };

  const containerClassName = layout === "grid" ? "lg:col-span-2 mt-6" : "mt-6";

  return (
    <div className={`${containerClassName} p-4 bg-emerald-50 border border-emerald-200 rounded-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-900 mb-1">Ready to Complete Order</p>
          <p className="text-xs text-emerald-700">
            Total Receipts: {orderDetails.totalReceiptAmount.toFixed(2)} {orderDetails.order.fromCurrency} | Total
            Payments: {orderDetails.totalPaymentAmount.toFixed(2)} {orderDetails.order.toCurrency}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCompleteOrder}
          className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Complete Order
        </button>
      </div>
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders when props haven't changed
export const CompleteOrderButton = React.memo(CompleteOrderButtonComponent);

