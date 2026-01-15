import { db } from "../db.js";
import {
  saveFile,
  deleteFile,
  generateOrderReceiptFilename,
  generateOrderPaymentFilename,
  base64ToBuffer,
  getFileUrl,
} from "../utils/fileStorage.js";
import { getUserIdFromHeader } from "../utils/auth.js";
import { createNotification } from "../services/notification/notificationService.js";
import { getUserPermissions, isAdmin, canModifyOrder } from "../utils/orderPermissions.js";

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
    orderType,
    tagId,
    tagIds,
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
  if (orderType) {
    conditions.push('o.orderType = @orderType');
    params.orderType = orderType;
  }
  const parsedTagIds = [];
  if (tagIds) {
    const parts = String(tagIds).split(',').map((v) => parseInt(v, 10)).filter((v) => !isNaN(v));
    parsedTagIds.push(...parts);
  } else if (tagId) {
    const single = parseInt(tagId, 10);
    if (!isNaN(single)) parsedTagIds.push(single);
  }
  if (parsedTagIds.length > 0) {
    const placeholders = parsedTagIds.map((_, i) => `@tagId${i}`).join(',');
    conditions.push(`EXISTS (
      SELECT 1 FROM order_tag_assignments ota 
      WHERE ota.orderId = o.id AND ota.tagId IN (${placeholders})
    )`);
    parsedTagIds.forEach((id, i) => {
      params[`tagId${i}`] = id;
    });
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

      // Get tags for this order
      const tags = db
        .prepare(
          `SELECT t.id, t.name, t.color 
           FROM tags t
           INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
           WHERE ota.orderId = ?
           ORDER BY t.name ASC;`
        )
        .all(order.id);

      // Get profit for this order (confirmed first, then draft, then fall back to order table)
      const confirmedProfit = db
        .prepare(
          `SELECT amount, currencyCode as profitCurrency, accountId as profitAccountId
           FROM order_profits
           WHERE orderId = ? AND status = 'confirmed'
           ORDER BY createdAt DESC
           LIMIT 1;`
        )
        .get(order.id);

      // Get draft profit if no confirmed profit exists (for pending OTC orders)
      const draftProfit = confirmedProfit ? null : db
        .prepare(
          `SELECT amount, currencyCode as profitCurrency, accountId as profitAccountId
           FROM order_profits
           WHERE orderId = ? AND status = 'draft'
           ORDER BY createdAt DESC
           LIMIT 1;`
        )
        .get(order.id);

      // Get service charge for this order (confirmed first, then draft, then fall back to order table)
      const confirmedServiceCharge = db
        .prepare(
          `SELECT amount, currencyCode as serviceChargeCurrency, accountId as serviceChargeAccountId
           FROM order_service_charges
           WHERE orderId = ? AND status = 'confirmed'
           ORDER BY createdAt DESC
           LIMIT 1;`
        )
        .get(order.id);

      // Get draft service charge if no confirmed service charge exists (for pending OTC orders)
      const draftServiceCharge = confirmedServiceCharge ? null : db
        .prepare(
          `SELECT amount, currencyCode as serviceChargeCurrency, accountId as serviceChargeAccountId
           FROM order_service_charges
           WHERE orderId = ? AND status = 'draft'
           ORDER BY createdAt DESC
           LIMIT 1;`
        )
        .get(order.id);

      // Use confirmed profit/service charge if available, then draft, then fall back to order table fields
      // Ensure amounts are numbers
      const profitEntry = confirmedProfit || draftProfit;
      const profitAmount = profitEntry ? Number(profitEntry.amount) : (order.profitAmount !== null && order.profitAmount !== undefined ? Number(order.profitAmount) : null);
      const profitCurrency = profitEntry ? profitEntry.profitCurrency : (order.profitCurrency ?? null);
      const profitAccountId = profitEntry ? profitEntry.profitAccountId : (order.profitAccountId ?? null);
      
      const serviceChargeEntry = confirmedServiceCharge || draftServiceCharge;
      const serviceChargeAmount = serviceChargeEntry ? Number(serviceChargeEntry.amount) : (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined ? Number(order.serviceChargeAmount) : null);
      const serviceChargeCurrency = serviceChargeEntry ? serviceChargeEntry.serviceChargeCurrency : (order.serviceChargeCurrency ?? null);
      const serviceChargeAccountId = serviceChargeEntry ? serviceChargeEntry.serviceChargeAccountId : (order.serviceChargeAccountId ?? null);

      return {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        hasBeneficiaries,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: buyAccounts.length > 0 ? buyAccounts : null,
        sellAccounts: sellAccounts.length > 0 ? sellAccounts : null,
        tags: tags.length > 0 ? tags : [],
        profitAmount,
        profitCurrency,
        profitAccountId,
        serviceChargeAmount,
        serviceChargeCurrency,
        serviceChargeAccountId,
      };
    } catch (e) {
      // Get tags for this order even in error case
      const tags = db
        .prepare(
          `SELECT t.id, t.name, t.color 
           FROM tags t
           INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
           WHERE ota.orderId = ?
           ORDER BY t.name ASC;`
        )
        .all(order.id);

      // Get confirmed profit/service charge even in error case
      const confirmedProfit = db
        .prepare(
          `SELECT amount, currencyCode as profitCurrency, accountId as profitAccountId
           FROM order_profits
           WHERE orderId = ? AND status = 'confirmed'
           ORDER BY createdAt DESC
           LIMIT 1;`
        )
        .get(order.id);

      const confirmedServiceCharge = db
        .prepare(
          `SELECT amount, currencyCode as serviceChargeCurrency, accountId as serviceChargeAccountId
           FROM order_service_charges
           WHERE orderId = ? AND status = 'confirmed'
           ORDER BY createdAt DESC
           LIMIT 1;`
        )
        .get(order.id);

      // Ensure amounts are numbers
      const profitAmount = confirmedProfit ? Number(confirmedProfit.amount) : (order.profitAmount !== null && order.profitAmount !== undefined ? Number(order.profitAmount) : null);
      const profitCurrency = confirmedProfit ? confirmedProfit.profitCurrency : (order.profitCurrency ?? null);
      const profitAccountId = confirmedProfit ? confirmedProfit.profitAccountId : (order.profitAccountId ?? null);
      
      const serviceChargeAmount = confirmedServiceCharge ? Number(confirmedServiceCharge.amount) : (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined ? Number(order.serviceChargeAmount) : null);
      const serviceChargeCurrency = confirmedServiceCharge ? confirmedServiceCharge.serviceChargeCurrency : (order.serviceChargeCurrency ?? null);
      const serviceChargeAccountId = confirmedServiceCharge ? confirmedServiceCharge.serviceChargeAccountId : (order.serviceChargeAccountId ?? null);

      return {
        ...order,
        walletAddresses: null,
        bankDetails: null,
        hasBeneficiaries: false,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: null,
        sellAccounts: null,
        tags: tags.length > 0 ? tags : [],
        profitAmount,
        profitCurrency,
        profitAccountId,
        serviceChargeAmount,
        serviceChargeCurrency,
        serviceChargeAccountId,
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
    orderType,
    tagId,
    tagIds,
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
  if (orderType) {
    conditions.push('o.orderType = @orderType');
    params.orderType = orderType;
  }
  const parsedTagIds = [];
  if (tagIds) {
    const parts = String(tagIds).split(',').map((v) => parseInt(v, 10)).filter((v) => !isNaN(v));
    parsedTagIds.push(...parts);
  } else if (tagId) {
    const single = parseInt(tagId, 10);
    if (!isNaN(single)) parsedTagIds.push(single);
  }
  if (parsedTagIds.length > 0) {
    const placeholders = parsedTagIds.map((_, i) => `@tagId${i}`).join(',');
    conditions.push(`EXISTS (
      SELECT 1 FROM order_tag_assignments ota 
      WHERE ota.orderId = o.id AND ota.tagId IN (${placeholders})
    )`);
    parsedTagIds.forEach((id, i) => {
      params[`tagId${i}`] = id;
    });
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

      // Get tags for this order
      const tags = db
        .prepare(
          `SELECT t.id, t.name, t.color 
           FROM tags t
           INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
           WHERE ota.orderId = ?
           ORDER BY t.name ASC;`
        )
        .all(order.id);

      return {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        hasBeneficiaries,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: buyAccounts.length > 0 ? buyAccounts : null,
        sellAccounts: sellAccounts.length > 0 ? sellAccounts : null,
        tags: tags.length > 0 ? tags : [],
      };
    } catch (e) {
      // Get tags for this order even in error case
      const tags = db
        .prepare(
          `SELECT t.id, t.name, t.color 
           FROM tags t
           INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
           WHERE ota.orderId = ?
           ORDER BY t.name ASC;`
        )
        .all(order.id);

      return {
        ...order,
        walletAddresses: null,
        bankDetails: null,
        hasBeneficiaries: false,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        buyAccounts: null,
        sellAccounts: null,
        tags: tags.length > 0 ? tags : [],
      };
    }
  });
  
  res.json(orders);
};

