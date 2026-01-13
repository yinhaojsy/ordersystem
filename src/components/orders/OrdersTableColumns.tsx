import React from "react";
import Badge from "../common/Badge";
import { AccountTooltip } from "./AccountTooltip";
import type { Order } from "../../types";
import type { OrderStatus } from "../../types";
import { formatDate } from "../../utils/format";
import type { Account } from "../../types";

interface OrdersTableColumnsProps {
  columnKey: string;
  order: Order;
  accounts: Account[];
  getStatusTone: (status: OrderStatus) => "amber" | "blue" | "emerald" | "rose" | "slate" | "orange";
  t: (key: string) => string;
}

/**
 * Renders cell content for a specific column in the orders table
 */
export function renderOrderCell({
  columnKey,
  order,
  accounts,
  getStatusTone,
  t,
}: OrdersTableColumnsProps): React.ReactElement | null {
  switch (columnKey) {
    case "id":
      return <td key={columnKey} className="py-2 font-mono text-slate-600">#{order.id}</td>;
    case "date":
      return <td key={columnKey} className="py-2">{formatDate(order.createdAt)}</td>;
    case "handler":
      return (
        <td key={columnKey} className="py-2">
          {order.handlerName ? (
            order.handlerName
          ) : (
            <span className="text-rose-600">
              {t("orders.noHandlerAssigned")}
            </span>
          )}
        </td>
      );
    case "customer":
      return (
        <td key={columnKey} className="py-2 font-semibold">
          <div className="flex items-center gap-2">
            {order.customerName || order.customerId}
            
{/*         我 FLEX TAGS DISPLAY NEXT TO CUSTOMER NAME    
            {order.isFlexOrder && (
              <Badge tone="purple">
                Flex Order
              </Badge>
            )} */}
            
            {/* 我 TAGS DISPLAY NEXT TO CUSTOMER NAME */} 
            {order.tags && Array.isArray(order.tags) && order.tags.length > 0 &&
              order.tags.map((tag: { id: number; name: string; color: string }) => (
                <Badge key={tag.id} tone="slate" backgroundColor={tag.color} lightStyle={true}>
                  {tag.name}
                </Badge>
              ))}
          </div>
        </td>
      );
    case "pair":
      return (
        <td key={columnKey} className="py-2">
          {order.fromCurrency} → {order.toCurrency}
        </td>
      );
    case "buy":
      return (
        <td key={columnKey} className="py-2">
          {order.isFlexOrder && order.actualAmountBuy ? (
            <span>
              <span className="text-purple-600 font-semibold">{Math.round(order.actualAmountBuy)}</span>
            </span>
          ) : (
            Math.round(order.amountBuy)
          )}
        </td>
      );
    case "sell":
      return (
        <td key={columnKey} className="py-2">
          {order.isFlexOrder && order.actualAmountSell ? (
            <span>
              -<span className="text-purple-600 font-semibold">{Math.round(order.actualAmountSell)}</span>
            </span>
          ) : (
            `-${Math.round(order.amountSell)}`
          )}
        </td>
      );
    case "rate":
      return (
        <td key={columnKey} className="py-2">
          {order.isFlexOrder && order.actualRate ? (
            <span>
              <span className="text-purple-600 font-semibold">{order.actualRate}</span>
            </span>
          ) : (
            order.rate
          )}
        </td>
      );
    case "status":
      return (
        <td key={columnKey} className="py-2">
          <Badge tone={getStatusTone(order.status)}>
            {t(`orders.${order.status}`)}
          </Badge>
        </td>
      );
    case "orderType":
      return (
        <td key={columnKey} className="py-2">
          <Badge tone={order.orderType === "otc" ? "amber" : "blue"}>
            {order.orderType === "otc" ? t("orders.otc") : t("orders.online")}
          </Badge>
        </td>
      );
    case "buyAccount": {
      const fallbackAccountName =
        order.buyAccountName ||
        (order.buyAccountId ? accounts.find((acc) => acc.id === order.buyAccountId)?.name : null) ||
        null;

      // Imported orders may not have receipt aggregates; fall back to the primary account/amount
      const buyAccounts =
        (order.buyAccounts && order.buyAccounts.length > 0)
          ? order.buyAccounts
          : order.buyAccountId
            ? [{
                accountId: order.buyAccountId,
                accountName: fallbackAccountName || `Account #${order.buyAccountId}`,
                amount: order.actualAmountBuy ?? order.amountBuy ?? 0,
              }]
            : [];

      const firstAccount = buyAccounts.length > 0 ? buyAccounts[0] : null;
      const accountName = firstAccount?.accountName || fallbackAccountName || "-";
      
      // Check if profit or service charge should appear in buy account tooltip
      // Buy account is for fromCurrency, so check if profit/service charge currency matches fromCurrency
      const showProfitInBuy = order.profitCurrency === order.fromCurrency && 
                              order.profitAmount !== null && 
                              order.profitAmount !== undefined &&
                              order.profitAccountId;
      const showServiceChargeInBuy = order.serviceChargeCurrency === order.fromCurrency && 
                                     order.serviceChargeAmount !== null && 
                                     order.serviceChargeAmount !== undefined &&
                                     order.serviceChargeAccountId;
      
      const profitAccountName = showProfitInBuy && order.profitAccountId 
        ? accounts.find(acc => acc.id === order.profitAccountId)?.name || null
        : null;
      const serviceChargeAccountName = showServiceChargeInBuy && order.serviceChargeAccountId
        ? accounts.find(acc => acc.id === order.serviceChargeAccountId)?.name || null
        : null;
      
      // Count the number of entries that will be displayed in the tooltip
      // This includes all buy accounts, plus profit and service charges if they are shown
      // Each entry counts as 1, even if they use the same account
      let accountCount = buyAccounts.length;
      if (showProfitInBuy) {
        accountCount++;
      }
      if (showServiceChargeInBuy) {
        accountCount++;
      }
      
      const hasMultiple = accountCount > 1;
      const shouldShowTooltip = hasMultiple || showProfitInBuy || showServiceChargeInBuy;
      // Show badge when there are multiple entries (accounts, profit, or service charges)
      const showBadge = accountCount > 1;
      
      return (
        <td key={columnKey} className="py-2 text-slate-600">
          {shouldShowTooltip ? (
            <AccountTooltip 
              accounts={buyAccounts} 
              label={t("orders.buyAccount")}
              profitAmount={showProfitInBuy ? order.profitAmount : null}
              profitCurrency={showProfitInBuy ? order.profitCurrency : null}
              profitAccountName={profitAccountName}
              serviceChargeAmount={showServiceChargeInBuy ? order.serviceChargeAmount : null}
              serviceChargeCurrency={showServiceChargeInBuy ? order.serviceChargeCurrency : null}
              serviceChargeAccountName={serviceChargeAccountName}
              accountCount={accountCount}
            >
              <div className="flex items-center gap-2 cursor-pointer">
                <span>{accountName}</span>
                {showBadge && (
                  <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                    {accountCount}
                  </span>
                )}
              </div>
            </AccountTooltip>
          ) : (
            <span>{accountName}</span>
          )}
        </td>
      );
    }
    case "sellAccount": {
      const fallbackAccountName =
        order.sellAccountName ||
        (order.sellAccountId ? accounts.find((acc) => acc.id === order.sellAccountId)?.name : null) ||
        null;

      // Imported orders may not have payment aggregates; fall back to the primary account/amount
      const sellAccounts =
        (order.sellAccounts && order.sellAccounts.length > 0)
          ? order.sellAccounts
          : order.sellAccountId
            ? [{
                accountId: order.sellAccountId,
                accountName: fallbackAccountName || `Account #${order.sellAccountId}`,
                amount: order.actualAmountSell ?? order.amountSell ?? 0,
              }]
            : [];

      const firstAccount = sellAccounts.length > 0 ? sellAccounts[0] : null;
      const accountName = firstAccount?.accountName || fallbackAccountName || "-";
      
      // Check if profit or service charge should appear in sell account tooltip
      // Sell account is for toCurrency, so check if profit/service charge currency matches toCurrency
      const showProfitInSell = order.profitCurrency === order.toCurrency && 
                               order.profitAmount !== null && 
                               order.profitAmount !== undefined &&
                               order.profitAccountId;
      const showServiceChargeInSell = order.serviceChargeCurrency === order.toCurrency && 
                                      order.serviceChargeAmount !== null && 
                                      order.serviceChargeAmount !== undefined &&
                                      order.serviceChargeAccountId;
      
      const profitAccountName = showProfitInSell && order.profitAccountId 
        ? accounts.find(acc => acc.id === order.profitAccountId)?.name || null
        : null;
      const serviceChargeAccountName = showServiceChargeInSell && order.serviceChargeAccountId
        ? accounts.find(acc => acc.id === order.serviceChargeAccountId)?.name || null
        : null;
      
      // Count the number of entries that will be displayed in the tooltip
      // This includes all sell accounts, plus profit and service charges if they are shown
      // Each entry counts as 1, even if they use the same account
      let accountCount = sellAccounts.length;
      if (showProfitInSell) {
        accountCount++;
      }
      if (showServiceChargeInSell) {
        accountCount++;
      }
      
      const hasMultiple = accountCount > 1;
      const shouldShowTooltip = hasMultiple || showProfitInSell || showServiceChargeInSell;
      // Show badge when there are multiple entries (accounts, profit, or service charges)
      const showBadge = accountCount > 1;
      
      return (
        <td key={columnKey} className="py-2 text-slate-600">
          {shouldShowTooltip ? (
            <AccountTooltip 
              accounts={sellAccounts} 
              label={t("orders.sellAccount")}
              profitAmount={showProfitInSell ? order.profitAmount : null}
              profitCurrency={showProfitInSell ? order.profitCurrency : null}
              profitAccountName={profitAccountName}
              serviceChargeAmount={showServiceChargeInSell ? order.serviceChargeAmount : null}
              serviceChargeCurrency={showServiceChargeInSell ? order.serviceChargeCurrency : null}
              serviceChargeAccountName={serviceChargeAccountName}
              isSellAccount={true}
              accountCount={accountCount}
            >
              <div className="flex items-center gap-2 cursor-pointer">
                <span>{accountName}</span>
                {showBadge && (
                  <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                    {accountCount}
                  </span>
                )}
              </div>
            </AccountTooltip>
          ) : (
            <span>{accountName}</span>
          )}
        </td>
      );
    }
    case "profit":
      return (
        <td key={columnKey} className="py-2 text-slate-600">
          {order.profitAmount !== null && order.profitAmount !== undefined ? (
            <span className="text-blue-700 font-medium">
              {order.profitAmount > 0 ? "+" : ""}{order.profitAmount.toFixed(2)} {order.profitCurrency || ""}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
      );
    case "serviceCharges":
      return (
        <td key={columnKey} className="py-2 text-slate-600">
          {order.serviceChargeAmount !== null && order.serviceChargeAmount !== undefined ? (
            <span className={`font-medium ${order.serviceChargeAmount < 0 ? "text-red-600" : "text-green-700"}`}>
              {order.serviceChargeAmount > 0 ? "+" : ""}{order.serviceChargeAmount.toFixed(2)} {order.serviceChargeCurrency || ""}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
      );
    case "tags":
      return (
        <td key={columnKey} className="py-2">
          <div className="flex flex-wrap gap-1">
            {order.tags && Array.isArray(order.tags) && order.tags.length > 0 ? (
              order.tags.map((tag: { id: number; name: string; color: string }) => (
                <Badge key={tag.id} tone="slate" backgroundColor={tag.color} lightStyle={true}>
                  {tag.name}
                </Badge>
              ))
            ) : (
              <span className="text-slate-400 text-xs">-</span>
            )}
          </div>
        </td>
      );
    default:
      return null;
  }
}

