import { db } from "../db.js";

export const listOrders = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, c.name as customerName, u.name as handlerName FROM orders o
       LEFT JOIN customers c ON c.id = o.customerId
       LEFT JOIN users u ON u.id = o.handlerId
       ORDER BY o.createdAt DESC;`,
    )
    .all();
  
  // Parse JSON fields and check for beneficiaries
  const orders = rows.map(order => {
    try {
      // Check if order has beneficiaries
      const beneficiaryCount = db
        .prepare("SELECT COUNT(*) as count FROM order_beneficiaries WHERE orderId = ?;")
        .get(order.id);
      const hasBeneficiaries = (beneficiaryCount?.count || 0) > 0;

      return {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        hasBeneficiaries,
      };
    } catch (e) {
      return {
        ...order,
        walletAddresses: null,
        bankDetails: null,
        hasBeneficiaries: false,
      };
    }
  });
  
  res.json(orders);
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

export const getOrderDetails = (req, res, next) => {
  try {
    const { id } = req.params;
    const order = db
      .prepare(
        `SELECT o.*, c.name as customerName, u.name as handlerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         LEFT JOIN users u ON u.id = o.handlerId
         WHERE o.id = ?;`,
      )
      .get(id);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const receipts = db
      .prepare("SELECT * FROM order_receipts WHERE orderId = ? ORDER BY createdAt ASC;")
      .all(id);

    const beneficiaries = db
      .prepare("SELECT * FROM order_beneficiaries WHERE orderId = ? ORDER BY createdAt ASC;")
      .all(id);

    const payments = db
      .prepare("SELECT * FROM order_payments WHERE orderId = ? ORDER BY createdAt ASC;")
      .all(id);

    const totalReceiptAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      order: {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
      },
      receipts,
      beneficiaries: beneficiaries.map(b => ({
        ...b,
        walletAddresses: b.walletAddresses ? JSON.parse(b.walletAddresses) : null,
      })),
      payments,
      totalReceiptAmount,
      totalPaymentAmount,
      receiptBalance: order.amountBuy - totalReceiptAmount,
      paymentBalance: order.amountSell - totalPaymentAmount,
    });
  } catch (error) {
    next(error);
  }
};

export const processOrder = (req, res, next) => {
  try {
    console.log("processOrder called with params:", req.params, "body:", req.body);
    const { id } = req.params;
    const { handlerId, paymentType, networkChain, walletAddresses, bankDetails } = req.body;

    if (!handlerId || !paymentType) {
      return res.status(400).json({ message: "Handler ID and payment type are required" });
    }

    // Check if order exists
    const existingOrder = db.prepare("SELECT id FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updateStmt = db.prepare(
      `UPDATE orders 
       SET handlerId = @handlerId, 
           paymentType = @paymentType, 
           networkChain = @networkChain,
           walletAddresses = @walletAddresses,
           bankDetails = @bankDetails,
           status = 'waiting_for_receipt'
       WHERE id = @id;`
    );

    updateStmt.run({
      id: Number(id),
      handlerId: Number(handlerId),
      paymentType,
      networkChain: networkChain || null,
      walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
      bankDetails: bankDetails ? JSON.stringify(bankDetails) : null,
    });

    const order = db
      .prepare(
        `SELECT o.*, c.name as customerName, u.name as handlerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         LEFT JOIN users u ON u.id = o.handlerId
         WHERE o.id = ?;`,
      )
      .get(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found after update" });
    }

    try {
      res.json({
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
      });
    } catch (parseError) {
      res.json({
        ...order,
        walletAddresses: null,
        bankDetails: null,
      });
    }
  } catch (error) {
    console.error("Error processing order:", error);
    next(error);
  }
};

export const addReceipt = (req, res, next) => {
  try {
    const { id } = req.params;
    const { imagePath, amount } = req.body;

    if (!imagePath || amount === undefined) {
      return res.status(400).json({ message: "Image path and amount are required" });
    }

    const stmt = db.prepare(
      `INSERT INTO order_receipts (orderId, imagePath, amount, createdAt)
       VALUES (@orderId, @imagePath, @amount, @createdAt);`
    );

    const result = stmt.run({
      orderId: id,
      imagePath,
      amount: parseFloat(amount),
      createdAt: new Date().toISOString(),
    });

    const receipt = db
      .prepare("SELECT * FROM order_receipts WHERE id = ?;")
      .get(result.lastInsertRowid);

    // Check if total receipts match amountBuy
    const receipts = db
      .prepare("SELECT * FROM order_receipts WHERE orderId = ?;")
      .all(id);
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    const order = db.prepare("SELECT amountBuy FROM orders WHERE id = ?;").get(id);

    if (totalAmount >= order.amountBuy) {
      db.prepare("UPDATE orders SET status = 'waiting_for_payment' WHERE id = ?;").run(id);
    }

    res.json(receipt);
  } catch (error) {
    next(error);
  }
};

export const addBeneficiary = (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentType, networkChain, walletAddresses, bankName, accountTitle, accountNumber, accountIban, swiftCode, bankAddress } = req.body;

    if (!paymentType) {
      return res.status(400).json({ message: "Payment type is required" });
    }

    const stmt = db.prepare(
      `INSERT INTO order_beneficiaries 
       (orderId, paymentType, networkChain, walletAddresses, bankName, accountTitle, accountNumber, accountIban, swiftCode, bankAddress, createdAt)
       VALUES (@orderId, @paymentType, @networkChain, @walletAddresses, @bankName, @accountTitle, @accountNumber, @accountIban, @swiftCode, @bankAddress, @createdAt);`
    );

    const result = stmt.run({
      orderId: id,
      paymentType,
      networkChain: networkChain || null,
      walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
      bankName: bankName || null,
      accountTitle: accountTitle || null,
      accountNumber: accountNumber || null,
      accountIban: accountIban || null,
      swiftCode: swiftCode || null,
      bankAddress: bankAddress || null,
      createdAt: new Date().toISOString(),
    });

    const beneficiary = db
      .prepare("SELECT * FROM order_beneficiaries WHERE id = ?;")
      .get(result.lastInsertRowid);

    res.json({
      ...beneficiary,
      walletAddresses: beneficiary.walletAddresses ? JSON.parse(beneficiary.walletAddresses) : null,
    });
  } catch (error) {
    next(error);
  }
};

export const addPayment = (req, res, next) => {
  try {
    const { id } = req.params;
    const { imagePath, amount } = req.body;

    if (!imagePath || amount === undefined) {
      return res.status(400).json({ message: "Image path and amount are required" });
    }

    const stmt = db.prepare(
      `INSERT INTO order_payments (orderId, imagePath, amount, createdAt)
       VALUES (@orderId, @imagePath, @amount, @createdAt);`
    );

    const result = stmt.run({
      orderId: id,
      imagePath,
      amount: parseFloat(amount),
      createdAt: new Date().toISOString(),
    });

    const payment = db
      .prepare("SELECT * FROM order_payments WHERE id = ?;")
      .get(result.lastInsertRowid);

    // Check if total payments match amountSell
    const payments = db
      .prepare("SELECT * FROM order_payments WHERE orderId = ?;")
      .all(id);
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const order = db.prepare("SELECT amountSell FROM orders WHERE id = ?;").get(id);

    if (totalAmount >= order.amountSell) {
      db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?;").run(id);
    }

    res.json(payment);
  } catch (error) {
    next(error);
  }
};


