import { db } from "../db.js";

// Helper function to calculate amountSell from amountBuy using the same logic as order creation (OrdersPage.tsx lines 298-365)
const calculateAmountSell = (amountBuy, rate, fromCurrency, toCurrency) => {
  // Determine which side is the "stronger" currency so we know which way to apply the rate.
  // Heuristic: USDT (or any currency with rate <= 1) is the base; otherwise pick the currency with the smaller rate.
  const getCurrencyRate = (code) => {
    const currency = db.prepare("SELECT baseRateBuy, conversionRateBuy, baseRateSell, conversionRateSell FROM currencies WHERE code = ? AND active = 1;").get(code);
    if (!currency) return null;
    const candidate = currency.conversionRateBuy ?? currency.baseRateBuy ?? currency.baseRateSell ?? currency.conversionRateSell;
    return typeof candidate === "number" ? candidate : null;
  };

  const fromRate = getCurrencyRate(fromCurrency);
  const toRate = getCurrencyRate(toCurrency);

  const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : fromCurrency === "USDT";
  const inferredToIsUSDT = toRate !== null ? toRate <= 1 : toCurrency === "USDT";

  // If both sides look like USDT (rate <= 1), nothing to auto-calc - default to fromCurrency as base
  if (inferredFromIsUSDT && inferredToIsUSDT) {
    // Default: multiply (baseIsFrom = true)
    return amountBuy * rate;
  }

  let baseIsFrom = null;
  if (inferredFromIsUSDT !== inferredToIsUSDT) {
    // One side is USDT (or behaves like it)
    baseIsFrom = inferredFromIsUSDT;
  } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
    // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
    baseIsFrom = fromRate < toRate;
  } else {
    // Default to fromCurrency as base if we can't determine
    baseIsFrom = true;
  }

  if (baseIsFrom) {
    // Stronger/base currency (fromCurrency) → weaker: multiply by rate
    return amountBuy * rate;
  } else {
    // Weaker → stronger/base currency (toCurrency): divide by rate
    return amountBuy / rate;
  }
};

// Helper function to reverse calculateAmountSell: calculate amountBuy from amountSell
const calculateAmountBuy = (amountSell, rate, fromCurrency, toCurrency) => {
  const getCurrencyRate = (code) => {
    const currency = db.prepare("SELECT baseRateBuy, conversionRateBuy, baseRateSell, conversionRateSell FROM currencies WHERE code = ? AND active = 1;").get(code);
    if (!currency) return null;
    const candidate = currency.conversionRateBuy ?? currency.baseRateBuy ?? currency.baseRateSell ?? currency.conversionRateSell;
    return typeof candidate === "number" ? candidate : null;
  };

  const fromRate = getCurrencyRate(fromCurrency);
  const toRate = getCurrencyRate(toCurrency);

  const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : fromCurrency === "USDT";
  const inferredToIsUSDT = toRate !== null ? toRate <= 1 : toCurrency === "USDT";

  // If both sides look like USDT (rate <= 1), default to fromCurrency as base
  if (inferredFromIsUSDT && inferredToIsUSDT) {
    // Reverse: if amountSell = amountBuy * rate, then amountBuy = amountSell / rate
    return amountSell / rate;
  }

  let baseIsFrom = null;
  if (inferredFromIsUSDT !== inferredToIsUSDT) {
    baseIsFrom = inferredFromIsUSDT;
  } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
    baseIsFrom = fromRate < toRate;
  } else {
    baseIsFrom = true;
  }

  if (baseIsFrom) {
    // Reverse: if amountSell = amountBuy * rate, then amountBuy = amountSell / rate
    return amountSell / rate;
  } else {
    // Reverse: if amountSell = amountBuy / rate, then amountBuy = amountSell * rate
    return amountSell * rate;
  }
};

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
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
      };
    } catch (e) {
      return {
        ...order,
        walletAddresses: null,
        bankDetails: null,
        hasBeneficiaries: false,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
      };
    }
  });
  
  res.json(orders);
};

