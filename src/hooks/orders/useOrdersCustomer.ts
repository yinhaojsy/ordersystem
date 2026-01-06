import { useState, type FormEvent } from "react";

interface UseOrdersCustomerParams {
  addCustomer: any;
  setForm: (updater: (prev: any) => any) => void;
  setIsCreateCustomerModalOpen: (isOpen: boolean) => void;
}

export function useOrdersCustomer({
  addCustomer,
  setForm,
  setIsCreateCustomerModalOpen,
}: UseOrdersCustomerParams) {
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

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

  return {
    customerForm,
    setCustomerForm,
    resetCustomerForm,
    handleCreateCustomer,
  };
}

