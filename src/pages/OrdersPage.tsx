import { useState, type FormEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useAddOrderMutation,
  useGetCurrenciesQuery,
  useGetCustomersQuery,
  useGetOrdersQuery,
  useGetUsersQuery,
  useUpdateOrderMutation,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
  useGetOrderDetailsQuery,
  useProcessOrderMutation,
  useAddReceiptMutation,
  useAddBeneficiaryMutation,
  useAddPaymentMutation,
  useGetCustomerBeneficiariesQuery,
  useAddCustomerBeneficiaryMutation,
  useGetAccountsQuery,
  useAddCustomerMutation,
  useProceedWithPartialReceiptsMutation,
  useAdjustFlexOrderRateMutation,
} from "../services/api";
import { useGetRolesQuery } from "../services/api";
import { useAppSelector } from "../app/hooks";
import type { OrderStatus } from "../types";
import { formatDate } from "../utils/format";

export default function OrdersPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: roles = [] } = useGetRolesQuery();

  const { data: orders = [], isLoading, refetch: refetchOrders } = useGetOrdersQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: users = [] } = useGetUsersQuery();
  const { data: accounts = [] } = useGetAccountsQuery();

  // Helper function to prevent number input from changing value on scroll
  const handleNumberInputWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (document.activeElement === target) {
      target.blur();
    }
  };

  // Helper function to calculate amountSell from amountBuy using the same logic as order creation
  const calculateAmountSell = (amountBuy: number, rate: number, fromCurrency: string, toCurrency: string): number => {
    // Determine which side is the "stronger" currency so we know which way to apply the rate.
    // Heuristic: USDT (or any currency with rate <= 1) is the base; otherwise pick the currency with the smaller rate.
    const getCurrencyRate = (code: string) => {
      const currency = currencies.find((c) => c.code === code);
      const candidate =
        currency?.conversionRateBuy ??
        currency?.baseRateBuy ??
        currency?.baseRateSell ??
        currency?.conversionRateSell;
      return typeof candidate === "number" ? candidate : null;
    };

    const fromRate = getCurrencyRate(fromCurrency);
    const toRate = getCurrencyRate(toCurrency);

    const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : fromCurrency === "USDT";
    const inferredToIsUSDT = toRate !== null ? toRate <= 1 : toCurrency === "USDT";

    // If both sides look like USDT (rate <= 1), default to multiply
    if (inferredFromIsUSDT && inferredToIsUSDT) {
      return amountBuy * rate;
    }

    let baseIsFrom: boolean | null = null;
    if (inferredFromIsUSDT !== inferredToIsUSDT) {
      // One side is USDT (or behaves like it)
      baseIsFrom = inferredFromIsUSDT;
    } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
      // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
      baseIsFrom = fromRate < toRate;
    } else {
      // Default to multiply if we can't determine
      return amountBuy * rate;
    }

    if (baseIsFrom) {
      // Stronger/base currency (fromCurrency) → weaker: multiply by rate
      return amountBuy * rate;
    } else {
      // Weaker → stronger/base currency (toCurrency): divide by rate
      return amountBuy / rate;
    }
  };

  const [addOrder, { isLoading: isSaving }] = useAddOrderMutation();
  const [updateOrder] = useUpdateOrderMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();
  const [addCustomer, { isLoading: isCreatingCustomer }] = useAddCustomerMutation();
  const [processOrder] = useProcessOrderMutation();
  const [addReceipt] = useAddReceiptMutation();
  const [addBeneficiary] = useAddBeneficiaryMutation();
  const [addPayment] = useAddPaymentMutation();
  const [addCustomerBeneficiary] = useAddCustomerBeneficiaryMutation();
  const [proceedWithPartialReceipts] = useProceedWithPartialReceiptsMutation();
  const [adjustFlexOrderRate] = useAdjustFlexOrderRateMutation();

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPositionAbove, setMenuPositionAbove] = useState<{ [key: number]: boolean }>({});
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; orderId: number | null; isBulk?: boolean }>({
    isOpen: false,
    message: "",
    orderId: null,
    isBulk: false,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFlexOrderMode, setIsFlexOrderMode] = useState(false);
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [processModalOrderId, setProcessModalOrderId] = useState<number | null>(null);
  const [viewModalOrderId, setViewModalOrderId] = useState<number | null>(null);
  const [makePaymentModalOrderId, setMakePaymentModalOrderId] = useState<number | null>(null);
  
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const menuElementRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const receiptFileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const paymentFileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [calculatedField, setCalculatedField] = useState<"buy" | "sell" | null>(null);
  const [receiptUploadKey, setReceiptUploadKey] = useState(0);
  const [paymentUploadKey, setPaymentUploadKey] = useState(0);
  const [flexOrderRate, setFlexOrderRate] = useState<string>("");
  const [excessPaymentWarning, setExcessPaymentWarning] = useState<{
    excessAmount: number;
    additionalReceiptsNeeded: number;
  } | null>(null);
  const [showExcessPaymentModal, setShowExcessPaymentModal] = useState(false);
  const [excessPaymentModalData, setExcessPaymentModalData] = useState<{
    expectedPayment: number;
    actualPayment: number;
    excess: number;
    additionalReceipts: number;
    fromCurrency: string;
    toCurrency: string;
  } | null>(null);
  const [showMissingPaymentModal, setShowMissingPaymentModal] = useState(false);
  const [missingPaymentModalData, setMissingPaymentModalData] = useState<{
    expectedPayment: number;
    actualPayment: number;
    missing: number;
    toCurrency: string;
  } | null>(null);
  const [showExcessReceiptModal, setShowExcessReceiptModal] = useState(false);
  const [excessReceiptModalData, setExcessReceiptModalData] = useState<{
    expectedReceipt: number;
    attemptedReceipt: number;
    excess: number;
    fromCurrency: string;
  } | null>(null);
  const [showExcessPaymentModalNormal, setShowExcessPaymentModalNormal] = useState(false);
  const [excessPaymentModalNormalData, setExcessPaymentModalNormalData] = useState<{
    expectedPayment: number;
    attemptedPayment: number;
    excess: number;
    toCurrency: string;
  } | null>(null);
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    src: string;
    type: 'image' | 'pdf';
    title: string;
  } | null>(null);

  const [form, setForm] = useState({
    customerId: "",
    fromCurrency: "",
    toCurrency: "",
    amountBuy: "",
    amountSell: "",
    rate: "",
    status: "pending" as OrderStatus,
  });

  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [processForm, setProcessForm] = useState<{
    handlerId: string;
    paymentFlow: "receive_first" | "pay_first";
    // Commented out for future use:
    // paymentType: "CRYPTO" | "FIAT";
    // networkChain: string;
    // walletAddresses: string[];
    // bankName: string;
    // accountTitle: string;
    // accountNumber: string;
    // accountIban: string;
    // swiftCode: string;
    // bankAddress: string;
  }>({
    handlerId: "",
    paymentFlow: "receive_first",
    // Commented out for future use:
    // paymentType: "CRYPTO" as "CRYPTO" | "FIAT",
    // networkChain: "",
    // walletAddresses: [""],
    // bankName: "",
    // accountTitle: "",
    // accountNumber: "",
    // accountIban: "",
    // swiftCode: "",
    // bankAddress: "",
  });

  const [beneficiaryForm, setBeneficiaryForm] = useState({
    paymentAccountId: "",
    // Commented out for future use:
    // paymentType: "CRYPTO" as "CRYPTO" | "FIAT",
    // networkChain: "",
    // walletAddresses: [""],
    // bankName: "",
    // accountTitle: "",
    // accountNumber: "",
    // accountIban: "",
    // swiftCode: "",
    // bankAddress: "",
  });
  const [saveBeneficiaryToCustomer, setSaveBeneficiaryToCustomer] = useState(false);
  const [selectedCustomerBeneficiaryId, setSelectedCustomerBeneficiaryId] = useState<number | "">(
    "",
  );

  const applyCustomerBeneficiaryToForm = (beneficiaryId: number) => {
    // Commented out for future use - beneficiary details
    // const selected = customerBeneficiaries.find((b) => b.id === beneficiaryId);
    // if (!selected) return;
    // if (selected.paymentType === "CRYPTO") {
    //   setBeneficiaryForm({
    //     paymentType: "CRYPTO",
    //     networkChain: selected.networkChain || "",
    //     walletAddresses: selected.walletAddresses && selected.walletAddresses.length > 0
    //       ? selected.walletAddresses
    //       : [""],
    //     bankName: "",
    //     accountTitle: "",
    //     accountNumber: "",
    //     accountIban: "",
    //     swiftCode: "",
    //     bankAddress: "",
    //   });
    // } else {
    //   setBeneficiaryForm({
    //     paymentType: "FIAT",
    //     networkChain: "",
    //     walletAddresses: [""],
    //     bankName: selected.bankName || "",
    //     accountTitle: selected.accountTitle || "",
    //     accountNumber: selected.accountNumber || "",
    //     accountIban: selected.accountIban || "",
    //     swiftCode: selected.swiftCode || "",
    //     bankAddress: selected.bankAddress || "",
    //   });
    // }
  };

  const [receiptUploads, setReceiptUploads] = useState<Array<{ image: string; amount: string; accountId: string }>>([{ image: "", amount: "", accountId: "" }]);
  const [paymentUploads, setPaymentUploads] = useState<Array<{ image: string; amount: string; accountId: string }>>([{ image: "", amount: "", accountId: "" }]);
  const [receiptDragOver, setReceiptDragOver] = useState(false);
  const [paymentDragOver, setPaymentDragOver] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<"receipt" | "payment" | null>(null);

  const { data: orderDetails, refetch: refetchOrderDetails } = useGetOrderDetailsQuery(viewModalOrderId || 0, {
    skip: !viewModalOrderId,
  });

  // Initialize flex order rate when modal opens
  useEffect(() => {
    if (orderDetails?.order && orderDetails.order.isFlexOrder) {
      setFlexOrderRate(String(orderDetails.order.actualRate || orderDetails.order.rate || ""));
    }
  }, [orderDetails]);

  const resetForm = () => {
    setForm({
      customerId: "",
      fromCurrency: "",
      toCurrency: "",
      amountBuy: "",
      amountSell: "",
      rate: "",
      status: "pending",
    });
    setCalculatedField(null);
  };

  const resetProcessForm = () => {
    setProcessForm({
      handlerId: "",
      paymentFlow: "receive_first",
      // Commented out for future use:
      // paymentType: "CRYPTO",
      // networkChain: "",
      // walletAddresses: [""],
      // bankName: "",
      // accountTitle: "",
      // accountNumber: "",
      // accountIban: "",
      // swiftCode: "",
      // bankAddress: "",
    });
  };

  const resetBeneficiaryForm = () => {
    setBeneficiaryForm({
      paymentAccountId: "",
      // Commented out for future use:
      // paymentType: "CRYPTO",
      // networkChain: "",
      // walletAddresses: [""],
      // bankName: "",
      // accountTitle: "",
      // accountNumber: "",
      // accountIban: "",
      // swiftCode: "",
      // bankAddress: "",
    });
    setSaveBeneficiaryToCustomer(false);
    setSelectedCustomerBeneficiaryId("");
  };
 /*  // When fromCurrency or toCurrency changes, fetch the buy and sell rates for the selected non-USDT currency (rates are against USDT)
  useEffect(() => {
    const fetchConversionRates = async () => {
      let currency = null;
      // Only fetch for the currency that is NOT USDT, and only if one is USDT and one is not
      if (form.fromCurrency === "USDT" && form.toCurrency && form.toCurrency !== "USDT") {
        currency = form.toCurrency;
      } else if (form.toCurrency === "USDT" && form.fromCurrency && form.fromCurrency !== "USDT") {
        currency = form.fromCurrency;
      } else {
        // If both are USDT or both are non-USDT or missing, do nothing
        return;
      }
      try {
        // Replace with your actual endpoint or API method
        const response = await fetch(`/api/exchange-rates/${currency}`);
        if (!response.ok) {
          // Handles HTTP 404s or others gracefully
          console.warn(`Exchange rates endpoint not found for: ${currency}`);
          return;
        }
        // Attempt to parse only if the response is JSON
        const contentType = response.headers.get("Content-Type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(`Exchange rates response for ${currency} is not valid JSON`);
          return;
        }
        const data = await response.json();
        // Suppose the response structure is { buy: 284.5, sell: 286 }
        if (data && typeof data.buy !== 'undefined' && typeof data.sell !== 'undefined') {
          console.log(`Buy rate for ${currency} against USDT: ${data.buy}`);
          console.log(`Sell rate for ${currency} against USDT: ${data.sell}`);
        } else {
          console.log(`Could not fetch valid conversion rates for ${currency} against USDT`);
        }
      } catch (error) {
        console.log(`Error fetching conversion rates for ${currency} against USDT:`, error);
      }
    };
    fetchConversionRates();
  }, [form.fromCurrency, form.toCurrency]); */



  // Auto-calculate amount when rate or source amount changes
  useEffect(() => {
    if (!form.rate || form.rate === "0" || !calculatedField) return;
    if (!form.fromCurrency || !form.toCurrency) return;

    const rate = Number(form.rate);
    if (isNaN(rate) || rate <= 0) return;

    // Determine which side is the "stronger" currency so we know which way to apply the rate.
    // Heuristic: USDT (or any currency with rate <= 1) is the base; otherwise pick the currency with the smaller rate.
    const getCurrencyRate = (code: string) => {
      const currency = currencies.find((c) => c.code === code);
      const candidate =
        currency?.conversionRateBuy ??
        currency?.baseRateBuy ??
        currency?.baseRateSell ??
        currency?.conversionRateSell;
      return typeof candidate === "number" ? candidate : null;
    };

    const fromRate = getCurrencyRate(form.fromCurrency);
    const toRate = getCurrencyRate(form.toCurrency);

    const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : form.fromCurrency === "USDT";
    const inferredToIsUSDT = toRate !== null ? toRate <= 1 : form.toCurrency === "USDT";

    // If both sides look like USDT (rate <= 1), nothing to auto-calc
    if (inferredFromIsUSDT && inferredToIsUSDT) return;

    let baseIsFrom: boolean | null = null;
    if (inferredFromIsUSDT !== inferredToIsUSDT) {
      // One side is USDT (or behaves like it)
      baseIsFrom = inferredFromIsUSDT;
    } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
      // Neither is USDT: pick the currency with the smaller rate as the stronger/base currency
      baseIsFrom = fromRate < toRate;
    } else {
      return;
    }

    if (calculatedField === "buy" && form.amountBuy) {
      const buyAmount = Number(form.amountBuy);
      if (!isNaN(buyAmount) && buyAmount > 0) {
        let sellAmount: string;
        if (baseIsFrom) {
          // Stronger/base currency → weaker: multiply by rate
          sellAmount = (buyAmount * rate).toFixed(2);
        } else {
          // Weaker → stronger/base: divide by rate
          sellAmount = (buyAmount / rate).toFixed(2);
        }
        setForm((prev) => ({ ...prev, amountSell: sellAmount }));
      }
    } else if (calculatedField === "sell" && form.amountSell) {
      const sellAmount = Number(form.amountSell);
      if (!isNaN(sellAmount) && sellAmount > 0) {
        let buyAmount: string;
        if (baseIsFrom) {
          // Stronger/base currency → weaker: divide to get base amount
          buyAmount = (sellAmount / rate).toFixed(2);
        } else {
          // Weaker → stronger/base: multiply to get base amount
          buyAmount = (sellAmount * rate).toFixed(2);
        }
        setForm((prev) => ({ ...prev, amountBuy: buyAmount }));
      }
    }
  }, [form.rate, form.amountBuy, form.amountSell, calculatedField, form.fromCurrency, form.toCurrency, currencies]);

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
    setEditingOrderId(null);
    setIsFlexOrderMode(false);
  };

  const resetCustomerForm = () => {
    setCustomerForm({
      name: "",
      email: "",
      phone: "",
    });
  };

  const handleCreateCustomer = async (event: FormEvent) => {
    event.preventDefault();
    if (!customerForm.name) return;
    
    try {
      const newCustomer = await addCustomer({
        name: customerForm.name,
        email: customerForm.email || "",
        phone: customerForm.phone || "",
        id: undefined,
      }).unwrap();
      
      // Select the newly created customer
      if (newCustomer?.id) {
        setForm((p) => ({ ...p, customerId: String(newCustomer.id) }));
      }
      
      resetCustomerForm();
      setIsCreateCustomerModalOpen(false);
    } catch (error) {
      console.error("Error creating customer:", error);
    }
  };

  const startEdit = (orderId: number) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== "pending") return;
    
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
  };

  const closeProcessModal = () => {
    resetProcessForm();
    setProcessModalOrderId(null);
  };

  const closeViewModal = () => {
    setViewModalOrderId(null);
    setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
    setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
    setReceiptUploadKey(0);
    setPaymentUploadKey(0);
    setFlexOrderRate("");
    setExcessPaymentWarning(null);
    // Clear refs
    receiptFileInputRefs.current = {};
    paymentFileInputRefs.current = {};
  };

  const closeMakePaymentModal = () => {
    resetBeneficiaryForm();
    setMakePaymentModalOrderId(null);
    setSaveBeneficiaryToCustomer(false);
    setSelectedCustomerBeneficiaryId("");
  };

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
    
    // Only include paymentFlow for regular orders
    if (!isFlex) {
      payload.paymentFlow = processForm.paymentFlow;
    }

    // Commented out for future use:
    // paymentType: processForm.paymentType,
    // if (processForm.paymentType === "CRYPTO") {
    //   payload.networkChain = processForm.networkChain;
    //   payload.walletAddresses = processForm.walletAddresses.filter((addr) => addr.trim());
    // } else {
    //   payload.bankDetails = {
    //     bankName: processForm.bankName,
    //     accountTitle: processForm.accountTitle,
    //     accountNumber: processForm.accountNumber,
    //     accountIban: processForm.accountIban,
    //     swiftCode: processForm.swiftCode,
    //     bankAddress: processForm.bankAddress,
    //   };
    // }

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

  const handleAddReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!viewModalOrderId || !orderDetails) return;

    // Validate that all uploads with image and amount also have accountId
    for (const upload of receiptUploads) {
      if (upload.image && upload.amount) {
        if (!upload.accountId || upload.accountId === "") {
          alert(t("orders.accountSelectionRequired"));
          return;
        }
      }
    }

    // For normal orders (not flex orders), validate that total receipts don't exceed order amount
    const currentOrder = orderDetails.order;
    if (!currentOrder.isFlexOrder) {
      // Calculate total amount of new receipts being uploaded
      let newReceiptTotal = 0;
      for (const upload of receiptUploads) {
        if (upload.image && upload.amount && upload.accountId) {
          newReceiptTotal += Number(upload.amount);
        }
      }

      // Get existing total receipt amount (not balance - balance is the remaining amount)
      const existingReceiptTotal = orderDetails.totalReceiptAmount || 0;
      
      // Calculate total receipts (existing + new)
      const totalReceipts = existingReceiptTotal + newReceiptTotal;
      
      // Only block if total exceeds order amount (allow partial uploads)
      if (totalReceipts > currentOrder.amountBuy) {
        // Excess is the amount by which the total receipts (existing + new) exceed the order amount
        const excess = totalReceipts - currentOrder.amountBuy;
        setExcessReceiptModalData({
          expectedReceipt: currentOrder.amountBuy,
          attemptedReceipt: totalReceipts, // Show total (existing + new) in the modal
          excess: excess,
          fromCurrency: currentOrder.fromCurrency,
        });
        setShowExcessReceiptModal(true);
        return; // Prevent submission
      }
    }

    // Process all valid uploads
    for (const upload of receiptUploads) {
      if (upload.image && upload.amount && upload.accountId) {
        const payload: any = {
          id: viewModalOrderId,
          imagePath: upload.image,
          amount: Number(upload.amount),
          accountId: Number(upload.accountId),
        };
        
        await addReceipt(payload).unwrap();
      }
    }

    // Reset file inputs
    Object.values(receiptFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    setReceiptUploads([{ image: "", amount: "", accountId: "" }]);
    setReceiptUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    
    // Refetch both order details and orders list to update UI immediately
    await refetchOrderDetails();
    await refetchOrders();
  };

  const handleAddBeneficiary = async (event: FormEvent) => {
    event.preventDefault();
    if (!makePaymentModalOrderId || !beneficiaryForm.paymentAccountId) return;

    // Get order and account details for balance validation
    const paymentOrder = orders.find((o) => o.id === makePaymentModalOrderId);
    const selectedAccount = accounts.find((a) => a.id === Number(beneficiaryForm.paymentAccountId));
    
    if (paymentOrder && selectedAccount) {
      const requiredAmount = paymentOrder.amountSell;
      const currentBalance = selectedAccount.balance;
      
      // Check if account has insufficient funds
      if (currentBalance < requiredAmount) {
        const newBalance = currentBalance - requiredAmount;
        const confirmMessage = t("orders.insufficientBalanceWarning", {
          accountName: selectedAccount.name,
          currentBalance: currentBalance.toFixed(2),
          currency: selectedAccount.currencyCode,
          requiredAmount: requiredAmount.toFixed(2),
          newBalance: newBalance.toFixed(2)
        });
        
        if (!window.confirm(confirmMessage)) {
          return; // User cancelled
        }
      }
    }

    const payload: any = {
      id: makePaymentModalOrderId,
      paymentAccountId: Number(beneficiaryForm.paymentAccountId),
      // Commented out for future use:
      // paymentType: beneficiaryForm.paymentType,
      // if (beneficiaryForm.paymentType === "CRYPTO") {
      //   payload.networkChain = beneficiaryForm.networkChain;
      //   payload.walletAddresses = beneficiaryForm.walletAddresses.filter((addr) => addr.trim());
      // } else {
      //   payload.bankName = beneficiaryForm.bankName;
      //   payload.accountTitle = beneficiaryForm.accountTitle;
      //   payload.accountNumber = beneficiaryForm.accountNumber;
      //   payload.accountIban = beneficiaryForm.accountIban;
      //   payload.swiftCode = beneficiaryForm.swiftCode;
      //   payload.bankAddress = beneficiaryForm.bankAddress;
      // }
    };

    await addBeneficiary(payload);
    // Commented out for future use:
    // if (saveBeneficiaryToCustomer && makePaymentOrder?.customerId) {
    //   const customerPayload = { ...payload, customerId: makePaymentOrder.customerId };
    //   delete customerPayload.id;
    //   await addCustomerBeneficiary(customerPayload);
    // }
    resetBeneficiaryForm();
    const orderId = makePaymentModalOrderId;
    setMakePaymentModalOrderId(null);
    setOpenMenuId(null);
    
    // Refetch orders to get updated hasBeneficiaries flag, then open view modal
    await refetchOrders();
    setViewModalOrderId(orderId);
  };

  const handleAddPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!viewModalOrderId || !orderDetails) return;

    // Validate that all uploads have required fields
    for (const upload of paymentUploads) {
      if (upload.image && upload.amount) {
        if (!upload.accountId) {
          alert(t("orders.accountSelectionRequired"));
          return;
        }
      }
    }

    const currentOrder = orderDetails.order;
    const isFlex = currentOrder?.isFlexOrder;

    // For normal orders (not flex orders), validate that total payments don't exceed order amount
    if (!isFlex) {
      // Calculate total amount of new payments being uploaded
      let newPaymentTotal = 0;
      for (const upload of paymentUploads) {
        if (upload.image && upload.amount && upload.accountId) {
          newPaymentTotal += Number(upload.amount);
        }
      }

      // Get existing total payment amount (not balance - balance is the remaining amount)
      const existingPaymentTotal = orderDetails.totalPaymentAmount || 0;
      
      // Calculate total payments (existing + new)
      const totalPayments = existingPaymentTotal + newPaymentTotal;
      
      // Only block if total exceeds order amount (allow partial uploads)
      if (totalPayments > currentOrder.amountSell) {
        // Excess is the amount by which the total payments (existing + new) exceed the order amount
        const excess = totalPayments - currentOrder.amountSell;
        setExcessPaymentModalNormalData({
          expectedPayment: currentOrder.amountSell,
          attemptedPayment: totalPayments, // Show total (existing + new) in the modal
          excess: excess,
          toCurrency: currentOrder.toCurrency,
        });
        setShowExcessPaymentModalNormal(true);
        return; // Prevent submission
      }
    }

    // Note: Exchange rate should be updated using the "Update Exchange Rate" button
    // We don't auto-update it during payment upload to give user control

    for (const upload of paymentUploads) {
      if (upload.image && upload.amount) {
        const payload: any = {
          id: viewModalOrderId,
          imagePath: upload.image,
          amount: Number(upload.amount),
          accountId: Number(upload.accountId),
        };
        
        try {
          const result = await addPayment(payload).unwrap();
          
          // Check for excess payment warning in flex orders
          if (isFlex && (result as any).flexOrderExcess) {
            setExcessPaymentWarning({
              excessAmount: (result as any).flexOrderExcess.excessAmount,
              additionalReceiptsNeeded: (result as any).flexOrderExcess.additionalReceiptsNeeded,
            });
          }
        } catch (error) {
          console.error("Error adding payment:", error);
        }
      }
    }

    // Reset file inputs
    Object.values(paymentFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    setPaymentUploads([{ image: "", amount: "", accountId: "" }]);
    setPaymentUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    
    // Refetch order details to get updated status and payments
    await refetchOrderDetails();
    
    // Refetch orders list to get updated status
    const { data: updatedOrders } = await refetchOrders();
    const updatedOrder = updatedOrders?.find((o) => o.id === viewModalOrderId);
    
    // If order is completed and no excess warning, close the modal
    if (updatedOrder?.status === "completed" && !excessPaymentWarning) {
      setViewModalOrderId(null);
    }
  };

  const handleImageUpload = (file: File, index: number, type: "receipt" | "payment") => {
    // Check if file is an image or PDF
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    
    if (!isImage && !isPDF) {
      alert(t("orders.pleaseUploadImageOrPdf"));
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "receipt") {
        setReceiptUploads((prev) => {
          const newUploads = [...prev];
          newUploads[index] = { ...newUploads[index], image: base64 };
          return newUploads;
        });
      } else {
        setPaymentUploads((prev) => {
          const newUploads = [...prev];
          newUploads[index] = { ...newUploads[index], image: base64 };
          return newUploads;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: "receipt" | "payment") => {
    e.preventDefault();
    if (type === "receipt") {
      setReceiptDragOver(false);
    } else {
      setPaymentDragOver(false);
    }

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
    if (validFiles.length > 0) {
      handleImageUpload(validFiles[0], index, type);
    }
  };

  const handleDragOver = (e: React.DragEvent, type: "receipt" | "payment") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "receipt") {
      setReceiptDragOver(true);
    } else {
      setPaymentDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent, type: "receipt" | "payment") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "receipt") {
      setReceiptDragOver(false);
    } else {
      setPaymentDragOver(false);
    }
  };

  // Handle paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste when modal is open
      if (!viewModalOrderId && !makePaymentModalOrderId) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Determine which upload type is active based on which modal is open
            const uploadType = activeUploadType || (viewModalOrderId ? "receipt" : "payment");
            
            if (uploadType === "receipt") {
              setReceiptUploads((prev) => {
                const emptyIndex = prev.findIndex(u => !u.image);
                const targetIndex = emptyIndex !== -1 ? emptyIndex : prev.length;
                
                // Process the image upload
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = reader.result as string;
                  setReceiptUploads((current) => {
                    const updated = [...current];
                    if (!updated[targetIndex]) {
                      updated[targetIndex] = { image: "", amount: "", accountId: "" };
                    }
                    updated[targetIndex] = { ...updated[targetIndex], image: base64 };
                    return updated;
                  });
                };
                reader.readAsDataURL(file);
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  return [...prev, { image: "", amount: "", accountId: "" }];
                }
                return prev;
              });
            } else {
              setPaymentUploads((prev) => {
                const emptyIndex = prev.findIndex(u => !u.image);
                const targetIndex = emptyIndex !== -1 ? emptyIndex : prev.length;
                
                // Process the image upload
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = reader.result as string;
                  setPaymentUploads((current) => {
                    const updated = [...current];
                    if (!updated[targetIndex]) {
                      updated[targetIndex] = { image: "", amount: "", accountId: "" };
                    }
                    const existing = updated[targetIndex];
                    updated[targetIndex] = { image: base64, amount: existing.amount, accountId: existing.accountId };
                    return updated;
                  });
                };
                reader.readAsDataURL(file);
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  return [...prev, { image: "", amount: "", accountId: "" }];
                }
                return prev;
              });
            }
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [viewModalOrderId, makePaymentModalOrderId, activeUploadType]);

  const setStatus = async (id: number, status: OrderStatus) => {
    await updateOrderStatus({ id, status });
    setOpenMenuId(null);
  };

  const handleDeleteClick = (id: number) => {
    setConfirmModal({
      isOpen: true,
      message: t("orders.confirmDeleteOrder") || "Are you sure you want to delete this order?",
      orderId: id,
      isBulk: false,
    });
    setOpenMenuId(null);
  };

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
      await refetchOrders();
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

  const currentRole = roles.find((r) => r.name === authUser?.role);
  const canCancelOrder = Boolean(currentRole?.permissions?.actions?.cancelOrder);
  const canDeleteOrder = Boolean(currentRole?.permissions?.actions?.deleteOrder);
  const canDeleteManyOrders = Boolean(currentRole?.permissions?.actions?.deleteManyOrders);

  const getActionButtons = (order: typeof orders[0]) => {
    const buttons = [];
    
    if (order.status === "pending") {
      buttons.push(
        <button
          key="edit"
          className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => startEdit(order.id)}
        >
          {t("common.edit")}
        </button>
      );
      buttons.push(
        <button
          key="process"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50"
          onClick={() => {
            setProcessModalOrderId(order.id);
            setOpenMenuId(null);
          }}
        >
          {t("orders.process")}
        </button>
      );
    }

    if (order.status === "waiting_for_receipt") {
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => {
            setViewModalOrderId(order.id);
            setOpenMenuId(null);
          }}
        >
          {t("orders.view")}
        </button>
      );
    }

    if (order.status === "waiting_for_payment") {
      // Show View button - accounts are selected when uploading payments
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => {
            setViewModalOrderId(order.id);
            setOpenMenuId(null);
          }}
        >
          {t("orders.view")}
        </button>
      );
    }

    if (order.status === "under_process") {
      // Show View button for flex orders under process
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => {
            setViewModalOrderId(order.id);
            setOpenMenuId(null);
          }}
        >
          {t("orders.view")}
        </button>
      );
    }

    if (order.status === "completed" || order.status === "cancelled") {
      buttons.push(
        <button
          key="view"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
          onClick={() => {
            setViewModalOrderId(order.id);
            setOpenMenuId(null);
          }}
        >
          {t("orders.view")}
        </button>
      );
    }

    // Don't show Cancel button for completed or cancelled orders or when role lacks permission
    if (canCancelOrder && order.status !== "completed" && order.status !== "cancelled") {
      buttons.push(
        <button
          key="cancel"
          className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-slate-50"
          onClick={() => setStatus(order.id, "cancelled")}
        >
          {t("orders.cancel")}
        </button>
      );
    }

    if (canDeleteOrder) {
      buttons.push(
        <button
          key="delete"
          className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 last:rounded-b-lg border-t border-slate-200"
          onClick={() => handleDeleteClick(order.id)}
          disabled={isDeleting}
        >
          {isDeleting ? t("common.deleting") : t("orders.delete")}
        </button>
      );
    }

    return buttons;
  };

  const getStatusTone = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return "amber";
      case "waiting_for_receipt":
      case "waiting_for_payment":
      case "under_process":
        return "blue";
      case "completed":
        return "emerald";
      case "cancelled":
        return "rose";
      default:
        return "slate";
    }
  };

  // Helper function to open PDF data URI in a new tab
  const openPdfInNewTab = (dataUri: string) => {
    try {
      // Convert data URI to blob
      const byteString = atob(dataUri.split(',')[1]);
      const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      
      // Open in new tab
      const newWindow = window.open(url, '_blank');
      if (newWindow) {
        // Clean up the object URL after a delay to allow the browser to load it
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } else {
        // If popup blocked, revoke immediately
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      // Fallback: try opening directly
      window.open(dataUri, '_blank');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId !== null) {
        const menuElement = menuRefs.current[openMenuId];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  // Calculate menu position (above or below) when it opens
  useEffect(() => {
    if (openMenuId !== null) {
      const buttonElement = menuRefs.current[openMenuId];
      const menuElement = menuElementRefs.current[openMenuId];
      
      if (buttonElement) {
        // Use requestAnimationFrame to ensure menu is rendered
        requestAnimationFrame(() => {
          const buttonRect = buttonElement.getBoundingClientRect();
          const menuHeight = menuElement?.offsetHeight || 200; // Approximate height if not measured yet
          const spaceBelow = window.innerHeight - buttonRect.bottom;
          const spaceAbove = buttonRect.top;
          
          // Position above if there's not enough space below, or if there's more space above
          const shouldPositionAbove = spaceBelow < menuHeight + 10 && spaceAbove > spaceBelow;
          
          setMenuPositionAbove(prev => ({
            ...prev,
            [openMenuId]: shouldPositionAbove
          }));
        });
      }
    }
  }, [openMenuId]);

  // Handle Esc key to close view modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewModalOrderId) {
        closeViewModal();
      }
    };

    if (viewModalOrderId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [viewModalOrderId]);

  // Handle Esc key to close create order modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
        resetForm();
        setEditingOrderId(null);
        setIsFlexOrderMode(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [isModalOpen]);

  // Handle Esc key to close process order modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && processModalOrderId) {
        closeProcessModal();
      }
    };

    if (processModalOrderId) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [processModalOrderId]);

  // Handle Esc key to close viewer modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewerModal) {
        setViewerModal(null);
      }
    };

    if (viewerModal) {
      document.addEventListener("keydown", handleEscKey);
      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [viewerModal]);

  const currentOrder = orders.find((o) => o.id === viewModalOrderId);
  const makePaymentOrder = orders.find((o) => o.id === makePaymentModalOrderId);
  const isWaitingForReceipt = currentOrder?.status === "waiting_for_receipt";
  const isWaitingForPayment = currentOrder?.status === "waiting_for_payment";
  const isUnderProcess = currentOrder?.status === "under_process";

  const { data: customerBeneficiaries = [] } = useGetCustomerBeneficiariesQuery(
    makePaymentOrder?.customerId ?? 0,
    { skip: !makePaymentOrder?.customerId },
  );

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("orders.title")}
        description={t("orders.description")}
        actions={
          <div className="flex items-center gap-4">
            {isLoading ? t("common.loading") : `${orders.length} ${t("orders.orders")}`}
            <button
              onClick={() => {
                setIsFlexOrderMode(false);
                setIsModalOpen(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
            >
              {t("orders.createOrder")}
            </button>
            <button
              onClick={() => {
                setIsFlexOrderMode(true);
                setIsModalOpen(true);
              }}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 transition-colors"
            >
              {t("orders.createFlexOrder")}
            </button>
            {canDeleteManyOrders && (
              <button
                onClick={async () => {
                  if (!isBatchDeleteMode) {
                    // Enable batch delete mode
                    setIsBatchDeleteMode(true);
                  } else {
                    // Delete selected orders
                    if (!selectedOrderIds.length) return;
                    setConfirmModal({
                      isOpen: true,
                      message: t("orders.confirmDeleteOrder") || "Are you sure you want to delete the selected orders?",
                      orderId: -1,
                      isBulk: true,
                    });
                  }
                }}
                disabled={isDeleting || (isBatchDeleteMode && !selectedOrderIds.length)}
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                {isDeleting 
                  ? t("common.deleting") 
                  : isBatchDeleteMode 
                    ? t("orders.deleteSelected") 
                    : t("orders.batchDelete")}
              </button>
            )}
          </div>
        }
      >
{/* REMOVE THE BELOW DIV TO THIS ONE IF DON'T WANT HEIGHT FULL
        <div className="overflow-x-auto">
         */}
        <div className="overflow-x-auto min-h-[60vh]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                {canDeleteManyOrders && isBatchDeleteMode && (
                  <th className="py-2 w-8">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={
                        !!orders.length &&
                        selectedOrderIds.length === orders.length
                      }
                      onChange={(e) =>
                        setSelectedOrderIds(
                          e.target.checked ? orders.map((o) => o.id) : [],
                        )
                      }
                    />
                  </th>
                )}
                <th className="py-2">{t("orders.date")}</th>
                <th className="py-2">{t("orders.handler")}</th>
                <th className="py-2">{t("orders.customer")}</th>
                <th className="py-2">{t("orders.pair")}</th>
                <th className="py-2">{t("orders.buy")}</th>
                <th className="py-2">{t("orders.sell")}</th>
                <th className="py-2">{t("orders.rate")}</th>
                <th className="py-2">{t("orders.status")}</th>
                <th className="py-2">{t("orders.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  {canDeleteManyOrders && isBatchDeleteMode && (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrderIds((prev) =>
                              prev.includes(order.id)
                                ? prev
                                : [...prev, order.id],
                            );
                          } else {
                            setSelectedOrderIds((prev) =>
                              prev.filter((id) => id !== order.id),
                            );
                          }
                        }}
                      />
                    </td>
                  )}
                  <td className="py-2">{formatDate(order.createdAt)}</td>
                  <td className="py-2">
                    {order.handlerName ? (
                      order.handlerName
                    ) : (
                      <span className="text-rose-600">
                        {t("orders.noHandlerAssigned")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-semibold">
                    <div className="flex items-center gap-2">
                      {order.customerName || order.customerId}
                      {order.isFlexOrder && (
                        <Badge tone="purple">
                          Flex Order
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2">
                    {order.fromCurrency} → {order.toCurrency}
                  </td>
                  <td className="py-2">
                    {order.isFlexOrder && order.actualAmountBuy ? (
                      <span>
                        <span className="text-purple-600 font-semibold">{Math.round(order.actualAmountBuy)}</span>
                        <span className="text-slate-400 text-xs ml-1 line-through">{Math.round(order.amountBuy)}</span>
                      </span>
                    ) : (
                      Math.round(order.amountBuy)
                    )}
                  </td>
                  <td className="py-2">
                    {order.isFlexOrder && order.actualAmountSell ? (
                      <span>
                        -<span className="text-purple-600 font-semibold">{Math.round(order.actualAmountSell)}</span>
                        <span className="text-slate-400 text-xs ml-1 line-through">{Math.round(order.amountSell)}</span>
                      </span>
                    ) : (
                      `-${Math.round(order.amountSell)}`
                    )}
                  </td>
                  <td className="py-2">
                    {order.isFlexOrder && order.actualRate ? (
                      <span>
                        <span className="text-purple-600 font-semibold">{order.actualRate}</span>
                        <span className="text-slate-400 text-xs ml-1 line-through">{order.rate}</span>
                      </span>
                    ) : (
                      order.rate
                    )}
                  </td>
                  <td className="py-2">
                    <Badge tone={getStatusTone(order.status)}>
                      {t(`orders.${order.status}`)}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <div
                      className="relative inline-block"
                      ref={(el) => {
                        menuRefs.current[order.id] = el;
                      }}
                    >
                      <button
                        className="flex items-center justify-center p-1 hover:bg-slate-100 rounded transition-colors"
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === order.id ? null : order.id,
                          )
                        }
                        aria-label={t("orders.actions")}
                      >
                        <svg
                          className="w-5 h-5 text-slate-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {openMenuId === order.id && (
                        <div 
                          ref={(el) => {
                            menuElementRefs.current[order.id] = el;
                          }}
                          className={`absolute right-0 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] ${
                            menuPositionAbove[order.id] ? 'bottom-full mb-1' : 'top-0'
                          }`}
                        >
                          {getActionButtons(order)}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={8}>
                    {t("orders.noOrders")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Create Order Modal */}
      {isModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingOrderId 
                  ? t("orders.editOrderTitle") 
                  : isFlexOrderMode 
                    ? t("orders.createFlexOrder") 
                    : t("orders.createOrderTitle")}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={submit}>
              <div className="col-span-full flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customerId: e.target.value }))
                  }
                  required
                >
                  <option value="">{t("orders.selectCustomer")}</option>
                  {customers.map((customer) => (
                    <option value={customer.id} key={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreateCustomerModalOpen(true)}
                  className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  {t("orders.createNewCustomer")}
                </button>
              </div>
              <div className="col-span-full grid grid-cols-2 gap-3">
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  value={form.fromCurrency}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fromCurrency: e.target.value }))
                  }
                  required
                >
                  <option value="">{t("orders.from")}</option>
                  {currencies
                    .filter((currency) => Boolean(currency.active) && currency.code !== form.toCurrency)
                    .map((currency) => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code}
                      </option>
                    ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  value={form.toCurrency}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, toCurrency: e.target.value }))
                  }
                  required
                >
                  <option value="">{t("orders.to")}</option>
                  {currencies
                    .filter((currency) => Boolean(currency.active) && currency.code !== form.fromCurrency)
                    .map((currency) => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code}
                      </option>
                    ))}
                </select>
              </div>
              <input
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("orders.exchangeRate")}
                value={form.rate}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((p) => ({ ...p, rate: value }));
                  if (!value) {
                    setCalculatedField(null);
                  }
                }}
                required
                type="number"
                step="0.0001"
                onWheel={handleNumberInputWheel}
              />
              <div className="col-span-full grid grid-cols-2 gap-3">
                <input
                  className={`rounded-lg border border-slate-200 px-3 py-2 ${
                    calculatedField === "sell"
                      ? "bg-slate-50 cursor-not-allowed"
                      : ""
                  }`}
                  placeholder={t("orders.amountBuy")}
                  value={form.amountBuy}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => ({ ...p, amountBuy: value }));
                    if (value && form.rate) {
                      const rate = Number(form.rate);
                      if (!isNaN(rate) && rate > 0) {
                        const buyAmount = Number(value);
                        if (!isNaN(buyAmount) && buyAmount > 0) {
                          const sellAmount = (buyAmount * rate).toFixed(4);
                          setForm((p) => ({ ...p, amountSell: sellAmount }));
                        }
                      }
                      setCalculatedField("buy");
                    } else if (!value) {
                      setCalculatedField(null);
                      setForm((p) => ({ ...p, amountSell: "" }));
                    }
                  }}
                  readOnly={calculatedField === "sell"}
                  required
                  type="number"
                  onWheel={handleNumberInputWheel}
                />
                <input
                  className={`rounded-lg border border-slate-200 px-3 py-2 ${
                    calculatedField === "buy"
                      ? "bg-slate-50 cursor-not-allowed"
                      : ""
                  }`}
                  placeholder={t("orders.amountSell")}
                  value={form.amountSell}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => ({ ...p, amountSell: value }));
                    if (value && form.rate) {
                      const rate = Number(form.rate);
                      if (!isNaN(rate) && rate > 0) {
                        const sellAmount = Number(value);
                        if (!isNaN(sellAmount) && sellAmount > 0) {
                          const buyAmount = (sellAmount / rate).toFixed(4);
                          setForm((p) => ({ ...p, amountBuy: buyAmount }));
                        }
                      }
                      setCalculatedField("sell");
                    } else if (!value) {
                      setCalculatedField(null);
                      setForm((p) => ({ ...p, amountBuy: "" }));
                    }
                  }}
                  readOnly={calculatedField === "buy"}
                  required
                  type="number"
                  onWheel={handleNumberInputWheel}
                />
              </div>
              <div className="col-span-full flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isSaving ? t("common.saving") : editingOrderId ? t("orders.updateOrder") : t("orders.saveOrder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {isCreateCustomerModalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.createNewCustomerTitle")}
              </h2>
              <button
                onClick={() => {
                  setIsCreateCustomerModalOpen(false);
                  resetCustomerForm();
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={handleCreateCustomer}>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("customers.name")}
                value={customerForm.name}
                onChange={(e) =>
                  setCustomerForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("customers.email")}
                type="email"
                value={customerForm.email}
                onChange={(e) =>
                  setCustomerForm((p) => ({ ...p, email: e.target.value }))
                }
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder={t("customers.phone")}
                type="tel"
                value={customerForm.phone}
                onChange={(e) =>
                  setCustomerForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateCustomerModalOpen(false);
                    resetCustomerForm();
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {isCreatingCustomer ? t("common.saving") : t("customers.createCustomer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Order Modal */}
      {processModalOrderId && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.processOrderTitle")}
              </h2>
              <button
                onClick={closeProcessModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={handleProcess}>
              <select
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                value={processForm.handlerId}
                onChange={(e) =>
                  setProcessForm((p) => ({ ...p, handlerId: e.target.value }))
                }
                required
              >
                <option value="">{t("orders.selectHandler")}</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>

              {/* Payment Flow Selection - Only for regular orders */}
              {(() => {
                const currentOrder = orders.find((o) => o.id === processModalOrderId);
                if (currentOrder?.isFlexOrder) {
                  return null; // Hide payment flow selection for flex orders
                }
                return (
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("orders.paymentFlow")}
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentFlow"
                          value="receive_first"
                          checked={processForm.paymentFlow === "receive_first"}
                          onChange={(e) =>
                            setProcessForm((p) => ({
                              ...p,
                              paymentFlow: e.target.value as "receive_first" | "pay_first",
                            }))
                          }
                          className="mr-2"
                        />
                        {t("orders.receiveFirst")}
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentFlow"
                          value="pay_first"
                          checked={processForm.paymentFlow === "pay_first"}
                          onChange={(e) =>
                            setProcessForm((p) => ({
                              ...p,
                              paymentFlow: e.target.value as "receive_first" | "pay_first",
                            }))
                          }
                          className="mr-2"
                        />
                        {t("orders.payFirst")}
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* Commented out for future use - CRYPTO/FIAT payment type selection */}
              {/* 
              <div className="col-span-full">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("orders.paymentType")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentType"
                      value="CRYPTO"
                      checked={processForm.paymentType === "CRYPTO"}
                      onChange={(e) =>
                        setProcessForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.crypto")}
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentType"
                      value="FIAT"
                      checked={processForm.paymentType === "FIAT"}
                      onChange={(e) =>
                        setProcessForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.fiat")}
                  </label>
                </div>
              </div>

              {processForm.paymentType === "CRYPTO" ? (
                <>
                  <select
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    value={processForm.networkChain}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        networkChain: e.target.value,
                      }))
                    }
                  >
                    <option value="">{t("orders.selectNetworkChain")}</option>
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                    <option value="POLYGON">POLYGON</option>
                  </select>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("orders.walletAddresses")}
                    </label>
                    {processForm.walletAddresses.map((addr, index) => (
                      <div key={index} className="mb-2">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          placeholder={t("orders.walletAddress")}
                          value={addr}
                          onChange={(e) => {
                            const newAddresses = [...processForm.walletAddresses];
                            newAddresses[index] = e.target.value;
                            setProcessForm((p) => ({
                              ...p,
                              walletAddresses: newAddresses,
                            }));
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setProcessForm((p) => ({
                          ...p,
                          walletAddresses: [...p.walletAddresses, ""],
                        }))
                      }
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {t("orders.addAnotherAddress")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankName")}
                    value={processForm.bankName}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        bankName: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountTitle")}
                    value={processForm.accountTitle}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        accountTitle: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountNumber")}
                    value={processForm.accountNumber}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        accountNumber: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountIban")}
                    value={processForm.accountIban}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        accountIban: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.swiftCode")}
                    value={processForm.swiftCode}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        swiftCode: e.target.value,
                      }))
                    }
                  />
                  <textarea
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankAddress")}
                    value={processForm.bankAddress}
                    onChange={(e) =>
                      setProcessForm((p) => ({
                        ...p,
                        bankAddress: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </>
              )}
              */}

              <div className="col-span-full flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeProcessModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                >
                  {t("orders.processOrder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {viewModalOrderId && orderDetails && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.orderDetails")}
              </h2>
              <button
                onClick={closeViewModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
            <div className={orderDetails.order.isFlexOrder ? "grid grid-cols-1 lg:grid-cols-3 gap-4" : "space-y-4"}>
              {/* For flex orders, show both receipt and payment sections */}
              {orderDetails.order.isFlexOrder ? (
                <>
                  {/* Main Content - Left Side */}
                  <div className="lg:col-span-2 space-y-4">
                  {/* Receipt Upload Section for Flex Orders */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Receipt Uploads (Flex Order)
                    </h3>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountBuy")}: {orderDetails.order.amountBuy}
                      {orderDetails.order.actualAmountBuy && (
                        <span className="ml-2 text-purple-600">
                          (Actual: {orderDetails.order.actualAmountBuy})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountReceived")}: {orderDetails.totalReceiptAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.receiptBalance.toFixed(2)}
                    </div>

                    {orderDetails.receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="mb-4 p-3 border border-slate-200 rounded-lg"
                      >
                        {receipt.imagePath.startsWith('data:image/') ? (
                          <img
                            src={receipt.imagePath}
                            alt="Receipt"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: receipt.imagePath,
                              type: 'image',
                              title: t("orders.receiptUploads")
                            })}
                          />
                        ) : receipt.imagePath.startsWith('data:application/pdf') ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(receipt.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {receipt.amount}
                        </p>
                        {receipt.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {receipt.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                      <form onSubmit={handleAddReceipt} className="mt-4">
                      {receiptUploads.map((upload, index) => (
                        <div
                          key={`${receiptUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                            receiptDragOver && index === receiptUploads.length - 1
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200"
                          }`}
                          onDrop={(e) => {
                            handleDrop(e, index, "receipt");
                            setActiveUploadType(null);
                          }}
                          onDragOver={(e) => {
                            handleDragOver(e, "receipt");
                            setActiveUploadType("receipt");
                          }}
                          onDragLeave={(e) => {
                            handleDragLeave(e, "receipt");
                            setActiveUploadType(null);
                          }}
                          onFocus={() => setActiveUploadType("receipt")}
                          onClick={() => setActiveUploadType("receipt")}
                        >
                          {(!upload.image && !upload.amount && !upload.accountId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newUploads = receiptUploads.filter((_, i) => i !== index);
                                setReceiptUploads(newUploads);
                              }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-300 flex items-center justify-center text-sm font-bold z-10"
                              title={t("common.delete")}
                            >
                              −
                            </button>
                          )}
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop file here (image or PDF), paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <div className="relative mb-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              key={`receipt-file-${receiptUploadKey}-${index}`}
                              ref={(el) => {
                                receiptFileInputRefs.current[index] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(file, index, "receipt");
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id={`receipt-file-input-${receiptUploadKey}-${index}`}
                            />
                            <label
                              htmlFor={`receipt-file-input-${receiptUploadKey}-${index}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 border-dashed rounded-lg text-blue-700 font-medium cursor-pointer transition-colors"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                              </svg>
                              <span>Choose File (Image or PDF)</span>
                            </label>
                          </div>
                          {upload.image && (
                            <div className="relative mb-2">
                              {upload.image.startsWith('data:image/') ? (
                                <img
                                  src={upload.image}
                                  alt="Preview"
                                  className="max-w-full max-h-96 w-auto h-auto object-contain rounded"
                                />
                              ) : upload.image.startsWith('data:application/pdf') ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-slate-200 rounded-lg">
                                  <svg
                                    className="w-16 h-16 text-red-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                  <p className="text-xs text-slate-500 mt-1">Ready to upload</p>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newUploads = [...receiptUploads];
                                  newUploads[index] = { image: "", amount: "", accountId: "" };
                                  setReceiptUploads(newUploads);
                                  // Reset file input
                                  if (receiptFileInputRefs.current[index]) {
                                    receiptFileInputRefs.current[index]!.value = "";
                                  }
                                }}
                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                title={t("common.cancel")}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onWheel={handleNumberInputWheel}
                            onChange={(e) => {
                              const newUploads = [...receiptUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setReceiptUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                            required
                          />
                          {(() => {
                            const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                            return (
                              <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                                value={upload.accountId}
                                onChange={(e) => {
                                  const newUploads = [...receiptUploads];
                                  newUploads[index] = {
                                    ...newUploads[index],
                                    accountId: e.target.value,
                                  };
                                  setReceiptUploads(newUploads);
                                }}
                                required
                              >
                                <option value="">
                                  {t("orders.selectReceiptAccount")} ({currentOrder?.fromCurrency || ""}) *
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === currentOrder?.fromCurrency)
                                  .map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                    </option>
                                  ))}
                              </select>
                            );
                            })()}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setReceiptUploads([
                              ...receiptUploads,
                              { image: "", amount: "", accountId: "" },
                            ])
                          }
                          className="text-sm text-blue-600 hover:underline mb-2"
                        >
                          {t("orders.addAnotherReceipt")}
                        </button>
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                        >
                          {t("orders.uploadReceipts")}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Payment Upload Section for Flex Orders */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Payment Uploads (Flex Order)
                    </h3>
                    {excessPaymentWarning && (
                      <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                        <p className="text-sm font-semibold text-amber-900 mb-2">
                          ⚠️ Payment Exceeds Expected Amount
                        </p>
                        <div className="text-sm text-amber-800 space-y-1">
                          <p>
                            Excess Payment: {excessPaymentWarning.excessAmount.toFixed(2)}{" "}
                            {orderDetails.order.toCurrency}
                          </p>
                          <p>
                            Additional Receipts Required: {excessPaymentWarning.additionalReceiptsNeeded.toFixed(2)}{" "}
                            {orderDetails.order.fromCurrency}
                          </p>
                          <p className="text-xs text-amber-700 mt-2">
                            Please upload receipts for the additional amount before completing this order.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountSell")}: -{orderDetails.order.actualAmountSell || orderDetails.order.amountSell}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountPaid")}: {orderDetails.totalPaymentAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.paymentBalance.toFixed(2)}
                    </div>

                    {orderDetails.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="mb-4 p-3 border border-slate-200 rounded-lg"
                      >
                        {payment.imagePath.startsWith('data:image/') ? (
                          <img
                            src={payment.imagePath}
                            alt="Payment"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: payment.imagePath,
                              type: 'image',
                              title: t("orders.paymentUploads")
                            })}
                          />
                        ) : payment.imagePath.startsWith('data:application/pdf') ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(payment.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {payment.amount}
                        </p>
                        {payment.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {payment.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                      <form onSubmit={handleAddPayment} className="mt-4">
                      {paymentUploads.map((upload, index) => (
                        <div
                          key={`${paymentUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                            paymentDragOver && index === paymentUploads.length - 1
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200"
                          }`}
                          onDrop={(e) => {
                            handleDrop(e, index, "payment");
                            setActiveUploadType(null);
                          }}
                          onDragOver={(e) => {
                            handleDragOver(e, "payment");
                            setActiveUploadType("payment");
                          }}
                          onDragLeave={(e) => {
                            handleDragLeave(e, "payment");
                            setActiveUploadType(null);
                          }}
                          onFocus={() => setActiveUploadType("payment")}
                          onClick={() => setActiveUploadType("payment")}
                        >
                          {(!upload.image && !upload.amount && !upload.accountId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newUploads = paymentUploads.filter((_, i) => i !== index);
                                setPaymentUploads(newUploads);
                              }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-300 flex items-center justify-center text-sm font-bold z-10"
                              title={t("common.delete")}
                            >
                              −
                            </button>
                          )}
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop file here (image or PDF), paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <div className="relative mb-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              key={`payment-file-${paymentUploadKey}-${index}`}
                              ref={(el) => {
                                paymentFileInputRefs.current[index] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(file, index, "payment");
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id={`payment-file-input-${paymentUploadKey}-${index}`}
                            />
                            <label
                              htmlFor={`payment-file-input-${paymentUploadKey}-${index}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-50 hover:bg-green-100 border-2 border-green-300 border-dashed rounded-lg text-green-700 font-medium cursor-pointer transition-colors"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                              </svg>
                              <span>Choose File (Image or PDF)</span>
                            </label>
                          </div>
                          {upload.image && (
                            <div className="relative mb-2">
                              {upload.image.startsWith('data:image/') ? (
                                <img
                                  src={upload.image}
                                  alt="Preview"
                                  className="max-w-full max-h-96 w-auto h-auto object-contain rounded"
                                />
                              ) : upload.image.startsWith('data:application/pdf') ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-slate-200 rounded-lg">
                                  <svg
                                    className="w-16 h-16 text-red-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                  <p className="text-xs text-slate-500 mt-1">Ready to upload</p>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newUploads = [...paymentUploads];
                                  newUploads[index] = { image: "", amount: "", accountId: "" };
                                  setPaymentUploads(newUploads);
                                  // Reset file input
                                  if (paymentFileInputRefs.current[index]) {
                                    paymentFileInputRefs.current[index]!.value = "";
                                  }
                                }}
                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                title={t("common.cancel")}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onWheel={handleNumberInputWheel}
                            onChange={(e) => {
                              const newUploads = [...paymentUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setPaymentUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                            required
                          />
                          {(() => {
                            const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                            return (
                              <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                                value={upload.accountId}
                                onChange={(e) => {
                                  const newUploads = [...paymentUploads];
                                  newUploads[index] = {
                                    ...newUploads[index],
                                    accountId: e.target.value,
                                  };
                                  setPaymentUploads(newUploads);
                                }}
                                required
                              >
                                <option value="">
                                  {t("orders.selectPaymentAccount")} ({currentOrder?.toCurrency || ""}) *
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === currentOrder?.toCurrency)
                                  .map((account) => {
                                    const hasInsufficientBalance = currentOrder && account.balance < Number(upload.amount || 0);
                                    return (
                                      <option key={account.id} value={account.id}>
                                        {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                        {hasInsufficientBalance ? ` ⚠️ ${t("orders.insufficient")}` : ""}
                                      </option>
                                    );
                                  })}
                              </select>
                            );
                            })()}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentUploads([
                              ...paymentUploads,
                              { image: "", amount: "", accountId: "" },
                            ])
                          }
                          className="text-sm text-blue-600 hover:underline mb-2"
                        >
                          {t("orders.addAnotherPayment")}
                        </button>
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                        >
                          {t("orders.uploadPayments")}
                        </button>
                      </form>
                    )}
                  </div>
                  </div>

                  {/* Purple Section - Right Side, Sticky */}
                  {orderDetails.order.isFlexOrder && (
                    <div className="lg:col-span-1">
                      <div className="sticky top-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm font-semibold text-purple-900 mb-2">
                          Flex Order - Adjust Exchange Rate
                        </p>
                        <div className="grid grid-cols-1 gap-4 mb-2">
                          <div className="text-sm text-purple-700">
                            <span className="font-medium">Expected To Receive:</span>{" "}
                            {orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy}{" "}
                            {orderDetails.order.fromCurrency}
                          </div>
                          <div className="text-sm text-purple-700 flex items-center gap-2">
                            <span className="font-medium">Exchange Rate:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={flexOrderRate || orderDetails.order.actualRate || orderDetails.order.rate}
                              onChange={(e) => setFlexOrderRate(e.target.value)}
                              onWheel={handleNumberInputWheel}
                              className="w-24 rounded border border-purple-300 px-2 py-1"
                              placeholder={String(orderDetails.order.actualRate || orderDetails.order.rate)}
                              disabled={orderDetails.order.status === "completed" || orderDetails.order.status === "cancelled"}
                            />
                            {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  const rateToUse = flexOrderRate || String(orderDetails.order.actualRate || orderDetails.order.rate);
                                  if (!rateToUse) {
                                    alert(t("orders.pleaseEnterExchangeRate"));
                                    return;
                                  }
                                  const rateValue = Number(rateToUse);
                                  if (isNaN(rateValue) || rateValue <= 0) {
                                    alert(t("orders.pleaseEnterValidExchangeRate"));
                                    return;
                                  }
                                  try {
                                    await adjustFlexOrderRate({
                                      id: viewModalOrderId,
                                      rate: rateValue,
                                    }).unwrap();
                                    await refetchOrderDetails();
                                    await refetchOrders();
                                    alert(t("orders.exchangeRateUpdatedSuccessfully"));
                                  } catch (error) {
                                    console.error("Error updating exchange rate:", error);
                                    alert(t("orders.failedToUpdateExchangeRate"));
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                              >
                                {t("orders.updateRate")}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-purple-800 font-medium mb-4">
                          {t("orders.expectedToPay")}:{" "}
                          {calculateAmountSell(
                            orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy,
                            Number(flexOrderRate || orderDetails.order.actualRate || orderDetails.order.rate),
                            orderDetails.order.fromCurrency,
                            orderDetails.order.toCurrency
                          ).toFixed(2)}{" "}
                          {orderDetails.order.toCurrency}
                        </div>
                        <div className="mt-4 pt-4 border-t border-purple-300">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-purple-700 font-medium">{t("orders.amountBuy")}:</span>
                              <span className="text-purple-900 font-semibold">
                                {orderDetails.order.amountBuy}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Expected Amount Receipt:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Actual Amount Receipt:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.totalReceiptAmount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Balance Amount:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.receiptBalance.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between mt-3 pt-3 border-t border-purple-200">
                              <span className="text-purple-700 font-medium">{t("orders.amountSell")}:</span>
                              <span className="text-purple-900 font-semibold">
                                -{orderDetails.order.amountSell}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Expected Payment Amount:</span>
                              <span className="text-purple-800 text-xs">
                                {calculateAmountSell(
                                  orderDetails.totalReceiptAmount,
                                  Number(flexOrderRate || orderDetails.order.actualRate || orderDetails.order.rate),
                                  orderDetails.order.fromCurrency,
                                  orderDetails.order.toCurrency
                                ).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Actual Payment Amount:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.totalPaymentAmount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-purple-600 text-xs">Payment Balance:</span>
                              <span className="text-purple-800 text-xs">
                                {orderDetails.paymentBalance.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Complete Order Button for Flex Orders */}
                  {orderDetails.order.isFlexOrder && orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                    <div className="lg:col-span-2 mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-emerald-900 mb-1">
                            Ready to Complete Order
                          </p>
                          <p className="text-xs text-emerald-700">
                            Total Receipts: {orderDetails.totalReceiptAmount.toFixed(2)} {orderDetails.order.fromCurrency} | 
                            Total Payments: {orderDetails.totalPaymentAmount.toFixed(2)} {orderDetails.order.toCurrency}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!viewModalOrderId) return;
                            
                            // Refetch order details to ensure we have the latest data
                            const latestDetailsResult = await refetchOrderDetails();
                            // RTK Query refetch returns { data, error, ... }
                            const currentOrderDetails = latestDetailsResult?.data || orderDetails;
                            
                            if (!currentOrderDetails) {
                              console.error("No order details available");
                              return;
                            }
                            
                            // Validate amounts match according to exchange rate
                            // Use the same calculation as the view window (calculateAmountSell helper)
                            // Use flexOrderRate if set (user may have adjusted but not saved), otherwise use saved actualRate or original rate
                            const effectiveRate = flexOrderRate ? Number(flexOrderRate) : (currentOrderDetails.order.actualRate || currentOrderDetails.order.rate);
                            // For flex orders, use totalReceiptAmount (actual receipts) to calculate expected payment
                            // This ensures we're checking against what was actually received, not adjusted amounts
                            const actualAmountBuy = currentOrderDetails.totalReceiptAmount || currentOrderDetails.order.actualAmountBuy || 0;
                            // Use the same calculation logic as the view window instead of simple multiplication
                            const expectedPaymentAmount = calculateAmountSell(
                              actualAmountBuy,
                              effectiveRate,
                              currentOrderDetails.order.fromCurrency,
                              currentOrderDetails.order.toCurrency
                            );
                            const actualPaymentAmount = currentOrderDetails.totalPaymentAmount;
                            
                            // Debug logging
                            console.log("Completion check:", {
                              actualAmountBuy,
                              effectiveRate,
                              expectedPaymentAmount,
                              actualPaymentAmount,
                              difference: Math.abs(actualPaymentAmount - expectedPaymentAmount),
                            });
                            
                            // Allow small rounding difference (0.01)
                            const difference = Math.abs(actualPaymentAmount - expectedPaymentAmount);
                            
                            if (difference > 0.01) {
                              const missing = expectedPaymentAmount - actualPaymentAmount;
                              if (missing > 0) {
                                // Show missing payment modal - use the calculated expectedPaymentAmount
                                console.log("Showing missing payment modal:", {
                                  expectedPayment: expectedPaymentAmount,
                                  actualPayment: actualPaymentAmount,
                                  missing: missing,
                                });
                                setMissingPaymentModalData({
                                  expectedPayment: expectedPaymentAmount,
                                  actualPayment: actualPaymentAmount,
                                  missing: missing,
                                  toCurrency: currentOrderDetails.order.toCurrency,
                                });
                                setShowMissingPaymentModal(true);
                                return;
                              } else {
                                // Excess payment - user must upload additional receipts
                                const excess = actualPaymentAmount - expectedPaymentAmount;
                                // Calculate additional receipts needed: excess amount converted back to fromCurrency
                                // Reverse the calculation: if we calculated toCurrency = fromCurrency * rate (when base is from)
                                // then fromCurrency = toCurrency / rate
                                // If we calculated toCurrency = fromCurrency / rate (when base is to)
                                // then fromCurrency = toCurrency * rate
                                const getCurrencyRate = (code: string) => {
                                  const currency = currencies.find((c) => c.code === code);
                                  const candidate =
                                    currency?.conversionRateBuy ??
                                    currency?.baseRateBuy ??
                                    currency?.baseRateSell ??
                                    currency?.conversionRateSell;
                                  return typeof candidate === "number" ? candidate : null;
                                };
                                const fromRate = getCurrencyRate(currentOrderDetails.order.fromCurrency);
                                const toRate = getCurrencyRate(currentOrderDetails.order.toCurrency);
                                const inferredFromIsUSDT = fromRate !== null ? fromRate <= 1 : currentOrderDetails.order.fromCurrency === "USDT";
                                const inferredToIsUSDT = toRate !== null ? toRate <= 1 : currentOrderDetails.order.toCurrency === "USDT";
                                let baseIsFrom: boolean;
                                if (inferredFromIsUSDT !== inferredToIsUSDT) {
                                  baseIsFrom = inferredFromIsUSDT;
                                } else if (!inferredFromIsUSDT && !inferredToIsUSDT && fromRate !== null && toRate !== null) {
                                  baseIsFrom = fromRate < toRate;
                                } else {
                                  baseIsFrom = true; // default
                                }
                                const additionalReceipts = baseIsFrom ? excess / effectiveRate : excess * effectiveRate;
                                setExcessPaymentModalData({
                                  expectedPayment: expectedPaymentAmount,
                                  actualPayment: actualPaymentAmount,
                                  excess: excess,
                                  additionalReceipts: additionalReceipts,
                                  fromCurrency: currentOrderDetails.order.fromCurrency,
                                  toCurrency: currentOrderDetails.order.toCurrency,
                                });
                                setShowExcessPaymentModal(true);  
                                return; // Do not allow completion until receipts are uploaded
                              }
                            }
                            
                            if (window.confirm("Are you sure you want to complete this flex order?")) {
                              await updateOrderStatus({
                                id: viewModalOrderId,
                                status: "completed",
                              }).unwrap();
                              await refetchOrderDetails();
                              await refetchOrders();
                            }
                          }}
                          className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Complete Order
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Regular order flow - show sections based on status */}
              {isWaitingForReceipt && (
                <>
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      {t("orders.handlerInformation")}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {t("orders.handler")}: {orderDetails.order.handlerName || "N/A"}
                    </p>
                    {orderDetails.order.paymentType === "CRYPTO" ? (
                      <div className="mt-2">
                        <p className="text-sm text-slate-600">
                          {t("orders.network")}: {orderDetails.order.networkChain || "N/A"}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {t("orders.walletAddresses")}:
                        </p>
                        <ul className="list-disc list-inside text-sm text-slate-600 ml-4">
                          {orderDetails.order.walletAddresses?.map(
                            (addr, idx) => (
                              <li key={idx}>{addr}</li>
                            )
                          )}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">
                        {orderDetails.order.bankDetails && (
                          <>
                            <p>{t("orders.bankName")}: {orderDetails.order.bankDetails.bankName || "N/A"}</p>
                            <p>{t("orders.accountTitle")}: {orderDetails.order.bankDetails.accountTitle || "N/A"}</p>
                            <p>{t("orders.accountNumber")}: {orderDetails.order.bankDetails.accountNumber || "N/A"}</p>
                            <p>{t("orders.accountIban")}: {orderDetails.order.bankDetails.accountIban || "N/A"}</p>
                            <p>{t("orders.swiftCode")}: {orderDetails.order.bankDetails.swiftCode || "N/A"}</p>
                            <p>{t("orders.bankAddress")}: {orderDetails.order.bankDetails.bankAddress || "N/A"}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      {t("orders.receiptUploads")}
                    </h3>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountBuy")}: {orderDetails.order.amountBuy}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountReceived")}: {orderDetails.totalReceiptAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.receiptBalance.toFixed(2)}
                    </div>

                    {orderDetails.receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="mb-4 p-3 border border-slate-200 rounded-lg"
                      >
                        {receipt.imagePath.startsWith('data:image/') ? (
                          <img
                            src={receipt.imagePath}
                            alt="Receipt"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: receipt.imagePath,
                              type: 'image',
                              title: t("orders.receiptUploads")
                            })}
                          />
                        ) : receipt.imagePath.startsWith('data:application/pdf') ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(receipt.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {receipt.amount}
                        </p>
                        {receipt.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {receipt.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    <form onSubmit={handleAddReceipt} className="mt-4">
                      {receiptUploads.map((upload, index) => (
                        <div
                          key={`${receiptUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                            receiptDragOver && index === receiptUploads.length - 1
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200"
                          }`}
                          onDrop={(e) => {
                            handleDrop(e, index, "receipt");
                            setActiveUploadType(null);
                          }}
                          onDragOver={(e) => {
                            handleDragOver(e, "receipt");
                            setActiveUploadType("receipt");
                          }}
                          onDragLeave={(e) => {
                            handleDragLeave(e, "receipt");
                            setActiveUploadType(null);
                          }}
                          onFocus={() => setActiveUploadType("receipt")}
                          onClick={() => setActiveUploadType("receipt")}
                        >
                          {(!upload.image && !upload.amount && !upload.accountId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newUploads = receiptUploads.filter((_, i) => i !== index);
                                setReceiptUploads(newUploads);
                              }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-300 flex items-center justify-center text-sm font-bold z-10"
                              title={t("common.delete")}
                            >
                              −
                            </button>
                          )}
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop file here (image or PDF), paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <div className="relative mb-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              key={`receipt-file-${receiptUploadKey}-${index}`}
                              ref={(el) => {
                                receiptFileInputRefs.current[index] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(file, index, "receipt");
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id={`receipt-file-input-${receiptUploadKey}-${index}`}
                            />
                            <label
                              htmlFor={`receipt-file-input-${receiptUploadKey}-${index}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 border-dashed rounded-lg text-blue-700 font-medium cursor-pointer transition-colors"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                              </svg>
                              <span>Choose File (Image or PDF)</span>
                            </label>
                          </div>
                          {upload.image && (
                            <div className="relative mb-2">
                              {upload.image.startsWith('data:image/') ? (
                                <img
                                  src={upload.image}
                                  alt="Preview"
                                  className="max-w-full max-h-96 w-auto h-auto object-contain rounded"
                                />
                              ) : upload.image.startsWith('data:application/pdf') ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-slate-200 rounded-lg">
                                  <svg
                                    className="w-16 h-16 text-red-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                  <p className="text-xs text-slate-500 mt-1">Ready to upload</p>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newUploads = [...receiptUploads];
                                  newUploads[index] = { image: "", amount: "", accountId: "" };
                                  setReceiptUploads(newUploads);
                                  // Reset file input
                                  if (receiptFileInputRefs.current[index]) {
                                    receiptFileInputRefs.current[index]!.value = "";
                                  }
                                }}
                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                title={t("common.cancel")}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onWheel={handleNumberInputWheel}
                            onChange={(e) => {
                              const newUploads = [...receiptUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setReceiptUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                            required
                          />
                          {(() => {
                            const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                            return (
                              <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                                value={upload.accountId}
                                onChange={(e) => {
                                  const newUploads = [...receiptUploads];
                                  newUploads[index] = {
                                    ...newUploads[index],
                                    accountId: e.target.value,
                                  };
                                  setReceiptUploads(newUploads);
                                }}
                                required
                              >
                                <option value="">
                                  {t("orders.selectReceiptAccount")} ({currentOrder?.fromCurrency || ""}) *
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === currentOrder?.fromCurrency)
                                  .map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                    </option>
                                  ))}
                              </select>
                            );
                          })()}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptUploads([
                            ...receiptUploads,
                            { image: "", amount: "", accountId: "" },
                          ])
                        }
                        className="text-sm text-blue-600 hover:underline mb-2"
                      >
                        {t("orders.addAnotherReceipt")}
                      </button>
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                      >
                        {t("orders.uploadReceipts")}
                      </button>
                    </form>
                    {orderDetails.order.isFlexOrder && orderDetails.receiptBalance > 0 && (
                      <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm text-purple-800 mb-2">
                          This is a flex order. You can proceed with partial receipts.
                        </p>
                        <p className="text-sm text-purple-700 mb-3">
                          Current receipts: {orderDetails.totalReceiptAmount.toFixed(2)} {orderDetails.order.fromCurrency}
                          <br />
                          Original expected: {orderDetails.order.amountBuy} {orderDetails.order.fromCurrency}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!viewModalOrderId) return;
                            if (window.confirm(`Proceed with ${orderDetails.totalReceiptAmount.toFixed(2)} ${orderDetails.order.fromCurrency} instead of ${orderDetails.order.amountBuy}?`)) {
                              await proceedWithPartialReceipts(viewModalOrderId).unwrap();
                              // Refetch both order details and orders list to update UI immediately
                              await refetchOrderDetails();
                              await refetchOrders();
                            }
                          }}
                          className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 transition-colors"
                        >
                          Proceed with Current Receipts
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {isWaitingForPayment && (
                <>
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      {t("orders.customerBeneficiaryDetails")}
                    </h3>
                    {orderDetails.beneficiaries.map((beneficiary) => (
                      <div key={beneficiary.id} className="mb-4">
                        {beneficiary.paymentType === "CRYPTO" ? (
                          <div className="text-sm text-slate-600">
                            <p>{t("orders.type")}: {t("orders.crypto")}</p>
                            <p>{t("orders.network")}: {beneficiary.networkChain || "N/A"}</p>
                            <p>{t("orders.walletAddresses")}:</p>
                            <ul className="list-disc list-inside ml-4">
                              {beneficiary.walletAddresses?.map((addr, idx) => (
                                <li key={idx}>{addr}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-600">
                            <p>{t("orders.type")}: {t("orders.fiat")}</p>
                            <p>{t("orders.bankName")}: {beneficiary.bankName || "N/A"}</p>
                            <p>{t("orders.accountTitle")}: {beneficiary.accountTitle || "N/A"}</p>
                            <p>{t("orders.accountNumber")}: {beneficiary.accountNumber || "N/A"}</p>
                            <p>{t("orders.accountIban")}: {beneficiary.accountIban || "N/A"}</p>
                            <p>{t("orders.swiftCode")}: {beneficiary.swiftCode || "N/A"}</p>
                            <p>{t("orders.bankAddress")}: {beneficiary.bankAddress || "N/A"}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      {t("orders.paymentUploads")}
                    </h3>
                    {orderDetails.order.isFlexOrder && (
                      <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm font-semibold text-purple-900 mb-2">
                          Flex Order - Adjust Exchange Rate
                        </p>
                        <div className="grid grid-cols-2 gap-4 mb-2">
                          <div className="text-sm text-purple-700">
                            <span className="font-medium">Current Received:</span>{" "}
                            {orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy}{" "}
                            {orderDetails.order.fromCurrency}
                          </div>
                          <div className="text-sm text-purple-700 flex items-center gap-2">
                            <span className="font-medium">Exchange Rate:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={flexOrderRate || orderDetails.order.actualRate || orderDetails.order.rate}
                              onChange={(e) => setFlexOrderRate(e.target.value)}
                              onWheel={handleNumberInputWheel}
                              className="w-24 rounded border border-purple-300 px-2 py-1"
                              placeholder={String(orderDetails.order.actualRate || orderDetails.order.rate)}
                              disabled={orderDetails.order.status === "completed" || orderDetails.order.status === "cancelled"}
                            />
                            {orderDetails.order.status !== "completed" && orderDetails.order.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!viewModalOrderId) return;
                                  const rateToUse = flexOrderRate || String(orderDetails.order.actualRate || orderDetails.order.rate);
                                  if (!rateToUse) {
                                    alert(t("orders.pleaseEnterExchangeRate"));
                                    return;
                                  }
                                  const rateValue = Number(rateToUse);
                                  if (isNaN(rateValue) || rateValue <= 0) {
                                    alert(t("orders.pleaseEnterValidExchangeRate"));
                                    return;
                                  }
                                  try {
                                    await adjustFlexOrderRate({
                                      id: viewModalOrderId,
                                      rate: rateValue,
                                    }).unwrap();
                                    // Refetch both order details and orders list to update UI immediately
                                    await refetchOrderDetails();
                                    await refetchOrders();
                                    alert(t("orders.exchangeRateUpdatedSuccessfully"));
                                  } catch (error) {
                                    console.error("Error updating exchange rate:", error);
                                    alert(t("orders.failedToUpdateExchangeRate"));
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                              >
                                Update Exchange Rate
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-purple-800 font-medium">
                          Calculated Amount to Pay:{" "}
                          {calculateAmountSell(
                            orderDetails.order.actualAmountBuy || orderDetails.order.amountBuy,
                            Number(flexOrderRate || orderDetails.order.actualRate || orderDetails.order.rate),
                            orderDetails.order.fromCurrency,
                            orderDetails.order.toCurrency
                          ).toFixed(2)}{" "}
                          {orderDetails.order.toCurrency}
                        </div>
                      </div>
                    )}
                    {excessPaymentWarning && (
                      <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                        <p className="text-sm font-semibold text-amber-900 mb-2">
                          ⚠️ Payment Exceeds Expected Amount
                        </p>
                        <div className="text-sm text-amber-800 space-y-1">
                          <p>
                            Excess Payment: {excessPaymentWarning.excessAmount.toFixed(2)}{" "}
                            {orderDetails.order.toCurrency}
                          </p>
                          <p>
                            Additional Receipts Required: {excessPaymentWarning.additionalReceiptsNeeded.toFixed(2)}{" "}
                            {orderDetails.order.fromCurrency}
                          </p>
                          <p className="text-xs text-amber-700 mt-2">
                            Please upload receipts for the additional amount before completing this order.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountSell")}: -{orderDetails.order.actualAmountSell || orderDetails.order.amountSell}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountPaid")}: {orderDetails.totalPaymentAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {t("orders.balance")}: {orderDetails.paymentBalance.toFixed(2)}
                    </div>

                    {orderDetails.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="mb-4 p-3 border border-slate-200 rounded-lg"
                      >
                        {payment.imagePath.startsWith('data:image/') ? (
                          <img
                            src={payment.imagePath}
                            alt="Payment"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewerModal({
                              isOpen: true,
                              src: payment.imagePath,
                              type: 'image',
                              title: t("orders.paymentUploads")
                            })}
                          />
                        ) : payment.imagePath.startsWith('data:application/pdf') ? (
                          <div
                            className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                            onClick={() => openPdfInNewTab(payment.imagePath)}
                          >
                            <svg
                              className="w-12 h-12 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-slate-700">PDF Document</p>
                              <p className="text-xs text-slate-500">Click to view</p>
                            </div>
                          </div>
                        ) : null}
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {payment.amount}
                        </p>
                        {payment.accountName && (
                          <p className="text-sm text-slate-500">
                            {t("orders.account")}: {payment.accountName}
                          </p>
                        )}
                      </div>
                    ))}

                    <form onSubmit={handleAddPayment} className="mt-4">
                      {paymentUploads.map((upload, index) => (
                        <div
                          key={`${paymentUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors relative ${
                            paymentDragOver && index === paymentUploads.length - 1
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200"
                          }`}
                          onDrop={(e) => {
                            handleDrop(e, index, "payment");
                            setActiveUploadType(null);
                          }}
                          onDragOver={(e) => {
                            handleDragOver(e, "payment");
                            setActiveUploadType("payment");
                          }}
                          onDragLeave={(e) => {
                            handleDragLeave(e, "payment");
                            setActiveUploadType(null);
                          }}
                          onFocus={() => setActiveUploadType("payment")}
                          onClick={() => setActiveUploadType("payment")}
                        >
                          {(!upload.image && !upload.amount && !upload.accountId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newUploads = paymentUploads.filter((_, i) => i !== index);
                                setPaymentUploads(newUploads);
                              }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-300 flex items-center justify-center text-sm font-bold z-10"
                              title={t("common.delete")}
                            >
                              −
                            </button>
                          )}
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop file here (image or PDF), paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <div className="relative mb-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              key={`payment-file-${paymentUploadKey}-${index}`}
                              ref={(el) => {
                                paymentFileInputRefs.current[index] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(file, index, "payment");
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id={`payment-file-input-${paymentUploadKey}-${index}`}
                            />
                            <label
                              htmlFor={`payment-file-input-${paymentUploadKey}-${index}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-50 hover:bg-green-100 border-2 border-green-300 border-dashed rounded-lg text-green-700 font-medium cursor-pointer transition-colors"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                              </svg>
                              <span>Choose File (Image or PDF)</span>
                            </label>
                          </div>
                          {upload.image && (
                            <div className="relative mb-2">
                              {upload.image.startsWith('data:image/') ? (
                                <img
                                  src={upload.image}
                                  alt="Preview"
                                  className="max-w-full max-h-96 w-auto h-auto object-contain rounded"
                                />
                              ) : upload.image.startsWith('data:application/pdf') ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-slate-200 rounded-lg">
                                  <svg
                                    className="w-16 h-16 text-red-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                  <p className="text-xs text-slate-500 mt-1">Ready to upload</p>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newUploads = [...paymentUploads];
                                  newUploads[index] = { image: "", amount: "", accountId: "" };
                                  setPaymentUploads(newUploads);
                                  // Reset file input
                                  if (paymentFileInputRefs.current[index]) {
                                    paymentFileInputRefs.current[index]!.value = "";
                                  }
                                }}
                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                title={t("common.cancel")}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onWheel={handleNumberInputWheel}
                            onChange={(e) => {
                              const newUploads = [...paymentUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setPaymentUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 mb-2"
                            required
                          />
                          {(() => {
                            const currentOrder = orders.find((o) => o.id === viewModalOrderId);
                            return (
                              <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                                value={upload.accountId}
                                onChange={(e) => {
                                  const newUploads = [...paymentUploads];
                                  newUploads[index] = {
                                    ...newUploads[index],
                                    accountId: e.target.value,
                                  };
                                  setPaymentUploads(newUploads);
                                }}
                                required
                              >
                                <option value="">
                                  {t("orders.selectPaymentAccount")} ({currentOrder?.toCurrency || ""}) *
                                </option>
                                {accounts
                                  .filter((acc) => acc.currencyCode === currentOrder?.toCurrency)
                                  .map((account) => {
                                    const hasInsufficientBalance = currentOrder && account.balance < Number(upload.amount || 0);
                                    return (
                                      <option key={account.id} value={account.id}>
                                        {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                                        {hasInsufficientBalance ? ` ⚠️ ${t("orders.insufficient")}` : ""}
                                      </option>
                                    );
                                  })}
                              </select>
                            );
                          })()}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentUploads([
                            ...paymentUploads,
                            { image: "", amount: "", accountId: "" },
                          ])
                        }
                        className="text-sm text-blue-600 hover:underline mb-2"
                      >
                        {t("orders.addAnotherPayment")}
                      </button>
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                      >
                        {t("orders.uploadPayments")}
                      </button>
                    </form>
                  </div>
                </>
              )}

              {!isWaitingForReceipt && !isWaitingForPayment && !isUnderProcess && orderDetails && !orderDetails.order.isFlexOrder && (
                <>
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      {t("orders.orderSummary")}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div>
                          <span className="text-slate-500">{t("orders.status")}:</span>
                          <span className="ml-2 font-semibold text-slate-900 capitalize">
                            {t(`orders.${orderDetails.order.status}`)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.customer")}:</span>
                          <span className="ml-2 text-slate-700">
                            {orderDetails.order.customerName || orderDetails.order.customerId}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.currencyPair")}:</span>
                          <span className="ml-2 text-slate-700">
                            {orderDetails.order.fromCurrency} → {orderDetails.order.toCurrency}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.exchangeRate")}:</span>
                          <span className="ml-2 text-slate-700">
                            {orderDetails.order.rate}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-slate-500">{t("orders.amountBuy")}:</span>
                          <span className="ml-2 font-semibold text-slate-900">
                            {orderDetails.order.amountBuy}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t("orders.amountSell")}:</span>
                          <span className="ml-2 font-semibold text-slate-900">
                            -{orderDetails.order.amountSell}
                          </span>
                        </div>
                        {orderDetails.order.handlerName && (
                          <div>
                            <span className="text-slate-500">{t("orders.handler")}:</span>
                            <span className="ml-2 text-slate-700">
                              {orderDetails.order.handlerName}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">{t("orders.date")}:</span>
                          <span className="ml-2 text-slate-700">
                            {formatDate(orderDetails.order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {orderDetails.order.handlerName && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Handler Information
                      </h3>
                      <p className="text-sm text-slate-600">
                        Handler: {orderDetails.order.handlerName}
                      </p>
                      {orderDetails.order.paymentType === "CRYPTO" ? (
                        <div className="mt-2">
                          <p className="text-sm text-slate-600">
                            Network: {orderDetails.order.networkChain || "N/A"}
                          </p>
                          {orderDetails.order.walletAddresses && orderDetails.order.walletAddresses.length > 0 && (
                            <>
                              <p className="text-sm text-slate-600 mt-1">
                                Wallet Addresses:
                              </p>
                              <ul className="list-disc list-inside text-sm text-slate-600 ml-4">
                                {orderDetails.order.walletAddresses.map(
                                  (addr, idx) => (
                                    <li key={idx}>{addr}</li>
                                  )
                                )}
                              </ul>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-600">
                          {orderDetails.order.bankDetails && (
                            <>
                              <p>Bank: {orderDetails.order.bankDetails.bankName || "N/A"}</p>
                              <p>Account Title: {orderDetails.order.bankDetails.accountTitle || "N/A"}</p>
                              <p>Account Number: {orderDetails.order.bankDetails.accountNumber || "N/A"}</p>
                              <p>IBAN: {orderDetails.order.bankDetails.accountIban || "N/A"}</p>
                              <p>Swift Code: {orderDetails.order.bankDetails.swiftCode || "N/A"}</p>
                              <p>Bank Address: {orderDetails.order.bankDetails.bankAddress || "N/A"}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {orderDetails.beneficiaries.length > 0 && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Customer Beneficiary Details
                      </h3>
                      {orderDetails.beneficiaries.map((beneficiary) => (
                        <div key={beneficiary.id} className="mb-4">
                          {beneficiary.paymentType === "CRYPTO" ? (
                            <div className="text-sm text-slate-600">
                              <p>Type: CRYPTO</p>
                              <p>Network: {beneficiary.networkChain || "N/A"}</p>
                              {beneficiary.walletAddresses && beneficiary.walletAddresses.length > 0 && (
                                <>
                                  <p>{t("orders.walletAddresses")}:</p>
                                  <ul className="list-disc list-inside ml-4">
                                    {beneficiary.walletAddresses.map((addr, idx) => (
                                      <li key={idx}>{addr}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600">
                              <p>Type: FIAT</p>
                              <p>Bank: {beneficiary.bankName || "N/A"}</p>
                              <p>Account Title: {beneficiary.accountTitle || "N/A"}</p>
                              <p>Account Number: {beneficiary.accountNumber || "N/A"}</p>
                              <p>IBAN: {beneficiary.accountIban || "N/A"}</p>
                              <p>Swift Code: {beneficiary.swiftCode || "N/A"}</p>
                              <p>Bank Address: {beneficiary.bankAddress || "N/A"}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {orderDetails.receipts.length > 0 && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Receipt Uploads
                      </h3>
                      <div className="text-sm text-slate-600 mb-2">
                        Amount Received: {orderDetails.totalReceiptAmount.toFixed(2)}
                      </div>
                      {orderDetails.receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="mb-4 p-3 border border-slate-200 rounded-lg"
                        >
                          {receipt.imagePath.startsWith('data:image/') ? (
                            <img
                              src={receipt.imagePath}
                              alt="Receipt"
                              className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewerModal({
                                isOpen: true,
                                src: receipt.imagePath,
                                type: 'image',
                                title: t("orders.receiptUploads")
                              })}
                            />
                          ) : receipt.imagePath.startsWith('data:application/pdf') ? (
                            <div
                              className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                              onClick={() => openPdfInNewTab(receipt.imagePath)}
                            >
                              <svg
                                className="w-12 h-12 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                <p className="text-xs text-slate-500">Click to view</p>
                              </div>
                            </div>
                          ) : null}
                          <p className="text-sm text-slate-600">
                            Amount: {receipt.amount}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {orderDetails.payments.length > 0 && (
                    <div className="border-b pb-4">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Payment Uploads
                      </h3>
                      <div className="text-sm text-slate-600 mb-2">
                        Amount Paid: {orderDetails.totalPaymentAmount.toFixed(2)}
                      </div>
                      {orderDetails.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="mb-4 p-3 border border-slate-200 rounded-lg"
                        >
                          {payment.imagePath.startsWith('data:image/') ? (
                            <img
                              src={payment.imagePath}
                              alt="Payment"
                              className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewerModal({
                                isOpen: true,
                                src: payment.imagePath,
                                type: 'image',
                                title: t("orders.paymentUploads")
                              })}
                            />
                          ) : payment.imagePath.startsWith('data:application/pdf') ? (
                            <div
                              className="flex items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-2"
                              onClick={() => openPdfInNewTab(payment.imagePath)}
                            >
                              <svg
                                className="w-12 h-12 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-slate-700">PDF Document</p>
                                <p className="text-xs text-slate-500">Click to view</p>
                              </div>
                            </div>
                          ) : null}
                          <p className="text-sm text-slate-600">
                            Amount: {payment.amount}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Make Payment Modal - Removed: Accounts are now selected per payment upload */}
      {false && makePaymentModalOrderId && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.makePaymentTitle")}
              </h2>
              <button
                onClick={closeMakePaymentModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form className="grid gap-3" onSubmit={handleAddBeneficiary}>
              {/* Payment Account Selection - We pay customer in toCurrency */}
              {(() => {
                const paymentOrderData = orders.find((o) => o.id === makePaymentModalOrderId);
                return (
                  <select
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    value={beneficiaryForm.paymentAccountId}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({ ...p, paymentAccountId: e.target.value }))
                    }
                    required
                  >
                    <option value="">
                      {t("orders.selectPaymentAccount")} ({paymentOrderData?.toCurrency || t("orders.to")})
                    </option>
                    {accounts
                      .filter((acc) => acc.currencyCode === paymentOrderData?.toCurrency)
                      .map((account) => {
                        const hasInsufficientBalance = paymentOrderData && account.balance < paymentOrderData.amountSell;
                        return (
                          <option key={account.id} value={account.id}>
                            {account.name} ({account.balance.toFixed(2)} {account.currencyCode})
                            {hasInsufficientBalance ? ` ⚠️ ${t("orders.insufficient")}` : ""}
                          </option>
                        );
                      })}
                  </select>
                );
              })()}

              {/* Commented out for future use - CRYPTO/FIAT beneficiary details */}
              {/* 
              {customerBeneficiaries.length > 0 && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("orders.savedBeneficiary")}
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={selectedCustomerBeneficiaryId}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : "";
                      setSelectedCustomerBeneficiaryId(val);
                      if (val) {
                        applyCustomerBeneficiaryToForm(val);
                      }
                    }}
                  >
                    <option value="">{t("orders.selectSavedBeneficiary")}</option>
                    {customerBeneficiaries.map((beneficiary) => (
                      <option key={beneficiary.id} value={beneficiary.id}>
                        {beneficiary.paymentType === "CRYPTO"
                          ? `${t("orders.crypto")} - ${beneficiary.networkChain || t("orders.network")}`
                          : `${t("orders.fiat")} - ${beneficiary.bankName || t("orders.bank")}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-span-full">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("orders.paymentType")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="beneficiaryPaymentType"
                      value="CRYPTO"
                      checked={beneficiaryForm.paymentType === "CRYPTO"}
                      onChange={(e) =>
                        setBeneficiaryForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.crypto")}
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="beneficiaryPaymentType"
                      value="FIAT"
                      checked={beneficiaryForm.paymentType === "FIAT"}
                      onChange={(e) =>
                        setBeneficiaryForm((p) => ({
                          ...p,
                          paymentType: e.target.value as "CRYPTO" | "FIAT",
                        }))
                      }
                      className="mr-2"
                    />
                    {t("orders.fiat")}
                  </label>
                </div>
              </div>

              {beneficiaryForm.paymentType === "CRYPTO" ? (
                <>
                  <select
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    value={beneficiaryForm.networkChain}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        networkChain: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">{t("orders.selectNetworkChain")}</option>
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                    <option value="POLYGON">POLYGON</option>
                  </select>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("orders.walletAddresses")}
                    </label>
                    {beneficiaryForm.walletAddresses.map((addr, index) => (
                      <div key={index} className="mb-2">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          placeholder={t("orders.walletAddress")}
                          value={addr}
                          onChange={(e) => {
                            const newAddresses = [...beneficiaryForm.walletAddresses];
                            newAddresses[index] = e.target.value;
                            setBeneficiaryForm((p) => ({
                              ...p,
                              walletAddresses: newAddresses,
                            }));
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setBeneficiaryForm((p) => ({
                          ...p,
                          walletAddresses: [...p.walletAddresses, ""],
                        }))
                      }
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {t("orders.addAnotherAddress")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankName")}
                    value={beneficiaryForm.bankName}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        bankName: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountTitle")}
                    value={beneficiaryForm.accountTitle}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        accountTitle: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountNumber")}
                    value={beneficiaryForm.accountNumber}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        accountNumber: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.accountIban")}
                    value={beneficiaryForm.accountIban}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        accountIban: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.swiftCode")}
                    value={beneficiaryForm.swiftCode}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        swiftCode: e.target.value,
                      }))
                    }
                  />
                  <textarea
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankAddress")}
                    value={beneficiaryForm.bankAddress}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        bankAddress: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </>
              )}

              <div className="col-span-full flex items-center gap-3">
                <input
                  id="save-beneficiary-to-customer"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={saveBeneficiaryToCustomer}
                  onChange={(e) => setSaveBeneficiaryToCustomer(e.target.checked)}
                />
                <label htmlFor="save-beneficiary-to-customer" className="text-sm text-slate-700">
                  {t("orders.saveBeneficiaryToCustomer")}
                </label>
              </div>
              */}

              <div className="col-span-full flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeMakePaymentModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                  >
                    {t("common.submit")}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excess Payment Warning Modal */}
      {showExcessPaymentModal && excessPaymentModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <svg
                    className="h-6 w-6 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Payment Exceeds Expected Amount
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowExcessPaymentModal(false);
                  setExcessPaymentModalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-amber-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-medium">{t("orders.expectedPayment")}:</span>
                    <span className="text-amber-900 font-semibold">
                      {excessPaymentModalData.expectedPayment.toFixed(2)} {excessPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-medium">{t("orders.actualPayment")}:</span>
                    <span className="text-amber-900 font-semibold">
                      {excessPaymentModalData.actualPayment.toFixed(2)} {excessPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-amber-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-amber-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-amber-900 font-bold">
                        {excessPaymentModalData.excess.toFixed(2)} {excessPaymentModalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.actionRequired")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.youMustUpload")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessPaymentModalData.additionalReceipts.toFixed(2)} {excessPaymentModalData.fromCurrency}
                  </span>{" "}
                  {t("orders.additionalReceipts")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowExcessPaymentModal(false);
                  setExcessPaymentModalData(null);
                }}
                className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Payment Warning Modal */}
      {showMissingPaymentModal && missingPaymentModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.amountsDoNotMatch")}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowMissingPaymentModal(false);
                  setMissingPaymentModalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-800 font-medium">{t("orders.expectedPayment")}:</span>
                    <span className="text-blue-900 font-semibold">
                      {missingPaymentModalData.expectedPayment.toFixed(2)} {missingPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-800 font-medium">{t("orders.actualPayment")}:</span>
                    <span className="text-blue-900 font-semibold">
                      {missingPaymentModalData.actualPayment.toFixed(2)} {missingPaymentModalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-blue-900 font-semibold">{t("orders.missing")}:</span>
                      <span className="text-blue-900 font-bold">
                        {missingPaymentModalData.missing.toFixed(2)} {missingPaymentModalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.actionRequired")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.pleaseUploadRemaining")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowMissingPaymentModal(false);
                  setMissingPaymentModalData(null);
                }}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excess Receipt Warning Modal */}
      {showExcessReceiptModal && excessReceiptModalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.receiptAmountExceedsOrderAmount")}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowExcessReceiptModal(false);
                  setExcessReceiptModalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.expectedReceiptAmount")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessReceiptModalData.expectedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.attemptToReceive")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessReceiptModalData.attemptedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                    </span>
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-red-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-red-900 font-bold">
                        {excessReceiptModalData.excess.toFixed(2)} {excessReceiptModalData.fromCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.cannotUpload")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.forNormalOrdersCannotUploadReceipts")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessReceiptModalData.expectedReceipt.toFixed(2)} {excessReceiptModalData.fromCurrency}
                  </span>.
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold text-slate-900">{t("orders.note")}:</span> {t("orders.excessReceiptsOnlyAllowed")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowExcessReceiptModal(false);
                  setExcessReceiptModalData(null);
                }}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excess Payment Warning Modal for Normal Orders */}
      {showExcessPaymentModalNormal && excessPaymentModalNormalData && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ margin: 0, padding: 0 }}>
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("orders.paymentAmountExceedsOrderAmount")}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowExcessPaymentModalNormal(false);
                  setExcessPaymentModalNormalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.expectedPaymentAmount")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessPaymentModalNormalData.expectedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-800 font-medium">{t("orders.attemptToPay")}:</span>
                    <span className="text-red-900 font-semibold">
                      {excessPaymentModalNormalData.attemptedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                    </span>
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-red-900 font-semibold">{t("orders.excess")}:</span>
                      <span className="text-red-900 font-bold">
                        {excessPaymentModalNormalData.excess.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold text-slate-900">{t("orders.cannotUpload")}:</span>
                </p>
                <p className="text-sm text-slate-600">
                  {t("orders.forNormalOrdersCannotUpload")}{" "}
                  <span className="font-semibold text-slate-900">
                    {excessPaymentModalNormalData.expectedPayment.toFixed(2)} {excessPaymentModalNormalData.toCurrency}
                  </span>.
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold text-slate-900">{t("orders.note")}:</span> {t("orders.excessPaymentsOnlyAllowed")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowExcessPaymentModalNormal(false);
                  setExcessPaymentModalNormalData(null);
                }}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 transition-colors"
              >
                {t("orders.iUnderstand")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image/PDF Viewer Modal */}
      {viewerModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-75" style={{ margin: 0, padding: 0 }}
          onClick={() => setViewerModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewerModal(null)}
              className="absolute top-2 right-2 z-10 bg-white hover:bg-slate-100 rounded-full p-2 shadow-lg transition-colors"
              aria-label={t("orders.close")}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={viewerModal.src}
              alt={viewerModal.title}
              className="max-w-full max-h-[95vh] w-auto h-auto mx-auto object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type || "error"}
        onClose={() => setAlertModal({ isOpen: false, message: "", type: "error" })}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={() => {
          if (confirmModal.isBulk) {
            handleBulkDelete();
          } else if (confirmModal.orderId && confirmModal.orderId > 0) {
            handleDelete(confirmModal.orderId);
          }
        }}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", orderId: null, isBulk: false })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}
