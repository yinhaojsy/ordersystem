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
} from "../types";

const baseQuery = fetchBaseQuery({
  baseUrl: "/api",
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Currency", "Customer", "CustomerBeneficiary", "User", "Role", "Order", "Auth", "Account", "Transfer", "Expense"],
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
    checkRoleUpdate: builder.query<{ updatedAt: string | null }, string>({
      query: (roleName) => `roles/check-update?roleName=${encodeURIComponent(roleName)}`,
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
    getOrders: builder.query<Order[], void>({
      query: () => "orders",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Order" as const, id })),
              { type: "Order" as const, id: "LIST" },
            ]
          : [{ type: "Order", id: "LIST" }],
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
    deleteOrder: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `orders/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
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
      { id: number; imagePath: string; amount: number; accountId?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `orders/${id}/receipts`,
        method: "POST",
        body,
      }),
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
      { id: number; imagePath: string; amount: number; accountId?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `orders/${id}/payments`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
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
    getTransfers: builder.query<Transfer[], void>({
      query: () => "transfers",
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
    getExpenses: builder.query<Expense[], void>({
      query: () => "expenses",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Expense" as const, id })),
              { type: "Expense" as const, id: "LIST" },
            ]
          : [{ type: "Expense", id: "LIST" }],
    }),
    createExpense: builder.mutation<Expense, ExpenseInput>({
      query: (body) => ({
        url: "expenses",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Expense", id: "LIST" },
        { type: "Account", id: "LIST" },
      ],
    }),
    updateExpense: builder.mutation<
      Expense,
      { id: number; data: Partial<ExpenseInput> & { updatedBy?: number } }
    >({
      query: ({ id, data }) => ({
        url: `expenses/${id}`,
        method: "PUT",
        body: data,
      }),
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
  useCheckRoleUpdateQuery,
  useAddRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetOrdersQuery,
  useAddOrderMutation,
  useUpdateOrderMutation,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
  useGetOrderDetailsQuery,
  useProcessOrderMutation,
  useAddReceiptMutation,
  useAddBeneficiaryMutation,
  useAddPaymentMutation,
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
} = api;


