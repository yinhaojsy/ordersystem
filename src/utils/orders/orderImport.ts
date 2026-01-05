import * as XLSX from "xlsx";
import type { OrderStatus, Order, Customer, User, Currency, Account, Tag } from "../../types";

export interface ImportOrderData {
  customerId: number;
  handlerId: number;
  fromCurrency: string;
  toCurrency: string;
  amountBuy: number;
  amountSell: number;
  rate: number;
  status: OrderStatus;
  orderType: "online" | "otc";
  buyAccountId: number;
  sellAccountId: number;
  tagIds: number[];
  profitAmount?: number | null;
  profitCurrency?: string | null;
  profitAccountId?: number | null;
  serviceChargeAmount?: number | null;
  serviceChargeCurrency?: string | null;
  serviceChargeAccountId?: number | null;
}

export interface ImportValidationResult {
  success: boolean;
  errors: string[];
  orderData?: ImportOrderData;
}

/**
 * Validates and parses a single order row from Excel import
 */
export function validateAndParseOrderRow(
  row: any,
  rowNumber: number,
  customerMap: Map<string, number>,
  userMap: Map<string, number>,
  activeCurrencyCodes: Set<string>,
  currencyPairSet: Set<string>,
  tagNameToId: Map<string, number>,
  accountNameToAccount: Map<string, Account>,
  existingOrderIds: Set<string>,
  seenOrderIds: Set<string>
): ImportValidationResult {
  const errors: string[] = [];

  // Validate Order ID uniqueness
  const orderIdRaw = String(row["Order ID"] || row["Order Id"] || row["orderId"] || "").trim();
  if (!orderIdRaw) {
    errors.push(`Row ${rowNumber}: Order ID is required`);
    return { success: false, errors };
  }
  const normalizedOrderId = orderIdRaw.toLowerCase();
  if (existingOrderIds.has(normalizedOrderId)) {
    errors.push(`Row ${rowNumber}: Order ID "${orderIdRaw}" already exists`);
    return { success: false, errors };
  }
  if (seenOrderIds.has(normalizedOrderId)) {
    errors.push(`Row ${rowNumber}: Order ID "${orderIdRaw}" is duplicated in the file`);
    return { success: false, errors };
  }

  // Find customer by name
  const customerName = String(row["Customer"] || row["customer"] || "").trim();
  const customerId = customerMap.get(customerName.toLowerCase());
  if (!customerId) {
    errors.push(`Row ${rowNumber}: Customer "${customerName || "?"}" not found`);
    return { success: false, errors };
  }

  // Find handler by name (required)
  const handlerName = String(row["Handler"] || row["handler"] || "").trim();
  if (!handlerName) {
    errors.push(`Row ${rowNumber}: Handler is required`);
    return { success: false, errors };
  }
  const handlerId = userMap.get(handlerName.toLowerCase());
  if (!handlerId) {
    errors.push(`Row ${rowNumber}: Handler "${handlerName}" not found`);
    return { success: false, errors };
  }

  // Parse currency pair
  const currencyPair = String(row["Currency Pair"] || row["currencyPair"] || "").trim();
  const [fromCurrencyRaw, toCurrencyRaw] = currencyPair.split("/").map((c) => c.trim());
  const fromCurrency = fromCurrencyRaw?.toUpperCase() || "";
  const toCurrency = toCurrencyRaw?.toUpperCase() || "";
  if (!fromCurrency || !toCurrency) {
    errors.push(`Row ${rowNumber}: Invalid currency pair "${currencyPair}"`);
    return { success: false, errors };
  }
  if (!activeCurrencyCodes.has(fromCurrency) || !activeCurrencyCodes.has(toCurrency)) {
    errors.push(`Row ${rowNumber}: Currency pair uses unknown currencies (${fromCurrency}/${toCurrency})`);
    return { success: false, errors };
  }
  const normalizedPair = `${fromCurrency}/${toCurrency}`;
  if (!currencyPairSet.has(normalizedPair)) {
    errors.push(`Row ${rowNumber}: Currency pair "${normalizedPair}" is not allowed`);
    return { success: false, errors };
  }

  // Parse amounts and rate
  const amountBuy = parseFloat(row["Amount Buy"] || row["amountBuy"] || "0");
  const amountSell = parseFloat(row["Amount Sell"] || row["amountSell"] || "0");
  const rate = parseFloat(row["Rate"] || row["rate"] || "0");

  if (!amountBuy || !amountSell || !rate) {
    errors.push(`Row ${rowNumber}: Missing required fields (Amount Buy, Amount Sell, or Rate)`);
    return { success: false, errors };
  }

  // Parse required accounts
  const buyAccountName = String(row["Buy Account"] || row["buyAccount"] || "").trim();
  if (!buyAccountName) {
    errors.push(`Row ${rowNumber}: Buy Account is required`);
    return { success: false, errors };
  }
  const buyAccount = accountNameToAccount.get(buyAccountName.toLowerCase());
  if (!buyAccount) {
    errors.push(`Row ${rowNumber}: Buy Account "${buyAccountName}" not found`);
    return { success: false, errors };
  }
  if ((buyAccount.currencyCode || "").toUpperCase() !== fromCurrency) {
    errors.push(
      `Row ${rowNumber}: Buy Account "${buyAccountName}" currency (${buyAccount.currencyCode}) does not match fromCurrency (${fromCurrency})`
    );
    return { success: false, errors };
  }

  const sellAccountName = String(row["Sell Account"] || row["sellAccount"] || "").trim();
  if (!sellAccountName) {
    errors.push(`Row ${rowNumber}: Sell Account is required`);
    return { success: false, errors };
  }
  const sellAccount = accountNameToAccount.get(sellAccountName.toLowerCase());
  if (!sellAccount) {
    errors.push(`Row ${rowNumber}: Sell Account "${sellAccountName}" not found`);
    return { success: false, errors };
  }
  if ((sellAccount.currencyCode || "").toUpperCase() !== toCurrency) {
    errors.push(
      `Row ${rowNumber}: Sell Account "${sellAccountName}" currency (${sellAccount.currencyCode}) does not match toCurrency (${toCurrency})`
    );
    return { success: false, errors };
  }

  // Parse optional profit
  const profitAmountRaw = row["Profit Amount"] ?? row["profitAmount"];
  const profitAmount =
    profitAmountRaw === undefined || profitAmountRaw === null || String(profitAmountRaw).trim() === ""
      ? null
      : parseFloat(profitAmountRaw);
  const profitCurrencyRaw = String(row["Profit Currency"] || row["profitCurrency"] || "").trim();
  const profitCurrency = profitCurrencyRaw ? profitCurrencyRaw.toUpperCase() : "";
  const profitAccountName = String(row["Profit Account"] || row["profitAccount"] || "").trim();
  if (profitAmount !== null && Number.isNaN(profitAmount)) {
    errors.push(`Row ${rowNumber}: Profit Amount is invalid`);
    return { success: false, errors };
  }
  if (
    (profitAmount !== null && (!profitAccountName || !profitCurrency)) ||
    (profitAmount === null && (profitAccountName || profitCurrency))
  ) {
    errors.push(`Row ${rowNumber}: Profit amount, currency, and account must all be provided or all be empty`);
    return { success: false, errors };
  }
  const profitAccount =
    profitAmount !== null || profitAccountName ? accountNameToAccount.get(profitAccountName.toLowerCase()) : null;
  if (profitAccountName && !profitAccount) {
    errors.push(`Row ${rowNumber}: Profit Account "${profitAccountName}" not found`);
    return { success: false, errors };
  }
  if (profitAccount && profitCurrency && (profitAccount.currencyCode || "").toUpperCase() !== profitCurrency) {
    errors.push(
      `Row ${rowNumber}: Profit Account "${profitAccountName}" currency (${profitAccount.currencyCode}) must match profit currency (${profitCurrency})`
    );
    return { success: false, errors };
  }

  // Parse optional service charges
  const serviceChargeAmountRaw = row["Service Charges Amount"] ?? row["Service Charge Amount"] ?? row["serviceChargeAmount"];
  const serviceChargeAmount =
    serviceChargeAmountRaw === undefined ||
    serviceChargeAmountRaw === null ||
    String(serviceChargeAmountRaw).trim() === ""
      ? null
      : parseFloat(serviceChargeAmountRaw);
  const serviceChargeCurrencyRaw = String(
    row["Service Charges Currency"] || row["Service Charge Currency"] || row["serviceChargeCurrency"] || ""
  ).trim();
  const serviceChargeCurrency = serviceChargeCurrencyRaw ? serviceChargeCurrencyRaw.toUpperCase() : "";
  const serviceChargeAccountName = String(
    row["Service Charges Account"] || row["Service Charge Account"] || row["serviceChargeAccount"] || ""
  ).trim();
  if (serviceChargeAmount !== null && Number.isNaN(serviceChargeAmount)) {
    errors.push(`Row ${rowNumber}: Service Charges Amount is invalid`);
    return { success: false, errors };
  }
  if ((serviceChargeAmount !== null && !serviceChargeAccountName) || (serviceChargeAmount === null && serviceChargeAccountName)) {
    errors.push(
      `Row ${rowNumber}: Service charges amount, currency, and account must all be provided or all be empty`
    );
    return { success: false, errors };
  }
  const serviceChargeAccount =
    serviceChargeAmount !== null || serviceChargeAccountName
      ? accountNameToAccount.get(serviceChargeAccountName.toLowerCase())
      : null;
  if (serviceChargeAccountName && !serviceChargeAccount) {
    errors.push(`Row ${rowNumber}: Service Charges Account "${serviceChargeAccountName}" not found`);
    return { success: false, errors };
  }
  if (serviceChargeAccount && serviceChargeCurrency && (serviceChargeAccount.currencyCode || "").toUpperCase() !== serviceChargeCurrency) {
    errors.push(
      `Row ${rowNumber}: Service Charges Account "${serviceChargeAccountName}" currency (${serviceChargeAccount.currencyCode}) must match service charges currency (${serviceChargeCurrency})`
    );
    return { success: false, errors };
  }

  // Parse status
  const statusStr = String(row["Status"] || row["status"] || "").trim().toLowerCase();
  if (statusStr !== "completed") {
    errors.push(`Row ${rowNumber}: Status must be "completed"`);
    return { success: false, errors };
  }
  const status: OrderStatus = "completed";

  // Parse order type
  const orderTypeStr = String(row["Order Type"] || row["OrderType"] || row["orderType"] || "").trim().toLowerCase();
  if (orderTypeStr !== "online" && orderTypeStr !== "otc") {
    errors.push(`Row ${rowNumber}: Order Type must be "online" or "otc"`);
    return { success: false, errors };
  }
  const orderType = orderTypeStr as "online" | "otc";

  // Parse tags (optional) and validate existence
  const rawTags = row["Tags"] ?? row["tags"];
  const tagIds: number[] = [];
  if (rawTags !== undefined && rawTags !== null && String(rawTags).trim() !== "") {
    const tagNames = String(rawTags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    for (const tagName of tagNames) {
      const tagId = tagNameToId.get(tagName.toLowerCase());
      if (!tagId) {
        errors.push(`Row ${rowNumber}: Tag "${tagName}" does not exist`);
        return { success: false, errors };
      }
      if (!tagIds.includes(tagId)) {
        tagIds.push(tagId);
      }
    }
  }

  // Build order data
  const orderData: ImportOrderData = {
    customerId,
    handlerId,
    fromCurrency,
    toCurrency,
    amountBuy,
    amountSell,
    rate,
    status,
    orderType,
    buyAccountId: buyAccount.id,
    sellAccountId: sellAccount.id,
    tagIds,
    ...(profitAmount !== null && profitAccount
      ? {
          profitAmount,
          profitCurrency: profitCurrency || profitAccount.currencyCode,
          profitAccountId: profitAccount.id,
        }
      : {}),
    ...(serviceChargeAmount !== null && serviceChargeAccount
      ? {
          serviceChargeAmount,
          serviceChargeCurrency: serviceChargeCurrency || serviceChargeAccount.currencyCode,
          serviceChargeAccountId: serviceChargeAccount.id,
        }
      : {}),
  };

  return { success: true, errors: [], orderData };
}

/**
 * Processes an Excel file and returns validated order data
 */
export async function processImportFile(
  file: File,
  customers: Customer[],
  users: User[],
  currencies: Currency[],
  currencyPairs: string[],
  accounts: Account[],
  tags: Tag[]
): Promise<{ orders: ImportOrderData[]; errors: string[] }> {
  // Read Excel file
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  // Read Orders sheet
  const ordersSheet = workbook.Sheets["Orders"];
  if (!ordersSheet) {
    throw new Error("Orders sheet not found in the file");
  }

  const ordersData = XLSX.utils.sheet_to_json(ordersSheet) as any[];

  if (ordersData.length === 0) {
    throw new Error("No orders found in the file");
  }

  // Build maps for validation
  const customerMap = new Map(customers.map((c) => [c.name.toLowerCase(), c.id]));
  const userMap = new Map(users.map((u) => [u.name.toLowerCase(), u.id]));
  const activeCurrencyCodes = new Set(currencies.filter((c) => c.active).map((c) => c.code.toUpperCase()));
  const currencyPairSet = new Set(currencyPairs.map((p) => p.toUpperCase()));
  const tagNameToId = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));
  const accountNameToAccount = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));

  // Fetch existing orders to prevent importing duplicates by Order ID
  const existingOrdersResponse = await fetch("/api/orders/export");
  if (!existingOrdersResponse.ok) {
    throw new Error("Could not load existing orders to validate Order IDs");
  }
  const existingOrders: Order[] = await existingOrdersResponse.json();
  const existingOrderIds = new Set(existingOrders.map((o) => String(o.id).toLowerCase()));
  const seenOrderIds = new Set<string>();

  const validatedOrders: ImportOrderData[] = [];
  const errors: string[] = [];

  // Process each order
  for (let i = 0; i < ordersData.length; i++) {
    const row = ordersData[i];
    const rowNumber = i + 2;

    const result = validateAndParseOrderRow(
      row,
      rowNumber,
      customerMap,
      userMap,
      activeCurrencyCodes,
      currencyPairSet,
      tagNameToId,
      accountNameToAccount,
      existingOrderIds,
      seenOrderIds
    );

    if (result.success && result.orderData) {
      // Track seen order IDs
      const orderIdRaw = String(row["Order ID"] || row["Order Id"] || row["orderId"] || "").trim();
      seenOrderIds.add(orderIdRaw.toLowerCase());
      validatedOrders.push(result.orderData);
    } else {
      errors.push(...result.errors);
    }
  }

  return { orders: validatedOrders, errors };
}

