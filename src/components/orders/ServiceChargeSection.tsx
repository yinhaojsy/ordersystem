import React from "react";
import type { Account, Order } from "../../types";

interface ServiceChargeSectionProps {
  serviceChargeAmount: string;
  setServiceChargeAmount: (value: string) => void;
  serviceChargeCurrency: string;
  setServiceChargeCurrency: (value: string) => void;
  serviceChargeAccountId: string;
  setServiceChargeAccountId: (value: string) => void;
  showServiceChargeSection: boolean;
  setShowServiceChargeSection: (show: boolean) => void;
  onSave: () => Promise<void>;
  onRemove?: () => Promise<void>;
  order: Order | null | undefined;
  accounts: Account[];
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  t: (key: string) => string | undefined;
}

export const ServiceChargeSection: React.FC<ServiceChargeSectionProps> = ({
  serviceChargeAmount,
  setServiceChargeAmount,
  serviceChargeCurrency,
  setServiceChargeCurrency,
  serviceChargeAccountId,
  setServiceChargeAccountId,
  showServiceChargeSection,
  setShowServiceChargeSection,
  onSave,
  onRemove,
  order,
  accounts,
  handleNumberInputWheel,
  t,
}) => {
  if (!showServiceChargeSection) return null;

  const handleRemoveClick = async () => {
    if (onRemove) {
      await onRemove();
    } else {
      // Fallback: just close the form
      setShowServiceChargeSection(false);
      setServiceChargeAmount("");
      setServiceChargeCurrency("");
      setServiceChargeAccountId("");
    }
  };

  return (
    <div className="p-4 border border-green-200 rounded-lg bg-green-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-green-900">
          {t("orders.serviceCharges")}
        </h3>
        <button
          type="button"
          onClick={handleRemoveClick}
          className="text-green-600 hover:text-green-800 text-sm"
        >
          {t("common.remove")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-green-900 mb-1">
            {t("orders.serviceChargeAmount")}
          </label>
          <input
            type="number"
            step="0.01"
            value={serviceChargeAmount}
            onChange={(e) => setServiceChargeAmount(e.target.value)}
            onWheel={handleNumberInputWheel}
            className="w-full rounded-lg border border-green-300 px-3 py-2"
            placeholder={t("orders.amountNegativeIfPaidByUs")}
          />
          <p className="text-xs text-green-700 mt-1">
            {t("orders.negativeForPaidByUs")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-green-900 mb-1">
            {t("orders.serviceChargeCurrency")}
          </label>
          <select
            value={serviceChargeCurrency}
            onChange={(e) => {
              setServiceChargeCurrency(e.target.value);
              setServiceChargeAccountId(""); // Reset account when currency changes
            }}
            className="w-full rounded-lg border border-green-300 px-3 py-2"
          >
            <option value="">
              {t("orders.selectCurrency")}
            </option>
            {order && (
              <>
                <option value={order.fromCurrency}>
                  {order.fromCurrency}
                </option>
                <option value={order.toCurrency}>
                  {order.toCurrency}
                </option>
              </>
            )}
          </select>
        </div>
      </div>
      {serviceChargeCurrency && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-green-900 mb-1">
            {t("orders.selectAccount")} ({serviceChargeCurrency})
          </label>
          <select
            value={serviceChargeAccountId}
            onChange={(e) => setServiceChargeAccountId(e.target.value)}
            className="w-full rounded-lg border border-green-300 px-3 py-2"
            required
          >
            <option value="">
              {t("orders.selectAccount")}
            </option>
            {accounts
              .filter((acc) => acc.currencyCode === serviceChargeCurrency)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                </option>
              ))}
          </select>
        </div>
      )}
      <button
        type="button"
        onClick={onSave}
        className="mt-3 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
      >
        {t("common.save")}
      </button>
    </div>
  );
};

