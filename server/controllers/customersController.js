import { db } from "../db.js";

const trimValue = (value) => (typeof value === "string" ? value.trim() : value);
const sanitizePayload = (payload = {}) =>
  Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, trimValue(value)]));

export const listCustomers = (_req, res) => {
  const rows = db.prepare("SELECT * FROM customers ORDER BY name ASC;").all();
  res.json(rows);
};

export const createCustomer = (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const trimmedName = payload.name;

    if (!trimmedName) {
      return res.status(400).json({ message: "Customer name is required" });
    }

    const existing = db.prepare("SELECT id FROM customers WHERE lower(name) = lower(?);").get(trimmedName);
    if (existing) {
      return res.status(409).json({ message: "Customer with this name already exists" });
    }

    const stmt = db.prepare(
      `INSERT INTO customers (name, email, phone, remarks) VALUES (@name, @email, @phone, @remarks);`,
    );
    const result = stmt.run(payload);
    const row = db.prepare("SELECT * FROM customers WHERE id = ?;").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = sanitizePayload(req.body);
    const fields = Object.keys(updates);
    if (!fields.length) {
      return res.status(400).json({ message: "No updates provided" });
    }
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    db.prepare(`UPDATE customers SET ${assignments} WHERE id = @id;`).run({
      ...updates,
      id,
    });
    const row = db.prepare("SELECT * FROM customers WHERE id = ?;").get(id);
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = (req, res, next) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare("DELETE FROM customers WHERE id = ?;");
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listCustomerBeneficiaries = (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = db
      .prepare("SELECT * FROM customer_beneficiaries WHERE customerId = ? ORDER BY createdAt ASC;")
      .all(id);

    const normalized = rows.map((row) => ({
      ...row,
      walletAddresses: row.walletAddresses ? JSON.parse(row.walletAddresses) : null,
    }));

    res.json(normalized);
  } catch (error) {
    next(error);
  }
};

export const addCustomerBeneficiary = (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      paymentType,
      networkChain,
      walletAddresses,
      bankName,
      accountTitle,
      accountNumber,
      accountIban,
      swiftCode,
      bankAddress,
    } = req.body;

    if (!paymentType) {
      return res.status(400).json({ message: "Payment type is required" });
    }

    const stmt = db.prepare(
      `INSERT INTO customer_beneficiaries
       (customerId, paymentType, networkChain, walletAddresses, bankName, accountTitle, accountNumber, accountIban, swiftCode, bankAddress, createdAt)
       VALUES (@customerId, @paymentType, @networkChain, @walletAddresses, @bankName, @accountTitle, @accountNumber, @accountIban, @swiftCode, @bankAddress, @createdAt);`,
    );

    const result = stmt.run({
      customerId: id,
      paymentType,
      networkChain: networkChain || null,
      walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
      bankName: bankName || null,
      accountTitle: accountTitle || null,
      accountNumber: accountNumber || null,
      accountIban: accountIban || null,
      swiftCode: swiftCode || null,
      bankAddress: bankAddress || null,
      createdAt: new Date().toISOString(),
    });

    const beneficiary = db
      .prepare("SELECT * FROM customer_beneficiaries WHERE id = ?;")
      .get(result.lastInsertRowid);

    res.json({
      ...beneficiary,
      walletAddresses: beneficiary.walletAddresses ? JSON.parse(beneficiary.walletAddresses) : null,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomerBeneficiary = (req, res, next) => {
  try {
    const { id: customerId, beneficiaryId } = req.params;
    const {
      paymentType,
      networkChain,
      walletAddresses,
      bankName,
      accountTitle,
      accountNumber,
      accountIban,
      swiftCode,
      bankAddress,
    } = req.body;

    if (!paymentType) {
      return res.status(400).json({ message: "Payment type is required" });
    }

    db.prepare(
      `UPDATE customer_beneficiaries
       SET paymentType=@paymentType,
           networkChain=@networkChain,
           walletAddresses=@walletAddresses,
           bankName=@bankName,
           accountTitle=@accountTitle,
           accountNumber=@accountNumber,
           accountIban=@accountIban,
           swiftCode=@swiftCode,
           bankAddress=@bankAddress
       WHERE id=@beneficiaryId AND customerId=@customerId;`,
    ).run({
      paymentType,
      networkChain: networkChain || null,
      walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
      bankName: bankName || null,
      accountTitle: accountTitle || null,
      accountNumber: accountNumber || null,
      accountIban: accountIban || null,
      swiftCode: swiftCode || null,
      bankAddress: bankAddress || null,
      beneficiaryId,
      customerId,
    });

    const updated = db
      .prepare("SELECT * FROM customer_beneficiaries WHERE id = ? AND customerId = ?;")
      .get(beneficiaryId, customerId);

    if (!updated) {
      return res.status(404).json({ message: "Beneficiary not found" });
    }

    res.json({
      ...updated,
      walletAddresses: updated.walletAddresses ? JSON.parse(updated.walletAddresses) : null,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomerBeneficiary = (req, res, next) => {
  try {
    const { id: customerId, beneficiaryId } = req.params;
    const result = db
      .prepare("DELETE FROM customer_beneficiaries WHERE id = ? AND customerId = ?;")
      .run(beneficiaryId, customerId);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Beneficiary not found" });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


