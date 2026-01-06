import * as XLSX from "xlsx";
import type { Expense, Account, Tag, User } from "../../types";

export interface ImportExpenseData {
  accountId: number;
  amount: number;
  description?: string;
  tagIds: number[];
  currencyCode?: string;
  createdBy?: number;
}

export interface ImportValidationResult {
  success: boolean;
  errors: string[];
  expenseData?: ImportExpenseData;
}

/**
 * Validates and parses a single expense row from Excel import
 */
export function validateAndParseExpenseRow(
  row: any,
  rowNumber: number,
  accountNameToAccount: Map<string, Account>,
  accountNameMap: Map<string, string>,
  tagNameToId: Map<string, number>,
  userNameToId: Map<string, number>,
  existingExpenseIds: Set<string>,
  seenExpenseIds: Set<string>
): ImportValidationResult {
  const errors: string[] = [];

  // Validate Expense ID uniqueness (optional field)
  const expenseIdRaw = String(row["Expense ID"] || row["Expense Id"] || row["expenseId"] || "").trim();
  if (expenseIdRaw) {
    const normalizedExpenseId = expenseIdRaw.toLowerCase();
    if (existingExpenseIds.has(normalizedExpenseId)) {
      errors.push(`Row ${rowNumber}: Expense ID "${expenseIdRaw}" already exists`);
      return { success: false, errors };
    }
    if (seenExpenseIds.has(normalizedExpenseId)) {
      errors.push(`Row ${rowNumber}: Expense ID "${expenseIdRaw}" is duplicated in the file`);
      return { success: false, errors };
    }
    seenExpenseIds.add(normalizedExpenseId);
  }

  // Parse account (required)
  const accountNameRaw = String(row["Account"] || row["account"] || "").trim();
  if (!accountNameRaw) {
    errors.push(`Row ${rowNumber}: Account is required`);
    return { success: false, errors };
  }
  
  // Try multiple normalization strategies to find the account
  let account: Account | undefined = undefined;
  
  // Strategy 1: Normalize with Unicode NFC, lowercase, and normalize whitespace
  const normalized1 = accountNameRaw.toLowerCase().replace(/\s+/g, ' ').normalize('NFC');
  account = accountNameToAccount.get(normalized1);
  
  // Strategy 2: Without Unicode normalization (in case of encoding differences)
  if (!account) {
    const normalized2 = accountNameRaw.toLowerCase().replace(/\s+/g, ' ');
    account = accountNameToAccount.get(normalized2);
  }
  
  // Strategy 3: Remove all whitespace (in case of invisible characters)
  if (!account) {
    const normalized3 = accountNameRaw.toLowerCase().replace(/\s/g, '').normalize('NFC');
    for (const [key, acc] of accountNameToAccount.entries()) {
      if (key.replace(/\s/g, '') === normalized3) {
        account = acc;
        break;
      }
    }
  }
  
  // Strategy 4: Try exact case-insensitive match (fallback)
  if (!account) {
    const normalized4 = accountNameRaw.toLowerCase();
    for (const [key, acc] of accountNameToAccount.entries()) {
      if (key === normalized4 || acc.name.toLowerCase() === normalized4) {
        account = acc;
        break;
      }
    }
  }
  
  if (!account) {
    // Provide helpful error message with available accounts (show original names, not normalized)
    const availableAccountNames = Array.from(accountNameMap.values()).slice(0, 10);
    const availableAccountsStr = availableAccountNames.join(', ');
    errors.push(`Row ${rowNumber}: Account "${accountNameRaw}" not found. Available accounts: ${availableAccountsStr}${accountNameMap.size > 10 ? '...' : ''}`);
    return { success: false, errors };
  }

  // Parse amount (required)
  const amount = parseFloat(row["Amount"] || row["amount"] || "0");
  if (!amount || amount <= 0) {
    errors.push(`Row ${rowNumber}: Amount must be a positive number`);
    return { success: false, errors };
  }

  // Parse currency (optional, but validate if provided)
  const currencyCodeRaw = String(row["Currency"] || row["currency"] || row["currencyCode"] || "").trim();
  const currencyCode = currencyCodeRaw && currencyCodeRaw !== "-" ? currencyCodeRaw : undefined;
  if (currencyCode && currencyCode !== account.currencyCode) {
    errors.push(`Row ${rowNumber}: Currency "${currencyCode}" does not match account currency "${account.currencyCode}"`);
    return { success: false, errors };
  }

  // Parse created by (optional)
  let createdBy: number | undefined = undefined;
  const createdByNameRaw = String(row["Created By"] || row["createdBy"] || "").trim();
  const createdByName = createdByNameRaw && createdByNameRaw !== "-" ? createdByNameRaw : "";
  if (createdByName) {
    const userId = userNameToId.get(createdByName.toLowerCase());
    if (!userId) {
      errors.push(`Row ${rowNumber}: User "${createdByName}" not found`);
      return { success: false, errors };
    }
    createdBy = userId;
  }

  // Parse description (optional)
  const description = String(row["Description"] || row["description"] || "").trim() || undefined;

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

  // Build expense data
  // Note: createdAt is not included - backend will use current time automatically
  const expenseData: ImportExpenseData = {
    accountId: account.id,
    amount,
    description,
    tagIds,
    currencyCode: currencyCode || account.currencyCode,
    createdBy,
  };

  return { success: true, errors: [], expenseData };
}

