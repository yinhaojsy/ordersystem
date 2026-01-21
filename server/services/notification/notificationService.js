import { db } from '../../db.js';

// Import broadcastNotification dynamically to avoid circular dependency
let broadcastNotification = null;

// Telegram Bot Webhook Configuration (lazy-read so dotenv can load first)
function getTelegramConfig() {
  const enabled = (process.env.ENABLE_TELEGRAM_NOTIFICATIONS || '').trim() === 'true';
  const url = process.env.TELEGRAM_BOT_WEBHOOK_URL || 'http://localhost:3001/webhook/notification';
  const secret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET || 'your-secret-key-here';
  return { enabled, url, secret };
}

/**
 * Set the broadcast function (called from controller to avoid circular dependency)
 */
export function setBroadcastFunction(fn) {
  broadcastNotification = fn;
}

/**
 * Push notification to Telegram bot via webhook
 */
async function pushToTelegramBot(notificationData) {
  const { enabled, url, secret } = getTelegramConfig();
  if (!enabled) {
    return; // Telegram notifications disabled
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': secret
      },
      body: JSON.stringify(notificationData),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Notification pushed to Telegram bot:', notificationData.type);
  } catch (error) {
    // Log error but don't throw - notification system should be resilient
    console.error('⚠️  Failed to push notification to Telegram bot:', error.message);
  }
}

/**
 * Create and send notification through all enabled channels
 * @param {Object} options - Notification options
 * @param {number|number[]} options.userId - Single user ID or array of user IDs
 * @param {string} options.type - Notification type
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} options.entityType - Entity type (order/expense/transfer)
 * @param {number} options.entityId - Entity ID
 * @param {string} options.actionUrl - URL to navigate to
 * @param {Object} options.metadata - Additional data for external channels
 */