export const createOrder = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO orders (customerId, fromCurrency, toCurrency, amountBuy, amountSell, rate, status, buyAccountId, sellAccountId, isFlexOrder, createdAt)
       VALUES (@customerId, @fromCurrency, @toCurrency, @amountBuy, @amountSell, @rate, @status, @buyAccountId, @sellAccountId, @isFlexOrder, @createdAt);`,
    );
    const result = stmt.run({
      ...payload,
      status: payload.status || "pending",
      buyAccountId: payload.buyAccountId || null,
      sellAccountId: payload.sellAccountId || null,
      isFlexOrder: payload.isFlexOrder ? 1 : 0,
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
      .prepare(
        `SELECT r.*, a.name as accountName 
         FROM order_receipts r
         LEFT JOIN accounts a ON a.id = r.accountId
         WHERE r.orderId = ? 
         ORDER BY r.createdAt ASC;`
      )
      .all(id);

    const beneficiaries = db
      .prepare("SELECT * FROM order_beneficiaries WHERE orderId = ? ORDER BY createdAt ASC;")
      .all(id);

    const payments = db
      .prepare(
        `SELECT p.*, a.name as accountName 
         FROM order_payments p
         LEFT JOIN accounts a ON a.id = p.accountId
         WHERE p.orderId = ? 
         ORDER BY p.createdAt ASC;`
      )
      .all(id);

    const totalReceiptAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Use the original amountBuy and amountSell from order creation
    const receiptBalance = order.amountBuy - totalReceiptAmount;
    const paymentBalance = order.amountSell - totalPaymentAmount;

    // For flex orders, calculate balances based on actual amounts
    let receiptBalanceCalc = receiptBalance;
    let paymentBalanceCalc = paymentBalance;
    
    if (order.isFlexOrder === 1) {
      const expectedReceiptAmount = order.actualAmountBuy || order.amountBuy;
      // For payment balance, calculate expected payment based on actual receipts received
      // This ensures excess payments show as negative balance
      // Use the rate to calculate what payment should be based on receipts
      const effectiveRate = order.actualRate || order.rate;
      const expectedPaymentBasedOnReceipts = calculateAmountSell(
        totalReceiptAmount,
        effectiveRate,
        order.fromCurrency,
        order.toCurrency
      );
      // Payment balance = expected payment (based on receipts) - actual payment
      // This will be negative when there's excess payment
      receiptBalanceCalc = expectedReceiptAmount - totalReceiptAmount;
      paymentBalanceCalc = expectedPaymentBasedOnReceipts - totalPaymentAmount;
    }
    
    res.json({
      order: {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
      },
      receipts,
      beneficiaries: beneficiaries.map(b => ({
        ...b,
        walletAddresses: b.walletAddresses ? JSON.parse(b.walletAddresses) : null,
      })),
      payments,
      totalReceiptAmount,
      totalPaymentAmount,
      receiptBalance: receiptBalanceCalc,
      paymentBalance: paymentBalanceCalc,
    });
  } catch (error) {
    next(error);
  }
};

export const processOrder = (req, res, next) => {
  try {
    console.log("processOrder called with params:", req.params, "body:", req.body);
    const { id } = req.params;
    const { handlerId, paymentFlow = "receive_first" } = req.body;
    // Commented out for future use:
    // const { handlerId, paymentType, networkChain, walletAddresses, bankDetails } = req.body;

    if (!handlerId) {
      console.error("processOrder error: Handler ID is missing");
      return res.status(400).json({ message: "Handler ID is required" });
    }

    // Check if order exists and get its type
    const existingOrder = db.prepare("SELECT id, isFlexOrder FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      console.error("processOrder error: Order not found", id);
      return res.status(404).json({ message: "Order not found" });
    }

    // Determine status based on order type
    let status = "pending";
    if (existingOrder.isFlexOrder === 1) {
      // Flex orders go to "under_process" status
      status = "under_process";
    } else {
      // Regular orders use payment flow to determine status
      if (paymentFlow === "pay_first") {
        status = "waiting_for_payment";
      } else {
        status = "waiting_for_receipt";
      }
    }

    console.log("processOrder: Updating order", { id, handlerId, paymentFlow, status, isFlexOrder: existingOrder.isFlexOrder });

    // Update order with handler, payment flow (if provided), and status
    try {
      let updateResult;
      // For flex orders, paymentFlow is optional
      if (existingOrder.isFlexOrder === 1) {
        const updateStmt = db.prepare(
          `UPDATE orders 
           SET handlerId = @handlerId, 
               status = @status
           WHERE id = @id;`
        );
        updateResult = updateStmt.run({
          id: Number(id),
          handlerId: Number(handlerId),
          status: status,
        });
      } else {
        const updateStmt = db.prepare(
          `UPDATE orders 
           SET handlerId = @handlerId, 
               paymentFlow = @paymentFlow,
               status = @status
           WHERE id = @id;`
        );
        updateResult = updateStmt.run({
          id: Number(id),
          handlerId: Number(handlerId),
          paymentFlow: paymentFlow || "receive_first",
          status: status,
        });
      }

      console.log("processOrder: Update result", updateResult);
    } catch (updateError) {
      console.error("processOrder: Update error", updateError);
      return res.status(400).json({ message: `Failed to update order: ${updateError.message}` });
    }

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
    const { imagePath, amount, accountId } = req.body;

    if (!imagePath || amount === undefined) {
      return res.status(400).json({ message: "Image path and amount are required" });
    }

    if (typeof imagePath !== 'string' || imagePath.trim().length === 0) {
      return res.status(400).json({ message: "Invalid image path" });
    }

    // Check if order exists first and get paymentFlow
    const order = db.prepare("SELECT id, fromCurrency, toCurrency, amountBuy, amountSell, paymentFlow, buyAccountId, isFlexOrder FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const paymentFlow = order.paymentFlow || "receive_first";
    const isFlexOrder = order.isFlexOrder === 1;
    
    // Account ID is required
    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required for receipt" });
    }
    
    const receiptAccountId = Number(accountId);
    
    // Validate account
    const receiptAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?;").get(receiptAccountId);
    if (!receiptAccount) {
      return res.status(400).json({ message: "Receipt account not found" });
    }
    if (receiptAccount.currencyCode !== order.fromCurrency) {
      return res.status(400).json({ 
        message: `Receipt account currency (${receiptAccount.currencyCode}) does not match order fromCurrency (${order.fromCurrency})` 
      });
    }

    const receiptAmount = parseFloat(amount);

    // Insert receipt with accountId
    const stmt = db.prepare(
      `INSERT INTO order_receipts (orderId, imagePath, amount, accountId, createdAt)
       VALUES (@orderId, @imagePath, @amount, @accountId, @createdAt);`
    );

    const result = stmt.run({
      orderId: id,
      imagePath,
      amount: receiptAmount,
      accountId: receiptAccountId,
      createdAt: new Date().toISOString(),
    });

    const receipt = db
      .prepare(
        `SELECT r.*, a.name as accountName 
         FROM order_receipts r
         LEFT JOIN accounts a ON a.id = r.accountId
         WHERE r.id = ?;`
      )
      .get(result.lastInsertRowid);

    // Update account balance immediately
    const receiptAccountForBalance = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(receiptAccountId);
    if (receiptAccountForBalance) {
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(
        receiptAmount,
        receiptAccountId
      );
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(
        receiptAccountId,
        receiptAmount,
        `Order #${id} - Receipt from customer`,
        new Date().toISOString()
      );
    } else {
      return res.status(400).json({ message: "Receipt account not found" });
    }

    // Check if total receipts match expected amount
    const receipts = db
      .prepare("SELECT * FROM order_receipts WHERE orderId = ?;")
      .all(id);
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    
    // For flex orders, automatically update actualAmountBuy and actualAmountSell when receipts are uploaded
    if (isFlexOrder) {
      const currentOrder = db.prepare("SELECT actualRate, rate, fromCurrency, toCurrency FROM orders WHERE id = ?;").get(id);
      const effectiveRate = currentOrder?.actualRate || currentOrder?.rate || order.rate;
      const calculatedAmountSell = calculateAmountSell(totalAmount, effectiveRate, order.fromCurrency, order.toCurrency);
      
      // Update actualAmountBuy and actualAmountSell immediately
      db.prepare(
        `UPDATE orders 
         SET actualAmountBuy = @actualAmountBuy,
             actualAmountSell = @actualAmountSell,
             actualRate = @actualRate
         WHERE id = @id;`
      ).run({
        id: Number(id),
        actualAmountBuy: totalAmount,
        actualAmountSell: calculatedAmountSell,
        actualRate: effectiveRate,
      });
    }
    
    // For flex orders, use actualAmountBuy if set, otherwise use original amountBuy
    // For regular orders, use the original amountBuy from order creation
    let expectedAmount = order.amountBuy;
    const orderWithActual = db.prepare("SELECT actualAmountBuy FROM orders WHERE id = ?;").get(id);
    if (isFlexOrder && orderWithActual?.actualAmountBuy !== null && orderWithActual?.actualAmountBuy !== undefined) {
      expectedAmount = orderWithActual.actualAmountBuy;
    }

    // For flex orders, don't auto-advance status - let user proceed manually
    // For regular orders, advance when total >= expected
    if (!isFlexOrder && totalAmount >= expectedAmount) {
      // Update status based on payment flow
      if (paymentFlow === "pay_first") {
        // In pay-first flow, when receipts are complete, order is completed
        db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?;").run(id);
      } else {
        // In receive-first flow, when receipts are complete, wait for payment
        db.prepare("UPDATE orders SET status = 'waiting_for_payment' WHERE id = ?;").run(id);
      }
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
    const { paymentAccountId, receiptAccountId } = req.body;
    // Commented out for future use:
    // const { paymentType, networkChain, walletAddresses, bankName, accountTitle, accountNumber, accountIban, swiftCode, bankAddress } = req.body;

    // Check if order exists and get its details
    const existingOrder = db.prepare("SELECT id, fromCurrency, toCurrency, paymentFlow FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const paymentFlow = existingOrder.paymentFlow || "receive_first";

    // Handle payment account (for receive_first flow)
    if (paymentAccountId) {
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
    }

    // Handle receipt account (for pay_first flow when not set during processOrder)
    if (receiptAccountId) {
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

      // Update order with buyAccountId (receipt account - where we receive customer payment in fromCurrency)
      db.prepare("UPDATE orders SET buyAccountId = ? WHERE id = ?;").run(receiptAccountId, id);
    }

    if (!paymentAccountId && !receiptAccountId) {
      return res.status(400).json({ message: "Either payment account ID or receipt account ID is required" });
    }

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

// Helper function to update account balances when order is completed
const updateAccountBalancesOnCompletion = (orderId) => {
  // buyAccountId = receipt account (where we receive customer payment in fromCurrency)
  // sellAccountId = payment account (where we pay customer from in toCurrency)
  const orderWithAccounts = db
    .prepare("SELECT buyAccountId, sellAccountId, amountBuy, amountSell FROM orders WHERE id = ?;")
    .get(orderId);
  
  console.log(`Order ${orderId} completion - Accounts:`, {
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
        `Order #${orderId} - Receipt from customer`,
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
        `Order #${orderId} - Payment to customer`,
        new Date().toISOString()
      );
    } else {
      console.warn(`Sell account ${orderWithAccounts.sellAccountId} not found`);
    }
  } else {
    console.warn(`Order ${orderId} has no sellAccountId set`);
  }
};

export const addPayment = (req, res, next) => {
  try {
    const { id } = req.params;
    const { imagePath, amount, accountId } = req.body;

    if (!imagePath || amount === undefined) {
      return res.status(400).json({ message: "Image path and amount are required" });
    }

    if (typeof imagePath !== 'string' || imagePath.trim().length === 0) {
      return res.status(400).json({ message: "Invalid image path" });
    }

    // Check if order exists first and get paymentFlow
    const order = db.prepare("SELECT id, toCurrency, amountSell, paymentFlow, sellAccountId, isFlexOrder, actualAmountBuy, actualAmountSell, actualRate, rate FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const paymentFlow = order.paymentFlow || "receive_first";
    const isFlexOrder = order.isFlexOrder === 1;
    
    // Account ID is required
    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required for payment" });
    }
    
    const paymentAccountId = Number(accountId);
    
    // Validate account
    const paymentAccount = db.prepare("SELECT id, currencyCode, balance FROM accounts WHERE id = ?;").get(paymentAccountId);
    if (!paymentAccount) {
      return res.status(400).json({ message: "Payment account not found" });
    }
    if (paymentAccount.currencyCode !== order.toCurrency) {
      return res.status(400).json({ 
        message: `Payment account currency (${paymentAccount.currencyCode}) does not match order toCurrency (${order.toCurrency})` 
      });
    }

    const paymentAmount = parseFloat(amount);

    // Insert payment with accountId
    const stmt = db.prepare(
      `INSERT INTO order_payments (orderId, imagePath, amount, accountId, createdAt)
       VALUES (@orderId, @imagePath, @amount, @accountId, @createdAt);`
    );

    const result = stmt.run({
      orderId: id,
      imagePath,
      amount: paymentAmount,
      accountId: paymentAccountId,
      createdAt: new Date().toISOString(),
    });

    const payment = db
      .prepare(
        `SELECT p.*, a.name as accountName 
         FROM order_payments p
         LEFT JOIN accounts a ON a.id = p.accountId
         WHERE p.id = ?;`
      )
      .get(result.lastInsertRowid);

    // Update account balance immediately
    const accountForBalance = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(paymentAccountId);
    if (accountForBalance) {
      const oldBalance = accountForBalance.balance;
      const newBalance = oldBalance - paymentAmount;
      
      // Use explicit calculation to ensure negative values work
      db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, paymentAccountId);
      
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        paymentAccountId,
        paymentAmount,
        `Order #${id} - Payment to customer`,
        new Date().toISOString()
      );
    } else {
      return res.status(400).json({ message: "Payment account not found" });
    }

    // Check if total payments match expected amount
    const payments = db
      .prepare("SELECT * FROM order_payments WHERE orderId = ?;")
      .all(id);
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // For flex orders, use actualAmountSell if set, otherwise calculate from actualAmountBuy and rate
    // For regular orders, use the original amountSell from order creation
    let expectedAmount = order.amountSell;
    if (isFlexOrder) {
      const orderWithActual = db.prepare("SELECT actualAmountBuy, actualAmountSell, actualRate, rate FROM orders WHERE id = ?;").get(id);
      const effectiveRate = orderWithActual?.actualRate || orderWithActual?.rate || order.rate;
      const effectiveAmountBuy = orderWithActual?.actualAmountBuy || order.actualAmountBuy;
      
      if (orderWithActual?.actualAmountSell !== null && orderWithActual?.actualAmountSell !== undefined) {
        expectedAmount = orderWithActual.actualAmountSell;
      } else if (effectiveAmountBuy !== null && effectiveAmountBuy !== undefined) {
        expectedAmount = effectiveAmountBuy * effectiveRate;
      }
    }

    // For flex orders, check for excess payments
    if (isFlexOrder && totalAmount > expectedAmount) {
      const excessAmount = totalAmount - expectedAmount;
      const orderWithActual = db.prepare("SELECT actualRate, rate, actualAmountBuy FROM orders WHERE id = ?;").get(id);
      const effectiveRate = orderWithActual?.actualRate || orderWithActual?.rate || order.rate;
      
      // Get total receipts to use as current actualAmountBuy if not set
      const receipts = db.prepare("SELECT * FROM order_receipts WHERE orderId = ?;").all(id);
      const totalReceiptAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
      
      // Calculate additional receipts needed using reverse calculation
      const additionalReceiptsNeeded = calculateAmountBuy(excessAmount, effectiveRate, order.fromCurrency, order.toCurrency);
      
      // Update actualAmountSell to total payment amount
      // Update actualAmountBuy to current actualAmountBuy (or total receipts if not set) + additional receipts needed
      const currentActualAmountBuy = orderWithActual?.actualAmountBuy !== null && orderWithActual?.actualAmountBuy !== undefined 
        ? orderWithActual.actualAmountBuy 
        : totalReceiptAmount;
      const newActualAmountBuy = currentActualAmountBuy + additionalReceiptsNeeded;
      
      db.prepare(
        `UPDATE orders 
         SET actualAmountSell = @actualAmountSell,
             actualAmountBuy = @actualAmountBuy,
             actualRate = @actualRate
         WHERE id = @id;`
      ).run({
        id: Number(id),
        actualAmountSell: totalAmount,
        actualAmountBuy: newActualAmountBuy,
        actualRate: effectiveRate,
      });
      
      // Don't complete order if there's excess - user needs to upload more receipts
      // Status will be handled by frontend logic or a separate endpoint
      return res.json({
        ...payment,
        flexOrderExcess: {
          excessAmount,
          additionalReceiptsNeeded,
          effectiveRate,
        },
      });
    }

    // For regular orders or flex orders without excess, update status normally
    if (!isFlexOrder && totalAmount >= expectedAmount) {
      // Update status based on payment flow
      if (paymentFlow === "pay_first") {
        // In pay-first flow, when payments are complete, wait for receipt
        db.prepare("UPDATE orders SET status = 'waiting_for_receipt' WHERE id = ?;").run(id);
      } else {
        // In receive-first flow, when payments are complete, order is completed
        db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?;").run(id);
      }
    } else if (isFlexOrder && totalAmount >= expectedAmount) {
      // For flex orders, check if all receipts match the required amount after excess
      const receipts = db.prepare("SELECT * FROM order_receipts WHERE orderId = ?;").all(id);
      const totalReceiptAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
      const orderWithActual = db.prepare("SELECT actualAmountBuy FROM orders WHERE id = ?;").get(id);
      const expectedReceiptAmount = orderWithActual?.actualAmountBuy;
      
      if (expectedReceiptAmount !== null && expectedReceiptAmount !== undefined && totalReceiptAmount >= expectedReceiptAmount) {
        // All receipts received, complete the order
        if (paymentFlow === "pay_first") {
          db.prepare("UPDATE orders SET status = 'waiting_for_receipt' WHERE id = ?;").run(id);
        } else {
          db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?;").run(id);
        }
      }
    }

    res.json(payment);
  } catch (error) {
    console.error("Error adding payment:", error);
    next(error);
  }
};

