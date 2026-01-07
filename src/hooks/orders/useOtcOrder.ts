import { useState, useEffect, useMemo } from "react";
import type { FormEvent } from "react";
import {
  useAddOrderMutation,
  useUpdateOrderMutation,
  useProcessOrderMutation,
  useGetOrderDetailsQuery,
  useAddReceiptMutation,
  useAddPaymentMutation,
  useDeleteReceiptMutation,
  useDeletePaymentMutation,
  useConfirmReceiptMutation,
  useConfirmPaymentMutation,
  useUpdateOrderStatusMutation,
  useConfirmProfitMutation,
  useConfirmServiceChargeMutation,
} from "../../services/api";
import type { Account } from "../../types";

interface OtcForm {
  customerId: string;
  fromCurrency: string;
  toCurrency: string;
  amountBuy: string;
  amountSell: string;
  rate: string;
  handlerId: string;
}

interface OtcReceipt {
  amount: string;
  accountId: string;
}

interface OtcPayment {
  amount: string;
  accountId: string;
}

export function useOtcOrder(
  accounts: Account[],
  setOpenMenuId: (id: number | null) => void,
  setIsCreateCustomerModalOpen: (open: boolean) => void
) {
  const [isOtcOrderModalOpen, setIsOtcOrderModalOpen] = useState(false);
  const [otcEditingOrderId, setOtcEditingOrderId] = useState<number | null>(null);
  
  const [otcForm, setOtcForm] = useState<OtcForm>({
    customerId: "",
    fromCurrency: "",
    toCurrency: "",
    amountBuy: "",
    amountSell: "",
    rate: "",
    handlerId: "",
  });
  const [otcReceipts, setOtcReceipts] = useState<OtcReceipt[]>([]);
  const [otcPayments, setOtcPayments] = useState<OtcPayment[]>([]);
  const [otcProfitAmount, setOtcProfitAmount] = useState<string>("");
  const [otcProfitCurrency, setOtcProfitCurrency] = useState<string>("");
  const [otcProfitAccountId, setOtcProfitAccountId] = useState<string>("");
  const [otcServiceChargeAmount, setOtcServiceChargeAmount] = useState<string>("");
  const [otcServiceChargeCurrency, setOtcServiceChargeCurrency] = useState<string>("");
  const [otcServiceChargeAccountId, setOtcServiceChargeAccountId] = useState<string>("");
  const [showOtcProfitSection, setShowOtcProfitSection] = useState(false);
  const [showOtcServiceChargeSection, setShowOtcServiceChargeSection] = useState(false);
  const [otcCalculatedField, setOtcCalculatedField] = useState<"buy" | "sell" | null>(null);
  const [otcRemarks, setOtcRemarks] = useState<string>("");
  const [showOtcRemarks, setShowOtcRemarks] = useState(false);

  const { data: otcOrderDetails } = useGetOrderDetailsQuery(otcEditingOrderId || 0, {
    skip: !otcEditingOrderId,
  });

  const [addOrder] = useAddOrderMutation();
  const [updateOrder] = useUpdateOrderMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [processOrder] = useProcessOrderMutation();
  const [addReceipt] = useAddReceiptMutation();
  const [addPayment] = useAddPaymentMutation();
  const [deleteReceipt] = useDeleteReceiptMutation();
  const [deletePayment] = useDeletePaymentMutation();
  const [confirmReceipt] = useConfirmReceiptMutation();
  const [confirmPayment] = useConfirmPaymentMutation();
  const [confirmProfit] = useConfirmProfitMutation();
  const [confirmServiceCharge] = useConfirmServiceChargeMutation();

  // Determine if OTC order is completed/cancelled for view mode
  const isOtcCompleted = useMemo(() => {
    return Boolean(
      otcEditingOrderId &&
      otcOrderDetails?.order &&
      (otcOrderDetails.order.status === "completed" || otcOrderDetails.order.status === "cancelled")
    );
  }, [otcEditingOrderId, otcOrderDetails]);

  // Load OTC order details when editing
  useEffect(() => {
    if (otcEditingOrderId && otcOrderDetails && otcOrderDetails.order) {
      const order = otcOrderDetails.order;
      setOtcForm({
        customerId: String(order.customerId),
        fromCurrency: order.fromCurrency,
        toCurrency: order.toCurrency,
        amountBuy: String(order.amountBuy),
        amountSell: String(order.amountSell),
        rate: String(order.rate),
        handlerId: order.handlerId ? String(order.handlerId) : "",
      });
      // Load receipts and payments - ensure we have valid arrays
      const receipts = Array.isArray(otcOrderDetails.receipts) ? otcOrderDetails.receipts : [];
      const payments = Array.isArray(otcOrderDetails.payments) ? otcOrderDetails.payments : [];
      
      setOtcReceipts(receipts.map(r => ({
        amount: String(r.amount || ""),
        accountId: r.accountId ? String(r.accountId) : "",
      })));
      
      setOtcPayments(payments.map(p => ({
        amount: String(p.amount || ""),
        accountId: p.accountId ? String(p.accountId) : "",
      })));
      
      // Load profit and service charges
      if (order.profitAmount !== null && order.profitAmount !== undefined) {
        setOtcProfitAmount(String(order.profitAmount));
        setOtcProfitCurrency(order.profitCurrency || "");
        setOtcProfitAccountId(order.profitAccountId ? String(order.profitAccountId) : "");
        setShowOtcProfitSection(true);
      }
      if (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined) {
        setOtcServiceChargeAmount(String(order.serviceChargeAmount));
        setOtcServiceChargeCurrency(order.serviceChargeCurrency || "");
        setOtcServiceChargeAccountId(order.serviceChargeAccountId ? String(order.serviceChargeAccountId) : "");
        setShowOtcServiceChargeSection(true);
      }
      // Load remarks if available
      // Check if remarks exists (could be string, null, or undefined)
      const remarksValue = (order as any).remarks;
      if (remarksValue !== null && remarksValue !== undefined && remarksValue.trim() !== "") {
        setOtcRemarks(remarksValue);
        setShowOtcRemarks(true);
      } else {
        // Reset remarks state if no remarks exist
        setOtcRemarks("");
        setShowOtcRemarks(false);
      }
    }
  }, [otcEditingOrderId, otcOrderDetails]);

  const resetOtcForm = () => {
    setOtcForm({
      customerId: "",
      fromCurrency: "",
      toCurrency: "",
      amountBuy: "",
      amountSell: "",
      rate: "",
      handlerId: "",
    });
    setOtcReceipts([]);
    setOtcPayments([]);
    setOtcProfitAmount("");
    setOtcProfitCurrency("");
    setOtcProfitAccountId("");
    setOtcServiceChargeAmount("");
    setOtcServiceChargeCurrency("");
    setOtcServiceChargeAccountId("");
    setShowOtcProfitSection(false);
    setShowOtcServiceChargeSection(false);
    setOtcCalculatedField(null);
    setOtcRemarks("");
    setShowOtcRemarks(false);
  };

  const closeOtcModal = () => {
    resetOtcForm();
    setIsOtcOrderModalOpen(false);
    setOtcEditingOrderId(null);
  };

  const handleOtcOrderSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!otcForm.customerId || !otcForm.fromCurrency || !otcForm.toCurrency) return;
    const handlerId = Number(otcForm.handlerId);
    if (!otcForm.handlerId || Number.isNaN(handlerId)) {
      alert("Handler is required");
      return;
    }
    const buyAccountId = otcReceipts.find((r) => r.accountId)?.accountId
      ? Number(otcReceipts.find((r) => r.accountId)!.accountId)
      : null;
    const sellAccountId = otcPayments.find((p) => p.accountId)?.accountId
      ? Number(otcPayments.find((p) => p.accountId)!.accountId)
      : null;
    const buyAccountIdValue: number | undefined = buyAccountId === null ? undefined : buyAccountId;
    const sellAccountIdValue: number | undefined = sellAccountId === null ? undefined : sellAccountId;

    try {
      let orderId: number;
      
      // Prepare order data with remarks
      const orderData: any = {
        customerId: Number(otcForm.customerId),
        fromCurrency: otcForm.fromCurrency,
        toCurrency: otcForm.toCurrency,
        amountBuy: Number(otcForm.amountBuy || 0),
        amountSell: Number(otcForm.amountSell || 0),
        rate: Number(otcForm.rate || 1),
        handlerId,
        buyAccountId: buyAccountIdValue,
        sellAccountId: sellAccountIdValue,
      };
      
      // Handle remarks: if section is shown, include remarks (null if empty to remove from DB)
      if (showOtcRemarks) {
        if (otcRemarks && otcRemarks.trim() !== "") {
          orderData.remarks = otcRemarks.trim();
        } else {
          // Empty remarks - set to null to remove from database
          orderData.remarks = null;
        }
      }

      if (otcEditingOrderId) {
        // Update existing order
        await updateOrder({
          id: otcEditingOrderId,
          data: orderData,
        }).unwrap();
        orderId = otcEditingOrderId;
      } else {
        // Create new OTC order
        const newOrder = await addOrder({
          ...orderData,
          status: "pending",
          orderType: "otc",
        }).unwrap();
        orderId = newOrder.id;
      }

      // Delete existing receipts and payments when editing, then recreate from form
      if (otcEditingOrderId && otcOrderDetails) {
        // Delete existing receipts
        for (const receipt of otcOrderDetails.receipts || []) {
          try {
            await deleteReceipt(receipt.id).unwrap();
          } catch (error) {
            console.error("Error deleting receipt:", error);
          }
        }
        // Delete existing payments
        for (const payment of otcOrderDetails.payments || []) {
          try {
            await deletePayment(payment.id).unwrap();
          } catch (error) {
            console.error("Error deleting payment:", error);
          }
        }
      }

      // Create receipts (without image for OTC orders)
      for (const receipt of otcReceipts) {
        const receiptAmount = Number(receipt.amount) || 0;
        if (receiptAmount !== 0 && receipt.accountId) {
          await addReceipt({
            id: orderId,
            amount: receiptAmount,
            accountId: Number(receipt.accountId),
            imagePath: "", // Empty for OTC orders - backend will use placeholder
          } as any).unwrap();
        }
      }

      // Create payments (without image for OTC orders)
      for (const payment of otcPayments) {
        const paymentAmount = Number(payment.amount) || 0;
        if (paymentAmount !== 0 && payment.accountId) {
          await addPayment({
            id: orderId,
            amount: paymentAmount,
            accountId: Number(payment.accountId),
            imagePath: "", // Empty for OTC orders - backend will use placeholder
          } as any).unwrap();
        }
      }

      // Add profit if provided
      if (otcProfitAmount && otcProfitAccountId && otcProfitCurrency) {
        await updateOrder({
          id: orderId,
          data: {
            profitAmount: Number(otcProfitAmount),
            profitCurrency: otcProfitCurrency,
            profitAccountId: Number(otcProfitAccountId),
          },
        }).unwrap();
      }

      // Add service charges if provided
      if (otcServiceChargeAmount && otcServiceChargeAccountId && otcServiceChargeCurrency) {
        await updateOrder({
          id: orderId,
          data: {
            serviceChargeAmount: Number(otcServiceChargeAmount),
            serviceChargeCurrency: otcServiceChargeCurrency,
            serviceChargeAccountId: Number(otcServiceChargeAccountId),
          },
        }).unwrap();
      }

      closeOtcModal();
    } catch (error: any) {
      console.error("Error saving OTC order:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to save OTC order";
      alert(errorMessage);
    }
  };

  const handleOtcOrderComplete = async (event: FormEvent) => {
    event.preventDefault();
    if (!otcForm.customerId || !otcForm.fromCurrency || !otcForm.toCurrency) return;

    // Validate handler is assigned
    const handlerId = Number(otcForm.handlerId);
    if (!otcForm.handlerId || Number.isNaN(handlerId)) {
      alert("Handler must be assigned before completing the order");
      return;
    }

    const buyAccountId =
      otcReceipts.find((r) => r.accountId)?.accountId
        ? Number(otcReceipts.find((r) => r.accountId)!.accountId)
        : accounts.find((a) => a.currencyCode === otcForm.fromCurrency)?.id;
    const sellAccountId =
      otcPayments.find((p) => p.accountId)?.accountId
        ? Number(otcPayments.find((p) => p.accountId)!.accountId)
        : accounts.find((a) => a.currencyCode === otcForm.toCurrency)?.id;
    const buyAccountIdValue = buyAccountId ?? undefined;
    const sellAccountIdValue = sellAccountId ?? undefined;
    if (!buyAccountId || !sellAccountId) {
      alert("Please select accounts for both From and To currencies before completing.");
      return;
    }

    // Validate that all receipts with amounts have accounts selected
    const receiptsWithoutAccounts = otcReceipts.filter(
      (r) => (Number(r.amount) || 0) > 0 && !r.accountId
    );
    if (receiptsWithoutAccounts.length > 0) {
      alert("All receipts with amounts must have an account selected. Please select accounts for all receipts with amounts.");
      return;
    }

    // Validate that all payments with amounts have accounts selected
    const paymentsWithoutAccounts = otcPayments.filter(
      (p) => (Number(p.amount) || 0) > 0 && !p.accountId
    );
    if (paymentsWithoutAccounts.length > 0) {
      alert("All payments with amounts must have an account selected. Please select accounts for all payments with amounts.");
      return;
    }

    // Validate receipt total equals amountBuy
    const receiptTotal = otcReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const amountBuy = Number(otcForm.amountBuy || 0);
    if (Math.abs(receiptTotal - amountBuy) > 0.01) {
      alert(`Receipt total (${receiptTotal.toFixed(2)}) must equal Amount Buy (${amountBuy.toFixed(2)})`);
      return;
    }

    // Validate payment total equals amountSell
    const paymentTotal = otcPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const amountSell = Number(otcForm.amountSell || 0);
    if (Math.abs(paymentTotal - amountSell) > 0.01) {
      alert(`Payment total (${paymentTotal.toFixed(2)}) must equal Amount Sell (${amountSell.toFixed(2)})`);
      return;
    }

    try {
      let orderId: number;
      
      // Prepare order data with remarks
      const orderData: any = {
        customerId: Number(otcForm.customerId),
        fromCurrency: otcForm.fromCurrency,
        toCurrency: otcForm.toCurrency,
        amountBuy: Number(otcForm.amountBuy || 0),
        amountSell: Number(otcForm.amountSell || 0),
        rate: Number(otcForm.rate || 1),
        handlerId,
        buyAccountId: buyAccountIdValue,
        sellAccountId: sellAccountIdValue,
      };
      
      // Handle remarks: save if not empty, regardless of whether section is shown
      if (otcRemarks && otcRemarks.trim() !== "") {
        orderData.remarks = otcRemarks.trim();
      } else if (showOtcRemarks) {
        // If section is shown but remarks are empty, set to null to remove from database
        orderData.remarks = null;
      }

      if (otcEditingOrderId) {
        // Update existing order
        await updateOrder({
          id: otcEditingOrderId,
          data: orderData,
        }).unwrap();
        orderId = otcEditingOrderId;
      } else {
        // Create new OTC order
        const newOrder = await addOrder({
          ...orderData,
          status: "pending",
          orderType: "otc",
        }).unwrap();
        orderId = newOrder.id;
      }

      // Assign handler
      await processOrder({
        id: orderId,
        handlerId: Number(otcForm.handlerId),
      }).unwrap();

      // Delete existing receipts and payments when editing, then recreate from form
      if (otcEditingOrderId && otcOrderDetails) {
        // Delete existing receipts
        for (const receipt of otcOrderDetails.receipts || []) {
          try {
            await deleteReceipt(receipt.id).unwrap();
          } catch (error) {
            console.error("Error deleting receipt:", error);
          }
        }
        // Delete existing payments
        for (const payment of otcOrderDetails.payments || []) {
          try {
            await deletePayment(payment.id).unwrap();
          } catch (error) {
            console.error("Error deleting payment:", error);
          }
        }
      }

      // Create and confirm receipts
      for (const receipt of otcReceipts) {
        const receiptAmount = Number(receipt.amount) || 0;
        if (receiptAmount !== 0 && receipt.accountId) {
          const receiptResult = await addReceipt({
            id: orderId,
            amount: receiptAmount,
            accountId: Number(receipt.accountId),
            imagePath: "",
          } as any).unwrap();
          // Confirm receipt immediately for OTC orders
          await confirmReceipt((receiptResult as any).id).unwrap();
        }
      }

      // Create and confirm payments
      for (const payment of otcPayments) {
        const paymentAmount = Number(payment.amount) || 0;
        if (paymentAmount !== 0 && payment.accountId) {
          const paymentResult = await addPayment({
            id: orderId,
            amount: paymentAmount,
            accountId: Number(payment.accountId),
            imagePath: "",
          } as any).unwrap();
          // Confirm payment immediately for OTC orders
          await confirmPayment((paymentResult as any).id).unwrap();
        }
      }

      // Add profit if provided - create draft via updateOrder and immediately confirm for OTC orders
      if (otcProfitAmount && otcProfitAccountId && otcProfitCurrency) {
        // Create draft profit via updateOrder
        await updateOrder({
          id: orderId,
          data: {
            profitAmount: Number(otcProfitAmount),
            profitCurrency: otcProfitCurrency,
            profitAccountId: Number(otcProfitAccountId),
          },
        }).unwrap();
        
        // Get the draft profit ID and confirm it
        // Use a small delay to ensure the draft is committed, then fetch order details
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const response = await fetch(`/api/orders/${orderId}/details`);
          if (response.ok) {
            const orderDetails = await response.json();
            if (orderDetails && orderDetails.profits && Array.isArray(orderDetails.profits)) {
              const draftProfit = orderDetails.profits.find((p: any) => p.status === 'draft');
              if (draftProfit && draftProfit.id) {
                await confirmProfit(draftProfit.id).unwrap();
              } else {
                console.error("Draft profit not found for order:", orderId, orderDetails.profits);
              }
            } else {
              console.error("Order details profits not found or invalid:", orderId, orderDetails);
            }
          } else {
            console.error("Failed to fetch order details for profit confirmation:", response.status);
          }
        } catch (error) {
          console.error("Error fetching order details for profit confirmation:", error);
        }
      }

      // Add service charges if provided - create draft via updateOrder and immediately confirm for OTC orders
      if (otcServiceChargeAmount && otcServiceChargeAccountId && otcServiceChargeCurrency) {
        // Create draft service charge via updateOrder
        await updateOrder({
          id: orderId,
          data: {
            serviceChargeAmount: Number(otcServiceChargeAmount),
            serviceChargeCurrency: otcServiceChargeCurrency,
            serviceChargeAccountId: Number(otcServiceChargeAccountId),
          },
        }).unwrap();
        
        // Get the draft service charge ID and confirm it
        // Use a small delay to ensure the draft is committed, then fetch order details
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const response = await fetch(`/api/orders/${orderId}/details`);
          if (response.ok) {
            const orderDetails = await response.json();
            if (orderDetails && orderDetails.serviceCharges && Array.isArray(orderDetails.serviceCharges)) {
              const draftServiceCharge = orderDetails.serviceCharges.find((sc: any) => sc.status === 'draft');
              if (draftServiceCharge && draftServiceCharge.id) {
                await confirmServiceCharge(draftServiceCharge.id).unwrap();
              } else {
                console.error("Draft service charge not found for order:", orderId, orderDetails.serviceCharges);
              }
            } else {
              console.error("Order details service charges not found or invalid:", orderId, orderDetails);
            }
          } else {
            console.error("Failed to fetch order details for service charge confirmation:", response.status);
          }
        } catch (error) {
          console.error("Error fetching order details for service charge confirmation:", error);
        }
      }

      // Ensure remarks are saved before completing (in case they weren't saved earlier)
      if (otcRemarks && otcRemarks.trim() !== "") {
        await updateOrder({
          id: orderId,
          data: {
            remarks: otcRemarks.trim(),
          },
        }).unwrap();
      } else if (showOtcRemarks && (!otcRemarks || otcRemarks.trim() === "")) {
        // If section is shown but remarks are empty, remove from database
        await updateOrder({
          id: orderId,
          data: {
            remarks: null,
          },
        }).unwrap();
      }

      // Complete the order
      await updateOrderStatus({
        id: orderId,
        status: "completed",
      }).unwrap();

      closeOtcModal();
    } catch (error: any) {
      console.error("Error completing OTC order:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to complete OTC order";
      alert(errorMessage);
    }
  };

  return {
    // State
    isOtcOrderModalOpen,
    setIsOtcOrderModalOpen,
    otcEditingOrderId,
    setOtcEditingOrderId,
    otcForm,
    setOtcForm,
    otcReceipts,
    setOtcReceipts,
    otcPayments,
    setOtcPayments,
    otcProfitAmount,
    setOtcProfitAmount,
    otcProfitCurrency,
    setOtcProfitCurrency,
    otcProfitAccountId,
    setOtcProfitAccountId,
    otcServiceChargeAmount,
    setOtcServiceChargeAmount,
    otcServiceChargeCurrency,
    setOtcServiceChargeCurrency,
    otcServiceChargeAccountId,
    setOtcServiceChargeAccountId,
    showOtcProfitSection,
    setShowOtcProfitSection,
    showOtcServiceChargeSection,
    setShowOtcServiceChargeSection,
    otcCalculatedField,
    setOtcCalculatedField,
    otcRemarks,
    setOtcRemarks,
    showOtcRemarks,
    setShowOtcRemarks,
    otcOrderDetails,
    isOtcCompleted,
    // Handlers
    handleOtcOrderSave,
    handleOtcOrderComplete,
    resetOtcForm,
    closeOtcModal,
  };
}

