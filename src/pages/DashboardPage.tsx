import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import StatCard from "../components/common/StatCard";
import {
  useGetCurrenciesQuery,
  useGetCustomersQuery,
  useGetOrdersQuery,
  useGetUsersQuery,
} from "../services/api";
import { formatDate } from "../utils/format";
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

  const recentOrders = Array.isArray(orders) ? orders.slice(0, 5) : [];

  const getStatusTone = (status: OrderStatus) => {
    switch (status) {
      case "pending":
      case "under_process":
        return "amber";
      case "completed":
        return "emerald";
      default:
        return "rose";
    }
  };

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

      <SectionCard
        title={t("dashboard.recentOrders")}
        description={t("dashboard.recentOrdersDesc")}
        actions={isLoading ? t("common.loading") : `${recentOrders.length} ${t("dashboard.shown")}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">{t("dashboard.customer")}</th>
                <th className="py-2">{t("dashboard.pair")}</th>
                <th className="py-2">{t("dashboard.buy")}</th>
                <th className="py-2">{t("dashboard.sell")}</th>
                <th className="py-2">{t("dashboard.rate")}</th>
                <th className="py-2">{t("dashboard.date")}</th>
                <th className="py-2">{t("dashboard.status")}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-2 font-semibold">
                    {order.customerName || order.customerId}
                  </td>
                  <td className="py-2">
                    {order.fromCurrency} → {order.toCurrency}
                  </td>
                  <td className="py-2">{order.amountBuy}</td>
                  <td className="py-2">{order.amountSell}</td>
                  <td className="py-2">{order.rate}</td>
                  <td className="py-2">{formatDate(order.createdAt)}</td>
                  <td className="py-2">
                    <Badge
                      tone={getStatusTone(order.status)}
                    >
                      {t(`orders.${order.status}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!recentOrders.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={7}>
                    {t("dashboard.noOrders")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}


