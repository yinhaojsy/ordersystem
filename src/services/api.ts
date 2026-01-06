import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  Currency,
  Customer,
  User,
  Role,
  Order,
  OrderInput,
  OrderStatus,
  OrderReceipt,
  OrderBeneficiary,
  OrderPayment,
  CustomerBeneficiary,
  AuthResponse,
  Account,
  AccountSummary,
  AccountTransaction,
  Transfer,
  TransferInput,
  TransferChange,
  Expense,
  ExpenseInput,
  ExpenseChange,
  ProfitCalculation,
  ProfitCalculationDetails,
  ProfitAccountMultiplier,
  ProfitExchangeRate,
  Tag,
  TagInput,
} from "../types";

const baseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: (headers, { extra, endpoint }) => {
    // Don't set Content-Type for FormData - browser will set it with boundary
    // RTK Query will automatically handle FormData and not set Content-Type
    return headers;
  },
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Currency", "Customer", "CustomerBeneficiary", "User", "Role", "Order", "Auth", "Account", "Transfer", "Expense", "ProfitCalculation", "Setting", "Tag"],
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getCurrencies: builder.query<Currency[], void>({
      query: () => "currencies",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Currency" as const, id })),
              { type: "Currency" as const, id: "LIST" },
            ]
          : [{ type: "Currency" as const, id: "LIST" }],
    }),
    addCurrency: builder.mutation<Currency, Omit<Currency, "id">>({
      query: (body) => ({
        url: "currencies",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Currency", id: "LIST" }],
    }),
    deleteCurrency: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `currencies/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Currency", id },
        { type: "Currency", id: "LIST" },
      ],
    }),
    updateCurrency: builder.mutation<
      Currency,
      { id: number; data: Partial<Currency> }
    >({
      query: ({ id, data }) => ({
        url: `currencies/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Currency", id },
        { type: "Currency", id: "LIST" },
      ],
    }),
    getCustomers: builder.query<Customer[], void>({
      query: () => "customers",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Customer" as const, id })),
              { type: "Customer" as const, id: "LIST" },
            ]
          : [{ type: "Customer" as const, id: "LIST" }],
    }),
    addCustomer: builder.mutation<
      Customer,
      Omit<Customer, "id"> & { id?: number }
    >({
      query: (body) => ({
        url: "customers",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Customer", id: "LIST" }],
    }),
    updateCustomer: builder.mutation<
      Customer,
      { id: number; data: Partial<Customer> }
    >({
      query: ({ id, data }) => ({
        url: `customers/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),
    deleteCustomer: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `customers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),
    getCustomerBeneficiaries: builder.query<CustomerBeneficiary[], number>({
      query: (id) => `customers/${id}/beneficiaries`,
      providesTags: (result, _err, id) =>
        result
          ? [
              ...result.map(({ id: beneficiaryId }) => ({
                type: "CustomerBeneficiary" as const,
                id: beneficiaryId,
              })),
              { type: "CustomerBeneficiary" as const, id: `LIST-${id}` },
            ]
          : [{ type: "CustomerBeneficiary" as const, id: `LIST-${id}` }],
    }),
    addCustomerBeneficiary: builder.mutation<
      CustomerBeneficiary,
      {
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
      }
    >({
      query: ({ customerId, ...body }) => ({
        url: `customers/${customerId}/beneficiaries`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { customerId }) => [
        { type: "CustomerBeneficiary", id: `LIST-${customerId}` },
      ],
    }),
    updateCustomerBeneficiary: builder.mutation<
      CustomerBeneficiary,
      {
        customerId: number;
        beneficiaryId: number;
        paymentType: "CRYPTO" | "FIAT";
        networkChain?: string;
        walletAddresses?: string[];
        bankName?: string;
        accountTitle?: string;
        accountNumber?: string;
        accountIban?: string;
        swiftCode?: string;
        bankAddress?: string;
      }
    >({
      query: ({ customerId, beneficiaryId, ...body }) => ({
        url: `customers/${customerId}/beneficiaries/${beneficiaryId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_res, _err, { customerId, beneficiaryId }) => [
        { type: "CustomerBeneficiary", id: beneficiaryId },
        { type: "CustomerBeneficiary", id: `LIST-${customerId}` },
      ],
    }),
    deleteCustomerBeneficiary: builder.mutation<
      { success?: boolean },
      { customerId: number; beneficiaryId: number }
    >({
      query: ({ customerId, beneficiaryId }) => ({
        url: `customers/${customerId}/beneficiaries/${beneficiaryId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, { customerId, beneficiaryId }) => [
        { type: "CustomerBeneficiary", id: beneficiaryId },
        { type: "CustomerBeneficiary", id: `LIST-${customerId}` },
      ],
    }),
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({
        url: "auth/login",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Auth", id: "CURRENT" }],
    }),
    getUsers: builder.query<User[], void>({
      query: () => "users",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "User" as const, id })),
              { type: "User" as const, id: "LIST" },
            ]
          : [{ type: "User" as const, id: "LIST" }],
    }),
    addUser: builder.mutation<User, Omit<User, "id">>({
      query: (body) => ({
        url: "users",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
    updateUser: builder.mutation<User, { id: number; data: Partial<User> }>({
      query: ({ id, data }) => ({
        url: `users/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
    deleteUser: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
    getRoles: builder.query<Role[], void>({
      query: () => "roles",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Role" as const, id })),
              { type: "Role" as const, id: "LIST" },
            ]
          : [{ type: "Role", id: "LIST" }],
    }),
    addRole: builder.mutation<Role, Omit<Role, "id">>({
      query: (body) => ({
        url: "roles",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),
    updateRole: builder.mutation<Role, { id: number; data: Partial<Role> }>({
      query: ({ id, data }) => ({
        url: `roles/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Role", id },
        { type: "Role", id: "LIST" },
      ],
    }),
    deleteRole: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `roles/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Role", id },
        { type: "Role", id: "LIST" },
      ],
    }),
    forceLogoutUsersByRole: builder.mutation<
      { success: boolean; message: string; userCount: number },
      number
    >({
      query: (id) => ({
        url: `roles/${id}/force-logout`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),
    getOrders: builder.query<
      {
        orders: Order[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      },
      {
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
    >({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom);
        if (params.dateTo) queryParams.append("dateTo", params.dateTo);
        if (params.handlerId !== undefined) queryParams.append("handlerId", params.handlerId.toString());
        if (params.customerId !== undefined) queryParams.append("customerId", params.customerId.toString());
        if (params.fromCurrency) queryParams.append("fromCurrency", params.fromCurrency);
        if (params.toCurrency) queryParams.append("toCurrency", params.toCurrency);
        if (params.buyAccountId !== undefined) queryParams.append("buyAccountId", params.buyAccountId.toString());
        if (params.sellAccountId !== undefined) queryParams.append("sellAccountId", params.sellAccountId.toString());
        if (params.status) queryParams.append("status", params.status);
        if (params.orderType) queryParams.append("orderType", params.orderType);
        if (params.tagIds) queryParams.append("tagIds", params.tagIds);
        if (params.page !== undefined) queryParams.append("page", params.page.toString());
        if (params.limit !== undefined) queryParams.append("limit", params.limit.toString());
        const queryString = queryParams.toString();
        return `orders${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.orders.map(({ id }) => ({ type: "Order" as const, id })),
              { type: "Order" as const, id: "LIST" },
            ]
          : [{ type: "Order", id: "LIST" }],
    }),
    exportOrders: builder.query<
      Order[],
      {
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
      }
    >({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom);
        if (params.dateTo) queryParams.append("dateTo", params.dateTo);
        if (params.handlerId !== undefined) queryParams.append("handlerId", params.handlerId.toString());
        if (params.customerId !== undefined) queryParams.append("customerId", params.customerId.toString());
        if (params.fromCurrency) queryParams.append("fromCurrency", params.fromCurrency);
        if (params.toCurrency) queryParams.append("toCurrency", params.toCurrency);
        if (params.buyAccountId !== undefined) queryParams.append("buyAccountId", params.buyAccountId.toString());
        if (params.sellAccountId !== undefined) queryParams.append("sellAccountId", params.sellAccountId.toString());
        if (params.status) queryParams.append("status", params.status);
        if (params.orderType) queryParams.append("orderType", params.orderType);
        if (params.tagIds) queryParams.append("tagIds", params.tagIds);
        const queryString = queryParams.toString();
        return `orders/export${queryString ? `?${queryString}` : ""}`;
      },
    }),
    addOrder: builder.mutation<Order, OrderInput>({
      query: (body) => ({
        url: "orders",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Order", id: "LIST" }],
    }),
    updateOrder: builder.mutation<
      Order,
      { id: number; data: Partial<OrderInput> }
    >({
      query: ({ id, data }) => ({
        url: `orders/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
    updateOrderStatus: builder.mutation<
      Order,
      { id: number; status: OrderStatus }
    >({
      query: ({ id, status }) => ({
        url: `orders/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
    deleteOrder: builder.mutation<{ success: boolean; affectedAccountIds?: number[] }, number>({
      query: (id) => ({
        url: `orders/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (res, _err, id) => {
        const tags: Array<{ type: "Order" | "Account"; id: number | "LIST" }> = [
          { type: "Order", id },
          { type: "Order", id: "LIST" },
          { type: "Account", id: "LIST" }, // Invalidate account list to refresh balances
        ];
        
        // Invalidate specific account transaction caches for affected accounts
        if (res?.affectedAccountIds) {
          res.affectedAccountIds.forEach((accountId) => {
            tags.push({ type: "Account", id: accountId });
          });
        }
        
        return tags;
      },
    }),
    getOrderDetails: builder.query<
      {
        order: Order;
        receipts: OrderReceipt[];
        beneficiaries: OrderBeneficiary[];
        payments: OrderPayment[];
        totalReceiptAmount: number;
        totalPaymentAmount: number;
        receiptBalance: number;
        paymentBalance: number;
      },
      number
    >({
      query: (id) => `orders/${id}/details`,
      providesTags: (_res, _err, id) => [{ type: "Order", id }],
    }),
    processOrder: builder.mutation<
      Order,
      {
        id: number;
        handlerId: number;
        paymentFlow?: "receive_first" | "pay_first";
        // Commented out for future use:
        // paymentType: "CRYPTO" | "FIAT";
        // networkChain?: string;
        // walletAddresses?: string[];
        // bankDetails?: {
        //   bankName?: string;
        //   accountTitle?: string;
        //   accountNumber?: string;
        //   accountIban?: string;
        //   swiftCode?: string;
        //   bankAddress?: string;
        // };
      }
    >({
      query: ({ id, ...body }) => ({
        url: `orders/${id}/process`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
    addReceipt: builder.mutation<
      OrderReceipt,
      { id: number; file?: File; imagePath?: string; amount: number; accountId?: number }
    >({
      query: ({ id, file, imagePath, ...body }) => {
        if (file) {
          // Use FormData for file upload
          const formData = new FormData();
          formData.append("file", file);
          formData.append("amount", String(body.amount));
          if (body.accountId !== undefined) {
            formData.append("accountId", String(body.accountId));
          }
          return {
            url: `orders/${id}/receipts`,
            method: "POST",
            body: formData,
          };
        } else {
          // Backward compatibility: use JSON with base64
          return {
            url: `orders/${id}/receipts`,
            method: "POST",
            body: { ...body, imagePath },
          };
        }
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    addBeneficiary: builder.mutation<
      { success: boolean; message?: string },
      {
        id: number;
        paymentAccountId: number;
        // Commented out for future use:
        // paymentType: "CRYPTO" | "FIAT";
        // networkChain?: string;
        // walletAddresses?: string[];
        // bankName?: string;
        // accountTitle?: string;
        // accountNumber?: string;
        // accountIban?: string;
        // swiftCode?: string;
        // bankAddress?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `orders/${id}/beneficiaries`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    addPayment: builder.mutation<
      OrderPayment,
      { id: number; file?: File; imagePath?: string; amount: number; accountId?: number }
    >({
      query: ({ id, file, imagePath, ...body }) => {
        if (file) {
          // Use FormData for file upload
          const formData = new FormData();
          formData.append("file", file);
          formData.append("amount", String(body.amount));
          if (body.accountId !== undefined) {
            formData.append("accountId", String(body.accountId));
          }
          return {
            url: `orders/${id}/payments`,
            method: "POST",
            body: formData,
          };
        } else {
          // Backward compatibility: use JSON with base64
          return {
            url: `orders/${id}/payments`,
            method: "POST",
            body: { ...body, imagePath },
          };
        }
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    updateReceipt: builder.mutation<
      OrderReceipt,
      { receiptId: number; file?: File; amount?: number; accountId?: number }
    >({
      query: ({ receiptId, file, ...body }) => {
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          if (body.amount !== undefined) {
            formData.append("amount", String(body.amount));
          }
          if (body.accountId !== undefined) {
            formData.append("accountId", String(body.accountId));
          }
          return {
            url: `orders/receipts/${receiptId}`,
            method: "PUT",
            body: formData,
          };
        } else {
          return {
            url: `orders/receipts/${receiptId}`,
            method: "PUT",
            body,
          };
        }
      },
      invalidatesTags: (_res, _err, { receiptId }) => [
        { type: "Order", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    deleteReceipt: builder.mutation<{ success: boolean; orderId?: number }, number>({
      query: (receiptId) => ({
        url: `orders/receipts/${receiptId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result) => {
        const tags: Array<{ type: "Order"; id: number | "LIST" }> = [
          { type: "Order", id: "LIST" },
        ];
        if (result?.orderId) {
          tags.push({ type: "Order", id: result.orderId });
        }
        return tags;
      },
    }),
    confirmReceipt: builder.mutation<OrderReceipt, number>({
      query: (receiptId) => ({
        url: `orders/receipts/${receiptId}/confirm`,
        method: "POST",
      }),
      invalidatesTags: (result) => {
        if (result) {
          return [
            { type: "Order", id: result.orderId },
            { type: "Order", id: "LIST" },
            { type: "Account", id: "LIST" },
          ];
        }
        return [{ type: "Order", id: "LIST" }, { type: "Account", id: "LIST" }];
      },
    }),
    updatePayment: builder.mutation<
      OrderPayment,
      { paymentId: number; file?: File; amount?: number; accountId?: number }
    >({
      query: ({ paymentId, file, ...body }) => {
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          if (body.amount !== undefined) {
            formData.append("amount", String(body.amount));
          }
          if (body.accountId !== undefined) {
            formData.append("accountId", String(body.accountId));
          }
          return {
            url: `orders/payments/${paymentId}`,
            method: "PUT",
            body: formData,
          };
        } else {
          return {
            url: `orders/payments/${paymentId}`,
            method: "PUT",
            body,
          };
        }
      },
      invalidatesTags: () => [
        { type: "Order", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    deletePayment: builder.mutation<{ success: boolean; orderId?: number }, number>({
      query: (paymentId) => ({
        url: `orders/payments/${paymentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result) => {
        const tags: Array<{ type: "Order"; id: number | "LIST" }> = [
          { type: "Order", id: "LIST" },
        ];
        if (result?.orderId) {
          tags.push({ type: "Order", id: result.orderId });
        }
        return tags;
      },
    }),
    confirmPayment: builder.mutation<OrderPayment, number>({
      query: (paymentId) => ({
        url: `orders/payments/${paymentId}/confirm`,
        method: "POST",
      }),
      invalidatesTags: (result) => {
        if (result) {
          return [
            { type: "Order", id: result.orderId },
            { type: "Order", id: "LIST" },
            { type: "Account", id: "LIST" },
          ];
        }
        return [{ type: "Order", id: "LIST" }, { type: "Account", id: "LIST" }];
      },
    }),
    proceedWithPartialReceipts: builder.mutation<Order, number>({
      query: (id) => ({
        url: `orders/${id}/proceed-partial-receipts`,
        method: "POST",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
    adjustFlexOrderRate: builder.mutation<
      Order,
      { id: number; rate: number }
    >({
      query: ({ id, ...body }) => ({
        url: `orders/${id}/adjust-rate`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
    getAccounts: builder.query<Account[], void>({
      query: () => "accounts",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Account" as const, id })),
              { type: "Account" as const, id: "LIST" },
            ]
          : [{ type: "Account" as const, id: "LIST" }],
    }),
    getAccountsSummary: builder.query<AccountSummary[], void>({
      query: () => "accounts/summary",
      providesTags: [{ type: "Account", id: "LIST" }],
    }),
    getAccountsByCurrency: builder.query<Account[], string>({
      query: (currencyCode) => `accounts/currency/${currencyCode}`,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Account" as const, id })),
              { type: "Account" as const, id: "LIST" },
            ]
          : [{ type: "Account" as const, id: "LIST" }],
    }),
    createAccount: builder.mutation<
      Account,
      { currencyCode: string; name: string; initialFunds?: number }
    >({
      query: (body) => ({
        url: "accounts",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Account", id: "LIST" }],
    }),
    updateAccount: builder.mutation<Account, { id: number; name: string }>({
      query: ({ id, ...body }) => ({
        url: `accounts/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),
    deleteAccount: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `accounts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),
    addFunds: builder.mutation<
      Account,
      { id: number; amount: number; description?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `accounts/${id}/add-funds`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),
    withdrawFunds: builder.mutation<
      Account,
      { id: number; amount: number; description?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `accounts/${id}/withdraw-funds`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),
    getAccountTransactions: builder.query<AccountTransaction[], number>({
      query: (id) => `accounts/${id}/transactions`,
      providesTags: (_res, _err, id) => [{ type: "Account", id }],
    }),
    getTransfers: builder.query<
      Transfer[],
      {
        dateFrom?: string;
        dateTo?: string;
        fromAccountId?: number;
        toAccountId?: number;
        currencyCode?: string;
        createdBy?: number;
        tagIds?: string;
      }
    >({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom);
        if (params.dateTo) queryParams.append("dateTo", params.dateTo);
        if (params.fromAccountId !== undefined && params.fromAccountId !== null) queryParams.append("fromAccountId", params.fromAccountId.toString());
        if (params.toAccountId !== undefined && params.toAccountId !== null) queryParams.append("toAccountId", params.toAccountId.toString());
        if (params.currencyCode) queryParams.append("currencyCode", params.currencyCode);
        if (params.createdBy !== undefined && params.createdBy !== null) queryParams.append("createdBy", params.createdBy.toString());
        if (params.tagIds) queryParams.append("tagIds", params.tagIds);
        const queryString = queryParams.toString();
        return `transfers${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Transfer" as const, id })),
              { type: "Transfer" as const, id: "LIST" },
            ]
          : [{ type: "Transfer", id: "LIST" }],
    }),
    createTransfer: builder.mutation<Transfer, TransferInput>({
      query: (body) => ({
        url: "transfers",
        method: "POST",
        body,
      }),
      invalidatesTags: (result) => {
        const tags: Array<{ type: "Transfer" | "Account"; id: number | "LIST" }> = [
          { type: "Transfer", id: "LIST" },
          { type: "Account", id: "LIST" },
        ];
        
        // Invalidate specific account transaction caches for affected accounts
        if (result) {
          tags.push({ type: "Account", id: result.fromAccountId });
          tags.push({ type: "Account", id: result.toAccountId });
        }
        
        return tags;
      },
    }),
    updateTransfer: builder.mutation<
      Transfer,
      { id: number; data: Partial<TransferInput> & { updatedBy?: number } }
    >({
      query: ({ id, data }) => ({
        url: `transfers/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, _err, { id, data }) => {
        const tags: Array<{ type: "Transfer" | "Account"; id: number | "LIST" }> = [
          { type: "Transfer", id },
          { type: "Transfer", id: "LIST" },
          { type: "Account", id: "LIST" },
        ];
        
        // Invalidate specific account transaction caches for affected accounts
        if (result) {
          // Invalidate new account IDs from the result
          tags.push({ type: "Account", id: result.fromAccountId });
          tags.push({ type: "Account", id: result.toAccountId });
        }
        
        return tags;
      },
      async onQueryStarted({ id, data }, { dispatch, queryFulfilled, getState }) {
        // Get the old transfer from cache to invalidate old account IDs
        const state = getState() as any;
        const transfersQuery = state?.api?.queries?.[`getTransfers(undefined)`];
        const oldTransfer = transfersQuery?.data?.find((t: Transfer) => t.id === id);
        
        // Invalidate old account IDs if they exist
        if (oldTransfer) {
          dispatch(
            api.util.invalidateTags([
              { type: "Account", id: oldTransfer.fromAccountId },
              { type: "Account", id: oldTransfer.toAccountId },
            ])
          );
        }
        
        try {
          const result = await queryFulfilled;
          // Invalidate new account IDs from the result
          if (result.data) {
            dispatch(
              api.util.invalidateTags([
                { type: "Account", id: result.data.fromAccountId },
                { type: "Account", id: result.data.toAccountId },
              ])
            );
          }
        } catch {
          // If query fails, we still invalidated the old account IDs
        }
      },
    }),
    deleteTransfer: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `transfers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Transfer", id: "LIST" }, { type: "Account", id: "LIST" }],
    }),
    getTransferChanges: builder.query<TransferChange[], number>({
      query: (id) => `transfers/${id}/changes`,
      providesTags: (_res, _err, id) => [{ type: "Transfer", id, variant: "CHANGES" }],
    }),
    getExpenses: builder.query<
      Expense[],
      {
        dateFrom?: string;
        dateTo?: string;
        accountId?: number;
        currencyCode?: string;
        createdBy?: number;
        tagIds?: string;
      }
    >({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom);
        if (params.dateTo) queryParams.append("dateTo", params.dateTo);
        if (params.accountId !== undefined && params.accountId !== null) queryParams.append("accountId", params.accountId.toString());
        if (params.currencyCode) queryParams.append("currencyCode", params.currencyCode);
        if (params.createdBy !== undefined && params.createdBy !== null) queryParams.append("createdBy", params.createdBy.toString());
        if (params.tagIds) queryParams.append("tagIds", params.tagIds);
        const queryString = queryParams.toString();
        return `expenses${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Expense" as const, id })),
              { type: "Expense" as const, id: "LIST" },
            ]
          : [{ type: "Expense", id: "LIST" }],
    }),
    createExpense: builder.mutation<Expense, ExpenseInput & { file?: File }>({
      query: ({ file, ...body }) => {
        if (file) {
          // Use FormData for file upload
          const formData = new FormData();
          formData.append("file", file);
          formData.append("accountId", String(body.accountId));
          formData.append("amount", String(body.amount));
          // Always append description (even if empty) since backend requires it
          formData.append("description", body.description || "");
          if (body.createdBy !== undefined) {
            formData.append("createdBy", String(body.createdBy));
          }
          return {
            url: "expenses",
            method: "POST",
            body: formData,
          };
        } else {
          // Backward compatibility: use JSON with base64
          return {
            url: "expenses",
            method: "POST",
            body,
          };
        }
      },
      invalidatesTags: [
        { type: "Expense", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    updateExpense: builder.mutation<
      Expense,
      { id: number; data: Partial<ExpenseInput> & { updatedBy?: number; file?: File } }
    >({
      query: ({ id, data }) => {
        const { file, ...body } = data;
        if (file) {
          // Use FormData for file upload
          const formData = new FormData();
          formData.append("file", file);
          if (body.accountId !== undefined) {
            formData.append("accountId", String(body.accountId));
          }
          if (body.amount !== undefined) {
            formData.append("amount", String(body.amount));
          }
          if (body.description !== undefined) {
            formData.append("description", body.description || "");
          }
          if (body.imagePath !== undefined) {
            // For removing image, send empty string
            formData.append("imagePath", body.imagePath || "");
          }
          if (body.updatedBy !== undefined) {
            formData.append("updatedBy", String(body.updatedBy));
          }
          return {
            url: `expenses/${id}`,
            method: "PUT",
            body: formData,
          };
        } else {
          // Backward compatibility: use JSON with base64
          return {
            url: `expenses/${id}`,
            method: "PUT",
            body,
          };
        }
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Expense", id },
        { type: "Expense", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    deleteExpense: builder.mutation<{ success: boolean }, { id: number; deletedBy?: number }>({
      query: ({ id, ...body }) => ({
        url: `expenses/${id}`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: [
        { type: "Expense", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    getExpenseChanges: builder.query<ExpenseChange[], number>({
      query: (id) => `expenses/${id}/changes`,
      providesTags: (_res, _err, id) => [{ type: "Expense", id, variant: "CHANGES" }],
    }),
    getProfitCalculations: builder.query<ProfitCalculation[], void>({
      query: () => "profit-calculations",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "ProfitCalculation" as const, id })),
              { type: "ProfitCalculation" as const, id: "LIST" },
            ]
          : [{ type: "ProfitCalculation" as const, id: "LIST" }],
    }),
    getProfitCalculation: builder.query<ProfitCalculationDetails, number>({
      query: (id) => `profit-calculations/${id}`,
      providesTags: (_res, _err, id) => [{ type: "ProfitCalculation", id }],
    }),
    createProfitCalculation: builder.mutation<
      ProfitCalculationDetails,
      { name: string; targetCurrencyCode: string; initialInvestment?: number }
    >({
      query: (body) => ({
        url: "profit-calculations",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "ProfitCalculation", id: "LIST" }],
    }),
    updateProfitCalculation: builder.mutation<
      ProfitCalculation,
      { id: number; data: Partial<Pick<ProfitCalculation, "name" | "targetCurrencyCode" | "initialInvestment" | "groups">> }
    >({
      query: ({ id, data }) => ({
        url: `profit-calculations/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "ProfitCalculation", id },
        { type: "ProfitCalculation", id: "LIST" },
      ],
    }),
    deleteProfitCalculation: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `profit-calculations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "ProfitCalculation", id },
        { type: "ProfitCalculation", id: "LIST" },
      ],
    }),
    updateAccountMultiplier: builder.mutation<
      ProfitAccountMultiplier,
      { calculationId: number; accountId: number; multiplier: number; groupId?: string; groupName?: string }
    >({
      query: ({ calculationId, accountId, ...body }) => ({
        url: `profit-calculations/${calculationId}/multipliers/${accountId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_res, _err, { calculationId }) => [
        { type: "ProfitCalculation", id: calculationId },
        { type: "Account", id: "LIST" },
      ],
    }),
    updateExchangeRate: builder.mutation<
      ProfitExchangeRate,
      { calculationId: number; fromCurrencyCode: string; toCurrencyCode: string; rate: number }
    >({
      query: ({ calculationId, ...body }) => ({
        url: `profit-calculations/${calculationId}/exchange-rates`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_res, _err, { calculationId }) => [
        { type: "ProfitCalculation", id: calculationId },
      ],
    }),
    deleteGroup: builder.mutation<
      { message: string },
      { calculationId: number; groupName: string }
    >({
      query: ({ calculationId, ...body }) => ({
        url: `profit-calculations/${calculationId}/groups`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_res, _err, { calculationId }) => [
        { type: "ProfitCalculation", id: calculationId },
      ],
    }),
    renameGroup: builder.mutation<
      { message: string },
      { calculationId: number; oldGroupName: string; newGroupName: string }
    >({
      query: ({ calculationId, ...body }) => ({
        url: `profit-calculations/${calculationId}/groups`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_res, _err, { calculationId }) => [
        { type: "ProfitCalculation", id: calculationId },
      ],
    }),
    setDefaultProfitCalculation: builder.mutation<
      { message: string },
      { id: number }
    >({
      query: ({ id }) => ({
        url: `profit-calculations/${id}/set-default`,
        method: "PUT",
      }),
      invalidatesTags: [
        { type: "ProfitCalculation", id: "LIST" },
      ],
    }),
    unsetDefaultProfitCalculation: builder.mutation<
      { message: string },
      { id: number }
    >({
      query: ({ id }) => ({
        url: `profit-calculations/${id}/unset-default`,
        method: "PUT",
      }),
      invalidatesTags: [
        { type: "ProfitCalculation", id: "LIST" },
      ],
    }),
    getSetting: builder.query<{ key: string; value: string | null }, string>({
      query: (key) => `settings/${key}`,
      providesTags: (_res, _err, key) => [{ type: "Setting", id: key }],
    }),
    setSetting: builder.mutation<
      { key: string; value: string; message: string },
      { key: string; value: string }
    >({
      query: (body) => ({
        url: "settings",
        method: "PUT",
        body,
      }),
      invalidatesTags: (_res, _err, { key }) => [
        { type: "Setting", id: key },
      ],
    }),
    getTags: builder.query<Tag[], void>({
      query: () => "tags",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Tag" as const, id })),
              { type: "Tag" as const, id: "LIST" },
            ]
          : [{ type: "Tag" as const, id: "LIST" }],
    }),
    createTag: builder.mutation<Tag, TagInput>({
      query: (body) => ({
        url: "tags",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Tag", id: "LIST" }],
    }),
    updateTag: builder.mutation<Tag, { id: number; data: Partial<TagInput> }>({
      query: ({ id, data }) => ({
        url: `tags/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Tag", id },
        { type: "Tag", id: "LIST" },
        { type: "Order", id: "LIST" },
        { type: "Transfer", id: "LIST" },
        { type: "Expense", id: "LIST" },
      ],
    }),
    deleteTag: builder.mutation<{ success: boolean; message?: string }, number>({
      query: (id) => ({
        url: `tags/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Tag", id },
        { type: "Tag", id: "LIST" },
        { type: "Order", id: "LIST" },
        { type: "Transfer", id: "LIST" },
        { type: "Expense", id: "LIST" },
      ],
    }),
    batchAssignTags: builder.mutation<
      { success: boolean; message: string },
      { entityType: "order" | "transfer" | "expense"; entityIds: number[]; tagIds: number[] }
    >({
      query: (body) => ({
        url: "tags/batch-assign",
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { entityType, entityIds }) => {
        const type: "Order" | "Transfer" | "Expense" = entityType === "order" ? "Order" : entityType === "transfer" ? "Transfer" : "Expense";
        return [
          { type, id: "LIST" as const },
          ...(entityIds || []).map((id: number) => ({ type, id })),
        ];
      },
    }),
    batchUnassignTags: builder.mutation<
      { success: boolean; message: string },
      { entityType: "order" | "transfer" | "expense"; entityIds: number[]; tagIds: number[] }
    >({
      query: (body) => ({
        url: "tags/batch-unassign",
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { entityType, entityIds }) => {
        const type: "Order" | "Transfer" | "Expense" =
          entityType === "order" ? "Order" : entityType === "transfer" ? "Transfer" : "Expense";
        return [
          { type, id: "LIST" as const },
          ...(entityIds || []).map((id: number) => ({ type, id })),
        ];
      },
    }),
  }),
});

export const {
  useGetCurrenciesQuery,
  useAddCurrencyMutation,
  useUpdateCurrencyMutation,
  useDeleteCurrencyMutation,
  useGetCustomersQuery,
  useAddCustomerMutation,
  useGetCustomerBeneficiariesQuery,
  useAddCustomerBeneficiaryMutation,
  useUpdateCustomerBeneficiaryMutation,
  useDeleteCustomerBeneficiaryMutation,
  useLoginMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useGetUsersQuery,
  useAddUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetRolesQuery,
  useAddRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useForceLogoutUsersByRoleMutation,
  useGetOrdersQuery,
  useAddOrderMutation,
  useUpdateOrderMutation,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
  useGetOrderDetailsQuery,
  useProcessOrderMutation,
  useAddReceiptMutation,
  useUpdateReceiptMutation,
  useDeleteReceiptMutation,
  useConfirmReceiptMutation,
  useAddBeneficiaryMutation,
  useAddPaymentMutation,
  useUpdatePaymentMutation,
  useDeletePaymentMutation,
  useConfirmPaymentMutation,
  useProceedWithPartialReceiptsMutation,
  useAdjustFlexOrderRateMutation,
  useGetAccountsQuery,
  useGetAccountsSummaryQuery,
  useGetAccountsByCurrencyQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useAddFundsMutation,
  useWithdrawFundsMutation,
  useGetAccountTransactionsQuery,
  useGetTransfersQuery,
  useCreateTransferMutation,
  useUpdateTransferMutation,
  useDeleteTransferMutation,
  useGetTransferChangesQuery,
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseChangesQuery,
  useGetProfitCalculationsQuery,
  useGetProfitCalculationQuery,
  useCreateProfitCalculationMutation,
  useUpdateProfitCalculationMutation,
  useDeleteProfitCalculationMutation,
  useUpdateAccountMultiplierMutation,
  useUpdateExchangeRateMutation,
  useDeleteGroupMutation,
  useRenameGroupMutation,
  useSetDefaultProfitCalculationMutation,
  useUnsetDefaultProfitCalculationMutation,
    useGetSettingQuery,
    useSetSettingMutation,
    useGetTagsQuery,
    useCreateTagMutation,
    useUpdateTagMutation,
    useDeleteTagMutation,
    useBatchAssignTagsMutation,
    useBatchUnassignTagsMutation,
} = api;


