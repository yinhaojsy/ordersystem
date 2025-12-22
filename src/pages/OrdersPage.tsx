import { useState, type FormEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/common/Badge";
import SectionCard from "../components/common/SectionCard";
import {
  useAddOrderMutation,
  useGetCurrenciesQuery,
  useGetCustomersQuery,
  useGetOrdersQuery,
  useGetUsersQuery,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
  useGetOrderDetailsQuery,
  useProcessOrderMutation,
  useAddReceiptMutation,
  useAddBeneficiaryMutation,
  useAddPaymentMutation,
  useGetCustomerBeneficiariesQuery,
  useAddCustomerBeneficiaryMutation,
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

  const [addOrder, { isLoading: isSaving }] = useAddOrderMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();
  const [processOrder] = useProcessOrderMutation();
  const [addReceipt] = useAddReceiptMutation();
  const [addBeneficiary] = useAddBeneficiaryMutation();
  const [addPayment] = useAddPaymentMutation();
  const [addCustomerBeneficiary] = useAddCustomerBeneficiaryMutation();

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processModalOrderId, setProcessModalOrderId] = useState<number | null>(null);
  const [viewModalOrderId, setViewModalOrderId] = useState<number | null>(null);
  const [makePaymentModalOrderId, setMakePaymentModalOrderId] = useState<number | null>(null);
  
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const receiptFileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const paymentFileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [calculatedField, setCalculatedField] = useState<"buy" | "sell" | null>(null);
  const [receiptUploadKey, setReceiptUploadKey] = useState(0);
  const [paymentUploadKey, setPaymentUploadKey] = useState(0);

  const [form, setForm] = useState({
    customerId: "",
    fromCurrency: "",
    toCurrency: "",
    amountBuy: "",
    amountSell: "",
    rate: "",
    status: "pending" as OrderStatus,
  });

  const [processForm, setProcessForm] = useState({
    handlerId: "",
    paymentType: "CRYPTO" as "CRYPTO" | "FIAT",
    networkChain: "",
    walletAddresses: [""],
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    accountIban: "",
    swiftCode: "",
    bankAddress: "",
  });

  const [beneficiaryForm, setBeneficiaryForm] = useState({
    paymentType: "CRYPTO" as "CRYPTO" | "FIAT",
    networkChain: "",
    walletAddresses: [""],
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    accountIban: "",
    swiftCode: "",
    bankAddress: "",
  });
  const [saveBeneficiaryToCustomer, setSaveBeneficiaryToCustomer] = useState(false);
  const [selectedCustomerBeneficiaryId, setSelectedCustomerBeneficiaryId] = useState<number | "">(
    "",
  );

  const applyCustomerBeneficiaryToForm = (beneficiaryId: number) => {
    const selected = customerBeneficiaries.find((b) => b.id === beneficiaryId);
    if (!selected) return;

    if (selected.paymentType === "CRYPTO") {
      setBeneficiaryForm({
        paymentType: "CRYPTO",
        networkChain: selected.networkChain || "",
        walletAddresses: selected.walletAddresses && selected.walletAddresses.length > 0
          ? selected.walletAddresses
          : [""],
        bankName: "",
        accountTitle: "",
        accountNumber: "",
        accountIban: "",
        swiftCode: "",
        bankAddress: "",
      });
    } else {
      setBeneficiaryForm({
        paymentType: "FIAT",
        networkChain: "",
        walletAddresses: [""],
        bankName: selected.bankName || "",
        accountTitle: selected.accountTitle || "",
        accountNumber: selected.accountNumber || "",
        accountIban: selected.accountIban || "",
        swiftCode: selected.swiftCode || "",
        bankAddress: selected.bankAddress || "",
      });
    }
  };

  const [receiptUploads, setReceiptUploads] = useState<Array<{ image: string; amount: string }>>([{ image: "", amount: "" }]);
  const [paymentUploads, setPaymentUploads] = useState<Array<{ image: string; amount: string }>>([{ image: "", amount: "" }]);
  const [receiptDragOver, setReceiptDragOver] = useState(false);
  const [paymentDragOver, setPaymentDragOver] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<"receipt" | "payment" | null>(null);

  const { data: orderDetails, refetch: refetchOrderDetails } = useGetOrderDetailsQuery(viewModalOrderId || 0, {
    skip: !viewModalOrderId,
  });

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
      paymentType: "CRYPTO",
      networkChain: "",
      walletAddresses: [""],
      bankName: "",
      accountTitle: "",
      accountNumber: "",
      accountIban: "",
      swiftCode: "",
      bankAddress: "",
    });
  };

  const resetBeneficiaryForm = () => {
    setBeneficiaryForm({
      paymentType: "CRYPTO",
      networkChain: "",
      walletAddresses: [""],
      bankName: "",
      accountTitle: "",
      accountNumber: "",
      accountIban: "",
      swiftCode: "",
      bankAddress: "",
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
  };

  const closeProcessModal = () => {
    resetProcessForm();
    setProcessModalOrderId(null);
  };

  const closeViewModal = () => {
    setViewModalOrderId(null);
    setReceiptUploads([{ image: "", amount: "" }]);
    setPaymentUploads([{ image: "", amount: "" }]);
    setReceiptUploadKey(0);
    setPaymentUploadKey(0);
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
    const newOrder = await addOrder({
      customerId: Number(form.customerId),
      fromCurrency: form.fromCurrency,
      toCurrency: form.toCurrency,
      amountBuy: Number(form.amountBuy || 0),
      amountSell: Number(form.amountSell || 0),
      rate: Number(form.rate || 1),
      status: form.status,
    }).unwrap();
    resetForm();
    setIsModalOpen(false);
    
    // Automatically open Process Order modal for the newly created order
    if (newOrder?.id) {
      setProcessModalOrderId(newOrder.id);
    }
  };

  const handleProcess = async (event: FormEvent) => {
    event.preventDefault();
    if (!processModalOrderId || !processForm.handlerId) return;

    const payload: any = {
      id: processModalOrderId,
      handlerId: Number(processForm.handlerId),
      paymentType: processForm.paymentType,
    };

    if (processForm.paymentType === "CRYPTO") {
      payload.networkChain = processForm.networkChain;
      payload.walletAddresses = processForm.walletAddresses.filter((addr) => addr.trim());
    } else {
      payload.bankDetails = {
        bankName: processForm.bankName,
        accountTitle: processForm.accountTitle,
        accountNumber: processForm.accountNumber,
        accountIban: processForm.accountIban,
        swiftCode: processForm.swiftCode,
        bankAddress: processForm.bankAddress,
      };
    }

    await processOrder(payload);
    resetProcessForm();
    setProcessModalOrderId(null);
    setOpenMenuId(null);
  };

  const handleAddReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!viewModalOrderId) return;

    for (const upload of receiptUploads) {
      if (upload.image && upload.amount) {
        await addReceipt({
          id: viewModalOrderId,
          imagePath: upload.image,
          amount: Number(upload.amount),
        });
      }
    }

    // Reset file inputs
    Object.values(receiptFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    setReceiptUploads([{ image: "", amount: "" }]);
    setReceiptUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    
    // Refetch orders to get updated status, then check if status changed to waiting_for_payment
    const { data: updatedOrders } = await refetchOrders();
    const updatedOrder = updatedOrders?.find((o) => o.id === viewModalOrderId);
    if (updatedOrder?.status === "waiting_for_payment") {
      // Close view modal and open make payment modal
      setViewModalOrderId(null);
      setMakePaymentModalOrderId(viewModalOrderId);
    }
  };

  const handleAddBeneficiary = async (event: FormEvent) => {
    event.preventDefault();
    if (!makePaymentModalOrderId) return;

    const payload: any = {
      id: makePaymentModalOrderId,
      paymentType: beneficiaryForm.paymentType,
    };

    if (beneficiaryForm.paymentType === "CRYPTO") {
      payload.networkChain = beneficiaryForm.networkChain;
      payload.walletAddresses = beneficiaryForm.walletAddresses.filter((addr) => addr.trim());
    } else {
      payload.bankName = beneficiaryForm.bankName;
      payload.accountTitle = beneficiaryForm.accountTitle;
      payload.accountNumber = beneficiaryForm.accountNumber;
      payload.accountIban = beneficiaryForm.accountIban;
      payload.swiftCode = beneficiaryForm.swiftCode;
      payload.bankAddress = beneficiaryForm.bankAddress;
    }

    await addBeneficiary(payload);
    if (saveBeneficiaryToCustomer && makePaymentOrder?.customerId) {
      const customerPayload = { ...payload, customerId: makePaymentOrder.customerId };
      delete customerPayload.id;
      await addCustomerBeneficiary(customerPayload);
    }
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
    if (!viewModalOrderId) return;

    for (const upload of paymentUploads) {
      if (upload.image && upload.amount) {
        await addPayment({
          id: viewModalOrderId,
          imagePath: upload.image,
          amount: Number(upload.amount),
        });
      }
    }

    // Reset file inputs
    Object.values(paymentFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    setPaymentUploads([{ image: "", amount: "" }]);
    setPaymentUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    
    // Refetch order details to get updated status and payments
    await refetchOrderDetails();
    
    // Refetch orders list to get updated status
    const { data: updatedOrders } = await refetchOrders();
    const updatedOrder = updatedOrders?.find((o) => o.id === viewModalOrderId);
    
    // If order is completed, close the modal
    if (updatedOrder?.status === "completed") {
      setViewModalOrderId(null);
    }
  };

  const handleImageUpload = (file: File, index: number, type: "receipt" | "payment") => {
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
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
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      handleImageUpload(imageFiles[0], index, type);
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
                      updated[targetIndex] = { image: "", amount: "" };
                    }
                    updated[targetIndex] = { ...updated[targetIndex], image: base64 };
                    return updated;
                  });
                };
                reader.readAsDataURL(file);
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  return [...prev, { image: "", amount: "" }];
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
                      updated[targetIndex] = { image: "", amount: "" };
                    }
                    updated[targetIndex] = { ...updated[targetIndex], image: base64 };
                    return updated;
                  });
                };
                reader.readAsDataURL(file);
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  return [...prev, { image: "", amount: "" }];
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

  const handleDelete = async (id: number) => {
    if (window.confirm(t("orders.confirmDeleteOrder"))) {
      await deleteOrder(id);
      setOpenMenuId(null);
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
          key="process"
          className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 first:rounded-t-lg"
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
      // Only show View button if beneficiaries have been added
      if (order.hasBeneficiaries) {
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
      } else {
        // Only show Make Payment button if beneficiaries haven't been added yet
        buttons.push(
          <button
            key="make-payment"
            className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-slate-50 first:rounded-t-lg"
            onClick={() => {
              setMakePaymentModalOrderId(order.id);
              setOpenMenuId(null);
            }}
          >
            {t("orders.makePayment")}
          </button>
        );
      }
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
          onClick={() => handleDelete(order.id)}
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
        return "blue";
      case "completed":
        return "emerald";
      case "cancelled":
        return "rose";
      default:
        return "slate";
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

  const currentOrder = orders.find((o) => o.id === viewModalOrderId);
  const makePaymentOrder = orders.find((o) => o.id === makePaymentModalOrderId);
  const isWaitingForReceipt = currentOrder?.status === "waiting_for_receipt";
  const isWaitingForPayment = currentOrder?.status === "waiting_for_payment";

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
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
            >
              {t("orders.createOrder")}
            </button>
            {canDeleteManyOrders && (
              <button
                onClick={async () => {
                  if (!selectedOrderIds.length) return;
                  if (!window.confirm(t("orders.confirmDeleteOrder"))) return;
                  await Promise.all(selectedOrderIds.map((id) => deleteOrder(id).unwrap()));
                  setSelectedOrderIds([]);
                  await refetchOrders();
                }}
                disabled={isDeleting || !selectedOrderIds.length}
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                {isDeleting ? t("common.deleting") : t("orders.deleteSelected")}
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
                {canDeleteManyOrders && (
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
                  {canDeleteManyOrders && (
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
                        {t("orders.noHandlerAssigned") ?? "No Handler Assigned"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-semibold">
                    {order.customerName || order.customerId}
                  </td>
                  <td className="py-2">
                    {order.fromCurrency} → {order.toCurrency}
                  </td>
                  <td className="py-2">{order.amountBuy}</td>
                  <td className="py-2">{order.amountSell}</td>
                  <td className="py-2">{order.rate}</td>
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
                        aria-label="Actions"
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
                        <div className="absolute left-0 top-0 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("orders.createOrderTitle")}
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
              <select
                className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
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
                  {isSaving ? t("common.saving") : t("orders.saveOrder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Order Modal */}
      {processModalOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
                    // required
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeViewModal}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
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

            <div className="space-y-4">
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
                        <img
                          src={receipt.imagePath}
                          alt="Receipt"
                          className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded"
                        />
                        <p className="text-sm text-slate-600">
                          {t("orders.amount")}: {receipt.amount}
                        </p>
                      </div>
                    ))}

                    <form onSubmit={handleAddReceipt} className="mt-4">
                      {receiptUploads.map((upload, index) => (
                        <div
                          key={`${receiptUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors ${
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
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop image here, paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
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
                            className="mb-2 w-full"
                          />
                          {upload.image && (
                            <img
                              src={upload.image}
                              alt="Preview"
                              className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded"
                            />
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onChange={(e) => {
                              const newUploads = [...receiptUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setReceiptUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptUploads([
                            ...receiptUploads,
                            { image: "", amount: "" },
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
                    <div className="text-sm text-slate-600 mb-2">
                      {t("orders.amountSell")}: {orderDetails.order.amountSell}
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
                        <img
                          src={payment.imagePath}
                          alt="Payment"
                          className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded"
                        />
                        <p className="text-sm text-slate-600">
                          Amount: {payment.amount}
                        </p>
                      </div>
                    ))}

                    <form onSubmit={handleAddPayment} className="mt-4">
                      {paymentUploads.map((upload, index) => (
                        <div
                          key={`${paymentUploadKey}-${index}`}
                          className={`mb-4 p-3 border-2 border-dashed rounded-lg transition-colors ${
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
                          {!upload.image && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              <p className="mb-2">Drag & drop image here, paste (Ctrl+V), or</p>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
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
                            className="mb-2 w-full"
                          />
                          {upload.image && (
                            <img
                              src={upload.image}
                              alt="Preview"
                              className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded"
                            />
                          )}
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t("orders.amount")}
                            value={upload.amount}
                            onChange={(e) => {
                              const newUploads = [...paymentUploads];
                              newUploads[index] = {
                                ...newUploads[index],
                                amount: e.target.value,
                              };
                              setPaymentUploads(newUploads);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentUploads([
                            ...paymentUploads,
                            { image: "", amount: "" },
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

              {!isWaitingForReceipt && !isWaitingForPayment && orderDetails && (
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
                          <span className="ml-2 text-slate-700">{orderDetails.order.rate}</span>
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
                            {orderDetails.order.amountSell}
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
                          <img
                            src={receipt.imagePath}
                            alt="Receipt"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded"
                          />
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
                          <img
                            src={payment.imagePath}
                            alt="Payment"
                            className="max-w-full max-h-96 w-auto h-auto mb-2 object-contain rounded"
                          />
                          <p className="text-sm text-slate-600">
                            Amount: {payment.amount}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Make Payment Modal */}
      {makePaymentModalOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
              {customerBeneficiaries.length > 0 && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t("orders.savedBeneficiary") ?? "Saved beneficiary for this customer"}
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
                    <option value="">{t("orders.selectSavedBeneficiary") ?? "Select saved beneficiary (optional)"}</option>
                    {customerBeneficiaries.map((beneficiary) => (
                      <option key={beneficiary.id} value={beneficiary.id}>
                        {beneficiary.paymentType === "CRYPTO"
                          ? `Crypto - ${beneficiary.networkChain || "Network"}`
                          : `Fiat - ${beneficiary.bankName || "Bank"}`}
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
                    <option value="">Select Network Chain</option>
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                    <option value="POLYGON">POLYGON</option>
                  </select>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Wallet Addresses
                    </label>
                    {beneficiaryForm.walletAddresses.map((addr, index) => (
                      <div key={index} className="mb-2">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          placeholder="Wallet Address"
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
                      + Add Another Address
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder="Bank Name"
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
                    placeholder="Account Title"
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
                    placeholder="Account Number"
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
                    placeholder="Account IBAN"
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
                    placeholder="Swift Code"
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
                    placeholder="Bank Address"
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
                  {t("orders.saveBeneficiaryToCustomer") ?? "Save this beneficiary to customer profile"}
                </label>
              </div>

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
    </div>
  );
}
