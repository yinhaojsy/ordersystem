import { useState } from "react";
import type { FormEvent } from "react";
import { useAddBeneficiaryMutation, useAddCustomerBeneficiaryMutation } from "../../services/api";
import type { Order, Account } from "../../types";

interface BeneficiaryForm {
  paymentAccountId: string;
}

export function useBeneficiaryForm(
  orders: Order[],
  accounts: Account[],
  makePaymentModalOrderId: number | null,
  setOpenMenuId: (id: number | null) => void,
  setViewModalOrderId: (id: number | null) => void,
  setMakePaymentModalOrderId: (id: number | null) => void,
  t: (key: string) => string
) {
  const [beneficiaryForm, setBeneficiaryForm] = useState<BeneficiaryForm>({
    paymentAccountId: "",
  });
  const [saveBeneficiaryToCustomer, setSaveBeneficiaryToCustomer] = useState(false);
  const [selectedCustomerBeneficiaryId, setSelectedCustomerBeneficiaryId] = useState<number | "">("");

  const [addBeneficiary] = useAddBeneficiaryMutation();
  const [addCustomerBeneficiary] = useAddCustomerBeneficiaryMutation();

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

  const resetBeneficiaryForm = () => {
    setBeneficiaryForm({
      paymentAccountId: "",
    });
    setSaveBeneficiaryToCustomer(false);
    setSelectedCustomerBeneficiaryId("");
  };

  const closeMakePaymentModal = () => {
    resetBeneficiaryForm();
    setMakePaymentModalOrderId(null);
    setSaveBeneficiaryToCustomer(false);
    setSelectedCustomerBeneficiaryId("");
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
        const confirmMessage = (t("orders.insufficientBalanceWarning") || "Insufficient balance")
          .replace("{{accountName}}", selectedAccount.name)
          .replace("{{currentBalance}}", currentBalance.toFixed(2))
          .replace("{{currency}}", selectedAccount.currencyCode)
          .replace("{{requiredAmount}}", requiredAmount.toFixed(2))
          .replace("{{newBalance}}", newBalance.toFixed(2));
        
        if (!window.confirm(confirmMessage)) {
          return; // User cancelled
        }
      }
    }

    const payload: any = {
      id: makePaymentModalOrderId,
      paymentAccountId: Number(beneficiaryForm.paymentAccountId),
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
    
    setViewModalOrderId(orderId);
  };

  return {
    beneficiaryForm,
    setBeneficiaryForm,
    saveBeneficiaryToCustomer,
    setSaveBeneficiaryToCustomer,
    selectedCustomerBeneficiaryId,
    setSelectedCustomerBeneficiaryId,
    applyCustomerBeneficiaryToForm,
    resetBeneficiaryForm,
    closeMakePaymentModal,
    handleAddBeneficiary,
  };
}

