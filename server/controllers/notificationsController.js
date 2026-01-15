import * as notificationService from '../services/notification/notificationService.js';
import { getUserIdFromHeader } from '../utils/auth.js';

// Store active SSE connections by userId: Map<userId, Set<res>>
const sseConnections = new Map();

/**
 * Broadcast notification to a specific user via SSE
 */
export const broadcastNotification = (userId, notification) => {
  const connections = sseConnections.get(userId);
  if (connections && connections.size > 0) {
    const message = JSON.stringify({ 
      type: 'notification', 
      notification,
      timestamp: Date.now() 
    });
    connections.forEach((res) => {
      try {
        res.write(`data: ${message}\n\n`);
      } catch (error) {
        // Connection closed, remove it
        connections.delete(res);
      }
    });
  }
};

/**
 * SSE endpoint for notification subscription
 */
export const subscribeToNotifications = (req, res, next) => {
  try {
    // Get userId from query parameter (EventSource doesn't support custom headers)
    const userId = parseInt(req.query.userId, 10);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ message: 'User ID is required' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Store this connection
    if (!sseConnections.has(userId)) {
      sseConnections.set(userId, new Set());
    }
    sseConnections.get(userId).add(res);

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Send current unread count
    const unreadCount = notificationService.getUnreadCount(userId);
    res.write(`data: ${JSON.stringify({ type: 'unreadCount', count: unreadCount })}\n\n`);

    // Send periodic heartbeat to keep connection alive (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
      } catch (error) {
        // Connection closed, stop heartbeat
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      const connections = sseConnections.get(userId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          sseConnections.delete(userId);
        }
      }
    });

    // Handle request timeout (5 minutes)
    req.setTimeout(300000, () => {
      clearInterval(heartbeatInterval);
      const connections = sseConnections.get(userId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          sseConnections.delete(userId);
        }
      }
      try {
        res.end();
      } catch (error) {
        // Connection already closed
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's notifications
 */
export const getNotifications = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID is required' });
    }
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const notifications = notificationService.getUserNotifications(userId, limit, offset);

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID is required' });
    }
    const count = notificationService.getUnreadCount(userId);

    res.json({ count });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID is required' });
    }
    const notificationId = parseInt(req.params.id);

    const success = notificationService.markAsRead(notificationId, userId);

    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID is required' });
    }
    const count = notificationService.markAllAsRead(userId);

    res.json({ success: true, count, message: `${count} notification(s) marked as read` });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notification
 */
export const deleteNotification = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID is required' });
    }
    const notificationId = parseInt(req.params.id);

    const success = notificationService.deleteNotification(notificationId, userId);

    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user notification preferences
 */
export const getPreferences = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID is required' });
    }
    const preferences = notificationService.getUserPreferences(userId);

    res.json({ preferences });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user notification preferences
 */
export const updatePreferences = (req, res, next) => {
  try {
    const userId = getUserIdFromHeader(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID is required' });
    }
    const preferences = req.body;

    const updated = notificationService.updateUserPreferences(userId, preferences);

    res.json({ success: true, preferences: updated });
  } catch (error) {
    next(error);
  }
};

// Initialize broadcast function in notification service to avoid circular dependency
notificationService.setBroadcastFunction(broadcastNotification);
