import React, { useState, useEffect, useRef, useMemo } from "react";
import type { Account } from "../../types";

// Helper function to format currency with proper number formatting
const formatCurrency = (amount: number, currencyCode: string) => {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
};

interface AccountSelectProps {
  value: string; // accountId as string
  onChange: (accountId: string) => void;
  accounts: Account[];
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showBalance?: boolean;
  // Optional filters
  filterByCurrency?: string; // Only show accounts with this currency
  excludeAccountIds?: number[]; // Exclude these account IDs
  // Translation function
  t?: (key: string) => string;
}

export function AccountSelect({
  value,
  onChange,
  accounts,
  label,
  placeholder = "Select account",
  required = false,
  disabled = false,
  showBalance = true,
  filterByCurrency,
  excludeAccountIds = [],
  t = (key: string) => key,
}: AccountSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);

  // Favorite accounts management (stored in localStorage)
  const [favoriteAccountIds, setFavoriteAccountIds] = useState<number[]>(() => {
    const stored = localStorage.getItem("favoriteAccountIds");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem("favoriteAccountIds", JSON.stringify(favoriteAccountIds));
  }, [favoriteAccountIds]);

  const toggleFavorite = (accountId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteAccountIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  // Filter accounts based on props
  const baseAvailableAccounts = useMemo(() => {
    let filtered = accounts;
    
    if (filterByCurrency) {
      filtered = filtered.filter((a) => a.currencyCode === filterByCurrency);
    }
    
    if (excludeAccountIds.length > 0) {
      filtered = filtered.filter((a) => !excludeAccountIds.includes(a.id));
    }
    
    return filtered;
  }, [accounts, filterByCurrency, excludeAccountIds]);

  // Filter by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return baseAvailableAccounts;
    const query = searchQuery.toLowerCase();
    return baseAvailableAccounts.filter(
      (account) =>
        account.name.toLowerCase().includes(query) ||
        account.currencyCode.toLowerCase().includes(query) ||
        account.currencyName?.toLowerCase().includes(query)
    );
  }, [baseAvailableAccounts, searchQuery]);

  // Sort accounts: favorites first, then alphabetically
  const sortedAccounts = useMemo(() => {
    const favorites = filteredAccounts.filter((a) => favoriteAccountIds.includes(a.id));
    const nonFavorites = filteredAccounts.filter((a) => !favoriteAccountIds.includes(a.id));
    
    const sortByName = (a: Account, b: Account) => a.name.localeCompare(b.name);
    
    return [
      ...favorites.sort(sortByName),
      ...nonFavorites.sort(sortByName),
    ];
  }, [filteredAccounts, favoriteAccountIds]);

  // Reset highlighted index when dropdown closes or search changes
  useEffect(() => {
    if (!isDropdownOpen) {
      setHighlightedIndex(-1);
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isDropdownOpen && highlightedIndex >= 0 && dropdownListRef.current) {
      const optionElement = dropdownListRef.current.children[highlightedIndex] as HTMLElement;
      if (optionElement) {
        optionElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  const selectedAccount = accounts.find((a) => a.id === Number(value));

  const handleSelect = (accountId: number) => {
    onChange(String(accountId));
    setSearchQuery("");
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onChange("");
    setSearchQuery("");
    setIsDropdownOpen(true);
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative" ref={containerRef}>
        <input
          type="text"
          className={`w-full rounded-lg border border-slate-200 px-3 py-2 ${value ? "pr-20" : "pr-10"} ${disabled ? "bg-slate-100 cursor-not-allowed" : ""}`}
          placeholder={placeholder}
          value={
            isDropdownOpen
              ? searchQuery
              : value
              ? selectedAccount?.name || ""
              : ""
          }
          onFocus={() => {
            if (disabled) return;
            setIsDropdownOpen(true);
            if (value) {
              const selected = accounts.find((a) => a.id === Number(value));
              setSearchQuery(selected?.name || "");
            }
          }}
          onChange={(e) => {
            if (disabled) return;
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
            if (!e.target.value) {
              onChange("");
            }
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            
            if (!isDropdownOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
              e.preventDefault();
              setIsDropdownOpen(true);
              return;
            }

            if (!isDropdownOpen) return;

            switch (e.key) {
              case "ArrowDown":
                e.preventDefault();
                setHighlightedIndex((prev) => {
                  const next = prev < sortedAccounts.length - 1 ? prev + 1 : 0;
                  return next;
                });
                break;
              case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex((prev) => {
                  const next = prev > 0 ? prev - 1 : sortedAccounts.length - 1;
                  return next;
                });
                break;
              case "Enter":
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < sortedAccounts.length) {
                  const account = sortedAccounts[highlightedIndex];
                  handleSelect(account.id);
                }
                break;
              case "Escape":
                e.preventDefault();
                setIsDropdownOpen(false);
                setHighlightedIndex(-1);
                break;
            }
          }}
          required={required}
          disabled={disabled}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="absolute right-10 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 hover:text-slate-600 transition-colors"
            title={t("common.clear") || "Clear selection"}
          >
            <svg
              className="w-5 h-5"
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
        )}
        <svg
          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        
        {isDropdownOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {sortedAccounts.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                {t("expenses.noAccountsFound") || "No accounts found"}
              </div>
            ) : (
              <div ref={dropdownListRef}>
                {sortedAccounts.map((account, index) => {
                  const isFavorite = favoriteAccountIds.includes(account.id);
                  const isSelected = value === String(account.id);
                  const isHighlighted = highlightedIndex === index;
                  return (
                    <div
                      key={account.id}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                        isHighlighted
                          ? "bg-blue-100 text-blue-900"
                          : isSelected
                          ? "bg-blue-50"
                          : "hover:bg-slate-50"
                      }`}
                      onClick={() => handleSelect(account.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {account.name}
                        </div>
                        {showBalance && (
                          <div className="text-xs text-slate-500">
                            {formatCurrency(account.balance, account.currencyCode)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(account.id, e)}
                        className="ml-2 flex-shrink-0 p-1 hover:bg-slate-100 rounded transition-colors"
                        title={isFavorite ? (t("expenses.removeFavorite") || "Remove favorite") : (t("expenses.addFavorite") || "Add favorite")}
                      >
                        <svg
                          className={`w-5 h-5 ${
                            isFavorite
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {selectedAccount && showBalance && (
        <div className="mt-1 text-xs text-slate-500">
          {t("expenses.currentBalance") || "Current Balance"}:{" "}
          <span
            className={
              selectedAccount.balance < 0
                ? "text-red-600"
                : "text-slate-900"
            }
          >
            {formatCurrency(selectedAccount.balance, selectedAccount.currencyCode)}
          </span>
        </div>
      )}
    </div>
  );
}

