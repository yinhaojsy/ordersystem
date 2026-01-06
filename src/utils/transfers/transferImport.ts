import * as XLSX from "xlsx";
import type { Transfer, Account, Tag, User } from "../../types";

export interface ImportTransferData {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  description?: string;
  transactionFee?: number;
  tagIds: number[];
  currencyCode?: string;
  createdBy?: number;
}

export interface ImportValidationResult {
  success: boolean;
  errors: string[];
  transferData?: ImportTransferData;
}

/**
 * Validates and parses a single transfer row from Excel import
 */
export function validateAndParseTransferRow(
  row: any,
  rowNumber: number,
  accountNameToAccount: Map<string, Account>,
  accountNameMap: Map<string, string>,
  tagNameToId: Map<string, number>,
  userNameToId: Map<string, number>,
  existingTransferIds: Set<string>,
  seenTransferIds: Set<string>
): ImportValidationResult {
  const errors: string[] = [];

  // Validate Transfer ID uniqueness (optional field)
  const transferIdRaw = String(row["Transfer ID"] || row["Transfer Id"] || row["transferId"] || "").trim();
  if (transferIdRaw) {
    const normalizedTransferId = transferIdRaw.toLowerCase();
    if (existingTransferIds.has(normalizedTransferId)) {
      errors.push(`Row ${rowNumber}: Transfer ID "${transferIdRaw}" already exists`);
      return { success: false, errors };
    }
    if (seenTransferIds.has(normalizedTransferId)) {
      errors.push(`Row ${rowNumber}: Transfer ID "${transferIdRaw}" is duplicated in the file`);
      return { success: false, errors };
    }
    seenTransferIds.add(normalizedTransferId);
  }

  // Parse from account (required)
  const fromAccountNameRaw = String(row["From Account"] || row["fromAccount"] || "").trim();
  if (!fromAccountNameRaw) {
    errors.push(`Row ${rowNumber}: From Account is required`);
    return { success: false, errors };
  }
  
  // Try multiple normalization strategies to find the account
  let fromAccount: Account | undefined = undefined;
  const normalizedFromName = fromAccountNameRaw.toLowerCase().replace(/\s+/g, ' ').normalize('NFC');
  fromAccount = accountNameToAccount.get(normalizedFromName);
  
  // If not found, try without Unicode normalization
  if (!fromAccount) {
    const normalizedWithoutNFC = fromAccountNameRaw.toLowerCase().replace(/\s+/g, ' ');
    fromAccount = accountNameToAccount.get(normalizedWithoutNFC);
  }
  
  // If still not found, try removing all whitespace
  if (!fromAccount) {
    const normalizedNoSpaces = fromAccountNameRaw.toLowerCase().replace(/\s/g, '').normalize('NFC');
    for (const [key, acc] of accountNameToAccount.entries()) {
      if (key.replace(/\s/g, '') === normalizedNoSpaces) {
        fromAccount = acc;
        break;
      }
    }
  }
  
  if (!fromAccount) {
    const availableAccountNames = Array.from(accountNameMap.values()).slice(0, 10);
    const availableAccountsStr = availableAccountNames.join(', ');
    errors.push(`Row ${rowNumber}: From Account "${fromAccountNameRaw}" not found. Available accounts: ${availableAccountsStr}${accountNameMap.size > 10 ? '...' : ''}`);
    return { success: false, errors };
  }

  // Parse to account (required)
  const toAccountNameRaw = String(row["To Account"] || row["toAccount"] || "").trim();
  if (!toAccountNameRaw) {
    errors.push(`Row ${rowNumber}: To Account is required`);
    return { success: false, errors };
  }
  
  // Try multiple normalization strategies to find the account
  let toAccount: Account | undefined = undefined;
  const normalizedToName = toAccountNameRaw.toLowerCase().replace(/\s+/g, ' ').normalize('NFC');
  toAccount = accountNameToAccount.get(normalizedToName);
  
  // If not found, try without Unicode normalization
  if (!toAccount) {
    const normalizedWithoutNFC = toAccountNameRaw.toLowerCase().replace(/\s+/g, ' ');
    toAccount = accountNameToAccount.get(normalizedWithoutNFC);
  }
  
  // If still not found, try removing all whitespace
  if (!toAccount) {
    const normalizedNoSpaces = toAccountNameRaw.toLowerCase().replace(/\s/g, '').normalize('NFC');
    for (const [key, acc] of accountNameToAccount.entries()) {
      if (key.replace(/\s/g, '') === normalizedNoSpaces) {
        toAccount = acc;
        break;
      }
    }
  }
  
  if (!toAccount) {
    const availableAccountNames = Array.from(accountNameMap.values()).slice(0, 10);
    const availableAccountsStr = availableAccountNames.join(', ');
    errors.push(`Row ${rowNumber}: To Account "${toAccountNameRaw}" not found. Available accounts: ${availableAccountsStr}${accountNameMap.size > 10 ? '...' : ''}`);
    return { success: false, errors };
  }

  // Validate that from and to accounts are different
  if (fromAccount.id === toAccount.id) {
    errors.push(`Row ${rowNumber}: From Account and To Account must be different`);
    return { success: false, errors };
  }

  // Validate that both accounts have the same currency
  if (fromAccount.currencyCode !== toAccount.currencyCode) {
    errors.push(`Row ${rowNumber}: From Account and To Account must have the same currency`);
    return { success: false, errors };
  }

  // Parse currency (optional, but validate if provided)
  const currencyCodeRaw = String(row["Currency"] || row["currency"] || row["currencyCode"] || "").trim();
  const currencyCode = currencyCodeRaw && currencyCodeRaw !== "-" ? currencyCodeRaw : undefined;
  if (currencyCode) {
    // Validate currency matches both accounts
    if (currencyCode !== fromAccount.currencyCode || currencyCode !== toAccount.currencyCode) {
      errors.push(`Row ${rowNumber}: Currency "${currencyCode}" does not match account currencies "${fromAccount.currencyCode}"`);
      return { success: false, errors };
    }
  }

  // Parse amount (required)
  const amount = parseFloat(row["Amount"] || row["amount"] || "0");
  if (!amount || amount <= 0) {
    errors.push(`Row ${rowNumber}: Amount must be a positive number`);
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

  // Parse description (required)
  const description = String(row["Description"] || row["description"] || "").trim();
  if (!description) {
    errors.push(`Row ${rowNumber}: Description is required`);
    return { success: false, errors };
  }

  // Parse transaction fee (optional)
  const transactionFeeRaw = row["Transaction Fee"] ?? row["transactionFee"];
  const transactionFee =
    transactionFeeRaw === undefined || transactionFeeRaw === null || String(transactionFeeRaw).trim() === ""
      ? undefined
      : parseFloat(transactionFeeRaw);
  if (transactionFee !== undefined && (Number.isNaN(transactionFee) || transactionFee < 0)) {
    errors.push(`Row ${rowNumber}: Transaction Fee must be a non-negative number`);
    return { success: false, errors };
  }

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

  // Build transfer data
  // Note: createdAt is not included - backend will use current time automatically
  const transferData: ImportTransferData = {
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    amount,
    description,
    transactionFee,
    tagIds,
    currencyCode: currencyCode || fromAccount.currencyCode,
    createdBy,
  };

  return { success: true, errors: [], transferData };
}

/**
 * Processes an Excel file and returns validated transfer data
 */
export async function processImportFile(
  file: File,
  accounts: Account[],
  tags: Tag[],
  users: User[] = []
): Promise<{ transfers: ImportTransferData[]; errors: string[] }> {
  // Read Excel file
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  // Read Transfers sheet
  const transfersSheet = workbook.Sheets["Transfers"];
  if (!transfersSheet) {
    throw new Error("Transfers sheet not found in the file");
  }

  const transfersData = XLSX.utils.sheet_to_json(transfersSheet) as any[];

  if (transfersData.length === 0) {
    throw new Error("No transfers found in the file");
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

  // Fetch existing transfers to prevent importing duplicates by Transfer ID
  const existingTransfersResponse = await fetch("/api/transfers/export");
  if (!existingTransfersResponse.ok) {
    throw new Error("Could not load existing transfers to validate Transfer IDs");
  }
  const existingTransfers: Transfer[] = await existingTransfersResponse.json();
  const existingTransferIds = new Set(existingTransfers.map((t) => String(t.id).toLowerCase()));
  const seenTransferIds = new Set<string>();

  const validatedTransfers: ImportTransferData[] = [];
  const errors: string[] = [];

  // Process each transfer
  for (let i = 0; i < transfersData.length; i++) {
    const row = transfersData[i];
    const rowNumber = i + 2;

    const result = validateAndParseTransferRow(
      row,
      rowNumber,
      accountNameToAccount,
      accountNameMap,
      tagNameToId,
      userNameToId,
      existingTransferIds,
      seenTransferIds
    );

    if (result.success && result.transferData) {
      validatedTransfers.push(result.transferData);
    } else {
      errors.push(...result.errors);
    }
  }

  return { transfers: validatedTransfers, errors };
}

