import React, { type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { OrderStatus } from "../../types";
import { CustomerSelect } from "../common/CustomerSelect";

type Customer = { id: number; name: string };
type Currency = { id: number; code: string; active?: boolean | number };

type OrderFormState = {
  customerId: string;
  fromCurrency: string;
  toCurrency: string;
  amountBuy: string;
  amountSell: string;
  rate: string;
  status: OrderStatus;
};

type OnlineOrderModalProps = {
  isOpen: boolean;
  isFlexOrderMode: boolean;
  editingOrderId: number | null;
  isSaving: boolean;
  form: OrderFormState;
  setForm: Dispatch<SetStateAction<OrderFormState>>;
  calculatedField: "buy" | "sell" | null;
  setCalculatedField: Dispatch<SetStateAction<"buy" | "sell" | null>>;
  customers: Customer[];
  currencies: Currency[];
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  setIsCreateCustomerModalOpen: Dispatch<SetStateAction<boolean>>;
  t: (key: string) => string;
};

export default function OnlineOrderModal({
  isOpen,
  isFlexOrderMode,
  editingOrderId,
  isSaving,
  form,
  setForm,
  calculatedField,
  setCalculatedField,
  customers,
  currencies,
  handleNumberInputWheel,
  onSubmit,
  onClose,
  setIsCreateCustomerModalOpen,
  t,
}: OnlineOrderModalProps) {
  if (!isOpen) return null;

  const title = editingOrderId
    ? t("orders.editOrderTitle")
    : isFlexOrderMode
      ? t("orders.createFlexOrder")
      : t("orders.createOrderTitle");

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={t("common.close")}
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
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="col-span-full flex gap-2 items-end">
            <CustomerSelect
              value={form.customerId}
              onChange={(value) => setForm((p) => ({ ...p, customerId: value }))}
              customers={customers}
              placeholder={t("orders.selectCustomer") || "Select customer"}
              required
              t={t}
            />
            <button
              type="button"
              onClick={() => setIsCreateCustomerModalOpen(true)}
              className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              {t("orders.createNewCustomer")}
            </button>
          </div>
          <div className="col-span-full grid grid-cols-2 gap-3">
            <select
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={form.fromCurrency}
              onChange={(e) =>
                setForm((p) => ({ ...p, fromCurrency: e.target.value }))
              }
              required
            >
              <option value="">{t("orders.from")}</option>
              {currencies
                .filter((currency) => Boolean(currency.active) && currency.code !== form.toCurrency)
                .map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={form.toCurrency}
              onChange={(e) =>
                setForm((p) => ({ ...p, toCurrency: e.target.value }))
              }
              required
            >
              <option value="">{t("orders.to")}</option>
              {currencies
                .filter((currency) => Boolean(currency.active) && currency.code !== form.fromCurrency)
                .map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
            </select>
          </div>
          <input
            className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("orders.exchangeRate")}
            value={form.rate}
            onChange={(e) => {
              const value = e.target.value;
              setForm((p) => ({ ...p, rate: value }));
              if (!value) {
                setCalculatedField(null);
              }
            }}
            required
            type="number"
            step="0.0001"
            onWheel={handleNumberInputWheel}
          />
          <div className="col-span-full grid grid-cols-2 gap-3">
            <input
              className={`rounded-lg border border-slate-200 px-3 py-2 ${
                calculatedField === "sell"
                  ? "bg-slate-50 cursor-not-allowed"
                  : ""
              }`}
              placeholder={t("orders.amountBuy")}
              value={form.amountBuy}
              onChange={(e) => {
                const value = e.target.value;
                setForm((p) => ({ ...p, amountBuy: value }));
                if (value && form.rate) {
                  const rate = Number(form.rate);
                  if (!isNaN(rate) && rate > 0) {
                    const buyAmount = Number(value);
                    if (!isNaN(buyAmount) && buyAmount > 0) {
                      const sellAmount = (buyAmount * rate).toFixed(4);
                      setForm((p) => ({ ...p, amountSell: sellAmount }));
                    }
                  }
                  setCalculatedField("buy");
                } else if (!value) {
                  setCalculatedField(null);
                  setForm((p) => ({ ...p, amountSell: "" }));
                }
              }}
              readOnly={calculatedField === "sell"}
              required
              type="number"
              onWheel={handleNumberInputWheel}
            />
            <input
              className={`rounded-lg border border-slate-200 px-3 py-2 ${
                calculatedField === "buy"
                  ? "bg-slate-50 cursor-not-allowed"
                  : ""
              }`}
              placeholder={t("orders.amountSell")}
              value={form.amountSell}
              onChange={(e) => {
                const value = e.target.value;
                setForm((p) => ({ ...p, amountSell: value }));
                if (value && form.rate) {
                  const rate = Number(form.rate);
                  if (!isNaN(rate) && rate > 0) {
                    const sellAmount = Number(value);
                    if (!isNaN(sellAmount) && sellAmount > 0) {
                      const buyAmount = (sellAmount / rate).toFixed(4);
                      setForm((p) => ({ ...p, amountBuy: buyAmount }));
                    }
                  }
                  setCalculatedField("sell");
                } else if (!value) {
                  setCalculatedField(null);
                  setForm((p) => ({ ...p, amountBuy: "" }));
                }
              }}
              readOnly={calculatedField === "buy"}
              required
              type="number"
              onWheel={handleNumberInputWheel}
            />
          </div>
          <div className="col-span-full flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isSaving ? t("common.saving") : editingOrderId ? t("orders.updateOrder") : t("orders.saveOrder")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

