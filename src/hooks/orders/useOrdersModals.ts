import { useState } from "react";

export function useOrdersModals() {
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type?: "error" | "warning" | "info" | "success";
  }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    orderId: number | null;
    isBulk?: boolean;
  }>({
    isOpen: false,
    message: "",
    orderId: null,
    isBulk: false,
  });

  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    src: string;
    type: "image" | "pdf";
    title: string;
  } | null>(null);

  return {
    alertModal,
    setAlertModal,
    confirmModal,
    setConfirmModal,
    isCreateCustomerModalOpen,
    setIsCreateCustomerModalOpen,
    importModalOpen,
    setImportModalOpen,
    isImporting,
    setIsImporting,
    viewerModal,
    setViewerModal,
  };
}

