import { db } from "../db.js";

export const listOrders = (_req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, c.name as customerName, u.name as handlerName,
       buyAcc.name as buyAccountName, sellAcc.name as sellAccountName
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customerId
       LEFT JOIN users u ON u.id = o.handlerId
       LEFT JOIN accounts buyAcc ON buyAcc.id = o.buyAccountId
       LEFT JOIN accounts sellAcc ON sellAcc.id = o.sellAccountId
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
      `INSERT INTO orders (customerId, fromCurrency, toCurrency, amountBuy, amountSell, rate, status, buyAccountId, sellAccountId, createdAt)
       VALUES (@customerId, @fromCurrency, @toCurrency, @amountBuy, @amountSell, @rate, @status, @buyAccountId, @sellAccountId, @createdAt);`,
    );
    const result = stmt.run({
      ...payload,
      status: payload.status || "pending",
      buyAccountId: payload.buyAccountId || null,
      sellAccountId: payload.sellAccountId || null,
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

export const updateOrder = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    
    // Check if order exists and is in pending status
    const existingOrder = db.prepare("SELECT id, status FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (existingOrder.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can be edited" });
    }

    // Build update query dynamically
    const allowedFields = ["customerId", "fromCurrency", "toCurrency", "amountBuy", "amountSell", "rate"];
    const fieldsToUpdate = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const assignments = fieldsToUpdate.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE orders SET ${assignments} WHERE id = @id;`).run({
      ...updates,
      id: Number(id),
    });

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
    const { handlerId, receiptAccountId } = req.body;
    // Commented out for future use:
    // const { handlerId, paymentType, networkChain, walletAddresses, bankDetails } = req.body;

    if (!handlerId || !receiptAccountId) {
      return res.status(400).json({ message: "Handler ID and receipt account ID are required" });
    }

    // Check if order exists and get its fromCurrency
    const existingOrder = db.prepare("SELECT id, fromCurrency FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify receipt account exists and matches order's fromCurrency
    const receiptAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?").get(receiptAccountId);
    if (!receiptAccount) {
      return res.status(400).json({ message: "Receipt account not found" });
    }
    if (receiptAccount.currencyCode !== existingOrder.fromCurrency) {
      return res.status(400).json({ 
        message: `Receipt account currency (${receiptAccount.currencyCode}) does not match order fromCurrency (${existingOrder.fromCurrency})` 
      });
    }

    // Store receiptAccountId as buyAccountId (receipt account - where we receive customer payment in fromCurrency)
    const updateStmt = db.prepare(
      `UPDATE orders 
       SET handlerId = @handlerId, 
           buyAccountId = @receiptAccountId,
           status = 'waiting_for_receipt'
       WHERE id = @id;`
      // Commented out for future use:
      // UPDATE orders 
      // SET handlerId = @handlerId, 
      //     paymentType = @paymentType, 
      //     networkChain = @networkChain,
      //     walletAddresses = @walletAddresses,
      //     bankDetails = @bankDetails,
      //     status = 'waiting_for_receipt'
      // WHERE id = @id;
    );

    updateStmt.run({
      id: Number(id),
      handlerId: Number(handlerId),
      receiptAccountId: Number(receiptAccountId),
      // Commented out for future use:
      // paymentType,
      // networkChain: networkChain || null,
      // walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
      // bankDetails: bankDetails ? JSON.stringify(bankDetails) : null,
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

    if (typeof imagePath !== 'string' || imagePath.trim().length === 0) {
      return res.status(400).json({ message: "Invalid image path" });
    }

    // Check if order exists first
    const order = db.prepare("SELECT amountBuy FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
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

    if (totalAmount >= order.amountBuy) {
      db.prepare("UPDATE orders SET status = 'waiting_for_payment' WHERE id = ?;").run(id);
    }

    res.json(receipt);
  } catch (error) {
    console.error("Error adding receipt:", error);
    next(error);
  }
};

export const addBeneficiary = (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentAccountId } = req.body;
    // Commented out for future use:
    // const { paymentType, networkChain, walletAddresses, bankName, accountTitle, accountNumber, accountIban, swiftCode, bankAddress } = req.body;

    if (!paymentAccountId) {
      return res.status(400).json({ message: "Payment account ID is required" });
    }

    // Check if order exists and get its toCurrency
    const existingOrder = db.prepare("SELECT id, toCurrency FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify payment account exists and matches order's toCurrency
    const paymentAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?").get(paymentAccountId);
    if (!paymentAccount) {
      return res.status(400).json({ message: "Payment account not found" });
    }
    if (paymentAccount.currencyCode !== existingOrder.toCurrency) {
      return res.status(400).json({ 
        message: `Payment account currency (${paymentAccount.currencyCode}) does not match order toCurrency (${existingOrder.toCurrency})` 
      });
    }

    // Update order with sellAccountId (payment account - where we pay customer from in toCurrency)
    db.prepare("UPDATE orders SET sellAccountId = ? WHERE id = ?;").run(paymentAccountId, id);

    // Commented out for future use - beneficiary details:
    // const stmt = db.prepare(
    //   `INSERT INTO order_beneficiaries 
    //    (orderId, paymentType, networkChain, walletAddresses, bankName, accountTitle, accountNumber, accountIban, swiftCode, bankAddress, createdAt)
    //    VALUES (@orderId, @paymentType, @networkChain, @walletAddresses, @bankName, @accountTitle, @accountNumber, @accountIban, @swiftCode, @bankAddress, @createdAt);`
    // );
    // const result = stmt.run({
    //   orderId: id,
    //   paymentType,
    //   networkChain: networkChain || null,
    //   walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
    //   bankName: bankName || null,
    //   accountTitle: accountTitle || null,
    //   accountNumber: accountNumber || null,
    //   accountIban: accountIban || null,
    //   swiftCode: swiftCode || null,
    //   bankAddress: bankAddress || null,
    //   createdAt: new Date().toISOString(),
    // });
    // const beneficiary = db
    //   .prepare("SELECT * FROM order_beneficiaries WHERE id = ?;")
    //   .get(result.lastInsertRowid);
    // res.json({
    //   ...beneficiary,
    //   walletAddresses: beneficiary.walletAddresses ? JSON.parse(beneficiary.walletAddresses) : null,
    // });

    // Return success response
    res.json({ success: true, message: "Payment account set successfully" });
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

    if (typeof imagePath !== 'string' || imagePath.trim().length === 0) {
      return res.status(400).json({ message: "Invalid image path" });
    }

    // Check if order exists first
    const order = db.prepare("SELECT amountSell FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
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

    if (totalAmount >= order.amountSell) {
      db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?;").run(id);
      
      // Update account balances when order is completed
      // buyAccountId = receipt account (where we receive customer payment in fromCurrency)
      // sellAccountId = payment account (where we pay customer from in toCurrency)
      const orderWithAccounts = db
        .prepare("SELECT buyAccountId, sellAccountId, amountBuy, amountSell FROM orders WHERE id = ?;")
        .get(id);
      
      console.log(`Order ${id} completion - Accounts:`, {
        buyAccountId: orderWithAccounts?.buyAccountId,
        sellAccountId: orderWithAccounts?.sellAccountId,
        amountBuy: orderWithAccounts?.amountBuy,
        amountSell: orderWithAccounts?.amountSell,
      });
      
      if (orderWithAccounts.buyAccountId) {
        // Add funds to buy account (receipt account) - customer paid us amountBuy in fromCurrency
        const buyAccount = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(orderWithAccounts.buyAccountId);
        if (buyAccount) {
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(
            orderWithAccounts.amountBuy,
            orderWithAccounts.buyAccountId
          );
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            orderWithAccounts.buyAccountId,
            orderWithAccounts.amountBuy,
            `Order #${id} - Receipt from customer`,
            new Date().toISOString()
          );
        }
      }
      
      if (orderWithAccounts.sellAccountId) {
        // Deduct funds from sell account (payment account) - we paid customer amountSell in toCurrency
        // Allow negative balances (employees may use their own money)
        const sellAccount = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(orderWithAccounts.sellAccountId);
        if (sellAccount) {
          const oldBalance = sellAccount.balance;
          const amountToDeduct = Number(orderWithAccounts.amountSell);
          const newBalance = oldBalance - amountToDeduct;
          
          console.log(`Updating sell account ${orderWithAccounts.sellAccountId}: ${oldBalance} - ${amountToDeduct} = ${newBalance}`);
          
          // Use explicit calculation to ensure negative values work
          const updateStmt = db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;");
          const updateResult = updateStmt.run(newBalance, orderWithAccounts.sellAccountId);
          
          console.log(`Update result:`, updateResult);
          
          // Verify the update
          const updatedAccount = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(orderWithAccounts.sellAccountId);
          console.log(`Updated balance:`, updatedAccount?.balance);
          
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            orderWithAccounts.sellAccountId,
            amountToDeduct,
            `Order #${id} - Payment to customer`,
            new Date().toISOString()
          );
        } else {
          console.warn(`Sell account ${orderWithAccounts.sellAccountId} not found`);
        }
      } else {
        console.warn(`Order ${id} has no sellAccountId set`);
      }
    }

    res.json(payment);
  } catch (error) {
    console.error("Error adding payment:", error);
    next(error);
  }
};


