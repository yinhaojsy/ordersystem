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
  getStatusTone: (status: OrderStatus) => "amber" | "blue" | "emerald" | "rose" | "slate";
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
            {order.isFlexOrder && (
              <Badge tone="purple">
                Flex Order
              </Badge>
            )}
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
            {order.orderType === "otc" ? "OTC" : "Online"}
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
      
      // Check if profit/service charge accounts are different from buyAccounts
      const profitAccountId = showProfitInBuy ? order.profitAccountId : null;
      const serviceChargeAccountId = showServiceChargeInBuy ? order.serviceChargeAccountId : null;
      
      const profitAccountInBuyAccounts = profitAccountId 
        ? buyAccounts.some(acc => acc.accountId === profitAccountId)
        : false;
      const serviceChargeAccountInBuyAccounts = serviceChargeAccountId
        ? buyAccounts.some(acc => acc.accountId === serviceChargeAccountId)
        : false;
      
      // Count includes buyAccounts plus profit/service charge accounts if they're different
      let accountCount = buyAccounts.length;
      if (profitAccountId && !profitAccountInBuyAccounts) {
        accountCount++;
      }
      if (serviceChargeAccountId && !serviceChargeAccountInBuyAccounts) {
        accountCount++;
      }
      
      const hasMultiple = accountCount > 1;
      const shouldShowTooltip = hasMultiple || showProfitInBuy || showServiceChargeInBuy;
      
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
            >
              <div className="flex items-center gap-2 cursor-default">
                <span>{accountName}</span>
                {hasMultiple && (
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
      
      // Check if profit/service charge accounts are different from sellAccounts
      const profitAccountId = showProfitInSell ? order.profitAccountId : null;
      const serviceChargeAccountId = showServiceChargeInSell ? order.serviceChargeAccountId : null;
      
      const profitAccountInSellAccounts = profitAccountId 
        ? sellAccounts.some(acc => acc.accountId === profitAccountId)
        : false;
      const serviceChargeAccountInSellAccounts = serviceChargeAccountId
        ? sellAccounts.some(acc => acc.accountId === serviceChargeAccountId)
        : false;
      
      // Count includes sellAccounts plus profit/service charge accounts if they're different
      let accountCount = sellAccounts.length;
      if (profitAccountId && !profitAccountInSellAccounts) {
        accountCount++;
      }
      if (serviceChargeAccountId && !serviceChargeAccountInSellAccounts) {
        accountCount++;
      }
      
      const hasMultiple = accountCount > 1;
      const shouldShowTooltip = hasMultiple || showProfitInSell || showServiceChargeInSell;
      
      return (
        <td key={columnKey} className="py-2 text-slate-600">
          {shouldShowTooltip ? (
            <AccountTooltip 
              accounts={sellAccounts} 
              label={t("orders.sellAccount")}
              profitAmount={showProfitInSell ? order.profitAmount : null}
              profitAccountName={profitAccountName}
              serviceChargeAmount={showServiceChargeInSell ? order.serviceChargeAmount : null}
              serviceChargeAccountName={serviceChargeAccountName}
              isSellAccount={true}
            >
              <div className="flex items-center gap-2 cursor-default">
                <span>{accountName}</span>
                {hasMultiple && (
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
                <Badge key={tag.id} tone="slate" backgroundColor={tag.color}>
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

