import { useState, useCallback } from "react";

export interface ProcessOrderFormState {
  handlerId: string;
  paymentFlow: "receive_first" | "pay_first";
}

const initialProcessFormState: ProcessOrderFormState = {
  handlerId: "",
  paymentFlow: "receive_first",
};

export function useProcessOrderModal() {
  const [processModalOrderId, setProcessModalOrderId] = useState<number | null>(null);
  const [processForm, setProcessForm] = useState<ProcessOrderFormState>(initialProcessFormState);

  const resetProcessForm = useCallback(() => {
    setProcessForm(initialProcessFormState);
  }, []);

  const closeProcessModal = useCallback(() => {
    resetProcessForm();
    setProcessModalOrderId(null);
  }, [resetProcessForm]);

  return {
    processModalOrderId,
    setProcessModalOrderId,
    processForm,
    setProcessForm,
    resetProcessForm,
    closeProcessModal,
  };
}

