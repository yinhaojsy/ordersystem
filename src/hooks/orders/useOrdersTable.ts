import { useTableColumns, type ColumnDefinition } from "../useTableColumns";

const COLUMN_KEYS = ["id", "date", "handler", "customer", "pair", "buy", "sell", "rate", "status", "orderType", "buyAccount", "sellAccount", "profit", "serviceCharges", "tags"];

// Default visible columns (excluding profit, serviceCharges, and tags)
const DEFAULT_VISIBLE_COLUMNS = ["id", "date", "handler", "customer", "pair", "buy", "sell", "rate", "status", "orderType", "buyAccount", "sellAccount"];

export type { ColumnDefinition };

export function useOrdersTable() {
  return useTableColumns({
    columnKeys: COLUMN_KEYS,
    getColumnDefinitions: (t) => [
      { key: "id", label: t("orders.orderId") },
      { key: "date", label: t("orders.date") },
      { key: "handler", label: t("orders.handler") },
      { key: "customer", label: t("orders.customer") },
      { key: "pair", label: t("orders.pair") },
      { key: "buy", label: t("orders.buy") },
      { key: "sell", label: t("orders.sell") },
      { key: "rate", label: t("orders.rate") },
      { key: "status", label: t("orders.status") },
      { key: "orderType", label: t("orders.orderType") },
      { key: "buyAccount", label: t("orders.buyAccount") },
      { key: "sellAccount", label: t("orders.sellAccount") },
      { key: "profit", label: t("orders.profit") },
      { key: "serviceCharges", label: t("orders.serviceCharges") },
      { key: "tags", label: t("orders.tags") },
    ],
    storagePrefix: "ordersPage",
    defaultVisibleColumns: DEFAULT_VISIBLE_COLUMNS,
  });
}

