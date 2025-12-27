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
  password?: string | null;
}

export interface AuthResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions?: RolePermissions;
  roleUpdatedAt?: string; // Timestamp when user's role was last updated (stored at login)
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
  updatedAt?: string;
}

export type OrderStatus = "pending" | "waiting_for_receipt" | "waiting_for_payment" | "under_process" | "completed" | "cancelled";
export type PaymentFlow = "receive_first" | "pay_first";

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
  handlerId?: number;
  handlerName?: string;
  paymentType?: "CRYPTO" | "FIAT";
  networkChain?: string;
  walletAddresses?: string[];
  bankDetails?: {
    bankName?: string;
    accountTitle?: string;
    accountNumber?: string;
    accountIban?: string;
    swiftCode?: string;
    bankAddress?: string;
  };
  hasBeneficiaries?: boolean;
  buyAccountId?: number;
  sellAccountId?: number;
  paymentFlow?: PaymentFlow;
  actualAmountBuy?: number;
  actualAmountSell?: number;
  actualRate?: number;
  isFlexOrder?: boolean;
  createdAt: string;
}

export interface OrderReceipt {
  id: number;
  orderId: number;
  imagePath: string;
  amount: number;
  accountId?: number;
  accountName?: string;
  createdAt: string;
}

export interface OrderBeneficiary {
  id: number;
  orderId: number;
  paymentType: "CRYPTO" | "FIAT";
  networkChain?: string;
  walletAddresses?: string[];
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  accountIban?: string;
  swiftCode?: string;
  bankAddress?: string;
  createdAt: string;
}

export interface OrderPayment {
  id: number;
  orderId: number;
  imagePath: string;
  amount: number;
  accountId?: number;
  accountName?: string;
  createdAt: string;
}

export interface CustomerBeneficiary {
  id: number;
  customerId: number;
  paymentType: "CRYPTO" | "FIAT";
  networkChain?: string;
  walletAddresses?: string[];
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  accountIban?: string;
  swiftCode?: string;
  bankAddress?: string;
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
  buyAccountId?: number;
  sellAccountId?: number;
  paymentFlow?: PaymentFlow;
  isFlexOrder?: boolean;
}

export interface Account {
  id: number;
  currencyCode: string;
  currencyName?: string;
  name: string;
  balance: number;
  createdAt: string;
}

export interface AccountSummary {
  currencyCode: string;
  currencyName?: string;
  totalBalance: number;
  accountCount: number;
}

export interface AccountTransaction {
  id: number;
  accountId: number;
  type: "add" | "withdraw";
  amount: number;
  description?: string;
  createdAt: string;
}

export interface Transfer {
  id: number;
  fromAccountId: number;
  fromAccountName?: string;
  toAccountId: number;
  toAccountName?: string;
  amount: number;
  currencyCode: string;
  description?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt: string;
  updatedBy?: number;
  updatedByName?: string;
  updatedAt?: string;
}

export interface TransferChange {
  id: number;
  transferId: number;
  changedBy?: number;
  changedByName?: string;
  changedAt: string;
  fromAccountId: number;
  fromAccountName?: string;
  toAccountId: number;
  toAccountName?: string;
  amount: number;
  description?: string;
  transactionFee?: number;
}

export interface TransferInput {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  description?: string;
  transactionFee?: number;
  createdBy?: number;
}

export interface Expense {
  id: number;
  accountId: number;
  accountName?: string;
  amount: number;
  currencyCode: string;
  description?: string;
  imagePath?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt: string;
  updatedBy?: number;
  updatedByName?: string;
  updatedAt?: string;
  deletedBy?: number;
  deletedByName?: string;
  deletedAt?: string;
}

export interface ExpenseInput {
  accountId: number;
  amount: number;
  description?: string;
  imagePath?: string;
  createdBy?: number;
}

export interface ExpenseChange {
  id: number;
  expenseId: number;
  changedBy?: number;
  changedByName?: string;
  changedAt: string;
  accountId: number;
  accountName?: string;
  amount: number;
  description?: string;
}


