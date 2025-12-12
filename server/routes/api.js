import { Router } from "express";
import {
  listCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
} from "../controllers/currenciesController.js";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customersController.js";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/usersController.js";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/rolesController.js";
import {
  listOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/ordersController.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.get("/currencies", listCurrencies);
router.post("/currencies", createCurrency);
router.put("/currencies/:id", updateCurrency);
router.delete("/currencies/:id", deleteCurrency);

router.get("/customers", listCustomers);
router.post("/customers", createCustomer);
router.put("/customers/:id", updateCustomer);
router.delete("/customers/:id", deleteCustomer);

router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

router.get("/roles", listRoles);
router.post("/roles", createRole);
router.put("/roles/:id", updateRole);
router.delete("/roles/:id", deleteRole);

router.get("/orders", listOrders);
router.post("/orders", createOrder);
router.patch("/orders/:id/status", updateOrderStatus);
router.delete("/orders/:id", deleteOrder);

export default router;


