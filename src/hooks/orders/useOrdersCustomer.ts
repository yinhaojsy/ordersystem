import { useState, type FormEvent } from "react";
import type { Customer } from "../../types";

interface UseOrdersCustomerParams {
  addCustomer: any;
  setForm: (updater: (prev: any) => any) => void;
  setOtcForm?: (updater: (prev: any) => any) => void;
  setIsCreateCustomerModalOpen: (isOpen: boolean) => void;
  customers: Customer[];
  setAlertModal?: (modal: { isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }) => void;
  t?: (key: string) => string;
}

export function useOrdersCustomer({
  addCustomer,
  setForm,
  setOtcForm,
  setIsCreateCustomerModalOpen,
  customers,
  setAlertModal,
  t,
}: UseOrdersCustomerParams) {
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    remarks: "",
  });

  const resetCustomerForm = () => {
    setCustomerForm({
      name: "",
      email: "",
      phone: "",
      remarks: "",
    });
  };

  const handleCreateCustomer = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedForm = {
      name: customerForm.name.trim(),
      email: customerForm.email.trim(),
      phone: customerForm.phone.trim(),
      remarks: customerForm.remarks.trim(),
    };

    if (!trimmedForm.name) {
      setAlertModal?.({
        isOpen: true,
        message: t ? t("customers.nameRequired") : "Customer name is required.",
        type: "warning",
      });
      return;
    }

    const duplicate = customers.some(
      (c) => (c.name || "").trim().toLowerCase() === trimmedForm.name.toLowerCase(),
    );

    if (duplicate) {
      setAlertModal?.({
        isOpen: true,
        message: t ? t("customers.duplicateName") : "Customer with this name already exists.",
        type: "error",
      });
      return;
    }

    try {
      const newCustomer = await addCustomer({
        ...trimmedForm,
        id: undefined,
      }).unwrap();
      
      // Select the newly created customer
      if (newCustomer?.id) {
        const newId = String(newCustomer.id);
        setForm((p) => ({ ...p, customerId: newId }));
        if (setOtcForm) {
          setOtcForm((p) => ({ ...p, customerId: newId }));
        }
      }
      
      resetCustomerForm();
      setIsCreateCustomerModalOpen(false);
    } catch (err: any) {
      let message = t ? t("customers.saveFailed") : "Could not save customer. Please try again.";
      if (err?.status === 409) {
        message = t ? t("customers.duplicateName") : "Customer with this name already exists.";
      } else if (err?.data) {
        if (typeof err.data === "string") {
          message = err.data;
        } else if (err.data.message) {
          message = err.data.message;
        }
      }

      setAlertModal?.({ isOpen: true, message, type: "error" });
      if (!setAlertModal) {
        console.error("Error creating customer:", err);
      }
    }
  };

  return {
    customerForm,
    setCustomerForm,
    resetCustomerForm,
    handleCreateCustomer,
  };
}

