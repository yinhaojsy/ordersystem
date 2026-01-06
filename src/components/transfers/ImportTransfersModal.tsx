import React from "react";
import { useTranslation } from "react-i18next";
import { ImportModal } from "../common/ImportModal";

interface ImportTransfersModalProps {
  isOpen: boolean;
  isImporting: boolean;
  onClose: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
}

export function ImportTransfersModal({
  isOpen,
  isImporting,
  onClose,
  onFileChange,
  onDownloadTemplate,
}: ImportTransfersModalProps) {
  const { t } = useTranslation();

  return (
    <ImportModal
      isOpen={isOpen}
      isImporting={isImporting}
      onClose={onClose}
      onFileChange={onFileChange}
      onDownloadTemplate={onDownloadTemplate}
      title={t("transfers.importTransfers") || "Import Transfers"}
      description={t("transfers.importDescription") ||
        "Select an Excel file (.xlsx) to import transfers. The 'Transfers' sheet must include: From Account, To Account, Amount, Description. Optional: Transfer ID, Transaction Fee, Tags. Note: From Account and To Account must have the same currency."}
      templateButtonText={t("transfers.downloadTemplate") || "Download Template"}
      importingText={t("transfers.importing") || "Importing..."}
      cancelText={t("common.cancel")}
      closeAriaLabel={t("common.close")}
    />
  );
}

