import React from "react";
import { useTranslation } from "react-i18next";
import { ImportModal } from "../common/ImportModal";

interface ImportExpensesModalProps {
  isOpen: boolean;
  isImporting: boolean;
  onClose: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
}

export function ImportExpensesModal({
  isOpen,
  isImporting,
  onClose,
  onFileChange,
  onDownloadTemplate,
}: ImportExpensesModalProps) {
  const { t } = useTranslation();

  return (
    <ImportModal
      isOpen={isOpen}
      isImporting={isImporting}
      onClose={onClose}
      onFileChange={onFileChange}
      onDownloadTemplate={onDownloadTemplate}
      title={t("expenses.importExpenses") || "Import Expenses"}
      description={t("expenses.importDescription") ||
        "Select an Excel file (.xlsx) to import expenses. The 'Expenses' sheet must include: Account, Amount. Optional: Expense ID, Currency, Created By, Description, Tags. Note: Date will be set to current time when imported."}
      templateButtonText={t("expenses.downloadTemplate") || "Download Template"}
      importingText={t("expenses.importing") || "Importing..."}
      cancelText={t("common.cancel")}
      closeAriaLabel={t("common.close")}
    />
  );
}

