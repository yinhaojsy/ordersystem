import { useMemo } from "react";
import type { Account, ProfitCalculationDetails, ProfitAccountMultiplier } from "../types";

export interface ProfitSummaryData {
  groupSums: Map<string, Map<string, number>>;
  groupNames: Map<string, string>;
  groupConvertedTotals: Map<string, number>;
  groupAccountCounts: Map<string, number>;
  totalConverted: number;
  totalInvestment: number;
  totalProfit: number;
  targetCurrency: string;
  exchangeRateMap: Map<string, number>;
}

export function useProfitSummary(
  calculationDetails: ProfitCalculationDetails | undefined,
  accounts: Account[]
): ProfitSummaryData | null {
  return useMemo(() => {
    if (!calculationDetails) return null;

    const defaultMultiplierMap = new Map<number, ProfitAccountMultiplier>();
    calculationDetails.multipliers.forEach((m) => {
      defaultMultiplierMap.set(m.accountId, m);
    });

    const defaultExchangeRateMap = new Map<string, number>();
    calculationDetails.exchangeRates.forEach((er) => {
      defaultExchangeRateMap.set(`${er.fromCurrencyCode}_${er.toCurrencyCode}`, er.rate);
    });

    // Calculate account values
    const accountCalcs = accounts.map((account) => {
      const multiplier = defaultMultiplierMap.get(account.id);
      const mult = multiplier?.multiplier ?? 1.0;
      const calculated = account.balance * mult;
      return {
        account,
        multiplier: multiplier || null,
        calculated,
        groupId: multiplier?.groupId || null,
        groupName: multiplier?.groupName || null,
      };
    });

    // Group accounts by groupId
    const grouped = new Map<string, typeof accountCalcs>();
    accountCalcs.forEach((calc) => {
      const groupId = calc.groupId || "ungrouped";
      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
      }
      grouped.get(groupId)!.push(calc);
    });

    // Calculate group sums by currency
    const groupSums = new Map<string, Map<string, number>>();
    grouped.forEach((groupAccounts, groupId) => {
      // Exclude "ungrouped" accounts from group sums - only include assigned groups
      if (groupId !== "ungrouped") {
        const currencySums = new Map<string, number>();
        groupAccounts.forEach((calc) => {
          const currency = calc.account.currencyCode;
          currencySums.set(currency, (currencySums.get(currency) || 0) + calc.calculated);
        });
        groupSums.set(groupId, currencySums);
      }
    });

    // Calculate converted amounts
    const convertedAmounts = new Map<string, number>();
    // Only include currencies from accounts that are assigned to groups (exclude ungrouped)
    const uniqueCurrencies = Array.from(
      new Set(
        accountCalcs
          .filter((calc) => calc.groupId) // Only include accounts with a groupId
          .map((calc) => calc.account.currencyCode)
      )
    );
    uniqueCurrencies.forEach((currency) => {
      const key = `${currency}_${calculationDetails.targetCurrencyCode}`;
      const defaultRate = currency === calculationDetails.targetCurrencyCode ? 1 : 0;
      const rate = defaultExchangeRateMap.get(key) || defaultRate;
      const currencySum = Array.from(groupSums.values())
        .reduce((sum, currencySums) => sum + (currencySums.get(currency) || 0), 0);
      const converted = rate > 0 ? currencySum * rate : currencySum;
      convertedAmounts.set(currency, converted);
    });

    const totalConverted = Array.from(convertedAmounts.values()).reduce((sum, val) => sum + val, 0);
    const totalInvestment = calculationDetails.initialInvestment || 0;
    const totalProfit = totalConverted - totalInvestment;

    // Get group names for display
    const groupNames = new Map<string, string>();
    grouped.forEach((_, groupId) => {
      if (groupId !== "ungrouped") {
        const firstCalc = grouped.get(groupId)?.[0];
        if (firstCalc?.groupName) {
          groupNames.set(groupId, firstCalc.groupName);
        }
      }
    });

    // Calculate converted total for each group
    const groupConvertedTotals = new Map<string, number>();
    groupSums.forEach((currencySums, groupId) => {
      let groupTotal = 0;
      currencySums.forEach((sum, currency) => {
        const key = `${currency}_${calculationDetails.targetCurrencyCode}`;
        const defaultRate = currency === calculationDetails.targetCurrencyCode ? 1 : 0;
        const rate = defaultExchangeRateMap.get(key) || defaultRate;
        const converted = rate > 0 ? sum * rate : sum;
        groupTotal += converted;
      });
      groupConvertedTotals.set(groupId, groupTotal);
    });

    // Calculate account counts per group
    const groupAccountCounts = new Map<string, number>();
    grouped.forEach((groupAccounts, groupId) => {
      groupAccountCounts.set(groupId, groupAccounts.length);
    });

    return {
      groupSums,
      groupNames,
      groupConvertedTotals,
      groupAccountCounts,
      totalConverted,
      totalInvestment,
      totalProfit,
      targetCurrency: calculationDetails.targetCurrencyCode,
      exchangeRateMap: defaultExchangeRateMap,
    };
  }, [calculationDetails, accounts]);
}

