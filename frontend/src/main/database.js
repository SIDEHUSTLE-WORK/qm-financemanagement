const Database = require(require.resolve('better-sqlite3'));
const path = require('path');
const { app } = require('electron');

let db;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'qm-financial.db');
  db = new Database(dbPath);
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      receiptNo TEXT NOT NULL,
      paymentMethod TEXT NOT NULL,
      studentName TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  console.log('Database initialized at:', dbPath);
  return db;
}

function addIncome(data) {
  const stmt = db.prepare(`
    INSERT INTO income (date, category, description, amount, receiptNo, paymentMethod, studentName)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.date,
    data.category,
    data.description,
    data.amount,
    data.receiptNo,
    data.paymentMethod,
    data.studentName || null
  );
  return result.lastInsertRowid;
}

function addExpense(data) {
  const stmt = db.prepare(`
    INSERT INTO expenses (date, category, description, amount)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.date,
    data.category,
    data.description,
    data.amount
  );
  return result.lastInsertRowid;
}

function getIncome() {
  const stmt = db.prepare('SELECT * FROM income ORDER BY date DESC, id DESC');
  return stmt.all();
}

function getExpenses() {
  const stmt = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC');
  return stmt.all();
}

function deleteIncome(id) {
  const stmt = db.prepare('DELETE FROM income WHERE id = ?');
  return stmt.run(id);
}

function deleteExpense(id) {
  const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
  return stmt.run(id);
}

function getReceiptCounter() {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get('receiptCounter');
  return row ? parseInt(row.value) : 1;
}

function setReceiptCounter(value) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run('receiptCounter', value.toString());
}

function getOldBalance() {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get('oldBalance');
  return row ? parseFloat(row.value) : 0;
}

function setOldBalance(value) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run('oldBalance', value.toString());
}

module.exports = {
  initDatabase,
  addIncome,
  addExpense,
  getIncome,
  getExpenses,
  deleteIncome,
  deleteExpense,
  getReceiptCounter,
  setReceiptCounter,
  getOldBalance,
  setOldBalance
};
