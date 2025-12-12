import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import DashboardPage from "../pages/DashboardPage";
import CurrenciesPage from "../pages/CurrenciesPage";
import CustomersPage from "../pages/CustomersPage";
import UsersPage from "../pages/UsersPage";
import RolesPage from "../pages/RolesPage";
import OrdersPage from "../pages/OrdersPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="currencies" element={<CurrenciesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="orders" element={<OrdersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