export const createOrder = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const { tagIds, ...orderData } = payload;
    const userId = getUserIdFromHeader(req);
    
    if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
    }

    // Validate handler (required for imported orders)
    if (orderData.handlerId === undefined || orderData.handlerId === null) {
      return res.status(400).json({ message: "Handler is required" });
    }
    const handler = db.prepare("SELECT id, name FROM users WHERE id = ?").get(orderData.handlerId);
    if (!handler) {
      return res.status(400).json({ message: "Handler not found" });
    }

    // Validate buy/sell accounts only if provided (allow creating pending orders without accounts)
    let buyAccount = null;
    let sellAccount = null;
    if (orderData.buyAccountId !== undefined && orderData.buyAccountId !== null) {
      buyAccount = db.prepare("SELECT id, name, currencyCode FROM accounts WHERE id = ?").get(orderData.buyAccountId);
      if (!buyAccount) {
        return res.status(400).json({ message: "Buy account not found" });
      }
      if ((buyAccount.currencyCode || "").toUpperCase() !== (orderData.fromCurrency || "").toUpperCase()) {
        return res.status(400).json({ message: "Buy account currency does not match fromCurrency" });
      }
    }
    if (orderData.sellAccountId !== undefined && orderData.sellAccountId !== null) {
      sellAccount = db.prepare("SELECT id, name, currencyCode FROM accounts WHERE id = ?").get(orderData.sellAccountId);
      if (!sellAccount) {
        return res.status(400).json({ message: "Sell account not found" });
      }
      if ((sellAccount.currencyCode || "").toUpperCase() !== (orderData.toCurrency || "").toUpperCase()) {
        return res.status(400).json({ message: "Sell account currency does not match toCurrency" });
      }
    }
    // Validate profit account/currency if provided
    if (orderData.profitAmount !== undefined && orderData.profitAmount !== null) {
      if (!orderData.profitAccountId || !orderData.profitCurrency) {
        return res.status(400).json({ message: "Profit amount requires profit account and profit currency" });
      }
      const profitAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?").get(orderData.profitAccountId);
      if (!profitAccount) {
        return res.status(400).json({ message: "Profit account not found" });
      }
      if ((profitAccount.currencyCode || "").toUpperCase() !== String(orderData.profitCurrency || "").toUpperCase()) {
        return res.status(400).json({ message: "Profit account currency does not match profit currency" });
      }
    }

    // Validate service charge account/currency if provided
    if (orderData.serviceChargeAmount !== undefined && orderData.serviceChargeAmount !== null) {
      if (!orderData.serviceChargeAccountId || !orderData.serviceChargeCurrency) {
        return res.status(400).json({ message: "Service charge amount requires service charge account and currency" });
      }
      const scAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?").get(orderData.serviceChargeAccountId);
      if (!scAccount) {
        return res.status(400).json({ message: "Service charge account not found" });
      }
      if ((scAccount.currencyCode || "").toUpperCase() !== String(orderData.serviceChargeCurrency || "").toUpperCase()) {
        return res.status(400).json({ message: "Service charge account currency does not match service charge currency" });
      }
    }

    if (sellAccount && (sellAccount.currencyCode || "").toUpperCase() !== (orderData.toCurrency || "").toUpperCase()) {
      return res.status(400).json({ message: "Sell account currency does not match toCurrency" });
    }
    
    const stmt = db.prepare(
      `INSERT INTO orders (
         customerId,
         fromCurrency,
         toCurrency,
         amountBuy,
         amountSell,
         rate,
         status,
         handlerId,
         buyAccountId,
         sellAccountId,
         isFlexOrder,
         orderType,
         profitAmount,
         profitCurrency,
         profitAccountId,
         serviceChargeAmount,
         serviceChargeCurrency,
         serviceChargeAccountId,
         createdBy,
         createdAt
       ) VALUES (
         @customerId,
         @fromCurrency,
         @toCurrency,
         @amountBuy,
         @amountSell,
         @rate,
         @status,
         @handlerId,
         @buyAccountId,
         @sellAccountId,
         @isFlexOrder,
         @orderType,
         @profitAmount,
         @profitCurrency,
         @profitAccountId,
         @serviceChargeAmount,
         @serviceChargeCurrency,
         @serviceChargeAccountId,
         @createdBy,
         @createdAt
       );`,
    );
    const result = stmt.run({
      ...orderData,
      status: orderData.status || "pending",
      handlerId: orderData.handlerId ?? null,
      buyAccountId: orderData.buyAccountId ?? null,
      sellAccountId: orderData.sellAccountId ?? null,
      isFlexOrder: orderData.isFlexOrder ? 1 : 0,
      orderType: orderData.orderType || "online",
      profitAmount: orderData.profitAmount ?? null,
      profitCurrency: orderData.profitCurrency ?? null,
      profitAccountId: orderData.profitAccountId ?? null,
      serviceChargeAmount: orderData.serviceChargeAmount ?? null,
      serviceChargeCurrency: orderData.serviceChargeCurrency ?? null,
      serviceChargeAccountId: orderData.serviceChargeAccountId ?? null,
      createdBy: userId, // userId is already validated above
      createdAt: new Date().toISOString(),
    });
    
    const orderId = result.lastInsertRowid;
    
    // For OTC orders, create profit/service charge entries in separate tables if provided
    // Only create confirmed entries if order is completed (imported), otherwise create drafts
    // This matches the pattern of receipts/payments - drafts until order is completed
    if (orderData.orderType === "otc") {
      // Check if this is an imported order (status is "completed" from the start)
      const isImported = (orderData.status || "pending") === "completed";
      const importedSuffix = isImported ? " (Imported)" : "";
      const profitServiceChargeStatus = isImported ? "confirmed" : "draft";
      
      // Create profit entry if provided (draft for pending, confirmed for completed)
      if (orderData.profitAmount !== null && orderData.profitAmount !== undefined && 
          orderData.profitCurrency && orderData.profitAccountId) {
        const profitAmount = Number(orderData.profitAmount);
        if (!isNaN(profitAmount) && profitAmount > 0) {
          db.prepare(
            `INSERT INTO order_profits (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, ?, ?);`
          ).run(orderId, profitAmount, orderData.profitCurrency, orderData.profitAccountId, profitServiceChargeStatus, new Date().toISOString());
          
          // Only update account balance and create transaction if confirmed (completed order)
          if (isImported) {
            const profitAccount = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(orderData.profitAccountId);
            if (profitAccount) {
              const newBalance = profitAccount.balance + profitAmount;
              db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, orderData.profitAccountId);
              db.prepare(
                `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
                 VALUES (?, 'add', ?, ?, ?);`
              ).run(
                orderData.profitAccountId,
                profitAmount,
                `Order #${orderId} - Profit${importedSuffix}`,
                new Date().toISOString()
              );
            }
          }
        }
      }
      
      // Create service charge entry if provided (draft for pending, confirmed for completed)
      if (orderData.serviceChargeAmount !== null && orderData.serviceChargeAmount !== undefined && 
          orderData.serviceChargeCurrency && orderData.serviceChargeAccountId) {
        const serviceChargeAmount = Number(orderData.serviceChargeAmount);
        if (!isNaN(serviceChargeAmount) && serviceChargeAmount !== 0) {
          db.prepare(
            `INSERT INTO order_service_charges (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, ?, ?);`
          ).run(orderId, serviceChargeAmount, orderData.serviceChargeCurrency, orderData.serviceChargeAccountId, profitServiceChargeStatus, new Date().toISOString());
          
          // Only update account balance and create transaction if confirmed (completed order)
          if (isImported) {
            const scAccount = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(orderData.serviceChargeAccountId);
            if (scAccount) {
              const oldBalance = scAccount.balance;
              if (serviceChargeAmount > 0) {
                // Positive service charge: add to account
                const newBalance = oldBalance + serviceChargeAmount;
                db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, orderData.serviceChargeAccountId);
                db.prepare(
                  `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
                   VALUES (?, 'add', ?, ?, ?);`
                ).run(
                  orderData.serviceChargeAccountId,
                  serviceChargeAmount,
                  `Order #${orderId} - Service charge${importedSuffix}`,
                  new Date().toISOString()
                );
              } else {
                // Negative service charge: subtract from account
                const absAmount = Math.abs(serviceChargeAmount);
                const newBalance = oldBalance - absAmount;
                db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, orderData.serviceChargeAccountId);
                db.prepare(
                  `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
                   VALUES (?, 'withdraw', ?, ?, ?);`
                ).run(
                  orderData.serviceChargeAccountId,
                  absAmount,
                  `Order #${orderId} - Service charge paid by us${importedSuffix}`,
                  new Date().toISOString()
                );
              }
            }
          }
        }
      }
    }
    
    // Handle tag assignments if provided
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const tagAssignmentStmt = db.prepare(
        `INSERT INTO order_tag_assignments (orderId, tagId) VALUES (?, ?);`
      );
      const insertTagAssignments = db.transaction((tags) => {
        for (const tagId of tags) {
          if (typeof tagId === 'number' && tagId > 0) {
            try {
              tagAssignmentStmt.run(orderId, tagId);
            } catch (err) {
              // Ignore duplicate or invalid tag assignments
            }
          }
        }
      });
      insertTagAssignments(tagIds);
    }
    
    const row = db
      .prepare(
        `SELECT o.*, 
                c.name as customerName, 
                u.name as handlerName,
                buyAcc.name as buyAccountName,
                sellAcc.name as sellAccountName
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         LEFT JOIN users u ON u.id = o.handlerId
         LEFT JOIN accounts buyAcc ON buyAcc.id = o.buyAccountId
         LEFT JOIN accounts sellAcc ON sellAcc.id = o.sellAccountId
         WHERE o.id = ?;`,
      )
      .get(orderId);
    
    // Get tags for the order
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
         WHERE ota.orderId = ?
         ORDER BY t.name ASC;`
      )
      .all(orderId);
    
    // If order is created with status "completed" and has accounts, update account balances
    // This handles imported orders that are already completed
    // Query the actual order from database to get the real status and account IDs
    const actualOrder = db.prepare("SELECT status, buyAccountId, sellAccountId FROM orders WHERE id = ?;").get(orderId);
    const finalStatus = actualOrder?.status || orderData.status || "pending";
    const actualBuyAccountId = actualOrder?.buyAccountId || orderData.buyAccountId;
    const actualSellAccountId = actualOrder?.sellAccountId || orderData.sellAccountId;
    
    console.log(`[createOrder] Order ${orderId} created - Status: ${finalStatus}, buyAccountId: ${actualBuyAccountId}, sellAccountId: ${actualSellAccountId}`);
    
    if (finalStatus === "completed") {
      // Update account balances for buy/sell accounts
      if (actualBuyAccountId || actualSellAccountId) {
        try {
          console.log(`[createOrder] Calling updateAccountBalancesOnCompletion for order ${orderId} (imported)`);
          updateAccountBalancesOnCompletion(orderId, true);
          console.log(`[createOrder] Successfully updated account balances for order ${orderId}`);
        } catch (error) {
          console.error(`[createOrder] Error updating account balances for order ${orderId}:`, error);
          // Don't fail the order creation, but log the error
        }
      } else {
        console.log(`[createOrder] Order ${orderId} is completed but has no accounts set, skipping balance update`);
      }
      
      // Handle profit account balance if provided
      // Skip for OTC orders since they're already handled in the OTC block above
      if (orderData.orderType !== "otc" && orderData.profitAmount !== null && orderData.profitAmount !== undefined && orderData.profitAccountId) {
        const profitAmount = Number(orderData.profitAmount);
        if (!isNaN(profitAmount) && profitAmount > 0) {
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(profitAmount, orderData.profitAccountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            orderData.profitAccountId,
            profitAmount,
            `Order #${orderId} - Profit (Imported)`,
            new Date().toISOString()
          );
        }
      }
      
      // Handle service charge account balance if provided
      // Skip for OTC orders since they're already handled in the OTC block above
      if (orderData.orderType !== "otc" && orderData.serviceChargeAmount !== null && orderData.serviceChargeAmount !== undefined && orderData.serviceChargeAccountId) {
        const serviceChargeAmount = Number(orderData.serviceChargeAmount);
        if (!isNaN(serviceChargeAmount) && serviceChargeAmount !== 0) {
          if (serviceChargeAmount > 0) {
            // Positive service charge: add to account (we receive it)
            db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(serviceChargeAmount, orderData.serviceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'add', ?, ?, ?);`
            ).run(
              orderData.serviceChargeAccountId,
              serviceChargeAmount,
              `Order #${orderId} - Service charge (Imported)`,
              new Date().toISOString()
            );
          } else {
            // Negative service charge: subtract from account (we pay it)
            const absAmount = Math.abs(serviceChargeAmount);
            db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(absAmount, orderData.serviceChargeAccountId);
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'withdraw', ?, ?, ?);`
            ).run(
              orderData.serviceChargeAccountId,
              absAmount,
              `Order #${orderId} - Service charge paid by us (Imported)`,
              new Date().toISOString()
            );
          }
        }
      }
    }

    // Send notification to all users about new order
    const allUsers = db.prepare("SELECT id FROM users").all();
    const allUserIds = allUsers.map(u => u.id);
    const creatorName = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
    
    await createNotification({
      userId: allUserIds,
      type: 'order_created',
      title: 'New Order Created',
      message: `Order #${orderId} created by ${creatorName?.name || 'User'} - ${row.customerName || 'Customer'}`,
      entityType: 'order',
      entityId: orderId,
      actionUrl: `/orders`,
    });
    
    res.status(201).json({
      ...row,
      tags: tags.length > 0 ? tags : [],
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrder = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const { tagIds, ...orderUpdates } = updates;
    const userId = getUserIdFromHeader(req);
    
    // Check if order exists and get existing profit/service charge data
    const existingOrder = db.prepare("SELECT id, createdBy, handlerId, status, fromCurrency, toCurrency, profitAmount, profitAccountId, profitCurrency, serviceChargeAmount, serviceChargeAccountId, serviceChargeCurrency, buyAccountId, sellAccountId FROM orders WHERE id = ?").get(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions
    if (userId) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      // For completed orders, non-admin users must create approval request
      if (existingOrder.status === "completed" && !isUserAdmin) {
        if (!canModifyOrder(existingOrder, userId)) {
          return res.status(403).json({ 
            message: "Only the order creator, handler, or admin can edit orders" 
          });
        }
        // Creator/handler must create approval request for completed orders
        return res.status(400).json({ 
          message: "Please use the approval request system to edit completed orders",
          requiresApproval: true
        });
      }
      
      // For non-completed orders, check if user is creator/handler/admin
      if (!isUserAdmin && !canModifyOrder(existingOrder, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can edit orders" 
        });
      }
    } else {
      return res.status(401).json({ message: "User ID is required" });
    }

    // Fields that can only be updated when order is pending
    const pendingOnlyFields = ["customerId", "fromCurrency", "toCurrency", "amountBuy", "amountSell", "rate"];
    // Fields that can be updated at any time (service charges and profit)
    const alwaysUpdatableFields = [
      "serviceChargeAmount",
      "serviceChargeCurrency",
      "serviceChargeAccountId",
      "profitAmount",
      "profitCurrency",
      "profitAccountId",
      "handlerId",
      "buyAccountId",
      "sellAccountId",
      "remarks",
    ];
    
    // Separate updates into pending-only and always-updatable
    const pendingOnlyUpdates = {};
    const alwaysUpdatableUpdates = {};
    
    Object.keys(orderUpdates).forEach(key => {
      if (pendingOnlyFields.includes(key)) {
        pendingOnlyUpdates[key] = orderUpdates[key];
      } else if (alwaysUpdatableFields.includes(key)) {
        alwaysUpdatableUpdates[key] = orderUpdates[key];
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

    // Validate buy/sell account currencies when updating
    if (alwaysUpdatableUpdates.buyAccountId !== undefined && alwaysUpdatableUpdates.buyAccountId !== null) {
      const buyAcc = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?;").get(alwaysUpdatableUpdates.buyAccountId);
      if (!buyAcc) {
        return res.status(400).json({ message: "Buy account not found" });
      }
      if ((buyAcc.currencyCode || "").toUpperCase() !== (existingOrder.fromCurrency || "").toUpperCase()) {
        return res.status(400).json({ message: "Buy account currency does not match fromCurrency" });
      }
    }
    if (alwaysUpdatableUpdates.sellAccountId !== undefined && alwaysUpdatableUpdates.sellAccountId !== null) {
      const sellAcc = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?;").get(alwaysUpdatableUpdates.sellAccountId);
      if (!sellAcc) {
        return res.status(400).json({ message: "Sell account not found" });
      }
      if ((sellAcc.currencyCode || "").toUpperCase() !== (existingOrder.toCurrency || "").toUpperCase()) {
        return res.status(400).json({ message: "Sell account currency does not match toCurrency" });
      }
    }

    // Handle profit and service charge - create drafts instead of directly updating
    // Remove profit/service charge fields from alwaysUpdatableUpdates as they're handled separately
    const { profitAmount, profitCurrency, profitAccountId, serviceChargeAmount, serviceChargeCurrency, serviceChargeAccountId, ...otherUpdates } = alwaysUpdatableUpdates;
    
    let profitDraftCreated = false;
    let serviceChargeDraftCreated = false;
    let profitDraftDeleted = false;
    let serviceChargeDraftDeleted = false;
    let createdProfitId = null;
    let createdServiceChargeId = null;
    
    // If profit fields are provided, handle profit draft
    if (profitAmount !== undefined || profitAccountId !== undefined || profitCurrency !== undefined) {
      // Delete any existing draft profit for this order
      const deleteResult = db.prepare("DELETE FROM order_profits WHERE orderId = ? AND status = 'draft';").run(id);
      profitDraftDeleted = deleteResult.changes > 0;
      
      // Create new draft profit if all required fields are provided and amount is valid
      if (profitAmount !== null && profitAmount !== undefined && profitCurrency && profitAccountId) {
        const amount = Number(profitAmount);
        if (!isNaN(amount) && amount > 0) {
          const profitResult = db.prepare(
            `INSERT INTO order_profits (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, 'draft', ?);`
          ).run(id, amount, profitCurrency, profitAccountId, new Date().toISOString());
          profitDraftCreated = true;
          createdProfitId = profitResult.lastInsertRowid;
        }
      }
    }
    
    // If service charge fields are provided, handle service charge draft
    if (serviceChargeAmount !== undefined || serviceChargeAccountId !== undefined || serviceChargeCurrency !== undefined) {
      // Delete any existing draft service charge for this order
      const deleteResult = db.prepare("DELETE FROM order_service_charges WHERE orderId = ? AND status = 'draft';").run(id);
      serviceChargeDraftDeleted = deleteResult.changes > 0;
      
      // Create new draft service charge if all required fields are provided and amount is valid
      if (serviceChargeAmount !== null && serviceChargeAmount !== undefined && serviceChargeCurrency && serviceChargeAccountId) {
        const amount = Number(serviceChargeAmount);
        if (!isNaN(amount) && amount !== 0) {
          const serviceChargeResult = db.prepare(
            `INSERT INTO order_service_charges (orderId, amount, currencyCode, accountId, status, createdAt)
             VALUES (?, ?, ?, ?, 'draft', ?);`
          ).run(id, amount, serviceChargeCurrency, serviceChargeAccountId, new Date().toISOString());
          serviceChargeDraftCreated = true;
          createdServiceChargeId = serviceChargeResult.lastInsertRowid;
        }
      }
    }
    
    // Use otherUpdates instead of alwaysUpdatableUpdates
    const alwaysUpdatableUpdatesFiltered = otherUpdates;

    // Combine all updates
    const allUpdates = { ...pendingOnlyUpdates, ...alwaysUpdatableUpdatesFiltered };
    const fieldsToUpdate = Object.keys(allUpdates);
    
    // Allow updating tags even if no other fields are being updated
    // Also allow if profit or service charge drafts were created or deleted
    if (fieldsToUpdate.length === 0 && tagIds === undefined && !profitDraftCreated && !serviceChargeDraftCreated && !profitDraftDeleted && !serviceChargeDraftDeleted) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    // Handle null values properly (to clear fields)
    const updateValues = {};
    fieldsToUpdate.forEach(field => {
      const value = allUpdates[field];
      if (field === "remarks") {
        // For remarks: null/undefined removes it, empty string also removes it, otherwise save the value
        if (value === null || value === undefined || value === "" || (typeof value === "string" && value.trim() === "")) {
          updateValues[field] = null;
        } else {
          updateValues[field] = String(value);
        }
      } else if (value === null || value === "" || (typeof value === "string" && value.trim() === "")) {
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
    if (assignments) {
      db.prepare(`UPDATE orders SET ${assignments} WHERE id = @id;`).run(updateValues);
    }

    // Handle tag assignments if provided (tags can be updated even if no other fields are updated)
    if (tagIds !== undefined) {
      // Remove all existing tag assignments
      db.prepare("DELETE FROM order_tag_assignments WHERE orderId = ?;").run(id);
      
      // Add new tag assignments if provided
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        const tagAssignmentStmt = db.prepare(
          `INSERT INTO order_tag_assignments (orderId, tagId) VALUES (?, ?);`
        );
        const insertTagAssignments = db.transaction((tags) => {
          for (const tagId of tags) {
            if (typeof tagId === 'number' && tagId > 0) {
              try {
                tagAssignmentStmt.run(id, tagId);
              } catch (err) {
                // Ignore duplicate or invalid tag assignments
              }
            }
          }
        });
        insertTagAssignments(tagIds);
      }
    }

    const row = db
      .prepare(
        `SELECT o.*, c.name as customerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         WHERE o.id = ?;`,
      )
      .get(id);
    
    // Include created profit/service charge IDs in response (for OTC orders to confirm immediately)
    const responseData = { ...row };
    if (createdProfitId) {
      responseData.createdProfitId = createdProfitId;
    }
    if (createdServiceChargeId) {
      responseData.createdServiceChargeId = createdServiceChargeId;
    }
    
    // Get tags for the order
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
         WHERE ota.orderId = ?
         ORDER BY t.name ASC;`
      )
      .all(id);
    
    res.json({
      ...responseData,
      tags: tags.length > 0 ? tags : [],
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const userId = getUserIdFromHeader(req);
    
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    
    // Get the current status before updating
    const currentOrder = db
      .prepare("SELECT id, createdBy, handlerId, status, buyAccountId, sellAccountId, orderType FROM orders WHERE id = ?;")
      .get(id);
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions for status changes
    if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
    }
    
    const userPermissions = getUserPermissions(userId);
    const isUserAdmin = isAdmin(userPermissions);
    
    // For canceling orders, only creator/handler/admin can cancel
    if (status === "cancelled") {
      if (!isUserAdmin && !canModifyOrder(currentOrder, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can cancel orders" 
        });
      }
    }
    
    // For completing orders or changing from completed, check if user is creator/handler/admin
    if (status === "completed" || currentOrder.status === "completed") {
      if (!isUserAdmin && !canModifyOrder(currentOrder, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can change order status" 
        });
      }
    }
    
    // Update the status
    db.prepare(`UPDATE orders SET status = @status WHERE id = @id;`).run({ id, status });
    
    // If status is being changed to "completed" and accounts are set, update account balances
    if (status === "completed" && currentOrder.status !== "completed" && (currentOrder.buyAccountId || currentOrder.sellAccountId)) {
      // Avoid double-counting when receipts/payments were already confirmed
      const hasConfirmedReceipt = db
        .prepare("SELECT id FROM order_receipts WHERE orderId = ? AND status = 'confirmed' LIMIT 1;")
        .get(id);
      const hasConfirmedPayment = db
        .prepare("SELECT id FROM order_payments WHERE orderId = ? AND status = 'confirmed' LIMIT 1;")
        .get(id);
      const isOtcOrder = currentOrder.orderType === "otc";

      // Only run the direct balance update when there are no confirmed receipt/payment entries
      // (typical for imported orders without detailed entries) and it's not an OTC order
      if (!hasConfirmedReceipt && !hasConfirmedPayment && !isOtcOrder) {
        updateAccountBalancesOnCompletion(id, false);
      }
    }
    
    // When order is completed, confirm all draft profit and service charge entries
    if (status === "completed" && currentOrder.status !== "completed") {
      // Confirm all draft profit entries
      const draftProfits = db.prepare("SELECT * FROM order_profits WHERE orderId = ? AND status = 'draft';").all(id);
      for (const profit of draftProfits) {
        if (profit.accountId) {
          // Update profit status to confirmed
          db.prepare("UPDATE order_profits SET status = 'confirmed' WHERE id = ?;").run(profit.id);
          
          // Update account balance
          const accountForBalance = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(profit.accountId);
          if (accountForBalance) {
            const newBalance = accountForBalance.balance + profit.amount;
            db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, profit.accountId);
            
            // Create account transaction
            db.prepare(
              `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
               VALUES (?, 'add', ?, ?, ?);`
            ).run(
              profit.accountId,
              profit.amount,
              `Order #${id} - Profit`,
              new Date().toISOString()
            );
          }
        }
      }
      
      // Confirm all draft service charge entries
      const draftServiceCharges = db.prepare("SELECT * FROM order_service_charges WHERE orderId = ? AND status = 'draft';").all(id);
      for (const serviceCharge of draftServiceCharges) {
        if (serviceCharge.accountId) {
          // Update service charge status to confirmed
          db.prepare("UPDATE order_service_charges SET status = 'confirmed' WHERE id = ?;").run(serviceCharge.id);
          
          // Update account balance
          const accountForBalance = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(serviceCharge.accountId);
          if (accountForBalance) {
            const oldBalance = accountForBalance.balance;
            const amount = Number(serviceCharge.amount);
            
            if (amount > 0) {
              // Positive service charge: add to account (we receive it)
              const newBalance = oldBalance + amount;
              db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, serviceCharge.accountId);
              
              // Create account transaction
              db.prepare(
                `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
                 VALUES (?, 'add', ?, ?, ?);`
              ).run(
                serviceCharge.accountId,
                amount,
                `Order #${id} - Service charge`,
                new Date().toISOString()
              );
            } else if (amount < 0) {
              // Negative service charge: subtract from account (we pay it)
              const absAmount = Math.abs(amount);
              const newBalance = oldBalance - absAmount;
              db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, serviceCharge.accountId);
              
              // Create account transaction
              db.prepare(
                `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
                 VALUES (?, 'withdraw', ?, ?, ?);`
              ).run(
                serviceCharge.accountId,
                absAmount,
                `Order #${id} - Service charge paid by us`,
                new Date().toISOString()
              );
            }
          }
        }
      }
    }
    
    const row = db
      .prepare(
        `SELECT o.*, c.name as customerName FROM orders o
         LEFT JOIN customers c ON c.id = o.customerId
         WHERE o.id = ?;`,
      )
      .get(id);
    
    // Get tags for the order
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
         WHERE ota.orderId = ?
         ORDER BY t.name ASC;`
      )
      .all(id);

    // Send notification if order was completed or cancelled
    if (status === 'completed' && currentOrder.status !== 'completed') {
      const allUsers = db.prepare("SELECT id FROM users").all();
      const allUserIds = allUsers.map(u => u.id);
      const userName = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      
      await createNotification({
        userId: allUserIds,
        type: 'order_completed',
        title: 'Order Completed',
        message: `Order #${id} - ${row.customerName || 'Customer'} has been completed by ${userName?.name || 'User'}`,
        entityType: 'order',
        entityId: id,
        actionUrl: `/orders`,
      });
    } else if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
      const allUsers = db.prepare("SELECT id FROM users").all();
      const allUserIds = allUsers.map(u => u.id);
      const userName = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      
      await createNotification({
        userId: allUserIds,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Order #${id} - ${row.customerName || 'Customer'} has been cancelled by ${userName?.name || 'User'}`,
        entityType: 'order',
        entityId: id,
        actionUrl: `/orders`,
      });
    }
    
    res.json({
      ...row,
      tags: tags.length > 0 ? tags : [],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserIdFromHeader(req);
    
    // Check if order exists and get profit/service charge data, and account info
    const order = db.prepare("SELECT id, createdBy, handlerId, profitAmount, profitAccountId, serviceChargeAmount, serviceChargeAccountId, buyAccountId, sellAccountId, amountBuy, amountSell, status FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions: Admin can delete directly, creator/handler must request approval
    if (userId) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      if (!isUserAdmin) {
        // Non-admin users must be creator or handler to request deletion
        if (!canModifyOrder(order, userId)) {
          return res.status(403).json({ 
            message: "Only the order creator, handler, or admin can delete orders" 
          });
        }
        // Creator/handler must create approval request instead of direct delete
        return res.status(400).json({ 
          message: "Please use the approval request system to delete this order",
          requiresApproval: true
        });
      }
      // Admin can delete directly (continue with deletion)
    } else {
      return res.status(401).json({ message: "User ID is required" });
    }
    
    // Get all confirmed receipts with accountId and amount for reversing balances (only reverse confirmed ones)
    const receipts = db.prepare("SELECT accountId, amount, imagePath, status FROM order_receipts WHERE orderId = ? AND status = 'confirmed';").all(id);
    // Get all confirmed payments with accountId and amount for reversing balances (only reverse confirmed ones)
    const payments = db.prepare("SELECT accountId, amount, imagePath, status FROM order_payments WHERE orderId = ? AND status = 'confirmed';").all(id);
    // Get confirmed profits/service charges (regular orders keep them in child tables)
    const confirmedProfits = db.prepare("SELECT accountId, amount FROM order_profits WHERE orderId = ? AND status = 'confirmed';").all(id);
    const confirmedServiceCharges = db.prepare("SELECT accountId, amount FROM order_service_charges WHERE orderId = ? AND status = 'confirmed';").all(id);
    
    // For imported/completed orders, also check for direct account transactions
    // These are created when orders are imported or completed without receipts/payments
    const isCompleted = order.status === 'completed';
    const hasDirectTransactions = isCompleted && (order.buyAccountId || order.sellAccountId);
    
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
    
    // For imported/completed orders with direct transactions (no receipts/payments)
    // Reverse transactions created by updateAccountBalancesOnCompletion
    if (hasDirectTransactions) {
      // Reverse buy account transaction (receipt was added, so subtract)
      if (order.buyAccountId && order.amountBuy) {
        const buyAccountId = order.buyAccountId;
        const amountBuy = Number(order.amountBuy);
        
        // Check if there's already a reversal from receipts (avoid double reversal)
        const hasReceiptReversal = receipts.some(r => r.accountId === buyAccountId);
        
        if (!hasReceiptReversal && !isNaN(amountBuy) && amountBuy > 0) {
          // Subtract the amount from account balance (reverse the receipt)
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(amountBuy, buyAccountId);
          
          // Create reverse transaction in transaction history
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            buyAccountId,
            amountBuy,
            `Order #${id} - Reversal of receipt from customer (Order deleted)`,
            new Date().toISOString()
          );
        }
      }
      
      // Reverse sell account transaction (payment was subtracted, so add back)
      if (order.sellAccountId && order.amountSell) {
        const sellAccountId = order.sellAccountId;
        const amountSell = Number(order.amountSell);
        
        // Check if there's already a reversal from payments (avoid double reversal)
        const hasPaymentReversal = payments.some(p => p.accountId === sellAccountId);
        
        if (!hasPaymentReversal && !isNaN(amountSell) && amountSell > 0) {
          // Add the amount back to account balance (reverse the payment)
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(amountSell, sellAccountId);
          
          // Create reverse transaction in transaction history
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            sellAccountId,
            amountSell,
            `Order #${id} - Reversal of payment to customer (Order deleted)`,
            new Date().toISOString()
          );
        }
      }
    }
    
    // Reverse profit transactions (use confirmed entries; fall back to order-level data)
    const profitReversals = confirmedProfits.length > 0
      ? confirmedProfits
      : (order.profitAmount !== null && order.profitAmount !== undefined && order.profitAccountId
        ? [{ accountId: order.profitAccountId, amount: Number(order.profitAmount) }]
        : []);
    
    profitReversals.forEach((profit) => {
      const profitAmount = Number(profit.amount);
      if (profit.accountId && !isNaN(profitAmount) && profitAmount > 0) {
        // Profit was added to account, so we need to subtract it
        db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(profitAmount, profit.accountId);
        db.prepare(
          `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
           VALUES (?, 'withdraw', ?, ?, ?);`
        ).run(
          profit.accountId,
          profitAmount,
          `Order #${id} - Reversal of profit (Order deleted)`,
          new Date().toISOString()
        );
      }
    });
    
    // Reverse service charge transactions (use confirmed entries; fall back to order-level data)
    const serviceChargeReversals = confirmedServiceCharges.length > 0
      ? confirmedServiceCharges
      : (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined && order.serviceChargeAccountId
        ? [{ accountId: order.serviceChargeAccountId, amount: Number(order.serviceChargeAmount) }]
        : []);
    
    serviceChargeReversals.forEach((serviceCharge) => {
      const serviceChargeAmount = Number(serviceCharge.amount);
      if (serviceCharge.accountId && !isNaN(serviceChargeAmount) && serviceChargeAmount !== 0) {
        if (serviceChargeAmount > 0) {
          // Positive service charge was added to account, so we need to subtract it
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?;").run(serviceChargeAmount, serviceCharge.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'withdraw', ?, ?, ?);`
          ).run(
            serviceCharge.accountId,
            serviceChargeAmount,
            `Order #${id} - Reversal of service charge (Order deleted)`,
            new Date().toISOString()
          );
        } else {
          // Negative service charge was subtracted from account, so we need to add it back
          const absAmount = Math.abs(serviceChargeAmount);
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(absAmount, serviceCharge.accountId);
          db.prepare(
            `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
             VALUES (?, 'add', ?, ?, ?);`
          ).run(
            serviceCharge.accountId,
            absAmount,
            `Order #${id} - Reversal of service charge paid by us (Order deleted)`,
            new Date().toISOString()
          );
        }
      }
    });
    
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
    // Add profit and service charge account IDs if they exist (from confirmed entries or fallback)
    profitReversals.forEach((profit) => {
      if (profit.accountId) {
        affectedAccountIds.add(profit.accountId);
      }
    });
    serviceChargeReversals.forEach((serviceCharge) => {
      if (serviceCharge.accountId) {
        affectedAccountIds.add(serviceCharge.accountId);
      }
    });

    // Get order details for notification before deleting
    const orderDetails = db.prepare(
      `SELECT o.id, c.name as customerName 
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customerId
       WHERE o.id = ?`
    ).get(id);
    const userName = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
    
    // Delete the order (this will cascade delete receipts and payments due to foreign key constraints)
    const stmt = db.prepare(`DELETE FROM orders WHERE id = ?;`);
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Send notification to all users about order deletion
    const allUsers = db.prepare("SELECT id FROM users").all();
    const allUserIds = allUsers.map(u => u.id);
    
    await createNotification({
      userId: allUserIds,
      type: 'order_deleted',
      title: 'Order Deleted',
      message: `Order #${id} - ${orderDetails?.customerName || 'Customer'} has been deleted by ${userName?.name || 'User'}`,
      entityType: 'order',
      entityId: id,
      actionUrl: `/orders`,
    });

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

    // Get profit entries (both draft and confirmed)
    const profits = db
      .prepare(
        `SELECT p.*, a.name as accountName 
         FROM order_profits p
         LEFT JOIN accounts a ON a.id = p.accountId
         WHERE p.orderId = ? 
         ORDER BY p.createdAt ASC;`
      )
      .all(id);

    // Get service charge entries (both draft and confirmed)
    const serviceCharges = db
      .prepare(
        `SELECT sc.*, a.name as accountName 
         FROM order_service_charges sc
         LEFT JOIN accounts a ON a.id = sc.accountId
         WHERE sc.orderId = ? 
         ORDER BY sc.createdAt ASC;`
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

    // Get tags for the order
    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.color 
         FROM tags t
         INNER JOIN order_tag_assignments ota ON ota.tagId = t.id
         WHERE ota.orderId = ?
         ORDER BY t.name ASC;`
      )
      .all(id);

    // Get profit transactions for this order
    const profitTransactions = db
      .prepare(
        `SELECT at.*, a.name as accountName, a.currencyCode
         FROM account_transactions at
         LEFT JOIN accounts a ON a.id = at.accountId
         WHERE at.description LIKE ? AND at.type = 'add'
         ORDER BY at.createdAt ASC;`
      )
      .all(`Order #${id} - Profit%`);

    // Get service charge transactions for this order
    const serviceChargeTransactions = db
      .prepare(
        `SELECT at.*, a.name as accountName, a.currencyCode,
                CASE 
                  WHEN at.type = 'add' THEN at.amount
                  WHEN at.type = 'withdraw' THEN -at.amount
                  ELSE 0
                END as signedAmount
         FROM account_transactions at
         LEFT JOIN accounts a ON a.id = at.accountId
         WHERE (at.description LIKE ? OR at.description LIKE ?)
         ORDER BY at.createdAt ASC;`
      )
      .all(`Order #${id} - Service Charge%`, `Order #${id} - Service Charge Paid by Us%`);

    res.json({
      order: {
        ...order,
        walletAddresses: order.walletAddresses ? JSON.parse(order.walletAddresses) : null,
        bankDetails: order.bankDetails ? JSON.parse(order.bankDetails) : null,
        isFlexOrder: order.isFlexOrder === 1 || order.isFlexOrder === true,
        tags: tags.length > 0 ? tags : [],
      },
      receipts: receiptsWithUrls,
      beneficiaries: beneficiaries.map(b => ({
        ...b,
        walletAddresses: b.walletAddresses ? JSON.parse(b.walletAddresses) : null,
      })),
      payments: paymentsWithUrls,
      profits: profits || [],
      serviceCharges: serviceCharges || [],
      profitTransactions: profitTransactions || [],
      serviceChargeTransactions: serviceChargeTransactions || [],
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
    const userId = getUserIdFromHeader(req);

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
    const order = db.prepare("SELECT id, createdBy, handlerId, fromCurrency, toCurrency, amountBuy, amountSell, paymentFlow, buyAccountId, isFlexOrder, status, orderType FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions
    if (userId) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      if (!isUserAdmin && !canModifyOrder(order, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can add receipts" 
        });
      }
    } else {
      return res.status(401).json({ message: "User ID is required" });
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
const updateAccountBalancesOnCompletion = (orderId, isImported = false) => {
  // buyAccountId = receipt account (where we receive customer payment in fromCurrency)
  // sellAccountId = payment account (where we pay customer from in toCurrency)
  const orderWithAccounts = db
    .prepare("SELECT buyAccountId, sellAccountId, amountBuy, amountSell FROM orders WHERE id = ?;")
    .get(orderId);
  
  if (!orderWithAccounts) {
    console.error(`[updateAccountBalancesOnCompletion] Order ${orderId} not found`);
    return;
  }
  
  console.log(`[updateAccountBalancesOnCompletion] Order ${orderId} completion - Accounts:`, {
    buyAccountId: orderWithAccounts.buyAccountId,
    sellAccountId: orderWithAccounts.sellAccountId,
    amountBuy: orderWithAccounts.amountBuy,
    amountSell: orderWithAccounts.amountSell,
    isImported,
  });
  
  if (orderWithAccounts.buyAccountId) {
    // Add funds to buy account (receipt account) - customer paid us amountBuy in fromCurrency
    const buyAccount = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(orderWithAccounts.buyAccountId);
    if (buyAccount) {
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?;").run(
        orderWithAccounts.amountBuy,
        orderWithAccounts.buyAccountId
      );
      const description = isImported 
        ? `Order #${orderId} - Receipt from customer (Imported)`
        : `Order #${orderId} - Receipt from customer`;
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(
        orderWithAccounts.buyAccountId,
        orderWithAccounts.amountBuy,
        description,
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
      
      const description = isImported 
        ? `Order #${orderId} - Payment to customer (Imported)`
        : `Order #${orderId} - Payment to customer`;
      db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        orderWithAccounts.sellAccountId,
        amountToDeduct,
        description,
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
    const userId = getUserIdFromHeader(req);

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
    const order = db.prepare("SELECT id, createdBy, handlerId, toCurrency, amountSell, paymentFlow, sellAccountId, isFlexOrder, actualAmountBuy, actualAmountSell, actualRate, rate, orderType FROM orders WHERE id = ?;").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions
    if (userId) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      if (!isUserAdmin && !canModifyOrder(order, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can add payments" 
        });
      }
    } else {
      return res.status(401).json({ message: "User ID is required" });
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
    const userId = getUserIdFromHeader(req);

    // Check if receipt exists and is a draft
    const receipt = db.prepare("SELECT * FROM order_receipts WHERE id = ?;").get(receiptId);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }
    if (receipt.status !== 'draft') {
      return res.status(400).json({ message: "Only draft receipts can be confirmed" });
    }

    // Check permissions - get order info (fetch all fields needed for later use)
    const order = db.prepare("SELECT id, createdBy, handlerId, fromCurrency, toCurrency, amountBuy, paymentFlow, isFlexOrder, actualAmountBuy, rate, actualRate, status FROM orders WHERE id = ?;").get(receipt.orderId);
    if (userId && order) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      if (!isUserAdmin && !canModifyOrder(order, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can confirm receipts" 
        });
      }
    } else if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
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
    // Note: order variable already fetched above with all needed fields
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
    const userId = getUserIdFromHeader(req);

    // Check if payment exists and is a draft
    const payment = db.prepare("SELECT * FROM order_payments WHERE id = ?;").get(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (payment.status !== 'draft') {
      return res.status(400).json({ message: "Only draft payments can be confirmed" });
    }

    // Check permissions - get order info (fetch all fields needed for later use)
    const order = db.prepare("SELECT id, createdBy, handlerId, fromCurrency, toCurrency, amountBuy, amountSell, paymentFlow, isFlexOrder, actualAmountBuy, rate, actualRate, status FROM orders WHERE id = ?;").get(payment.orderId);
    if (userId && order) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      if (!isUserAdmin && !canModifyOrder(order, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can confirm payments" 
        });
      }
    } else if (!userId) {
      return res.status(401).json({ message: "User ID is required" });
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
    // Note: order variable already fetched above with all needed fields
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

// Update a draft profit (can only update drafts)
export const updateProfit = (req, res, next) => {
  try {
    const { profitId } = req.params;
    const { amount, accountId, currencyCode } = req.body;
    const userId = getUserIdFromHeader(req);

    // Check if profit exists and is a draft
    const existingProfit = db.prepare("SELECT * FROM order_profits WHERE id = ?;").get(profitId);
    if (!existingProfit) {
      return res.status(404).json({ message: "Profit not found" });
    }

    // Check permissions - get order info (fetch all fields needed)
    const order = db.prepare("SELECT id, createdBy, handlerId, fromCurrency, toCurrency FROM orders WHERE id = ?;").get(existingProfit.orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    if (userId) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      if (!isUserAdmin && !canModifyOrder(order, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can update profit" 
        });
      }
    } else {
      return res.status(401).json({ message: "User ID is required" });
    }

    if (existingProfit.status !== 'draft') {
      return res.status(400).json({ message: "Only draft profits can be updated" });
    }

    // Validate account if provided
    let accountIdToUse = existingProfit.accountId;
    if (accountId !== undefined && accountId !== null && accountId !== "") {
      const profitAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?;").get(Number(accountId));
      if (!profitAccount) {
        return res.status(400).json({ message: "Profit account not found" });
      }
      const currencyToCheck = currencyCode || existingProfit.currencyCode;
      if (profitAccount.currencyCode !== currencyToCheck) {
        return res.status(400).json({ 
          message: `Profit account currency (${profitAccount.currencyCode}) does not match profit currency (${currencyToCheck})` 
        });
      }
      accountIdToUse = Number(accountId);
    }

    const profitAmount = amount !== undefined ? parseFloat(amount) : existingProfit.amount;
    const profitCurrency = currencyCode || existingProfit.currencyCode;

    // Update profit
    db.prepare(
      `UPDATE order_profits 
       SET amount = @amount, accountId = @accountId, currencyCode = @currencyCode
       WHERE id = @id;`
    ).run({
      id: profitId,
      amount: profitAmount,
      accountId: accountIdToUse,
      currencyCode: profitCurrency,
    });

    const updatedProfit = db
      .prepare(
        `SELECT p.*, a.name as accountName 
         FROM order_profits p
         LEFT JOIN accounts a ON a.id = p.accountId
         WHERE p.id = ?;`
      )
      .get(profitId);

    res.json(updatedProfit);
  } catch (error) {
    console.error("Error updating profit:", error);
    next(error);
  }
};

// Delete a draft profit (can only delete drafts)
export const deleteProfit = (req, res, next) => {
  try {
    const { profitId } = req.params;

    // Check if profit exists and is a draft
    const profit = db.prepare("SELECT * FROM order_profits WHERE id = ?;").get(profitId);
    if (!profit) {
      return res.status(404).json({ message: "Profit not found" });
    }
    if (profit.status !== 'draft') {
      return res.status(400).json({ message: "Only draft profits can be deleted" });
    }

    db.prepare("DELETE FROM order_profits WHERE id = ?;").run(profitId);

    res.json({ success: true, orderId: profit.orderId });
  } catch (error) {
    console.error("Error deleting profit:", error);
    next(error);
  }
};

// Confirm a draft profit (updates account balance and transaction history)
export const confirmProfit = (req, res, next) => {
  try {
    const { profitId } = req.params;

    // Check if profit exists and is a draft
    const profit = db.prepare("SELECT * FROM order_profits WHERE id = ?;").get(profitId);
    if (!profit) {
      return res.status(404).json({ message: "Profit not found" });
    }
    if (profit.status !== 'draft') {
      return res.status(400).json({ message: "Only draft profits can be confirmed" });
    }

    if (!profit.accountId) {
      return res.status(400).json({ message: "Profit must have an account before confirmation" });
    }

    // Update profit status to confirmed
    db.prepare("UPDATE order_profits SET status = 'confirmed' WHERE id = ?;").run(profitId);

    // Update account balance and create transaction
    const accountForBalance = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(profit.accountId);
    if (!accountForBalance) {
      return res.status(400).json({ message: "Profit account not found" });
    }
    
    const oldBalance = accountForBalance.balance;
    const newBalance = oldBalance + profit.amount;
    
    db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, profit.accountId);
    
    // Create account transaction
    const transactionResult = db.prepare(
      `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
       VALUES (?, 'add', ?, ?, ?);`
    ).run(
      profit.accountId,
      profit.amount,
      `Order #${profit.orderId} - Profit`,
      new Date().toISOString()
    );
    
    if (!transactionResult.lastInsertRowid) {
      console.error("Failed to create account transaction for profit:", profitId);
    }

    // Get updated profit
    const confirmedProfit = db
      .prepare(
        `SELECT p.*, a.name as accountName 
         FROM order_profits p
         LEFT JOIN accounts a ON a.id = p.accountId
         WHERE p.id = ?;`
      )
      .get(profitId);

    res.json(confirmedProfit);
  } catch (error) {
    console.error("Error confirming profit:", error);
    next(error);
  }
};

