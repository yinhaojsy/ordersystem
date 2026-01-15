import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import Badge from "../components/common/Badge";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setUser } from "../app/authSlice";
import { hasSectionAccess } from "../utils/permissions";
import { useIdleTimeout } from "../hooks/useIdleTimeout";
import { 
  useGetUnreadCountQuery, 
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  api
} from "../services/api";

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const notificationEventSourceRef = useRef<EventSource | null>(null);
  const [realtimeUnreadCount, setRealtimeUnreadCount] = useState(0);

  // Fetch notifications (no polling, SSE will handle real-time updates)
  const { data: unreadCountData, refetch: refetchUnreadCount } = useGetUnreadCountQuery(undefined, {
    skip: !user,
  });
  const { data: notificationsData, refetch: refetchNotifications } = useGetNotificationsQuery(
    { limit: 10, offset: 0 },
    { skip: !user || !isNotificationDropdownOpen }
  );
  const [markAsRead] = useMarkNotificationAsReadMutation();
  const [markAllAsRead] = useMarkAllNotificationsAsReadMutation();

  // Use realtime count from SSE if available, otherwise fall back to API data
  const unreadCount = realtimeUnreadCount;
  const notifications = notificationsData?.notifications || [];

  // Update realtime count when API data changes
  useEffect(() => {
    if (unreadCountData?.count !== undefined) {
      setRealtimeUnreadCount(unreadCountData.count);
    }
  }, [unreadCountData]);

  // Subscribe to notifications via Server-Sent Events (SSE)
  useEffect(() => {
    if (!user) {
      // Close existing connection if user logs out
      if (notificationEventSourceRef.current) {
        notificationEventSourceRef.current.close();
        notificationEventSourceRef.current = null;
      }
      return;
    }

    // Connect to notification SSE endpoint with userId as query param
    const notificationEventSource = new EventSource(`/api/notifications/subscribe?userId=${user.id}`);

    notificationEventSource.onopen = () => {
      console.log('Notification SSE: Connection opened');
    };

    notificationEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification') {
          console.log('New notification received:', data.notification);
          
          // Update count immediately in state
          setRealtimeUnreadCount(prev => prev + 1);
          
          // Invalidate cache to trigger refetch
          dispatch(api.util.invalidateTags([
            { type: 'Notification', id: 'LIST' },
            { type: 'Notification', id: 'UNREAD_COUNT' }
          ]));
        } else if (data.type === 'unreadCount') {
          // Initial unread count received
          setRealtimeUnreadCount(data.count);
          console.log('Initial unread count:', data.count);
        }
      } catch (error) {
        console.error('Error parsing notification SSE message:', error);
      }
    };

    notificationEventSource.onerror = (error) => {
      console.error('Notification SSE connection error:', error);
      notificationEventSource.close();
      notificationEventSourceRef.current = null;
    };

    notificationEventSourceRef.current = notificationEventSource;

    // Cleanup on unmount or user change
    return () => {
      if (notificationEventSourceRef.current) {
        notificationEventSourceRef.current.close();
        notificationEventSourceRef.current = null;
      }
    };
  }, [user, dispatch]);

  // Subscribe to role updates via Server-Sent Events (SSE)
  useEffect(() => {
    if (!user?.role) {
      // Close existing connection if user logs out
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      return;
    }

    // Reset reconnect attempts when user changes
    reconnectAttemptsRef.current = 0;

    const connectSSE = () => {
      // Don't reconnect if we've exceeded max attempts
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn('SSE: Max reconnection attempts reached. Stopping reconnection attempts.');
        return;
      }

      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Subscribe to role updates via SSE
      const eventSource = new EventSource(
        `/api/roles/subscribe?roleName=${encodeURIComponent(user.role)}`
      );

      eventSource.onopen = () => {
        console.log('SSE: Connection opened');
        reconnectAttemptsRef.current = 0; // Reset on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'forceLogout') {
            // Force logout immediately when server sends logout signal
            dispatch(setUser(null));
            navigate("/login", { replace: true });
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        
        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Increment reconnect attempts
        reconnectAttemptsRef.current += 1;

        // Only reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          console.log(`SSE: Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, delay);
        } else {
          console.warn('SSE: Max reconnection attempts reached. SSE disabled for this session.');
        }
      };

      eventSourceRef.current = eventSource;
    };

    // Initial connection
    connectSSE();

    // Cleanup on unmount or role change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
    };
  }, [user?.role, dispatch, navigate]);

  // Handle idle timeout - auto logout after 3 hours of inactivity
  const handleIdleTimeout = () => {
    dispatch(setUser(null));
    navigate("/login", { replace: true });
  };

  useIdleTimeout(handleIdleTimeout, !!user);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target as Node)) {
        setIsNotificationDropdownOpen(false);
      }
    };

    if (isNotificationDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isNotificationDropdownOpen]);

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (!notification.isRead) {
      await markAsRead(notification.id);
      // Decrease unread count immediately
      setRealtimeUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Navigate to action URL if provided
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setIsNotificationDropdownOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    // Reset unread count immediately
    setRealtimeUnreadCount(0);
  };

  const navItems: Array<{ to: string; labelKey: string; end?: boolean; section?: string; adminOnly?: boolean }> = [
    { to: "/", labelKey: "nav.dashboard", end: true, section: "dashboard" },
    { to: "/orders", labelKey: "nav.orders", section: "orders" },
    { to: "/expenses", labelKey: "nav.expenses", section: "expenses" },
    { to: "/transfers", labelKey: "nav.transfers", section: "transfers" },
    { to: "/customers", labelKey: "nav.customers", section: "customers" },
    { to: "/accounts", labelKey: "nav.accounts", section: "accounts" },
    { to: "/currencies", labelKey: "nav.currencies", section: "currencies" },
    { to: "/users", labelKey: "nav.users", section: "users" },
    { to: "/roles", labelKey: "nav.roles", section: "roles" },
    { to: "/tags", labelKey: "nav.tags", section: "tags" },
    { to: "/profit", labelKey: "nav.profit", section: "profit" },
    { to: "/approval-requests", labelKey: "nav.approvalRequests", section: "approval_requests" },
    { to: "/settings", labelKey: "nav.settings", adminOnly: true },
  ];

  const matched = navItems.find(item =>
    item.end
      ? pathname === item.to
      : pathname.startsWith(item.to) && item.to !== "/"
  );

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const logout = () => {
    dispatch(setUser(null));
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-5 h-5";
    
    switch (type) {
      case 'approval_approved':
        return (
          <svg className={`${iconClass} text-green-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'approval_rejected':
        return (
          <svg className={`${iconClass} text-red-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'approval_pending':
        return (
          <svg className={`${iconClass} text-amber-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'order_assigned':
      case 'order_unassigned':
        return (
          <svg className={`${iconClass} text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'order_created':
        return (
          <svg className={`${iconClass} text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'order_completed':
        return (
          <svg className={`${iconClass} text-green-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'order_deleted':
      case 'order_cancelled':
        return (
          <svg className={`${iconClass} text-red-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      default:
        return (
          <svg className={`${iconClass} text-slate-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatNotificationTime = (createdAt: string) => {
    const now = new Date();
    const notificationDate = new Date(createdAt);
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t("notifications.justNow") || "Just now";
    if (diffMins < 60) return `${diffMins} ${t("notifications.minutesAgo") || "min ago"}`;
    if (diffHours < 24) return `${diffHours} ${t("notifications.hoursAgo") || "hours ago"}`;
    if (diffDays < 7) return `${diffDays} ${t("notifications.daysAgo") || "days ago"}`;
    return notificationDate.toLocaleDateString();
  };

  return (
    <div className={`relative grid min-h-screen bg-slate-50 text-slate-900 transition-all duration-300 ${
      isSidebarCollapsed ? 'lg:grid-cols-[0_1fr]' : 'lg:grid-cols-[240px_1fr]'
    }`}>
      {/* Mobile Hamburger Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 bg-slate-900 text-slate-100 rounded-lg shadow-lg hover:bg-slate-800 transition-colors lg:hidden"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          {isMobileMenuOpen ? (
            <>
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </>
          ) : (
            <>
              <path d="M3 12h18" />
              <path d="M3 6h18" />
              <path d="M3 18h18" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile Menu Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Toggle Arrow Button - Fixed position, centered vertically (Desktop only) */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={`fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-8 h-24 bg-slate-800 hover:bg-slate-700 text-slate-100 shadow-lg transition-all duration-300 hidden lg:flex ${
          isSidebarCollapsed 
            ? 'left-0 rounded-r-lg border-l-0' 
            : 'left-[240px] -ml-px rounded-r-lg border-l-0'
        }`}
        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          className="w-5 h-5 transition-transform duration-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          {isSidebarCollapsed ? (
            <path d="M9 18l6-6-6-6" />
          ) : (
            <path d="M15 18l-6-6 6-6" />
          )}
        </svg>
      </button>

      <aside className={`fixed lg:relative top-0 left-0 h-full flex flex-col gap-6 border-b border-slate-200 bg-slate-900 text-slate-50 lg:border-b-0 lg:border-r transition-all duration-300 z-40 ${
        isSidebarCollapsed ? 'lg:w-0 lg:px-0 lg:overflow-visible lg:border-r-0' : 'px-6 py-6 overflow-hidden'
      } ${
        isMobileMenuOpen 
          ? 'w-64 translate-x-0' 
          : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className={`transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'}`}>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-300">{t("app.testSystem")}</div>
            <div className="text-lg font-semibold">{t("app.sevenGoldenGates")}</div>
          </div>
          <nav className="flex flex-wrap gap-2 lg:flex-col mt-6">
            {navItems
              .filter((item) => {
                // Admin-only items
                if (item.adminOnly) {
                  return user?.role === "admin";
                }
                // Section-based items
                if (item.section) {
                  return hasSectionAccess(user, item.section);
                }
                return true;
              })
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                      isActive
                        ? "bg-white text-slate-900 shadow-sm"
                        : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                    }`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
          </nav>
        </div>
 {/*        <div className="rounded-xl bg-slate-800/60 p-4 text-xs text-slate-200">
          Data is stored in an embedded SQLite database. Start both API & client with{" "}
          <code className="rounded bg-slate-900 px-1 py-0.5">npm run dev</code>.
        </div> */}
      </aside>
      <div>
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 lg:px-10 pt-16 lg:pt-4">
          <div>
   {/*          <p className="text-xs uppercase tracking-wide text-slate-500">
              FX Control Center
            </p> */}
            <h1 className="text-2xl font-semibold text-slate-900">
              {matched ? t(matched.labelKey) : t("common.operationsConsole")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeLanguage('en')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                i18n.language === 'en'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage('zh')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                i18n.language === 'zh'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              中文
            </button>
            {user && (
              <>
                {/* Notification Bell */}
                <div className="relative" ref={notificationDropdownRef}>
                  <button
                    onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                    className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Notifications"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {isNotificationDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {t("notifications.title") || "Notifications"}
                          {unreadCount > 0 && (
                            <span className="ml-2 text-xs text-slate-500">({unreadCount})</span>
                          )}
                        </h3>
                        <div className="flex items-center gap-3">
                          {unreadCount > 0 && (
                            <button
                              onClick={handleMarkAllAsRead}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {t("notifications.markAllRead") || "Mark all read"}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              navigate('/notification-preferences');
                              setIsNotificationDropdownOpen(false);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            title={t("notifications.preferences") || "Preferences"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Notification List */}
                      <div className="flex-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-slate-500">
                            {t("notifications.noNotifications") || "No notifications"}
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {notifications.map((notification) => (
                              <button
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                                  !notification.isRead ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 mt-1">
                                    {getNotificationIcon(notification.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm ${!notification.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                      {notification.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                      {notification.message}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                      {formatNotificationTime(notification.createdAt)}
                                    </p>
                                  </div>
                                  {!notification.isRead && (
                                    <div className="flex-shrink-0">
                                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-slate-200">
                          <button
                            onClick={() => {
                              navigate('/notifications');
                              setIsNotificationDropdownOpen(false);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            {t("notifications.viewAll") || "View all notifications"} →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-sm text-slate-600">{user.email} ({user.role})</div>
                <button
                  onClick={logout}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.logout")}
                </button>
              </>
            )}
          </div>
       {/*    <Badge tone="blue">Live data</Badge> */}
        </div>
        <main className="p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


