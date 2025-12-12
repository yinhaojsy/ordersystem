import { useState, type FormEvent, useEffect, useRef } from "react";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import {
  useAddOrderMutation,
  useGetCurrenciesQuery,
  useGetCustomersQuery,
  useGetOrdersQuery,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
} from "../services/api";
import type { OrderStatus } from "../types";
import { formatDate } from "../utils/format";

export default function OrdersPage() {
  const { data: orders = [], isLoading } = useGetOrdersQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();

  const [addOrder, { isLoading: isSaving }] = useAddOrderMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const [form, setForm] = useState({
    customerId: "",
    fromCurrency: "",
    toCurrency: "",
    amountBuy: "",
    amountSell: "",
    rate: "",
    status: "pending" as OrderStatus,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.customerId || !form.fromCurrency || !form.toCurrency) return;
    await addOrder({
      customerId: Number(form.customerId),
      fromCurrency: form.fromCurrency,
      toCurrency: form.toCurrency,
      amountBuy: Number(form.amountBuy || 0),
      amountSell: Number(form.amountSell || 0),
      rate: Number(form.rate || 1),
      status: form.status,
    });
    setForm({
      customerId: "",
      fromCurrency: "",
      toCurrency: "",
      amountBuy: "",
      amountSell: "",
      rate: "",
      status: "pending",
    });
  };

  const setStatus = async (id: number, status: OrderStatus) => {
    await updateOrderStatus({ id, status });
    setOpenMenuId(null);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this order?")) {
      await deleteOrder(id);
      setOpenMenuId(null);
    }
  };

  // TODO: Replace with proper authentication check
  // For now, assuming admin access - should be replaced with actual user role check
  const isAdmin = true;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId !== null) {
        const menuElement = menuRefs.current[openMenuId];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Orders"
        description="Live orders with quick status updates."
        actions={isLoading ? "Loading..." : `${orders.length} orders`}
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
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
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
                  <td className="py-2">
                    <div
                      className="relative inline-block"
                      ref={(el) => {
                        menuRefs.current[order.id] = el;
                      }}
                    >
                      <button
                        className="flex items-center justify-center p-1 hover:bg-slate-100 rounded transition-colors"
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === order.id ? null : order.id
                          )
                        }
                        aria-label="Actions"
                      >
                        <svg
                          className="w-5 h-5 text-slate-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {openMenuId === order.id && (
                        <div className="absolute left-0 top-0 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-slate-50 first:rounded-t-lg"
                            onClick={() => setStatus(order.id, "completed")}
                          >
                            Complete
                          </button>
                          <button
                            className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-slate-50"
                            onClick={() => setStatus(order.id, "cancelled")}
                          >
                            Cancel
                          </button>
                          {isAdmin && (
                            <button
                              className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 last:rounded-b-lg border-t border-slate-200"
                              onClick={() => handleDelete(order.id)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={8}>
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Create order">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.customerId}
            onChange={(e) =>
              setForm((p) => ({ ...p, customerId: e.target.value }))
            }
            required
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option value={customer.id} key={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={form.fromCurrency}
              onChange={(e) =>
                setForm((p) => ({ ...p, fromCurrency: e.target.value }))
              }
              required
            >
              <option value="">From</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={form.toCurrency}
              onChange={(e) =>
                setForm((p) => ({ ...p, toCurrency: e.target.value }))
              }
              required
            >
              <option value="">To</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Amount buy"
              value={form.amountBuy}
              onChange={(e) =>
                setForm((p) => ({ ...p, amountBuy: e.target.value }))
              }
              required
              type="number"
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Amount sell"
              value={form.amountSell}
              onChange={(e) =>
                setForm((p) => ({ ...p, amountSell: e.target.value }))
              }
              required
              type="number"
            />
          </div>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Rate"
            value={form.rate}
            onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
            required
            type="number"
            step="0.0001"
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.status}
            onChange={(e) =>
              setForm((p) => ({ ...p, status: e.target.value as OrderStatus }))
            }
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            type="submit"
            disabled={isSaving}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save order"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
