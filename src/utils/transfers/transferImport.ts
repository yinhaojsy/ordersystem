import * as XLSX from "xlsx";
import type { Transfer, Account, Tag } from "../../types";

export interface ImportTransferData {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  description?: string;
  transactionFee?: number;
  tagIds: number[];
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
  tagNameToId: Map<string, number>,
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
  const fromAccountName = String(row["From Account"] || row["fromAccount"] || "").trim();
  if (!fromAccountName) {
    errors.push(`Row ${rowNumber}: From Account is required`);
    return { success: false, errors };
  }
  const fromAccount = accountNameToAccount.get(fromAccountName.toLowerCase());
  if (!fromAccount) {
    errors.push(`Row ${rowNumber}: From Account "${fromAccountName}" not found`);
    return { success: false, errors };
  }

  // Parse to account (required)
  const toAccountName = String(row["To Account"] || row["toAccount"] || "").trim();
  if (!toAccountName) {
    errors.push(`Row ${rowNumber}: To Account is required`);
    return { success: false, errors };
  }
  const toAccount = accountNameToAccount.get(toAccountName.toLowerCase());
  if (!toAccount) {
    errors.push(`Row ${rowNumber}: To Account "${toAccountName}" not found`);
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

  // Parse amount (required)
  const amount = parseFloat(row["Amount"] || row["amount"] || "0");
  if (!amount || amount <= 0) {
    errors.push(`Row ${rowNumber}: Amount must be a positive number`);
    return { success: false, errors };
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
  const transferData: ImportTransferData = {
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    amount,
    description,
    transactionFee,
    tagIds,
  };

  return { success: true, errors: [], transferData };
}

/**
 * Processes an Excel file and returns validated transfer data
 */
export async function processImportFile(
  file: File,
  accounts: Account[],
  tags: Tag[]
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
  const accountNameToAccount = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
  const tagNameToId = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));

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
      tagNameToId,
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

