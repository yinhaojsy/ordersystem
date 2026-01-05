import type { OrderStatus } from "./index";

export type DatePreset = 'all' | 'currentWeek' | 'lastWeek' | 'currentMonth' | 'lastMonth' | 'custom';
export type OrderType = "online" | "otc" | null;

export interface OrderFilters {
  datePreset: DatePreset;
  dateFrom: string | null;
  dateTo: string | null;
  handlerId: number | null;
  customerId: number | null;
  currencyPair: string | null;
  buyAccountId: number | null;
  sellAccountId: number | null;
  status: OrderStatus | null;
  orderType: OrderType;
  tagIds: number[];
}

export interface OrderQueryParams {
  dateFrom?: string;
  dateTo?: string;
  handlerId?: number;
  customerId?: number;
  fromCurrency?: string;
  toCurrency?: string;
  buyAccountId?: number;
  sellAccountId?: number;
  status?: OrderStatus;
  orderType?: "online" | "otc";
  tagIds?: string;
  page?: number;
  limit?: number;
}

