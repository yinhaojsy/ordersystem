import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from "../../services/api";
import { useAppSelector } from "../../app/hooks";
import { canApproveDelete, canApproveEdit } from "../../utils/orderPermissions";

export function NotificationSettings() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const { data: prefsData, isLoading } = useGetNotificationPreferencesQuery();
  const [updatePreferences, { isLoading: isSaving }] =
    useUpdateNotificationPreferencesMutation();

  // Check if user has approval permissions
  const hasApprovalPermissions = user && (canApproveDelete(user) || canApproveEdit(user));
  
  // Check if user is admin (only admins can control Telegram notifications)
  const isAdmin = user?.role === "admin";

  const [prefs, setPrefs] = useState({
    notifyApprovalApproved: true,
    notifyApprovalRejected: true,
    notifyApprovalPending: true,
    notifyOrderAssigned: true,
    notifyOrderUnassigned: true,
    notifyOrderCreated: false,
    notifyOrderCompleted: false,
    notifyOrderCancelled: false,
    notifyOrderDeleted: true,
    notifyExpenseCreated: false,
    notifyExpenseDeleted: true,
    notifyTransferCreated: false,
    notifyTransferDeleted: true,
    notifyWalletIncoming: true,
    notifyWalletOutgoing: true,
    enableEmailNotifications: false,
    enablePushNotifications: false,
    enableTelegramNotifications: true,
  });

  useEffect(() => {
    if (prefsData?.preferences) {
      setPrefs(prefsData.preferences);
    }
  }, [prefsData]);

  const handleToggle = (key: string) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  const handleSave = async () => {
    try {
      await updatePreferences(prefs).unwrap();
      alert(t("notifications.settingsSaved") || "Settings saved successfully!");
    } catch (error) {
      alert(t("notifications.settingsError") || "Error saving settings");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">{t("common.loading")}</div>;
  }

  const PreferenceToggle = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: () => void;
  }) => (
    <div className="flex items-start justify-between py-4 border-b border-slate-200 last:border-0">
      <div className="flex-1">
        <p className="font-medium text-slate-900">{label}</p>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Approval Notifications */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("notifications.approvalNotifications") || "Approval Notifications"}
        </h3>
        <PreferenceToggle
          label={t("notifications.notifyApprovalApproved") || "Request Approved"}
          description={
            t("notifications.notifyApprovalApprovedDesc") ||
            "Get notified when your approval requests are approved"
          }
          checked={prefs.notifyApprovalApproved}
          onChange={() => handleToggle("notifyApprovalApproved")}
        />
        <PreferenceToggle
          label={t("notifications.notifyApprovalRejected") || "Request Rejected"}
          description={
            t("notifications.notifyApprovalRejectedDesc") ||
            "Get notified when your approval requests are rejected"
          }
          checked={prefs.notifyApprovalRejected}
          onChange={() => handleToggle("notifyApprovalRejected")}
        />
        {hasApprovalPermissions && (
          <PreferenceToggle
            label={t("notifications.notifyApprovalPending") || "New Approval Requests"}
            description={
              t("notifications.notifyApprovalPendingDesc") ||
              "Get notified when someone requests your approval"
            }
            checked={prefs.notifyApprovalPending}
            onChange={() => handleToggle("notifyApprovalPending")}
          />
        )}
      </div>

      {/* Order Notifications */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("notifications.orderNotifications") || "Order Notifications"}
        </h3>
        <PreferenceToggle
          label={t("notifications.notifyOrderAssigned") || "Order Assigned to Me"}
          description={
            t("notifications.notifyOrderAssignedDesc") ||
            "Get notified when an order is assigned to you"
          }
          checked={prefs.notifyOrderAssigned}
          onChange={() => handleToggle("notifyOrderAssigned")}
        />
        <PreferenceToggle
          label={t("notifications.notifyOrderUnassigned") || "Order Unassigned from Me"}
          description={
            t("notifications.notifyOrderUnassignedDesc") ||
            "Get notified when you're unassigned from an order"
          }
          checked={prefs.notifyOrderUnassigned}
          onChange={() => handleToggle("notifyOrderUnassigned")}
        />
        <PreferenceToggle
          label={t("notifications.notifyOrderCreated") || "New Order Created"}
          description={
            t("notifications.notifyOrderCreatedDesc") ||
            "Get notified when any new order is created"
          }
          checked={prefs.notifyOrderCreated}
          onChange={() => handleToggle("notifyOrderCreated")}
        />
        <PreferenceToggle
          label={t("notifications.notifyOrderCompleted") || "Order Completed"}
          description={
            t("notifications.notifyOrderCompletedDesc") ||
            "Get notified when any order is completed"
          }
          checked={prefs.notifyOrderCompleted}
          onChange={() => handleToggle("notifyOrderCompleted")}
        />
        <PreferenceToggle
          label={t("notifications.notifyOrderCancelled") || "Order Cancelled"}
          description={
            t("notifications.notifyOrderCancelledDesc") ||
            "Get notified when any order is cancelled"
          }
          checked={prefs.notifyOrderCancelled}
          onChange={() => handleToggle("notifyOrderCancelled")}
        />
        <PreferenceToggle
          label={t("notifications.notifyOrderDeleted") || "Order Deleted"}
          description={
            t("notifications.notifyOrderDeletedDesc") ||
            "Get notified when any order is deleted (recommended)"
          }
          checked={prefs.notifyOrderDeleted}
          onChange={() => handleToggle("notifyOrderDeleted")}
        />
      </div>

      {/* Expense Notifications */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("notifications.expenseNotifications") || "Expense Notifications"}
        </h3>
        <PreferenceToggle
          label={t("notifications.notifyExpenseCreated") || "New Expense Created"}
          description={
            t("notifications.notifyExpenseCreatedDesc") ||
            "Get notified when any new expense is created"
          }
          checked={prefs.notifyExpenseCreated}
          onChange={() => handleToggle("notifyExpenseCreated")}
        />
        <PreferenceToggle
          label={t("notifications.notifyExpenseDeleted") || "Expense Deleted"}
          description={
            t("notifications.notifyExpenseDeletedDesc") ||
            "Get notified when any expense is deleted (recommended)"
          }
          checked={prefs.notifyExpenseDeleted}
          onChange={() => handleToggle("notifyExpenseDeleted")}
        />
      </div>

      {/* Transfer Notifications */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("notifications.transferNotifications") || "Transfer Notifications"}
        </h3>
        <PreferenceToggle
          label={t("notifications.notifyTransferCreated") || "New Transfer Created"}
          description={
            t("notifications.notifyTransferCreatedDesc") ||
            "Get notified when any new transfer is created"
          }
          checked={prefs.notifyTransferCreated}
          onChange={() => handleToggle("notifyTransferCreated")}
        />
        <PreferenceToggle
          label={t("notifications.notifyTransferDeleted") || "Transfer Deleted"}
          description={
            t("notifications.notifyTransferDeletedDesc") ||
            "Get notified when any transfer is deleted (recommended)"
          }
          checked={prefs.notifyTransferDeleted}
          onChange={() => handleToggle("notifyTransferDeleted")}
        />
      </div>

      {/* Wallet Notifications */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("notifications.walletNotifications") || "Wallet Notifications"}
        </h3>
        <PreferenceToggle
          label={t("notifications.notifyWalletIncoming") || "Incoming Transactions"}
          description={
            t("notifications.notifyWalletIncomingDesc") ||
            "Get notified when tracked wallets receive incoming transactions"
          }
          checked={prefs.notifyWalletIncoming}
          onChange={() => handleToggle("notifyWalletIncoming")}
        />
        <PreferenceToggle
          label={t("notifications.notifyWalletOutgoing") || "Outgoing Transactions"}
          description={
            t("notifications.notifyWalletOutgoingDesc") ||
            "Get notified when tracked wallets send outgoing transactions"
          }
          checked={prefs.notifyWalletOutgoing}
          onChange={() => handleToggle("notifyWalletOutgoing")}
        />
      </div>

      {/* Advanced Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("notifications.advancedSettings") || "Advanced Settings"}
        </h3>
        {isAdmin && (
          <PreferenceToggle
            label={t("notifications.enableTelegramNotifications") || "Telegram Bot Notifications (System-Wide)"}
            description={
              t("notifications.enableTelegramNotificationsDesc") ||
              "Enable Telegram notifications for all users. When enabled, all notifications will be sent to the configured Telegram group chat. (Admin Only)"
            }
            checked={prefs.enableTelegramNotifications}
            onChange={() => handleToggle("enableTelegramNotifications")}
          />
        )}
        <PreferenceToggle
          label={t("notifications.enableEmailNotifications") || "Email Notifications"}
          description={
            t("notifications.enableEmailNotificationsDesc") ||
            "Receive notifications via email (coming soon)"
          }
          checked={prefs.enableEmailNotifications}
          onChange={() => handleToggle("enableEmailNotifications")}
        />
        <PreferenceToggle
          label={t("notifications.enablePushNotifications") || "Browser Push Notifications"}
          description={
            t("notifications.enablePushNotificationsDesc") ||
            "Receive browser push notifications (coming soon)"
          }
          checked={prefs.enablePushNotifications}
          onChange={() => handleToggle("enablePushNotifications")}
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {isSaving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