export const proceedWithPartialReceipts = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if order exists and is a flex order
    const order = db.prepare("SELECT id, isFlexOrder, paymentFlow, rate, actualRate, fromCurrency, toCurrency FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    if (order.isFlexOrder !== 1) {
      return res.status(400).json({ message: "This endpoint is only for flex orders" });
    }
    
    // Get total receipts
    const receipts = db.prepare("SELECT * FROM order_receipts WHERE orderId = ?;").all(id);
    const totalReceiptAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    
    if (totalReceiptAmount <= 0) {
      return res.status(400).json({ message: "No receipts found for this order" });
    }
    
    // Update actualAmountBuy to total receipts
    // Use actualRate if available, otherwise use original rate
    const effectiveRate = order.actualRate || order.rate;
    const calculatedAmountSell = calculateAmountSell(totalReceiptAmount, effectiveRate, order.fromCurrency, order.toCurrency);
    
    db.prepare(
      `UPDATE orders 
       SET actualAmountBuy = @actualAmountBuy,
           actualAmountSell = @actualAmountSell,
           actualRate = @actualRate,
           status = @status
       WHERE id = @id;`
    ).run({
      id: Number(id),
      actualAmountBuy: totalReceiptAmount,
      actualAmountSell: calculatedAmountSell,
      actualRate: effectiveRate,
      status: "under_process",
    });
    
    const updatedOrder = db
      .prepare(
        `SELECT o.*, c.name as customerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         WHERE o.id = ?;`,
      )
      .get(id);
    
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error proceeding with partial receipts:", error);
    next(error);
  }
};

