/**
 * Utility functions for managing user-specific default handler preference for OTC orders
 * Stored in localStorage, not in database
 */

const STORAGE_KEY_PREFIX = "otc_default_handler_";

/**
 * Get the storage key for a specific user
 */
function getStorageKey(userId: number | null | undefined): string {
  if (!userId) {
    return `${STORAGE_KEY_PREFIX}anonymous`;
  }
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Save default handler preference for a user
 */
export function saveDefaultOtcHandler(userId: number | null | undefined, handlerId: number | string): void {
  if (typeof window === "undefined") return;
  
  const key = getStorageKey(userId);
  const handlerIdStr = String(handlerId);
  try {
    localStorage.setItem(key, handlerIdStr);
  } catch (error) {
    console.error("Failed to save default OTC handler preference:", error);
  }
}

/**
 * Get default handler preference for a user
 */
export function getDefaultOtcHandler(userId: number | null | undefined): string | null {
  if (typeof window === "undefined") return null;
  
  const key = getStorageKey(userId);
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error("Failed to get default OTC handler preference:", error);
    return null;
  }
}

/**
 * Clear default handler preference for a user
 */
export function clearDefaultOtcHandler(userId: number | null | undefined): void {
  if (typeof window === "undefined") return;
  
  const key = getStorageKey(userId);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear default OTC handler preference:", error);
  }
}
