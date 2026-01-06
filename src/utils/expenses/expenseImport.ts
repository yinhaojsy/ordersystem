import * as XLSX from "xlsx";
import type { Expense, Account, Tag } from "../../types";

export interface ImportExpenseData {
  accountId: number;
  amount: number;
  description?: string;
  tagIds: number[];
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
  tagNameToId: Map<string, number>,
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
  const accountName = String(row["Account"] || row["account"] || "").trim();
  if (!accountName) {
    errors.push(`Row ${rowNumber}: Account is required`);
    return { success: false, errors };
  }
  const account = accountNameToAccount.get(accountName.toLowerCase());
  if (!account) {
    errors.push(`Row ${rowNumber}: Account "${accountName}" not found`);
    return { success: false, errors };
  }

  // Parse amount (required)
  const amount = parseFloat(row["Amount"] || row["amount"] || "0");
  if (!amount || amount <= 0) {
    errors.push(`Row ${rowNumber}: Amount must be a positive number`);
    return { success: false, errors };
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
  const expenseData: ImportExpenseData = {
    accountId: account.id,
    amount,
    description,
    tagIds,
  };

  return { success: true, errors: [], expenseData };
}

/**
 * Processes an Excel file and returns validated expense data
 */
export async function processImportFile(
  file: File,
  accounts: Account[],
  tags: Tag[]
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
  const accountNameToAccount = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
  const tagNameToId = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));

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
      tagNameToId,
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

