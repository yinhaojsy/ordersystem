import { useState, useEffect, useMemo, useCallback, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useGetAccountsQuery,
  useGetCurrenciesQuery,
  useGetProfitCalculationsQuery,
  useGetProfitCalculationQuery,
  useCreateProfitCalculationMutation,
  useUpdateProfitCalculationMutation,
  useDeleteProfitCalculationMutation,
  useUpdateAccountMultiplierMutation,
  useUpdateExchangeRateMutation,
  useDeleteGroupMutation,
  useRenameGroupMutation,
  useSetDefaultProfitCalculationMutation,
  useUnsetDefaultProfitCalculationMutation,
} from "../services/api";
import type { Account, ProfitAccountMultiplier, ProfitExchangeRate } from "../types";

// Helper function to format currency with proper number formatting
const formatCurrency = (amount: number, currencyCode: string) => {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
};

export default function ProfitCalculationPage() {
  const { t } = useTranslation();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetAccountsQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: calculations = [] } = useGetProfitCalculationsQuery();
  const [createCalculation, { isLoading: isCreating }] = useCreateProfitCalculationMutation();
  const [updateCalculation] = useUpdateProfitCalculationMutation();
  const [deleteCalculation, { isLoading: isDeleting }] = useDeleteProfitCalculationMutation();
  const [updateMultiplier] = useUpdateAccountMultiplierMutation();
  const [updateRate] = useUpdateExchangeRateMutation();
  const [deleteGroup] = useDeleteGroupMutation();
  const [renameGroup] = useRenameGroupMutation();
  const [setDefaultCalculation] = useSetDefaultProfitCalculationMutation();
  const [unsetDefaultCalculation] = useUnsetDefaultProfitCalculationMutation();

  const [selectedCalculationId, setSelectedCalculationId] = useState<number | null>(null);
  const [newCalculationName, setNewCalculationName] = useState("");
  const [newCalculationCurrency, setNewCalculationCurrency] = useState("");
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; calculationId: number | null }>({
    isOpen: false,
    message: "",
    calculationId: null,
  });
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [creatingGroupForAccount, setCreatingGroupForAccount] = useState<number | null>(null);
  const [createdGroups, setCreatedGroups] = useState<string[]>([]);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editingGroupNewName, setEditingGroupNewName] = useState("");
  const [deleteGroupModal, setDeleteGroupModal] = useState<{ isOpen: boolean; groupName: string | null }>({
    isOpen: false,
    groupName: null,
  });
  // Track multiplier input values to allow empty state
  const [multiplierInputs, setMultiplierInputs] = useState<Map<number, string>>(new Map());

  const { data: calculationDetails, refetch: refetchCalculation } = useGetProfitCalculationQuery(
    selectedCalculationId || 0,
    { skip: !selectedCalculationId }
  );

  // Reset createdGroups when calculation changes and sync with database groups
  useEffect(() => {
    setCreatedGroups([]);
    setMultiplierInputs(new Map()); // Reset multiplier inputs when calculation changes
    // Sync createdGroups with database groups when calculation loads
    if (calculationDetails?.groups) {
      // Groups from database will be shown via availableGroups
      // createdGroups is only for newly created groups not yet saved
    }
  }, [selectedCalculationId, calculationDetails]);

  // Real-time balance updates: Account balances are automatically updated via RTK Query cache
  // The useMemo hooks below will automatically recalculate when accounts change

  // Create a map of account multipliers for quick lookup
  const multiplierMap = useMemo(() => {
    if (!calculationDetails) return new Map<number, ProfitAccountMultiplier>();
    const map = new Map<number, ProfitAccountMultiplier>();
    calculationDetails.multipliers.forEach((m) => {
      map.set(m.accountId, m);
    });
    return map;
  }, [calculationDetails]);

  // Create a map of exchange rates
  const exchangeRateMap = useMemo(() => {
    if (!calculationDetails) return new Map<string, number>();
    const map = new Map<string, number>();
    calculationDetails.exchangeRates.forEach((er) => {
      const key = `${er.fromCurrencyCode}_${er.toCurrencyCode}`;
      map.set(key, er.rate);
    });
    return map;
  }, [calculationDetails]);

  // Get all unique group names
  const availableGroups = useMemo(() => {
    const groupSet = new Set<string>();
    // Get groups from database
    if (calculationDetails?.groups) {
      calculationDetails.groups.forEach((groupName) => {
        groupSet.add(groupName);
      });
    }
    // Get groups from multipliers (for backward compatibility)
    calculationDetails?.multipliers.forEach((m) => {
      if (m.groupName) {
        groupSet.add(m.groupName);
      }
    });
    // Also include groups that were created but not yet saved
    createdGroups.forEach((groupName) => {
      groupSet.add(groupName);
    });
    return Array.from(groupSet).sort();
  }, [calculationDetails, createdGroups]);

  // Calculate account values with current balances
  const accountCalculations = useMemo(() => {
    if (!calculationDetails) return [];
    
    return accounts.map((account) => {
      const multiplier = multiplierMap.get(account.id);
      // Check if there's a local input value (empty string means 0)
      const inputValue = multiplierInputs.get(account.id);
      let mult: number;
      if (inputValue !== undefined) {
        // If input is empty string, treat as 0, otherwise parse the value
        mult = inputValue === "" ? 0 : (isNaN(parseFloat(inputValue)) ? (multiplier?.multiplier ?? 1.0) : parseFloat(inputValue));
      } else {
        mult = multiplier?.multiplier ?? 1.0;
      }
      const calculated = account.balance * mult;
      
      return {
        account,
        multiplier: multiplier || null,
        calculated,
        groupId: multiplier?.groupId || null,
        groupName: multiplier?.groupName || null,
        effectiveMultiplier: mult, // Store the effective multiplier for display
      };
    });
  }, [accounts, calculationDetails, multiplierMap, multiplierInputs]);

  // Group accounts by groupId
  const groupedAccounts = useMemo(() => {
    const groups = new Map<string, typeof accountCalculations>();
    
    accountCalculations.forEach((item) => {
      const groupId = item.groupId || "ungrouped";
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(item);
    });
    
    return groups;
  }, [accountCalculations]);

  // Calculate group sums by currency
  const groupSums = useMemo(() => {
    const sums = new Map<string, Map<string, number>>(); // groupId -> currency -> sum
    
    groupedAccounts.forEach((items, groupId) => {
      if (groupId) { // Type guard to ensure groupId is not null
        const currencySums = new Map<string, number>();
        items.forEach((item) => {
          const currency = item.account.currencyCode;
          const current = currencySums.get(currency) || 0;
          currencySums.set(currency, current + item.calculated);
        });
        sums.set(groupId, currencySums);
      }
    });
    
    return sums;
  }, [groupedAccounts]);

  // Get unique currencies from groups
  const uniqueCurrencies = useMemo(() => {
    const currenciesSet = new Set<string>();
    accountCalculations.forEach((item) => {
      if (item.groupId) {
        currenciesSet.add(item.account.currencyCode);
      }
    });
    return Array.from(currenciesSet);
  }, [accountCalculations]);

  // Calculate converted amounts
  const convertedAmounts = useMemo(() => {
    if (!calculationDetails) return new Map<string, number>();
    
    const converted = new Map<string, number>(); // currency -> converted amount
    
    groupSums.forEach((currencySums, groupId) => {
      currencySums.forEach((sum, currency) => {
        if (currency === calculationDetails.targetCurrencyCode) {
          // Same currency, no conversion needed
          const current = converted.get(currency) || 0;
          converted.set(currency, current + sum);
        } else {
          // Need to convert
          const key = `${currency}_${calculationDetails.targetCurrencyCode}`;
          const rate = exchangeRateMap.get(key) || 0;
          if (rate > 0) {
            const convertedAmount = sum * rate;
            const current = converted.get(calculationDetails.targetCurrencyCode) || 0;
            converted.set(calculationDetails.targetCurrencyCode, current + convertedAmount);
          }
        }
      });
    });
    
    return converted;
  }, [calculationDetails, groupSums, exchangeRateMap]);

  // Calculate total converted amount
  const totalConverted = useMemo(() => {
    if (!calculationDetails) return 0;
    return convertedAmounts.get(calculationDetails.targetCurrencyCode) || 0;
  }, [calculationDetails, convertedAmounts]);

  // Calculate profit
  const profit = useMemo(() => {
    if (!calculationDetails) return 0;
    return totalConverted - calculationDetails.initialInvestment;
  }, [calculationDetails, totalConverted]);

  const handleCreateCalculation = async () => {
    if (!newCalculationName || !newCalculationCurrency) {
      setAlertModal({
        isOpen: true,
        message: t("profit.nameAndCurrencyRequired"),
        type: "error",
      });
      return;
    }

    try {
      const result = await createCalculation({
        name: newCalculationName,
        targetCurrencyCode: newCalculationCurrency,
        initialInvestment: 0,
      }).unwrap();
      setSelectedCalculationId(result.id);
      setNewCalculationName("");
      setNewCalculationCurrency("");
      setAlertModal({
        isOpen: true,
        message: t("profit.calculationCreated"),
        type: "success",
      });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorCreating"),
        type: "error",
      });
    }
  };

  const handleDeleteClick = (id: number) => {
    const calculation = calculations.find((c) => c.id === id);
    setConfirmModal({
      isOpen: true,
      message: t("profit.confirmDelete") || `Are you sure you want to delete ${calculation?.name}?`,
      calculationId: id,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCalculation(id).unwrap();
      if (selectedCalculationId === id) {
        setSelectedCalculationId(null);
      }
      setConfirmModal({ isOpen: false, message: "", calculationId: null });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorDeleting"),
        type: "error",
      });
    }
  };

  const handleMultiplierChange = async (accountId: number, multiplier: number, groupId?: string, groupName?: string) => {
    if (!selectedCalculationId) return;
    
    try {
      await updateMultiplier({
        calculationId: selectedCalculationId,
        accountId,
        multiplier,
        groupId,
        groupName,
      }).unwrap();
      // Clear the local input for this account so it syncs with database value
      setMultiplierInputs((prev) => {
        const newMap = new Map(prev);
        newMap.delete(accountId);
        return newMap;
      });
      // Refetch to update UI immediately
      refetchCalculation();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorUpdatingMultiplier"),
        type: "error",
      });
    }
  };

  const handleExchangeRateChange = async (fromCurrency: string, toCurrency: string, rate: number) => {
    if (!selectedCalculationId) return;
    
    try {
      await updateRate({
        calculationId: selectedCalculationId,
        fromCurrencyCode: fromCurrency,
        toCurrencyCode: toCurrency,
        rate,
      }).unwrap();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorUpdatingRate"),
        type: "error",
      });
    }
  };

  const handleInitialInvestmentChange = async (investment: number) => {
    if (!selectedCalculationId || !calculationDetails) return;
    
    try {
      await updateCalculation({
        id: selectedCalculationId,
        data: { initialInvestment: investment },
      }).unwrap();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorUpdating"),
        type: "error",
      });
    }
  };

  const handleEditGroup = (groupName: string) => {
    setEditingGroupName(groupName);
    setEditingGroupNewName(groupName);
  };

  const handleSaveGroupEdit = async () => {
    if (!selectedCalculationId || !editingGroupName || !editingGroupNewName.trim()) {
      setEditingGroupName(null);
      setEditingGroupNewName("");
      return;
    }

    if (editingGroupName === editingGroupNewName.trim()) {
      setEditingGroupName(null);
      setEditingGroupNewName("");
      return;
    }

    try {
      await renameGroup({
        calculationId: selectedCalculationId,
        oldGroupName: editingGroupName,
        newGroupName: editingGroupNewName.trim(),
      }).unwrap();
      refetchCalculation();
      setEditingGroupName(null);
      setEditingGroupNewName("");
      setAlertModal({
        isOpen: true,
        message: t("profit.groupRenamed") || `Group renamed successfully.`,
        type: "success",
      });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorRenamingGroup") || "Error renaming group",
        type: "error",
      });
    }
  };

  const handleCancelGroupEdit = () => {
    setEditingGroupName(null);
    setEditingGroupNewName("");
  };

  const handleDeleteGroupClick = (groupName: string) => {
    setDeleteGroupModal({
      isOpen: true,
      groupName,
    });
  };

  const handleDeleteGroup = async () => {
    if (!selectedCalculationId || !deleteGroupModal.groupName) {
      setDeleteGroupModal({ isOpen: false, groupName: null });
      return;
    }

    try {
      await deleteGroup({
        calculationId: selectedCalculationId,
        groupName: deleteGroupModal.groupName,
      }).unwrap();
      refetchCalculation();
      setDeleteGroupModal({ isOpen: false, groupName: null });
      setAlertModal({
        isOpen: true,
        message: t("profit.groupDeleted") || `Group deleted successfully. Accounts have been unassigned.`,
        type: "success",
      });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorDeletingGroup") || "Error deleting group",
        type: "error",
      });
    }
  };

  const handleGroupNameChange = async (accountId: number, groupId: string, groupName: string) => {
    const multiplier = multiplierMap.get(accountId);
    // If no multiplier exists, create one with default value of 1.0
    const multiplierValue = multiplier?.multiplier ?? 1.0;
    
    await handleMultiplierChange(accountId, multiplierValue, groupId, groupName);
  };

  const handleGroupSelect = async (accountId: number, groupName: string) => {
    const newGroupId = groupName ? `GROUP_${groupName.toUpperCase().replace(/\s+/g, "_")}` : "";
    await handleGroupNameChange(accountId, newGroupId, groupName);
  };

  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim() || !selectedCalculationId) {
      setShowNewGroupInput(false);
      setNewGroupName("");
      setCreatingGroupForAccount(null);
      return;
    }
    
    const groupNameTrimmed = newGroupName.trim();
    
    // Check if group already exists
    const existingGroups = new Set<string>();
    if (calculationDetails?.groups) {
      calculationDetails.groups.forEach((g) => existingGroups.add(g));
    }
    calculationDetails?.multipliers.forEach((m) => {
      if (m.groupName) {
        existingGroups.add(m.groupName);
      }
    });
    createdGroups.forEach((g) => existingGroups.add(g));
    
    if (existingGroups.has(groupNameTrimmed)) {
      setAlertModal({
        isOpen: true,
        message: t("profit.groupAlreadyExists") || `Group "${groupNameTrimmed}" already exists.`,
        type: "warning",
      });
      setShowNewGroupInput(false);
      setNewGroupName("");
      setCreatingGroupForAccount(null);
      return;
    }
    
    try {
      // Get current groups from database
      const currentGroups = calculationDetails?.groups || [];
      const updatedGroups = [...currentGroups, groupNameTrimmed];
      
      // Save to database
      await updateCalculation({
        id: selectedCalculationId,
        data: { groups: updatedGroups },
      }).unwrap();
      
      // Refetch to update UI immediately
      refetchCalculation();
      
      // If we're creating a group for a specific account, assign it immediately
      if (creatingGroupForAccount !== null) {
        const newGroupId = `GROUP_${groupNameTrimmed.toUpperCase().replace(/\s+/g, "_")}`;
        await handleGroupNameChange(creatingGroupForAccount, newGroupId, groupNameTrimmed);
      }
      
      setShowNewGroupInput(false);
      setNewGroupName("");
      setCreatingGroupForAccount(null);
      
      setAlertModal({
        isOpen: true,
        message: t("profit.groupCreated") || `Group "${groupNameTrimmed}" created. You can now assign accounts to it.`,
        type: "success",
      });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        message: error?.data?.message || t("profit.errorCreatingGroup") || "Error creating group",
        type: "error",
      });
    }
  };

  // Find default calculation
  const defaultCalculation = calculations.find((calc) => calc.isDefault === 1 || calc.isDefault === true);
  const { data: defaultCalculationDetails } = useGetProfitCalculationQuery(
    defaultCalculation?.id || 0,
    { skip: !defaultCalculation }
  );

  // Calculate summary data for default calculation
  const defaultSummary = useMemo(() => {
    if (!defaultCalculationDetails) return null;

    const defaultMultiplierMap = new Map<number, ProfitAccountMultiplier>();
    defaultCalculationDetails.multipliers.forEach((m) => {
      defaultMultiplierMap.set(m.accountId, m);
    });

    const defaultExchangeRateMap = new Map<string, number>();
    defaultCalculationDetails.exchangeRates.forEach((er) => {
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
      const currencySums = new Map<string, number>();
      groupAccounts.forEach((calc) => {
        const currency = calc.account.currencyCode;
        currencySums.set(currency, (currencySums.get(currency) || 0) + calc.calculated);
      });
      groupSums.set(groupId, currencySums);
    });

    // Calculate converted amounts
    const convertedAmounts = new Map<string, number>();
    const uniqueCurrencies = Array.from(new Set(accounts.map((a) => a.currencyCode)));
    uniqueCurrencies.forEach((currency) => {
      const key = `${currency}_${defaultCalculationDetails.targetCurrencyCode}`;
      const defaultRate = currency === defaultCalculationDetails.targetCurrencyCode ? 1 : 0;
      const rate = defaultExchangeRateMap.get(key) || defaultRate;
      const currencySum = Array.from(groupSums.values())
        .reduce((sum, currencySums) => sum + (currencySums.get(currency) || 0), 0);
      const converted = rate > 0 ? currencySum * rate : currencySum;
      convertedAmounts.set(currency, converted);
    });

    const totalConverted = Array.from(convertedAmounts.values()).reduce((sum, val) => sum + val, 0);
    const totalInvestment = defaultCalculationDetails.initialInvestment || 0;
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
        const key = `${currency}_${defaultCalculationDetails.targetCurrencyCode}`;
        const defaultRate = currency === defaultCalculationDetails.targetCurrencyCode ? 1 : 0;
        const rate = defaultExchangeRateMap.get(key) || defaultRate;
        const converted = rate > 0 ? sum * rate : sum;
        groupTotal += converted;
      });
      groupConvertedTotals.set(groupId, groupTotal);
    });

    return {
      groupSums,
      groupNames,
      groupConvertedTotals,
      totalConverted,
      totalInvestment,
      totalProfit,
      targetCurrency: defaultCalculationDetails.targetCurrencyCode,
      exchangeRateMap: defaultExchangeRateMap,
    };
  }, [defaultCalculationDetails, accounts]);

  return (
    <div className="space-y-6">
      {/* Default Calculation Summary */}
      {defaultCalculation && defaultSummary && (
        <SectionCard
          title={t("profit.defaultCalculationSummary") || `Default Calculation: ${defaultCalculation.name}`}
          description={t("profit.defaultCalculationSummaryDesc") || "Summary of the default profit calculation"}
        >
          <div className="space-y-4">
            {/* Group Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(defaultSummary.groupSums.entries())
                .filter(([groupId]) => groupId !== "ungrouped")
                .map(([groupId, currencySums]) => {
                  const groupName = defaultSummary.groupNames.get(groupId) || groupId;
                  const convertedTotal = defaultSummary.groupConvertedTotals.get(groupId) || 0;
                  return (
                    <div
                      key={groupId}
                      className="p-4 border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900">{groupName}</span>
                      </div>
                      <div className="space-y-1">
                        {Array.from(currencySums.entries()).map(([currency, sum]) => {
                          const key = `${currency}_${defaultSummary.targetCurrency}`;
                          const defaultRate = currency === defaultSummary.targetCurrency ? 1 : 0;
                          const rate = defaultSummary.exchangeRateMap.get(key) || defaultRate;
                          const converted = rate > 0 ? sum * rate : sum;
                          return (
                            <div key={currency} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-600">{currency}:</span>
                                <span className="font-semibold">{formatCurrency(sum, currency)}</span>
                              </div>

                             {/*  SHOW →HKD AMOUNT IN HKD FOR CURRENCY THAT IS NOT HKD, COMMENTED OUT BECAUSE TOTAL ALREADY SHOWN
                              {currency !== defaultSummary.targetCurrency && rate > 0 && (
                                <div className="flex justify-between text-xs text-slate-500 ml-2">
                                  <span>→ {defaultSummary.targetCurrency}:</span>
                                  <span>{formatCurrency(converted, defaultSummary.targetCurrency)}</span>
                                </div>
                              )} */}
                            </div>
                          );
                        })}
                        <div className="pt-2 border-t border-slate-200 mt-2">
                          <div className="flex justify-between">
                            <span className="text-slate-700 font-semibold">
                              {t("profit.total") || "Total"} ({defaultSummary.targetCurrency}):
                            </span>
                            <span className="font-bold text-slate-900">
                              {formatCurrency(convertedTotal, defaultSummary.targetCurrency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Totals */}
            <div className="border-t-2 border-slate-300 pt-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-blue-50">
                  <div className="text-sm font-semibold text-slate-700 mb-1">
                    {t("profit.totalConverted") || "Total Converted"}
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {formatCurrency(defaultSummary.totalConverted, defaultSummary.targetCurrency)}
                  </div>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="text-sm font-semibold text-slate-700 mb-1">
                    {t("profit.totalInvestment") || "Total Investment"}
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(defaultSummary.totalInvestment, defaultSummary.targetCurrency)}
                  </div>
                </div>
                <div className={`p-4 border border-slate-200 rounded-lg ${
                  defaultSummary.totalProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"
                }`}>
                  <div className="text-sm font-semibold text-slate-700 mb-1">
                    {t("profit.totalProfit") || "Total Profit"}
                  </div>
                  <div className={`text-2xl font-bold ${
                    defaultSummary.totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}>
                    {formatCurrency(defaultSummary.totalProfit, defaultSummary.targetCurrency)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Calculation Selection */}
      <SectionCard
        title={t("profit.calculationSelection")}
        description={t("profit.calculationSelectionDesc")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t("profit.selectCalculation")}
            </label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={selectedCalculationId || ""}
              onChange={(e) => setSelectedCalculationId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("profit.selectCalculation")}</option>
              {calculations.map((calc) => (
                <option key={calc.id} value={calc.id}>
                  {calc.name}
                </option>
              ))}
            </select>
          </div>
          {selectedCalculationId && (
            <div className="flex items-end gap-2">
              {(() => {
                const selectedCalc = calculations.find((c) => c.id === selectedCalculationId);
                const isDefault = selectedCalc?.isDefault === 1 || selectedCalc?.isDefault === true;
                return (
                  <button
                    onClick={async () => {
                      try {
                        if (isDefault) {
                          await unsetDefaultCalculation({ id: selectedCalculationId }).unwrap();
                          setAlertModal({
                            isOpen: true,
                            message: t("profit.defaultUnset") || "Default calculation unset successfully",
                            type: "success",
                          });
                        } else {
                          await setDefaultCalculation({ id: selectedCalculationId }).unwrap();
                          setAlertModal({
                            isOpen: true,
                            message: t("profit.defaultSet") || "Default calculation set successfully",
                            type: "success",
                          });
                        }
                      } catch (error: any) {
                        setAlertModal({
                          isOpen: true,
                          message: error?.data?.message || t("profit.errorSettingDefault") || "Error setting default calculation",
                          type: "error",
                        });
                      }
                    }}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                      isDefault
                        ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                        : "border-blue-300 text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    {isDefault ? (t("profit.unsetDefault") || "Unset Default") : (t("profit.setDefault") || "Set as Default")}
                  </button>
                );
              })()}
              <button
                onClick={() => handleDeleteClick(selectedCalculationId)}
                disabled={isDeleting}
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                {t("common.delete")}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("profit.createNew")}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("profit.calculationName")}
              value={newCalculationName}
              onChange={(e) => setNewCalculationName(e.target.value)}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={newCalculationCurrency}
              onChange={(e) => setNewCalculationCurrency(e.target.value)}
            >
              <option value="">{t("profit.selectTargetCurrency")}</option>
              {currencies
                .filter((c) => Boolean(c.active))
                .map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
            </select>
            <button
              onClick={handleCreateCalculation}
              disabled={isCreating || !newCalculationName || !newCalculationCurrency}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {isCreating ? t("common.saving") : t("profit.createCalculation")}
            </button>
          </div>
        </div>
      </SectionCard>

      {selectedCalculationId && calculationDetails && (
        <>
          {/* Accounts with Multipliers */}
          <SectionCard
            title={t("profit.accountsWithMultipliers")}
            description={t("profit.accountsWithMultipliersDesc")}
          >
            {isLoadingAccounts ? (
              <div className="text-sm text-slate-500">{t("common.loading")}</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  accounts.reduce((acc, account) => {
                    if (!acc[account.currencyCode]) {
                      acc[account.currencyCode] = [];
                    }
                    acc[account.currencyCode].push(account);
                    return acc;
                  }, {} as Record<string, Account[]>)
                ).map(([currencyCode, currencyAccounts]) => {
                  const currency = currencies.find((c) => c.code === currencyCode);
                  return (
                    <div
                      key={currencyCode}
                      className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                    >
                      <h3 className="text-lg font-semibold text-slate-900 mb-3">
                        {currencyCode} {t("profit.currencyPool")}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-600">
                              <th className="py-2">{t("profit.accountName")}</th>
                              <th className="py-2">{t("profit.funds")}</th>
                              <th className="py-2">{t("profit.multiplier")}</th>
                              <th className="py-2">{t("profit.calculated")}</th>
                              <th className="py-2">{t("profit.group")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currencyAccounts.map((account) => {
                              const calc = accountCalculations.find((c) => c.account.id === account.id);
                              const mult = calc?.effectiveMultiplier ?? 1.0;
                              const calculated = calc?.calculated ?? (account.balance * mult);
                              const groupId = calc?.groupId || "";
                              const groupName = calc?.groupName || "";
                              
                              // Get the display value for the input
                              const inputValue = multiplierInputs.get(account.id);
                              const displayValue = inputValue !== undefined ? inputValue : mult.toString();
                              
                              return (
                                <tr key={account.id} className="border-b border-slate-100">
                                  <td className="py-2 font-semibold">{account.name}</td>
                                  <td className="py-2">
                                    {formatCurrency(account.balance, currencyCode)}
                                  </td>
                                  <td className="py-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="w-24 rounded border border-slate-200 px-2 py-1"
                                      value={displayValue}
                                      onChange={(e) => {
                                        const inputValue = e.target.value;
                                        // Update local state immediately for responsive UI
                                        setMultiplierInputs((prev) => {
                                          const newMap = new Map(prev);
                                          newMap.set(account.id, inputValue);
                                          return newMap;
                                        });
                                        
                                        // Parse and save to backend
                                        const parsed = parseFloat(inputValue);
                                        const newMult = inputValue === "" ? 0 : (isNaN(parsed) ? 1.0 : Math.max(0, parsed));
                                        handleMultiplierChange(account.id, newMult, groupId || undefined, groupName || undefined);
                                      }}
                                      onBlur={(e) => {
                                        // When field loses focus, if empty, save 0
                                        const inputValue = e.target.value;
                                        if (inputValue === "") {
                                          handleMultiplierChange(account.id, 0, groupId || undefined, groupName || undefined);
                                        }
                                      }}
                                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                    />
                                  </td>
                                  <td className="py-2 font-semibold">
                                    {formatCurrency(calculated, currencyCode)}
                                  </td>
                                  <td className="py-2">
                                    <select
                                      key={`group-select-${account.id}-${availableGroups.length}`}
                                      className="w-40 rounded border border-slate-200 px-2 py-1 text-sm"
                                      value={groupName || ""}
                                      onChange={(e) => {
                                        if (e.target.value === "") {
                                          handleGroupNameChange(account.id, "", "");
                                        } else {
                                          handleGroupSelect(account.id, e.target.value);
                                        }
                                      }}
                                    >
                                      <option value="">{t("profit.noGroup")}</option>
                                      {availableGroups.map((g: string) => (
                                        <option key={g} value={g}>
                                          {g}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Groups Section */}
          <SectionCard
            title={t("profit.groups")}
            description={t("profit.groupsDesc")}
            actions={
              <div className="flex gap-2">
                {!showNewGroupInput ? (
                  <button
                    onClick={() => {
                      setShowNewGroupInput(true);
                      setCreatingGroupForAccount(null);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  >
                    {t("profit.createNewGroup")}
                  </button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder={t("profit.newGroupName")}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateNewGroup();
                        } else if (e.key === "Escape") {
                          setShowNewGroupInput(false);
                          setNewGroupName("");
                          setCreatingGroupForAccount(null);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleCreateNewGroup}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                    >
                      {t("common.save")}
                    </button>
                    <button
                      onClick={() => {
                        setShowNewGroupInput(false);
                        setNewGroupName("");
                        setCreatingGroupForAccount(null);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                )}
              </div>
            }
          >
            {availableGroups.length === 0 ? (
              <div className="text-sm text-slate-500">{t("profit.noGroups")}</div>
            ) : (
              availableGroups.map((groupName) => {
                // Find the groupId for this group name
                const groupId = `GROUP_${groupName.toUpperCase().replace(/\s+/g, "_")}`;
                const items = groupedAccounts.get(groupId) || [];
                const currencySums = groupSums.get(groupId) || new Map();
                
                return (
                  <div key={groupName} className="border border-slate-200 rounded-lg p-4 bg-white mb-4">
                    <div className="flex justify-between items-center mb-3">
                      {editingGroupName === groupName ? (
                        <div className="flex gap-2 items-center flex-1">
                          <input
                            type="text"
                            className="flex-1 rounded border border-slate-200 px-3 py-2 text-sm font-semibold"
                            value={editingGroupNewName}
                            onChange={(e) => setEditingGroupNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveGroupEdit();
                              } else if (e.key === "Escape") {
                                handleCancelGroupEdit();
                              }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={handleSaveGroupEdit}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                            title={t("common.save")}
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelGroupEdit}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            title={t("common.cancel")}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-slate-900">{groupName}</h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditGroup(groupName)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              title={t("common.edit")}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              onClick={() => handleDeleteGroupClick(groupName)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                              title={t("common.delete")}
                            >
                              {t("common.delete")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {items.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-4">
                          {items.map((item) => (
                            <div key={item.account.id} className="flex justify-between text-sm">
                              <span>
                                {item.account.name}: {formatCurrency(item.account.balance, item.account.currencyCode)} × {item.multiplier?.multiplier.toFixed(2) || "1.00"} = {formatCurrency(item.calculated, item.account.currencyCode)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-slate-200 pt-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {t("profit.groupSum")}:
                            {Array.from(currencySums.entries()).map(([currency, sum]) => (
                              <span key={currency} className="ml-2">
                                {formatCurrency(sum, currency)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-500 italic">
                        {t("profit.noAccountsInGroup") || "No accounts assigned to this group"}
                        <div className="mt-2 text-xs">
                          {t("profit.groupSum")}: {calculationDetails?.targetCurrencyCode ? formatCurrency(0, calculationDetails.targetCurrencyCode) : "0.00"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </SectionCard>

          {/* Currency Conversion */}
          <SectionCard
            title={t("profit.currencyConversion")}
            description={t("profit.currencyConversionDesc")}
          >
            <div className="space-y-4">
              {uniqueCurrencies.map((currency) => {
                const key = `${currency}_${calculationDetails.targetCurrencyCode}`;
                // For same currency, default rate to 1 if not set
                const defaultRate = currency === calculationDetails.targetCurrencyCode ? 1 : 0;
                const rate = exchangeRateMap.get(key) || defaultRate;
                const currencySum = Array.from(groupSums.values())
                  .reduce((sum, currencySums) => sum + (currencySums.get(currency) || 0), 0);
                const converted = rate > 0 ? currencySum * rate : currencySum;
                
                return (
                  <div key={currency} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          {currency} {t("profit.sum")}
                        </label>
                        <div className="text-lg font-semibold">
                          {formatCurrency(currencySum, currency)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          {t("profit.exchangeRate")} ({currency} → {calculationDetails.targetCurrencyCode})
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          className="w-full rounded border border-slate-200 px-2 py-1"
                          value={rate > 0 ? rate : (currency === calculationDetails.targetCurrencyCode ? 1 : "")}
                          onChange={(e) => {
                            const newRate = parseFloat(e.target.value) || (currency === calculationDetails.targetCurrencyCode ? 1 : 0);
                            handleExchangeRateChange(currency, calculationDetails.targetCurrencyCode, newRate);
                          }}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          {t("profit.converted")} ({calculationDetails.targetCurrencyCode})
                        </label>
                        <div className="text-lg font-bold">
                          {formatCurrency(converted, calculationDetails.targetCurrencyCode)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <div className="border-t-2 border-slate-300 pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-slate-900">
                    {t("profit.totalConverted")} ({calculationDetails.targetCurrencyCode}):
                  </span>
                  <span className="text-2xl font-bold text-slate-900">
                    {formatCurrency(totalConverted, calculationDetails.targetCurrencyCode)}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Final Profit Calculation */}
          <SectionCard
            title={t("profit.finalProfit")}
            description={t("profit.finalProfitDesc")}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {t("profit.initialInvestment")} ({calculationDetails.targetCurrencyCode})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full md:w-64 rounded-lg border border-slate-200 px-3 py-2"
                  value={calculationDetails.initialInvestment}
                  onChange={(e) => {
                    const investment = parseFloat(e.target.value) || 0;
                    handleInitialInvestmentChange(investment);
                  }}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="text-sm text-slate-600 mb-1">{t("profit.totalConverted")}</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(totalConverted, calculationDetails.targetCurrencyCode)}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="text-sm text-slate-600 mb-1">{t("profit.initialInvestment")}</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(calculationDetails.initialInvestment, calculationDetails.targetCurrencyCode)}
                  </div>
                </div>
              </div>
              
              <div className="border-t-2 border-slate-300 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold text-slate-900">
                    {t("profit.profit")}:
                  </span>
                  <span className={`text-3xl font-bold ${
                    profit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}>
                    {formatCurrency(profit, calculationDetails.targetCurrencyCode)}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {!selectedCalculationId && (
        <div className="text-center py-12 text-slate-500">
          {t("profit.selectOrCreateCalculation")}
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type || "error"}
        onClose={() => setAlertModal({ isOpen: false, message: "", type: "error" })}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={() => confirmModal.calculationId && handleDelete(confirmModal.calculationId)}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", calculationId: null })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />

      <ConfirmModal
        isOpen={deleteGroupModal.isOpen}
        message={deleteGroupModal.groupName ? t("profit.confirmDeleteGroup")?.replace("{groupName}", deleteGroupModal.groupName) || `Are you sure you want to delete the group "${deleteGroupModal.groupName}"? All accounts in this group will be unassigned.` : ""}
        onConfirm={handleDeleteGroup}
        onCancel={() => setDeleteGroupModal({ isOpen: false, groupName: null })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}

