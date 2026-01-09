import { useMemo } from "react";
import {
  useGetOrdersQuery,
  useGetExpensesQuery,
  useGetTransfersQuery,
} from "../services/api";
import type { Order, Expense, Transfer } from "../types";

export interface DashboardStatistics {
  profit: {
    total: number;
    byCurrency: Map<string, number>;
    orderCount: number;
  };
  expense: {
    total: number;
    byCurrency: Map<string, number>;
    expenseCount: number;
    transferFeeCount: number;
  };
  netProfit: {
    total: number;
    byCurrency: Map<string, number>;
  };
}

export interface UseDashboardStatisticsParams {
  dateFrom: string | null;
  dateTo: string | null;
  profitTagIds: number[];
  expenseTagIds: number[];
}

export function useDashboardStatistics({
  dateFrom,
  dateTo,
  profitTagIds,
  expenseTagIds,
}: UseDashboardStatisticsParams) {
  // Build query params for orders (profit)
  const orderParams = useMemo(() => {
    const params: {
      dateFrom?: string;
      dateTo?: string;
      tagIds?: string;
      limit?: number;
      status?: "completed";
    } = {
      limit: 10000, // Get all orders
      status: "completed", // Only completed orders have profit
    };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (profitTagIds.length > 0) {
      params.tagIds = profitTagIds.join(",");
    }
    return params;
  }, [dateFrom, dateTo, profitTagIds]);

  // Build query params for expenses
  const expenseParams = useMemo(() => {
    const params: {
      dateFrom?: string;
      dateTo?: string;
      tagIds?: string;
    } = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (expenseTagIds.length > 0) {
      params.tagIds = expenseTagIds.join(",");
    }
    return params;
  }, [dateFrom, dateTo, expenseTagIds]);

  // Build query params for transfers (for transaction fees)
  const transferParams = useMemo(() => {
    const params: {
      dateFrom?: string;
      dateTo?: string;
    } = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return params;
  }, [dateFrom, dateTo]);

  // Fetch data
  const { data: ordersData, isLoading: isLoadingOrders } = useGetOrdersQuery(orderParams);
  const { data: expenses = [], isLoading: isLoadingExpenses } = useGetExpensesQuery(expenseParams);
  const { data: transfers = [], isLoading: isLoadingTransfers } = useGetTransfersQuery(transferParams);

  const orders = ordersData?.orders ?? [];
  const isLoading = isLoadingOrders || isLoadingExpenses || isLoadingTransfers;

  // Calculate statistics
  const statistics = useMemo((): DashboardStatistics => {
    const profitByCurrency = new Map<string, number>();
    let totalProfit = 0;
    let orderCount = 0;

    // Calculate profit from orders
    orders.forEach((order: Order) => {
      if (order.profitAmount && order.profitAmount > 0 && order.profitCurrency) {
        const currency = order.profitCurrency;
        const amount = Number(order.profitAmount);
        profitByCurrency.set(currency, (profitByCurrency.get(currency) || 0) + amount);
        totalProfit += amount;
        orderCount++;
      }
    });

    // Calculate expenses
    const expenseByCurrency = new Map<string, number>();
    let totalExpense = 0;
    let expenseCount = 0;

    // Expenses from expenses table
    expenses.forEach((expense: Expense) => {
      const currency = expense.currencyCode;
      const amount = Number(expense.amount);
      expenseByCurrency.set(currency, (expenseByCurrency.get(currency) || 0) + amount);
      totalExpense += amount;
      expenseCount++;
    });

    // Transaction fees from transfers
    let transferFeeCount = 0;
    transfers.forEach((transfer: Transfer) => {
      if (transfer.transactionFee && transfer.transactionFee > 0) {
        const currency = transfer.currencyCode;
        const amount = Number(transfer.transactionFee);
        expenseByCurrency.set(currency, (expenseByCurrency.get(currency) || 0) + amount);
        totalExpense += amount;
        transferFeeCount++;
      }
    });

    // Calculate net profit (profit - expense) by currency
    const netProfitByCurrency = new Map<string, number>();
    const allCurrencies = new Set([
      ...profitByCurrency.keys(),
      ...expenseByCurrency.keys(),
    ]);

    allCurrencies.forEach((currency) => {
      const profit = profitByCurrency.get(currency) || 0;
      const expense = expenseByCurrency.get(currency) || 0;
      const net = profit - expense;
      if (net !== 0) {
        netProfitByCurrency.set(currency, net);
      }
    });

    const totalNetProfit = totalProfit - totalExpense;

    return {
      profit: {
        total: totalProfit,
        byCurrency: profitByCurrency,
        orderCount,
      },
      expense: {
        total: totalExpense,
        byCurrency: expenseByCurrency,
        expenseCount,
        transferFeeCount,
      },
      netProfit: {
        total: totalNetProfit,
        byCurrency: netProfitByCurrency,
      },
    };
  }, [orders, expenses, transfers]);

  return {
    statistics,
    isLoading,
  };
}
