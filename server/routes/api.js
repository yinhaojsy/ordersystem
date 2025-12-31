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
  subscribeToRoleUpdates,
  forceLogoutUsersByRole,
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
  proceedWithPartialReceipts,
  adjustFlexOrderRate,
} from "../controllers/ordersController.js";
import { upload } from "../middleware/upload.js";
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
  getAccountReferences,
  getAllReferences,
} from "../controllers/accountsController.js";
import {
  listTransfers,
  createTransfer,
  updateTransfer,
  deleteTransfer,
  getTransferChanges,
} from "../controllers/transfersController.js";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseChanges,
} from "../controllers/expensesController.js";
import {
  getProfitCalculations,
  getProfitCalculation,
  createProfitCalculation,
  updateProfitCalculation,
  deleteProfitCalculation,
  updateAccountMultiplier,
  updateExchangeRate,
  deleteGroup,
  renameGroup,
  setDefaultCalculation,
  unsetDefaultCalculation,
} from "../controllers/profitController.js";
import { getSetting, setSetting } from "../controllers/settingsController.js";

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
router.get("/roles/subscribe", subscribeToRoleUpdates);
router.post("/roles", createRole);
router.put("/roles/:id", updateRole);
router.post("/roles/:id/force-logout", forceLogoutUsersByRole);
router.delete("/roles/:id", deleteRole);

router.get("/orders", listOrders);
router.post("/orders", createOrder);
// More specific routes must come before less specific ones
router.get("/orders/:id/details", getOrderDetails);
router.post("/orders/:id/process", processOrder);
router.post("/orders/:id/receipts", upload.single("file"), addReceipt);
router.post("/orders/:id/beneficiaries", addBeneficiary);
router.post("/orders/:id/payments", upload.single("file"), addPayment);
router.post("/orders/:id/proceed-partial-receipts", proceedWithPartialReceipts);
router.post("/orders/:id/adjust-rate", adjustFlexOrderRate);
router.patch("/orders/:id/status", updateOrderStatus);
router.put("/orders/:id", updateOrder);
// DELETE must come last as it matches /orders/:id
router.delete("/orders/:id", deleteOrder);

router.get("/accounts", listAccounts);
router.get("/accounts/summary", getAccountsSummary);
router.get("/accounts/currency/:currencyCode", getAccountsByCurrency);
router.get("/accounts/debug/references", getAllReferences);
router.get("/accounts/:id/references", getAccountReferences);
router.post("/accounts", createAccount);
router.put("/accounts/:id", updateAccount);
router.delete("/accounts/:id", deleteAccount);
router.post("/accounts/:id/add-funds", addFunds);
router.post("/accounts/:id/withdraw-funds", withdrawFunds);
router.get("/accounts/:id/transactions", getAccountTransactions);

router.get("/transfers", listTransfers);
router.post("/transfers", createTransfer);
router.get("/transfers/:id/changes", getTransferChanges);
router.put("/transfers/:id", updateTransfer);
router.delete("/transfers/:id", deleteTransfer);

router.get("/expenses", listExpenses);
router.post("/expenses", upload.single("file"), createExpense);
router.get("/expenses/:id/changes", getExpenseChanges);
router.put("/expenses/:id", upload.single("file"), updateExpense);
router.delete("/expenses/:id", deleteExpense);

router.get("/profit-calculations", getProfitCalculations);
router.get("/profit-calculations/:id", getProfitCalculation);
router.post("/profit-calculations", createProfitCalculation);
router.put("/profit-calculations/:id", updateProfitCalculation);
router.delete("/profit-calculations/:id", deleteProfitCalculation);
router.put("/profit-calculations/:id/multipliers/:accountId", updateAccountMultiplier);
router.put("/profit-calculations/:id/exchange-rates", updateExchangeRate);
router.delete("/profit-calculations/:id/groups", deleteGroup);
router.put("/profit-calculations/:id/groups", renameGroup);
router.put("/profit-calculations/:id/set-default", setDefaultCalculation);
router.put("/profit-calculations/:id/unset-default", unsetDefaultCalculation);

router.get("/settings/:key", getSetting);
router.put("/settings", setSetting);

export default router;


