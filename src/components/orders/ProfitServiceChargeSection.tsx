import React from "react";
import { ProfitSection } from "./ProfitSection";
import { ServiceChargeSection } from "./ServiceChargeSection";
import type { Account, Order } from "../../types";

interface ProfitServiceChargeSectionProps {
  orderId: number | null;
  order: Order | null | undefined;
  accounts: Account[];
  
  // Profit state
  profitAmount: string;
  setProfitAmount: (value: string) => void;
  profitCurrency: string;
  setProfitCurrency: (value: string) => void;
  profitAccountId: string;
  setProfitAccountId: (value: string) => void;
  showProfitSection: boolean;
  setShowProfitSection: (show: boolean) => void;
  
  // Service charge state
  serviceChargeAmount: string;
  setServiceChargeAmount: (value: string) => void;
  serviceChargeCurrency: string;
  setServiceChargeCurrency: (value: string) => void;
  serviceChargeAccountId: string;
  setServiceChargeAccountId: (value: string) => void;
  showServiceChargeSection: boolean;
  setShowServiceChargeSection: (show: boolean) => void;
  
  // Handlers
  updateOrder: (payload: { id: number; data: any }) => { unwrap: () => Promise<any> };
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
  
  // Configuration
  layout?: "grid" | "vertical";
  
  t: (key: string) => string | undefined;
}

export const ProfitServiceChargeSection: React.FC<ProfitServiceChargeSectionProps> = ({
  orderId,
  order,
  accounts,
  profitAmount,
  setProfitAmount,
  profitCurrency,
  setProfitCurrency,
  profitAccountId,
  setProfitAccountId,
  showProfitSection,
  setShowProfitSection,
  serviceChargeAmount,
  setServiceChargeAmount,
  serviceChargeCurrency,
  setServiceChargeCurrency,
  serviceChargeAccountId,
  setServiceChargeAccountId,
  showServiceChargeSection,
  setShowServiceChargeSection,
  updateOrder,
  handleNumberInputWheel,
  layout = "vertical",
  t,
}) => {
  const handleSaveProfit = async () => {
    if (!orderId || !order) return;
    if (!profitAmount || !profitCurrency || !profitAccountId) {
      alert(t("orders.pleaseFillAllFields") || "Please fill all fields");
      return;
    }
    const amount = Number(profitAmount);
    if (isNaN(amount) || amount <= 0) {
      alert(t("orders.pleaseEnterValidAmount") || "Please enter a valid amount");
      return;
    }
    try {
      await updateOrder({
        id: orderId,
        data: {
          profitAmount: amount,
          profitCurrency: profitCurrency,
          profitAccountId: Number(profitAccountId),
        },
      }).unwrap();
      alert(t("orders.profitUpdatedSuccessfully") || "Profit updated successfully");
    } catch (error: any) {
      console.error("Error updating profit:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to update profit";
      alert(errorMessage);
    }
  };

  const handleSaveServiceCharge = async () => {
    if (!orderId || !order) return;
    if (!serviceChargeAmount || !serviceChargeCurrency || !serviceChargeAccountId) {
      alert(t("orders.pleaseFillAllFields") || "Please fill all fields");
      return;
    }
    const amount = Number(serviceChargeAmount);
    if (isNaN(amount) || amount === 0) {
      alert(t("orders.pleaseEnterValidAmount") || "Please enter a valid amount");
      return;
    }
    try {
      await updateOrder({
        id: orderId,
        data: {
          serviceChargeAmount: amount,
          serviceChargeCurrency: serviceChargeCurrency,
          serviceChargeAccountId: Number(serviceChargeAccountId),
        },
      }).unwrap();
      alert(t("orders.serviceChargeUpdatedSuccessfully") || "Service charge updated successfully");
    } catch (error: any) {
      console.error("Error updating service charge:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to update service charge";
      alert(errorMessage);
    }
  };

  const containerClassName = layout === "grid" ? "lg:col-span-2 border-t pt-4 mt-4 space-y-4" : "border-t pt-4 mt-4 space-y-4";

  return (
    <div className={containerClassName}>
      <div className="flex gap-2">
        {!showProfitSection && (
          <button
            type="button"
            onClick={() => setShowProfitSection(true)}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {t("orders.addProfit") || "ADD PROFIT"}
          </button>
        )}
        {!showServiceChargeSection && (
          <button
            type="button"
            onClick={() => setShowServiceChargeSection(true)}
            className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            {t("orders.addServiceCharges") || "ADD SERVICE CHARGES"}
          </button>
        )}
      </div>

      {/* Profit Section */}
      <ProfitSection
        profitAmount={profitAmount}
        setProfitAmount={setProfitAmount}
        profitCurrency={profitCurrency}
        setProfitCurrency={setProfitCurrency}
        profitAccountId={profitAccountId}
        setProfitAccountId={setProfitAccountId}
        showProfitSection={showProfitSection}
        setShowProfitSection={setShowProfitSection}
        onSave={handleSaveProfit}
        order={order}
        accounts={accounts}
        handleNumberInputWheel={handleNumberInputWheel}
        t={t}
      />

      {/* Service Charge Section */}
      <ServiceChargeSection
        serviceChargeAmount={serviceChargeAmount}
        setServiceChargeAmount={setServiceChargeAmount}
        serviceChargeCurrency={serviceChargeCurrency}
        setServiceChargeCurrency={setServiceChargeCurrency}
        serviceChargeAccountId={serviceChargeAccountId}
        setServiceChargeAccountId={setServiceChargeAccountId}
        showServiceChargeSection={showServiceChargeSection}
        setShowServiceChargeSection={setShowServiceChargeSection}
        onSave={handleSaveServiceCharge}
        order={order}
        accounts={accounts}
        handleNumberInputWheel={handleNumberInputWheel}
        t={t}
      />
    </div>
  );
};

