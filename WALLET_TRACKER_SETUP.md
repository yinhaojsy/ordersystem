# Wallet Tracker Feature

## Overview

The Wallet Tracker feature allows you to monitor multiple TRON wallets and track USDT (TRC20) token inflows and outflows in real-time. All users are automatically notified when transactions occur or when wallet balances change.

## Features

### 1. **Wallet Summary Section**
- Displays summary cards for each tracked wallet
- Shows nickname and current USDT balance for each wallet
- Displays total USDT balance across all wallets
- Shows last balance check timestamp
- Click on any summary card to view transaction logs

### 2. **Wallet List Management**
- **Add Wallet**: Add new TRON wallets with nickname, address, and optional remarks
- **Edit Wallet**: Update nickname and remarks (wallet address cannot be changed)
- **Delete Wallet**: Remove wallet from tracking (also deletes all transaction logs)
- **Refresh Balance**: Manually refresh a single wallet's balance
- **Refresh All**: Refresh all wallets at once
- **View Logs**: View detailed transaction history for each wallet

### 3. **Transaction Logs**
- Displays all USDT inflow and outflow transactions
- Shows transaction date, type (inflow/outflow), amount, from/to addresses, and transaction hash
- Transaction hashes link directly to TronScan for detailed blockchain information
- Copy wallet addresses to clipboard with one click
- Refresh button to fetch latest transactions from blockchain

### 4. **Real-time Notifications**
- All users receive notifications when:
  - A wallet receives USDT (inflow)
  - A wallet sends USDT (outflow)
  - A wallet balance changes significantly (> 0.01 USDT)

## Technical Details

### Database Schema

#### `tron_wallets` Table
- `id`: Wallet ID (auto-increment)
- `nickname`: User-friendly name for the wallet
- `walletAddress`: TRON wallet address (unique, starts with 'T')
- `remarks`: Optional notes about the wallet
- `currentBalance`: Current USDT balance
- `lastBalanceCheck`: Timestamp of last balance update
- `createdAt`: When wallet was added
- `updatedAt`: Last modification timestamp

#### `tron_wallet_transactions` Table
- `id`: Transaction ID (auto-increment)
- `walletId`: Reference to tron_wallets
- `transactionHash`: Blockchain transaction hash (unique)
- `transactionType`: 'inflow' or 'outflow'
- `amount`: USDT amount transferred
- `fromAddress`: Sender address
- `toAddress`: Receiver address
- `timestamp`: Transaction timestamp from blockchain
- `blockNumber`: Block number
- `createdAt`: When transaction was recorded in our system

### API Endpoints

#### GET `/api/wallets`
- Returns list of all tracked wallets

#### GET `/api/wallets/summary`
- Returns summary data for all wallets (optimized for summary cards)

#### POST `/api/wallets`
- Add a new wallet
- Body: `{ nickname, walletAddress, remarks }`
- Automatically fetches initial balance and recent transactions

#### PUT `/api/wallets/:id`
- Update wallet nickname and remarks
- Body: `{ nickname, remarks }`

#### DELETE `/api/wallets/:id`
- Delete a wallet and all its transaction logs

#### POST `/api/wallets/:id/refresh`
- Manually refresh wallet balance and check for new transactions

#### GET `/api/wallets/:id/transactions?refresh=true`
- Get transaction logs for a wallet
- Optional `refresh=true` query param to fetch latest transactions from blockchain

#### POST `/api/wallets/refresh-all`
- Refresh all wallets at once
- Returns success/failure status for each wallet

### TronScan API Integration

The feature integrates with TronScan API to fetch:

1. **USDT Balance**: 
   - Endpoint: `https://apilist.tronscanapi.com/api/account`
   - Fetches TRC20 token balances
   - USDT Contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

2. **Transactions**:
   - Endpoint: `https://apilist.tronscanapi.com/api/token_trc20/transfers`
   - Fetches recent USDT transfers for a wallet
   - Supports pagination and filtering

### Permissions

The following action permissions control access to wallet features:

- `createWallet`: Add new wallets
- `updateWallet`: Edit wallets and refresh balances
- `deleteWallet`: Remove wallets
- `viewWalletTransactions`: View transaction logs

Users need section access to "wallets" to access the Wallet Tracker page.

## Usage Instructions

### Adding a Wallet

1. Navigate to **Wallet Tracker** page from the sidebar
2. Click **ADD WALLET** button (top right of Wallet List section)
3. Fill in the form:
   - **Nick Name**: User-friendly name (required)
   - **Wallet Address**: TRON address starting with 'T' (required)
   - **Remarks**: Optional notes
