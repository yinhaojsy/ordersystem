import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../components/common/SectionCard";
import AlertModal from "../components/common/AlertModal";
import ConfirmModal from "../components/common/ConfirmModal";
import type { Customer, CustomerBeneficiary } from "../types";
import {
  useAddCustomerMutation,
  useGetCustomersQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useAddCustomerBeneficiaryMutation,
  useGetCustomerBeneficiariesQuery,
  useUpdateCustomerBeneficiaryMutation,
  useDeleteCustomerBeneficiaryMutation,
} from "../services/api";

export default function CustomersPage() {
  const { t } = useTranslation();
  const { data: customers = [], isLoading } = useGetCustomersQuery();
  const [addCustomer, { isLoading: isSaving }] = useAddCustomerMutation();
  const [addCustomerBeneficiary, { isLoading: isSavingBeneficiary }] =
    useAddCustomerBeneficiaryMutation();
  const [updateCustomerBeneficiary, { isLoading: isUpdatingBeneficiary }] =
    useUpdateCustomerBeneficiaryMutation();
  const [deleteCustomerBeneficiary, { isLoading: isDeletingBeneficiary }] =
    useDeleteCustomerBeneficiaryMutation();
  const [updateCustomer] = useUpdateCustomerMutation();
  const [deleteCustomer, { isLoading: isDeleting }] = useDeleteCustomerMutation();
  
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; type?: "error" | "warning" | "info" | "success" }>({
    isOpen: false,
    message: "",
    type: "error",
  });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; customerId: number | null }>({
    isOpen: false,
    message: "",
    customerId: null,
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    remarks: "",
  });

  const [includeBeneficiary, setIncludeBeneficiary] = useState(false);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name) return;
    const newCustomer = await addCustomer({
      name: form.name,
      email: form.email,
      phone: form.phone,
      remarks: form.remarks,
      id: undefined,
    }).unwrap();

    const hasBeneficiaryData =
      includeBeneficiary &&
      (beneficiaryForm.paymentType === "CRYPTO"
        ? beneficiaryForm.networkChain || beneficiaryForm.walletAddresses.some((addr) => addr.trim())
        : beneficiaryForm.bankName ||
          beneficiaryForm.accountTitle ||
          beneficiaryForm.accountNumber ||
          beneficiaryForm.accountIban ||
          beneficiaryForm.swiftCode ||
          beneficiaryForm.bankAddress);

    if (newCustomer?.id && hasBeneficiaryData) {
      const payload: any = {
        customerId: newCustomer.id,
        paymentType: beneficiaryForm.paymentType,
      };

      if (beneficiaryForm.paymentType === "CRYPTO") {
        payload.networkChain = beneficiaryForm.networkChain || null;
        payload.walletAddresses = beneficiaryForm.walletAddresses.filter((addr) => addr.trim());
      } else {
        payload.bankName = beneficiaryForm.bankName || null;
        payload.accountTitle = beneficiaryForm.accountTitle || null;
        payload.accountNumber = beneficiaryForm.accountNumber || null;
        payload.accountIban = beneficiaryForm.accountIban || null;
        payload.swiftCode = beneficiaryForm.swiftCode || null;
        payload.bankAddress = beneficiaryForm.bankAddress || null;
      }

      await addCustomerBeneficiary(payload);
    }

    setForm({ name: "", email: "", phone: "", remarks: "" });
    setIncludeBeneficiary(false);
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
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<typeof form | null>(null);
  const [editingBeneficiaryId, setEditingBeneficiaryId] = useState<number | null>(null);
  const [editBeneficiaryForm, setEditBeneficiaryForm] = useState({
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

  const { data: editingBeneficiaries = [], isLoading: isLoadingBeneficiaries } =
    useGetCustomerBeneficiariesQuery(editingId ?? 0, {
      skip: !editingId,
    });

  const startEditBeneficiary = (beneficiaryId: number) => {
    const b = editingBeneficiaries.find((item: CustomerBeneficiary) => item.id === beneficiaryId);
    if (!b) return;
    setEditingBeneficiaryId(beneficiaryId);
    if (b.paymentType === "CRYPTO") {
      setEditBeneficiaryForm({
        paymentType: "CRYPTO",
        networkChain: b.networkChain || "",
        walletAddresses: b.walletAddresses && b.walletAddresses.length > 0 ? b.walletAddresses : [""],
        bankName: "",
        accountTitle: "",
        accountNumber: "",
        accountIban: "",
        swiftCode: "",
        bankAddress: "",
      });
    } else {
      setEditBeneficiaryForm({
        paymentType: "FIAT",
        networkChain: "",
        walletAddresses: [""],
        bankName: b.bankName || "",
        accountTitle: b.accountTitle || "",
        accountNumber: b.accountNumber || "",
        accountIban: b.accountIban || "",
        swiftCode: b.swiftCode || "",
        bankAddress: b.bankAddress || "",
      });
    }
  };

  const cancelEditBeneficiary = () => {
    setEditingBeneficiaryId(null);
    setEditBeneficiaryForm({
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

  const startEdit = (id: number) => {
    const current = customers.find((c: Customer) => c.id === id);
    if (!current) return;
    setEditingId(id);
    setEditForm({
      name: current.name,
      email: current.email,
      phone: current.phone,
      remarks: current.remarks || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    cancelEditBeneficiary();
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    await updateCustomer({ id: editingId, data: editForm });
    cancelEdit();
  };

  const submitEditBeneficiary = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editingBeneficiaryId) return;

    const payload: any = {
      customerId: editingId,
      beneficiaryId: editingBeneficiaryId,
      paymentType: editBeneficiaryForm.paymentType,
    };

    if (editBeneficiaryForm.paymentType === "CRYPTO") {
      payload.networkChain = editBeneficiaryForm.networkChain || null;
      payload.walletAddresses = editBeneficiaryForm.walletAddresses.filter((addr) => addr.trim());
    } else {
      payload.bankName = editBeneficiaryForm.bankName || null;
      payload.accountTitle = editBeneficiaryForm.accountTitle || null;
      payload.accountNumber = editBeneficiaryForm.accountNumber || null;
      payload.accountIban = editBeneficiaryForm.accountIban || null;
      payload.swiftCode = editBeneficiaryForm.swiftCode || null;
      payload.bankAddress = editBeneficiaryForm.bankAddress || null;
    }

    await updateCustomerBeneficiary(payload);
    cancelEditBeneficiary();
  };

  const handleDeleteClick = (id: number) => {
    const customer = customers.find((c: Customer) => c.id === id);
    if (!customer) return;
    
    setConfirmModal({
      isOpen: true,
      message: t("customers.confirmDelete") || `Are you sure you want to delete ${customer.name}?`,
      customerId: id,
    });
  };

  const remove = async (id: number) => {
    try {
      await deleteCustomer(id).unwrap();
      setConfirmModal({ isOpen: false, message: "", customerId: null });
    } catch (err: any) {
      // Surface backend validation errors (e.g. foreign key constraint)
      // RTK Query error structure: err.data.message
      let message = t("customers.cannotDeleteReferenced");
      
      if (err?.data) {
        let errorMessage = '';
        if (typeof err.data === 'string') {
          errorMessage = err.data;
        } else if (err.data.message) {
          errorMessage = err.data.message;
        }
        
        // Check for specific error messages and translate them
        if (errorMessage === "Cannot delete this item because it is referenced by other records.") {
          message = t("customers.cannotDeleteReferenced");
        } else if (errorMessage === "Cannot delete customer while they have existing orders. Please delete the orders first.") {
          message = t("customers.cannotDeleteWithOrders");
        } else if (errorMessage) {
          message = errorMessage;
        }
      }
      
      setConfirmModal({ isOpen: false, message: "", customerId: null });
      setAlertModal({ isOpen: true, message, type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("customers.title")}
        // 我 REMOVED DESCRIPTION UNDER THE TITLE BEING DISPLAYED
        // description={t("customers.titledescription")}
        actions={isLoading ? t("common.loading") : `${customers.length} ${t("customers.records")}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 w-1/5">{t("customers.name")}</th>
                <th className="py-2 w-1/5">{t("customers.email")}</th>
                <th className="py-2 w-1/5">{t("customers.phone")}</th>
                <th className="py-2 w-1/5">{t("customers.remarks") || "Remarks"}</th>
                <th className="py-2 w-1/5">{t("customers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer: Customer) => (
                <tr key={customer.id} className="border-b border-slate-100">
                  <td className="py-2 w-1/5 font-semibold truncate" title={customer.name}>
                    {customer.name}
                  </td>
                  <td className="py-2 w-1/5 truncate" title={customer.email || undefined}>
                    {customer.email}
                  </td>
                  <td className="py-2 w-1/5 truncate" title={customer.phone || undefined}>
                    {customer.phone}
                  </td>
                  <td className="py-2 w-1/5 truncate" title={customer.remarks || undefined}>
                    {customer.remarks || "—"}
                  </td>
                  <td className="py-2 w-1/5">
                    <div className="flex gap-2 text-sm font-semibold">
                      <button
                        className="text-amber-600 hover:text-amber-700"
                        onClick={() => startEdit(customer.id)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => handleDeleteClick(customer.id)}
                        disabled={isDeleting}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!customers.length && (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={5}>
                    {t("customers.noCustomers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingId && editForm && (
        <SectionCard
          title={t("customers.editTitle")}
          actions={<button onClick={cancelEdit} className="text-sm text-slate-600">{t("common.cancel")}</button>}
        >
          <form className="grid gap-3 md:grid-cols-3" onSubmit={submitEdit}>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("customers.namePlaceholder")}
              value={editForm.name}
              onChange={(e) => setEditForm((p) => (p ? { ...p, name: e.target.value } : p))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("customers.emailPlaceholder")}
              value={editForm.email}
              onChange={(e) => setEditForm((p) => (p ? { ...p, email: e.target.value } : p))}
              type="email"
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("customers.phonePlaceholder")}
              value={editForm.phone}
              onChange={(e) => setEditForm((p) => (p ? { ...p, phone: e.target.value } : p))}
            />
            <textarea
              className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder={t("customers.remarksPlaceholder") || "Remarks (optional)"}
              value={editForm.remarks || ""}
              onChange={(e) => setEditForm((p) => (p ? { ...p, remarks: e.target.value } : p))}
              rows={3}
            />
            <button
              type="submit"
              className="col-span-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              {t("customers.updateCustomer")}
            </button>
          </form>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              {t("orders.customerBeneficiaryDetails")}
            </h4>
            {isLoadingBeneficiaries ? (
              <div className="text-sm text-slate-500">{t("common.loading")}</div>
            ) : !editingBeneficiaries.length ? (
              <div className="text-sm text-slate-500">
                {t("customers.noBeneficiaries")}
              </div>
            ) : (
              <div className="grid gap-3">
                {editingBeneficiaries.map((b: CustomerBeneficiary) => (
                  <div key={b.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                    {editingBeneficiaryId === b.id ? (
                      <form className="grid gap-3" onSubmit={submitEditBeneficiary}>
                        <div className="flex justify-between items-center">
                          <div className="font-semibold">{t("orders.paymentType")}</div>
                          <button
                            type="button"
                            className="text-sm text-slate-500 hover:underline"
                            onClick={cancelEditBeneficiary}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name={`edit-beneficiary-${b.id}-type`}
                              value="CRYPTO"
                              checked={editBeneficiaryForm.paymentType === "CRYPTO"}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
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
                              name={`edit-beneficiary-${b.id}-type`}
                              value="FIAT"
                              checked={editBeneficiaryForm.paymentType === "FIAT"}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
                                  ...p,
                                  paymentType: e.target.value as "CRYPTO" | "FIAT",
                                }))
                              }
                              className="mr-2"
                            />
                            {t("orders.fiat")}
                          </label>
                        </div>

                        {editBeneficiaryForm.paymentType === "CRYPTO" ? (
                          <>
                            <select
                              className="rounded-lg border border-slate-200 px-3 py-2"
                              value={editBeneficiaryForm.networkChain}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
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
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                {t("orders.walletAddresses")}
                              </label>
                              {editBeneficiaryForm.walletAddresses.map((addr, idx) => (
                                <div key={idx} className="mb-2">
                                  <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                                    placeholder={t("orders.walletAddress")}
                                    value={addr}
                                    onChange={(e) => {
                                      const newAddresses = [...editBeneficiaryForm.walletAddresses];
                                      newAddresses[idx] = e.target.value;
                                      setEditBeneficiaryForm((p) => ({
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
                                  setEditBeneficiaryForm((p) => ({
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
                              className="rounded-lg border border-slate-200 px-3 py-2"
                              placeholder={t("orders.bankName")}
                              value={editBeneficiaryForm.bankName}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
                                  ...p,
                                  bankName: e.target.value,
                                }))
                              }
                            />
                            <input
                              type="text"
                              className="rounded-lg border border-slate-200 px-3 py-2"
                              placeholder={t("orders.accountTitle")}
                              value={editBeneficiaryForm.accountTitle}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
                                  ...p,
                                  accountTitle: e.target.value,
                                }))
                              }
                            />
                            <input
                              type="text"
                              className="rounded-lg border border-slate-200 px-3 py-2"
                              placeholder={t("orders.accountNumber")}
                              value={editBeneficiaryForm.accountNumber}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
                                  ...p,
                                  accountNumber: e.target.value,
                                }))
                              }
                            />
                            <input
                              type="text"
                              className="rounded-lg border border-slate-200 px-3 py-2"
                              placeholder={t("orders.accountIban")}
                              value={editBeneficiaryForm.accountIban}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
                                  ...p,
                                  accountIban: e.target.value,
                                }))
                              }
                            />
                            <input
                              type="text"
                              className="rounded-lg border border-slate-200 px-3 py-2"
                              placeholder={t("orders.swiftCode")}
                              value={editBeneficiaryForm.swiftCode}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
                                  ...p,
                                  swiftCode: e.target.value,
                                }))
                              }
                            />
                            <input
                              type="text"
                              className="rounded-lg border border-slate-200 px-3 py-2"
                              placeholder={t("orders.bankAddress")}
                              value={editBeneficiaryForm.bankAddress}
                              onChange={(e) =>
                                setEditBeneficiaryForm((p) => ({
                                  ...p,
                                  bankAddress: e.target.value,
                                }))
                              }
                            />
                          </>
                        )}

                        <div className="flex gap-3 justify-end">
                          <button
                            type="button"
                            onClick={cancelEditBeneficiary}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            type="submit"
                            disabled={isUpdatingBeneficiary}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                          >
                            {isUpdatingBeneficiary ? t("common.saving") : t("common.save")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold">{b.paymentType}</div>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              className="text-sm text-blue-600 hover:underline"
                              onClick={() => startEditBeneficiary(b.id)}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              type="button"
                              className="text-sm text-rose-600 hover:underline"
                              onClick={() => deleteCustomerBeneficiary({ customerId: editingId!, beneficiaryId: b.id })}
                              disabled={isDeletingBeneficiary}
                            >
                              {t("common.delete")}
                            </button>
                          </div>
                        </div>
                        {b.paymentType === "CRYPTO" ? (
                          <>
                            <div>Network: {b.networkChain || "—"}</div>
                            {b.walletAddresses && b.walletAddresses.length > 0 && (
                              <div>
                                Wallets:
                                <ul className="list-disc list-inside ml-4">
                              {b.walletAddresses.map((addr: string, idx: number) => (
                                    <li key={idx}>{addr}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div>
                              {t("orders.bankName")}: {b.bankName || "—"}
                            </div>
                            <div>
                              {t("orders.accountTitle")}: {b.accountTitle || "—"}
                            </div>
                            <div>
                              {t("orders.accountNumber")}: {b.accountNumber || "—"}
                            </div>
                            <div>
                              {t("orders.accountIban")}: {b.accountIban || "—"}
                            </div>
                            <div>
                              {t("orders.swiftCode")}: {b.swiftCode || "—"}
                            </div>
                            <div>
                              {t("orders.bankAddress")}: {b.bankAddress || "—"}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t("customers.addTitle")}>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.namePlaceholder")}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.emailPlaceholder")}
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            type="email"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.phonePlaceholder")}
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
          <textarea
            className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("customers.remarksPlaceholder") || "Remarks (optional)"}
            value={form.remarks}
            onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
            rows={3}
          />
          <div className="col-span-full flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-2">
            <input
              id="include-beneficiary"
              type="checkbox"
              checked={includeBeneficiary}
              onChange={(e) => setIncludeBeneficiary(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="include-beneficiary" className="text-sm text-slate-700">
              {t("customers.addBeneficiaryOptional")}
            </label>
          </div>

          {includeBeneficiary && (
            <div className="col-span-full grid gap-3 rounded-lg border border-slate-200 px-3 py-3 bg-slate-50 md:grid-cols-2">
              <div className="col-span-full">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("orders.paymentType")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="customerBeneficiaryPaymentType"
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
                      name="customerBeneficiaryPaymentType"
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
                  <input
                    type="text"
                    className="col-span-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder={t("orders.bankAddress")}
                    value={beneficiaryForm.bankAddress}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        bankAddress: e.target.value,
                      }))
                    }
                  />
                </>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={isSaving || isSavingBeneficiary}
            className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving || isSavingBeneficiary ? t("common.saving") : t("customers.saveCustomer")}
          </button>
        </form>
      </SectionCard>

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type || "error"}
        onClose={() => setAlertModal({ isOpen: false, message: "", type: "error" })}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={() => confirmModal.customerId && remove(confirmModal.customerId)}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", customerId: null })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="warning"
      />
    </div>
  );
}


