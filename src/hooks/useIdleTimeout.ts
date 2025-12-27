import { useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keypress",
  "scroll",
  "touchstart",
  "click",
] as const;

/**
 * Custom hook to handle idle timeout and auto-logout
 * Tracks user activity and automatically logs out after 3 hours of inactivity
 * 
 * @param onIdle - Callback function to execute when idle timeout is reached
 * @param isEnabled - Whether the idle timeout is enabled (typically when user is logged in)
 */
export function useIdleTimeout(
  onIdle: () => void,
  isEnabled: boolean = true
) {
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Reset the idle timer
  const resetTimer = useCallback(() => {
    if (!isEnabled) return;

    // Clear existing timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    // Update last activity time
    lastActivityRef.current = Date.now();

    // Set new timeout
    timeoutIdRef.current = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      
      // Double-check that we're still idle (account for clock changes)
      if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
        onIdle();
      }
    }, IDLE_TIMEOUT_MS);
  }, [onIdle, isEnabled]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!isEnabled) {
      // Clear timeout if disabled
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      return;
    }

    // Set initial timeout
    resetTimer();

    // Add event listeners for user activity
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, true);
    });

    // Also check when the window becomes visible (in case user switched tabs)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Check if we've been idle too long while tab was hidden
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
          onIdle();
        } else {
          resetTimer();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity, true);
      });
      
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isEnabled, handleActivity, resetTimer, onIdle]);

  // Return function to manually reset the timer (useful for API calls)
  return { resetTimer };
}