export const adjustFlexOrderRate = (req, res, next) => {
  try {
    const { id } = req.params;
    const { rate } = req.body;
    
    if (!rate || isNaN(rate) || rate <= 0) {
      return res.status(400).json({ message: "Valid exchange rate is required" });
    }
    
    // Check if order exists and is a flex order
    const order = db.prepare("SELECT id, isFlexOrder, actualAmountBuy, amountBuy, fromCurrency, toCurrency FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    if (order.isFlexOrder !== 1) {
      return res.status(400).json({ message: "This endpoint is only for flex orders" });
    }
    
    const newRate = parseFloat(rate);
    const actualAmountBuy = order.actualAmountBuy || order.amountBuy;
    const calculatedAmountSell = calculateAmountSell(actualAmountBuy, newRate, order.fromCurrency, order.toCurrency);
    
    // Update actualRate and recalculate actualAmountSell
    db.prepare(
      `UPDATE orders 
       SET actualRate = @actualRate,
           actualAmountSell = @actualAmountSell
       WHERE id = @id;`
    ).run({
      id: Number(id),
      actualRate: newRate,
      actualAmountSell: calculatedAmountSell,
    });
    
    const updatedOrder = db
      .prepare(
        `SELECT o.*, c.name as customerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         WHERE o.id = ?;`,
      )
      .get(id);
    
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error adjusting flex order rate:", error);
    next(error);
  }
};


