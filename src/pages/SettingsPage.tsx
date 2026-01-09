import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "../components/common/SectionCard";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  useCreateBackupMutation,
  useRestoreBackupMutation,
  useResetTableIdsMutation,
  useGetDbSchemaQuery,
  useExecuteQueryMutation,
} from "../services/api";

export default function SettingsPage() {
  const { t } = useTranslation();

  // Backup/Restore state
  const [backupType, setBackupType] = useState<"db" | "full">("db");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset IDs state
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [resetResults, setResetResults] = useState<any[]>([]);

  // Debug state
  const [showSchema, setShowSchema] = useState(false);
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResults, setQueryResults] = useState<any>(null);

  // API hooks
  const [createBackup, { isLoading: isCreatingBackup }] = useCreateBackupMutation();
  const [restoreBackup, { isLoading: isRestoring }] = useRestoreBackupMutation();
  const [resetTableIds, { isLoading: isResetting }] = useResetTableIdsMutation();
  const { data: schemaData } = useGetDbSchemaQuery(undefined, { skip: !showSchema });
  const [executeQuery, { isLoading: isExecuting }] = useExecuteQueryMutation();

  // Backup handlers
  const handleCreateBackup = async () => {
    try {
      const result = await createBackup({ includeFiles: backupType === "full" }).unwrap();
      
      // Create download link
      const blob = result as any;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupType === "full" 
        ? `backup-${new Date().toISOString().split("T")[0]}.zip`
        : `backup-${new Date().toISOString().split("T")[0]}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert(t("settings.backupRestore.backupSuccess"));
    } catch (error) {
      console.error("Backup error:", error);
      alert(t("settings.backupRestore.backupError"));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowRestoreConfirm(true);
    }
  };

  const handleRestoreConfirm = async () => {
    if (!selectedFile) return;

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await restoreBackup(formData).unwrap();
      alert(t("settings.backupRestore.restoreSuccess"));
      setShowRestoreConfirm(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Restore error:", error);
      alert(t("settings.backupRestore.restoreError"));
    }
  };

  const handleRestoreCancel = () => {
    setShowRestoreConfirm(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Reset IDs handlers
  const handleTableToggle = (tableName: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableName)
        ? prev.filter((t) => t !== tableName)
        : [...prev, tableName]
    );
  };

  const handleResetIds = async () => {
    if (selectedTables.length === 0) {
      alert(t("settings.resetIds.selectTables"));
      return;
    }

    try {
      const result = await resetTableIds({ tables: selectedTables }).unwrap();
      setResetResults(result.results);
      alert(t("settings.resetIds.resetSuccess"));
    } catch (error) {
      console.error("Reset IDs error:", error);
      alert(t("settings.resetIds.resetError"));
    }
  };

  // Debug handlers
  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) {
      return;
    }

    try {
      const result = await executeQuery({ sql: sqlQuery }).unwrap();
      setQueryResults(result);
    } catch (error: any) {
      console.error("Query error:", error);
      setQueryResults({
        success: false,
        message: error.data?.message || error.message || "Query failed",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Backup & Restore Section */}
      <SectionCard
        title={t("settings.backupRestore.title")}
        description={t("settings.backupRestore.description")}
      >
        <div className="space-y-4">
          {/* Backup Options */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {t("settings.backupRestore.backupOptions")}
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="backupType"
                  value="db"
                  checked={backupType === "db"}
                  onChange={(e) => setBackupType(e.target.value as "db")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-slate-900">
                    {t("settings.backupRestore.databaseOnly")}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t("settings.backupRestore.databaseOnlyDesc")}
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="backupType"
                  value="full"
                  checked={backupType === "full"}
                  onChange={(e) => setBackupType(e.target.value as "full")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-slate-900">
                    {t("settings.backupRestore.databaseAndFiles")}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t("settings.backupRestore.databaseAndFilesDesc")}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Backup Button */}
          <button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreatingBackup
              ? t("settings.backupRestore.creatingBackup")
              : t("settings.backupRestore.createBackup")}
          </button>

          <div className="border-t border-slate-200 pt-4">
            {/* Restore Section */}
            <div className="mb-2 text-sm font-medium text-slate-700">
              {t("settings.backupRestore.restore")}
            </div>
            <div className="mb-2 text-sm text-orange-600">
              {t("settings.backupRestore.restoreWarning")}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.zip"
              onChange={handleFileSelect}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
        </div>
      </SectionCard>

      {/* Reset IDs Section */}
      <SectionCard
        title={t("settings.resetIds.title")}
        description={t("settings.resetIds.description")}
      >
        <div className="space-y-4">
          <div className="text-sm text-orange-600">
            {t("settings.resetIds.resetWarning")}
          </div>

          {/* Table Selection */}
          <div className="space-y-2">
            {["orders", "expenses", "internal_transfers"].map((tableName) => (
              <label
                key={tableName}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedTables.includes(tableName)}
                  onChange={() => handleTableToggle(tableName)}
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {tableName === "orders" && t("settings.resetIds.orders")}
                    {tableName === "expenses" && t("settings.resetIds.expenses")}
                    {tableName === "internal_transfers" && t("settings.resetIds.transfers")}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Reset Results */}
          {resetResults.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="mb-2 text-sm font-medium text-slate-700">
                {t("settings.resetIds.status")}
              </div>
              <div className="space-y-2">
                {resetResults.map((result, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">{result.table}:</span>{" "}
                    <span
                      className={result.success ? "text-green-600" : "text-red-600"}
                    >
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset Button */}
          <button
            onClick={handleResetIds}
            disabled={isResetting || selectedTables.length === 0}
            className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isResetting
              ? t("settings.resetIds.resetting")
              : t("settings.resetIds.resetSelected")}
          </button>
        </div>
      </SectionCard>

      {/* Database Debug Section */}
      <SectionCard
        title={t("settings.debug.title")}
        description={t("settings.debug.description")}
      >
        <div className="space-y-4">
          {/* Schema Viewer */}
          <div>
            <button
              onClick={() => setShowSchema(!showSchema)}
              className="rounded-lg bg-slate-600 px-4 py-2 font-semibold text-white hover:bg-slate-700"
            >
              {showSchema
                ? t("settings.debug.hideSchema")
                : t("settings.debug.viewSchema")}
            </button>
          </div>

          {showSchema && schemaData && (
            <div className="space-y-4 rounded-lg bg-slate-50 p-4">
              {schemaData.schema.map((table) => (
                <div key={table.name} className="rounded-lg bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">{table.name}</h3>
                    <span className="text-sm text-slate-600">
                      {table.rowCount} {t("settings.debug.rowCount").toLowerCase()}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-2 py-1 text-left font-medium text-slate-700">
                            {t("settings.debug.columnName")}
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-slate-700">
                            {t("settings.debug.type")}
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-slate-700">
                            {t("settings.debug.nullable")}
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-slate-700">
                            {t("settings.debug.primaryKey")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((col) => (
                          <tr key={col.name} className="border-b border-slate-100">
                            <td className="px-2 py-1 font-mono text-slate-900">
                              {col.name}
                            </td>
                            <td className="px-2 py-1 text-slate-600">{col.type}</td>
                            <td className="px-2 py-1 text-slate-600">
                              {col.notNull ? "No" : "Yes"}
                            </td>
                            <td className="px-2 py-1 text-slate-600">
                              {col.primaryKey ? "Yes" : "No"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Query Executor */}
          <div className="border-t border-slate-200 pt-4">
            <div className="mb-2 text-sm font-medium text-slate-700">
              {t("settings.debug.queryExecutor")}
            </div>
            <div className="mb-2 text-xs text-slate-600">
              {t("settings.debug.onlySelectAllowed")}
            </div>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder={t("settings.debug.queryPlaceholder")}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            <button
              onClick={handleExecuteQuery}
              disabled={isExecuting || !sqlQuery.trim()}
              className="mt-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isExecuting
                ? t("settings.debug.executing")
                : t("settings.debug.executeQuery")}
            </button>
          </div>

          {/* Query Results */}
          {queryResults && (
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="mb-2 text-sm font-medium text-slate-700">
                {t("settings.debug.queryResults")}
              </div>
              {queryResults.success ? (
                <>
                  <div className="mb-2 text-sm text-green-600">
                    {t("settings.debug.querySuccess", {
                      count: queryResults.rowCount || 0,
                    })}
                  </div>
                  {queryResults.results && queryResults.results.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            {Object.keys(queryResults.results[0]).map((key) => (
                              <th
                                key={key}
                                className="px-2 py-1 text-left font-medium text-slate-700"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.results.map((row: any, index: number) => (
                            <tr key={index} className="border-b border-slate-100">
                              {Object.values(row).map((value: any, colIndex: number) => (
                                <td
                                  key={colIndex}
                                  className="px-2 py-1 font-mono text-slate-900"
                                >
                                  {value === null
                                    ? "NULL"
                                    : typeof value === "object"
                                    ? JSON.stringify(value)
                                    : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600">
                      {t("settings.debug.noResults")}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-red-600">
                  {t("settings.debug.queryError", {
                    message: queryResults.message || "Unknown error",
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <ConfirmModal
          title={t("settings.backupRestore.restore")}
          message={t("settings.backupRestore.restoreConfirm")}
          onConfirm={handleRestoreConfirm}
          onCancel={handleRestoreCancel}
          confirmText={t("common.confirm")}
          cancelText={t("common.cancel")}
          isLoading={isRestoring}
        />
      )}
    </div>
  );
}
