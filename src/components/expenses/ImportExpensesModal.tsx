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
      title={t("expenses.importExpenses")}
      description={t("expenses.importDescription")}
      templateButtonText={t("expenses.downloadTemplate")}
      importingText={t("expenses.importing")}
      cancelText={t("common.cancel")}
      closeAriaLabel={t("common.close")}
    />
  );
}

