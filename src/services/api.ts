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
} from "../types";

const baseQuery = fetchBaseQuery({
  baseUrl: "/api",
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Currency", "Customer", "CustomerBeneficiary", "User", "Role", "Order", "Auth"],
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
        paymentType: "CRYPTO" | "FIAT";
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
      { id: number; imagePath: string; amount: number }
    >({
      query: ({ id, ...body }) => ({
        url: `orders/${id}/receipts`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: "Order", id }],
    }),
    addBeneficiary: builder.mutation<
      OrderBeneficiary,
      {
        id: number;
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
      query: ({ id, ...body }) => ({
        url: `orders/${id}/beneficiaries`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
    addPayment: builder.mutation<
      OrderPayment,
      { id: number; imagePath: string; amount: number }
    >({
      query: ({ id, ...body }) => ({
        url: `orders/${id}/payments`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: "Order", id }],
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
  useGetOrdersQuery,
  useAddOrderMutation,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
  useGetOrderDetailsQuery,
  useProcessOrderMutation,
  useAddReceiptMutation,
  useAddBeneficiaryMutation,
  useAddPaymentMutation,
} = api;


