import { useCallback, type FormEvent } from "react";
import type { OrderStatus, Order } from "../../types";

interface UseOrdersActionsParams {
  orders: Order[];
  updateOrderStatus: any;
  deleteOrder: any;
  updateOrder: any;
  addOrder: any;
  processOrder: any;
  setOpenMenuId: (id: number | null) => void;
  setConfirmModal: (modal: { isOpen: boolean; message: string; orderId: number | null; isBulk?: boolean }) => void;
  setAlertModal: (modal: { isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }) => void;
  // For startEdit
  setOtcEditingOrderId: (id: number | null) => void;
  setIsOtcOrderModalOpen: (isOpen: boolean) => void;
  setEditingOrderId: (id: number | null) => void;
  setForm: (form: any) => void;
  setIsModalOpen: (isOpen: boolean) => void;
  // For submit
  form: any;
  editingOrderId: number | null;
  resetForm: () => void;
  isFlexOrderMode: boolean;
  authUser: any;
  setProcessModalOrderId: (id: number | null) => void;
  setIsFlexOrderMode: (isFlex: boolean) => void;
  // For handleProcess
  processModalOrderId: number | null;
  processForm: any;
  resetProcessForm: () => void;
  // For bulk delete
  selectedOrderIds: number[];
  setSelectedOrderIds: (ids: number[]) => void;
  setIsBatchDeleteMode: (isBatch: boolean) => void;
  t: (key: string) => string;
}

export function useOrdersActions({
  orders,
  updateOrderStatus,
  deleteOrder,
  updateOrder,
  addOrder,
  processOrder,
  setOpenMenuId,
  setConfirmModal,
  setAlertModal,
  setOtcEditingOrderId,
  setIsOtcOrderModalOpen,
  setEditingOrderId,
  setForm,
  setIsModalOpen,
  form,
  editingOrderId,
  resetForm,
  isFlexOrderMode,
  authUser,
  setProcessModalOrderId,
  setIsFlexOrderMode,
  processModalOrderId,
  processForm,
  resetProcessForm,
  selectedOrderIds,
  setSelectedOrderIds,
  setIsBatchDeleteMode,
  t,
}: UseOrdersActionsParams) {
  const setStatus = useCallback(async (id: number, status: OrderStatus) => {
    await updateOrderStatus({ id, status });
    setOpenMenuId(null);
  }, [updateOrderStatus, setOpenMenuId]);

  const handleDeleteClick = useCallback((id: number) => {
    setConfirmModal({
      isOpen: true,
      message: t("orders.confirmDeleteOrder") || "Are you sure you want to delete this order?",
      orderId: id,
      isBulk: false,
    });
    setOpenMenuId(null);
  }, [t, setConfirmModal, setOpenMenuId]);

  const handleDelete = async (id: number) => {
    try {
      await deleteOrder(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
    } catch (error: any) {
      let message = "Cannot delete order. An error occurred.";
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedOrderIds.map((id) => deleteOrder(id).unwrap()));
      setSelectedOrderIds([]);
      setIsBatchDeleteMode(false);
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
    } catch (error: any) {
      let message = "Cannot delete orders. An error occurred.";
      
      if (error?.data) {
        if (typeof error.data === 'string') {
          message = error.data;
        } else if (error.data.message) {
          message = error.data.message;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  const startEdit = useCallback((orderId: number) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    
    // Check if it's an OTC order
    if (order.orderType === "otc") {
      // Open OTC modal for editing/viewing (OTC orders can be viewed/edited in OTC modal regardless of status)
      // Form will be loaded automatically by useOtcOrder hook when otcEditingOrderId changes
      setOtcEditingOrderId(orderId);
      setIsOtcOrderModalOpen(true);
      setOpenMenuId(null);
      // Load receipts, payments, profit, service charges via orderDetails query (handled by useOtcOrder hook)
      return;
    }
    
    // For non-OTC orders, only allow editing if status is pending
    if (order.status !== "pending") return;
    
    setEditingOrderId(orderId);
    setForm({
      customerId: String(order.customerId),
      fromCurrency: order.fromCurrency,
      toCurrency: order.toCurrency,
      amountBuy: String(order.amountBuy),
      amountSell: String(order.amountSell),
      rate: String(order.rate),
      status: order.status,
    });
    setIsModalOpen(true);
    setOpenMenuId(null);
  }, [orders, setOtcEditingOrderId, setIsOtcOrderModalOpen, setOpenMenuId, setEditingOrderId, setForm, setIsModalOpen]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.customerId || !form.fromCurrency || !form.toCurrency) return;
    
    if (editingOrderId) {
      // Update existing order
      await updateOrder({
        id: editingOrderId,
        data: {
          customerId: Number(form.customerId),
          fromCurrency: form.fromCurrency,
          toCurrency: form.toCurrency,
          amountBuy: Number(form.amountBuy || 0),
          amountSell: Number(form.amountSell || 0),
          rate: Number(form.rate || 1),
        },
      }).unwrap();
      resetForm();
      setEditingOrderId(null);
      setIsModalOpen(false);
    } else {
      // Create new order (regular or flex)
      const newOrder = await addOrder({
        customerId: Number(form.customerId),
        fromCurrency: form.fromCurrency,
        toCurrency: form.toCurrency,
        amountBuy: Number(form.amountBuy || 0),
        amountSell: Number(form.amountSell || 0),
        rate: Number(form.rate || 1),
        status: form.status,
        isFlexOrder: isFlexOrderMode,
        handlerId: authUser?.id ?? undefined,
        orderType: "online",
      }).unwrap();
      resetForm();
      setIsModalOpen(false);
      setIsFlexOrderMode(false);
      
      // Automatically open Process Order modal for the newly created order
      if (newOrder?.id) {
        setProcessModalOrderId(newOrder.id);
      }
    }
  };

  const handleProcess = async (event: FormEvent) => {
    event.preventDefault();
    if (!processModalOrderId || !processForm.handlerId) return;

    const currentOrder = orders.find((o) => o.id === processModalOrderId);
    const isFlex = currentOrder?.isFlexOrder;

    const payload: any = {
      id: processModalOrderId,
      handlerId: Number(processForm.handlerId),
    };

    try {
      await processOrder(payload).unwrap();
      resetProcessForm();
      setProcessModalOrderId(null);
      setOpenMenuId(null);
    } catch (error: any) {
      console.error("Error processing order:", error);
      const errorMessage = error?.data?.message || error?.message || t("orders.failedToProcessOrder");
      alert(errorMessage);
    }
  };

  return {
    setStatus,
    handleDeleteClick,
    handleDelete,
    handleBulkDelete,
    startEdit,
    submit,
    handleProcess,
  };
}

