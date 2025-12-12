import { db } from "../db.js";

export const listOrders = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, c.name as customerName FROM orders o
       LEFT JOIN customers c ON c.id = o.customerId
       ORDER BY o.createdAt DESC;`,
    )
    .all();
  res.json(rows);
};

export const createOrder = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO orders (customerId, fromCurrency, toCurrency, amountBuy, amountSell, rate, status, createdAt)
       VALUES (@customerId, @fromCurrency, @toCurrency, @amountBuy, @amountSell, @rate, @status, @createdAt);`,
    );
    const result = stmt.run({
      ...payload,
      status: payload.status || "pending",
      createdAt: new Date().toISOString(),
    });
    const row = db
      .prepare(
        `SELECT o.*, c.name as customerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         WHERE o.id = ?;`,
      )
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    db.prepare(`UPDATE orders SET status = @status WHERE id = @id;`).run({ id, status });
    const row = db
      .prepare(
        `SELECT o.*, c.name as customerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         WHERE o.id = ?;`,
      )
      .get(id);
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const deleteOrder = (req, res, next) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare(`DELETE FROM orders WHERE id = ?;`);
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};


