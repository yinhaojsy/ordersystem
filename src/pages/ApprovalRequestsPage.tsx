import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../app/hooks";
import SectionCard from "../components/common/SectionCard";
import { useListApprovalRequestsQuery, useApproveRequestMutation, useRejectRequestMutation, useGetApprovalRequestQuery, useGetAccountsQuery } from "../services/api";
import { canApproveDelete, canApproveEdit } from "../utils/orderPermissions";
import type { ApprovalRequest } from "../types";

export default function ApprovalRequestsPage() {
  const { t } = useTranslation();
  const authUser = useAppSelector((s) => s.auth.user);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<"order" | "expense" | "transfer" | "all">("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState<"delete" | "edit" | "all">("all");
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    src: string;
    type: 'image' | 'pdf';
    title: string;
  } | null>(null);

  // Check if user has approval permissions
  const canApproveDeleteRequests = canApproveDelete(authUser);
  const canApproveEditRequests = canApproveEdit(authUser);
  const hasApprovalPermissions = canApproveDeleteRequests || canApproveEditRequests;

  // Fetch approval requests
  const { data: requests = [], isLoading, refetch } = useListApprovalRequestsQuery({
    status: statusFilter === "all" ? "all" : statusFilter,
    entityType: entityTypeFilter === "all" ? undefined : entityTypeFilter,
    requestType: requestTypeFilter === "all" ? undefined : requestTypeFilter,
  });

  // Get detailed request if one is selected
  const { data: selectedRequest } = useGetApprovalRequestQuery(selectedRequestId!, {
    skip: !selectedRequestId,
  });

  // Fetch accounts to resolve account names for amended orders
  const { data: accounts = [] } = useGetAccountsQuery();

  const [approveRequest, { isLoading: isApproving }] = useApproveRequestMutation();
  const [rejectRequest, { isLoading: isRejecting }] = useRejectRequestMutation();

  // Filter requests by user permissions
  const filteredRequests = useMemo(() => {
    return requests.filter((req: ApprovalRequest) => {
      if (req.requestType === "delete" && !canApproveDeleteRequests) return false;
      if (req.requestType === "edit" && !canApproveEditRequests) return false;
      return true;
    });
  }, [requests, canApproveDeleteRequests, canApproveEditRequests]);

  // Statistics
  const stats = useMemo(() => {
    const pending = filteredRequests.filter((r: ApprovalRequest) => r.status === "pending").length;
    const approved = filteredRequests.filter((r: ApprovalRequest) => r.status === "approved").length;
    const rejected = filteredRequests.filter((r: ApprovalRequest) => r.status === "rejected").length;
    return { pending, approved, rejected, total: filteredRequests.length };
  }, [filteredRequests]);

  const handleApprove = async (id: number) => {
    try {
      await approveRequest(id).unwrap();
      setSelectedRequestId(null);
      refetch();
    } catch (error: any) {
      alert(error?.data?.message || "Error approving request");
    }
  };

  const handleReject = async (id: number, reason?: string) => {
    try {
      await rejectRequest({ id, reason }).unwrap();
      setSelectedRequestId(null);
      refetch();
    } catch (error: any) {
      alert(error?.data?.message || "Error rejecting request");
    }
  };

  if (!hasApprovalPermissions) {
    return (
      <div className="space-y-6">
        <SectionCard title={t("approvals.title") || "Approval Requests"}>
          <p className="text-slate-600">
            {t("approvals.noPermission") || "You don't have permission to view approval requests."}
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title={t("approvals.title") || "Approval Requests"}>
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-sm text-slate-600">{t("approvals.pendingRequests") || "Pending Requests"}</div>
            <div className="mt-2 text-2xl font-semibold text-amber-600">{stats.pending}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-sm text-slate-600">{t("approvals.approvedRequests") || "Approved Requests"}</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">{stats.approved}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-sm text-slate-600">{t("approvals.rejectedRequests") || "Rejected Requests"}</div>
            <div className="mt-2 text-2xl font-semibold text-rose-600">{stats.rejected}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">{t("approvals.allStatuses") || "All Statuses"}</option>
            <option value="pending">{t("approvals.pending") || "Pending"}</option>
            <option value="approved">{t("approvals.approved") || "Approved"}</option>
            <option value="rejected">{t("approvals.rejected") || "Rejected"}</option>
          </select>
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">{t("approvals.allEntities") || "All Entities"}</option>
            <option value="order">{t("approvals.orders") || "Orders"}</option>
            <option value="expense">{t("approvals.expenses") || "Expenses"}</option>
            <option value="transfer">{t("approvals.transfers") || "Transfers"}</option>
          </select>
          <select
            value={requestTypeFilter}
            onChange={(e) => setRequestTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">{t("approvals.allTypes") || "All Types"}</option>
            <option value="delete">{t("approvals.delete") || "Delete"}</option>
            <option value="edit">{t("approvals.edit") || "Edit"}</option>
          </select>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="text-center py-8 text-slate-500">{t("common.loading")}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {t("approvals.noRequests") || "No approval requests found"}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request: ApprovalRequest) => (
              <div
                key={request.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        request.status === "pending" ? "bg-amber-100 text-amber-800" :
                        request.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                        "bg-rose-100 text-rose-800"
                      }`}>
                        {request.status}
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {request.entityType === "order" ? t("approvals.order") || "Order" :
                         request.entityType === "expense" ? t("approvals.expense") || "Expense" :
                         t("approvals.transfer") || "Transfer"} #{request.entityId}
                      </span>
                      <span className="text-sm text-slate-500">
                        {request.requestType === "delete" ? t("approvals.deleteRequest") || "Delete Request" :
                         t("approvals.editRequest") || "Edit Request"}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {t("approvals.requestedBy") || "Requested by"}: {request.requestedByName || `User #${request.requestedBy}`}
                      {" • "}
                      {new Date(request.requestedAt).toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-700 bg-slate-50 rounded p-2 mb-2">
                      <strong>{t("approvals.reason") || "Reason"}:</strong> {request.reason}
                    </div>
                    <button
                      onClick={() => setSelectedRequestId(request.id)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {t("approvals.viewDetails") || "View Details"}
                    </button>
                  </div>
                  {request.status === "pending" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={isApproving || isRejecting}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {t("approvals.approve") || "Approve"}
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt(t("approvals.rejectionReason") || "Rejection reason (optional):");
                          if (reason !== null) {
                            handleReject(request.id, reason || undefined);
                          }
                        }}
                        disabled={isApproving || isRejecting}
                        className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                      >
                        {t("approvals.reject") || "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Request Details Modal */}
      {selectedRequest && selectedRequestId && (
        <RequestDetailsModal
          request={selectedRequest}
          accounts={accounts}
          onClose={() => setSelectedRequestId(null)}
          onApprove={() => handleApprove(selectedRequestId)}
          onReject={(reason) => handleReject(selectedRequestId, reason)}
          isApproving={isApproving}
          isRejecting={isRejecting}
          setViewerModal={setViewerModal}
          t={t}
        />
      )}

      {/* Image Viewer Modal */}
      {viewerModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[10000] flex items-center justify-center bg-black bg-opacity-75"
          style={{ margin: 0, padding: 0 }}
          onClick={() => setViewerModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewerModal(null)}
              className="absolute top-2 right-2 z-10 bg-white hover:bg-slate-100 rounded-full p-2 shadow-lg transition-colors"
              aria-label={t("common.close")}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={viewerModal.src}
              alt={viewerModal.title}
              className="max-w-full max-h-[95vh] w-auto h-auto mx-auto object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RequestDetailsModal({
  request,
  accounts,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  setViewerModal,
  t,
}: {
  request: any;
  accounts: any[];
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
  setViewerModal: (modal: { isOpen: boolean; src: string; type: 'image' | 'pdf'; title: string } | null) => void;
  t: (key: string) => string;
}) {
  const [rejectionReason, setRejectionReason] = useState("");

  // Handle Esc key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isApproving && !isRejecting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isApproving, isRejecting, onClose]);

  if (request.requestType === "edit" && request.entityType === "order") {
    return (
      <div
        className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              {t("approvals.requestDetails") || "Request Details"}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {/* Reason */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                {t("approvals.reason") || "Reason"}
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
                {request.reason}
              </div>
            </div>

            {/* Comparison View */}
            <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {t("approvals.originalOrder") || "Original Order"}
              </h3>
              {request.entity && (
                <OrderComparisonView 
                  order={request.entity} 
                  accounts={accounts}
                  originalReceipts={Array.isArray(request.entity.originalReceipts) ? request.entity.originalReceipts : []}
                  originalPayments={Array.isArray(request.entity.originalPayments) ? request.entity.originalPayments : []}
                  setViewerModal={setViewerModal}
                />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {t("approvals.amendedOrder") || "Amended Order"}
              </h3>
              {request.requestData && request.entity && (
                <OrderComparisonView 
                  order={{
                    ...request.entity, // Start with original order data (includes customer, currency pair, etc.)
                    ...request.requestData, // Override with amended data (amountBuy, amountSell, rate, profit, service charge, etc.)
                    // Clear account names if account IDs changed or were cleared in the amended data
                    // This ensures the component looks up account names from the new IDs (or shows none if cleared)
                    profitAccountName: ('profitAccountId' in request.requestData && 
                                       request.requestData.profitAccountId !== request.entity.profitAccountId)
                      ? undefined 
                      : request.entity.profitAccountName,
                    serviceChargeAccountName: ('serviceChargeAccountId' in request.requestData && 
                                               request.requestData.serviceChargeAccountId !== request.entity.serviceChargeAccountId)
                      ? undefined 
                      : request.entity.serviceChargeAccountName,
                  }} 
                  accounts={accounts} 
                  isAmended={true}
                  originalOrder={request.entity}
                  amendedReceipts={Array.isArray(request.requestData.receipts) ? request.requestData.receipts : []}
                  amendedPayments={Array.isArray(request.requestData.payments) ? request.requestData.payments : []}
                  originalReceipts={Array.isArray(request.entity.originalReceipts) ? request.entity.originalReceipts : []}
                  originalPayments={Array.isArray(request.entity.originalPayments) ? request.entity.originalPayments : []}
                  setViewerModal={setViewerModal}
                />
              )}
            </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              {t("common.close") || "Close"}
            </button>
            {request.status === "pending" && (
              <>
                <button
                  onClick={() => {
                    const reason = prompt(t("approvals.rejectionReason") || "Rejection reason (optional):");
                    if (reason !== null) {
                      onReject(reason || undefined);
                    }
                  }}
                  disabled={isApproving || isRejecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                >
                  {t("approvals.reject") || "Reject"}
                </button>
                <button
                  onClick={onApprove}
                  disabled={isApproving || isRejecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t("approvals.approve") || "Approve"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // For delete requests or other entity types
  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {t("approvals.requestDetails") || "Request Details"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              {t("approvals.reason") || "Reason"}
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
              {request.reason}
            </div>
          </div>

          {request.entity && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {request.entityType === "order" ? t("approvals.order") || "Order" :
                 request.entityType === "expense" ? t("approvals.expense") || "Expense" :
                 t("approvals.transfer") || "Transfer"} {t("approvals.details") || "Details"}
              </h3>
              {request.entityType === "order" ? (
                <OrderDetailsView order={request.entity} accounts={accounts} t={t} />
              ) : request.entityType === "expense" ? (
                <ExpenseDetailsView expense={request.entity} t={t} />
              ) : (
                <TransferDetailsView transfer={request.entity} t={t} />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            {t("common.close") || "Close"}
          </button>
          {request.status === "pending" && (
            <>
              <button
                onClick={() => {
                  const reason = prompt(t("approvals.rejectionReason") || "Rejection reason (optional):");
                  if (reason !== null) {
                    onReject(reason || undefined);
                  }
                }}
                disabled={isApproving || isRejecting}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {t("approvals.reject") || "Reject"}
              </button>
              <button
                onClick={onApprove}
                disabled={isApproving || isRejecting}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {t("approvals.approve") || "Approve"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderComparisonView({ 
  order, 
  accounts = [], 
  isAmended = false, 
  originalOrder,
  originalReceipts = [],
  originalPayments = [],
  amendedReceipts = [],
  amendedPayments = [],
  setViewerModal,
}: { 
  order: any; 
  accounts?: any[]; 
  isAmended?: boolean; 
  originalOrder?: any;
  originalReceipts?: any[];
  originalPayments?: any[];
  amendedReceipts?: any[];
  amendedPayments?: any[];
  setViewerModal?: (modal: { isOpen: boolean; src: string; type: 'image' | 'pdf'; title: string } | null) => void;
}) {
  const { t } = useTranslation();
  
  // Use receipts/payments based on whether this is the original or amended view
  // Always use stored original data to preserve the state before changes
  const receipts = isAmended ? amendedReceipts : originalReceipts;
  const payments = isAmended ? amendedPayments : originalPayments;
  
  // For comparison, always compare against the stored original, even after approval
  const compareReceipts = isAmended ? originalReceipts : originalReceipts;
  const comparePayments = isAmended ? originalPayments : originalPayments;
  
  // Look up account names from accounts array if not provided in order
  const profitAccountName = order.profitAccountName || 
    (order.profitAccountId && accounts.find((a: any) => a.id === order.profitAccountId)?.name) || 
    null;
  
  const serviceChargeAccountName = order.serviceChargeAccountName || 
    (order.serviceChargeAccountId && accounts.find((a: any) => a.id === order.serviceChargeAccountId)?.name) || 
    null;
  
  // Helper function to get account name
  const getAccountName = (accountId: number | null) => {
    if (!accountId) return null;
    return accounts.find((a: any) => a.id === accountId)?.name || null;
  };
  
  // Helper function to get image URL from receipt/payment
  // Handles both newImagePath (for newly uploaded images) and currentImagePath (for existing images)
  const getImageUrl = (receiptOrPayment: any) => {
    if (!receiptOrPayment) return null;
    
    // For amended receipts/payments, prefer newImagePath if it exists
    const imagePath = receiptOrPayment.newImagePath || receiptOrPayment.currentImagePath || receiptOrPayment.imagePath;
    
    if (!imagePath) return null;
    
    // If it's already a data URL or full URL, return as-is
    if (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('/api/uploads/')) {
      return imagePath;
    }
    
    // Convert relative path to URL (e.g., "orders/order_123_receipt_...jpg" -> "/api/uploads/orders/order_123_receipt_...jpg")
    return `/api/uploads/${imagePath}`;
  };
  
  // Helper function to get file type
  const getFileType = (imagePath: string | null): 'image' | 'pdf' | null => {
    if (!imagePath) return null;
    
    // Check for base64 data URLs
    if (imagePath.startsWith('data:image/')) return 'image';
    if (imagePath.startsWith('data:application/pdf')) return 'pdf';
    
    // Check for server URLs (e.g., /api/uploads/orders/...)
    if (imagePath.startsWith('/api/uploads/')) {
      const lowerPath = imagePath.toLowerCase();
      if (lowerPath.endsWith('.pdf')) return 'pdf';
      if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || 
          lowerPath.endsWith('.png') || lowerPath.endsWith('.gif') || 
          lowerPath.endsWith('.webp')) return 'image';
    }
    
    // Check for relative paths (e.g., "orders/order_123_receipt_...jpg")
    const lowerPath = imagePath.toLowerCase();
    if (lowerPath.endsWith('.pdf')) return 'pdf';
    if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || 
        lowerPath.endsWith('.png') || lowerPath.endsWith('.gif') || 
        lowerPath.endsWith('.webp')) return 'image';
    
    return null;
  };
  
  // Helper function to check if receipts/payments have changed
  // Always compare against the stored original receipts/payments
  const receiptsChanged = isAmended && originalOrder && (
    receipts.length !== compareReceipts.length ||
    receipts.some((r: any, idx: number) => {
      const orig = compareReceipts[idx];
      return !orig || 
        Math.abs((r.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (r.accountId || null) !== (orig.accountId || null) ||
        // Check if image has changed
        r.hasNewImage === true ||
        r.newImagePath ||
        ((r.currentImagePath || r.imagePath) !== (orig.currentImagePath || orig.imagePath));
    }) ||
    compareReceipts.some((orig: any, idx: number) => {
      const r = receipts[idx];
      return !r || 
        Math.abs((r.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (r.accountId || null) !== (orig.accountId || null);
    })
  );
  
  const paymentsChanged = isAmended && originalOrder && (
    payments.length !== comparePayments.length ||
    payments.some((p: any, idx: number) => {
      const orig = comparePayments[idx];
      return !orig || 
        Math.abs((p.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (p.accountId || null) !== (orig.accountId || null) ||
        // Check if image has changed
        p.hasNewImage === true ||
        p.newImagePath ||
        ((p.currentImagePath || p.imagePath) !== (orig.currentImagePath || orig.imagePath));
    }) ||
    comparePayments.some((orig: any, idx: number) => {
      const p = payments[idx];
      return !p || 
        Math.abs((p.amount || 0) - (orig.amount || 0)) > 0.01 || 
        (p.accountId || null) !== (orig.accountId || null);
    })
  );
  
  // Helper function to check if a value has changed and apply styling
  const isChanged = (field: string, currentValue: any) => {
    if (!isAmended || !originalOrder) return false;
    const originalValue = originalOrder[field];
    // Handle null/undefined comparisons
    if (currentValue === null || currentValue === undefined) {
      return originalValue !== null && originalValue !== undefined;
    }
    if (originalValue === null || originalValue === undefined) {
      return true;
    }
    // For numbers, compare with small tolerance
    if (typeof currentValue === 'number' && typeof originalValue === 'number') {
      return Math.abs(currentValue - originalValue) > 0.01;
    }
    return currentValue !== originalValue;
  };
  
  const getValueStyle = (field: string, value: any) => {
    if (isChanged(field, value)) {
      return "bg-red-100 text-red-900 font-bold";
    }
    return "";
  };
  
  // Check if profit has changed
  const profitChanged = isAmended && originalOrder && (
    isChanged("profitAmount", order.profitAmount) ||
    isChanged("profitCurrency", order.profitCurrency) ||
    isChanged("profitAccountId", order.profitAccountId)
  );
  
  // Check if service charge has changed
  const serviceChargeChanged = isAmended && originalOrder && (
    isChanged("serviceChargeAmount", order.serviceChargeAmount) ||
    isChanged("serviceChargeCurrency", order.serviceChargeCurrency) ||
    isChanged("serviceChargeAccountId", order.serviceChargeAccountId)
  );
  
  // Check if amount buy, amount sell, or rate has changed
  const amountBuyChanged = isAmended && originalOrder && isChanged("amountBuy", order.amountBuy);
  const amountSellChanged = isAmended && originalOrder && isChanged("amountSell", order.amountSell);
  const rateChanged = isAmended && originalOrder && isChanged("rate", order.rate);
  
  return (
    <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-3">
      <div><strong>{t("orders.customer") || "Customer"}:</strong> {order.customerName || order.customerId || "-"}</div>
      <div><strong>{t("orders.currencyPair") || "Currency Pair"}:</strong> {order.fromCurrency || ""} / {order.toCurrency || ""}</div>
      <div className="flex items-center justify-between">
        <div>
          <strong>{t("orders.amountBuy") || "Amount Buy"}:</strong>{" "}
          <span className={getValueStyle("amountBuy", order.amountBuy)}>
            {order.amountBuy}
          </span>
        </div>
        {amountBuyChanged && (
          <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
            {t("approvals.changed") || "CHANGED"}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <strong>{t("orders.amountSell") || "Amount Sell"}:</strong>{" "}
          <span className={getValueStyle("amountSell", order.amountSell)}>
            {order.amountSell}
          </span>
        </div>
        {amountSellChanged && (
          <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
            {t("approvals.changed") || "CHANGED"}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <strong>{t("orders.rate") || "Rate"}:</strong>{" "}
          <span className={getValueStyle("rate", order.rate)}>
            {order.rate}
          </span>
        </div>
        {rateChanged && (
          <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
            {t("approvals.changed") || "CHANGED"}
          </span>
        )}
      </div>
      
      {/* Receipts Section */}
      <div className={`border-t pt-2 ${receiptsChanged ? "border-red-300" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <strong>{t("orders.receipts") || "Receipts"}:</strong>
          {receiptsChanged && (
            <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
              {t("approvals.changed") || "CHANGED"}
            </span>
          )}
        </div>
        {receipts.length > 0 ? (
          <div className="space-y-3 ml-4">
            {receipts.map((receipt: any, idx: number) => {
              const accountName = getAccountName(receipt.accountId) || receipt.accountName;
              const imageUrl = getImageUrl(receipt);
              const fileType = getFileType(imageUrl || receipt.newImagePath || receipt.currentImagePath || receipt.imagePath);
              
              // Check if this receipt has an exact match in the original receipts
              // This handles splits, merges, and modifications properly
              const hasExactMatch = isAmended && compareReceipts.some((orig: any) => 
                Math.abs((receipt.amount || 0) - (orig.amount || 0)) < 0.01 &&
                (receipt.accountId || null) === (orig.accountId || null)
              );
              
              // Check if the image has changed (new image uploaded or hasNewImage flag set)
              const hasImageChanged = isAmended && (
                receipt.hasNewImage === true || 
                receipt.newImagePath ||
                (compareReceipts[idx] && (
                  (receipt.currentImagePath || receipt.imagePath) !== (compareReceipts[idx].currentImagePath || compareReceipts[idx].imagePath)
                ))
              );
              
              // Highlight if it's amended and (doesn't have an exact match OR has a new image)
              const isReceiptChanged = isAmended && (!hasExactMatch || hasImageChanged);
              
              return (
                <div key={idx} className={`${isReceiptChanged ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"} rounded-lg p-2`}>
                  <div className="flex gap-3">
                    {/* Image Display */}
                    {imageUrl && fileType === 'image' ? (
                      <div className="relative w-24 h-32 flex-shrink-0">
                        <img
                          src={imageUrl}
                          alt="Receipt"
                          className="w-full h-full object-cover rounded border border-slate-300 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setViewerModal?.({ isOpen: true, src: imageUrl, type: 'image', title: t("orders.receiptUploads") || "Receipt" })}
                          onError={(e) => {
                            // Hide broken image
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {hasImageChanged && (
                          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[9px] font-bold text-center py-0.5 rounded-t">
                            NEW IMAGE
                          </div>
                        )}
                      </div>
                    ) : imageUrl && fileType === 'pdf' ? (
                      <div className="relative w-24 h-32 flex-shrink-0">
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 border-2 border-slate-300 rounded cursor-pointer hover:bg-slate-200 transition-colors">
                          <svg className="w-6 h-6 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-slate-600">PDF</p>
                        </div>
                        {hasImageChanged && (
                          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[9px] font-bold text-center py-0.5 rounded-t">
                            NEW IMAGE
                          </div>
                        )}
                      </div>
                    ) : null}
                    
                    {/* Receipt Details */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${isReceiptChanged ? "text-red-900 font-bold" : "text-slate-700"}`}>
                        <div className="font-medium mb-1">
                          {t("orders.amount") || "Amount"}: {receipt.amount || 0} {order.fromCurrency}
                        </div>
                        {accountName && (
                          <div className="text-slate-600">
                            {t("orders.account") || "Account"}: {accountName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 ml-4 italic">{t("orders.noReceipts") || "No receipts"}</div>
        )}
      </div>
      
      {/* Payments Section */}
      <div className={`border-t pt-2 ${paymentsChanged ? "border-red-300" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <strong>{t("orders.payments") || "Payments"}:</strong>
          {paymentsChanged && (
            <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
              {t("approvals.changed") || "CHANGED"}
            </span>
          )}
        </div>
        {payments.length > 0 ? (
          <div className="space-y-3 ml-4">
            {payments.map((payment: any, idx: number) => {
              const accountName = getAccountName(payment.accountId) || payment.accountName;
              const imageUrl = getImageUrl(payment);
              const fileType = getFileType(imageUrl || payment.newImagePath || payment.currentImagePath || payment.imagePath);
              
              // Check if this payment has an exact match in the original payments
              // This handles splits, merges, and modifications properly
              const hasExactMatch = isAmended && comparePayments.some((orig: any) => 
                Math.abs((payment.amount || 0) - (orig.amount || 0)) < 0.01 &&
                (payment.accountId || null) === (orig.accountId || null)
              );
              
              // Check if the image has changed (new image uploaded or hasNewImage flag set)
              const hasImageChanged = isAmended && (
                payment.hasNewImage === true || 
                payment.newImagePath ||
                (comparePayments[idx] && (
                  (payment.currentImagePath || payment.imagePath) !== (comparePayments[idx].currentImagePath || comparePayments[idx].imagePath)
                ))
              );
              
              // Highlight if it's amended and (doesn't have an exact match OR has a new image)
              const isPaymentChanged = isAmended && (!hasExactMatch || hasImageChanged);
              
              return (
                <div key={idx} className={`${isPaymentChanged ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"} rounded-lg p-2`}>
                  <div className="flex gap-3">
                    {/* Image Display */}
                    {imageUrl && fileType === 'image' ? (
                      <div className="relative w-24 h-32 flex-shrink-0">
                        <img
                          src={imageUrl}
                          alt="Payment"
                          className="w-full h-full object-cover rounded border border-slate-300 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setViewerModal?.({ isOpen: true, src: imageUrl, type: 'image', title: t("orders.paymentUploads") || "Payment" })}
                          onError={(e) => {
                            // Hide broken image
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {hasImageChanged && (
                          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[9px] font-bold text-center py-0.5 rounded-t">
                            NEW IMAGE
                          </div>
                        )}
                      </div>
                    ) : imageUrl && fileType === 'pdf' ? (
                      <div className="relative w-24 h-32 flex-shrink-0">
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 border-2 border-slate-300 rounded cursor-pointer hover:bg-slate-200 transition-colors">
                          <svg className="w-6 h-6 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-slate-600">PDF</p>
                        </div>
                        {hasImageChanged && (
                          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[9px] font-bold text-center py-0.5 rounded-t">
                            NEW IMAGE
                          </div>
                        )}
                      </div>
                    ) : null}
                    
                    {/* Payment Details */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${isPaymentChanged ? "text-red-900 font-bold" : "text-slate-700"}`}>
                        <div className="font-medium mb-1">
                          {t("orders.amount") || "Amount"}: {payment.amount || 0} {order.toCurrency}
                        </div>
                        {accountName && (
                          <div className="text-slate-600">
                            {t("orders.account") || "Account"}: {accountName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 ml-4 italic">{t("orders.noPayments") || "No payments"}</div>
        )}
      </div>
      
      {/* Profit Amount Section */}
      {(order.profitAmount !== null && order.profitAmount !== undefined) && (
        <div className={`border-t pt-2 ${profitChanged ? "border-red-300" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <strong>{t("orders.profitAmount") || "Profit Amount"}:</strong>
            {profitChanged && (
              <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
                {t("approvals.changed") || "CHANGED"}
              </span>
            )}
          </div>
          <div className={`text-xs ml-4 ${profitChanged ? "bg-red-100 text-red-900 font-bold px-2 py-1 rounded" : ""}`}>
            {order.profitAmount} {order.profitCurrency || ""}
            {profitAccountName ? (
              <span className="text-slate-500 ml-1">({profitAccountName})</span>
            ) : order.profitAccountId ? (
              <span className="text-slate-500 ml-1">({t("orders.account") || "Account"} #{order.profitAccountId})</span>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Service Charge Amount Section */}
      {(order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined) && (
        <div className={`border-t pt-2 ${serviceChargeChanged ? "border-red-300" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <strong>{t("orders.serviceChargeAmount") || "Service Charge Amount"}:</strong>
            {serviceChargeChanged && (
              <span className="text-xs bg-red-100 text-red-900 px-2 py-1 rounded font-bold">
                {t("approvals.changed") || "CHANGED"}
              </span>
            )}
          </div>
          <div className={`text-xs ml-4 ${serviceChargeChanged ? "bg-red-100 text-red-900 font-bold px-2 py-1 rounded" : ""}`}>
            {order.serviceChargeAmount} {order.serviceChargeCurrency || ""}
            {serviceChargeAccountName ? (
              <span className="text-slate-500 ml-1">({serviceChargeAccountName})</span>
            ) : order.serviceChargeAccountId ? (
              <span className="text-slate-500 ml-1">({t("orders.account") || "Account"} #{order.serviceChargeAccountId})</span>
            ) : null}
          </div>
        </div>
      )}
      {order.remarks && (
        <div>
          <strong>{t("orders.remarks") || "Remarks"}:</strong>{" "}
          <span className={getValueStyle("remarks", order.remarks)}>
            {order.remarks}
          </span>
        </div>
      )}
    </div>
  );
}

function OrderDetailsView({ order, accounts, t }: { order: any; accounts?: any[]; t: (key: string) => string }) {
  // Helper to get account name
  const getAccountName = (accountId: number | null | undefined) => {
    if (!accountId) return null;
    if (accounts) {
      return accounts.find((a) => a.id === accountId)?.name || null;
    }
    return null;
  };

  // Get receipts and payments - check both originalReceipts/originalPayments and receipts/payments
  const receipts = order.originalReceipts || order.receipts || [];
  const payments = order.originalPayments || order.payments || [];
  
  // Get profits and service charges - check both arrays and order-level fields
  const profits = order.profits || [];
  const serviceCharges = order.serviceCharges || [];

  return (
    <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold text-slate-700">{t("orders.orderId") || "Order ID"}:</span>
          <span className="ml-2 text-slate-900">#{order.id}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">{t("orders.status") || "Status"}:</span>
          <span className="ml-2 text-slate-900 capitalize">{order.status}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">{t("orders.customer") || "Customer"}:</span>
          <span className="ml-2 text-slate-900">{order.customerName || `Customer #${order.customerId}`}</span>
        </div>
        {order.handlerName && (
          <div>
            <span className="font-semibold text-slate-700">{t("orders.handler") || "Handler"}:</span>
            <span className="ml-2 text-slate-900">{order.handlerName}</span>
          </div>
        )}
        <div>
          <span className="font-semibold text-slate-700">{t("orders.currencyPair") || "Currency Pair"}:</span>
          <span className="ml-2 text-slate-900">{order.fromCurrency} / {order.toCurrency}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">{t("orders.rate") || "Rate"}:</span>
          <span className="ml-2 text-slate-900">{order.rate}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">{t("orders.amountBuy") || "Amount Buy"}:</span>
          <span className="ml-2 text-slate-900">{order.amountBuy?.toFixed(2) || order.amountBuy} {order.fromCurrency}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">{t("orders.amountSell") || "Amount Sell"}:</span>
          <span className="ml-2 text-slate-900">{order.amountSell?.toFixed(2) || order.amountSell} {order.toCurrency}</span>
        </div>
        {order.buyAccountName && (
          <div>
            <span className="font-semibold text-slate-700">{t("orders.buyAccount") || "Buy Account"}:</span>
            <span className="ml-2 text-slate-900">{order.buyAccountName}</span>
          </div>
        )}
        {order.sellAccountName && (
          <div>
            <span className="font-semibold text-slate-700">{t("orders.sellAccount") || "Sell Account"}:</span>
            <span className="ml-2 text-slate-900">{order.sellAccountName}</span>
          </div>
        )}
        {order.createdAt && (
          <div>
            <span className="font-semibold text-slate-700">{t("common.created") || "Created"}:</span>
            <span className="ml-2 text-slate-900">{new Date(order.createdAt).toLocaleString()}</span>
          </div>
        )}
        {order.orderType && (
          <div>
            <span className="font-semibold text-slate-700">{t("orders.orderType") || "Order Type"}:</span>
            <span className="ml-2 text-slate-900 capitalize">{order.orderType}</span>
          </div>
        )}
      </div>

      {/* Receipts and Payments Section - 2 columns */}
      {(receipts.length > 0 || payments.length > 0) && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            {/* Receipts Column */}
            {receipts.length > 0 && (
              <div>
                <span className="font-semibold text-slate-700 block mb-2">{t("orders.receipts") || "Receipts"}:</span>
                <div className="space-y-1">
                  {receipts.map((receipt: any, idx: number) => {
                    const accountName = receipt.accountName || getAccountName(receipt.accountId) || `Account #${receipt.accountId || 'N/A'}`;
                    return (
                      <div key={idx} className="text-sm text-slate-900">
                        • {receipt.amount?.toFixed(2) || receipt.amount} {order.fromCurrency} - {accountName}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Payments Column */}
            {payments.length > 0 && (
              <div>
                <span className="font-semibold text-slate-700 block mb-2">{t("orders.payments") || "Payments"}:</span>
                <div className="space-y-1">
                  {payments.map((payment: any, idx: number) => {
                    const accountName = payment.accountName || getAccountName(payment.accountId) || `Account #${payment.accountId || 'N/A'}`;
                    return (
                      <div key={idx} className="text-sm text-slate-900">
                        • {payment.amount?.toFixed(2) || payment.amount} {order.toCurrency} - {accountName}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profits and Service Charges Section - 2 columns */}
      {((profits.length > 0 || (order.profitAmount !== null && order.profitAmount !== undefined)) || 
        (serviceCharges.length > 0 || (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined))) && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            {/* Profit Column */}
            {(profits.length > 0 || (order.profitAmount !== null && order.profitAmount !== undefined)) && (
              <div>
                <span className="font-semibold text-slate-700 block mb-2">{t("orders.profit") || "Profit"}:</span>
                {profits.length > 0 ? (
                  <div className="space-y-1">
                    {profits.map((profit: any, idx: number) => {
                      const accountName = profit.accountName || getAccountName(profit.accountId) || `Account #${profit.accountId || 'N/A'}`;
                      return (
                        <div key={idx} className="text-sm text-slate-900">
                          • {profit.amount?.toFixed(2) || profit.amount} {profit.currencyCode || order.profitCurrency} - {accountName}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-900">
                    {order.profitAmount?.toFixed(2) || order.profitAmount} {order.profitCurrency || ""}
                    {order.profitAccountName ? (
                      <span className="text-slate-500 ml-1">({order.profitAccountName})</span>
                    ) : order.profitAccountId ? (
                      <span className="text-slate-500 ml-1">({getAccountName(order.profitAccountId) || `Account #${order.profitAccountId}`})</span>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Service Charges Column */}
            {(serviceCharges.length > 0 || (order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined)) && (
              <div>
                <span className="font-semibold text-slate-700 block mb-2">{t("orders.serviceCharges") || "Service Charges"}:</span>
                {serviceCharges.length > 0 ? (
                  <div className="space-y-1">
                    {serviceCharges.map((serviceCharge: any, idx: number) => {
                      const accountName = serviceCharge.accountName || getAccountName(serviceCharge.accountId) || `Account #${serviceCharge.accountId || 'N/A'}`;
                      return (
                        <div key={idx} className="text-sm text-slate-900">
                          • {serviceCharge.amount?.toFixed(2) || serviceCharge.amount} {serviceCharge.currencyCode || order.serviceChargeCurrency} - {accountName}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-900">
                    {order.serviceChargeAmount?.toFixed(2) || order.serviceChargeAmount} {order.serviceChargeCurrency || ""}
                    {order.serviceChargeAccountName ? (
                      <span className="text-slate-500 ml-1">({order.serviceChargeAccountName})</span>
                    ) : order.serviceChargeAccountId ? (
                      <span className="text-slate-500 ml-1">({getAccountName(order.serviceChargeAccountId) || `Account #${order.serviceChargeAccountId}`})</span>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {order.remarks && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <span className="font-semibold text-slate-700 block mb-2">{t("orders.remarks") || "Remarks"}:</span>
          <p className="text-slate-900 whitespace-pre-wrap">{order.remarks}</p>
        </div>
      )}
    </div>
  );
}

function ExpenseDetailsView({ expense, t }: { expense: any; t: (key: string) => string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold text-slate-700">Expense ID:</span>
          <span className="ml-2 text-slate-900">#{expense.id}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">Amount:</span>
          <span className="ml-2 text-slate-900">{expense.amount} {expense.currencyCode}</span>
        </div>
      </div>
    </div>
  );
}

function TransferDetailsView({ transfer, t }: { transfer: any; t: (key: string) => string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold text-slate-700">Transfer ID:</span>
          <span className="ml-2 text-slate-900">#{transfer.id}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">Amount:</span>
          <span className="ml-2 text-slate-900">{transfer.amount} {transfer.currencyCode}</span>
        </div>
      </div>
    </div>
  );
}
