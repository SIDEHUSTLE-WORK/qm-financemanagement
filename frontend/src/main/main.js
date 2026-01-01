const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    icon: path.join(__dirname, '../../public/icon.png'),
    title: 'QM Finance Manager',
    show: false // Don't show until ready
  });

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  try {
    db.initDatabase();
  } catch (error) {
    console.error('Database initialization failed:', error);
    dialog.showErrorBox('Database Error', 'Failed to initialize database. The application will close.');
    app.quit();
    return;
  }
  
  // Income Handlers
  ipcMain.handle('add-income', async (event, data) => {
    try {
      return await db.addIncome(data);
    } catch (error) {
      console.error('Add income error:', error);
      throw error;
    }
  });

  ipcMain.handle('update-income', async (event, id, data) => {
    try {
      return await db.updateIncome(id, data);
    } catch (error) {
      console.error('Update income error:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-income', async (event, id) => {
    try {
      return await db.deleteIncome(id);
    } catch (error) {
      console.error('Delete income error:', error);
      throw error;
    }
  });

  ipcMain.handle('get-income', async () => {
    try {
      return await db.getIncome();
    } catch (error) {
      console.error('Get income error:', error);
      return [];
    }
  });

  // Expense Handlers
  ipcMain.handle('add-expense', async (event, data) => {
    try {
      return await db.addExpense(data);
    } catch (error) {
      console.error('Add expense error:', error);
      throw error;
    }
  });

  ipcMain.handle('update-expense', async (event, id, data) => {
    try {
      return await db.updateExpense(id, data);
    } catch (error) {
      console.error('Update expense error:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-expense', async (event, id) => {
    try {
      return await db.deleteExpense(id);
    } catch (error) {
      console.error('Delete expense error:', error);
      throw error;
    }
  });

  ipcMain.handle('get-expenses', async () => {
    try {
      return await db.getExpenses();
    } catch (error) {
      console.error('Get expenses error:', error);
      return [];
    }
  });

  // Receipt Counter Handlers
  ipcMain.handle('get-receipt-counter', async () => {
    try {
      return await db.getReceiptCounter();
    } catch (error) {
      console.error('Get receipt counter error:', error);
      return 1;
    }
  });

  ipcMain.handle('set-receipt-counter', async (event, value) => {
    try {
      return await db.setReceiptCounter(value);
    } catch (error) {
      console.error('Set receipt counter error:', error);
      throw error;
    }
  });

  // Old Balance Handlers
  ipcMain.handle('get-old-balance', async () => {
    try {
      return await db.getOldBalance();
    } catch (error) {
      console.error('Get old balance error:', error);
      return 0;
    }
  });

  ipcMain.handle('set-old-balance', async (event, value) => {
    try {
      return await db.setOldBalance(value);
    } catch (error) {
      console.error('Set old balance error:', error);
      throw error;
    }
  });

  // File Dialog Handlers for Backup/Restore
  ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        ...options,
        filters: options.filters || [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      return result;
    } catch (error) {
      console.error('Show save dialog error:', error);
      return { canceled: true };
    }
  });

  ipcMain.handle('save-file', async (event, { filePath, data }) => {
    try {
      // Validate file path
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, data, 'utf8');
      return { success: true };
    } catch (error) {
      console.error('Save file error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        ...options,
        filters: options.filters || [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      return result;
    } catch (error) {
      console.error('Show open dialog error:', error);
      return { canceled: true };
    }
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      // Validate file path
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }

      // Check file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data };
    } catch (error) {
      console.error('Read file error:', error);
      return { success: false, error: error.message };
    }
  });

  // Audit Log Handlers (add these if not in database.js)
  ipcMain.handle('add-audit-log', async (event, logData) => {
    try {
      return await db.addAuditLog(logData);
    } catch (error) {
      console.error('Add audit log error:', error);
      throw error;
    }
  });

  ipcMain.handle('get-audit-logs', async () => {
    try {
      return await db.getAuditLogs();
    } catch (error) {
      console.error('Get audit logs error:', error);
      return [];
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Close database connection before quitting
    try {
      db.closeDatabase();
    } catch (error) {
      console.error('Error closing database:', error);
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app errors
app.on('before-quit', () => {
  try {
    db.closeDatabase();
  } catch (error) {
    console.error('Error closing database on quit:', error);
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}