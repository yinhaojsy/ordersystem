import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../common/SectionCard";
import Badge from "../common/Badge";
import { useDashboardStatistics } from "../../hooks/useDashboardStatistics";
import { useGetTagsQuery } from "../../services/api";
import type { Tag } from "../../types";
import { formatCurrency } from "../../utils/format";

type TabType = "week" | "month" | "year" | "custom";

interface DashboardStatisticsProps {}

export default function DashboardStatistics({}: DashboardStatisticsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("month");
  const [profitTagIds, setProfitTagIds] = useState<number[]>([]);
  const [expenseTagIds, setExpenseTagIds] = useState<number[]>([]);
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [isProfitTagFilterOpen, setIsProfitTagFilterOpen] = useState(false);
  const [isExpenseTagFilterOpen, setIsExpenseTagFilterOpen] = useState(false);
  const profitTagFilterRef = useRef<HTMLDivElement>(null);
  const expenseTagFilterRef = useRef<HTMLDivElement>(null);

  const { data: tags = [] } = useGetTagsQuery();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profitTagFilterRef.current &&
        !profitTagFilterRef.current.contains(event.target as Node)
      ) {
        setIsProfitTagFilterOpen(false);
      }
      if (
        expenseTagFilterRef.current &&
        !expenseTagFilterRef.current.contains(event.target as Node)
      ) {
        setIsExpenseTagFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Calculate date range based on active tab
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    switch (activeTab) {
      case "week": {
        // Current week (Monday to Sunday)
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        start = new Date(now);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "month": {
        // Current month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "year": {
        // Current year
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "custom": {
        if (customDateFrom && customDateTo) {
          start = new Date(customDateFrom);
          start.setHours(0, 0, 0, 0);
          end = new Date(customDateTo);
          end.setHours(23, 59, 59, 999);
        } else {
          return { dateFrom: null, dateTo: null };
        }
        break;
      }
      default:
        return { dateFrom: null, dateTo: null };
    }

    return {
      dateFrom: start.toISOString().split("T")[0],
      dateTo: end.toISOString().split("T")[0],
    };
  }, [activeTab, customDateFrom, customDateTo]);

  const { statistics, isLoading } = useDashboardStatistics({
    dateFrom,
    dateTo,
    profitTagIds,
    expenseTagIds,
  });

  const selectedProfitTagNames = useMemo(() => {
    return tags.filter((tag) => profitTagIds.includes(tag.id)).map((tag) => tag.name);
  }, [tags, profitTagIds]);

  const selectedExpenseTagNames = useMemo(() => {
    return tags.filter((tag) => expenseTagIds.includes(tag.id)).map((tag) => tag.name);
  }, [tags, expenseTagIds]);

  const toggleProfitTag = (tagId: number) => {
    setProfitTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleExpenseTag = (tagId: number) => {
    setExpenseTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const clearProfitTags = () => {
    setProfitTagIds([]);
  };

  const clearExpenseTags = () => {
    setExpenseTagIds([]);
  };

  return (
    <SectionCard
      title={t("dashboard.statistics")}
      description={t("dashboard.statisticsDesc")}
    >
      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("week")}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === "week"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {t("dashboard.currentWeek")}
          </button>
          <button
            onClick={() => setActiveTab("month")}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === "month"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {t("dashboard.currentMonth")}
          </button>
          <button
            onClick={() => setActiveTab("year")}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === "year"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {t("dashboard.currentYear")}
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === "custom"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {t("dashboard.customDateRange")}
          </button>
        </div>
      </div>

      {/* Custom Date Range Input */}
      {activeTab === "custom" && (
        <div className="mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("dashboard.dateFrom")}
            </label>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("dashboard.dateTo")}
            </label>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-slate-500">{t("common.loading")}</div>
      ) : (
        <div className="space-y-6">
          {/* Profit Section */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {t("dashboard.profit")}
              </h3>
              <div className="relative" ref={profitTagFilterRef}>
                <button
                  onClick={() => setIsProfitTagFilterOpen(!isProfitTagFilterOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span>{t("dashboard.filterByTags")}</span>
                  {profitTagIds.length > 0 && (
                    <Badge tone="blue">{profitTagIds.length}</Badge>
                  )}
                </button>
                {isProfitTagFilterOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        {t("dashboard.selectOrderTags")}
                      </span>
                      {profitTagIds.length > 0 && (
                        <button
                          onClick={clearProfitTags}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          {t("common.clear")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {tags.length === 0 ? (
                        <div className="text-sm text-slate-500 py-2">
                          {t("orders.noTagsAvailable")}
                        </div>
                      ) : (
                        tags.map((tag: Tag) => (
                          <label
                            key={tag.id}
                            className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={profitTagIds.includes(tag.id)}
                              onChange={() => toggleProfitTag(tag.id)}
                              className="h-4 w-4"
                            />
                            <Badge tone="slate" backgroundColor={tag.color}>
                              {tag.name}
                            </Badge>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {profitTagIds.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedProfitTagNames.map((name, idx) => {
                  const tag = tags.find((t) => t.name === name);
                  return (
                    <Badge
                      key={idx}
                      tone="slate"
                      backgroundColor={tag?.color}
                      onRemove={() => toggleProfitTag(tag!.id)}
                    >
                      {name}
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(statistics.profit.total)}
                </span>
                <span className="text-sm text-slate-500">
                  ({statistics.profit.orderCount} {t("dashboard.orders")})
                </span>
              </div>
              {statistics.profit.byCurrency.size > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    {t("dashboard.byCurrency")}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(statistics.profit.byCurrency.entries()).map(
                      ([currency, amount]) => (
                        <div
                          key={currency}
                          className="px-3 py-1 bg-emerald-50 rounded-lg text-sm"
                        >
                          <span className="font-medium text-emerald-700">
                            {formatCurrency(amount)} {currency}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expense Section */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {t("dashboard.expense")}
              </h3>
              <div className="relative" ref={expenseTagFilterRef}>
                <button
                  onClick={() => setIsExpenseTagFilterOpen(!isExpenseTagFilterOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span>{t("dashboard.filterByTags")}</span>
                  {expenseTagIds.length > 0 && (
                    <Badge tone="blue">{expenseTagIds.length}</Badge>
                  )}
                </button>
                {isExpenseTagFilterOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        {t("dashboard.selectExpenseTags")}
                      </span>
                      {expenseTagIds.length > 0 && (
                        <button
                          onClick={clearExpenseTags}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          {t("common.clear")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {tags.length === 0 ? (
                        <div className="text-sm text-slate-500 py-2">
                          {t("orders.noTagsAvailable")}
                        </div>
                      ) : (
                        tags.map((tag: Tag) => (
                          <label
                            key={tag.id}
                            className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={expenseTagIds.includes(tag.id)}
                              onChange={() => toggleExpenseTag(tag.id)}
                              className="h-4 w-4"
                            />
                            <Badge tone="slate" backgroundColor={tag.color}>
                              {tag.name}
                            </Badge>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {expenseTagIds.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedExpenseTagNames.map((name, idx) => {
                  const tag = tags.find((t) => t.name === name);
                  return (
                    <Badge
                      key={idx}
                      tone="slate"
                      backgroundColor={tag?.color}
                      onRemove={() => toggleExpenseTag(tag!.id)}
                    >
                      {name}
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-rose-600">
                  {formatCurrency(statistics.expense.total)}
                </span>
                <span className="text-sm text-slate-500">
                  ({statistics.expense.expenseCount} {t("dashboard.expenses")}
                  {statistics.expense.transferFeeCount > 0 &&
                    `, ${statistics.expense.transferFeeCount} ${t("dashboard.transferFees")}`}
                  )
                </span>
              </div>
              {statistics.expense.byCurrency.size > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    {t("dashboard.byCurrency")}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(statistics.expense.byCurrency.entries()).map(
                      ([currency, amount]) => (
                        <div
                          key={currency}
                          className="px-3 py-1 bg-rose-50 rounded-lg text-sm"
                        >
                          <span className="font-medium text-rose-700">
                            {formatCurrency(amount)} {currency}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Net Profit Section */}
          <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {t("dashboard.netProfit")}
            </h3>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-bold ${
                    statistics.netProfit.total >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatCurrency(statistics.netProfit.total)}
                </span>
              </div>
              {statistics.netProfit.byCurrency.size > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    {t("dashboard.byCurrency")}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(statistics.netProfit.byCurrency.entries()).map(
                      ([currency, amount]) => (
                        <div
                          key={currency}
                          className={`px-3 py-1 rounded-lg text-sm ${
                            amount >= 0 ? "bg-emerald-50" : "bg-rose-50"
                          }`}
                        >
                          <span
                            className={`font-medium ${
                              amount >= 0 ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {formatCurrency(amount)} {currency}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
