const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  addIncome: (data) => ipcRenderer.invoke('add-income', data),
  addExpense: (data) => ipcRenderer.invoke('add-expense', data),
  getIncome: () => ipcRenderer.invoke('get-income'),
  getExpenses: () => ipcRenderer.invoke('get-expenses'),
  deleteIncome: (id) => ipcRenderer.invoke('delete-income', id),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),
  getReceiptCounter: () => ipcRenderer.invoke('get-receipt-counter'),
  setReceiptCounter: (value) => ipcRenderer.invoke('set-receipt-counter', value),
  getOldBalance: () => ipcRenderer.invoke('get-old-balance'),
  setOldBalance: (value) => ipcRenderer.invoke('set-old-balance', value),
  exportToPDF: (data) => ipcRenderer.invoke('export-pdf', data),
  exportToExcel: (data) => ipcRenderer.invoke('export-excel', data),
  print: (data) => ipcRenderer.invoke('print', data), // <- Add comma here
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  saveFile: (filePath, data) => ipcRenderer.invoke('save-file', { filePath, data }),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath)
});