import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/common/StatCard";
import DashboardStatistics from "../components/dashboard/DashboardStatistics";
import {
  useGetCurrenciesQuery,
  useGetCustomersQuery,
  useGetOrdersQuery,
  useGetUsersQuery,
  useListApprovalRequestsQuery,
} from "../services/api";
import { OrderStatus } from "../types";
import { useAppSelector } from "../app/hooks";
import { canApproveDelete, canApproveEdit } from "../utils/orderPermissions";

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: users = [] } = useGetUsersQuery();
  // Fetch all orders for accurate statistics (use a high limit to get all orders)
  const { data: ordersData, isLoading } = useGetOrdersQuery({ limit: 10000 });
  const orders = ordersData?.orders ?? [];
  const totalOrders = ordersData?.total ?? 0;

  // Fetch approval requests if user has approval permissions
  // Fetch all requests (no status filter) to calculate both pending and approved counts
  const canApproveDeleteRequests = canApproveDelete(authUser);
  const canApproveEditRequests = canApproveEdit(authUser);
  const hasApprovalPermissions = canApproveDeleteRequests || canApproveEditRequests;
  const { data: approvalRequests = [] } = useListApprovalRequestsQuery(
    { status: "all" },
    { skip: !hasApprovalPermissions }
  );

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

  const handleTotalOrdersClick = () => {
    navigate("/orders");
  };

  const handlePendingOrdersClick = () => {
    navigate("/orders", {
      state: {
        initialFilters: {
          status: "pending" as OrderStatus,
          // Special flag to indicate we want both pending and under_process
          includeUnderProcess: true,
        },
      },
    });
  };

  const handleCompletedOrdersClick = () => {
    navigate("/orders", {
      state: {
        initialFilters: {
          status: "completed" as OrderStatus,
        },
      },
    });
  };

  const handleCancelledOrdersClick = () => {
    navigate("/orders", {
      state: {
        initialFilters: {
          status: "cancelled" as OrderStatus,
        },
      },
    });
  };

  const handleCurrenciesClick = () => {
    navigate("/currencies");
  };

  const handleCustomersClick = () => {
    navigate("/customers");
  };

  const handleUsersClick = () => {
    navigate("/users");
  };

  const handleApprovalRequestsClick = () => {
    navigate("/approval-requests");
  };

  // Calculate approval request stats
  const approvalStats = useMemo(() => {
    if (!hasApprovalPermissions) {
      return { pending: 0, approved: 0 };
    }
    const pending = approvalRequests.filter((r: any) => r.status === "pending").length;
    const approved = approvalRequests.filter((r: any) => r.status === "approved").length;
    return { pending, approved };
  }, [approvalRequests, hasApprovalPermissions]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/*我 remove the currencies customers and users cards */}
        {/* <StatCard
          label={t("dashboard.currencies")}
          value={stats.currencies}
          tone="blue"
          onClick={handleCurrenciesClick}
        />
        <StatCard
          label={t("dashboard.customers")}
          value={stats.customers}
          tone="emerald"
          onClick={handleCustomersClick}
        />
        <StatCard
          label={t("dashboard.users")}
          value={stats.users}
          tone="slate"
          onClick={handleUsersClick} 
        />*/}
        <StatCard
          label={t("dashboard.totalOrders")}
          value={stats.orders}
          tone="amber"
          onClick={handleTotalOrdersClick}
        />
        <StatCard
          label={t("dashboard.pendingOrders")}
          value={stats.pending}
          tone="amber"
          onClick={handlePendingOrdersClick}
        />
        <StatCard
          label={t("dashboard.completedOrders")}
          value={stats.completed}
          tone="emerald"
          onClick={handleCompletedOrdersClick}
        />
        <StatCard
          label={t("dashboard.cancelledOrders")}
          value={stats.cancelled}
          tone="rose"
          onClick={handleCancelledOrdersClick}
        />
        {hasApprovalPermissions && (
          <>
            <StatCard
              label={t("dashboard.pendingRequests") || "Pending Requests"}
              value={approvalStats.pending}
              tone="amber"
              onClick={handleApprovalRequestsClick}
            />
            <StatCard
              label={t("dashboard.approvedRequests") || "Approved Requests"}
              value={approvalStats.approved}
              tone="emerald"
              onClick={handleApprovalRequestsClick}
            />
          </>
        )}
      </div>

      {/* <DashboardStatistics /> */}
    </div>
  );
}


