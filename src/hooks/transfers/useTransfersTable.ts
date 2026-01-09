import { useTableColumns, type ColumnDefinition } from "../useTableColumns";

const COLUMN_KEYS = ["id", "date", "description", "fromAccount", "toAccount", "amount", "transactionFee", "currency", "tags", "createdBy", "updatedBy", "updatedAt"];

// Default visible columns (excluding updatedBy, updatedAt, and tags)
const DEFAULT_VISIBLE_COLUMNS = ["id", "date", "description", "fromAccount", "toAccount", "amount", "transactionFee", "currency", "createdBy"];

export type { ColumnDefinition };

export function useTransfersTable() {
  return useTableColumns({
    columnKeys: COLUMN_KEYS,
    getColumnDefinitions: (t) => [
      { key: "id", label: t("transfers.transferId") },
      { key: "date", label: t("transfers.date") },
      { key: "description", label: t("transfers.description") },
      { key: "fromAccount", label: t("transfers.fromAccount") },
      { key: "toAccount", label: t("transfers.toAccount") },
      { key: "amount", label: t("transfers.amount") },
      { key: "transactionFee", label: t("transfers.transactionFee") },
      { key: "currency", label: t("transfers.currency") },
      { key: "tags", label: t("transfers.tags") },
      { key: "createdBy", label: t("transfers.createdBy") },
      { key: "updatedBy", label: t("transfers.updatedBy") },
      { key: "updatedAt", label: t("transfers.updatedAt") },
    ],
    storagePrefix: "transfersPage",
    defaultVisibleColumns: DEFAULT_VISIBLE_COLUMNS,
  });
}

