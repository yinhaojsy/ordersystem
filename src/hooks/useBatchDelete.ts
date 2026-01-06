import { useState, useCallback } from "react";

interface UseBatchDeleteParams {
  deleteSingle: (id: number, ...args: any[]) => { unwrap: () => Promise<any> };
  deleteBulk?: (ids: number[], ...args: any[]) => { unwrap: () => Promise<any> };
  getDeleteArgs?: (id: number) => any[];
  onSuccess?: () => void;
  onError?: (error: any, setAlertModal?: (modal: { isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }) => void) => void;
  confirmMessage?: string;
  confirmBulkMessage?: string;
  errorMessage?: string;
  t?: (key: string) => string;
  setAlertModal?: (modal: { isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }) => void;
}

interface UseBatchDeleteReturn {
  isBatchDeleteMode: boolean;
  selectedIds: number[];
  setIsBatchDeleteMode: (isBatch: boolean) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  handleDeleteClick: (id: number) => void;
  handleDelete: (id: number) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  toggleBatchDeleteMode: () => void;
  exitBatchDeleteMode: () => void;
  confirmModal: {
    isOpen: boolean;
    message: string;
    entityId: number | null;
    isBulk: boolean;
  };
  setConfirmModal: (modal: {
    isOpen: boolean;
    message: string;
    entityId: number | null;
    isBulk?: boolean;
  }) => void;
}

export function useBatchDelete({
  deleteSingle,
  deleteBulk,
  getDeleteArgs,
  onSuccess,
  onError,
  confirmMessage,
  confirmBulkMessage,
  errorMessage,
  t,
  setAlertModal,
}: UseBatchDeleteParams): UseBatchDeleteReturn {
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    entityId: number | null;
    isBulk: boolean;
  }>({
    isOpen: false,
    message: "",
    entityId: null,
    isBulk: false,
  });

  const handleDeleteClick = useCallback(
    (id: number) => {
      setConfirmModal({
        isOpen: true,
        message: confirmMessage || t?.("common.confirmDelete") || "Are you sure you want to delete this item?",
        entityId: id,
        isBulk: false,
      });
    },
    [confirmMessage, t]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        const args = getDeleteArgs ? getDeleteArgs(id) : [];
        await deleteSingle(id, ...args).unwrap();
        setConfirmModal({ isOpen: false, message: "", entityId: null, isBulk: false });
        onSuccess?.();
      } catch (error: any) {
        let message = errorMessage || t?.("common.errorDeleting") || "Cannot delete item. An error occurred.";

        if (error?.data) {
          if (typeof error.data === "string") {
            message = error.data;
          } else if (error.data.message) {
            message = error.data.message;
          }
        }

        setConfirmModal({ isOpen: false, message: "", entityId: null, isBulk: false });
        if (onError) {
          onError(error, setAlertModal);
        } else if (setAlertModal) {
          setAlertModal({ isOpen: true, message, type: "error" });
        }
      }
    },
    [deleteSingle, getDeleteArgs, errorMessage, t, onSuccess, onError, setAlertModal]
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      if (deleteBulk) {
        const args = getDeleteArgs ? getDeleteArgs(selectedIds[0]) : [];
        await deleteBulk(selectedIds, ...args).unwrap();
      } else {
        await Promise.all(
          selectedIds.map((id) => {
            const args = getDeleteArgs ? getDeleteArgs(id) : [];
            return deleteSingle(id, ...args).unwrap();
          })
        );
      }
      setSelectedIds([]);
      setIsBatchDeleteMode(false);
      setConfirmModal({ isOpen: false, message: "", entityId: null, isBulk: false });
      onSuccess?.();
    } catch (error: any) {
      let message = errorMessage || t?.("common.errorDeleting") || "Cannot delete items. An error occurred.";

      if (error?.data) {
        if (typeof error.data === "string") {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }

      setConfirmModal({ isOpen: false, message: "", entityId: null, isBulk: false });
      if (onError) {
        onError(error, setAlertModal);
      } else if (setAlertModal) {
        setAlertModal({ isOpen: true, message, type: "error" });
      }
    }
  }, [selectedIds, deleteSingle, deleteBulk, getDeleteArgs, errorMessage, t, onSuccess, onError, setAlertModal]);

  const toggleBatchDeleteMode = useCallback(() => {
    if (!isBatchDeleteMode) {
      setIsBatchDeleteMode(true);
      setSelectedIds([]);
    } else {
      if (selectedIds.length === 0) {
        setIsBatchDeleteMode(false);
        setSelectedIds([]);
        return;
      }
      setConfirmModal({
        isOpen: true,
        message: confirmBulkMessage || confirmMessage || t?.("common.confirmDeleteSelected") || "Are you sure you want to delete the selected items?",
        entityId: -1,
        isBulk: true,
      });
    }
  }, [isBatchDeleteMode, selectedIds.length, confirmBulkMessage, confirmMessage, t]);

  const exitBatchDeleteMode = useCallback(() => {
    setIsBatchDeleteMode(false);
    setSelectedIds([]);
  }, []);

  return {
    isBatchDeleteMode,
    selectedIds,
    setIsBatchDeleteMode,
    setSelectedIds,
    handleDeleteClick,
    handleDelete,
    handleBulkDelete,
    toggleBatchDeleteMode,
    exitBatchDeleteMode,
    confirmModal,
    setConfirmModal: ((modal: {
      isOpen: boolean;
      message: string;
      entityId: number | null;
      isBulk?: boolean;
    }) => {
      setConfirmModal({
        isOpen: modal.isOpen,
        message: modal.message,
        entityId: modal.entityId,
        isBulk: modal.isBulk ?? false,
      });
    }) as UseBatchDeleteReturn['setConfirmModal'],
  };
}

