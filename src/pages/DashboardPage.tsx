import { useMemo } from "react";
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

export default function DashboardPage() {
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: users = [] } = useGetUsersQuery();
  const { data: orders = [], isLoading } = useGetOrdersQuery();

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;

    return {
      currencies: currencies.length,
      customers: customers.length,
      users: users.length,
      orders: orders.length,
      pending,
      completed,
      cancelled,
    };
  }, [orders, currencies.length, customers.length, users.length]);

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Currencies" value={stats.currencies} tone="blue" />
        <StatCard label="Customers" value={stats.customers} tone="emerald" />
        <StatCard label="Users" value={stats.users} tone="slate" />
        <StatCard label="Orders" value={stats.orders} tone="amber" />
        <StatCard label="Pending" value={stats.pending} tone="amber" />
        <StatCard label="Completed" value={stats.completed} tone="emerald" />
        <StatCard label="Cancelled" value={stats.cancelled} tone="rose" />
      </div>

      <SectionCard
        title="Recent orders"
        description="Latest activity across customers and pairs."
        actions={isLoading ? "Loading..." : `${recentOrders.length} shown`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">Customer</th>
                <th className="py-2">Pair</th>
                <th className="py-2">Buy</th>
                <th className="py-2">Sell</th>
                <th className="py-2">Rate</th>
                <th className="py-2">Date</th>
                <th className="py-2">Status</th>
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
                      tone={
                        order.status === "pending"
                          ? "amber"
                          : order.status === "completed"
                            ? "emerald"
                            : "rose"
                      }
                    >
                      {order.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!recentOrders.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={7}>
                    No orders yet.
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


