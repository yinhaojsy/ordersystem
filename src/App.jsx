import { useMemo, useState, useEffect } from "react";
import "./App.css";

const initialCurrencies = [
  {
    id: "cur-1",
    code: "USD",
    name: "US Dollar",
    baseRateBuy: 1.0,
    conversionRateBuy: 1.0,
    baseRateSell: 1.0,
    conversionRateSell: 1.0,
    active: true,
  },
  {
    id: "cur-2",
    code: "EUR",
    name: "Euro",
    baseRateBuy: 1.08,
    conversionRateBuy: 1.085,
    baseRateSell: 1.075,
    conversionRateSell: 1.08,
    active: true,
  },
  {
    id: "cur-3",
    code: "GBP",
    name: "British Pound",
    baseRateBuy: 1.25,
    conversionRateBuy: 1.255,
    baseRateSell: 1.245,
    conversionRateSell: 1.25,
    active: true,
  },
];

const initialUsers = [
  { id: "usr-1", name: "Alice", email: "alice@fx.com", role: "admin" },
  { id: "usr-2", name: "Ben", email: "ben@fx.com", role: "manager" },
  { id: "usr-3", name: "Cara", email: "cara@fx.com", role: "viewer" },
];

const initialCustomers = [
  {
    id: "cust-1",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1-555-0101",
  },
  {
    id: "cust-2",
    name: "Sophie Yang",
    email: "sophie@example.com",
    phone: "+1-555-0102",
  },
  {
    id: "cust-3",
    name: "Michael Chen",
    email: "michael@example.com",
    phone: "+1-555-0103",
  },
];

const initialOrders = [
  {
    id: "ord-1",
    customerId: "cust-1",
    customerName: "John Doe",
    fromCurrency: "USD",
    toCurrency: "EUR",
    amountBuy: 5400,
    amountSell: 5000,
    rate: 1.08,
    status: "pending",
    createdAt: "2025-01-05",
  },
  {
    id: "ord-2",
    customerId: "cust-2",
    customerName: "Sophie Yang",
    fromCurrency: "GBP",
    toCurrency: "USD",
    amountBuy: 4000,
    amountSell: 3200,
    rate: 1.25,
    status: "completed",
    createdAt: "2025-01-03",
  },
];

const initialRoles = [
  {
    id: "role-1",
    name: "admin",
    displayName: "Admin",
    permissions: {
      sections: [
        "dashboard",
        "currencies",
        "users",
        "customers",
        "roles",
        "transactions",
      ],
      actions: {
        createCustomer: true,
        createUser: true,
        createOrder: true,
        createCurrency: true,
        editCurrency: true,
        processOrder: true,
        cancelOrder: true,
        manageRoles: true,
      },
    },
  },
  {
    id: "role-2",
    name: "manager",
    displayName: "Manager",
    permissions: {
      sections: ["dashboard", "customers", "transactions"],
      actions: {
        createCustomer: true,
        createUser: false,
        createOrder: true,
        createCurrency: true,
        editCurrency: true,
        processOrder: true,
        cancelOrder: true,
        manageRoles: false,
      },
    },
  },
  {
    id: "role-3",
    name: "viewer",
    displayName: "Viewer",
    permissions: {
      sections: ["dashboard", "transactions"],
      actions: {
        createCustomer: false,
        createUser: false,
        createOrder: false,
        createCurrency: false,
        editCurrency: false,
        processOrder: false,
        cancelOrder: false,
        manageRoles: false,
      },
    },
  },
];

