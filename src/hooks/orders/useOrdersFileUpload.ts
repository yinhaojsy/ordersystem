import { useEffect, useCallback, type FormEvent } from "react";

interface UseOrdersFileUploadParams {
  // State from useViewOrderModal
  viewModalOrderId: number | null;
  makePaymentModalOrderId: number | null;
  receiptUploads: Array<{ image: string; amount: string; accountId: string; file?: File }>;
  setReceiptUploads: React.Dispatch<React.SetStateAction<Array<{ image: string; amount: string; accountId: string; file?: File }>>>;
  paymentUploads: Array<{ image: string; amount: string; accountId: string; file?: File }>;
  setPaymentUploads: React.Dispatch<React.SetStateAction<Array<{ image: string; amount: string; accountId: string; file?: File }>>>;
  receiptUploadKey: number;
  setReceiptUploadKey: React.Dispatch<React.SetStateAction<number>>;
  paymentUploadKey: number;
  setPaymentUploadKey: React.Dispatch<React.SetStateAction<number>>;
  showReceiptUpload: boolean;
  setShowReceiptUpload: React.Dispatch<React.SetStateAction<boolean>>;
  showPaymentUpload: boolean;
  setShowPaymentUpload: React.Dispatch<React.SetStateAction<boolean>>;
  receiptDragOver: boolean;
  setReceiptDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  paymentDragOver: boolean;
  setPaymentDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  activeUploadType: "receipt" | "payment" | null;
  setActiveUploadType: React.Dispatch<React.SetStateAction<"receipt" | "payment" | null>>;
  receiptFileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  paymentFileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  
  // Order details
  orderDetails: any;
  
  // Mutations
  addReceipt: any;
  addPayment: any;
  
  // Modal state setters
  setExcessReceiptModalData: (data: any) => void;
  setShowExcessReceiptModal: (show: boolean) => void;
  setExcessPaymentModalNormalData: (data: any) => void;
  setShowExcessPaymentModalNormal: (show: boolean) => void;
  setExcessPaymentWarning: (warning: any) => void;
  
  // Translation
  t: (key: string) => string;
}

