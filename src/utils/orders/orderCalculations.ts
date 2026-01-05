import type { Currency } from "../../types";

/**
 * Calculate amountSell from amountBuy using the same logic as order creation
 * Determines which side is the "stronger" currency to know which way to apply the rate.
 * Heuristic: USDT (or any currency with rate <= 1) is the base; otherwise pick the currency with the smaller rate.
 */
export const calculateAmountSell = (
  amountBuy: number,
  rate: number,
  fromCurrency: string,
  toCurrency: string,
  currencies: Currency[]
): number => {
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  const getCurrencyRate = (code: string) => {
    const currency = currencies.find((c) => c.code === code);
    const candidate =
      currency?.conversionRateBuy ??
      currency?.baseRateBuy ??
      currency?.baseRateSell ??
      currency?.conversionRateSell;
    return typeof candidate === "number" ? candidate : null;
  };

  const fromRate = getCurrencyRate(fromCurrency);
  const toRate = getCurrencyRate(toCurrency);

  const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : fromCurrency === "USDT";
  const inferredToIsUSDT = toRate !== null ? toRate <= 1 : toCurrency === "USDT";

  // If both sides look like USDT (rate <= 1), default to multiply
  if (inferredFromIsUSDT && inferredToIsUSDT) {
    return amountBuy * rate;
  }

  let baseIsFrom: boolean | null = null;
  if (inferredFromIsUSDT !== inferredToIsUSDT) {
    // One side is USDT (or behaves like it)
    baseIsFrom = inferredFromIsUSDT;
  } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
    // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
    baseIsFrom = fromRate < toRate;
  } else {
    // Default to multiply if we can't determine
    return amountBuy * rate;
  }

  if (baseIsFrom) {
    // Stronger/base currency (fromCurrency) → weaker: multiply by rate
    return amountBuy * rate;
  } else {
    // Weaker → stronger/base currency (toCurrency): divide by rate
    return amountBuy / rate;
  }
};

