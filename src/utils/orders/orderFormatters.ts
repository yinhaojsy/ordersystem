import type { OrderStatus } from "../../types";

/**
 * Get the tone/badge color for an order status
 */
export function getStatusTone(status: OrderStatus): "amber" | "blue" | "emerald" | "rose" | "slate" | "orange" {
  switch (status) {
    case "pending":
      return "amber";
    case "under_process":
      return "blue";
    case "completed":
      return "emerald";
    case "cancelled":
      return "rose";
    case "pending_amend":
    case "pending_delete":
      return "orange";
    default:
      return "slate";
  }
}

