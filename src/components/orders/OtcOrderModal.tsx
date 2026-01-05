import React, { type Dispatch, type FormEvent, type SetStateAction } from "react";
import Badge from "../common/Badge";
import { formatDate } from "../../utils/format";
import type { Account } from "../../types";

type BasicEntity = { id: number; name: string };
type Currency = { id: number; code: string; active?: boolean | number };

export type OtcFormState = {
  customerId: string;
  fromCurrency: string;
  toCurrency: string;
  amountBuy: string;
  amountSell: string;
  rate: string;
  handlerId: string;
};

export type OtcEntry = { amount: string; accountId: string };

export type OtcOrderDetails = {
  order?: {
    customerId: number;
    handlerId?: number | null;
    fromCurrency: string;
    toCurrency: string;
    amountBuy: number;
    amountSell: number;
    rate: number;
    status: string;
    createdAt?: string;
    profitAmount?: number | null;
    profitCurrency?: string | null;
    profitAccountId?: number | null;
    serviceChargeAmount?: number | null;
    serviceChargeCurrency?: string | null;
    serviceChargeAccountId?: number | null;
  };
  receipts?: Array<{ amount: number; accountId?: number | null; accountName?: string }>;
  payments?: Array<{ amount: number; accountId?: number | null; accountName?: string }>;
};

type OtcOrderModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  isOtcCompleted: boolean;
  otcEditingOrderId: number | null;
  otcOrderDetails?: OtcOrderDetails | null;
  customers: BasicEntity[];
  users: BasicEntity[];
  currencies: Currency[];
  accounts: Account[];
  otcForm: OtcFormState;
  setOtcForm: Dispatch<SetStateAction<OtcFormState>>;
  otcReceipts: OtcEntry[];
  setOtcReceipts: Dispatch<SetStateAction<OtcEntry[]>>;
  otcPayments: OtcEntry[];
  setOtcPayments: Dispatch<SetStateAction<OtcEntry[]>>;
  showOtcProfitSection: boolean;
  setShowOtcProfitSection: Dispatch<SetStateAction<boolean>>;
  showOtcServiceChargeSection: boolean;
  setShowOtcServiceChargeSection: Dispatch<SetStateAction<boolean>>;
  otcProfitAmount: string;
  setOtcProfitAmount: Dispatch<SetStateAction<string>>;
  otcProfitCurrency: string;
  setOtcProfitCurrency: Dispatch<SetStateAction<string>>;
  otcProfitAccountId: string;
  setOtcProfitAccountId: Dispatch<SetStateAction<string>>;
  otcServiceChargeAmount: string;
  setOtcServiceChargeAmount: Dispatch<SetStateAction<string>>;
  otcServiceChargeCurrency: string;
  setOtcServiceChargeCurrency: Dispatch<SetStateAction<string>>;
  otcServiceChargeAccountId: string;
  setOtcServiceChargeAccountId: Dispatch<SetStateAction<string>>;
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  getBaseCurrency: (fromCurrency: string, toCurrency: string) => boolean | null;
  onSave: (event: FormEvent) => void;
  onComplete: (event: FormEvent) => void;
  onClose: () => void;
  setIsCreateCustomerModalOpen: Dispatch<SetStateAction<boolean>>;
  t: (key: string) => string;
};

type ViewProps = {
  accounts: Account[];
  customers: BasicEntity[];
  users: BasicEntity[];
  otcOrderDetails: OtcOrderDetails;
  onClose: () => void;
};

