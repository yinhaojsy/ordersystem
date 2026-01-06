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
      title={t("transfers.importTransfers")}
      description={t("transfers.importDescription")}
      templateButtonText={t("transfers.downloadTemplate")}
      importingText={t("transfers.importing")}
      cancelText={t("common.cancel")}
      closeAriaLabel={t("common.close")}
    />
  );
}

