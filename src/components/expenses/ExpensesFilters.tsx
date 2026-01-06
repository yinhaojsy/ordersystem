import React, { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import type { DatePreset } from "../../types/orders";
import type { Tag, User, Account, Currency } from "../../types";
import type { ExpenseFilters } from "../../hooks/expenses/useExpensesFilters";

interface ExpensesFiltersProps {
  filters: ExpenseFilters;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onDatePresetChange: (preset: DatePreset) => void;
  onFilterChange: <K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) => void;
  onClearFilters: () => void;
  // Tag filter state
  isTagFilterOpen: boolean;
  setIsTagFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tagFilterHighlight: number;
  setTagFilterHighlight: React.Dispatch<React.SetStateAction<number>>;
  tagFilterListRef: React.RefObject<HTMLDivElement | null>;
  onTagFilterKeyDown: (e: React.KeyboardEvent) => void;
  // Data
  users: User[];
  accounts: Account[];
  currencies: Currency[];
  tags: Tag[];
  selectedTagNames: string[];
  tagFilterLabel: string;
}

export function ExpensesFilters({
  filters,
  isExpanded,
  onToggleExpanded,
  onDatePresetChange,
  onFilterChange,
  onClearFilters,
  isTagFilterOpen,
  setIsTagFilterOpen,
  tagFilterHighlight,
  setTagFilterHighlight,
  tagFilterListRef,
  onTagFilterKeyDown,
  users,
  accounts,
  currencies,
  tags,
  selectedTagNames,
  tagFilterLabel,
}: ExpensesFiltersProps) {
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
      setTimeout(() => tagFilterListRef.current?.focus(), 0);
    } else if (!isTagFilterOpen) {
      setTagFilterHighlight(-1);
    }
  }, [isTagFilterOpen, tags.length, setTagFilterHighlight, tagFilterListRef]);

  // Get unique currency codes from accounts
  const currencyCodes = useMemo(() => {
    const codes = new Set<string>();
    accounts.forEach(acc => {
      if (acc.currencyCode) codes.add(acc.currencyCode);
    });
    return Array.from(codes).sort();
  }, [accounts]);

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
          {t("expenses.filters") || "Filters"}
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
              {t("expenses.datePreset") || "Date Range"}
            </label>
            <select
              value={filters.datePreset}
              onChange={(e) => onDatePresetChange(e.target.value as DatePreset)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t("expenses.all") || "All"}</option>
              <option value="currentWeek">{t("expenses.currentWeek") || "Current Week"}</option>
              <option value="lastWeek">{t("expenses.lastWeek") || "Last Week"}</option>
              <option value="currentMonth">{t("expenses.currentMonth") || "Current Month"}</option>
              <option value="lastMonth">{t("expenses.lastMonth") || "Last Month"}</option>
              <option value="custom">{t("expenses.custom") || "Custom"}</option>
            </select>
          </div>

          {/* Date From */}
          {filters.datePreset === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t("expenses.dateFrom") || "Date From"}
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
                {t("expenses.dateTo") || "Date To"}
              </label>
              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => onFilterChange('dateTo', e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Account */}
          <SearchableSelect
            value={filters.accountId}
            onChange={(value) => onFilterChange('accountId', value)}
            options={accounts}
            placeholder={t("expenses.selectAccount") || "Type to search accounts..."}
            label={t("expenses.account") || "Account"}
            allOptionLabel={t("expenses.all") || "All"}
          />

          {/* Currency */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("expenses.currency") || "Currency"}
            </label>
            <select
              value={filters.currencyCode || ""}
              onChange={(e) => onFilterChange('currencyCode', e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t("expenses.all") || "All"}</option>
              {currencyCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          {/* Created By */}
          <SearchableSelect
            value={filters.createdBy}
            onChange={(value) => onFilterChange('createdBy', value)}
            options={users}
            placeholder={t("expenses.selectCreatedBy") || "Type to search users..."}
            label={t("expenses.createdBy") || "Created By"}
            allOptionLabel={t("expenses.all") || "All"}
          />

          {/* Tag Filter */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("expenses.tag") || "Tag"}
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
                    {t("expenses.noTagsAvailable") || "No tags available"}
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
              {t("expenses.clearFilters") || "Clear Filters"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

