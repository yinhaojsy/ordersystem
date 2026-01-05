import { useState, useRef, useCallback } from "react";

export interface UploadItem {
  image: string;
  file?: File;
  amount: string;
  accountId: string;
}

const initialUploadItem: UploadItem = { image: "", amount: "", accountId: "" };

export function useViewOrderModal() {
  const [viewModalOrderId, setViewModalOrderId] = useState<number | null>(null);
  const [makePaymentModalOrderId, setMakePaymentModalOrderId] = useState<number | null>(null);
  
  // Upload state
  const [receiptUploads, setReceiptUploads] = useState<UploadItem[]>([{ ...initialUploadItem }]);
  const [paymentUploads, setPaymentUploads] = useState<UploadItem[]>([{ ...initialUploadItem }]);
  const [receiptUploadKey, setReceiptUploadKey] = useState(0);
  const [paymentUploadKey, setPaymentUploadKey] = useState(0);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [showPaymentUpload, setShowPaymentUpload] = useState(false);
  const [receiptDragOver, setReceiptDragOver] = useState(false);
  const [paymentDragOver, setPaymentDragOver] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<"receipt" | "payment" | null>(null);
  
  // File input refs
  const receiptFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const paymentFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Flex order and excess payment state
  const [flexOrderRate, setFlexOrderRate] = useState<string | null>(null);
  const [excessPaymentWarning, setExcessPaymentWarning] = useState<{
    excessAmount: number;
    additionalReceiptsNeeded: number;
  } | null>(null);
  
  // Profit and service charge state
  const [profitAmount, setProfitAmount] = useState<string>("");
  const [profitCurrency, setProfitCurrency] = useState<string>("");
  const [profitAccountId, setProfitAccountId] = useState<string>("");
  const [serviceChargeAmount, setServiceChargeAmount] = useState<string>("");
  const [serviceChargeCurrency, setServiceChargeCurrency] = useState<string>("");
  const [serviceChargeAccountId, setServiceChargeAccountId] = useState<string>("");
  const [showProfitSection, setShowProfitSection] = useState(false);
  const [showServiceChargeSection, setShowServiceChargeSection] = useState(false);
  
  // Excess payment/receipt modals
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

  const closeViewModal = useCallback(() => {
    setViewModalOrderId(null);
    setReceiptUploads([{ ...initialUploadItem }]);
    setPaymentUploads([{ ...initialUploadItem }]);
    setReceiptUploadKey(0);
    setPaymentUploadKey(0);
    setFlexOrderRate(null);
    setExcessPaymentWarning(null);
    // Reset profit and service charge state
    setProfitAmount("");
    setProfitCurrency("");
    setProfitAccountId("");
    setServiceChargeAmount("");
    setServiceChargeCurrency("");
    setServiceChargeAccountId("");
    setShowProfitSection(false);
    setShowServiceChargeSection(false);
    setShowReceiptUpload(false);
    setShowPaymentUpload(false);
    // Clear refs
    receiptFileInputRefs.current = {};
    paymentFileInputRefs.current = {};
  }, []);

  return {
    // View modal state
    viewModalOrderId,
    setViewModalOrderId,
    makePaymentModalOrderId,
    setMakePaymentModalOrderId,
    closeViewModal,
    // Upload state
    receiptUploads,
    setReceiptUploads,
    paymentUploads,
    setPaymentUploads,
    receiptUploadKey,
    setReceiptUploadKey,
    paymentUploadKey,
    setPaymentUploadKey,
    showReceiptUpload,
    setShowReceiptUpload,
    showPaymentUpload,
    setShowPaymentUpload,
    receiptDragOver,
    setReceiptDragOver,
    paymentDragOver,
    setPaymentDragOver,
    activeUploadType,
    setActiveUploadType,
    receiptFileInputRefs,
    paymentFileInputRefs,
    // Flex order state
    flexOrderRate,
    setFlexOrderRate,
    excessPaymentWarning,
    setExcessPaymentWarning,
    // Profit and service charge state
    profitAmount,
    setProfitAmount,
    profitCurrency,
    setProfitCurrency,
    profitAccountId,
    setProfitAccountId,
    serviceChargeAmount,
    setServiceChargeAmount,
    serviceChargeCurrency,
    setServiceChargeCurrency,
    serviceChargeAccountId,
    setServiceChargeAccountId,
    showProfitSection,
    setShowProfitSection,
    showServiceChargeSection,
    setShowServiceChargeSection,
    // Excess modals
    showExcessPaymentModal,
    setShowExcessPaymentModal,
    excessPaymentModalData,
    setExcessPaymentModalData,
    showMissingPaymentModal,
    setShowMissingPaymentModal,
    missingPaymentModalData,
    setMissingPaymentModalData,
    showExcessReceiptModal,
    setShowExcessReceiptModal,
    excessReceiptModalData,
    setExcessReceiptModalData,
    showExcessPaymentModalNormal,
    setShowExcessPaymentModalNormal,
    excessPaymentModalNormalData,
    setExcessPaymentModalNormalData,
  };
}