/**
 * Processes an Excel file and returns validated expense data
 */
export async function processImportFile(
  file: File,
  accounts: Account[],
  tags: Tag[],
  users: User[] = []
): Promise<{ expenses: ImportExpenseData[]; errors: string[] }> {
  // Read Excel file
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  // Read Expenses sheet
  const expensesSheet = workbook.Sheets["Expenses"];
  if (!expensesSheet) {
    throw new Error("Expenses sheet not found in the file");
  }

  const expensesData = XLSX.utils.sheet_to_json(expensesSheet) as any[];

  if (expensesData.length === 0) {
    throw new Error("No expenses found in the file");
  }

  // Build maps for validation
  // Normalize account names: trim, lowercase, and normalize whitespace
  const normalizeAccountName = (name: string) => 
    name.trim().toLowerCase().replace(/\s+/g, ' ').normalize('NFC');
  const accountNameToAccount = new Map(
    accounts.map((a) => [normalizeAccountName(a.name), a])
  );
  // Also create a map with original names for better error messages
  const accountNameMap = new Map(accounts.map((a) => [normalizeAccountName(a.name), a.name]));
  const tagNameToId = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));
  const userNameToId = new Map(users.map((u) => [u.name.toLowerCase(), u.id]));

  // Fetch existing expenses to prevent importing duplicates by Expense ID
  const existingExpensesResponse = await fetch("/api/expenses/export");
  if (!existingExpensesResponse.ok) {
    throw new Error("Could not load existing expenses to validate Expense IDs");
  }
  const existingExpenses: Expense[] = await existingExpensesResponse.json();
  const existingExpenseIds = new Set(existingExpenses.map((e) => String(e.id).toLowerCase()));
  const seenExpenseIds = new Set<string>();

  const validatedExpenses: ImportExpenseData[] = [];
  const errors: string[] = [];

  // Process each expense
  for (let i = 0; i < expensesData.length; i++) {
    const row = expensesData[i];
    const rowNumber = i + 2;

    const result = validateAndParseExpenseRow(
      row,
      rowNumber,
      accountNameToAccount,
      accountNameMap,
      tagNameToId,
      userNameToId,
      existingExpenseIds,
      seenExpenseIds
    );

    if (result.success && result.expenseData) {
      validatedExpenses.push(result.expenseData);
    } else {
      errors.push(...result.errors);
    }
  }

  return { expenses: validatedExpenses, errors };
}

