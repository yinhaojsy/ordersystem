import React, { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import type { OrderFilters, DatePreset } from "../../types/orders";
import type { OrderStatus, Tag, Customer, User, Account, Currency } from "../../types";

interface OrdersFiltersProps {
  filters: OrderFilters;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onDatePresetChange: (preset: DatePreset) => void;
  onFilterChange: <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) => void;
  onClearFilters: () => void;
  onExport: () => void;
  isExporting: boolean;
  canExport?: boolean;
  // Tag filter state
  isTagFilterOpen: boolean;
  setIsTagFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tagFilterHighlight: number;
  setTagFilterHighlight: React.Dispatch<React.SetStateAction<number>>;
  tagFilterListRef: React.RefObject<HTMLDivElement | null>;
  onTagFilterKeyDown: (e: React.KeyboardEvent) => void;
  // Data
  users: User[];
  customers: Customer[];
  accounts: Account[];
  currencyPairs: string[];
  tags: Tag[];
  selectedTagNames: string[];
  tagFilterLabel: string;
}

export function OrdersFilters({
  filters,
  isExpanded,
  onToggleExpanded,
  onDatePresetChange,
  onFilterChange,
  onClearFilters,
  onExport,
  isExporting,
  canExport = true,
  isTagFilterOpen,
  setIsTagFilterOpen,
  tagFilterHighlight,
  setTagFilterHighlight,
  tagFilterListRef,
  onTagFilterKeyDown,
  users,
  customers,
  accounts,
  currencyPairs,
  tags,
  selectedTagNames,
  tagFilterLabel,
}: OrdersFiltersProps) {
  const { t } = useTranslation();

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(
      v => v !== null && v !== 'all' && v !== 'custom' && (Array.isArray(v) ? v.length > 0 : true)
    ).length;
  }, [filters]);

  useEffect(() => {
    if (isTagFilterOpen && tags.length > 0) {
      setTagFilterHighlight(0);
      // Move focus to the list for keyboard navigation
      setTimeout(() => tagFilterListRef.current?.focus(), 0);
    } else if (!isTagFilterOpen) {
      setTagFilterHighlight(-1);
    }
  }, [isTagFilterOpen, tags.length, setTagFilterHighlight, tagFilterListRef]);

  return (
    <div className="mb-4 border-b border-slate-200 pb-4">
      <button
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full text-left text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {t("orders.filters") || "Filters"}
        </span>
        <span className="text-xs font-normal text-slate-500">
          {activeFilterCount > 0 && `(${activeFilterCount} active)`}
        </span>
      </button>
      
      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Date Preset */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("orders.datePreset") || "Date Range"}
            </label>
            <select
              value={filters.datePreset}
              onChange={(e) => onDatePresetChange(e.target.value as DatePreset)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t("orders.all") || "All"}</option>
              <option value="currentWeek">{t("orders.currentWeek") || "Current Week"}</option>
              <option value="lastWeek">{t("orders.lastWeek") || "Last Week"}</option>
              <option value="currentMonth">{t("orders.currentMonth") || "Current Month"}</option>
              <option value="lastMonth">{t("orders.lastMonth") || "Last Month"}</option>
              <option value="custom">{t("orders.custom") || "Custom"}</option>
            </select>
          </div>

          {/* Date From */}
          {filters.datePreset === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t("orders.dateFrom") || "Date From"}
              </label>
              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => onFilterChange('dateFrom', e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Date To */}
          {filters.datePreset === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t("orders.dateTo") || "Date To"}
              </label>
              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => onFilterChange('dateTo', e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Handler */}
          <SearchableSelect
            value={filters.handlerId}
            onChange={(value) => onFilterChange('handlerId', value)}
            options={users.filter((user) => user.role !== "admin")}
            placeholder={t("orders.selectHandler") || "Type to search handlers..."}
            label={t("orders.handler") || "Handler"}
            allOptionLabel={t("orders.all") || "All"}
          />

          {/* Customer */}
          <SearchableSelect
            value={filters.customerId}
            onChange={(value) => onFilterChange('customerId', value)}
            options={customers}
            placeholder={t("orders.selectCustomer") || "Type to search customers..."}
            label={t("orders.customer") || "Customer"}
            allOptionLabel={t("orders.all") || "All"}
          />

          {/* Currency Pair */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("orders.currencyPair") || "Currency Pair"}
            </label>
            <select
              value={filters.currencyPair || ""}
              onChange={(e) => onFilterChange('currencyPair', e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t("orders.all") || "All"}</option>
              {currencyPairs.map((pair) => (
                <option key={pair} value={pair}>
                  {pair}
                </option>
              ))}
            </select>
          </div>

          {/* Buy Account */}
          <SearchableSelect
            value={filters.buyAccountId}
            onChange={(value) => onFilterChange('buyAccountId', value)}
            options={accounts}
            placeholder={t("orders.selectBuyAccount") || "Type to search buy accounts..."}
            label={t("orders.buyAccount") || "Buy Account"}
            allOptionLabel={t("orders.all") || "All"}
          />

          {/* Sell Account */}
          <SearchableSelect
            value={filters.sellAccountId}
            onChange={(value) => onFilterChange('sellAccountId', value)}
            options={accounts}
            placeholder={t("orders.selectSellAccount") || "Type to search sell accounts..."}
            label={t("orders.sellAccount") || "Sell Account"}
            allOptionLabel={t("orders.all") || "All"}
          />

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("orders.status") || "Status"}
            </label>
            <select
              value={filters.status || ""}
              onChange={(e) => onFilterChange('status', (e.target.value || null) as OrderStatus | null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t("orders.all") || "All"}</option>
              <option value="pending">{t("orders.pending") || "Pending"}</option>
              <option value="under_process">{t("orders.underProcess") || "Under Process"}</option>
              <option value="completed">{t("orders.completed") || "Completed"}</option>
              <option value="cancelled">{t("orders.cancelled") || "Cancelled"}</option>
            </select>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("orders.orderType") || "Order Type"}
            </label>
            <select
              value={filters.orderType || ""}
              onChange={(e) => onFilterChange('orderType', (e.target.value || null) as "online" | "otc" | null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t("orders.all")}</option>
              <option value="online">{t("orders.online")}</option>
              <option value="otc">{t("orders.otc")}</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("orders.tag")}
            </label>
            <button
              type="button"
              onClick={() => setIsTagFilterOpen((prev) => !prev)}
              onKeyDown={onTagFilterKeyDown}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm flex items-center justify-between hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <span
                className="truncate flex-1 min-w-0 text-left"
                title={selectedTagNames.length ? selectedTagNames.join(", ") : undefined}
              >
                {tagFilterLabel}
              </span>
              {filters.tagIds.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700 font-medium shrink-0">
                  {filters.tagIds.length}
                </span>
              )}
              <svg className="w-4 h-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l4 4 4-4" />
              </svg>
            </button>
            {isTagFilterOpen && (
              <div
                ref={tagFilterListRef}
                tabIndex={0}
                onKeyDown={onTagFilterKeyDown}
                className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 focus:outline-none"
              >
                {tags.length === 0 && (
                  <div className="text-sm text-slate-500 px-2 py-1">
                    {t("orders.noTagsAvailable") || "No tags available"}
                  </div>
                )}
                {tags.map((tag: Tag, idx: number) => {
                  const isHighlighted = tagFilterHighlight === idx;
                  return (
                    <label
                      key={tag.id}
                      onMouseEnter={() => setTagFilterHighlight(idx)}
                      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
                        isHighlighted ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={filters.tagIds.includes(tag.id)}
                        onChange={(e) => {
                          const exists = filters.tagIds.includes(tag.id);
                          const next = e.target.checked
                            ? [...filters.tagIds, tag.id]
                            : filters.tagIds.filter((id) => id !== tag.id);
                          onFilterChange('tagIds', next);
                        }}
                      />
                      <Badge tone="slate" backgroundColor={tag.color}>
                        {tag.name}
                      </Badge>
                    </label>
                  );
                })}
                {tags.length > 0 && (
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200">
                    <button
                      className="text-xs text-slate-600 hover:text-slate-900"
                      onClick={() => onFilterChange('tagIds', [])}
                    >
                      {t("common.clear") || "Clear"}
                    </button>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => setIsTagFilterOpen(false)}
                    >
                      {t("common.done") || "Done"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={onClearFilters}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("orders.clearFilters") || "Clear Filters"}
            </button>
          </div>

          {/* Export Button */}
          {canExport && (
            <div className="flex items-end">
              <button
                onClick={onExport}
                disabled={isExporting}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t("orders.exporting") || "Exporting..."}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t("orders.export") || "Export to Excel"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