type FormProps = {
  accounts: Account[];
  customers: BasicEntity[];
  users: BasicEntity[];
  currencies: Currency[];
  otcForm: OtcFormState;
  setOtcForm: Dispatch<SetStateAction<OtcFormState>>;
  otcReceipts: OtcEntry[];
  setOtcReceipts: Dispatch<SetStateAction<OtcEntry[]>>;
  otcPayments: OtcEntry[];
  setOtcPayments: Dispatch<SetStateAction<OtcEntry[]>>;
  showOtcProfitSection: boolean;
  setShowOtcProfitSection: Dispatch<SetStateAction<boolean>>;
  showOtcServiceChargeSection: boolean;
  setShowOtcServiceChargeSection: Dispatch<SetStateAction<boolean>>;
  otcProfitAmount: string;
  setOtcProfitAmount: Dispatch<SetStateAction<string>>;
  otcProfitCurrency: string;
  setOtcProfitCurrency: Dispatch<SetStateAction<string>>;
  otcProfitAccountId: string;
  setOtcProfitAccountId: Dispatch<SetStateAction<string>>;
  otcServiceChargeAmount: string;
  setOtcServiceChargeAmount: Dispatch<SetStateAction<string>>;
  otcServiceChargeCurrency: string;
  setOtcServiceChargeCurrency: Dispatch<SetStateAction<string>>;
  otcServiceChargeAccountId: string;
  setOtcServiceChargeAccountId: Dispatch<SetStateAction<string>>;
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  getBaseCurrency: (fromCurrency: string, toCurrency: string) => boolean | null;
  onSave: (event: FormEvent) => void;
  onComplete: (event: FormEvent) => void;
  onClose: () => void;
  setIsCreateCustomerModalOpen: Dispatch<SetStateAction<boolean>>;
  isSaving: boolean;
  t: (key: string) => string;
};

