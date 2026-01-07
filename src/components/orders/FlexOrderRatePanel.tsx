import React, { useMemo, useCallback } from "react";
import { calculateAmountSell as calculateAmountSellUtil } from "../../utils/orders/orderCalculations";
import type { Currency } from "../../types";

interface OrderDetails {
  order: {
    isFlexOrder?: boolean;
    actualAmountBuy?: number;
    amountBuy: number;
    fromCurrency: string;
    toCurrency: string;
    actualRate?: number;
    rate: number;
    amountSell: number;
    status: string;
  };
  totalReceiptAmount: number;
  receiptBalance: number;
  totalPaymentAmount: number;
  paymentBalance: number;
}

interface FlexOrderRatePanelProps {
  orderId: number | null;
  flexOrderRate: string | null;
  setFlexOrderRate: (rate: string | null) => void;
  orderDetails: OrderDetails;
  currencies: Currency[];
  adjustFlexOrderRate: (payload: { id: number; rate: number }) => { unwrap: () => Promise<any> };
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  t: (key: string) => string | undefined;
}

export const FlexOrderRatePanel: React.FC<FlexOrderRatePanelProps> = ({
  orderId,
  flexOrderRate,
  setFlexOrderRate,
  orderDetails,
  currencies,
  adjustFlexOrderRate,
  handleNumberInputWheel,
  t,
}) => {
  // Resolve the effective rate to use for calculations
  const resolvedFlexRate = useMemo(() => {
    const fallbackRate = orderDetails.order.actualRate ?? orderDetails.order.rate ?? 0;
    const parsedRate =
      flexOrderRate === ""
        ? 0
        : flexOrderRate !== null
          ? Number(flexOrderRate)
          : Number(fallbackRate);

    if (!Number.isFinite(parsedRate)) {
      return 0;
    }

    return parsedRate;
  }, [flexOrderRate, orderDetails.order.actualRate, orderDetails.order.rate]);

  // Calculate amount sell using the utility function
  const calculateAmountSell = useCallback(
    (amountBuy: number, rate: number, fromCurrency: string, toCurrency: string): number => {
      return calculateAmountSellUtil(amountBuy, rate, fromCurrency, toCurrency, currencies);
    },
    [currencies]
  );

  // Calculate expected payment amount
  const expectedPaymentAmount = useMemo(() => {
    const amountBuy = orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy;
    return calculateAmountSell(
      amountBuy,
      resolvedFlexRate,
      orderDetails.order.fromCurrency,
      orderDetails.order.toCurrency
    );
  }, [
    orderDetails.order.actualAmountBuy,
    orderDetails.order.amountBuy,
    orderDetails.order.fromCurrency,
    orderDetails.order.toCurrency,
    resolvedFlexRate,
    calculateAmountSell,
  ]);

  // Calculate expected payment from actual receipts
  const expectedPaymentFromReceipts = useMemo(() => {
    return calculateAmountSell(
      orderDetails.totalReceiptAmount,
      resolvedFlexRate,
      orderDetails.order.fromCurrency,
      orderDetails.order.toCurrency
    );
  }, [
    orderDetails.totalReceiptAmount,
    orderDetails.order.fromCurrency,
    orderDetails.order.toCurrency,
    resolvedFlexRate,
    calculateAmountSell,
  ]);

  // Handle rate update
  const handleUpdateRate = useCallback(async () => {
    if (!orderId) return;

    const rateToUse =
      flexOrderRate ??
      String(orderDetails.order.actualRate ?? orderDetails.order.rate ?? "");

    if (!rateToUse) {
      alert(t("orders.pleaseEnterExchangeRate"));
      return;
    }

    const rateValue = Number(rateToUse);
    if (isNaN(rateValue) || rateValue <= 0) {
      alert(t("orders.pleaseEnterValidExchangeRate"));
      return;
    }

    try {
      await adjustFlexOrderRate({
        id: orderId,
        rate: rateValue,
      }).unwrap();
      alert(t("orders.exchangeRateUpdatedSuccessfully"));
    } catch (error) {
      console.error("Error updating exchange rate:", error);
      alert(t("orders.failedToUpdateExchangeRate"));
    }
  }, [orderId, flexOrderRate, orderDetails.order.actualRate, orderDetails.order.rate, adjustFlexOrderRate, t]);

  const isDisabled = orderDetails.order.status === "completed" || orderDetails.order.status === "cancelled";
  const currentRateValue = flexOrderRate ?? String(orderDetails.order.actualRate ?? orderDetails.order.rate ?? "");
  const expectedAmountBuy = orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy;

  return (
    <div className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start lg:h-fit">
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <p className="text-sm font-semibold text-purple-900 mb-2">
          Flex Order - Adjust Exchange Rate
        </p>

        {/* Expected Amount and Rate Input */}
        <div className="grid grid-cols-1 gap-4 mb-2">
          <div className="text-sm text-purple-700">
            <span className="font-medium">Expected To Receive:</span>{" "}
            {expectedAmountBuy} {orderDetails.order.fromCurrency}
          </div>
          <div className="text-sm text-purple-700 flex items-center gap-2">
            <span className="font-medium">Exchange Rate:</span>
            <input
              type="number"
              step="0.01"
              value={currentRateValue}
              onChange={(e) => setFlexOrderRate(e.target.value)}
              onWheel={handleNumberInputWheel}
              className="w-24 rounded border border-purple-300 px-2 py-1"
              placeholder={String(orderDetails.order.actualRate || orderDetails.order.rate)}
              disabled={isDisabled}
            />
            {!isDisabled && (
              <button
                type="button"
                onClick={handleUpdateRate}
                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                {t("orders.updateRate")}
              </button>
            )}
          </div>
        </div>

        {/* Expected Payment */}
        <div className="text-sm text-purple-800 font-medium mb-4">
          {t("orders.expectedToPay")}: {expectedPaymentAmount.toFixed(2)} {orderDetails.order.toCurrency}
        </div>

        {/* Summary Section */}
        <div className="mt-4 pt-4 border-t border-purple-300">
          <div className="space-y-2 text-sm">
            {/* Receipt Section */}
            <div className="flex justify-between">
              <span className="text-purple-700 font-medium">{t("orders.amountBuy")}:</span>
              <span className="text-purple-900 font-semibold">{orderDetails.order.amountBuy}</span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Expected Amount Receipt:</span>
              <span className="text-purple-800 text-xs">{expectedAmountBuy}</span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Actual Amount Receipt:</span>
              <span className="text-purple-800 text-xs">
                {orderDetails.totalReceiptAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Balance Amount:</span>
              <span className="text-purple-800 text-xs">
                {orderDetails.receiptBalance.toFixed(2)}
              </span>
            </div>

            {/* Payment Section */}
            <div className="flex justify-between mt-3 pt-3 border-t border-purple-200">
              <span className="text-purple-700 font-medium">{t("orders.amountSell")}:</span>
              <span className="text-purple-900 font-semibold">-{orderDetails.order.amountSell}</span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Expected Payment Amount:</span>
              <span className="text-purple-800 text-xs">
                {expectedPaymentFromReceipts.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Actual Payment Amount:</span>
              <span className="text-purple-800 text-xs">
                {orderDetails.totalPaymentAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Payment Balance:</span>
              <span className="text-purple-800 text-xs">
                {orderDetails.paymentBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
