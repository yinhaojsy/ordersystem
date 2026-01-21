import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// Middleware to verify bot API key
const verifyBotAuth = (req, res, next) => {
  const apiKey = req.headers['x-bot-api-key'];
  const expectedKey = process.env.BOT_API_KEY;
  
  if (!expectedKey) {
    console.error('BOT_API_KEY not configured in environment variables');
    return res.status(500).json({ error: 'Bot API not configured' });
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    console.log('Unauthorized bot API access attempt');
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }
  
  next();
};

// Apply auth middleware to all bot routes
router.use(verifyBotAuth);

// ============= ORDERS =============

// Create order
router.post('/orders', (req, res) => {
  try {
    const { 
      customerName, 
      customerId,
      fromCurrency, 
      toCurrency, 
      amountBuy, 
      amountSell, 
      rate,
      orderType = 'online',
      handlerId,
      buyAccount,
      sellAccount
    } = req.body;
    
    // Validate required fields
    if (!fromCurrency || !toCurrency || !amountBuy || !amountSell || !rate) {
      return res.status(400).json({ 
        error: 'Missing required fields: fromCurrency, toCurrency, amountBuy, amountSell, rate' 
      });
    }
    
    // Get or create customer
    let finalCustomerId = customerId;
    
    if (!finalCustomerId && customerName) {
      // Try to find existing customer by name
      const existingCustomer = db.prepare(
        'SELECT id FROM customers WHERE name = ?'
      ).get(customerName);
      
      if (existingCustomer) {
        finalCustomerId = existingCustomer.id;
      } else {
        // Create new customer
        const result = db.prepare(
          'INSERT INTO customers (name) VALUES (?)'
        ).run(customerName);
        finalCustomerId = result.lastInsertRowid;
      }
    }
    
    if (!finalCustomerId) {
      return res.status(400).json({ error: 'Customer name or ID required' });
    }
    
    // Create order
    const stmt = db.prepare(`
      INSERT INTO orders (
        customerId, fromCurrency, toCurrency, 
        amountBuy, amountSell, rate, 
        status, orderType, createdAt, handlerId,
        buyAccount, sellAccount
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      finalCustomerId,
      fromCurrency,
      toCurrency,
      amountBuy,
      amountSell,
      rate,
      orderType,
      new Date().toISOString(),
      handlerId || null,
      buyAccount || null,
      sellAccount || null
    );
    
    // Get created order with customer info
    const order = db.prepare(`
      SELECT o.*, c.name as customerName
      FROM orders o
      LEFT JOIN customers c ON o.customerId = c.id
      WHERE o.id = ?
    `).get(result.lastInsertRowid);
    
    console.log(`✅ Bot created order #${order.id}`);
    
    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
router.get('/orders/:id', (req, res) => {
  try {
    const order = db.prepare(`
      SELECT 
        o.*,
        c.name as customerName,
        u.name as handlerName
      FROM orders o
      LEFT JOIN customers c ON o.customerId = c.id
      LEFT JOIN users u ON o.handlerId = u.id
      WHERE o.id = ?
    `).get(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: error.message });
  }
});

// List recent orders with comprehensive filtering
router.get('/orders', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status; // comma-separated
    const tags = req.query.tags; // comma-separated
    const handler = req.query.handler; // handler name (partial match)
    const customer = req.query.customer; // customer name (partial match)
    const createdBy = req.query.createdBy; // creator name (partial match)
    const dateRange = req.query.dateRange; // last_week, current_month, today, etc.
    const currencyPair = req.query.currencyPair; // e.g., "USDT/HKD"
    
    let query = `
      SELECT 
        o.*,
        c.name as customerName,
        u.name as handlerName,
        creator.name as createdByName,
        GROUP_CONCAT(t.name) as tags
      FROM orders o
      LEFT JOIN customers c ON o.customerId = c.id
      LEFT JOIN users u ON o.handlerId = u.id
      LEFT JOIN users creator ON o.createdBy = creator.id
      LEFT JOIN order_tag_assignments ota ON o.id = ota.orderId
      LEFT JOIN tags t ON ota.tagId = t.id
    `;
    
    const conditions = [];
    const params = [];
    
    // Status filter
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      const placeholders = statuses.map(() => '?').join(',');
      conditions.push(`o.status IN (${placeholders})`);
      params.push(...statuses);
    }
    
    // Tags filter
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      const tagPlaceholders = tagList.map(() => '?').join(',');
      conditions.push(`o.id IN (
        SELECT orderId FROM order_tag_assignments ota2
        JOIN tags t2 ON ota2.tagId = t2.id
        WHERE t2.name IN (${tagPlaceholders})
      )`);
      params.push(...tagList);
    }
    
    // Handler filter (partial match)
    if (handler) {
      conditions.push(`u.name LIKE ?`);
      params.push(`%${handler}%`);
    }
    
    // Customer filter (partial match)
    if (customer) {
      conditions.push(`c.name LIKE ?`);
      params.push(`%${customer}%`);
    }
    
    // Created by filter (partial match)
    if (createdBy) {
      conditions.push(`creator.name LIKE ?`);
      params.push(`%${createdBy}%`);
    }
    
    // Date range filter
    if (dateRange) {
      const now = new Date();
      let startDate, endDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
          break;
          
        case 'last_week':
          // Last week: Monday to Sunday of previous week (in UTC)
          const currentDayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
          const daysToLastMonday = currentDayOfWeek === 0 ? 8 : currentDayOfWeek + 6;
          
          const lastMonday = new Date(now);
          lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday);
          lastMonday.setUTCHours(0, 0, 0, 0);
          
          const lastSunday = new Date(lastMonday);
          lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
          lastSunday.setUTCHours(23, 59, 59, 999);
          
          startDate = lastMonday;
          endDate = lastSunday;
          break;
          
        case 'this_week':
          // This week: Monday to Sunday of current week (in UTC)
          const dayOfWeek = now.getUTCDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          
          const thisMonday = new Date(now);
          thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday);
          thisMonday.setUTCHours(0, 0, 0, 0);
          
          const thisSunday = new Date(thisMonday);
          thisSunday.setUTCDate(thisMonday.getUTCDate() + 6);
          thisSunday.setUTCHours(23, 59, 59, 999);
          
          startDate = thisMonday;
          endDate = thisSunday;
          break;
          
        case 'current_month':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
          break;
          
        case 'last_month':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
          break;
      }
      
      if (startDate && endDate) {
        console.log(`📅 Date filter '${dateRange}':`, {
          now: now.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          dayOfWeek: now.getUTCDay()
        });
        conditions.push(`o.createdAt >= ? AND o.createdAt <= ?`);
        params.push(startDate.toISOString(), endDate.toISOString());
      }
    }
    
    // Currency pair filter
    if (currencyPair) {
      const [from, to] = currencyPair.split('/').map(c => c.trim().toUpperCase());
      if (from && to) {
        conditions.push(`o.fromCurrency = ? AND o.toCurrency = ?`);
        params.push(from, to);
      }
    }
    
    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    
    // Group by order ID to handle tags aggregation
    query += ` GROUP BY o.id ORDER BY o.createdAt DESC LIMIT ?`;
    params.push(limit);
    
    console.log(`🔍 Bot orders query with filters:`, { status, tags, handler, customer, createdBy, dateRange, currencyPair });
    
    const orders = db.prepare(query).all(...params);
    
    console.log(`📊 Found ${orders.length} orders`);
    if (orders.length > 0) {
      console.log(`   First order: #${orders[0].id}, created: ${orders[0].createdAt}`);
      console.log(`   Last order: #${orders[orders.length-1].id}, created: ${orders[orders.length-1].createdAt}`);
    }
    
    res.json(orders);
  } catch (error) {
    console.error('Error listing orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete order
router.patch('/orders/:id/complete', (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Check if order exists
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Update order status
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('completed', orderId);
    
    // Get updated order
    const updatedOrder = db.prepare(`
      SELECT 
        o.*,
        c.name as customerName
      FROM orders o
      LEFT JOIN customers c ON o.customerId = c.id
      WHERE o.id = ?
    `).get(orderId);
    
    console.log(`✅ Bot completed order #${orderId}`);
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= EXPENSES =============

// Create expense
router.post('/expenses', (req, res) => {
  try {
    const { 
      accountId,
      accountName,
      amount, 
      currencyCode = 'USD', 
      description 
    } = req.body;
    
    if (!amount || !description) {
      return res.status(400).json({ error: 'Amount and description required' });
    }
    
    // Get or find account
    let finalAccountId = accountId;
    
    if (!finalAccountId && accountName) {
      const account = db.prepare(
        'SELECT id FROM accounts WHERE name = ? AND currencyCode = ?'
      ).get(accountName, currencyCode);
      
      if (account) {
        finalAccountId = account.id;
      }
    }
    
    if (!finalAccountId) {
      // Use first available account for this currency
      const account = db.prepare(
        'SELECT id FROM accounts WHERE currencyCode = ? LIMIT 1'
      ).get(currencyCode);
      
      if (!account) {
        return res.status(400).json({ 
          error: `No account found for currency ${currencyCode}` 
        });
      }
      
      finalAccountId = account.id;
    }
    
    // Create expense
    const stmt = db.prepare(`
      INSERT INTO expenses (
        accountId, amount, currencyCode, 
        description, createdAt
      )
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      finalAccountId,
      amount,
      currencyCode,
      description,
      new Date().toISOString()
    );
    
    // Get created expense with account info
    const expense = db.prepare(`
      SELECT e.*, a.name as accountName
      FROM expenses e
      LEFT JOIN accounts a ON e.accountId = a.id
      WHERE e.id = ?
    `).get(result.lastInsertRowid);
    
    console.log(`✅ Bot created expense #${expense.id}`);
    
    res.json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get expense by ID
router.get('/expenses/:id', (req, res) => {
  try {
    const expense = db.prepare(`
      SELECT 
        e.*,
        a.name as accountName,
        u.name as createdByName
      FROM expenses e
      LEFT JOIN accounts a ON e.accountId = a.id
      LEFT JOIN users u ON e.createdBy = u.id
      WHERE e.id = ? AND e.deletedAt IS NULL
    `).get(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(expense);
  } catch (error) {
    console.error('Error getting expense:', error);
    res.status(500).json({ error: error.message });
  }
});

// List recent expenses with filtering
router.get('/expenses', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const dateRange = req.query.dateRange;
    const createdBy = req.query.createdBy;
    
    let query = `
      SELECT 
        e.*,
        a.name as accountName,
        u.name as createdByName
      FROM expenses e
      LEFT JOIN accounts a ON e.accountId = a.id
      LEFT JOIN users u ON e.createdBy = u.id
    `;
    
    const conditions = ['e.deletedAt IS NULL'];
    const params = [];
    
    // Created by filter
    if (createdBy) {
      conditions.push(`u.name LIKE ?`);
      params.push(`%${createdBy}%`);
    }
    
    // Date range filter (same logic as orders)
    if (dateRange) {
      const now = new Date();
      let startDate, endDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
          break;
          
        case 'last_week':
          const currentDayOfWeek = now.getUTCDay();
          const daysToLastMonday = currentDayOfWeek === 0 ? 8 : currentDayOfWeek + 6;
          
          const lastMonday = new Date(now);
          lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday);
          lastMonday.setUTCHours(0, 0, 0, 0);
          
          const lastSunday = new Date(lastMonday);
          lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
          lastSunday.setUTCHours(23, 59, 59, 999);
          
          startDate = lastMonday;
          endDate = lastSunday;
          break;
          
        case 'this_week':
          const dayOfWeek = now.getUTCDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          
          const thisMonday = new Date(now);
          thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday);
          thisMonday.setUTCHours(0, 0, 0, 0);
          
          const thisSunday = new Date(thisMonday);
          thisSunday.setUTCDate(thisMonday.getUTCDate() + 6);
          thisSunday.setUTCHours(23, 59, 59, 999);
          
          startDate = thisMonday;
          endDate = thisSunday;
          break;
          
        case 'current_month':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
          break;
          
        case 'last_month':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
          break;
      }
      
      if (startDate && endDate) {
        console.log(`📅 Expense date filter '${dateRange}':`, {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        conditions.push(`e.createdAt >= ? AND e.createdAt <= ?`);
        params.push(startDate.toISOString(), endDate.toISOString());
      }
    }
    
    query += ` WHERE ` + conditions.join(' AND ');
    query += ` ORDER BY e.createdAt DESC LIMIT ?`;
    params.push(limit);
    
    console.log(`🔍 Bot expenses query with filters:`, { dateRange, createdBy });
    
    const expenses = db.prepare(query).all(...params);
    
    console.log(`📊 Found ${expenses.length} expenses`);
    
    res.json(expenses);
  } catch (error) {
    console.error('Error listing expenses:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= TRANSFERS =============

// Create transfer
router.post('/transfers', (req, res) => {
  try {
    const { 
      fromAccountId,
      fromAccountName,
      toAccountId,
      toAccountName,
      amount, 
      currencyCode = 'USD', 
      description 
    } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount required' });
    }
    
    // Get accounts
    let finalFromAccountId = fromAccountId;
    let finalToAccountId = toAccountId;
    
    if (!finalFromAccountId && fromAccountName) {
      const account = db.prepare(
        'SELECT id FROM accounts WHERE name = ? AND currencyCode = ?'
      ).get(fromAccountName, currencyCode);
      
      if (account) {
        finalFromAccountId = account.id;
      }
    }
    
    if (!finalToAccountId && toAccountName) {
      const account = db.prepare(
        'SELECT id FROM accounts WHERE name = ? AND currencyCode = ?'
      ).get(toAccountName, currencyCode);
      
      if (account) {
        finalToAccountId = account.id;
      }
    }
    
    if (!finalFromAccountId || !finalToAccountId) {
      return res.status(400).json({ 
        error: 'Source and destination accounts required' 
      });
    }
    
    if (finalFromAccountId === finalToAccountId) {
      return res.status(400).json({ 
        error: 'Source and destination accounts must be different' 
      });
    }
    
    // Create transfer
    const stmt = db.prepare(`
      INSERT INTO internal_transfers (
        fromAccountId, toAccountId, amount, 
        currencyCode, description, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      finalFromAccountId,
      finalToAccountId,
      amount,
      currencyCode,
      description,
      new Date().toISOString()
    );
    
    // Get created transfer with account info
    const transfer = db.prepare(`
      SELECT 
        t.*,
        fa.name as fromAccountName,
        ta.name as toAccountName
      FROM internal_transfers t
      LEFT JOIN accounts fa ON t.fromAccountId = fa.id
      LEFT JOIN accounts ta ON t.toAccountId = ta.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    
    console.log(`✅ Bot created transfer #${transfer.id}`);
    
    res.json(transfer);
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transfer by ID
router.get('/transfers/:id', (req, res) => {
  try {
    const transfer = db.prepare(`
      SELECT 
        t.*,
        fa.name as fromAccountName,
        ta.name as toAccountName,
        u.name as createdByName
      FROM internal_transfers t
      LEFT JOIN accounts fa ON t.fromAccountId = fa.id
      LEFT JOIN accounts ta ON t.toAccountId = ta.id
      LEFT JOIN users u ON t.createdBy = u.id
      WHERE t.id = ?
    `).get(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }
    
    res.json(transfer);
  } catch (error) {
    console.error('Error getting transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// List recent transfers with filtering
router.get('/transfers', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const dateRange = req.query.dateRange;
    const createdBy = req.query.createdBy;
    
    let query = `
      SELECT 
        t.*,
        fa.name as fromAccountName,
        ta.name as toAccountName,
        u.name as createdByName
      FROM internal_transfers t
      LEFT JOIN accounts fa ON t.fromAccountId = fa.id
      LEFT JOIN accounts ta ON t.toAccountId = ta.id
      LEFT JOIN users u ON t.createdBy = u.id
    `;
    
    const conditions = [];
    const params = [];
    
    // Created by filter
    if (createdBy) {
      conditions.push(`u.name LIKE ?`);
      params.push(`%${createdBy}%`);
    }
    
    // Date range filter (same logic as orders/expenses)
    if (dateRange) {
      const now = new Date();
      let startDate, endDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
          break;
          
        case 'last_week':
          const currentDayOfWeek = now.getUTCDay();
          const daysToLastMonday = currentDayOfWeek === 0 ? 8 : currentDayOfWeek + 6;
          
          const lastMonday = new Date(now);
          lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday);
          lastMonday.setUTCHours(0, 0, 0, 0);
          
          const lastSunday = new Date(lastMonday);
          lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
          lastSunday.setUTCHours(23, 59, 59, 999);
          
          startDate = lastMonday;
          endDate = lastSunday;
          break;
          
        case 'this_week':
          const dayOfWeek = now.getUTCDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          
          const thisMonday = new Date(now);
          thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday);
          thisMonday.setUTCHours(0, 0, 0, 0);
          
          const thisSunday = new Date(thisMonday);
          thisSunday.setUTCDate(thisMonday.getUTCDate() + 6);
          thisSunday.setUTCHours(23, 59, 59, 999);
          
          startDate = thisMonday;
          endDate = thisSunday;
          break;
          
        case 'current_month':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
          break;
          
        case 'last_month':
          startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
          break;
      }
      
      if (startDate && endDate) {
        console.log(`📅 Transfer date filter '${dateRange}':`, {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        conditions.push(`t.createdAt >= ? AND t.createdAt <= ?`);
        params.push(startDate.toISOString(), endDate.toISOString());
      }
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    
    query += ` ORDER BY t.createdAt DESC LIMIT ?`;
    params.push(limit);
    
    console.log(`🔍 Bot transfers query with filters:`, { dateRange, createdBy });
    
    const transfers = db.prepare(query).all(...params);
    
    console.log(`📊 Found ${transfers.length} transfers`);
    
    res.json(transfers);
  } catch (error) {
    console.error('Error listing transfers:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