const OtcOrderView = ({ accounts, customers, users, otcOrderDetails, onClose }: ViewProps) => {
  const order = otcOrderDetails.order;
  if (!order) return null;

  const customerName = customers.find((c) => c.id === order.customerId)?.name || "";
  const handlerName = order.handlerId ? users.find((u) => u.id === order.handlerId)?.name || "" : "";

  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-slate-200 pb-4">
        <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Customer</label>
            <p className="mt-1 text-sm text-slate-900">{customerName}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Handler</label>
            <p className="mt-1 text-sm text-slate-900">{handlerName || "-"}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Currency Pair</label>
            <p className="mt-1 text-sm text-slate-900">
              {order.fromCurrency} / {order.toCurrency}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Rate</label>
            <p className="mt-1 text-sm text-slate-900">{order.rate}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Amount Buy</label>
            <p className="mt-1 text-sm text-slate-900">
              {order.amountBuy.toFixed(2)} {order.fromCurrency}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Amount Sell</label>
            <p className="mt-1 text-sm text-slate-900">
              {order.amountSell.toFixed(2)} {order.toCurrency}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Status</label>
            <p className="mt-1">
              <Badge tone={order.status === "completed" ? "emerald" : "rose"}>{order.status}</Badge>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Date</label>
            <p className="mt-1 text-sm text-slate-900">{order.createdAt ? formatDate(order.createdAt) : "-"}</p>
          </div>
        </div>
      </div>

      {otcOrderDetails.receipts && otcOrderDetails.receipts.length > 0 && (
        <div className="space-y-3 border-b border-slate-200 pb-4">
          <h3 className="text-lg font-semibold text-slate-900">Receipts ({order.fromCurrency})</h3>
          <div className="space-y-2">
            {otcOrderDetails.receipts.map((receipt, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-900">{receipt.accountName || "-"}</span>
                <span className="text-sm font-medium text-slate-900">
                  {receipt.amount.toFixed(2)} {order.fromCurrency}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-900">Total</span>
              <span className="text-sm font-semibold text-slate-900">
                {otcOrderDetails.receipts.reduce((sum, r) => sum + r.amount, 0).toFixed(2)} {order.fromCurrency}
              </span>
            </div>
          </div>
        </div>
      )}

      {otcOrderDetails.payments && otcOrderDetails.payments.length > 0 && (
        <div className="space-y-3 border-b border-slate-200 pb-4">
          <h3 className="text-lg font-semibold text-slate-900">Payments ({order.toCurrency})</h3>
          <div className="space-y-2">
            {otcOrderDetails.payments.map((payment, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-900">{payment.accountName || "-"}</span>
                <span className="text-sm font-medium text-slate-900">
                  {payment.amount.toFixed(2)} {order.toCurrency}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-900">Total</span>
              <span className="text-sm font-semibold text-slate-900">
                {otcOrderDetails.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} {order.toCurrency}
              </span>
            </div>
          </div>
        </div>
      )}

      {order.profitAmount !== null &&
        order.profitAmount !== undefined &&
        order.profitAccountId && (
          <div className="space-y-3 border-b border-slate-200 pb-4">
            <h3 className="text-lg font-semibold text-blue-900">Profit</h3>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-900">
                  {accounts.find((a) => a.id === order.profitAccountId)?.name || "-"} ({order.profitCurrency})
                </span>
                <span className="text-sm font-semibold text-blue-900">
                  {order.profitAmount > 0 ? "+" : ""}
                  {order.profitAmount.toFixed(2)} {order.profitCurrency}
                </span>
              </div>
            </div>
          </div>
        )}

      {order.serviceChargeAmount !== null &&
        order.serviceChargeAmount !== undefined &&
        order.serviceChargeAccountId && (
          <div className="space-y-3 border-b border-slate-200 pb-4">
            <h3 className="text-lg font-semibold text-green-900">Service Charges</h3>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-900">
                  {accounts.find((a) => a.id === order.serviceChargeAccountId)?.name || "-"} (
                  {order.serviceChargeCurrency})
                </span>
                <span
                  className={`text-sm font-semibold ${
                    order.serviceChargeAmount < 0 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {order.serviceChargeAmount > 0 ? "+" : ""}
                  {order.serviceChargeAmount.toFixed(2)} {order.serviceChargeCurrency}
                </span>
              </div>
            </div>
          </div>
        )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const OtcOrderForm = ({
  accounts,
  customers,
  users,
  currencies,
  otcForm,
  setOtcForm,
  otcReceipts,
  setOtcReceipts,
  otcPayments,
  setOtcPayments,
  showOtcProfitSection,
  setShowOtcProfitSection,
  showOtcServiceChargeSection,
  setShowOtcServiceChargeSection,
  otcProfitAmount,
  setOtcProfitAmount,
  otcProfitCurrency,
  setOtcProfitCurrency,
  otcProfitAccountId,
  setOtcProfitAccountId,
  otcServiceChargeAmount,
  setOtcServiceChargeAmount,
  otcServiceChargeCurrency,
  setOtcServiceChargeCurrency,
  otcServiceChargeAccountId,
  setOtcServiceChargeAccountId,
  handleNumberInputWheel,
  getBaseCurrency,
  onSave,
  onComplete,
  onClose,
  setIsCreateCustomerModalOpen,
  isSaving,
  t,
}: FormProps) => (
  <form className="space-y-6" onSubmit={onSave}>
    <div className="space-y-3 border-b border-slate-200 pb-4">
      <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
      <div className="flex gap-2">
        <select
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
          value={otcForm.customerId}
          onChange={(e) => setOtcForm((p) => ({ ...p, customerId: e.target.value }))}
          required
        >
          <option value="">{t("orders.selectCustomer")}</option>
          {customers.map((customer) => (
            <option value={customer.id} key={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIsCreateCustomerModalOpen(true)}
          className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          {t("orders.createNewCustomer")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={otcForm.fromCurrency}
          onChange={(e) => setOtcForm((p) => ({ ...p, fromCurrency: e.target.value }))}
          required
        >
          <option value="">{t("orders.from")}</option>
          {currencies
            .filter((c) => Boolean(c.active) && c.code !== otcForm.toCurrency)
            .map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
        </select>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={otcForm.toCurrency}
          onChange={(e) => setOtcForm((p) => ({ ...p, toCurrency: e.target.value }))}
          required
        >
          <option value="">{t("orders.to")}</option>
          {currencies
            .filter((c) => Boolean(c.active) && c.code !== otcForm.fromCurrency)
            .map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
        </select>
      </div>
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2"
        placeholder={t("orders.exchangeRate")}
        value={otcForm.rate}
        onChange={(e) => setOtcForm((p) => ({ ...p, rate: e.target.value }))}
        required
        type="number"
        step="0.0001"
        onWheel={handleNumberInputWheel}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          className="rounded-lg border border-slate-200 px-3 py-2"
          placeholder={t("orders.amountBuy")}
          value={otcForm.amountBuy}
          onChange={(e) => {
            const value = e.target.value;
            setOtcForm((p) => ({ ...p, amountBuy: value }));
            if (value && otcForm.rate && otcForm.fromCurrency && otcForm.toCurrency) {
              const rate = Number(otcForm.rate);
              if (!isNaN(rate) && rate > 0) {
                const baseIsFrom = getBaseCurrency(otcForm.fromCurrency, otcForm.toCurrency);
                let sellAmount: string;
                if (baseIsFrom === true) {
                  sellAmount = (Number(value) * rate).toFixed(4);
                } else if (baseIsFrom === false) {
                  sellAmount = (Number(value) / rate).toFixed(4);
                } else {
                  sellAmount = (Number(value) * rate).toFixed(4);
                }
                setOtcForm((p) => ({ ...p, amountSell: sellAmount }));
              }
            }
          }}
          required
          type="number"
          onWheel={handleNumberInputWheel}
        />
        <input
          className="rounded-lg border border-slate-200 px-3 py-2"
          placeholder={t("orders.amountSell")}
          value={otcForm.amountSell}
          onChange={(e) => {
            const value = e.target.value;
            setOtcForm((p) => ({ ...p, amountSell: value }));
            if (value && otcForm.rate && otcForm.fromCurrency && otcForm.toCurrency) {
              const rate = Number(otcForm.rate);
              if (!isNaN(rate) && rate > 0) {
                const baseIsFrom = getBaseCurrency(otcForm.fromCurrency, otcForm.toCurrency);
                let buyAmount: string;
                if (baseIsFrom === true) {
                  buyAmount = (Number(value) / rate).toFixed(4);
                } else if (baseIsFrom === false) {
                  buyAmount = (Number(value) * rate).toFixed(4);
                } else {
                  buyAmount = (Number(value) / rate).toFixed(4);
                }
                setOtcForm((p) => ({ ...p, amountBuy: buyAmount }));
              }
            }
          }}
          required
          type="number"
          onWheel={handleNumberInputWheel}
        />
      </div>
      <select
        className="w-full rounded-lg border border-slate-200 px-3 py-2"
        value={otcForm.handlerId}
        onChange={(e) => setOtcForm((p) => ({ ...p, handlerId: e.target.value }))}
        required
      >
        <option value="">{t("orders.selectHandler")}</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>

    <div className="space-y-3 border-b border-slate-200 pb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Receipts ({otcForm.fromCurrency})</h3>
        <button
          type="button"
          onClick={() => setOtcReceipts([...otcReceipts, { amount: "", accountId: "" }])}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Add Receipt
        </button>
      </div>
      {otcReceipts.map((receipt, index) => (
        <div key={index} className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={receipt.amount}
            onChange={(e) => {
              const newReceipts = [...otcReceipts];
              newReceipts[index] = { ...newReceipts[index], amount: e.target.value };
              setOtcReceipts(newReceipts);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2"
            required
            onWheel={handleNumberInputWheel}
          />
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
              value={receipt.accountId}
              onChange={(e) => {
                const newReceipts = [...otcReceipts];
                newReceipts[index] = { ...newReceipts[index], accountId: e.target.value };
                setOtcReceipts(newReceipts);
              }}
              required
            >
              <option value="">Select Account ({otcForm.fromCurrency})</option>
              {accounts
                .filter((a) => a.currencyCode === otcForm.fromCurrency)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => setOtcReceipts(otcReceipts.filter((_, i) => i !== index))}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="text-sm text-slate-600">
        Total: {otcReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toFixed(2)} {otcForm.fromCurrency}
      </div>
    </div>

    <div className="space-y-3 border-b border-slate-200 pb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Payments ({otcForm.toCurrency})</h3>
        <button
          type="button"
          onClick={() => setOtcPayments([...otcPayments, { amount: "", accountId: "" }])}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Add Payment
        </button>
      </div>
      {otcPayments.map((payment, index) => (
        <div key={index} className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={payment.amount}
            onChange={(e) => {
              const newPayments = [...otcPayments];
              newPayments[index] = { ...newPayments[index], amount: e.target.value };
              setOtcPayments(newPayments);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2"
            required
            onWheel={handleNumberInputWheel}
          />
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
              value={payment.accountId}
              onChange={(e) => {
                const newPayments = [...otcPayments];
                newPayments[index] = { ...newPayments[index], accountId: e.target.value };
                setOtcPayments(newPayments);
              }}
              required
            >
              <option value="">Select Account ({otcForm.toCurrency})</option>
              {accounts
                .filter((a) => a.currencyCode === otcForm.toCurrency)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => setOtcPayments(otcPayments.filter((_, i) => i !== index))}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="text-sm text-slate-600">
        Total: {otcPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2)} {otcForm.toCurrency}
      </div>
    </div>

    <div className="space-y-3 border-b border-slate-200 pb-4">
      {!showOtcProfitSection ? (
        <button
          type="button"
          onClick={() => setShowOtcProfitSection(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Add Profit
        </button>
      ) : (
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-blue-900">Profit</h3>
            <button
              type="button"
              onClick={() => {
                setShowOtcProfitSection(false);
                setOtcProfitAmount("");
                setOtcProfitCurrency("");
                setOtcProfitAccountId("");
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={otcProfitAmount}
              onChange={(e) => setOtcProfitAmount(e.target.value)}
              className="rounded-lg border border-blue-300 px-3 py-2"
              onWheel={handleNumberInputWheel}
            />
            <select
              value={otcProfitCurrency}
              onChange={(e) => {
                setOtcProfitCurrency(e.target.value);
                setOtcProfitAccountId("");
              }}
              className="rounded-lg border border-blue-300 px-3 py-2"
            >
              <option value="">Select Currency</option>
              {otcForm.fromCurrency && <option value={otcForm.fromCurrency}>{otcForm.fromCurrency}</option>}
              {otcForm.toCurrency && <option value={otcForm.toCurrency}>{otcForm.toCurrency}</option>}
            </select>
          </div>
          {otcProfitCurrency && (
            <select
              className="w-full mt-3 rounded-lg border border-blue-300 px-3 py-2"
              value={otcProfitAccountId}
              onChange={(e) => setOtcProfitAccountId(e.target.value)}
            >
              <option value="">Select Account ({otcProfitCurrency})</option>
              {accounts
                .filter((a) => a.currencyCode === otcProfitCurrency)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                  </option>
                ))}
            </select>
          )}
        </div>
      )}
    </div>

    <div className="space-y-3 border-b border-slate-200 pb-4">
      {!showOtcServiceChargeSection ? (
        <button
          type="button"
          onClick={() => setShowOtcServiceChargeSection(true)}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Add Service Charges
        </button>
      ) : (
        <div className="p-4 border border-green-200 rounded-lg bg-green-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-900">Service Charges</h3>
            <button
              type="button"
              onClick={() => {
                setShowOtcServiceChargeSection(false);
                setOtcServiceChargeAmount("");
                setOtcServiceChargeCurrency("");
                setOtcServiceChargeAccountId("");
              }}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.01"
              placeholder="Amount (negative if paid by us)"
              value={otcServiceChargeAmount}
              onChange={(e) => setOtcServiceChargeAmount(e.target.value)}
              className="rounded-lg border border-green-300 px-3 py-2"
              onWheel={handleNumberInputWheel}
            />
            <select
              value={otcServiceChargeCurrency}
              onChange={(e) => {
                setOtcServiceChargeCurrency(e.target.value);
                setOtcServiceChargeAccountId("");
              }}
              className="rounded-lg border border-green-300 px-3 py-2"
            >
              <option value="">Select Currency</option>
              {otcForm.fromCurrency && <option value={otcForm.fromCurrency}>{otcForm.fromCurrency}</option>}
              {otcForm.toCurrency && <option value={otcForm.toCurrency}>{otcForm.toCurrency}</option>}
            </select>
          </div>
          {otcServiceChargeCurrency && (
            <select
              className="w-full mt-3 rounded-lg border border-green-300 px-3 py-2"
              value={otcServiceChargeAccountId}
              onChange={(e) => setOtcServiceChargeAccountId(e.target.value)}
            >
              <option value="">Select Account ({otcServiceChargeCurrency})</option>
              {accounts
                .filter((a) => a.currencyCode === otcServiceChargeCurrency)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.balance.toFixed(2)} {acc.currencyCode})
                  </option>
                ))}
            </select>
          )}
        </div>
      )}
    </div>

    <div className="flex gap-3 justify-end">
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
        {isSaving ? t("common.saving") : "Save"}
      </button>
      <button
        type="button"
        onClick={onComplete}
        disabled={isSaving}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        Complete
      </button>
    </div>
  </form>
);

export default function OtcOrderModal({
  isOpen,
  isSaving,
  isOtcCompleted,
  otcEditingOrderId,
  otcOrderDetails,
  customers,
  users,
  currencies,
  accounts,
  otcForm,
  setOtcForm,
  otcReceipts,
  setOtcReceipts,
  otcPayments,
  setOtcPayments,
  showOtcProfitSection,
  setShowOtcProfitSection,
  showOtcServiceChargeSection,
  setShowOtcServiceChargeSection,
  otcProfitAmount,
  setOtcProfitAmount,
  otcProfitCurrency,
  setOtcProfitCurrency,
  otcProfitAccountId,
  setOtcProfitAccountId,
  otcServiceChargeAmount,
  setOtcServiceChargeAmount,
  otcServiceChargeCurrency,
  setOtcServiceChargeCurrency,
  otcServiceChargeAccountId,
  setOtcServiceChargeAccountId,
  handleNumberInputWheel,
  getBaseCurrency,
  onSave,
  onComplete,
  onClose,
  setIsCreateCustomerModalOpen,
  t,
}: OtcOrderModalProps) {
  if (!isOpen) return null;

  const heading = isOtcCompleted ? "View OTC Order" : otcEditingOrderId ? "Edit OTC Order" : "Create OTC Order";

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      style={{ margin: 0, padding: 0 }}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{heading}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={t("common.close")}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isOtcCompleted && otcOrderDetails?.order ? (
          <OtcOrderView
            accounts={accounts}
            customers={customers}
            users={users}
            otcOrderDetails={otcOrderDetails}
            onClose={onClose}
          />
        ) : (
          <OtcOrderForm
            accounts={accounts}
            customers={customers}
            users={users}
            currencies={currencies}
            otcForm={otcForm}
            setOtcForm={setOtcForm}
            otcReceipts={otcReceipts}
            setOtcReceipts={setOtcReceipts}
            otcPayments={otcPayments}
            setOtcPayments={setOtcPayments}
            showOtcProfitSection={showOtcProfitSection}
            setShowOtcProfitSection={setShowOtcProfitSection}
            showOtcServiceChargeSection={showOtcServiceChargeSection}
            setShowOtcServiceChargeSection={setShowOtcServiceChargeSection}
            otcProfitAmount={otcProfitAmount}
            setOtcProfitAmount={setOtcProfitAmount}
            otcProfitCurrency={otcProfitCurrency}
            setOtcProfitCurrency={setOtcProfitCurrency}
            otcProfitAccountId={otcProfitAccountId}
            setOtcProfitAccountId={setOtcProfitAccountId}
            otcServiceChargeAmount={otcServiceChargeAmount}
            setOtcServiceChargeAmount={setOtcServiceChargeAmount}
            otcServiceChargeCurrency={otcServiceChargeCurrency}
            setOtcServiceChargeCurrency={setOtcServiceChargeCurrency}
            otcServiceChargeAccountId={otcServiceChargeAccountId}
            setOtcServiceChargeAccountId={setOtcServiceChargeAccountId}
            handleNumberInputWheel={handleNumberInputWheel}
            getBaseCurrency={getBaseCurrency}
            onSave={onSave}
            onComplete={onComplete}
            onClose={onClose}
            setIsCreateCustomerModalOpen={setIsCreateCustomerModalOpen}
            isSaving={isSaving}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

