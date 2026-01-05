import { useState, useEffect, useCallback } from "react";
import type { OrderStatus, Currency } from "../../types";
import { calculateAmountSell as calculateAmountSellUtil } from "../../utils/orders/orderCalculations";

export interface OrderFormState {
  customerId: string;
  fromCurrency: string;
  toCurrency: string;
  amountBuy: string;
  amountSell: string;
  rate: string;
  status: OrderStatus;
}

const initialFormState: OrderFormState = {
  customerId: "",
  fromCurrency: "",
  toCurrency: "",
  amountBuy: "",
  amountSell: "",
  rate: "",
  status: "pending",
};

export function useOrderForm(currencies: Currency[]) {
  const [form, setForm] = useState<OrderFormState>(initialFormState);
  const [calculatedField, setCalculatedField] = useState<"buy" | "sell" | null>(null);
  const [isFlexOrderMode, setIsFlexOrderMode] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const resetForm = useCallback(() => {
    setForm(initialFormState);
    setCalculatedField(null);
  }, []);

  const closeModal = useCallback(() => {
    resetForm();
    setIsModalOpen(false);
    setEditingOrderId(null);
    setIsFlexOrderMode(false);
  }, [resetForm]);

  // Auto-calculate amount when rate or source amount changes
  useEffect(() => {
    if (!form.rate || form.rate === "0" || !calculatedField) return;
    if (!form.fromCurrency || !form.toCurrency) return;

    const rate = Number(form.rate);
    if (isNaN(rate) || rate <= 0) return;

    // Determine which side is the "stronger" currency so we know which way to apply the rate.
    // Heuristic: USDT (or any currency with rate <= 1) is the base; otherwise pick the currency with the smaller rate.
    const getCurrencyRate = (code: string) => {
      const currency = currencies.find((c) => c.code === code);
      const candidate =
        currency?.conversionRateBuy ??
        currency?.baseRateBuy ??
        currency?.baseRateSell ??
        currency?.conversionRateSell;
      return typeof candidate === "number" ? candidate : null;
    };

    const fromRate = getCurrencyRate(form.fromCurrency);
    const toRate = getCurrencyRate(form.toCurrency);

    const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : form.fromCurrency === "USDT";
    const inferredToIsUSDT = toRate !== null ? toRate <= 1 : form.toCurrency === "USDT";

    // If both sides look like USDT (rate <= 1), nothing to auto-calc
    if (inferredFromIsUSDT && inferredToIsUSDT) return;

    let baseIsFrom: boolean | null = null;
    if (inferredFromIsUSDT !== inferredToIsUSDT) {
      // One side is USDT (or behaves like it)
      baseIsFrom = inferredFromIsUSDT;
    } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
      // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
      baseIsFrom = fromRate < toRate;
    } else {
      return;
    }

    if (calculatedField === "buy" && form.amountBuy) {
      const buyAmount = Number(form.amountBuy);
      if (!isNaN(buyAmount) && buyAmount > 0) {
        let sellAmount: string;
        if (baseIsFrom) {
          // Stronger/base currency → weaker: multiply by rate
          sellAmount = (buyAmount * rate).toFixed(2);
        } else {
          // Weaker → stronger/base: divide by rate
          sellAmount = (buyAmount / rate).toFixed(2);
        }
        setForm((prev) => ({ ...prev, amountSell: sellAmount }));
      }
    } else if (calculatedField === "sell" && form.amountSell) {
      const sellAmount = Number(form.amountSell);
      if (!isNaN(sellAmount) && sellAmount > 0) {
        let buyAmount: string;
        if (baseIsFrom) {
          // Stronger/base currency → weaker: divide to get base amount
          buyAmount = (sellAmount / rate).toFixed(2);
        } else {
          // Weaker → stronger/base: multiply to get base amount
          buyAmount = (sellAmount * rate).toFixed(2);
        }
        setForm((prev) => ({ ...prev, amountBuy: buyAmount }));
      }
    }
  }, [form.rate, form.amountBuy, form.amountSell, calculatedField, form.fromCurrency, form.toCurrency, currencies]);

  return {
    form,
    setForm,
    calculatedField,
    setCalculatedField,
    isFlexOrderMode,
    setIsFlexOrderMode,
    editingOrderId,
    setEditingOrderId,
    isModalOpen,
    setIsModalOpen,
    resetForm,
    closeModal,
  };
}

