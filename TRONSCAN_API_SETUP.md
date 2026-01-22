# TronScan API Key Setup Guide

## 🎉 Implementation Complete!

Your wallet tracker now supports **TronScan API authentication** with automatic fallback to public APIs!

---

## 📊 What You Get

### With API Key (Recommended):
- ✅ **100,000 requests/day** (vs ~1,000 public)
- ✅ **5 calls/second** rate limit per key
- ✅ **Can monitor 5+ wallets** with 5-second polling
- ✅ **Higher reliability** and priority access
- ✅ **FREE forever** (no credit card required)
- ✅ **Required by TronScan** (mandatory since Aug 2025)

### Without API Key:
- ⚠️ **Severely rate limited** (5-20 requests/second)
- ⚠️ **May get 401 Unauthorized** errors
- ⚠️ **Can monitor 1-2 wallets** only
- ⚠️ **Not recommended** for production

---

## 🚀 Quick Setup (2 Minutes)

### Step 1: Get Your API Key

You already have one! From your screenshot:

```
Application Name: ordersystem
API Key: 79e83dab-6729-4d6e-8c7b-fbefb5a1ef94
```

Or create a new one:
1. Visit: **https://tronscan.org/#/myaccount/apiKeys**
2. Click **"+ Add"**
3. Enter application name (e.g., "ordersystem")
4. Copy your API key

### Step 2: Add to Environment Variables

Create or edit `.env` file in your project root:

```bash
# TronScan API Key (from https://tronscan.org/#/myaccount/apiKeys)
TRONSCAN_API_KEY=79e83dab-6729-4d6e-8c7b-fbefb5a1ef94

# Wallet polling interval (in seconds)
WALLET_REFRESH_INTERVAL_SECONDS=5

# Enable auto-refresh
WALLET_AUTO_REFRESH_ENABLED=true
```

### Step 3: Restart Your Server

```bash
# Stop current server (Ctrl+C)
npm run server
```

You should see:
```
🔑 TronScan API key detected - using authenticated endpoint (100K requests/day)
```

---

## 🔍 How It Works

### API Priority Order:

**With API Key:**
1. **TronScan (authenticated)** - api.tronscan.org ← Primary
2. **TronScan Alt (authenticated)** - apilist.tronscanapi.com ← Fallback 1
3. TronGrid Public - Fallback 2
4. TronScan Public (no key) - Fallback 3

**Without API Key:**
1. **TronScan Public** - api.tronscan.org ← Primary
2. TronScan Alternative - Fallback 1
3. TronGrid Public - Fallback 2

### Authentication:

All requests to TronScan endpoints include:
```
Header: x-api-key: 79e83dab-6729-4d6e-8c7b-fbefb5a1ef94
```

### Automatic Failover:

```
Request → Try Primary Endpoint (with API key)
    ↓
  Success? → Use it & remember
    ↓
  Failed? → Try next endpoint
    ↓
  Success? → Switch to it
    ↓
  All failed? → Return error
```

---

## 📝 Console Logs

### With API Key:
```bash
🔑 TronScan API key detected - using authenticated endpoint (100K requests/day)
🤖 Wallet auto-refresh enabled (interval: 5 seconds)
🔄 Auto-refreshing 3 wallet(s)...
✅ Wallet auto-refresh completed: 3 successful, 0 failed
```

### Without API Key:
```bash
⚠️  No TronScan API key - using public endpoints (limited rate)
🤖 Wallet auto-refresh enabled (interval: 5 seconds)
🔄 Auto-refreshing 3 wallet(s)...
✅ Wallet auto-refresh completed: 3 successful, 0 failed
```

### If Endpoint Switches:
```bash
Failed to fetch from https://api.tronscan.org/api (authenticated): API error: 429
✅ Switched to working endpoint: https://apilist.tronscanapi.com/api (authenticated)
```

---

## 🧪 Testing

### Test 1: Verify API Key Works

1. Add API key to `.env`
2. Restart server
3. Check console for: `🔑 TronScan API key detected`
4. Add a test wallet
5. Watch auto-refresh logs

### Test 2: Verify Fallback Works

1. Use invalid API key temporarily
2. Restart server
3. Should automatically switch to public APIs
4. Check console for: `✅ Switched to working endpoint`

---

## 📊 Rate Limit Calculator

**Daily requests with 5-second polling:**

| Wallets | Requests/Day | With API Key | Without Key |
|---------|--------------|--------------|-------------|
| 1 wallet | 17,280 | ✅ 17% used | ⚠️ May hit limit |
| 3 wallets | 51,840 | ✅ 52% used | ❌ Will hit limit |
| 5 wallets | 86,400 | ✅ 86% used | ❌ Will hit limit |
| 6 wallets | 103,680 | ⚠️ Over limit | ❌ Will hit limit |

**Recommendation:** API key is **mandatory** for 2+ wallets!

---

## 🔧 Troubleshooting

### Issue: Still seeing "No TronScan API key" message

**Solution:**
1. Check `.env` file exists in project root
2. Verify key name is exactly: `TRONSCAN_API_KEY`
3. No quotes needed: `TRONSCAN_API_KEY=79e83dab-6729-4d6e-8c7b-fbefb5a1ef94` ✅
4. Not: `TRONSCAN_API_KEY="79e83dab..."` ❌
5. Restart server after adding key

### Issue: Getting 401/403 errors

**Solution:**
1. Verify API key is correct (copy-paste from TronScan)
2. Check key hasn't been deleted
3. Log in to TronScan and verify key still exists
4. Ensure no extra spaces in `.env` file
5. System will auto-fallback to public APIs

### Issue: Rate limit errors (429)

**Solution:**
1. If using API key: You're near 100K/day limit
2. Reduce polling frequency: `WALLET_REFRESH_INTERVAL_SECONDS=10`
3. Or reduce number of wallets monitored
4. System will auto-fallback to alternative endpoints
5. Consider getting additional API keys for load balancing

---

## 🎯 Best Practices

### For Production:

1. ✅ **Always use API key** - Now mandatory by TronScan
2. ✅ **Monitor 1-5 wallets** - Stay under limits
3. ✅ **Keep 5-second polling** - Good balance
4. ✅ **Set up monitoring** - Watch console logs
5. ✅ **Keep `.env` secret** - Don't commit to git
6. ✅ **Check "Calls Today"** - Monitor usage on TronScan dashboard

### For Development:

1. ✅ **Use test wallets** - Don't monitor real wallets
2. ✅ **Use API key** - Even for development (free)
3. ✅ **Increase interval if needed** - `10` or `30` seconds
4. ✅ **Test failover** - Try invalid key to see fallback

---

## 📚 Additional Resources

- **TronScan API Keys**: https://tronscan.org/#/myaccount/apiKeys
- **TronScan Docs**: https://docs.tronscan.org/
- **API Announcements**: https://support.tronscan.org/
- **Rate Limit Info**: https://support.tronscan.org/hc/en-us/articles/20506296714521

---

## ✅ Summary

Your wallet tracker now:
- ✅ Supports TronScan API authentication with `x-api-key` header
- ✅ Automatically uses API key if provided
- ✅ Falls back to public APIs if key fails
- ✅ Logs which endpoint is being used
- ✅ Can monitor 5+ wallets with API key
- ✅ Complies with TronScan's mandatory API key requirement

**Your API Key:** `79e83dab-6729-4d6e-8c7b-fbefb5a1ef94`  
**Just add it to `.env` and restart!** 🚀
