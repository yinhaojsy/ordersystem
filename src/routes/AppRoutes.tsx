import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import AppLayout from "../layout/AppLayout";
import DashboardPage from "../pages/DashboardPage";
import CurrenciesPage from "../pages/CurrenciesPage";
import AccountsPage from "../pages/AccountsPage";
import TransfersPage from "../pages/TransfersPage";
import ExpensesPage from "../pages/ExpensesPage";
import CustomersPage from "../pages/CustomersPage";
import UsersPage from "../pages/UsersPage";
import RolesPage from "../pages/RolesPage";
import OrdersPage from "../pages/OrdersPage";
import LoginPage from "../pages/LoginPage";
import { useAppSelector } from "../app/hooks";

function RequireAuth({ children, roles }: { children: ReactElement; roles?: string[] }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="currencies" element={<RequireAuth roles={["admin"]}><CurrenciesPage /></RequireAuth>} />
          <Route path="accounts" element={<RequireAuth roles={["admin"]}><AccountsPage /></RequireAuth>} />
          <Route path="transfers" element={<RequireAuth><TransfersPage /></RequireAuth>} />
          <Route path="expenses" element={<RequireAuth><ExpensesPage /></RequireAuth>} />
          <Route path="customers" element={<RequireAuth><CustomersPage /></RequireAuth>} />
          <Route path="users" element={<RequireAuth roles={["admin"]}><UsersPage /></RequireAuth>} />
          <Route path="roles" element={<RequireAuth roles={["admin"]}><RolesPage /></RequireAuth>} />
          <Route path="orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