4. Click **Add**
5. System will automatically fetch current balance and recent transactions

### Monitoring Wallets

- **View Summary**: Check the summary cards at the top to see all wallet balances at a glance
- **Refresh Balance**: Click the "Refresh" button next to any wallet to update its balance
- **Refresh All**: Click "Refresh All" button in the summary section to update all wallets
- **View Transactions**: Click on a summary card or click "Logs" button in the wallet list

### Transaction Logs

- View all inflow/outflow transactions for a wallet
- Click on transaction hash to view details on TronScan
- Use the "Refresh" button to fetch latest transactions from blockchain
- Transactions are automatically fetched when viewing logs with `refresh=true`

## Automated Monitoring

**✨ NEW: Automatic refresh is now built-in!**

The system automatically refreshes all wallets every 5 minutes by default. You don't need to set up anything!

### Configuration

Control the automatic refresh with environment variables:

```bash
# Enable/disable automatic refresh (default: enabled)
WALLET_AUTO_REFRESH_ENABLED=true

# Set refresh interval in minutes (default: 5)
WALLET_REFRESH_INTERVAL_MINUTES=5
```

### How It Works

1. **Server starts** → Waits 30 seconds for full initialization
2. **First refresh** → Checks all wallets for balance changes and new transactions
3. **Periodic refresh** → Repeats every 5 minutes (or your configured interval)
4. **Notifications** → Users automatically notified of any changes
5. **Logs** → Console shows refresh results and new transactions

### Console Output Example

```
🤖 Wallet auto-refresh enabled (interval: 5 minutes)
🔄 Auto-refreshing 3 wallet(s)...
✅ Wallet auto-refresh completed: 3 successful, 0 failed
   💰 Main USDT Wallet: 2 new transaction(s), balance change: 150.00 USDT
   💰 Company Wallet: 1 new transaction(s), balance change: -50.00 USDT
```

### Manual Refresh Still Available

You can still manually refresh anytime:
- Single wallet: Click "Refresh" button
- All wallets: Click "Refresh All" button in summary section

### Disable Auto-Refresh (Optional)

If you prefer manual control only:

```bash
# In your .env file or environment variables
WALLET_AUTO_REFRESH_ENABLED=false
```

### Change Refresh Interval (Optional)

To check more or less frequently:

```bash
# Check every 2 minutes (very frequent - may hit API limits)
WALLET_REFRESH_INTERVAL_MINUTES=2

# Check every 10 minutes (less frequent)
WALLET_REFRESH_INTERVAL_MINUTES=10

# Check every 30 minutes (recommended for many wallets)
WALLET_REFRESH_INTERVAL_MINUTES=30
```

## Notifications

When transactions or balance changes are detected:

1. System creates notifications for all users
2. Notification includes:
   - Wallet nickname
   - Transaction type (received/sent)
   - Amount of USDT
3. Users can view notifications in the notification dropdown
4. Clicking notification navigates to Wallet Tracker page

## Best Practices

1. **Wallet Naming**: Use clear, descriptive nicknames for easy identification
2. **Regular Monitoring**: Set up automated refresh to detect transactions quickly
3. **Remarks Field**: Use remarks to document the purpose or owner of each wallet
4. **Balance Alerts**: Balance changes > 0.01 USDT trigger notifications
5. **Transaction History**: Keep wallets to maintain historical transaction records

## Troubleshooting

### Balance Not Updating
- Click "Refresh" button to manually update
- Check TronScan API availability
- Verify wallet address is correct

### Transactions Not Showing
- Click "Refresh" in transaction logs modal
- Verify transactions exist on TronScan
- Check if transactions are USDT (TRC20) transfers

### API Errors
- TronScan API rate limits may apply
- Network connectivity issues
- Invalid wallet address format

## Security Considerations

- ⚠️ **Read-Only Monitoring**: This feature only monitors wallet balances and transactions
- ✅ **No Private Keys**: System never stores or requires private keys
- ✅ **Public Data**: All information is fetched from public blockchain data
- ✅ **No Fund Control**: System cannot initiate transactions or move funds

## Future Enhancements

Potential improvements for future versions:

1. Support for other cryptocurrencies (TRX, other TRC20 tokens)
2. Support for other blockchain networks (Ethereum, BSC, etc.)
3. Price conversion to USD or other fiat currencies
4. Advanced filtering and search in transaction logs
5. Export transaction history to CSV/Excel
6. Webhook notifications for external systems
7. Custom alert thresholds per wallet
8. Dashboard widgets for wallet balances

---

**Note**: This feature requires internet connectivity to fetch data from TronScan API. Ensure your server has outbound internet access.
