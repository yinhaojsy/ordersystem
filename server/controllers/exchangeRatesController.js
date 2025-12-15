import { db } from "../db.js";

/**
 * Get exchange rates for a currency against USDT
 * Returns buy and sell rates from the currencies table
 */
export const getExchangeRates = (req, res, next) => {
  try {
    const { currency } = req.params;
    
    if (!currency) {
      return res.status(400).json({ message: "Currency code is required" });
    }

    // Get the currency from the database (case-insensitive lookup)
    const currencyRow = db
      .prepare("SELECT * FROM currencies WHERE UPPER(code) = UPPER(?) AND active = 1;")
      .get(currency.toUpperCase());

    if (!currencyRow) {
      return res.status(404).json({ 
        message: `Currency ${currency} not found or inactive` 
      });
    }

    // Return buy and sell rates
    // The frontend expects rates against USDT
    // Using conversionRateBuy and conversionRateSell as these are the actual rates used
    res.json({
      buy: currencyRow.conversionRateBuy,
      sell: currencyRow.conversionRateSell,
      baseRateBuy: currencyRow.baseRateBuy,
      baseRateSell: currencyRow.baseRateSell,
    });
  } catch (error) {
    next(error);
  }
};
