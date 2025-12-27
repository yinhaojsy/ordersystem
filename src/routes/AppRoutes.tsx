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
import { hasSectionAccess } from "../utils/permissions";

function RequireAuth({ children, section }: { children: ReactElement; section?: string }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (section && !hasSectionAccess(user, section)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<RequireAuth section="dashboard"><DashboardPage /></RequireAuth>} />
          <Route path="currencies" element={<RequireAuth section="currencies"><CurrenciesPage /></RequireAuth>} />
          <Route path="accounts" element={<RequireAuth section="accounts"><AccountsPage /></RequireAuth>} />
          <Route path="transfers" element={<RequireAuth section="transfers"><TransfersPage /></RequireAuth>} />
          <Route path="expenses" element={<RequireAuth section="expenses"><ExpensesPage /></RequireAuth>} />
          <Route path="customers" element={<RequireAuth section="customers"><CustomersPage /></RequireAuth>} />
          <Route path="users" element={<RequireAuth section="users"><UsersPage /></RequireAuth>} />
          <Route path="roles" element={<RequireAuth section="roles"><RolesPage /></RequireAuth>} />
          <Route path="orders" element={<RequireAuth section="orders"><OrdersPage /></RequireAuth>} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


