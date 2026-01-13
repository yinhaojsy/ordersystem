/**
 * Extract user ID from X-User-Id header
 * @param {Object} req - Express request object
 * @returns {number|null} - User ID or null if not present/invalid
 */
export function getUserIdFromHeader(req) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return null;
  }
  
  const parsed = parseInt(userId, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  
  return parsed;
}
