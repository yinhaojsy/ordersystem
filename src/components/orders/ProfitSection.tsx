import React from "react";
import type { Account, Order } from "../../types";

interface ProfitSectionProps {
  profitAmount: string;
  setProfitAmount: (value: string) => void;
  profitCurrency: string;
  setProfitCurrency: (value: string) => void;
  profitAccountId: string;
  setProfitAccountId: (value: string) => void;
  showProfitSection: boolean;
  setShowProfitSection: (show: boolean) => void;
  onSave: () => Promise<void>;
  order: Order | null | undefined;
  accounts: Account[];
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  t: (key: string) => string | undefined;
}

export const ProfitSection: React.FC<ProfitSectionProps> = ({
  profitAmount,
  setProfitAmount,
  profitCurrency,
  setProfitCurrency,
  profitAccountId,
  setProfitAccountId,
  showProfitSection,
  setShowProfitSection,
  onSave,
  order,
  accounts,
  handleNumberInputWheel,
  t,
}) => {
  if (!showProfitSection) return null;

  return (
    <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-blue-900">
          {t("orders.profit")}
        </h3>
        <button
          type="button"
          onClick={() => {
            setShowProfitSection(false);
            setProfitAmount("");
            setProfitCurrency("");
            setProfitAccountId("");
          }}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {t("common.remove")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1">
            {t("orders.profitAmount")}
          </label>
          <input
            type="number"
            step="0.01"
            value={profitAmount}
            onChange={(e) => setProfitAmount(e.target.value)}
            onWheel={handleNumberInputWheel}
            className="w-full rounded-lg border border-blue-300 px-3 py-2"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1">
            {t("orders.profitCurrency")}
          </label>
          <select
            value={profitCurrency}
            onChange={(e) => {
              setProfitCurrency(e.target.value);
              setProfitAccountId(""); // Reset account when currency changes
            }}
            className="w-full rounded-lg border border-blue-300 px-3 py-2"
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
      {profitCurrency && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-blue-900 mb-1">
            {t("orders.selectAccount")} ({profitCurrency})
          </label>
          <select
            value={profitAccountId}
            onChange={(e) => setProfitAccountId(e.target.value)}
            className="w-full rounded-lg border border-blue-300 px-3 py-2"
            required
          >
            <option value="">
              {t("orders.selectAccount")}
            </option>
            {accounts
              .filter((acc) => acc.currencyCode === profitCurrency)
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
        className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        {t("common.save")}
      </button>
    </div>
  );
};

