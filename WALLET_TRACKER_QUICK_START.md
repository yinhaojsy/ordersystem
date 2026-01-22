# Wallet Tracker - Quick Start Guide

## 🚀 Getting Started

The Wallet Tracker feature is now fully integrated into your order system. Follow these simple steps to start monitoring TRON wallets.

## Step 1: Access the Wallet Tracker

1. Log in to your order system
2. Look for **"Wallet Tracker"** in the left sidebar navigation
3. Click to open the Wallet Tracker page

## Step 2: Add Your First Wallet

1. Click the **"ADD WALLET"** button (top right of Wallet List section)
2. Fill in the form:
   - **Nick Name**: Give it a friendly name (e.g., "Main USDT Wallet")
   - **Wallet Address**: Enter the TRON address (starts with 'T')
   - **Remarks** (optional): Add any notes about this wallet
3. Click **"Add"**
4. The system will automatically:
   - Fetch the current USDT balance
   - Load recent transaction history
   - Display the wallet in your list

## Step 3: Monitor Your Wallets

### View Summary
- See all your wallets at a glance in the summary cards
- Total USDT balance is displayed at the top
- Click any card to view transaction logs

### Check Transactions
- Click **"Logs"** button on any wallet
- View all USDT inflows and outflows
- Click transaction hashes to view on TronScan blockchain explorer

### Refresh Balances
- **Single Wallet**: Click "Refresh" next to any wallet
- **All Wallets**: Click "Refresh All" in the summary section

## Step 4: Receive Notifications

All users will automatically receive notifications when:
- 💰 A wallet receives USDT (inflow)
- 💸 A wallet sends USDT (outflow)  
- 📊 A wallet balance changes significantly

Check the notification bell icon (🔔) in the top navigation bar.

## 🤖 Automatic Monitoring

**Good news!** The system automatically monitors your wallets:

- ✅ **Auto-refresh enabled by default** - checks every 5 minutes
- ✅ **Detects new transactions automatically**
- ✅ **Sends notifications to all users**
- ✅ **No manual refresh needed** (but still available if you want)

You'll see console logs like this:
```
🔄 Auto-refreshing 3 wallet(s)...
✅ Wallet auto-refresh completed: 3 successful, 0 failed
💰 Main USDT Wallet: 2 new transaction(s)
```

## Example: Adding a Wallet

```
Nick Name: Company USDT Wallet
Wallet Address: TKHuVq1oKVruCGLvqVexFs6dawKv6fQgFs
Remarks: Main operational wallet for USDT transactions
```

Click "Add" and you're done! ✅

## Common Actions

### Copy Wallet Address
- Click the copy icon (📋) next to any wallet address
- Address is copied to your clipboard

### Edit Wallet
- Click "Edit" button on any wallet
- Update nickname or remarks
- Note: Wallet address cannot be changed

### Delete Wallet
- Click "Delete" button on any wallet
- Confirm deletion
- All transaction logs will also be removed

### View on Blockchain
- In transaction logs, click on any transaction hash
- Opens TronScan in a new tab
- View full blockchain details

## Tips for Best Results

1. **📝 Use Clear Names**: Give each wallet a descriptive nickname
2. **🔄 Regular Refresh**: Use "Refresh All" periodically to check for new transactions
3. **💬 Add Remarks**: Document the purpose of each wallet in the remarks field
4. **🔔 Enable Notifications**: Make sure browser notifications are enabled

## Troubleshooting

### "Invalid TRON wallet address format"
- Make sure address starts with 'T'
- Address should be exactly 34 characters
- Copy address directly from your TRON wallet

### Balance shows $0.00 USDT
- Click "Refresh" to update the balance
- Check if the wallet actually has USDT on TronScan
- Make sure it's a TRON TRC20 wallet (not TRX-only)

### Transactions not showing
- Click "Refresh" in the transaction logs modal
- Only USDT (TRC20) transactions are tracked
- Verify transactions exist on TronScan.org

## Permissions Required

To use Wallet Tracker features, your role must have:
- ✅ Section access to "wallets"
- ✅ Action permission "createWallet" (to add wallets)
- ✅ Action permission "updateWallet" (to edit and refresh)
- ✅ Action permission "deleteWallet" (to remove wallets)

Contact your administrator if you don't see these options.

## Security Reminder

⚠️ **Important**: 
- This feature only **monitors** wallets (read-only)
- It does **NOT** store private keys
- It **CANNOT** send or move funds
- All data is fetched from public blockchain

Your funds are completely safe! 🔒

## Need Help?

- Check the detailed documentation: `WALLET_TRACKER_SETUP.md`
- View implementation details: `WALLET_TRACKER_IMPLEMENTATION.md`
- Contact your system administrator

---

**Happy Monitoring!** 🎉
