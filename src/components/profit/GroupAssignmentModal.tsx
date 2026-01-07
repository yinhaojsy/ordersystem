import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Account, ProfitAccountMultiplier } from "../../types";

interface GroupAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  availableGroups: string[];
  calculationId: number;
  multipliers: ProfitAccountMultiplier[];
  onCreateGroup: (groupName: string) => Promise<void>;
  onApply: (groupId: string, groupName: string, accountIds: number[]) => Promise<void>;
}

export function GroupAssignmentModal({
  isOpen,
  onClose,
  accounts,
  availableGroups,
  calculationId,
  multipliers,
  onCreateGroup,
  onApply,
}: GroupAssignmentModalProps) {
  const { t } = useTranslation();
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("all");
  const [checkedAccounts, setCheckedAccounts] = useState<Set<number>>(new Set());
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Get unique currency codes
  const currencyCodes = useMemo(() => {
    const codes = new Set<string>();
    accounts.forEach((acc) => codes.add(acc.currencyCode));
    return Array.from(codes).sort();
  }, [accounts]);

  // Filter accounts by selected currency
  const filteredAccounts = useMemo(() => {
    if (selectedCurrency === "all") {
      return accounts;
    }
    return accounts.filter((acc) => acc.currencyCode === selectedCurrency);
  }, [accounts, selectedCurrency]);

  // Load persisted state when modal opens or group changes
  useEffect(() => {
    if (isOpen && selectedGroup) {
      const storageKey = `groupAssignments_${calculationId}_${selectedGroup}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const accountIds = JSON.parse(saved) as number[];
          setCheckedAccounts(new Set(accountIds));
        } catch (e) {
          console.error("Error loading saved group assignments:", e);
        }
      } else {
        // If no saved state, load from current multipliers
        const groupId = `GROUP_${selectedGroup.toUpperCase().replace(/\s+/g, "_")}`;
        const accountsInGroup = multipliers
          .filter((m) => m.groupId === groupId || m.groupName === selectedGroup)
          .map((m) => m.accountId);
        setCheckedAccounts(new Set(accountsInGroup));
      }
    } else if (isOpen && !selectedGroup) {
      setCheckedAccounts(new Set());
    }
  }, [isOpen, selectedGroup, calculationId, multipliers]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedGroup("");
      setSelectedCurrency("all");
      setCheckedAccounts(new Set());
      setNewGroupName("");
      setShowNewGroupInput(false);
    }
  }, [isOpen]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      return;
    }

    setIsCreatingGroup(true);
    try {
      await onCreateGroup(newGroupName.trim());
      setSelectedGroup(newGroupName.trim());
      setNewGroupName("");
      setShowNewGroupInput(false);
    } catch (error: any) {
      // Error is handled by the parent component
      throw error;
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleToggleAccount = (accountId: number) => {
    setCheckedAccounts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (checkedAccounts.size === filteredAccounts.length) {
      setCheckedAccounts(new Set());
    } else {
      setCheckedAccounts(new Set(filteredAccounts.map((acc) => acc.id)));
    }
  };

  const handleApply = async () => {
    if (!selectedGroup) {
      return;
    }

    setIsApplying(true);
    try {
      const groupId = `GROUP_${selectedGroup.toUpperCase().replace(/\s+/g, "_")}`;
      const accountIds = Array.from(checkedAccounts);
      
      // Save to localStorage
      const storageKey = `groupAssignments_${calculationId}_${selectedGroup}`;
      localStorage.setItem(storageKey, JSON.stringify(accountIds));

      await onApply(groupId, selectedGroup, accountIds);
      onClose();
    } catch (error) {
      console.error("Error applying group assignments:", error);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      style={{ margin: 0, padding: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {t("profit.assignUnassignGroup") || "Assign/Unassign Group"}
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

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Left Panel - Groups */}
          <div className="w-1/3 border-r border-slate-200 pr-4 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {t("profit.groups") || "Groups"}
            </h3>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2">
                {availableGroups.map((groupName) => (
                  <button
                    key={groupName}
                    onClick={() => setSelectedGroup(groupName)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      selectedGroup === groupName
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {groupName}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              {!showNewGroupInput ? (
                <button
                  onClick={() => setShowNewGroupInput(true)}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                >
                  {t("profit.addGroup") || "Add Group"}
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    placeholder={t("profit.newGroupName") || "New Group Name"}
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateGroup();
                      } else if (e.key === "Escape") {
                        setShowNewGroupInput(false);
                        setNewGroupName("");
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateGroup}
                      disabled={isCreatingGroup || !newGroupName.trim()}
                      className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                    >
                      {isCreatingGroup ? t("common.saving") : t("common.save")}
                    </button>
                    <button
                      onClick={() => {
                        setShowNewGroupInput(false);
                        setNewGroupName("");
                      }}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Accounts */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t("profit.currencyPool") || "Currency Pool"}
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
              >
                <option value="all">{t("profit.all") || "All"}</option>
                {currencyCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              {selectedGroup ? (
                <>
                  <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      {t("profit.selectAccounts") || "Select Accounts"}
                    </span>
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {checkedAccounts.size === filteredAccounts.length
                        ? t("accounts.deselectAll") || "Deselect All"
                        : t("accounts.selectAll") || "Select All"}
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    {filteredAccounts.length === 0 ? (
                      <div className="text-sm text-slate-500 text-center py-4">
                        {t("accounts.noAccounts") || "No accounts found"}
                      </div>
                    ) : (
                      filteredAccounts.map((account) => (
                        <label
                          key={account.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checkedAccounts.has(account.id)}
                            onChange={() => handleToggleAccount(account.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900">
                              {account.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {account.currencyCode} - {account.balance.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} {account.currencyCode}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-sm text-slate-500 text-center py-8">
                  {t("profit.selectGroupFirst") || "Please select a group from the left panel"}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleApply}
                disabled={!selectedGroup || isApplying}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isApplying ? t("common.saving") : (t("common.apply") || "Apply")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

