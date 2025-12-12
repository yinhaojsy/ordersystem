import { NavLink, Outlet, useLocation } from "react-router-dom";
import Badge from "../components/common/Badge";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/currencies", label: "Currencies" },
  { to: "/customers", label: "Customers" },
  { to: "/users", label: "Users" },
  { to: "/roles", label: "Roles" },
  { to: "/orders", label: "Orders" },
];

export default function AppLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const matched = navItems.find(item =>
    item.end
      ? pathname === item.to
      : pathname.startsWith(item.to) && item.to !== "/"
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-[240px_1fr] bg-slate-50 text-slate-900">
      <aside className="flex flex-col gap-6 border-b border-slate-200 bg-slate-900 px-6 py-6 text-slate-50 lg:border-b-0 lg:border-r">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-300">Test System</div>
          <div className="text-lg font-semibold">Seven Golden Gates</div>
        </div>
        <nav className="flex flex-wrap gap-2 lg:flex-col">
          {navItems.map((item) => (
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
              {item.label}
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
              {matched ? matched.label : "Operations Console"}
            </h1>
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