export async function createNotification(options) {
  const {
    userId,
    type,
    title,
    message,
    entityType = null,
    entityId = null,
    actionUrl = null,
    metadata = {}
  } = options;

  // Support single user or multiple users
  const userIds = Array.isArray(userId) ? userId : [userId];
  
  const createdNotifications = [];
  let roomNotification = null;

  for (const uid of userIds) {
    // Check user preferences - should we send this notification?
    const shouldNotify = await checkUserPreferences(uid, type);
    if (!shouldNotify) continue;

    // Create notification record in database
    const notification = db.prepare(`
      INSERT INTO notifications (
        userId, type, title, message, 
        entityType, entityId, actionUrl, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uid,
      type,
      title,
      message,
      entityType,
      entityId,
      actionUrl,
      new Date().toISOString()
    );

    const notificationData = {
      id: notification.lastInsertRowid,
      userId: uid,
      type,
      title,
      message,
      entityType,
      entityId,
      actionUrl,
      metadata,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    createdNotifications.push(notificationData);
    if (!roomNotification) {
      roomNotification = notificationData;
    }

    // Broadcast via SSE if available
    if (broadcastNotification) {
      try {
        broadcastNotification(uid, notificationData);
      } catch (error) {
        console.error('Error broadcasting notification via SSE:', error);
      }
    }
  }

  // Push a single notification to Telegram room (not per-user)
  if (roomNotification) {
    pushToTelegramBot(roomNotification).catch(() => {
      // Already logged in pushToTelegramBot, just catch to prevent unhandled rejection
    });
  }

  return createdNotifications;
}

/**
 * Check if user wants to receive this notification type
 */
async function checkUserPreferences(userId, notificationType) {
  // Get user preferences
  const prefs = db.prepare(`
    SELECT * FROM user_notification_preferences WHERE userId = ?
  `).get(userId);

  // If no preferences set, use defaults
  if (!prefs) {
    return getDefaultPreference(notificationType);
  }

  // Map notification type to preference field
  const prefField = getPreferenceField(notificationType);
  if (!prefField) return true; // If no mapping, send notification by default
  
  return prefs[prefField] === 1;
}

/**
 * Map notification type to database preference field
 */
function getPreferenceField(notificationType) {
  const mapping = {
    'approval_approved': 'notifyApprovalApproved',
    'approval_rejected': 'notifyApprovalRejected',
    'approval_pending': 'notifyApprovalPending',
    'order_assigned': 'notifyOrderAssigned',
    'order_unassigned': 'notifyOrderUnassigned',
    'order_created': 'notifyOrderCreated',
    'order_completed': 'notifyOrderCompleted',
    'order_cancelled': 'notifyOrderCancelled',
    'order_deleted': 'notifyOrderDeleted',
    'expense_created': 'notifyExpenseCreated',
    'expense_deleted': 'notifyExpenseDeleted',
    'transfer_created': 'notifyTransferCreated',
    'transfer_deleted': 'notifyTransferDeleted',
  };
  return mapping[notificationType] || null;
}

/**
 * Default preferences for notification types
 */
function getDefaultPreference(notificationType) {
  const defaults = {
    'approval_approved': true,
    'approval_rejected': true,
    'approval_pending': true,
    'order_assigned': true,
    'order_unassigned': true,
    'order_created': true,
    'order_completed': true,
    'order_cancelled': true,
    'order_deleted': true,
    'expense_created': true,
    'expense_deleted': true,
    'transfer_created': true,
    'transfer_deleted': true,
    // Everything else defaults to false
  };
  return defaults[notificationType] !== undefined ? defaults[notificationType] : false;
}

/**
 * Get user's notifications
 */
export function getUserNotifications(userId, limit = 20, offset = 0) {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE userId = ? 
    ORDER BY createdAt DESC 
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);

  return notifications.map(n => ({
    ...n,
    isRead: n.isRead === 1
  }));
}

/**
 * Get unread notification count for user
 */
export function getUnreadCount(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count 
    FROM notifications 
    WHERE userId = ? AND isRead = 0
  `).get(userId);

  return result.count;
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId, userId) {
  const result = db.prepare(`
    UPDATE notifications 
    SET isRead = 1 
    WHERE id = ? AND userId = ?
  `).run(notificationId, userId);

  return result.changes > 0;
}

/**
 * Mark all notifications as read for user
 */
export function markAllAsRead(userId) {
  const result = db.prepare(`
    UPDATE notifications 
    SET isRead = 1 
    WHERE userId = ? AND isRead = 0
  `).run(userId);

  return result.changes;
}

/**
 * Delete notification
 */
export function deleteNotification(notificationId, userId) {
  const result = db.prepare(`
    DELETE FROM notifications 
    WHERE id = ? AND userId = ?
  `).run(notificationId, userId);

  return result.changes > 0;
}

/**
 * Get user notification preferences
 */
export function getUserPreferences(userId) {
  let prefs = db.prepare(`
    SELECT * FROM user_notification_preferences WHERE userId = ?
  `).get(userId);

  // If no preferences exist, create default ones
  if (!prefs) {
    db.prepare(`
      INSERT INTO user_notification_preferences (userId, updatedAt)
      VALUES (?, ?)
    `).run(userId, new Date().toISOString());

    prefs = db.prepare(`
      SELECT * FROM user_notification_preferences WHERE userId = ?
    `).get(userId);
  }

  // Convert integers to booleans for frontend
  const booleanPrefs = {};
  for (const key in prefs) {
    if (key !== 'id' && key !== 'userId' && key !== 'updatedAt' && prefs[key] !== null) {
      booleanPrefs[key] = prefs[key] === 1;
    } else {
      booleanPrefs[key] = prefs[key];
    }
  }

  return booleanPrefs;
}

/**
 * Update user notification preferences
 */
export function updateUserPreferences(userId, preferences) {
  // Filter out system fields that shouldn't be updated
  const systemFields = ['id', 'userId', 'updatedAt'];
  const cleanPrefs = {};
  
  for (const key in preferences) {
    if (!systemFields.includes(key)) {
      cleanPrefs[key] = preferences[key];
    }
  }

  // Convert booleans to integers for SQLite
  const intPrefs = {};
  for (const key in cleanPrefs) {
    intPrefs[key] = cleanPrefs[key] ? 1 : 0;
  }

  // Check if preferences exist
  const existing = db.prepare(`
    SELECT id FROM user_notification_preferences WHERE userId = ?
  `).get(userId);

  if (existing) {
    // Build UPDATE query dynamically
    const fields = Object.keys(intPrefs).map(k => `${k} = ?`).join(', ');
    const values = Object.values(intPrefs);
    
    db.prepare(`
      UPDATE user_notification_preferences 
      SET ${fields}, updatedAt = ?
      WHERE userId = ?
    `).run(...values, new Date().toISOString(), userId);
  } else {
    // Create new preferences
    const fields = ['userId', ...Object.keys(intPrefs), 'updatedAt'];
    const placeholders = fields.map(() => '?').join(', ');
    const values = [userId, ...Object.values(intPrefs), new Date().toISOString()];

    db.prepare(`
      INSERT INTO user_notification_preferences (${fields.join(', ')})
      VALUES (${placeholders})
    `).run(...values);
  }

  return getUserPreferences(userId);
}