// Update a draft service charge (can only update drafts)
export const updateServiceCharge = (req, res, next) => {
  try {
    const { serviceChargeId } = req.params;
    const { amount, accountId, currencyCode } = req.body;
    const userId = getUserIdFromHeader(req);

    // Check if service charge exists and is a draft
    const existingServiceCharge = db.prepare("SELECT * FROM order_service_charges WHERE id = ?;").get(serviceChargeId);
    if (!existingServiceCharge) {
      return res.status(404).json({ message: "Service charge not found" });
    }

    // Check permissions - get order info (fetch all fields needed)
    const order = db.prepare("SELECT id, createdBy, handlerId, fromCurrency, toCurrency FROM orders WHERE id = ?;").get(existingServiceCharge.orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    if (userId) {
      const userPermissions = getUserPermissions(userId);
      const isUserAdmin = isAdmin(userPermissions);
      
      if (!isUserAdmin && !canModifyOrder(order, userId)) {
        return res.status(403).json({ 
          message: "Only the order creator, handler, or admin can update service charges" 
        });
      }
    } else {
      return res.status(401).json({ message: "User ID is required" });
    }

    if (existingServiceCharge.status !== 'draft') {
      return res.status(400).json({ message: "Only draft service charges can be updated" });
    }

    // Validate account if provided
    let accountIdToUse = existingServiceCharge.accountId;
    if (accountId !== undefined && accountId !== null && accountId !== "") {
      const scAccount = db.prepare("SELECT id, currencyCode FROM accounts WHERE id = ?;").get(Number(accountId));
      if (!scAccount) {
        return res.status(400).json({ message: "Service charge account not found" });
      }
      const currencyToCheck = currencyCode || existingServiceCharge.currencyCode;
      if (scAccount.currencyCode !== currencyToCheck) {
        return res.status(400).json({ 
          message: `Service charge account currency (${scAccount.currencyCode}) does not match service charge currency (${currencyToCheck})` 
        });
      }
      accountIdToUse = Number(accountId);
    }

    const serviceChargeAmount = amount !== undefined ? parseFloat(amount) : existingServiceCharge.amount;
    const serviceChargeCurrency = currencyCode || existingServiceCharge.currencyCode;

    // Update service charge
    db.prepare(
      `UPDATE order_service_charges 
       SET amount = @amount, accountId = @accountId, currencyCode = @currencyCode
       WHERE id = @id;`
    ).run({
      id: serviceChargeId,
      amount: serviceChargeAmount,
      accountId: accountIdToUse,
      currencyCode: serviceChargeCurrency,
    });

    const updatedServiceCharge = db
      .prepare(
        `SELECT sc.*, a.name as accountName 
         FROM order_service_charges sc
         LEFT JOIN accounts a ON a.id = sc.accountId
         WHERE sc.id = ?;`
      )
      .get(serviceChargeId);

    res.json(updatedServiceCharge);
  } catch (error) {
    console.error("Error updating service charge:", error);
    next(error);
  }
};

// Delete a draft service charge (can only delete drafts)
export const deleteServiceCharge = (req, res, next) => {
  try {
    const { serviceChargeId } = req.params;

    // Check if service charge exists and is a draft
    const serviceCharge = db.prepare("SELECT * FROM order_service_charges WHERE id = ?;").get(serviceChargeId);
    if (!serviceCharge) {
      return res.status(404).json({ message: "Service charge not found" });
    }
    if (serviceCharge.status !== 'draft') {
      return res.status(400).json({ message: "Only draft service charges can be deleted" });
    }

    db.prepare("DELETE FROM order_service_charges WHERE id = ?;").run(serviceChargeId);

    res.json({ success: true, orderId: serviceCharge.orderId });
  } catch (error) {
    console.error("Error deleting service charge:", error);
    next(error);
  }
};

// Confirm a draft service charge (updates account balance and transaction history)
export const confirmServiceCharge = (req, res, next) => {
  try {
    const { serviceChargeId } = req.params;

    // Check if service charge exists and is a draft
    const serviceCharge = db.prepare("SELECT * FROM order_service_charges WHERE id = ?;").get(serviceChargeId);
    if (!serviceCharge) {
      return res.status(404).json({ message: "Service charge not found" });
    }
    if (serviceCharge.status !== 'draft') {
      return res.status(400).json({ message: "Only draft service charges can be confirmed" });
    }

    if (!serviceCharge.accountId) {
      return res.status(400).json({ message: "Service charge must have an account before confirmation" });
    }

    // Update service charge status to confirmed
    db.prepare("UPDATE order_service_charges SET status = 'confirmed' WHERE id = ?;").run(serviceChargeId);

    // Update account balance and create transaction
    const accountForBalance = db.prepare("SELECT balance FROM accounts WHERE id = ?;").get(serviceCharge.accountId);
    if (!accountForBalance) {
      return res.status(400).json({ message: "Service charge account not found" });
    }
    
    const oldBalance = accountForBalance.balance;
    const amount = Number(serviceCharge.amount);
    
    if (amount > 0) {
      // Positive service charge: add to account (we receive it)
      const newBalance = oldBalance + amount;
      db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, serviceCharge.accountId);
      
      // Create account transaction
      const transactionResult = db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'add', ?, ?, ?);`
      ).run(
        serviceCharge.accountId,
        amount,
        `Order #${serviceCharge.orderId} - Service charge`,
        new Date().toISOString()
      );
      
      if (!transactionResult.lastInsertRowid) {
        console.error("Failed to create account transaction for service charge:", serviceChargeId);
      }
    } else if (amount < 0) {
      // Negative service charge: subtract from account (we pay it)
      const absAmount = Math.abs(amount);
      const newBalance = oldBalance - absAmount;
      db.prepare("UPDATE accounts SET balance = ? WHERE id = ?;").run(newBalance, serviceCharge.accountId);
      
      // Create account transaction
      const transactionResult = db.prepare(
        `INSERT INTO account_transactions (accountId, type, amount, description, createdAt)
         VALUES (?, 'withdraw', ?, ?, ?);`
      ).run(
        serviceCharge.accountId,
        absAmount,
        `Order #${serviceCharge.orderId} - Service charge paid by us`,
        new Date().toISOString()
      );
      
      if (!transactionResult.lastInsertRowid) {
        console.error("Failed to create account transaction for service charge:", serviceChargeId);
      }
    }

    // Get updated service charge
    const confirmedServiceCharge = db
      .prepare(
        `SELECT sc.*, a.name as accountName 
         FROM order_service_charges sc
         LEFT JOIN accounts a ON a.id = sc.accountId
         WHERE sc.id = ?;`
      )
      .get(serviceChargeId);

    res.json(confirmedServiceCharge);
  } catch (error) {
    console.error("Error confirming service charge:", error);
    next(error);
  }
};

export const getDashboardStats = (req, res) => {
  try {
    // Get total orders count
    const totalOrdersResult = db.prepare("SELECT COUNT(*) as total FROM orders;").get();
    const totalOrders = Number(totalOrdersResult?.total || 0);

    // Get pending orders count (pending + under_process)
    const pendingOrdersResult = db.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE status IN ('pending', 'under_process');"
    ).get();
    const pendingOrders = Number(pendingOrdersResult?.total || 0);

    // Get completed orders count
    const completedOrdersResult = db.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE status = 'completed';"
    ).get();
    const completedOrders = Number(completedOrdersResult?.total || 0);

    // Get cancelled orders count
    const cancelledOrdersResult = db.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE status = 'cancelled';"
    ).get();
    const cancelledOrders = Number(cancelledOrdersResult?.total || 0);

    const result = {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
    };

    console.log("Dashboard stats result:", result);
    res.json(result);
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ message: "Error getting dashboard statistics", error: error.message });
  }
};