const translations = {
  en: {
    brand: "Seven Golden Gates",
    roleLabel: "Role",
    languageLabel: "Language",
    navDashboard: "Dashboard",
    navCurrencies: "Currency Assets",
    navUsers: "User Management",
    navCustomers: "Customer Management",
    navRoles: "Role Management",
    navTransactions: "All Transactions",
    dashboardTitle: "Dashboard",
    dashboardSubtitle: "Overview of orders and assets",
    statTotalOrders: "Total Orders",
    statPending: "Pending",
    statCompleted: "Completed",
    statCurrencies: "Currencies",
    recentOrders: "Recent Orders",
    tableCustomer: "Customer",
    tablePair: "Pair",
    tableAmountBuy: "Amount Buy",
    tableAmountSell: "Amount Sell",
    tableStatus: "Status",
    tableDate: "Date",
    tableAction: "Action",
    buttonProcess: "Process",
    buttonCancel: "Cancel",
    currencyAssetsTitle: "Currency Assets",
    currencyAssetsSubtitle:
      "Manage supported currencies and their rates against USDT",
    currenciesHeader: "Currencies",
    addCurrencyTitle: "Add Currency",
    warnCurrency: "Only admins/managers can add currencies.",
    labelCode: "Code",
    labelName: "Name",
    labelBaseRateBuy: "Base Rate Buy (vs USDT)",
    labelConversionRateBuy: "Conversion Rate Buy",
    labelBaseRateSell: "Base Rate Sell (vs USDT)",
    labelConversionRateSell: "Conversion Rate Sell",
    labelActive: "Active",
    labelInactive: "Inactive",
    addCurrencyButton: "Add Currency",
    tableBaseRateBuy: "Base Buy",
    tableConversionRateBuy: "Conv Buy",
    tableBaseRateSell: "Base Sell",
    tableConversionRateSell: "Conv Sell",
    buttonEdit: "Edit",
    buttonSave: "Save",
    buttonCancel: "Cancel",
    buttonToggleActive: "Toggle Active",
    userMgmtTitle: "User Management",
    userMgmtSubtitle: "Create users and assign roles",
    usersHeader: "Users",
    createUserTitle: "Create User",
    warnUser: "Only admins can add users.",
    labelEmail: "Email",
    labelRole: "Role",
    addUserButton: "Add User",
    customerMgmtTitle: "Customer Management",
    customerMgmtSubtitle: "Create and manage customer profiles",
    customersHeader: "Customers",
    createCustomerTitle: "Create Customer",
    warnCustomer: "Only admins/managers can add customers.",
    labelPhone: "Phone",
    addCustomerButton: "Add Customer",
    roleMgmtTitle: "Role Management",
    roleMgmtSubtitle: "Manage roles and their permissions",
    rolesHeader: "Roles",
    createRoleTitle: "Create Role",
    editRoleTitle: "Edit Role",
    warnRole: "Only admins can manage roles.",
    labelRoleName: "Role Name",
    labelDisplayName: "Display Name",
    labelPermissions: "Permissions",
    labelSections: "Sections Access",
    labelActions: "Actions",
    addRoleButton: "Add Role",
    updateRoleButton: "Update Role",
    sectionDashboard: "Dashboard",
    sectionCurrencies: "Currency Assets",
    sectionUsers: "User Management",
    sectionCustomers: "Customer Management",
    sectionRoles: "Role Management",
    sectionTransactions: "All Transactions",
    actionCreateCustomer: "Create Customer",
    actionCreateUser: "Create User",
    actionCreateOrder: "Create Order",
    actionCreateCurrency: "Create Currency",
    actionEditCurrency: "Edit Currency",
    actionProcessOrder: "Process Order",
    actionCancelOrder: "Cancel Order",
    actionManageRoles: "Manage Roles",
    transactionsTitle: "All Transactions",
    transactionsSubtitle: "View and add orders",
    ordersHeader: "Orders",
    newOrderTitle: "New Order",
    warnOrder: "Only admins/managers can add orders.",
    labelCustomerName: "Customer",
    labelFrom: "From",
    labelTo: "To",
    labelAmountBuy: "Amount Buy",
    labelAmountSell: "Amount Sell",
    labelRate: "Rate",
    createOrderButton: "Create Order",
    status: {
      pending: "pending",
      completed: "completed",
      cancelled: "cancelled",
    },
    roles: { admin: "admin", manager: "manager", viewer: "viewer" },
    placeholderCode: "e.g., CAD",
    placeholderCurrencyName: "Canadian Dollar",
    placeholderCustomer: "Customer name",
    placeholderAmount: "5000",
    placeholderRate: "1.10",
    placeholderFullName: "Full name",
    placeholderEmail: "name@company.com",
    selectCustomer: "-- Select Customer --",
  },
  zh: {
    brand: "Seven Golden Gates",
    roleLabel: "角色",
    languageLabel: "语言",
    navDashboard: "仪表盘",
    navCurrencies: "币种资产",
    navUsers: "用户管理",
    navCustomers: "客户管理",
    navRoles: "角色管理",
    navTransactions: "全部交易",
    dashboardTitle: "仪表盘",
    dashboardSubtitle: "订单与资产概览",
    statTotalOrders: "订单总数",
    statPending: "待处理",
    statCompleted: "已完成",
    statCurrencies: "币种数量",
    recentOrders: "最新订单",
    tableCustomer: "客户",
    tablePair: "货币对",
    tableAmountBuy: "买入金额",
    tableAmountSell: "卖出金额",
    tableStatus: "状态",
    tableDate: "日期",
    tableAction: "操作",
    buttonProcess: "处理",
    buttonCancel: "取消",
    currencyAssetsTitle: "币种资产",
    currencyAssetsSubtitle: "管理支持的币种及其对USDT的汇率",
    currenciesHeader: "币种列表",
    addCurrencyTitle: "新增币种",
    warnCurrency: "仅管理员或经理可新增币种。",
    labelCode: "代码",
    labelBaseRateBuy: "基础买入汇率（对USDT）",
    labelConversionRateBuy: "转换买入汇率",
    labelBaseRateSell: "基础卖出汇率（对USDT）",
    labelConversionRateSell: "转换卖出汇率",
    tableBaseRateBuy: "基础买入",
    tableConversionRateBuy: "转换买入",
    tableBaseRateSell: "基础卖出",
    tableConversionRateSell: "转换卖出",
    buttonEdit: "编辑",
    buttonSave: "保存",
    buttonCancel: "取消",
    buttonToggleActive: "切换状态",
    labelName: "名称",
    labelBaseRate: "基础汇率（对美元）",
    labelActive: "启用",
    labelInactive: "停用",
    addCurrencyButton: "添加币种",
    userMgmtTitle: "用户管理",
    userMgmtSubtitle: "创建用户并分配角色",
    usersHeader: "用户列表",
    createUserTitle: "创建用户",
    warnUser: "仅管理员可新增用户。",
    labelEmail: "邮箱",
    labelRole: "角色",
    addUserButton: "创建用户",
    customerMgmtTitle: "客户管理",
    customerMgmtSubtitle: "创建和管理客户档案",
    customersHeader: "客户列表",
    createCustomerTitle: "创建客户",
    warnCustomer: "仅管理员或经理可新增客户。",
    labelPhone: "电话",
    addCustomerButton: "创建客户",
    roleMgmtTitle: "角色管理",
    roleMgmtSubtitle: "管理角色及其权限",
    rolesHeader: "角色列表",
    createRoleTitle: "创建角色",
    editRoleTitle: "编辑角色",
    warnRole: "仅管理员可管理角色。",
    labelRoleName: "角色名称",
    labelDisplayName: "显示名称",
    labelPermissions: "权限",
    labelSections: "模块访问",
    labelActions: "操作权限",
    addRoleButton: "创建角色",
    updateRoleButton: "更新角色",
    sectionDashboard: "仪表盘",
    sectionCurrencies: "币种资产",
    sectionUsers: "用户管理",
    sectionCustomers: "客户管理",
    sectionRoles: "角色管理",
    sectionTransactions: "全部交易",
    actionCreateCustomer: "创建客户",
    actionCreateUser: "创建用户",
    actionCreateOrder: "创建订单",
    actionCreateCurrency: "创建币种",
    actionEditCurrency: "编辑币种",
    actionProcessOrder: "处理订单",
    actionCancelOrder: "取消订单",
    actionManageRoles: "管理角色",
    transactionsTitle: "全部交易",
    transactionsSubtitle: "查看并新增订单",
    ordersHeader: "订单列表",
    newOrderTitle: "新建订单",
    warnOrder: "仅管理员或经理可新增订单。",
    labelCustomerName: "客户",
    labelFrom: "卖出币种",
    labelTo: "买入币种",
    labelAmountBuy: "买入金额",
    labelAmountSell: "卖出金额",
    labelRate: "汇率",
    createOrderButton: "创建订单",
    status: { pending: "待处理", completed: "已完成", cancelled: "已取消" },
    roles: { admin: "管理员", manager: "经理", viewer: "查看者" },
    placeholderCode: "例如：CAD",
    placeholderCurrencyName: "加拿大元",
    placeholderCustomer: "客户名称",
    placeholderAmount: "5000",
    placeholderRate: "1.10",
    placeholderFullName: "姓名",
    placeholderEmail: "name@company.com",
    selectCustomer: "-- 选择客户 --",
  },
};

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function App() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [currencies, setCurrencies] = useState(initialCurrencies);
  const [users, setUsers] = useState(initialUsers);
  const [customers, setCustomers] = useState(initialCustomers);
  const [orders, setOrders] = useState(initialOrders);
  const [roles, setRoles] = useState(initialRoles);
  const [selectedRole, setSelectedRole] = useState("admin");
  const [lang, setLang] = useState("en");

  const copy = translations[lang];
  const statusLabel = (status) => copy.status[status] ?? status;

  // Get current role object
  const currentRole = roles.find((r) => r.name === selectedRole) || roles[0];

  // Permission helpers
  const hasSectionAccess = (section) => {
    return currentRole?.permissions?.sections?.includes(section) || false;
  };

  const hasActionPermission = (action) => {
    return currentRole?.permissions?.actions?.[action] || false;
  };

  const roleLabel = (roleName) => {
    const role = roles.find((r) => r.name === roleName);
    return role?.displayName || roleName;
  };

  // Legacy compatibility - check if admin or manager for existing code
  const isAdmin =
    selectedRole === "admin" || hasActionPermission("manageRoles");
  const canEdit =
    hasActionPermission("createOrder") || hasActionPermission("createCustomer");

  const [currencyForm, setCurrencyForm] = useState({
    code: "",
    name: "",
    baseRateBuy: "",
    conversionRateBuy: "",
    baseRateSell: "",
    conversionRateSell: "",
    active: true,
  });
  const [editingCurrencyId, setEditingCurrencyId] = useState(null);
  const [editCurrencyForm, setEditCurrencyForm] = useState(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "manager",
  });
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [roleForm, setRoleForm] = useState({
    name: "",
    displayName: "",
    sections: [],
    actions: {},
  });
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [orderForm, setOrderForm] = useState({
    customerId: "",
    fromCurrency: "USD",
    toCurrency: "EUR",
    amountBuy: "",
    amountSell: "",
    rate: "",
  });
  const [amountEditMode, setAmountEditMode] = useState(null); // 'buy', 'sell', or null

  // Auto-calculate amount when rate and one amount is provided
  useEffect(() => {
    const rate = parseFloat(orderForm.rate);
    const amountBuy = orderForm.amountBuy;
    const amountSell = orderForm.amountSell;

    // If both fields are empty, reset edit mode
    if (!amountBuy && !amountSell) {
      setAmountEditMode(null);
      return;
    }

    if (!rate || isNaN(rate) || rate <= 0) {
      return;
    }

    if (
      amountEditMode === "buy" &&
      amountBuy &&
      !isNaN(parseFloat(amountBuy))
    ) {
      // Calculate amountSell from amountBuy: amountSell = amountBuy * rate
      const calculatedSell = (parseFloat(amountBuy) * rate).toFixed(2);
      setOrderForm((prev) => {
        if (prev.amountSell !== calculatedSell) {
          return { ...prev, amountSell: calculatedSell };
        }
        return prev;
      });
    } else if (
      amountEditMode === "sell" &&
      amountSell &&
      !isNaN(parseFloat(amountSell))
    ) {
      // Calculate amountBuy from amountSell: amountBuy = amountSell / rate
      const calculatedBuy = (parseFloat(amountSell) / rate).toFixed(2);
      setOrderForm((prev) => {
        if (prev.amountBuy !== calculatedBuy) {
          return { ...prev, amountBuy: calculatedBuy };
        }
        return prev;
      });
    }
  }, [
    orderForm.rate,
    orderForm.amountBuy,
    orderForm.amountSell,
    amountEditMode,
  ]);

  const dashboardStats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    return {
      totalOrders: orders.length,
      pending,
      completed,
      currencies: currencies.length,
    };
  }, [orders, currencies.length]);

  const handleAddCurrency = (event) => {
    event.preventDefault();
    if (!hasActionPermission("createCurrency")) return;
    if (
      !currencyForm.code ||
      !currencyForm.name ||
      !currencyForm.baseRateBuy ||
      !currencyForm.conversionRateBuy ||
      !currencyForm.baseRateSell ||
      !currencyForm.conversionRateSell
    )
      return;
    setCurrencies((prev) => [
      ...prev,
      {
        id: `cur-${prev.length + 1}`,
        code: currencyForm.code.toUpperCase(),
        name: currencyForm.name,
        baseRateBuy: Number(currencyForm.baseRateBuy),
        conversionRateBuy: Number(currencyForm.conversionRateBuy),
        baseRateSell: Number(currencyForm.baseRateSell),
        conversionRateSell: Number(currencyForm.conversionRateSell),
        active: currencyForm.active,
      },
    ]);
    setCurrencyForm({
      code: "",
      name: "",
      baseRateBuy: "",
      conversionRateBuy: "",
      baseRateSell: "",
      conversionRateSell: "",
      active: true,
    });
  };

  const handleEditCurrency = (currency) => {
    if (!hasActionPermission("editCurrency")) return;
    setEditingCurrencyId(currency.id);
    setEditCurrencyForm({
      baseRateBuy: currency.baseRateBuy.toString(),
      conversionRateBuy: currency.conversionRateBuy.toString(),
      baseRateSell: currency.baseRateSell.toString(),
      conversionRateSell: currency.conversionRateSell.toString(),
      active: currency.active,
    });
  };

  const handleSaveCurrency = (currencyId) => {
    if (!hasActionPermission("editCurrency")) return;
    if (
      !editCurrencyForm.baseRateBuy ||
      !editCurrencyForm.conversionRateBuy ||
      !editCurrencyForm.baseRateSell ||
      !editCurrencyForm.conversionRateSell
    )
      return;
    setCurrencies((prev) =>
      prev.map((c) =>
        c.id === currencyId
          ? {
              ...c,
              baseRateBuy: Number(editCurrencyForm.baseRateBuy),
              conversionRateBuy: Number(editCurrencyForm.conversionRateBuy),
              baseRateSell: Number(editCurrencyForm.baseRateSell),
              conversionRateSell: Number(editCurrencyForm.conversionRateSell),
              active: editCurrencyForm.active,
            }
          : c
      )
    );
    setEditingCurrencyId(null);
    setEditCurrencyForm(null);
  };

  const handleCancelEditCurrency = () => {
    setEditingCurrencyId(null);
    setEditCurrencyForm(null);
  };

  const handleToggleCurrencyActive = (currencyId) => {
    if (!hasActionPermission("editCurrency")) return;
    setCurrencies((prev) =>
      prev.map((c) => (c.id === currencyId ? { ...c, active: !c.active } : c))
    );
  };

  const handleAddRole = (event) => {
    event.preventDefault();
    if (!hasActionPermission("manageRoles")) return;
    if (!roleForm.name || !roleForm.displayName) return;
    setRoles((prev) => [
      ...prev,
      {
        id: `role-${prev.length + 1}`,
        name: roleForm.name.toLowerCase(),
        displayName: roleForm.displayName,
        permissions: {
          sections: roleForm.sections,
          actions: roleForm.actions,
        },
      },
    ]);
    setRoleForm({
      name: "",
      displayName: "",
      sections: [],
      actions: {},
    });
  };

  const handleEditRole = (role) => {
    if (!hasActionPermission("manageRoles")) return;
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      displayName: role.displayName,
      sections: [...role.permissions.sections],
      actions: { ...role.permissions.actions },
    });
  };

  const handleUpdateRole = () => {
    if (!hasActionPermission("manageRoles")) return;
    if (!roleForm.name || !roleForm.displayName) return;
    setRoles((prev) =>
      prev.map((r) =>
        r.id === editingRoleId
          ? {
              ...r,
              name: roleForm.name.toLowerCase(),
              displayName: roleForm.displayName,
              permissions: {
                sections: roleForm.sections,
                actions: roleForm.actions,
              },
            }
          : r
      )
    );
    setEditingRoleId(null);
    setRoleForm({
      name: "",
      displayName: "",
      sections: [],
      actions: {},
    });
  };

  const handleCancelEditRole = () => {
    setEditingRoleId(null);
    setRoleForm({
      name: "",
      displayName: "",
      sections: [],
      actions: {},
    });
  };

  const toggleSection = (section) => {
    setRoleForm((prev) => ({
      ...prev,
      sections: prev.sections.includes(section)
        ? prev.sections.filter((s) => s !== section)
        : [...prev.sections, section],
    }));
  };

  const toggleAction = (action) => {
    setRoleForm((prev) => ({
      ...prev,
      actions: {
        ...prev.actions,
        [action]: !prev.actions[action],
      },
    }));
  };

  const handleAddUser = (event) => {
    event.preventDefault();
    if (!hasActionPermission("createUser")) return;
    if (!userForm.name || !userForm.email) return;
    setUsers((prev) => [
      ...prev,
      {
        id: `usr-${prev.length + 1}`,
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
      },
    ]);
    setUserForm({ name: "", email: "", role: "manager" });
  };

  const handleAddCustomer = (event) => {
    event.preventDefault();
    if (!hasActionPermission("createCustomer")) return;
    if (!customerForm.name || !customerForm.email) return;
    setCustomers((prev) => [
      ...prev,
      {
        id: `cust-${prev.length + 1}`,
        name: customerForm.name,
        email: customerForm.email,
        phone: customerForm.phone || "",
      },
    ]);
    setCustomerForm({ name: "", email: "", phone: "" });
  };

  const handleAddOrder = (event) => {
    event.preventDefault();
    if (!hasActionPermission("createOrder")) return;
    if (
      !orderForm.customerId ||
      !orderForm.amountBuy ||
      !orderForm.amountSell ||
      !orderForm.rate
    )
      return;
    const selectedCustomer = customers.find(
      (c) => c.id === orderForm.customerId
    );
    if (!selectedCustomer) return;
    setOrders((prev) => [
      ...prev,
      {
        id: `ord-${prev.length + 1}`,
        customerId: orderForm.customerId,
        customerName: selectedCustomer.name,
        fromCurrency: orderForm.fromCurrency,
        toCurrency: orderForm.toCurrency,
        amountBuy: Number(orderForm.amountBuy),
        amountSell: Number(orderForm.amountSell),
        rate: Number(orderForm.rate),
        status: "pending",
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setOrderForm({
      customerId: "",
      fromCurrency: "USD",
      toCurrency: "EUR",
      amountBuy: "",
      amountSell: "",
      rate: "",
    });
    setAmountEditMode(null);
  };

  const handleProcessOrder = (orderId) => {
    if (!hasActionPermission("processOrder")) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "completed" } : o))
    );
  };

  const handleCancelOrder = (orderId) => {
    if (!hasActionPermission("cancelOrder")) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
    );
  };

  const recentOrders = orders.slice(-5).reverse();

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h1>{copy.dashboardTitle}</h1>
                <p className="muted">{copy.dashboardSubtitle}</p>
              </div>
            </div>
            <div className="stats-grid">
              <StatCard
                label={copy.statTotalOrders}
                value={dashboardStats.totalOrders}
              />
              <StatCard
                label={copy.statPending}
                value={dashboardStats.pending}
              />
              <StatCard
                label={copy.statCompleted}
                value={dashboardStats.completed}
              />
              <StatCard
                label={copy.statCurrencies}
                value={dashboardStats.currencies}
              />
            </div>
            <div className="panel-subheader">
              <h2>{copy.recentOrders}</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.tableCustomer}</th>
                  <th>{copy.tablePair}</th>
                  <th>{copy.tableAmountBuy}</th>
                  <th>{copy.tableAmountSell}</th>
                  <th>{copy.tableStatus}</th>
                  <th>{copy.tableDate}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.customerName}</td>
                    <td>
                      {order.fromCurrency} → {order.toCurrency}
                    </td>
                    <td>${order.amountBuy.toLocaleString()}</td>
                    <td>${order.amountSell.toLocaleString()}</td>
                    <td>
                      <span className={`badge badge-${order.status}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td>{order.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "currencies":
        return (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h1>{copy.currencyAssetsTitle}</h1>
                <p className="muted">{copy.currencyAssetsSubtitle}</p>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <h2>{copy.currenciesHeader}</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{copy.labelCode}</th>
                      <th>{copy.labelName}</th>
                      <th>{copy.tableBaseRateBuy}</th>
                      <th>{copy.tableConversionRateBuy}</th>
                      <th>{copy.tableBaseRateSell}</th>
                      <th>{copy.tableConversionRateSell}</th>
                      <th>{copy.tableStatus}</th>
                      {hasActionPermission("editCurrency") && (
                        <th>{copy.tableAction}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {currencies.map((c) => (
                      <tr key={c.id}>
                        <td>{c.code}</td>
                        <td>{c.name}</td>
                        {editingCurrencyId === c.id ? (
                          <>
                            <td>
                              <input
                                type="number"
                                step="0.0001"
                                value={editCurrencyForm.baseRateBuy}
                                onChange={(e) =>
                                  setEditCurrencyForm({
                                    ...editCurrencyForm,
                                    baseRateBuy: e.target.value,
                                  })
                                }
                                style={{ width: "80px", padding: "4px" }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.0001"
                                value={editCurrencyForm.conversionRateBuy}
                                onChange={(e) =>
                                  setEditCurrencyForm({
                                    ...editCurrencyForm,
                                    conversionRateBuy: e.target.value,
                                  })
                                }
                                style={{ width: "80px", padding: "4px" }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.0001"
                                value={editCurrencyForm.baseRateSell}
                                onChange={(e) =>
                                  setEditCurrencyForm({
                                    ...editCurrencyForm,
                                    baseRateSell: e.target.value,
                                  })
                                }
                                style={{ width: "80px", padding: "4px" }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.0001"
                                value={editCurrencyForm.conversionRateSell}
                                onChange={(e) =>
                                  setEditCurrencyForm({
                                    ...editCurrencyForm,
                                    conversionRateSell: e.target.value,
                                  })
                                }
                                style={{ width: "80px", padding: "4px" }}
                              />
                            </td>
                            <td>
                              <label
                                className="checkbox"
                                style={{ flexDirection: "row", gap: "4px" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={editCurrencyForm.active}
                                  onChange={(e) =>
                                    setEditCurrencyForm({
                                      ...editCurrencyForm,
                                      active: e.target.checked,
                                    })
                                  }
                                />
                                <span style={{ fontSize: "0.85rem" }}>
                                  {editCurrencyForm.active
                                    ? copy.labelActive
                                    : copy.labelInactive}
                                </span>
                              </label>
                            </td>
                            {hasActionPermission("editCurrency") && (
                              <td>
                                <div className="action-buttons">
                                  <button
                                    className="btn-process"
                                    onClick={() => handleSaveCurrency(c.id)}
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "4px 8px",
                                    }}
                                  >
                                    {copy.buttonSave}
                                  </button>
                                  <button
                                    className="btn-cancel"
                                    onClick={handleCancelEditCurrency}
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "4px 8px",
                                    }}
                                  >
                                    {copy.buttonCancel}
                                  </button>
                                </div>
                              </td>
                            )}
                          </>
                        ) : (
                          <>
                            <td>{c.baseRateBuy}</td>
                            <td>{c.conversionRateBuy}</td>
                            <td>{c.baseRateSell}</td>
                            <td>{c.conversionRateSell}</td>
                            <td>
                              <span
                                className={`badge ${
                                  c.active ? "badge-active" : "badge-inactive"
                                }`}
                              >
                                {c.active
                                  ? copy.labelActive
                                  : copy.labelInactive}
                              </span>
                            </td>
                            {hasActionPermission("editCurrency") && (
                              <td>
                                <div className="action-buttons">
                                  <button
                                    className="btn-process"
                                    onClick={() => handleEditCurrency(c)}
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "4px 8px",
                                    }}
                                  >
                                    {copy.buttonEdit}
                                  </button>
                                  <button
                                    className="btn-cancel"
                                    onClick={() =>
                                      handleToggleCurrencyActive(c.id)
                                    }
                                    style={{
                                      fontSize: "0.85rem",
                                      padding: "4px 8px",
                                    }}
                                  >
                                    {copy.buttonToggleActive}
                                  </button>
                                </div>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-card">
                <h2>{copy.addCurrencyTitle}</h2>
                {!hasActionPermission("createCurrency") && (
                  <p className="warn">{copy.warnCurrency}</p>
                )}
                <form onSubmit={handleAddCurrency} className="form">
                  <label>
                    {copy.labelCode}
                    <input
                      value={currencyForm.code}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          code: e.target.value,
                        })
                      }
                      placeholder={copy.placeholderCode}
                    />
                  </label>
                  <label>
                    {copy.labelName}
                    <input
                      value={currencyForm.name}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          name: e.target.value,
                        })
                      }
                      placeholder={copy.placeholderCurrencyName}
                    />
                  </label>
                  <label>
                    {copy.labelBaseRateBuy}
                    <input
                      type="number"
                      step="0.0001"
                      value={currencyForm.baseRateBuy}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          baseRateBuy: e.target.value,
                        })
                      }
                      placeholder="1.08"
                    />
                  </label>
                  <label>
                    {copy.labelConversionRateBuy}
                    <input
                      type="number"
                      step="0.0001"
                      value={currencyForm.conversionRateBuy}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          conversionRateBuy: e.target.value,
                        })
                      }
                      placeholder="1.085"
                    />
                  </label>
                  <label>
                    {copy.labelBaseRateSell}
                    <input
                      type="number"
                      step="0.0001"
                      value={currencyForm.baseRateSell}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          baseRateSell: e.target.value,
                        })
                      }
                      placeholder="1.075"
                    />
                  </label>
                  <label>
                    {copy.labelConversionRateSell}
                    <input
                      type="number"
                      step="0.0001"
                      value={currencyForm.conversionRateSell}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          conversionRateSell: e.target.value,
                        })
                      }
                      placeholder="1.08"
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={currencyForm.active}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          active: e.target.checked,
                        })
                      }
                    />
                    {copy.labelActive}
                  </label>
                  <button
                    type="submit"
                    disabled={!hasActionPermission("createCurrency")}
                  >
                    {copy.addCurrencyButton}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      case "users":
        return (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h1>{copy.userMgmtTitle}</h1>
                <p className="muted">{copy.userMgmtSubtitle}</p>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <h2>{copy.usersHeader}</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{copy.labelName}</th>
                      <th>{copy.labelEmail}</th>
                      <th>{copy.labelRole}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className="badge badge-role">
                            {roleLabel(u.role)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-card">
                <h2>{copy.createUserTitle}</h2>
                {!isAdmin && <p className="warn">{copy.warnUser}</p>}
                <form onSubmit={handleAddUser} className="form">
                  <label>
                    {copy.labelName}
                    <input
                      value={userForm.name}
                      onChange={(e) =>
                        setUserForm({ ...userForm, name: e.target.value })
                      }
                      placeholder={copy.placeholderFullName}
                    />
                  </label>
                  <label>
                    {copy.labelEmail}
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) =>
                        setUserForm({ ...userForm, email: e.target.value })
                      }
                      placeholder={copy.placeholderEmail}
                    />
                  </label>
                  <label>
                    {copy.labelRole}
                    <select
                      value={userForm.role}
                      onChange={(e) =>
                        setUserForm({ ...userForm, role: e.target.value })
                      }
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={!hasActionPermission("createUser")}
                  >
                    {copy.addUserButton}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      case "customers":
        return (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h1>{copy.customerMgmtTitle}</h1>
                <p className="muted">{copy.customerMgmtSubtitle}</p>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <h2>{copy.customersHeader}</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{copy.labelName}</th>
                      <th>{copy.labelEmail}</th>
                      <th>{copy.labelPhone}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.email}</td>
                        <td>{c.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-card">
                <h2>{copy.createCustomerTitle}</h2>
                {!hasActionPermission("createCustomer") && (
                  <p className="warn">{copy.warnCustomer}</p>
                )}
                <form onSubmit={handleAddCustomer} className="form">
                  <label>
                    {copy.labelName}
                    <input
                      value={customerForm.name}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          name: e.target.value,
                        })
                      }
                      placeholder={copy.placeholderFullName}
                    />
                  </label>
                  <label>
                    {copy.labelEmail}
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          email: e.target.value,
                        })
                      }
                      placeholder={copy.placeholderEmail}
                    />
                  </label>
                  <label>
                    {copy.labelPhone}
                    <input
                      value={customerForm.phone}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          phone: e.target.value,
                        })
                      }
                      placeholder="+1-555-0100"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!hasActionPermission("createCustomer")}
                  >
                    {copy.addCustomerButton}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      case "roles":
        const allSections = [
          "dashboard",
          "currencies",
          "users",
          "customers",
          "roles",
          "transactions",
        ];
        const allActions = [
          "createCustomer",
          "createUser",
          "createOrder",
          "createCurrency",
          "editCurrency",
          "processOrder",
          "cancelOrder",
          "manageRoles",
        ];
        const sectionLabels = {
          dashboard: copy.sectionDashboard,
          currencies: copy.sectionCurrencies,
          users: copy.sectionUsers,
          customers: copy.sectionCustomers,
          roles: copy.sectionRoles,
          transactions: copy.sectionTransactions,
        };
        const actionLabels = {
          createCustomer: copy.actionCreateCustomer,
          createUser: copy.actionCreateUser,
          createOrder: copy.actionCreateOrder,
          createCurrency: copy.actionCreateCurrency,
          editCurrency: copy.actionEditCurrency,
          processOrder: copy.actionProcessOrder,
          cancelOrder: copy.actionCancelOrder,
          manageRoles: copy.actionManageRoles,
        };
        return (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h1>{copy.roleMgmtTitle}</h1>
                <p className="muted">{copy.roleMgmtSubtitle}</p>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <h2>{copy.rolesHeader}</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{copy.labelDisplayName}</th>
                      <th>{copy.labelSections}</th>
                      <th>{copy.labelActions}</th>
                      {hasActionPermission("manageRoles") && (
                        <th>{copy.tableAction}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r) => (
                      <tr key={r.id}>
                        <td>{r.displayName}</td>
                        <td>
                          {r.permissions.sections.length} {copy.labelSections}
                        </td>
                        <td>
                          {
                            Object.values(r.permissions.actions).filter(Boolean)
                              .length
                          }{" "}
                          {copy.labelActions}
                        </td>
                        {hasActionPermission("manageRoles") && (
                          <td>
                            <button
                              className="btn-process"
                              onClick={() => handleEditRole(r)}
                              style={{
                                fontSize: "0.85rem",
                                padding: "4px 8px",
                              }}
                            >
                              {copy.buttonEdit}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-card">
                <h2>
                  {editingRoleId ? copy.editRoleTitle : copy.createRoleTitle}
                </h2>
                {!hasActionPermission("manageRoles") && (
                  <p className="warn">{copy.warnRole}</p>
                )}
                {editingRoleId ? (
                  <div className="form">
                    <label>
                      {copy.labelRoleName}
                      <input
                        value={roleForm.name}
                        onChange={(e) =>
                          setRoleForm({ ...roleForm, name: e.target.value })
                        }
                        disabled
                        placeholder="admin"
                      />
                    </label>
                    <label>
                      {copy.labelDisplayName}
                      <input
                        value={roleForm.displayName}
                        onChange={(e) =>
                          setRoleForm({
                            ...roleForm,
                            displayName: e.target.value,
                          })
                        }
                        placeholder="Admin"
                      />
                    </label>
                    <div>
                      <label style={{ marginBottom: "8px", display: "block" }}>
                        {copy.labelSections}
                      </label>
                      {allSections.map((section) => (
                        <label key={section} className="checkbox">
                          <input
                            type="checkbox"
                            checked={roleForm.sections.includes(section)}
                            onChange={() => toggleSection(section)}
                          />
                          {sectionLabels[section]}
                        </label>
                      ))}
                    </div>
                    <div>
                      <label style={{ marginBottom: "8px", display: "block" }}>
                        {copy.labelActions}
                      </label>
                      {allActions.map((action) => (
                        <label key={action} className="checkbox">
                          <input
                            type="checkbox"
                            checked={roleForm.actions[action] || false}
                            onChange={() => toggleAction(action)}
                          />
                          {actionLabels[action]}
                        </label>
                      ))}
                    </div>
                    <div className="action-buttons">
                      <button
                        className="btn-process"
                        onClick={handleUpdateRole}
                        disabled={!hasActionPermission("manageRoles")}
                      >
                        {copy.updateRoleButton}
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={handleCancelEditRole}
                      >
                        {copy.buttonCancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAddRole} className="form">
                    <label>
                      {copy.labelRoleName}
                      <input
                        value={roleForm.name}
                        onChange={(e) =>
                          setRoleForm({ ...roleForm, name: e.target.value })
                        }
                        placeholder="admin"
                      />
                    </label>
                    <label>
                      {copy.labelDisplayName}
                      <input
                        value={roleForm.displayName}
                        onChange={(e) =>
                          setRoleForm({
                            ...roleForm,
                            displayName: e.target.value,
                          })
                        }
                        placeholder="Admin"
                      />
                    </label>
                    <div>
                      <label style={{ marginBottom: "8px", display: "block" }}>
                        {copy.labelSections}
                      </label>
                      {allSections.map((section) => (
                        <label key={section} className="checkbox">
                          <input
                            type="checkbox"
                            checked={roleForm.sections.includes(section)}
                            onChange={() => toggleSection(section)}
                          />
                          {sectionLabels[section]}
                        </label>
                      ))}
                    </div>
                    <div>
                      <label style={{ marginBottom: "8px", display: "block" }}>
                        {copy.labelActions}
                      </label>
                      {allActions.map((action) => (
                        <label key={action} className="checkbox">
                          <input
                            type="checkbox"
                            checked={roleForm.actions[action] || false}
                            onChange={() => toggleAction(action)}
                          />
                          {actionLabels[action]}
                        </label>
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={!hasActionPermission("manageRoles")}
                    >
                      {copy.addRoleButton}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      case "transactions":
        return (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h1>{copy.transactionsTitle}</h1>
                <p className="muted">{copy.transactionsSubtitle}</p>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <h2>{copy.ordersHeader}</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{copy.tableCustomer}</th>
                      <th>{copy.tablePair}</th>
                      <th>{copy.tableAmountBuy}</th>
                      <th>{copy.tableAmountSell}</th>
                      <th>{copy.labelRate}</th>
                      <th>{copy.tableStatus}</th>
                      <th>{copy.tableDate}</th>
                      <th>{copy.tableAction}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.customerName}</td>
                        <td>
                          {o.fromCurrency} → {o.toCurrency}
                        </td>
                        <td>${o.amountBuy.toLocaleString()}</td>
                        <td>${o.amountSell.toLocaleString()}</td>
                        <td>{o.rate}</td>
                        <td>
                          <span className={`badge badge-${o.status}`}>
                            {statusLabel(o.status)}
                          </span>
                        </td>
                        <td>{o.createdAt}</td>
                        <td>
                          {o.status === "pending" &&
                            hasActionPermission("processOrder") && (
                              <div className="action-buttons">
                                <button
                                  className="btn-process"
                                  onClick={() => handleProcessOrder(o.id)}
                                >
                                  {copy.buttonProcess}
                                </button>
                                <button
                                  className="btn-cancel"
                                  onClick={() => handleCancelOrder(o.id)}
                                >
                                  {copy.buttonCancel}
                                </button>
                              </div>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-card">
                <h2>{copy.newOrderTitle}</h2>
                {!hasActionPermission("createOrder") && (
                  <p className="warn">{copy.warnOrder}</p>
                )}
                <form onSubmit={handleAddOrder} className="form">
                  <label>
                    {copy.labelCustomerName}
                    <select
                      value={orderForm.customerId}
                      onChange={(e) =>
                        setOrderForm({
                          ...orderForm,
                          customerId: e.target.value,
                        })
                      }
                    >
                      <option value="">{copy.selectCustomer}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="split">
                    <label>
                      {copy.labelFrom}
                      <select
                        value={orderForm.fromCurrency}
                        onChange={(e) =>
                          setOrderForm({
                            ...orderForm,
                            fromCurrency: e.target.value,
                          })
                        }
                      >
                        {currencies
                          .filter((c) => c.active)
                          .map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      {copy.labelTo}
                      <select
                        value={orderForm.toCurrency}
                        onChange={(e) =>
                          setOrderForm({
                            ...orderForm,
                            toCurrency: e.target.value,
                          })
                        }
                      >
                        {currencies
                          .filter((c) => c.active)
                          .map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {copy.labelRate}
                    <input
                      type="number"
                      step="0.0001"
                      value={orderForm.rate}
                      onChange={(e) => {
                        setOrderForm({ ...orderForm, rate: e.target.value });
                        // Recalculation will happen automatically via useEffect
                      }}
                      placeholder={copy.placeholderRate}
                    />
                  </label>
                  <div className="split">
                    <label>
                      {copy.labelAmountBuy}
                      <input
                        type="number"
                        value={orderForm.amountBuy}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!amountEditMode || amountEditMode === "buy") {
                            const newEditMode = value ? "buy" : null;
                            setAmountEditMode(newEditMode);
                            setOrderForm({
                              ...orderForm,
                              amountBuy: value,
                              // Clear calculated field when clearing this field
                              amountSell: value ? orderForm.amountSell : "",
                            });
                          }
                        }}
                        onFocus={() => {
                          if (amountEditMode !== "sell") {
                            setAmountEditMode(
                              orderForm.amountBuy ? "buy" : null
                            );
                          }
                        }}
                        readOnly={amountEditMode === "sell"}
                        placeholder={copy.placeholderAmount}
                        style={{
                          backgroundColor:
                            amountEditMode === "sell" ? "#f1f5f9" : "#fff",
                          cursor:
                            amountEditMode === "sell" ? "not-allowed" : "text",
                        }}
                      />
                    </label>
                    <label>
                      {copy.labelAmountSell}
                      <input
                        type="number"
                        value={orderForm.amountSell}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!amountEditMode || amountEditMode === "sell") {
                            const newEditMode = value ? "sell" : null;
                            setAmountEditMode(newEditMode);
                            setOrderForm({
                              ...orderForm,
                              amountSell: value,
                              // Clear calculated field when clearing this field
                              amountBuy: value ? orderForm.amountBuy : "",
                            });
                          }
                        }}
                        onFocus={() => {
                          if (amountEditMode !== "buy") {
                            setAmountEditMode(
                              orderForm.amountSell ? "sell" : null
                            );
                          }
                        }}
                        readOnly={amountEditMode === "buy"}
                        placeholder={copy.placeholderAmount}
                        style={{
                          backgroundColor:
                            amountEditMode === "buy" ? "#f1f5f9" : "#fff",
                          cursor:
                            amountEditMode === "buy" ? "not-allowed" : "text",
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!hasActionPermission("createOrder")}
                  >
                    {copy.createOrderButton}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">{copy.brand}</div>
        <div className="role">
          <label>{copy.roleLabel}</label>
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              // Reset to dashboard if current section is not accessible
              const newRole = roles.find((r) => r.name === e.target.value);
              if (
                newRole &&
                !newRole.permissions.sections.includes(activeSection)
              ) {
                setActiveSection("dashboard");
              }
            }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.displayName}
              </option>
            ))}
          </select>
        </div>
        <nav>
          <button
            className={activeSection === "dashboard" ? "nav active" : "nav"}
            onClick={() => setActiveSection("dashboard")}
          >
            {copy.navDashboard}
          </button>
          <button
            className={activeSection === "currencies" ? "nav active" : "nav"}
            onClick={() => setActiveSection("currencies")}
          >
            {copy.navCurrencies}
          </button>
          <button
            className={activeSection === "users" ? "nav active" : "nav"}
            onClick={() => setActiveSection("users")}
          >
            {copy.navUsers}
          </button>
          <button
            className={activeSection === "customers" ? "nav active" : "nav"}
            onClick={() => setActiveSection("customers")}
          >
            {copy.navCustomers}
          </button>
          <button
            className={activeSection === "transactions" ? "nav active" : "nav"}
            onClick={() => setActiveSection("transactions")}
          >
            {copy.navTransactions}
          </button>
        </nav>
      </aside>
      <main className="content">
        <div className="topbar">
          <div className="topbar-control">
            <label>{copy.languageLabel}</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </div>
        </div>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
