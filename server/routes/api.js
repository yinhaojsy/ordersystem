import { Router } from "express";
import {
  listCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
} from "../controllers/currenciesController.js";
import { getExchangeRates } from "../controllers/exchangeRatesController.js";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listCustomerBeneficiaries,
  addCustomerBeneficiary,
  updateCustomerBeneficiary,
  deleteCustomerBeneficiary,
} from "../controllers/customersController.js";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/usersController.js";
import { login } from "../controllers/authController.js";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/rolesController.js";
import {
  listOrders,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderDetails,
  processOrder,
  addReceipt,
  addBeneficiary,
  addPayment,
} from "../controllers/ordersController.js";
import {
  listAccounts,
  getAccountsSummary,
  getAccountsByCurrency,
  createAccount,
  updateAccount,
  deleteAccount,
  addFunds,
  withdrawFunds,
  getAccountTransactions,
} from "../controllers/accountsController.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.get("/currencies", listCurrencies);
router.post("/currencies", createCurrency);
router.put("/currencies/:id", updateCurrency);
router.delete("/currencies/:id", deleteCurrency);

router.get("/exchange-rates/:currency", getExchangeRates);

router.get("/customers", listCustomers);
router.post("/customers", createCustomer);
router.put("/customers/:id", updateCustomer);
router.delete("/customers/:id", deleteCustomer);
router.get("/customers/:id/beneficiaries", listCustomerBeneficiaries);
router.post("/customers/:id/beneficiaries", addCustomerBeneficiary);
router.put("/customers/:id/beneficiaries/:beneficiaryId", updateCustomerBeneficiary);
router.delete("/customers/:id/beneficiaries/:beneficiaryId", deleteCustomerBeneficiary);

router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.post("/auth/login", login);

router.get("/roles", listRoles);
router.post("/roles", createRole);
router.put("/roles/:id", updateRole);
router.delete("/roles/:id", deleteRole);

router.get("/orders", listOrders);
router.post("/orders", createOrder);
// More specific routes must come before less specific ones
router.get("/orders/:id/details", getOrderDetails);
router.post("/orders/:id/process", processOrder);
router.post("/orders/:id/receipts", addReceipt);
router.post("/orders/:id/beneficiaries", addBeneficiary);
router.post("/orders/:id/payments", addPayment);
router.patch("/orders/:id/status", updateOrderStatus);
router.put("/orders/:id", updateOrder);
// DELETE must come last as it matches /orders/:id
router.delete("/orders/:id", deleteOrder);

router.get("/accounts", listAccounts);
router.get("/accounts/summary", getAccountsSummary);
router.get("/accounts/currency/:currencyCode", getAccountsByCurrency);
router.post("/accounts", createAccount);
router.put("/accounts/:id", updateAccount);
router.delete("/accounts/:id", deleteAccount);
router.post("/accounts/:id/add-funds", addFunds);
router.post("/accounts/:id/withdraw-funds", withdrawFunds);
router.get("/accounts/:id/transactions", getAccountTransactions);

export default router;


