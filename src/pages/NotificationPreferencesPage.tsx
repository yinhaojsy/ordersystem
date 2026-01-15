import React from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../components/common/SectionCard";
import { NotificationSettings } from "../components/settings/NotificationSettings";

export default function NotificationPreferencesPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("notificationPreferences.title") || "Notification Preferences"}
        description={
          t("notificationPreferences.description") ||
          "Manage your notification preferences and choose which alerts you want to receive"
        }
      >
        <NotificationSettings />
      </SectionCard>
    </div>
  );
}
