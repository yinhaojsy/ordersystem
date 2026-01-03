import { db } from "../db.js";
import {
  saveFile,
  deleteFile,
  generateOrderReceiptFilename,
  generateOrderPaymentFilename,
  base64ToBuffer,
  getFileUrl,
} from "../utils/fileStorage.js";

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

export const listOrders = (req, res) => {
  // Extract query parameters
  const {
    dateFrom,
    dateTo,
    handlerId,
    customerId,
    fromCurrency,
    toCurrency,
    buyAccountId,
    sellAccountId,
    status,
    page = '1',
    limit = '20',
  } = req.query;

  // Build WHERE clause conditions
  const conditions = [];
  const params = {};

  if (dateFrom) {
    conditions.push('DATE(o.createdAt) >= DATE(@dateFrom)');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    conditions.push('DATE(o.createdAt) <= DATE(@dateTo)');
    params.dateTo = dateTo;
  }
  if (handlerId) {
    conditions.push('o.handlerId = @handlerId');
    params.handlerId = parseInt(handlerId, 10);
  }
  if (customerId) {
    conditions.push('o.customerId = @customerId');
    params.customerId = parseInt(customerId, 10);
  }
  if (fromCurrency) {
    conditions.push('o.fromCurrency = @fromCurrency');
    params.fromCurrency = fromCurrency;
  }
  if (toCurrency) {
    conditions.push('o.toCurrency = @toCurrency');
    params.toCurrency = toCurrency;
  }
  if (buyAccountId) {
    // Check if buyAccountId matches the order's buyAccountId OR exists in order_receipts
    conditions.push(`(o.buyAccountId = @buyAccountId OR EXISTS (
      SELECT 1 FROM order_receipts r 
      WHERE r.orderId = o.id AND r.accountId = @buyAccountId
    ))`);
    params.buyAccountId = parseInt(buyAccountId, 10);
  }
  if (sellAccountId) {
    // Check if sellAccountId matches the order's sellAccountId OR exists in order_payments
    conditions.push(`(o.sellAccountId = @sellAccountId OR EXISTS (
      SELECT 1 FROM order_payments p 
      WHERE p.orderId = o.id AND p.accountId = @sellAccountId
    ))`);
    params.sellAccountId = parseInt(sellAccountId, 10);
  }
  if (status) {
    conditions.push('o.status = @status');
    params.status = status;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count for pagination
  const countQuery = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
  const countResult = db.prepare(countQuery).get(params);
  const total = countResult?.total || 0;

  // Calculate pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;
  const totalPages = Math.ceil(total / limitNum);

  // Build main query with pagination
  const query = `
    SELECT o.*, c.name as customerName, u.name as handlerName,
           buyAcc.name as buyAccountName, sellAcc.name as sellAccountName
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customerId
    LEFT JOIN users u ON u.id = o.handlerId
    LEFT JOIN accounts buyAcc ON buyAcc.id = o.buyAccountId
    LEFT JOIN accounts sellAcc ON sellAcc.id = o.sellAccountId
    ${whereClause}
    ORDER BY o.createdAt DESC
    LIMIT @limit OFFSET @offset;
  `;

  params.limit = limitNum;
  params.offset = offset;

  const rows = db.prepare(query).all(params);
  
  // Parse JSON fields and check for beneficiaries
  const orders = rows.map(order => {
    try {
      // Check if order has beneficiaries
      const beneficiaryCount = db
        .prepare("SELECT COUNT(*) as count FROM order_beneficiaries WHERE orderId = ?;")
        .get(order.id);
      const hasBeneficiaries = (beneficiaryCount?.count || 0) > 0;

      // Aggregate account data from receipts (buy accounts)
      const receipts = db
        .prepare(
          `SELECT r.accountId, a.name as accountName, SUM(r.amount) as totalAmount, MIN(r.createdAt) as firstCreatedAt
           FROM order_receipts r
           LEFT JOIN accounts a ON a.id = r.accountId
           WHERE r.orderId = ? AND r.accountId IS NOT NULL
           GROUP BY r.accountId, a.name
           ORDER BY firstCreatedAt ASC;`
        )
        .all(order.id);
      
      // Aggregate account data from payments (sell accounts)
      const payments = db
        .prepare(
          `SELECT p.accountId, a.name as accountName, SUM(p.amount) as totalAmount, MIN(p.createdAt) as firstCreatedAt
           FROM order_payments p
           LEFT JOIN accounts a ON a.id = p.accountId
           WHERE p.orderId = ? AND p.accountId IS NOT NULL
           GROUP BY p.accountId, a.name
           ORDER BY firstCreatedAt ASC;`
        )
        .all(order.id);

      // Format the account data
      const buyAccounts = receipts.map(r => ({
        accountId: r.accountId,
        accountName: r.accountName || `Account #${r.accountId}`,
        amount: r.totalAmount
      }));

      const sellAccounts = payments.map(p => ({
        accountId: p.accountId,
        accountName: p.accountName || `Account #${p.accountId}`,
        amount: p.totalAmount
      }));

      return {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        hasBeneficiaries,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: buyAccounts.length > 0 ? buyAccounts : null,
        sellAccounts: sellAccounts.length > 0 ? sellAccounts : null,
      };
    } catch (e) {
      return {
        ...order,
        walletAddresses: null,
        bankDetails: null,
        hasBeneficiaries: false,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: null,
        sellAccounts: null,
      };
    }
  });
  
  res.json({
    orders,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
  });
};

export const exportOrders = (req, res) => {
  // Extract query parameters (same as listOrders but without pagination)
  const {
    dateFrom,
    dateTo,
    handlerId,
    customerId,
    fromCurrency,
    toCurrency,
    buyAccountId,
    sellAccountId,
    status,
  } = req.query;

  // Build WHERE clause conditions (same logic as listOrders)
  const conditions = [];
  const params = {};

  if (dateFrom) {
    conditions.push('DATE(o.createdAt) >= DATE(@dateFrom)');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    conditions.push('DATE(o.createdAt) <= DATE(@dateTo)');
    params.dateTo = dateTo;
  }
  if (handlerId) {
    conditions.push('o.handlerId = @handlerId');
    params.handlerId = parseInt(handlerId, 10);
  }
  if (customerId) {
    conditions.push('o.customerId = @customerId');
    params.customerId = parseInt(customerId, 10);
  }
  if (fromCurrency) {
    conditions.push('o.fromCurrency = @fromCurrency');
    params.fromCurrency = fromCurrency;
  }
  if (toCurrency) {
    conditions.push('o.toCurrency = @toCurrency');
    params.toCurrency = toCurrency;
  }
  if (buyAccountId) {
    conditions.push(`(o.buyAccountId = @buyAccountId OR EXISTS (
      SELECT 1 FROM order_receipts r 
      WHERE r.orderId = o.id AND r.accountId = @buyAccountId
    ))`);
    params.buyAccountId = parseInt(buyAccountId, 10);
  }
  if (sellAccountId) {
    conditions.push(`(o.sellAccountId = @sellAccountId OR EXISTS (
      SELECT 1 FROM order_payments p 
      WHERE p.orderId = o.id AND p.accountId = @sellAccountId
    ))`);
    params.sellAccountId = parseInt(sellAccountId, 10);
  }
  if (status) {
    conditions.push('o.status = @status');
    params.status = status;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build query without pagination
  const query = `
    SELECT o.*, c.name as customerName, u.name as handlerName,
           buyAcc.name as buyAccountName, sellAcc.name as sellAccountName
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customerId
    LEFT JOIN users u ON u.id = o.handlerId
    LEFT JOIN accounts buyAcc ON buyAcc.id = o.buyAccountId
    LEFT JOIN accounts sellAcc ON sellAcc.id = o.sellAccountId
    ${whereClause}
    ORDER BY o.createdAt DESC;
  `;

  const rows = db.prepare(query).all(params);
  
  // Parse JSON fields and check for beneficiaries (same logic as listOrders)
  const orders = rows.map(order => {
    try {
      const beneficiaryCount = db
        .prepare("SELECT COUNT(*) as count FROM order_beneficiaries WHERE orderId = ?;")
        .get(order.id);
      const hasBeneficiaries = (beneficiaryCount?.count || 0) > 0;

      const receipts = db
        .prepare(
          `SELECT r.accountId, a.name as accountName, SUM(r.amount) as totalAmount, MIN(r.createdAt) as firstCreatedAt
           FROM order_receipts r
           LEFT JOIN accounts a ON a.id = r.accountId
           WHERE r.orderId = ? AND r.accountId IS NOT NULL
           GROUP BY r.accountId, a.name
           ORDER BY firstCreatedAt ASC;`
        )
        .all(order.id);
      
      const payments = db
        .prepare(
          `SELECT p.accountId, a.name as accountName, SUM(p.amount) as totalAmount, MIN(p.createdAt) as firstCreatedAt
           FROM order_payments p
           LEFT JOIN accounts a ON a.id = p.accountId
           WHERE p.orderId = ? AND p.accountId IS NOT NULL
           GROUP BY p.accountId, a.name
           ORDER BY firstCreatedAt ASC;`
        )
        .all(order.id);

      const buyAccounts = receipts.map(r => ({
        accountId: r.accountId,
        accountName: r.accountName || `Account #${r.accountId}`,
        amount: r.totalAmount
      }));

      const sellAccounts = payments.map(p => ({
        accountId: p.accountId,
        accountName: p.accountName || `Account #${p.accountId}`,
        amount: p.totalAmount
      }));

      return {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        hasBeneficiaries,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: buyAccounts.length > 0 ? buyAccounts : null,
        sellAccounts: sellAccounts.length > 0 ? sellAccounts : null,
      };
    } catch (e) {
      return {
        ...order,
        walletAddresses: null,
        bankDetails: null,
        hasBeneficiaries: false,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: null,
        sellAccounts: null,
      };
    }
  });
  
  res.json(orders);
};

export const createOrder = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO orders (customerId, fromCurrency, toCurrency, amountBuy, amountSell, rate, status, buyAccountId, sellAccountId, isFlexOrder, orderType, createdAt)
       VALUES (@customerId, @fromCurrency, @toCurrency, @amountBuy, @amountSell, @rate, @status, @buyAccountId, @sellAccountId, @isFlexOrder, @orderType, @createdAt);`,
    );
    const result = stmt.run({
      ...payload,
      status: payload.status || "pending",
      buyAccountId: payload.buyAccountId || null,
      sellAccountId: payload.sellAccountId || null,
      isFlexOrder: payload.isFlexOrder ? 1 : 0,
      orderType: payload.orderType || "online",
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
    
    // Check if order exists and get existing profit/service charge data
    const existingOrder = db.prepare("SELECT id, status, fromCurrency, toCurrency, profitAmount, profitAccountId, profitCurrency, serviceChargeAmount, serviceChargeAccountId, serviceChargeCurrency FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Fields that can only be updated when order is pending
    const pendingOnlyFields = ["customerId", "fromCurrency", "toCurrency", "amountBuy", "amountSell", "rate"];
    // Fields that can be updated at any time (service charges and profit)
    const alwaysUpdatableFields = ["serviceChargeAmount", "serviceChargeCurrency", "serviceChargeAccountId", "profitAmount", "profitCurrency", "profitAccountId", "handlerId"];
    
    // Separate updates into pending-only and always-updatable
    const pendingOnlyUpdates = {};
    const alwaysUpdatableUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (pendingOnlyFields.includes(key)) {
        pendingOnlyUpdates[key] = updates[key];
      } else if (alwaysUpdatableFields.includes(key)) {
        alwaysUpdatableUpdates[key] = updates[key];
      }
    });

    // If trying to update pending-only fields, check status
    if (Object.keys(pendingOnlyUpdates).length > 0 && existingOrder.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can have their core fields edited" });
    }

    // Service charges and profit can be updated for any status except "completed"
    if (Object.keys(alwaysUpdatableUpdates).length > 0 && existingOrder.status === "completed") {
      return res.status(400).json({ message: "Cannot update service charges or profit for completed orders" });
    }

    // Validate service charge and profit currency fields
    if (alwaysUpdatableUpdates.serviceChargeCurrency !== undefined) {
      const currency = alwaysUpdatableUpdates.serviceChargeCurrency;
      if (currency !== null && currency !== "" && currency !== existingOrder.fromCurrency && currency !== existingOrder.toCurrency) {
        return res.status(400).json({ message: "Service charge currency must be either fromCurrency or toCurrency" });
      }
    }
    if (alwaysUpdatableUpdates.profitCurrency !== undefined) {
      const currency = alwaysUpdatableUpdates.profitCurrency;
      if (currency !== null && currency !== "" && currency !== existingOrder.fromCurrency && currency !== existingOrder.toCurrency) {
        return res.status(400).json({ message: "Profit currency must be either fromCurrency or toCurrency" });
      }
    }

    // Handle account balance updates and transaction logging for profit
    if (alwaysUpdatableUpdates.profitAmount !== undefined || alwaysUpdatableUpdates.profitAccountId !== undefined || alwaysUpdatableUpdates.profitCurrency !== undefined) {
      const newProfitAmount = alwaysUpdatableUpdates.profitAmount !== undefined ? alwaysUpdatableUpdates.profitAmount : existingOrder.profitAmount;
      const newProfitAccountId = alwaysUpdatableUpdates.profitAccountId !== undefined ? alwaysUpdatableUpdates.profitAccountId : existingOrder.profitAccountId;
      const oldProfitAmount = existingOrder.profitAmount;
      const oldProfitAccountId = existingOrder.profitAccountId;

      // If profit was previously set, reverse the old transaction
      if (oldProfitAmount !== null && oldProfitAmount !== undefined && oldProfitAccountId) {
        // Reverse: subtract the old profit amount
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(oldProfitAmount, oldProfitAccountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          oldProfitAccountId,
          oldProfitAmount,
          `Order #${id} - Reversal of profit (Order updated)`,
          new Date().toISOString()
        );
      }

      // If new profit is set, add it to the account
      if (newProfitAmount !== null && newProfitAmount !== undefined && newProfitAccountId) {
        const amount = Number(newProfitAmount);
        if (!isNaN(amount) && amount > 0) {
          // Add profit to account balance
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(amount, newProfitAccountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            newProfitAccountId,
            amount,
            `Order #${id} - Profit`,
            new Date().toISOString()
          );
        }
      }
    }

    // Handle account balance updates and transaction logging for service charges
    if (alwaysUpdatableUpdates.serviceChargeAmount !== undefined || alwaysUpdatableUpdates.serviceChargeAccountId !== undefined || alwaysUpdatableUpdates.serviceChargeCurrency !== undefined) {
      const newServiceChargeAmount = alwaysUpdatableUpdates.serviceChargeAmount !== undefined ? alwaysUpdatableUpdates.serviceChargeAmount : existingOrder.serviceChargeAmount;
      const newServiceChargeAccountId = alwaysUpdatableUpdates.serviceChargeAccountId !== undefined ? alwaysUpdatableUpdates.serviceChargeAccountId : existingOrder.serviceChargeAccountId;
      const oldServiceChargeAmount = existingOrder.serviceChargeAmount;
      const oldServiceChargeAccountId = existingOrder.serviceChargeAccountId;

      // If service charge was previously set, reverse the old transaction
      if (oldServiceChargeAmount !== null && oldServiceChargeAmount !== undefined && oldServiceChargeAccountId) {
        const oldAmount = Number(oldServiceChargeAmount);
        if (!isNaN(oldAmount)) {
          if (oldAmount > 0) {
            // Reverse positive service charge: subtract (was added before)
            db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(oldAmount, oldServiceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'withdraw', ?, ?, ?);`
            ).run(
              oldServiceChargeAccountId,
              oldAmount,
              `Order #${id} - Reversal of service charge (Order updated)`,
              new Date().toISOString()
            );
          } else if (oldAmount < 0) {
            // Reverse negative service charge: add back (was subtracted before)
            const absAmount = Math.abs(oldAmount);
            db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(absAmount, oldServiceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'add', ?, ?, ?);`
            ).run(
              oldServiceChargeAccountId,
              absAmount,
              `Order #${id} - Reversal of service charge paid by us (Order updated)`,
              new Date().toISOString()
            );
          }
        }
      }

      // If new service charge is set, update account balance
      if (newServiceChargeAmount !== null && newServiceChargeAmount !== undefined && newServiceChargeAccountId) {
        const amount = Number(newServiceChargeAmount);
        if (!isNaN(amount) && amount !== 0) {
          if (amount > 0) {
            // Positive service charge: add to account (we receive it)
            db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(amount, newServiceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'add', ?, ?, ?);`
            ).run(
              newServiceChargeAccountId,
              amount,
              `Order #${id} - Service charge`,
              new Date().toISOString()
            );
          } else {
            // Negative service charge: subtract from account (we pay it)
            const absAmount = Math.abs(amount);
            db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(absAmount, newServiceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'withdraw', ?, ?, ?);`
            ).run(
              newServiceChargeAccountId,
              absAmount,
              `Order #${id} - Service charge paid by us`,
              new Date().toISOString()
            );
          }
        }
      }
    }

    // Combine all updates
    const allUpdates = { ...pendingOnlyUpdates, ...alwaysUpdatableUpdates };
    const fieldsToUpdate = Object.keys(allUpdates);
    
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    // Handle null values properly (to clear fields)
    const updateValues = {};
    fieldsToUpdate.forEach(field => {
      const value = allUpdates[field];
      if (value === null || value === "" || (typeof value === "string" && value.trim() === "")) {
        updateValues[field] = null;
      } else if (field === "profitAccountId" || field === "serviceChargeAccountId") {
        // Handle account IDs - convert empty string to null
        updateValues[field] = value === "" ? null : (value ? Number(value) : null);
      } else {
        updateValues[field] = value;
      }
    });
    updateValues.id = Number(id);

    const assignments = fieldsToUpdate.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE orders SET ${assignments} WHERE id = @id;`).run(updateValues);

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
    
    // Check if order exists and get profit/service charge data
    const order = db.prepare("SELECT id, profitAmount, profitAccountId, serviceChargeAmount, serviceChargeAccountId FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Get all confirmed receipts with accountId and amount for reversing balances (only reverse confirmed ones)
    const receipts = db.prepare("SELECT accountId, amount, imagePath, status FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").all(id);
    // Get all confirmed payments with accountId and amount for reversing balances (only reverse confirmed ones)
    const payments = db.prepare("SELECT accountId, amount, imagePath, status FROM order_payments WHERE orderId = ? AND status = 'confirmed';").all(id);
    
    // Get all receipts and payments for file deletion (including drafts)
    const allReceipts = db.prepare("SELECT imagePath FROM order_receipts WHERE orderId = ?;").all(id);
    const allPayments = db.prepare("SELECT imagePath FROM order_payments WHERE orderId = ?;").all(id);
    
    // Reverse account balances for confirmed receipts only
    // Receipts added to account balance, so we need to subtract
    receipts.forEach((receipt) => {
      if (receipt.accountId && receipt.amount) {
        const accountId = receipt.accountId;
        const amount = receipt.amount;
        
        // Subtract the amount from account balance (reverse the receipt)
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(amount, accountId);
        
        // Create reverse transaction in transaction history
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          accountId,
          amount,
          `Order #${id} - Reversal of receipt from customer (Order deleted)`,
          new Date().toISOString()
        );
      }
    });
    
    // Reverse account balances for payments
    // Payments subtracted from account balance, so we need to add back
    payments.forEach((payment) => {
      if (payment.accountId && payment.amount) {
        const accountId = payment.accountId;
        const amount = payment.amount;
        
        // Add the amount back to account balance (reverse the payment)
        db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(amount, accountId);
        
        // Create reverse transaction in transaction history
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'add', ?, ?, ?);`
        ).run(
          accountId,
          amount,
          `Order #${id} - Reversal of payment to customer (Order deleted)`,
          new Date().toISOString()
        );
      }
    });
    
    // Reverse profit transaction if it exists
    if (order.profitAmount !== null && order.profitAmount !== undefined && order.profitAccountId) {
      const profitAmount = Number(order.profitAmount);
      if (!isNaN(profitAmount) && profitAmount > 0) {
        // Profit was added to account, so we need to subtract it
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(profitAmount, order.profitAccountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          order.profitAccountId,
          profitAmount,
          `Order #${id} - Reversal of profit (Order deleted)`,
          new Date().toISOString()
        );
      }
    }
    
    // Reverse service charge transaction if it exists
    if (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined && order.serviceChargeAccountId) {
      const serviceChargeAmount = Number(order.serviceChargeAmount);
      if (!isNaN(serviceChargeAmount) && serviceChargeAmount !== 0) {
        if (serviceChargeAmount > 0) {
          // Positive service charge was added to account, so we need to subtract it
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(serviceChargeAmount, order.serviceChargeAccountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            order.serviceChargeAccountId,
            serviceChargeAmount,
            `Order #${id} - Reversal of service charge (Order deleted)`,
            new Date().toISOString()
          );
        } else {
          // Negative service charge was subtracted from account, so we need to add it back
          const absAmount = Math.abs(serviceChargeAmount);
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(absAmount, order.serviceChargeAccountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            order.serviceChargeAccountId,
            absAmount,
            `Order #${id} - Reversal of service charge paid by us (Order deleted)`,
            new Date().toISOString()
          );
        }
      }
    }
    
    // Delete associated files (including drafts)
    allReceipts.forEach((receipt) => deleteFile(receipt.imagePath));
    allPayments.forEach((payment) => deleteFile(payment.imagePath));
    
    // Collect all unique account IDs that were affected (only from confirmed)
    const affectedAccountIds = new Set();
    receipts.forEach((receipt) => {
      if (receipt.accountId) {
        affectedAccountIds.add(receipt.accountId);
      }
    });
    payments.forEach((payment) => {
      if (payment.accountId) {
        affectedAccountIds.add(payment.accountId);
      }
    });
    // Add profit and service charge account IDs if they exist
    if (order.profitAccountId) {
      affectedAccountIds.add(order.profitAccountId);
    }
    if (order.serviceChargeAccountId) {
      affectedAccountIds.add(order.serviceChargeAccountId);
    }
    
    // Delete the order (this will cascade delete receipts and payments due to foreign key constraints)
    const stmt = db.prepare(`DELETE FROM orders WHERE id = ?;`);
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ 
      success: true,
      affectedAccountIds: Array.from(affectedAccountIds)
    });
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

    // Calculate totals only from confirmed receipts/payments for balance calculations
    const totalReceiptAmount = receipts.filter(r => r.status === 'confirmed').reduce((sum, r) => sum + r.amount, 0);
    const totalPaymentAmount = payments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + p.amount, 0);
    
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
    
    // Convert file paths to URLs for receipts and payments
    const receiptsWithUrls = receipts.map(r => ({
      ...r,
      imagePath: r.imagePath.startsWith('data:') ? r.imagePath : getFileUrl(r.imagePath),
    }));
    
    const paymentsWithUrls = payments.map(p => ({
      ...p,
      imagePath: p.imagePath.startsWith('data:') ? p.imagePath : getFileUrl(p.imagePath),
    }));

    res.json({
      order: {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
      },
      receipts: receiptsWithUrls,
      beneficiaries: beneficiaries.map(b => ({
        ...b,
        walletAddresses: b.walletAddresses ? JSON.parse(b.walletAddresses) : null,
      })),
      payments: paymentsWithUrls,
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
    // Both flex orders and regular orders now go to "under_process" status
    let status = "under_process";

    console.log("processOrder: Updating order", { id, handlerId, paymentFlow, status, isFlexOrder: existingOrder.isFlexOrder });

    // Update order with handler and status
    // Both flex orders and regular orders now follow the same flow
    try {
      const updateStmt = db.prepare(
        `UPDATE orders 
         SET handlerId = @handlerId, 
             status = @status
         WHERE id = @id;`
      );
      const updateResult = updateStmt.run({
        id: Number(id),
        handlerId: Number(handlerId),
        status: status,
      });

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
    const { amount, accountId } = req.body;
    const file = req.file; // Multer file object

    // Support both file upload and base64 (for backward compatibility)
    let imagePath = null;
    
    if (file) {
      // New file upload path
      const filename = generateOrderReceiptFilename(id, file.mimetype, file.originalname);
      imagePath = saveFile(file.buffer, filename, "order");
    } else if (req.body.imagePath) {
      // Legacy base64 path (backward compatibility)
      const base64Path = req.body.imagePath;
      if (typeof base64Path === 'string' && base64Path.trim().length > 0) {
        if (base64Path.startsWith('data:')) {
          // Convert base64 to file for migration
          const buffer = base64ToBuffer(base64Path);
          if (buffer) {
            const filename = generateOrderReceiptFilename(id, null, null);
            imagePath = saveFile(buffer, filename, "order");
          } else {
            // If conversion fails, store as base64 (legacy)
            imagePath = base64Path;
          }
        } else {
          // Already a file path
          imagePath = base64Path;
        }
      }
    }

    // Check if order exists first and get paymentFlow and status
    const order = db.prepare("SELECT id, fromCurrency, toCurrency, amountBuy, amountSell, paymentFlow, buyAccountId, isFlexOrder, status, orderType FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const paymentFlow = order.paymentFlow || "receive_first";
    const isFlexOrder = order.isFlexOrder === 1;
    const isOtcOrder = order.orderType === "otc";
    
    // For OTC orders, imagePath is not required. Use placeholder if missing.
    // For regular orders, imagePath is required.
    if (!isOtcOrder && !imagePath) {
      return res.status(400).json({ message: "File/image is required for non-OTC orders" });
    }
    if (amount === undefined) {
      return res.status(400).json({ message: "Amount is required" });
    }
    
    // Use placeholder for OTC orders if no image
    if (isOtcOrder && !imagePath) {
      imagePath = "OTC_NO_IMAGE";
    }
    
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

    // Insert receipt with accountId and draft status (not confirmed yet)
    const stmt = db.prepare(
      `INSERT INTO order_receipts (orderId, imagePath, amount, accountId, status, createdAt)
       VALUES (@orderId, @imagePath, @amount, @accountId, @status, @createdAt);`
    );

    const result = stmt.run({
      orderId: id,
      imagePath,
      amount: receiptAmount,
      accountId: receiptAccountId,
      status: 'draft', // Create as draft - balances will be updated when confirmed
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
    
    // Convert file path to URL for response (if not base64)
    const receiptWithUrl = {
      ...receipt,
      imagePath: receipt.imagePath.startsWith('data:') ? receipt.imagePath : getFileUrl(receipt.imagePath),
    };

    // Note: Account balance and transaction history will only be updated when receipt is confirmed
    // This allows users to save drafts and confirm later

    // Update order's buyAccountId if not already set (use the account from the first receipt)
    if (receiptAccountId && !order.buyAccountId) {
      db.prepare("UPDATE orders SET buyAccountId = ? WHERE id = ?;").run(receiptAccountId, id);
    }

    // Check if total confirmed receipts match expected amount (only count confirmed)
    const receipts = db
      .prepare("SELECT * FROM order_receipts WHERE orderId = ? AND status = 'confirmed';")
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

    // For orders in "under_process" status (both flex and regular), don't auto-advance status - let user proceed manually
    // Status should only change when manually completing the order

    res.json(receiptWithUrl);
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
    const { amount, accountId } = req.body;
    const file = req.file; // Multer file object

    // Support both file upload and base64 (for backward compatibility)
    let imagePath = null;
    
    if (file) {
      // New file upload path
      const filename = generateOrderPaymentFilename(id, file.mimetype, file.originalname);
      imagePath = saveFile(file.buffer, filename, "order");
    } else if (req.body.imagePath) {
      // Legacy base64 path (backward compatibility)
      const base64Path = req.body.imagePath;
      if (typeof base64Path === 'string' && base64Path.trim().length > 0) {
        if (base64Path.startsWith('data:')) {
          // Convert base64 to file for migration
          const buffer = base64ToBuffer(base64Path);
          if (buffer) {
            const filename = generateOrderPaymentFilename(id, null, null);
            imagePath = saveFile(buffer, filename, "order");
          } else {
            // If conversion fails, store as base64 (legacy)
            imagePath = base64Path;
          }
        } else {
          // Already a file path
          imagePath = base64Path;
        }
      }
    }

    // Check if order exists first and get paymentFlow
    const order = db.prepare("SELECT id, toCurrency, amountSell, paymentFlow, sellAccountId, isFlexOrder, actualAmountBuy, actualAmountSell, actualRate, rate, orderType FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const paymentFlow = order.paymentFlow || "receive_first";
    const isFlexOrder = order.isFlexOrder === 1;
    const isOtcOrder = order.orderType === "otc";
    
    // For OTC orders, imagePath is not required. Use placeholder if missing.
    // For regular orders, imagePath is required.
    if (!isOtcOrder && !imagePath) {
      return res.status(400).json({ message: "File/image is required for non-OTC orders" });
    }
    if (amount === undefined) {
      return res.status(400).json({ message: "Amount is required" });
    }
    
    // Use placeholder for OTC orders if no image
    if (isOtcOrder && !imagePath) {
      imagePath = "OTC_NO_IMAGE";
    }
    
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

    // Insert payment with accountId and draft status (not confirmed yet)
    const stmt = db.prepare(
      `INSERT INTO order_payments (orderId, imagePath, amount, accountId, status, createdAt)
       VALUES (@orderId, @imagePath, @amount, @accountId, @status, @createdAt);`
    );

    const result = stmt.run({
      orderId: id,
      imagePath,
      amount: paymentAmount,
      accountId: paymentAccountId,
      status: 'draft', // Create as draft - balances will be updated when confirmed
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
    
    // Convert file path to URL for response (if not base64)
    const paymentWithUrl = {
      ...payment,
      imagePath: payment.imagePath.startsWith('data:') ? payment.imagePath : getFileUrl(payment.imagePath),
    };

    // Note: Account balance and transaction history will only be updated when payment is confirmed
    // This allows users to save drafts and confirm later

    // Update order's sellAccountId if not already set (use the account from the first payment)
    if (paymentAccountId && !order.sellAccountId) {
      db.prepare("UPDATE orders SET sellAccountId = ? WHERE id = ?;").run(paymentAccountId, id);
    }

    // Check if total confirmed payments match expected amount (only count confirmed)
    const payments = db
      .prepare("SELECT * FROM order_payments WHERE orderId = ? AND status = 'confirmed';")
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
      
      // Get total confirmed receipts to use as current actualAmountBuy if not set
      const receipts = db.prepare("SELECT * FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").all(id);
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

    // For orders in "under_process" status, don't auto-advance status - let user proceed manually
    // Status should only change when manually completing the order

    res.json(paymentWithUrl);
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
    
    // Get total confirmed receipts
    const receipts = db.prepare("SELECT * FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").all(id);
    const totalReceiptAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    
    if (totalReceiptAmount <= 0) {
      return res.status(400).json({ message: "No confirmed receipts found for this order" });
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

// Update a draft receipt (can only update drafts)
export const updateReceipt = (req, res, next) => {
  try {
    const { receiptId } = req.params;
    const { amount, accountId } = req.body;
    const file = req.file;

    // Check if receipt exists and is a draft
    const existingReceipt = db.prepare("SELECT * FROM order_receipts WHERE id = ?;").get(receiptId);
    if (!existingReceipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }
    if (existingReceipt.status !== 'draft') {
      return res.status(400).json({ message: "Only draft receipts can be updated" });
    }

    // Get order details
    const order = db.prepare("SELECT id, fromCurrency FROM orders WHERE id = ?;").get(existingReceipt.orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    let imagePath = existingReceipt.imagePath;
    
    // Update file if provided
    if (file) {
      // Delete old file
      if (imagePath && !imagePath.startsWith('data:')) {
        deleteFile(imagePath);
      }
      const filename = generateOrderReceiptFilename(order.id, file.mimetype, file.originalname);
      imagePath = saveFile(file.buffer, filename, "order");
    }

    // Validate account if provided
    let accountIdToUse = existingReceipt.accountId;
    if (accountId !== undefined && accountId !== null && accountId !== "") {
      const receiptAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?;").get(Number(accountId));
      if (!receiptAccount) {
        return res.status(400).json({ message: "Receipt account not found" });
      }
      if (receiptAccount.currencyCode !== order.fromCurrency) {
        return res.status(400).json({ 
          message: `Receipt account currency (${receiptAccount.currencyCode}) does not match order fromCurrency (${order.fromCurrency})` 
        });
      }
      accountIdToUse = Number(accountId);
    }

    const receiptAmount = amount !== undefined ? parseFloat(amount) : existingReceipt.amount;

    // Update receipt
    db.prepare(
      `UPDATE order_receipts 
       SET imagePath = @imagePath, amount = @amount, accountId = @accountId
       WHERE id = @id;`
    ).run({
      id: receiptId,
      imagePath,
      amount: receiptAmount,
      accountId: accountIdToUse,
    });

    const updatedReceipt = db
      .prepare(
        `SELECT r.*, a.name as accountName 
         FROM order_receipts r
         LEFT JOIN accounts a ON a.id = r.accountId
         WHERE r.id = ?;`
      )
      .get(receiptId);
    
    const receiptWithUrl = {
      ...updatedReceipt,
      imagePath: updatedReceipt.imagePath.startsWith('data:') ? updatedReceipt.imagePath : getFileUrl(updatedReceipt.imagePath),
    };

    res.json(receiptWithUrl);
  } catch (error) {
    console.error("Error updating receipt:", error);
    next(error);
  }
};

// Delete a draft receipt (can only delete drafts)
export const deleteReceipt = (req, res, next) => {
  try {
    const { receiptId } = req.params;

    // Check if receipt exists and is a draft
    const receipt = db.prepare("SELECT * FROM order_receipts WHERE id = ?;").get(receiptId);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }
    if (receipt.status !== 'draft') {
      return res.status(400).json({ message: "Only draft receipts can be deleted" });
    }

    // Delete file
    if (receipt.imagePath && !receipt.imagePath.startsWith('data:')) {
      deleteFile(receipt.imagePath);
    }

    // Store orderId before deletion
    const orderId = receipt.orderId;

    // Delete receipt
    db.prepare("DELETE FROM order_receipts WHERE id = ?;").run(receiptId);

    res.json({ success: true, orderId });
  } catch (error) {
    console.error("Error deleting receipt:", error);
    next(error);
  }
};

// Confirm a draft receipt (updates account balance)
export const confirmReceipt = (req, res, next) => {
  try {
    const { receiptId } = req.params;

    // Check if receipt exists and is a draft
    const receipt = db.prepare("SELECT * FROM order_receipts WHERE id = ?;").get(receiptId);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }
    if (receipt.status !== 'draft') {
      return res.status(400).json({ message: "Only draft receipts can be confirmed" });
    }

    if (!receipt.accountId) {
      return res.status(400).json({ message: "Receipt must have an account before confirmation" });
    }

    // Update receipt status to confirmed
    db.prepare("UPDATE order_receipts SET status = 'confirmed' WHERE id = ?;").run(receiptId);

    // Update account balance
    const receiptAccount = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(receipt.accountId);
    if (receiptAccount) {
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(
        receipt.amount,
        receipt.accountId
      );
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(
        receipt.accountId,
        receipt.amount,
        `Order #${receipt.orderId} - Receipt from customer`,
        new Date().toISOString()
      );
    }

    // Get updated receipt
    const confirmedReceipt = db
      .prepare(
        `SELECT r.*, a.name as accountName 
         FROM order_receipts r
         LEFT JOIN accounts a ON a.id = r.accountId
         WHERE r.id = ?;`
      )
      .get(receiptId);
    
    const receiptWithUrl = {
      ...confirmedReceipt,
      imagePath: confirmedReceipt.imagePath.startsWith('data:') ? confirmedReceipt.imagePath : getFileUrl(confirmedReceipt.imagePath),
    };

    // Check if order should be updated based on confirmed receipts
    const order = db.prepare("SELECT id, fromCurrency, toCurrency, amountBuy, paymentFlow, isFlexOrder, actualAmountBuy, rate, actualRate, status FROM orders WHERE id = ?;").get(receipt.orderId);
    if (order) {
      const confirmedReceipts = db.prepare("SELECT * FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").all(receipt.orderId);
      const totalAmount = confirmedReceipts.reduce((sum, r) => sum + r.amount, 0);
      
      const isFlexOrder = order.isFlexOrder === 1;
      const paymentFlow = order.paymentFlow || "receive_first";
      const currentOrderStatus = order.status;
      const isUnderProcess = currentOrderStatus === "under_process";
      
      // For flex orders and regular orders in "under_process" status, update actualAmountBuy/actualAmountSell
      // Both follow the same flow - don't auto-advance status, let user proceed manually
      if (isFlexOrder || isUnderProcess) {
        const effectiveRate = order.actualRate || order.rate;
        const calculatedAmountSell = calculateAmountSell(totalAmount, effectiveRate, order.fromCurrency, order.toCurrency);
        db.prepare(
          `UPDATE orders 
           SET actualAmountBuy = @actualAmountBuy,
               actualAmountSell = @actualAmountSell,
               actualRate = @actualRate
           WHERE id = @id;`
        ).run({
          id: Number(receipt.orderId),
          actualAmountBuy: totalAmount,
          actualAmountSell: calculatedAmountSell,
          actualRate: effectiveRate,
        });
      }
      
      // CRITICAL: Never change status for orders in "under_process" - they behave exactly like flex orders
      // For orders in "under_process" status, don't auto-advance status - let user proceed manually
      // Status should only change when manually completing the order
    }

    res.json(receiptWithUrl);
  } catch (error) {
    console.error("Error confirming receipt:", error);
    next(error);
  }
};

// Update a draft payment (can only update drafts)
export const updatePayment = (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { amount, accountId } = req.body;
    const file = req.file;

    // Check if payment exists and is a draft
    const existingPayment = db.prepare("SELECT * FROM order_payments WHERE id = ?;").get(paymentId);
    if (!existingPayment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (existingPayment.status !== 'draft') {
      return res.status(400).json({ message: "Only draft payments can be updated" });
    }

    // Get order details
    const order = db.prepare("SELECT id, toCurrency FROM orders WHERE id = ?;").get(existingPayment.orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    let imagePath = existingPayment.imagePath;
    
    // Update file if provided
    if (file) {
      // Delete old file
      if (imagePath && !imagePath.startsWith('data:')) {
        deleteFile(imagePath);
      }
      const filename = generateOrderPaymentFilename(order.id, file.mimetype, file.originalname);
      imagePath = saveFile(file.buffer, filename, "order");
    }

    // Validate account if provided
    let accountIdToUse = existingPayment.accountId;
    if (accountId !== undefined && accountId !== null && accountId !== "") {
      const paymentAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?;").get(Number(accountId));
      if (!paymentAccount) {
        return res.status(400).json({ message: "Payment account not found" });
      }
      if (paymentAccount.currencyCode !== order.toCurrency) {
        return res.status(400).json({ 
          message: `Payment account currency (${paymentAccount.currencyCode}) does not match order toCurrency (${order.toCurrency})` 
        });
      }
      accountIdToUse = Number(accountId);
    }

    const paymentAmount = amount !== undefined ? parseFloat(amount) : existingPayment.amount;

    // Update payment
    db.prepare(
      `UPDATE order_payments 
       SET imagePath = @imagePath, amount = @amount, accountId = @accountId
       WHERE id = @id;`
    ).run({
      id: paymentId,
      imagePath,
      amount: paymentAmount,
      accountId: accountIdToUse,
    });

    const updatedPayment = db
      .prepare(
        `SELECT p.*, a.name as accountName 
         FROM order_payments p
         LEFT JOIN accounts a ON a.id = p.accountId
         WHERE p.id = ?;`
      )
      .get(paymentId);
    
    const paymentWithUrl = {
      ...updatedPayment,
      imagePath: updatedPayment.imagePath.startsWith('data:') ? updatedPayment.imagePath : getFileUrl(updatedPayment.imagePath),
    };

    res.json(paymentWithUrl);
  } catch (error) {
    console.error("Error updating payment:", error);
    next(error);
  }
};

// Delete a draft payment (can only delete drafts)
export const deletePayment = (req, res, next) => {
  try {
    const { paymentId } = req.params;

    // Check if payment exists and is a draft
    const payment = db.prepare("SELECT * FROM order_payments WHERE id = ?;").get(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (payment.status !== 'draft') {
      return res.status(400).json({ message: "Only draft payments can be deleted" });
    }

    // Delete file
    if (payment.imagePath && !payment.imagePath.startsWith('data:')) {
      deleteFile(payment.imagePath);
    }

    // Store orderId before deletion
    const orderId = payment.orderId;

    // Delete payment
    db.prepare("DELETE FROM order_payments WHERE id = ?;").run(paymentId);

    res.json({ success: true, orderId });
  } catch (error) {
    console.error("Error deleting payment:", error);
    next(error);
  }
};

// Confirm a draft payment (updates account balance)
export const confirmPayment = (req, res, next) => {
  try {
    const { paymentId } = req.params;

    // Check if payment exists and is a draft
    const payment = db.prepare("SELECT * FROM order_payments WHERE id = ?;").get(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (payment.status !== 'draft') {
      return res.status(400).json({ message: "Only draft payments can be confirmed" });
    }

    if (!payment.accountId) {
      return res.status(400).json({ message: "Payment must have an account before confirmation" });
    }

    // Update payment status to confirmed
    db.prepare("UPDATE order_payments SET status = 'confirmed' WHERE id = ?;").run(paymentId);

    // Update account balance
    const accountForBalance = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(payment.accountId);
    if (accountForBalance) {
      const oldBalance = accountForBalance.balance;
      const newBalance = oldBalance - payment.amount;
      
      db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, payment.accountId);
      
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        payment.accountId,
        payment.amount,
        `Order #${payment.orderId} - Payment to customer`,
        new Date().toISOString()
      );
    }

    // Get updated payment
    const confirmedPayment = db
      .prepare(
        `SELECT p.*, a.name as accountName 
         FROM order_payments p
         LEFT JOIN accounts a ON a.id = p.accountId
         WHERE p.id = ?;`
      )
      .get(paymentId);
    
    const paymentWithUrl = {
      ...confirmedPayment,
      imagePath: confirmedPayment.imagePath.startsWith('data:') ? confirmedPayment.imagePath : getFileUrl(confirmedPayment.imagePath),
    };

    // Check if order should be updated based on confirmed payments
    const order = db.prepare("SELECT id, toCurrency, amountSell, paymentFlow, isFlexOrder, actualAmountBuy, actualAmountSell, rate, actualRate, status FROM orders WHERE id = ?;").get(payment.orderId);
    if (order) {
      const confirmedPayments = db.prepare("SELECT * FROM order_payments WHERE orderId = ? AND status = 'confirmed';").all(payment.orderId);
      const totalAmount = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);
      
      const isFlexOrder = order.isFlexOrder === 1;
      const paymentFlow = order.paymentFlow || "receive_first";
      
      let expectedAmount = order.amountSell;
      if (isFlexOrder) {
        const orderWithActual = db.prepare("SELECT actualAmountBuy, actualAmountSell, actualRate, rate FROM orders WHERE id = ?;").get(payment.orderId);
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
        const orderWithActual = db.prepare("SELECT actualRate, rate, actualAmountBuy FROM orders WHERE id = ?;").get(payment.orderId);
        const effectiveRate = orderWithActual?.actualRate || orderWithActual?.rate || order.rate;
        
        const confirmedReceipts = db.prepare("SELECT * FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").all(payment.orderId);
        const totalReceiptAmount = confirmedReceipts.reduce((sum, r) => sum + r.amount, 0);
        
        const additionalReceiptsNeeded = calculateAmountBuy(excessAmount, effectiveRate, order.fromCurrency || '', order.toCurrency);
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
          id: Number(payment.orderId),
          actualAmountSell: totalAmount,
          actualAmountBuy: newActualAmountBuy,
          actualRate: effectiveRate,
        });
      }
      
      // For regular orders in "under_process" status, don't auto-advance status - let user proceed manually
      // For orders in "under_process" status, don't auto-advance status - let user proceed manually
      // Status should only change when manually completing the order
    }

    res.json(paymentWithUrl);
  } catch (error) {
    console.error("Error confirming payment:", error);
    next(error);
  }
};