export function useOrdersFileUpload({
  viewModalOrderId,
  makePaymentModalOrderId,
  receiptUploads,
  setReceiptUploads,
  paymentUploads,
  setPaymentUploads,
  receiptUploadKey,
  setReceiptUploadKey,
  paymentUploadKey,
  setPaymentUploadKey,
  showReceiptUpload,
  setShowReceiptUpload,
  showPaymentUpload,
  setShowPaymentUpload,
  receiptDragOver,
  setReceiptDragOver,
  paymentDragOver,
  setPaymentDragOver,
  activeUploadType,
  setActiveUploadType,
  receiptFileInputRefs,
  paymentFileInputRefs,
  orderDetails,
  addReceipt,
  addPayment,
  setExcessReceiptModalData,
  setShowExcessReceiptModal,
  setExcessPaymentModalNormalData,
  setShowExcessPaymentModalNormal,
  setExcessPaymentWarning,
  t,
}: UseOrdersFileUploadParams) {
  const handleImageUpload = useCallback((file: File, index: number, type: "receipt" | "payment") => {
    // Check if file is an image or PDF
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    
    if (!isImage && !isPDF) {
      alert(t("orders.pleaseUploadImageOrPdf"));
      return;
    }
    
    // Store the File object immediately
    if (type === "receipt") {
      setReceiptUploads((prev) => {
        const newUploads = [...prev];
        newUploads[index] = { ...newUploads[index], file };
        return newUploads;
      });
    } else {
      setPaymentUploads((prev) => {
        const newUploads = [...prev];
        newUploads[index] = { ...newUploads[index], file };
        return newUploads;
      });
    }
    
    // Convert to base64 for preview (keep existing behavior)
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "receipt") {
        setReceiptUploads((prev) => {
          const newUploads = [...prev];
          newUploads[index] = { ...newUploads[index], image: base64 };
          return newUploads;
        });
      } else {
        setPaymentUploads((prev) => {
          const newUploads = [...prev];
          newUploads[index] = { ...newUploads[index], image: base64 };
          return newUploads;
        });
      }
    };
    reader.readAsDataURL(file);
  }, [t, setReceiptUploads, setPaymentUploads]);

  const handleDrop = useCallback((e: React.DragEvent, index: number, type: "receipt" | "payment") => {
    e.preventDefault();
    if (type === "receipt") {
      setReceiptDragOver(false);
    } else {
      setPaymentDragOver(false);
    }

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
    if (validFiles.length > 0) {
      handleImageUpload(validFiles[0], index, type);
    }
  }, [handleImageUpload, setReceiptDragOver, setPaymentDragOver]);

  const handleDragOver = useCallback((e: React.DragEvent, type: "receipt" | "payment") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "receipt") {
      setReceiptDragOver(true);
    } else {
      setPaymentDragOver(true);
    }
  }, [setReceiptDragOver, setPaymentDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent, type: "receipt" | "payment") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "receipt") {
      setReceiptDragOver(false);
    } else {
      setPaymentDragOver(false);
    }
  }, [setReceiptDragOver, setPaymentDragOver]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, index: number, type: "receipt" | "payment") => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file, index, type);
    }
  }, [handleImageUpload]);

  const getFileType = useCallback((imagePath: string): 'image' | 'pdf' | null => {
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
    
    return null;
  }, []);

  const handleAddReceipt = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!viewModalOrderId || !orderDetails) return;

    // Validate that all uploads with image and amount also have accountId
    for (const upload of receiptUploads) {
      if (upload.image && upload.amount) {
        if (!upload.accountId || upload.accountId === "") {
          alert(t("orders.accountSelectionRequired"));
          return;
        }
      }
    }

    // For normal orders (not flex orders), validate that total receipts don't exceed order amount
    const currentOrder = orderDetails.order;
    if (!currentOrder.isFlexOrder) {
      // Calculate total amount of new receipts being uploaded
      let newReceiptTotal = 0;
      for (const upload of receiptUploads) {
        if (upload.image && upload.amount && upload.accountId) {
          newReceiptTotal += Number(upload.amount);
        }
      }

      // Get existing total receipt amount (not balance - balance is the remaining amount)
      const existingReceiptTotal = orderDetails.totalReceiptAmount || 0;
      
      // Calculate total receipts (existing + new)
      const totalReceipts = existingReceiptTotal + newReceiptTotal;
      
      // Only block if total exceeds order amount (allow partial uploads)
      if (totalReceipts > currentOrder.amountBuy) {
        // Excess is the amount by which the total receipts (existing + new) exceed the order amount
        const excess = totalReceipts - currentOrder.amountBuy;
        setExcessReceiptModalData({
          expectedReceipt: currentOrder.amountBuy,
          attemptedReceipt: totalReceipts, // Show total (existing + new) in the modal
          excess: excess,
          fromCurrency: currentOrder.fromCurrency,
        });
        setShowExcessReceiptModal(true);
        return; // Prevent submission
      }
    }

    // Process all valid uploads
    for (const upload of receiptUploads) {
      if (upload.image && upload.amount && upload.accountId) {
        const payload: any = {
          id: viewModalOrderId,
          amount: Number(upload.amount),
          accountId: Number(upload.accountId),
        };
        
        // Send File object if available, otherwise fallback to base64 (backward compatibility)
        if (upload.file) {
          payload.file = upload.file;
        } else {
          payload.imagePath = upload.image;
        }
        
        await addReceipt(payload).unwrap();
      }
    }

    // Reset file inputs
    Object.values(receiptFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    // Clear uploads and hide the upload section
    setReceiptUploads([]);
    setReceiptUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    setShowReceiptUpload(false); // Hide the upload section after successful upload
  }, [
    viewModalOrderId,
    orderDetails,
    receiptUploads,
    t,
    setExcessReceiptModalData,
    setShowExcessReceiptModal,
    addReceipt,
    receiptFileInputRefs,
    setReceiptUploads,
    setReceiptUploadKey,
    setShowReceiptUpload,
  ]);

  const handleAddPayment = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!viewModalOrderId || !orderDetails) return;

    // Validate that all uploads have required fields
    for (const upload of paymentUploads) {
      if (upload.image && upload.amount) {
        if (!upload.accountId) {
          alert(t("orders.accountSelectionRequired"));
          return;
        }
      }
    }

    const currentOrder = orderDetails.order;
    const isFlex = currentOrder?.isFlexOrder;

    // For normal orders (not flex orders), validate that total payments don't exceed order amount
    if (!isFlex) {
      // Calculate total amount of new payments being uploaded
      let newPaymentTotal = 0;
      for (const upload of paymentUploads) {
        if (upload.image && upload.amount && upload.accountId) {
          newPaymentTotal += Number(upload.amount);
        }
      }

      // Get existing total payment amount (not balance - balance is the remaining amount)
      const existingPaymentTotal = orderDetails.totalPaymentAmount || 0;
      
      // Calculate total payments (existing + new)
      const totalPayments = existingPaymentTotal + newPaymentTotal;
      
      // Only block if total exceeds order amount (allow partial uploads)
      if (totalPayments > currentOrder.amountSell) {
        // Excess is the amount by which the total payments (existing + new) exceed the order amount
        const excess = totalPayments - currentOrder.amountSell;
        setExcessPaymentModalNormalData({
          expectedPayment: currentOrder.amountSell,
          attemptedPayment: totalPayments, // Show total (existing + new) in the modal
          excess: excess,
          toCurrency: currentOrder.toCurrency,
        });
        setShowExcessPaymentModalNormal(true);
        return; // Prevent submission
      }
    }

    // Note: Exchange rate should be updated using the "Update Exchange Rate" button
    // We don't auto-update it during payment upload to give user control

    for (const upload of paymentUploads) {
      if (upload.image && upload.amount) {
        const payload: any = {
          id: viewModalOrderId,
          amount: Number(upload.amount),
          accountId: Number(upload.accountId),
        };
        
        // Send File object if available, otherwise fallback to base64 (backward compatibility)
        if (upload.file) {
          payload.file = upload.file;
        } else {
          payload.imagePath = upload.image;
        }
        
        try {
          const result = await addPayment(payload).unwrap();
          
          // Check for excess payment warning in flex orders
          if (isFlex && (result as any).flexOrderExcess) {
            setExcessPaymentWarning({
              excessAmount: (result as any).flexOrderExcess.excessAmount,
              additionalReceiptsNeeded: (result as any).flexOrderExcess.additionalReceiptsNeeded,
            });
          }
        } catch (error) {
          console.error("Error adding payment:", error);
        }
      }
    }

    // Reset file inputs
    Object.values(paymentFileInputRefs.current).forEach((ref) => {
      if (ref) {
        ref.value = "";
      }
    });

    // Clear uploads and hide the upload section
    setPaymentUploads([]);
    setPaymentUploadKey((prev) => prev + 1); // Force React to recreate file inputs
    setShowPaymentUpload(false); // Hide the upload section after successful upload
  }, [
    viewModalOrderId,
    orderDetails,
    paymentUploads,
    t,
    setExcessPaymentModalNormalData,
    setShowExcessPaymentModalNormal,
    addPayment,
    setExcessPaymentWarning,
    paymentFileInputRefs,
    setPaymentUploads,
    setPaymentUploadKey,
    setShowPaymentUpload,
  ]);

  // Handle paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste when modal is open
      if (!viewModalOrderId && !makePaymentModalOrderId) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Determine which upload type is active based on which modal is open
            const uploadType = activeUploadType || (viewModalOrderId ? "receipt" : "payment");
            
            if (uploadType === "receipt") {
              setReceiptUploads((prev) => {
                const emptyIndex = prev.findIndex(u => !u.image);
                const targetIndex = emptyIndex !== -1 ? emptyIndex : prev.length;
                const updated = [...prev];
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  updated.push({ image: "", amount: "", accountId: "" });
                }
                
                // Store File object
                if (!updated[targetIndex]) {
                  updated[targetIndex] = { image: "", amount: "", accountId: "" };
                }
                updated[targetIndex] = { ...updated[targetIndex], file };
                
                // Convert to base64 for preview
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = reader.result as string;
                  setReceiptUploads((current) => {
                    const finalUpdated = [...current];
                    if (!finalUpdated[targetIndex]) {
                      finalUpdated[targetIndex] = { image: "", amount: "", accountId: "" };
                    }
                    finalUpdated[targetIndex] = { ...finalUpdated[targetIndex], image: base64 };
                    return finalUpdated;
                  });
                };
                reader.readAsDataURL(file);
                
                return updated;
              });
            } else {
              setPaymentUploads((prev) => {
                const emptyIndex = prev.findIndex(u => !u.image);
                const targetIndex = emptyIndex !== -1 ? emptyIndex : prev.length;
                
                // Store File object and process for preview
                setPaymentUploads((current) => {
                  const updated = [...current];
                  if (!updated[targetIndex]) {
                    updated[targetIndex] = { image: "", amount: "", accountId: "" };
                  }
                  const existing = updated[targetIndex];
                  updated[targetIndex] = { ...existing, file };
                  return updated;
                });
                
                // Convert to base64 for preview
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = reader.result as string;
                  setPaymentUploads((current) => {
                    const updated = [...current];
                    if (!updated[targetIndex]) {
                      updated[targetIndex] = { image: "", amount: "", accountId: "" };
                    }
                    const existing = updated[targetIndex];
                    updated[targetIndex] = { image: base64, amount: existing.amount, accountId: existing.accountId, file: existing.file };
                    return updated;
                  });
                };
                reader.readAsDataURL(file);
                
                // If no empty slot, add a new one
                if (emptyIndex === -1) {
                  return [...prev, { image: "", amount: "", accountId: "" }];
                }
                return prev;
              });
            }
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [viewModalOrderId, makePaymentModalOrderId, activeUploadType, setReceiptUploads, setPaymentUploads]);

  return {
    handleAddReceipt,
    handleAddPayment,
    handleImageUpload,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileChange,
    getFileType,
  };
}

