import React from "react";

interface FlexOrderRatePanelProps {
  flexOrderRate: string | null;
  setFlexOrderRate: (rate: string | null) => void;
  orderDetails: {
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
  };
  resolvedFlexRate: number;
  calculateAmountSell: (amountBuy: number, rate: number, fromCurrency: string, toCurrency: string) => number;
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  onUpdateRate: () => Promise<void>;
  t: (key: string) => string | undefined;
}

export const FlexOrderRatePanel: React.FC<FlexOrderRatePanelProps> = ({
  flexOrderRate,
  setFlexOrderRate,
  orderDetails,
  resolvedFlexRate,
  calculateAmountSell,
  handleNumberInputWheel,
  onUpdateRate,
  t,
}) => {
  return (
    <div className="lg:col-span-1">
      <div className="sticky top-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <p className="text-sm font-semibold text-purple-900 mb-2">
          Flex Order - Adjust Exchange Rate
        </p>
        <div className="grid grid-cols-1 gap-4 mb-2">
          <div className="text-sm text-purple-700">
            <span className="font-medium">Expected To Receive:</span>{" "}
            {orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy}{" "}
            {orderDetails.order.fromCurrency}
          </div>
          <div className="text-sm text-purple-700 flex items-center gap-2">
            <span className="font-medium">Exchange Rate:</span>
            <input
              type="number"
              step="0.01"
              value={flexOrderRate ?? String(orderDetails.order.actualRate ?? orderDetails.order.rate ?? "")}
              onChange={(e) => setFlexOrderRate(e.target.value)}
              onWheel={handleNumberInputWheel}
              className="w-24 rounded border border-purple-300 px-2 py-1"
              placeholder={String(orderDetails.order.actualRate || orderDetails.order.rate)}
              disabled={orderDetails.order.status === "completed" || orderDetails.order.status === "cancelled"}
            />
            {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
              <button
                type="button"
                onClick={onUpdateRate}
                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                {t("orders.updateRate")}
              </button>
            )}
          </div>
        </div>
        <div className="text-sm text-purple-800 font-medium mb-4">
          {t("orders.expectedToPay")}:{" "}
          {calculateAmountSell(
            orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy,
            resolvedFlexRate,
            orderDetails.order.fromCurrency,
            orderDetails.order.toCurrency
          ).toFixed(2)}{" "}
          {orderDetails.order.toCurrency}
        </div>
        <div className="mt-4 pt-4 border-t border-purple-300">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-purple-700 font-medium">{t("orders.amountBuy")}:</span>
              <span className="text-purple-900 font-semibold">
                {orderDetails.order.amountBuy}
              </span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Expected Amount Receipt:</span>
              <span className="text-purple-800 text-xs">
                {orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy}
              </span>
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
            <div className="flex justify-between mt-3 pt-3 border-t border-purple-200">
              <span className="text-purple-700 font-medium">{t("orders.amountSell")}:</span>
              <span className="text-purple-900 font-semibold">
                -{orderDetails.order.amountSell}
              </span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-purple-600 text-xs">Expected Payment Amount:</span>
              <span className="text-purple-800 text-xs">
                {calculateAmountSell(
                  orderDetails.totalReceiptAmount,
                  resolvedFlexRate,
                  orderDetails.order.fromCurrency,
                  orderDetails.order.toCurrency
                ).toFixed(2)}
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

