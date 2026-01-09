import { useTableColumns, type ColumnDefinition } from "../useTableColumns";

const COLUMN_KEYS = ["id", "date", "description", "account", "amount", "currency", "proof", "tags", "createdBy", "updatedBy", "updatedAt"];

// Default visible columns (excluding updatedBy, updatedAt, and tags)
const DEFAULT_VISIBLE_COLUMNS = ["id", "date", "description", "account", "amount", "currency", "proof", "createdBy"];

export type { ColumnDefinition };

export function useExpensesTable() {
  return useTableColumns({
    columnKeys: COLUMN_KEYS,
    getColumnDefinitions: (t) => [
      { key: "id", label: t("expenses.expenseId") },
      { key: "date", label: t("expenses.date") },
      { key: "description", label: t("expenses.description") },
      { key: "account", label: t("expenses.account") },
      { key: "amount", label: t("expenses.amount") },
      { key: "currency", label: t("expenses.currency") },
      { key: "proof", label: t("expenses.proof") },
      { key: "tags", label: t("expenses.tags") },
      { key: "createdBy", label: t("expenses.createdBy") },
      { key: "updatedBy", label: t("expenses.updatedBy") },
      { key: "updatedAt", label: t("expenses.updatedAt") },
    ],
    storagePrefix: "expensesPage",
    defaultVisibleColumns: DEFAULT_VISIBLE_COLUMNS,
  });
}

