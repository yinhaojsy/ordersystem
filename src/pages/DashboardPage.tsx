import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import StatCard from "../components/common/StatCard";
import DashboardStatistics from "../components/dashboard/DashboardStatistics";
import {
  useGetCurrenciesQuery,
  useGetCustomersQuery,
  useGetOrdersQuery,
  useGetUsersQuery,
} from "../services/api";
import { OrderStatus } from "../types";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: users = [] } = useGetUsersQuery();
  // Fetch all orders for accurate statistics (use a high limit to get all orders)
  const { data: ordersData, isLoading } = useGetOrdersQuery({ limit: 10000 });
  const orders = ordersData?.orders ?? [];
  const totalOrders = ordersData?.total ?? 0;

  const stats = useMemo(() => {
    // Ensure orders is an array
    const ordersArray = Array.isArray(orders) ? orders : [];

    const pendingStatuses: OrderStatus[] = [
      "pending",
      "under_process",
    ];

    const pending = ordersArray.filter((o) => pendingStatuses.includes(o.status)).length;
    const completed = ordersArray.filter((o) => o.status === "completed").length;
    const cancelled = ordersArray.filter((o) => o.status === "cancelled").length;

    return {
      currencies: currencies.length,
      customers: customers.length,
      users: users.length,
      orders: totalOrders, // Use total from API instead of array length
      pending,
      completed,
      cancelled,
    };
  }, [orders, totalOrders, currencies.length, customers.length, users.length]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("dashboard.currencies")} value={stats.currencies} tone="blue" />
        <StatCard label={t("dashboard.customers")} value={stats.customers} tone="emerald" />
        <StatCard label={t("dashboard.users")} value={stats.users} tone="slate" />
        <StatCard label={t("dashboard.orders")} value={stats.orders} tone="amber" />
        <StatCard label={t("dashboard.pending")} value={stats.pending} tone="amber" />
        <StatCard label={t("dashboard.completed")} value={stats.completed} tone="emerald" />
        <StatCard label={t("dashboard.cancelled")} value={stats.cancelled} tone="rose" />
      </div>

      {/* <DashboardStatistics /> */}
    </div>
  );
}


