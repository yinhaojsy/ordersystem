import { useTableColumns, type ColumnDefinition } from "../useTableColumns";

const COLUMN_KEYS = ["id", "date", "description", "fromAccount", "toAccount", "amount", "transactionFee", "currency", "tags", "createdBy"];

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
    ],
    storagePrefix: "transfersPage",
  });
}

