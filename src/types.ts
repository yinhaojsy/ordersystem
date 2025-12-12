export interface Currency {
  id: number;
  code: string;
  name: string;
  baseRateBuy: number;
  conversionRateBuy: number;
  baseRateSell: number;
  conversionRateSell: number;
  active: boolean | number;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface RolePermissions {
  sections: string[];
  actions: Record<string, boolean>;
}

export interface Role {
  id: number;
  name: string;
  displayName: string;
  permissions: RolePermissions;
}

export type OrderStatus = "pending" | "completed" | "cancelled";

export interface Order {
  id: number;
  customerId: number;
  customerName?: string;
  fromCurrency: string;
  toCurrency: string;
  amountBuy: number;
  amountSell: number;
  rate: number;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderInput {
  customerId: number;
  fromCurrency: string;
  toCurrency: string;
  amountBuy: number;
  amountSell: number;
  rate: number;
  status?: OrderStatus;
}


