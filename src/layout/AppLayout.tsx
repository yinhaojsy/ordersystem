import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setUser } from "../app/authSlice";

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const navItems = [
    { to: "/", labelKey: "nav.dashboard", end: true },
    { to: "/currencies", labelKey: "nav.currencies", roles: ["admin"] },
    { to: "/accounts", labelKey: "nav.accounts", roles: ["admin"] },
    { to: "/customers", labelKey: "nav.customers" },
    { to: "/users", labelKey: "nav.users", roles: ["admin"] },
    { to: "/roles", labelKey: "nav.roles", roles: ["admin"] },
    { to: "/orders", labelKey: "nav.orders" },
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
            .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
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
                  {t("common.logout") ?? "Logout"}
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


