import { useState, type FormEvent } from "react";

interface UseOrdersCustomerParams {
  addCustomer: any;
  setForm: (updater: (prev: any) => any) => void;
  setOtcForm?: (updater: (prev: any) => any) => void;
  setIsCreateCustomerModalOpen: (isOpen: boolean) => void;
}

export function useOrdersCustomer({
  addCustomer,
  setForm,
  setOtcForm,
  setIsCreateCustomerModalOpen,
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
    if (!customerForm.name) return;
    
    try {
      const newCustomer = await addCustomer({
        name: customerForm.name,
        email: customerForm.email || "",
        phone: customerForm.phone || "",
        remarks: customerForm.remarks || "",
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
    } catch (error) {
      console.error("Error creating customer:", error);
    }
  };

  return {
    customerForm,
    setCustomerForm,
    resetCustomerForm,
    handleCreateCustomer,
  };
}

