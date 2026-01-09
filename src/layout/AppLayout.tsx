import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import Badge from "../components/common/Badge";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setUser } from "../app/authSlice";
import { hasSectionAccess } from "../utils/permissions";
import { useIdleTimeout } from "../hooks/useIdleTimeout";

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

  return (
    <div className="grid min-h-screen lg:grid-cols-[240px_1fr] bg-slate-50 text-slate-900">
      <aside className="flex flex-col gap-6 border-b border-slate-200 bg-slate-900 px-6 py-6 text-slate-50 lg:border-b-0 lg:border-r">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-300">{t("app.testSystem")}</div>
          <div className="text-lg font-semibold">{t("app.sevenGoldenGates")}</div>
        </div>
        <nav className="flex flex-wrap gap-2 lg:flex-col">
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
 {/*        <div className="rounded-xl bg-slate-800/60 p-4 text-xs text-slate-200">
          Data is stored in an embedded SQLite database. Start both API & client with{" "}
          <code className="rounded bg-slate-900 px-1 py-0.5">npm run dev</code>.
        </div> */}
      </aside>
      <div>
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
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


