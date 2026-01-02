import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, FileText, Download, Send, DollarSign, TrendingUp, Calendar, BarChart3, Receipt, Printer, Mail, LogOut, Settings as SettingsIcon, Edit, Search, Filter, X, Lock, User, Eye, EyeOff, Upload, Shield } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


 // ==================== API CONFIGURATION ====================
const API_URL = 'https://qm-financemanagement-production.up.railway.app/api';

const api = {
  getHeaders: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('qm_access_token')}`
  }),

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: this.getHeaders()
      });
      
      if (response.status === 401) {
        localStorage.removeItem('qm_access_token');
        localStorage.removeItem('qm_current_user');
        window.location.reload();
        return { success: false };
      }
      
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, message: 'Network error' };
    }
  },

  get: (endpoint) => api.request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => api.request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => api.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => api.request(endpoint, { method: 'DELETE' })
};

const SchoolFinanceApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState({ name: 'Ms. SHADIA', role: 'Bursar' });
  const [schoolName, setSchoolName] = useState('QUEEN MOTHER JUNIOR SCHOOL');
  const [schoolLogo, setSchoolLogo] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [expenseEntries, setExpenseEntries] = useState([]);
  const [receiptCounter, setReceiptCounter] = useState(1);
  const [isElectron, setIsElectron] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // API Categories State
  const [apiIncomeCategories, setApiIncomeCategories] = useState([]);
  const [apiExpenseCategories, setApiExpenseCategories] = useState([]);
  
  const [incomeSearchTerm, setIncomeSearchTerm] = useState('');
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [incomeFilterCategory, setIncomeFilterCategory] = useState('All');
  const [expenseFilterCategory, setExpenseFilterCategory] = useState('All');
  const [incomeDateFilter, setIncomeDateFilter] = useState('');
  const [expenseDateFilter, setExpenseDateFilter] = useState('');
  
  const editIncomeRef = useRef(null);
  const editExpenseRef = useRef(null);
  
  const incomeFormRef = useRef({
    date: new Date().toISOString().split('T')[0],
    category: 'School Fees',
    description: '',
    amount: '',
    paymentMethod: 'Cash',
    studentName: ''
  });
  
  const expenseFormRef = useRef({
    date: new Date().toISOString().split('T')[0],
    category: 'Food & Supplies',
    description: '',
    amount: ''
  });

  const [, forceUpdate] = useState({});
  const rerender = () => forceUpdate({});

  const incomeCategories = ['Old Balance', 'School Fees', 'Uniform', 'Swimming', 'School Van', 'School Tour', 'Extras', 'Others'];
  const expenseCategories = ['Salaries', 'Food & Supplies', 'Utilities', 'Weekly Allowances', 'Transport', 'Stationery & Supplies', 'Labor', 'Furniture', 'Banking', 'Other'];
  const paymentMethods = ['Cash', 'Mobile Money', 'School Pay', 'Bank Transfer'];
  
  
  // ==================== API DATA LOADING FUNCTIONS ====================
  const loadCategoriesFromAPI = async () => {
    try {
      const [incomeRes, expenseRes] = await Promise.all([
        api.get('/income/categories'),
        api.get('/expenses/categories')
      ]);
      if (incomeRes.success) {
        const incomeData = Array.isArray(incomeRes.data) ? incomeRes.data : (incomeRes.data?.categories || []);
        setApiIncomeCategories(incomeData);
      }
      if (expenseRes.success) {
        const expenseData = Array.isArray(expenseRes.data) ? expenseRes.data : (expenseRes.data?.categories || []);
        setApiExpenseCategories(expenseData);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };
 const loadIncomeFromAPI = async () => {
    const res = await api.get('/income');
    if (res.success) {
      // Handle both array and nested object response
      const dataArray = Array.isArray(res.data) ? res.data : (res.data?.entries || res.data?.items || []);
      const mapped = dataArray.map(item => ({
        id: item.id,
        date: item.date?.split('T')[0],
        category: item.category?.name || 'Unknown',
        categoryId: item.categoryId,
        description: item.description,
        amount: parseFloat(item.amount),
        receiptNo: item.receiptNumber,
        paymentMethod: item.paymentMethod?.replace('_', ' ').toUpperCase() || 'Cash',
        studentName: item.student?.fullName || '',
        studentId: item.studentId
      }));
      setIncomeEntries(mapped);
    }
  };

  const loadExpensesFromAPI = async () => {
    const res = await api.get('/expenses');
    if (res.success) {
      // Handle both array and nested object response
      const dataArray = Array.isArray(res.data) ? res.data : (res.data?.entries || res.data?.items || []);
      const mapped = dataArray.map(item => ({
        id: item.id,
        date: item.date?.split('T')[0],
        category: item.category?.name || 'Unknown',
        categoryId: item.categoryId,
        description: item.description,
        amount: parseFloat(item.amount)
      }));
      setExpenseEntries(mapped);
    }
  };
  const logAction = (action, type, details) => {
    const log = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user: user.name,
      role: user.role,
      action: action, // 'ADD', 'EDIT', 'DELETE', 'BACKUP', 'RESTORE'
      type: type, // 'INCOME', 'EXPENSE', 'SETTINGS'
      details: details
    };
    
    const existingLogs = JSON.parse(localStorage.getItem('qm_audit_logs') || '[]');
    existingLogs.push(log);
    localStorage.setItem('qm_audit_logs', JSON.stringify(existingLogs));
  };

  

  useEffect(() => {
    const initializeApp = async () => {
      const users = JSON.parse(localStorage.getItem('qm_users') || '[]');
      if (users.length === 0) {
        const defaultUsers = [
          {
            id: 1,
            username: 'shadia',
            password: 'shadia123',
            name: 'Ms. SHADIA',
            role: 'Bursar',
            canEdit: true,
            canView: true
          },
          {
            id: 2,
            username: 'princess',
            password: 'james123',
            name: 'Madam PRINCESS',
            role: 'Director',
            canEdit: false,
            canView: true
          }
        ];
        localStorage.setItem('qm_users', JSON.stringify(defaultUsers));
      }

      const savedUser = localStorage.getItem('qm_current_user');
     if (savedUser) {
        const userData = JSON.parse(savedUser);
        setCurrentUser(userData);
        setUser({ name: userData.name, role: userData.role });
        setIsAuthenticated(true);
        
        // Load data from API
        await loadCategoriesFromAPI();
        await loadIncomeFromAPI();
        await loadExpensesFromAPI();
      }
      
      if (window.electronAPI) {
        setIsElectron(true);
        await loadDataFromDB();
      } else {
        loadFromLocalStorage();
      }
      
      const savedSettings = localStorage.getItem('qm_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setSchoolName(settings.schoolName || 'QUEEN MOTHER JUNIOR SCHOOL');
        setSchoolLogo(settings.schoolLogo || null);
        if (settings.bursarName && !savedUser) {
          setUser(prev => ({ ...prev, name: settings.bursarName }));
        }
      }
      
      setLoading(false);
    };
    
    initializeApp();
  }, []);

  useEffect(() => {
    if (!isElectron && !loading) {
      localStorage.setItem('qm_income', JSON.stringify(incomeEntries));
      localStorage.setItem('qm_expenses', JSON.stringify(expenseEntries));
      localStorage.setItem('qm_receipt_counter', receiptCounter.toString());
    }
  }, [incomeEntries, expenseEntries, receiptCounter, isElectron, loading]);

  const loadFromLocalStorage = () => {
    try {
      const savedIncome = localStorage.getItem('qm_income');
      const savedExpenses = localStorage.getItem('qm_expenses');
      const savedCounter = localStorage.getItem('qm_receipt_counter');
      
      if (savedIncome) setIncomeEntries(JSON.parse(savedIncome));
      if (savedExpenses) setExpenseEntries(JSON.parse(savedExpenses));
      if (savedCounter) setReceiptCounter(parseInt(savedCounter));
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  };

  const loadDataFromDB = async () => {
    try {
      const income = await window.electronAPI.getIncome();
      const expenses = await window.electronAPI.getExpenses();
      const counter = await window.electronAPI.getReceiptCounter();
      
      setIncomeEntries(income || []);
      setExpenseEntries(expenses || []);
      setReceiptCounter(counter || 1);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL financial records? This cannot be undone!')) {
      return;
    }
    
    if (isElectron) {
      try {
        for (const entry of incomeEntries) {
          await window.electronAPI.deleteIncome(entry.id);
        }
        for (const entry of expenseEntries) {
          await window.electronAPI.deleteExpense(entry.id);
        }
        await window.electronAPI.setReceiptCounter(1);
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Error clearing data from database');
        return;
      }
    } else {
      localStorage.removeItem('qm_income');
      localStorage.removeItem('qm_expenses');
      localStorage.removeItem('qm_receipt_counter');
    }
    
    setIncomeEntries([]);
    setExpenseEntries([]);
    setReceiptCounter(1);
    alert('All data cleared successfully!');
    logAction('DELETE', 'SYSTEM', `Cleared all financial data - ${incomeEntries.length} income entries and ${expenseEntries.length} expense entries deleted`);
  };

  const calculateTotals = (entries, dateFilter = null) => {
    if (dateFilter) {
      entries = entries.filter(e => e.date === dateFilter);
    }
    return entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  };

  const getOldBalance = () => {
    const oldBalanceEntries = incomeEntries.filter(e => e.category === 'Old Balance');
    return calculateTotals(oldBalanceEntries);
  };

  const getTodayIncome = () => calculateTotals(incomeEntries.filter(e => e.category !== 'Old Balance'), selectedDate);
  const getTodayExpense = () => calculateTotals(expenseEntries, selectedDate);
  const getTodayNet = () => getTodayIncome() - getTodayExpense();

  const addIncome = async () => {
    const form = incomeFormRef.current;
    
    if (!form.amount || !form.description) {
      alert('Please fill in all required fields');
      return;
    }

    // Find category ID from API categories
    const category = apiIncomeCategories.find(c => c.name === form.category);
    if (!category) {
      alert('Please select a valid category');
      return;
    }

    // Call API
    const res = await api.post('/income', {
      date: form.date,
      categoryId: category.id,
      description: form.description,
      amount: Number(form.amount),
      paymentMethod: form.paymentMethod.toLowerCase().replace(' ', '_'),
      studentId: form.studentId || null
    });

    if (!res.success) {
      alert(res.message || 'Error saving income');
      return;
    }

    // Map API response to local format
    const entry = {
      id: res.data.id,
      date: res.data.date?.split('T')[0],
      category: res.data.category?.name || form.category,
      description: res.data.description,
      amount: parseFloat(res.data.amount),
      receiptNo: res.data.receiptNumber,
      paymentMethod: form.paymentMethod,
      studentName: res.data.student?.fullName || form.studentName || ''
    };
    
    setIncomeEntries(prev => [entry, ...prev]);
    
    incomeFormRef.current = {
      date: new Date().toISOString().split('T')[0],
      category: 'School Fees',
      description: '',
      amount: '',
      paymentMethod: 'Cash',
      studentName: '',
      studentId: ''
    };
    
    logAction('ADD', 'INCOME', `Added ${entry.category}: ${entry.description} - ${formatCurrency(entry.amount)} (Receipt: ${entry.receiptNo})`);
    rerender();
    
    // Auto-print receipt
    printReceipt(entry);
  };

  const addExpense = async () => {
    const form = expenseFormRef.current;
    
    if (!form.amount || !form.description) {
      alert('Please fill in all required fields');
      return;
    }

    // Find category ID from API categories
    const category = apiExpenseCategories.find(c => c.name === form.category);
    if (!category) {
      alert('Please select a valid category');
      return;
    }

    // Call API
    const res = await api.post('/expenses', {
      date: form.date,
      categoryId: category.id,
      description: form.description,
      amount: Number(form.amount)
    });

    if (!res.success) {
      alert(res.message || 'Error saving expense');
      return;
    }

    const entry = {
      id: res.data.id,
      date: res.data.date?.split('T')[0],
      category: res.data.category?.name || form.category,
      description: res.data.description,
      amount: parseFloat(res.data.amount)
    };
    
    setExpenseEntries(prev => [entry, ...prev]);
    
    expenseFormRef.current = {
      date: new Date().toISOString().split('T')[0],
      category: 'Food & Supplies',
      description: '',
      amount: ''
    };
    
    logAction('ADD', 'EXPENSE', `Added ${entry.category}: ${entry.description} - ${formatCurrency(entry.amount)}`);
    rerender();
  };

 const updateIncome = async () => {
    const entry = editIncomeRef.current;
    
    if (!entry.amount || !entry.description) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Find category ID from API categories
    const category = apiIncomeCategories.find(c => c.name === entry.category);
    
    // Call API to update
    const res = await api.put(`/income/${entry.id}`, {
      date: entry.date,
      categoryId: category?.id || entry.categoryId,
      description: entry.description,
      amount: Number(entry.amount),
      paymentMethod: entry.paymentMethod?.toLowerCase().replace(' ', '_') || 'cash',
      studentId: entry.studentId || null
    });

    if (!res.success) {
      alert(res.message || 'Error updating income');
      return;
    }
    
    setIncomeEntries(prev => prev.map(e => 
      e.id === entry.id ? { ...e, ...entry, amount: Number(entry.amount) } : e
    ));
    setEditingIncome(null);
    logAction('EDIT', 'INCOME', `Updated ${entry.category}: ${entry.description} - ${formatCurrency(entry.amount)} (Receipt: ${entry.receiptNo})`);
  };

  const updateExpense = async () => {
    const entry = editExpenseRef.current;
    
    if (!entry.amount || !entry.description) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Find category ID from API categories
    const category = apiExpenseCategories.find(c => c.name === entry.category);
    
    // Call API to update
    const res = await api.put(`/expenses/${entry.id}`, {
      date: entry.date,
      categoryId: category?.id || entry.categoryId,
      description: entry.description,
      amount: Number(entry.amount)
    });

    if (!res.success) {
      alert(res.message || 'Error updating expense');
      return;
    }
    
    setExpenseEntries(prev => prev.map(e => 
      e.id === entry.id ? { ...e, ...entry, amount: Number(entry.amount) } : e
    ));
    setEditingExpense(null);
    logAction('EDIT', 'EXPENSE', `Updated ${entry.category}: ${entry.description} - ${formatCurrency(entry.amount)}`);
  };

  const deleteIncome = async (id) => {
    if (!confirm('Are you sure you want to void this income entry?')) {
      return;
    }
    
    const deletedEntry = incomeEntries.find(e => e.id === id);
    
    // Call API to void
    const res = await api.post(`/income/${id}/void`, {});
    if (!res.success) {
      alert(res.message || 'Error voiding income');
      return;
    }
    
    setIncomeEntries(prev => prev.filter(e => e.id !== id));
    logAction('DELETE', 'INCOME', `Voided ${deletedEntry?.category}: ${deletedEntry?.description} - ${formatCurrency(deletedEntry?.amount)} (Receipt: ${deletedEntry?.receiptNo})`);
  };

  const deleteExpense = async (id) => {
    if (!confirm('Are you sure you want to void this expense entry?')) {
      return;
    }
    
    const deletedEntry = expenseEntries.find(e => e.id === id);
    
    // Call API to void
    const res = await api.post(`/expenses/${id}/void`, {});
    if (!res.success) {
      alert(res.message || 'Error voiding expense');
      return;
    }
    
    setExpenseEntries(prev => prev.filter(e => e.id !== id));
    logAction('DELETE', 'EXPENSE', `Voided ${deletedEntry?.category}: ${deletedEntry?.description} - ${formatCurrency(deletedEntry?.amount)}`);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG').format(amount) + ' UGX';
  };


  const printReceipt = (entry) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200]
    });
  
    let yPos = 10;
  
    // School Logo
    if (schoolLogo) {
      try {
        doc.addImage(schoolLogo, 'PNG', 25, yPos, 30, 30);
        yPos += 35;
      } catch (error) {
        console.error('Error adding logo:', error);
      }
    }
  
    // School Name - Dark blue
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    // Split school name into lines if too long
    const nameLines = doc.splitTextToSize(schoolName, 70);
    nameLines.forEach(line => {
      doc.text(line, 40, yPos, { align: 'center' });
      yPos += 5;
    });
    yPos += 1;
  
    // Contact Information
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Namasuba Kikajjo, Kampala, Uganda', 40, yPos, { align: 'center' });
    yPos += 3.5;
    doc.text('Tel: 0200 939 322 | P.O Box 600819', 40, yPos, { align: 'center' });
    yPos += 6;
  
    // Receipt Title Banner - smaller
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(8, yPos - 2, 64, 7, 1.5, 1.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PAYMENT RECEIPT', 40, yPos + 2.5, { align: 'center' });
    yPos += 9;
  
    // Main content card - compact
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(5, yPos, 70, 85, 1.5, 1.5, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.roundedRect(5, yPos, 70, 85, 1.5, 1.5, 'S');
    
    yPos += 5;
  
    // Receipt Details with alternating colors
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
  
    // Receipt Number - Light purple background
    doc.setFillColor(243, 232, 255);
    doc.rect(8, yPos - 1, 64, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text('Receipt No:', 10, yPos + 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(entry.receiptNo, 68, yPos + 3, { align: 'right' });
    yPos += 6;
  
    // Date - Light blue background
    doc.setFillColor(219, 234, 254);
    doc.rect(8, yPos - 1, 64, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Date:', 10, yPos + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const formattedDate = new Date(entry.date).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    doc.text(formattedDate, 68, yPos + 3, { align: 'right' });
    yPos += 6;
  
    // Student Name (if exists) - Light pink background
    if (entry.studentName) {
      doc.setFillColor(254, 226, 226);
      doc.rect(8, yPos - 1, 64, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('Student:', 10, yPos + 3);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(entry.studentName, 68, yPos + 3, { align: 'right' });
      yPos += 6;
    }
  
    // Category - Light green background
    doc.setFillColor(220, 252, 231);
    doc.rect(8, yPos - 1, 64, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('Category:', 10, yPos + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(entry.category, 68, yPos + 3, { align: 'right' });
    yPos += 6;
  
    // Payment Method - Light orange background
    doc.setFillColor(255, 237, 213);
    doc.rect(8, yPos - 1, 64, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text('Payment:', 10, yPos + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(entry.paymentMethod, 68, yPos + 3, { align: 'right' });
    yPos += 6;
  
    // Balance - Light yellow background
    doc.setFillColor(254, 249, 195);
    doc.rect(8, yPos - 1, 64, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(161, 98, 7);
    doc.text('Balance:', 10, yPos + 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    if (entry.balance !== undefined && entry.balance !== null) {
      doc.text(formatCurrency(entry.balance), 68, yPos + 3, { align: 'right' });
    } else {
      // Draw a line for manual writing if no balance
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(35, yPos + 3.5, 68, yPos + 3.5);
    }
    yPos += 8;
  
    // Description Box - compact
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.roundedRect(8, yPos, 64, 15, 1, 1, 'S');
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(8, yPos, 64, 15, 1, 1, 'F');
    doc.setDrawColor(150, 150, 150);
    doc.roundedRect(8, yPos, 64, 15, 1, 1, 'S');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text('Description:', 10, yPos + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(7);
    const splitDescription = doc.splitTextToSize(entry.description, 60);
    doc.text(splitDescription, 10, yPos + 7);
    yPos += 20;
  
    // Thin divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(8, yPos, 72, yPos);
    yPos += 6;
  
    // Amount Section - Compact green box
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(8, yPos - 2, 64, 15, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('AMOUNT PAID', 40, yPos + 3, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(entry.amount), 40, yPos + 10, { align: 'center' });
    yPos += 20;
  
    // Thin divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(8, yPos, 72, yPos);
    yPos += 5;
  
    // Thank you message - compact
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Thank you for your payment!', 40, yPos, { align: 'center' });
    yPos += 4;
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Keep this receipt for your records', 40, yPos, { align: 'center' });
    yPos += 7;
  
    // Footer information - compact
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(8, yPos, 64, 13, 1.5, 1.5, 'F');
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Received By:', 40, yPos + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(user.name, 40, yPos + 8, { align: 'center' });
    
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Printed: ${timestamp}`, 40, yPos + 11, { align: 'center' });
    yPos += 15;
  
    // Decorative barcode footer - smaller
    doc.setDrawColor(75, 85, 99);
    doc.setLineWidth(0.4);
    for (let i = 0; i < 14; i++) {
      const height = i % 3 === 0 ? 2.5 : 1.5;
      doc.line(12 + (i * 4), yPos, 12 + (i * 4), yPos + height);
    }
  
    // Auto print
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };
  
  const filterIncomeEntries = () => {
    return incomeEntries.filter(entry => {
      const matchesSearch = entry.description.toLowerCase().includes(incomeSearchTerm.toLowerCase()) ||
                           entry.receiptNo.toLowerCase().includes(incomeSearchTerm.toLowerCase()) ||
                           (entry.studentName && entry.studentName.toLowerCase().includes(incomeSearchTerm.toLowerCase()));
      const matchesCategory = incomeFilterCategory === 'All' || entry.category === incomeFilterCategory;
      const matchesDate = !incomeDateFilter || entry.date === incomeDateFilter;
      return matchesSearch && matchesCategory && matchesDate;
    });
  };
  
  const filterExpenseEntries = () => {
    return expenseEntries.filter(entry => {
      const matchesSearch = entry.description.toLowerCase().includes(expenseSearchTerm.toLowerCase());
      const matchesCategory = expenseFilterCategory === 'All' || entry.category === expenseFilterCategory;
      const matchesDate = !expenseDateFilter || entry.date === expenseDateFilter;
      return matchesSearch && matchesCategory && matchesDate;
    });
  };


 const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const response = await fetch('https://qm-financemanagement-production.up.railway.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: loginUsername.toLowerCase(), 
          password: loginPassword 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('qm_access_token', data.data.tokens.accessToken);
        localStorage.setItem('qm_refresh_token', data.data.tokens.refreshToken);
        
        const userData = {
          id: data.data.user.id,
          username: data.data.user.username,
          name: data.data.user.fullName,
          role: data.data.user.role,
          permissions: data.data.user.permissions
        };
        
        localStorage.setItem('qm_current_user', JSON.stringify(userData));
        setCurrentUser(userData);
        setUser({ name: userData.name, role: userData.role });
        setIsAuthenticated(true);
        
       if (data.data.school) {
          setSchoolName(data.data.school.name);
        }
        
        // Load data from API after successful login
        await loadCategoriesFromAPI();
        await loadIncomeFromAPI();
        await loadExpensesFromAPI();
      } else {
        setLoginError(data.message || 'Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Unable to connect to server. Please try again.');
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setUser({ name: 'Ms. SHADIA', role: 'Bursar' });
      localStorage.removeItem('qm_current_user');
      setCurrentView('dashboard');
    }
  };

  if (!isAuthenticated) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6 text-center">
          {schoolLogo ? (
            <img src={schoolLogo} alt="School Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-24 h-24 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Receipt className="w-12 h-12 text-blue-600" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{schoolName}</h1>
          <p className="text-gray-600">Financial Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Welcome Back</h2>
          <p className="text-center text-gray-600 mb-6">Sign in to continue</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && loginUsername && loginPassword) {
                      handleLogin(e);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && loginUsername && loginPassword) {
                      handleLogin(e);
                    }
                  }}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={(e) => {
                e.preventDefault();
                if (!loginUsername || !loginPassword) {
                  setLoginError('Please enter both username and password');
                  return;
                }
                handleLogin(e);
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Sign In
            </button>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs font-bold text-yellow-800 mb-2">Debug Tools</p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const users = [
                    {
                      id: 1,
                      username: 'shadia',
                      password: 'shadia123',
                      name: 'Ms. SHADIA',
                      role: 'Bursar',
                      canEdit: true,
                      canView: true
                    }
                  ];
                  localStorage.setItem('qm_users', JSON.stringify(users));
                  alert('Users created! Now enter: shadia / shadia123');
                }}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded text-xs"
              >
                HELLO ADMINISTRATOR
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-gray-600 font-semibold mb-2">Do not delete entries.</p>
              <p className="text-xs text-gray-700">Madam <span className="font-mono font-bold">Shadia</span></p>
              <p className="text-xs text-gray-700">owulidde? <span className="font-mono font-bold"></span></p>
            </div>
          </div>
        </div>

        <p className="text-center text-white text-sm mt-6 opacity-80">
          © 2025 {schoolName}
        </p>
      </div>
    </div>
  );
}

  const Dashboard = () => {
    const totalIncome = calculateTotals(incomeEntries.filter(e => e.category !== 'Old Balance'));
    const totalExpense = calculateTotals(expenseEntries);
    const oldBalance = getOldBalance();
    const netAmount = totalIncome - totalExpense + oldBalance;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Today's Income</h3>
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(getTodayIncome())}</p>
            <p className="text-xs opacity-75 mt-2">{incomeEntries.filter(e => e.date === selectedDate && e.category !== 'Old Balance').length} transactions</p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Today's Expenses</h3>
              <DollarSign className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(getTodayExpense())}</p>
            <p className="text-xs opacity-75 mt-2">{expenseEntries.filter(e => e.date === selectedDate).length} transactions</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Net Amount</h3>
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(getTodayNet())}</p>
            <p className="text-xs opacity-75 mt-2">After expenses</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Total Balance</h3>
              <Receipt className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(netAmount)}</p>
            <p className="text-xs opacity-75 mt-2">Overall balance</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Recent Transactions</h3>
            <button
              onClick={clearAllData}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Data
            </button>
          </div>
          <div className="space-y-3">
            {[...incomeEntries, ...expenseEntries]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 10)
              .map((entry, index) => (
                <div key={`${entry.id}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.receiptNo ? 'bg-green-100' : 'bg-red-100'}`}>
                      {entry.receiptNo ? <TrendingUp className="w-5 h-5 text-green-600" /> : <DollarSign className="w-5 h-5 text-red-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{entry.description}</p>
                      <p className="text-xs text-gray-500">{entry.date} • {entry.category}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${entry.receiptNo ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.receiptNo ? '+' : '-'}{formatCurrency(entry.amount)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  const IncomeManagement = () => {
    const form = incomeFormRef.current;
    const filteredIncome = filterIncomeEntries();
    
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Income Management</h2>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Income</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                key="income-date"
                type="date"
                defaultValue={form.date}
                onChange={(e) => {
                  incomeFormRef.current.date = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                key="income-category"
                defaultValue={form.category}
                onChange={(e) => {
                  incomeFormRef.current.category = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {incomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student Name (Optional)</label>
              <input
                key="income-student"
                type="text"
                defaultValue={form.studentName}
                onChange={(e) => {
                  incomeFormRef.current.studentName = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter student name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                key="income-payment"
                defaultValue={form.paymentMethod}
                onChange={(e) => {
                  incomeFormRef.current.paymentMethod = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <input
                key="income-desc"
                type="text"
                defaultValue={form.description}
                onChange={(e) => {
                  incomeFormRef.current.description = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (UGX) *</label>
              <input
                key="income-amount"
                type="number"
                defaultValue={form.amount}
                onChange={(e) => {
                  incomeFormRef.current.amount = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter amount"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addIncome}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Income
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Income Records ({filteredIncome.length})</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by description, receipt, or student..."
                value={incomeSearchTerm}
                onChange={(e) => setIncomeSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <select
              value={incomeFilterCategory}
              onChange={(e) => setIncomeFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {incomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <div className="relative">
              <input
                type="date"
                value={incomeDateFilter}
                onChange={(e) => setIncomeDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {incomeDateFilter && (
                <button
                  onClick={() => setIncomeDateFilter('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Receipt No</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncome.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">No income records found</td>
                  </tr>
                ) : (
                  filteredIncome.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium">{entry.receiptNo}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{entry.date}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{entry.category}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{entry.description}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{entry.paymentMethod}</td>
                      <td className="py-3 px-4 text-sm text-green-600 font-semibold text-right">{formatCurrency(entry.amount)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => printReceipt(entry)}
                            className="text-purple-600 hover:text-purple-700"
                            title="Print Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              editIncomeRef.current = { ...entry };
                              setEditingIncome(entry);
                            }}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteIncome(entry.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editingIncome && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Income Entry</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    defaultValue={editingIncome.date}
                    onChange={(e) => {
                      editIncomeRef.current.date = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    defaultValue={editingIncome.category}
                    onChange={(e) => {
                      editIncomeRef.current.category = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {incomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student Name</label>
                  <input
                    type="text"
                    defaultValue={editingIncome.studentName || ''}
                    onChange={(e) => {
                      editIncomeRef.current.studentName = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    defaultValue={editingIncome.paymentMethod}
                    onChange={(e) => {
                      editIncomeRef.current.paymentMethod = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    defaultValue={editingIncome.description}
                    onChange={(e) => {
                      editIncomeRef.current.description = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (UGX)</label>
                  <input
                    type="number"
                    defaultValue={editingIncome.amount}
                    onChange={(e) => {
                      editIncomeRef.current.amount = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={updateIncome}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingIncome(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ExpenseManagement = () => {
    const form = expenseFormRef.current;
    const filteredExpenses = filterExpenseEntries();
    
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Expense Management</h2>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Expense</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                key="expense-date"
                type="date"
                defaultValue={form.date}
                onChange={(e) => {
                  expenseFormRef.current.date = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                key="expense-category"
                defaultValue={form.category}
                onChange={(e) => {
                  expenseFormRef.current.category = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <input
                key="expense-desc"
                type="text"
                defaultValue={form.description}
                onChange={(e) => {
                  expenseFormRef.current.description = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (UGX) *</label>
              <input
                key="expense-amount"
                type="number"
                defaultValue={form.amount}
                onChange={(e) => {
                  expenseFormRef.current.amount = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter amount"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addExpense}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Expense
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Expense Records ({filteredExpenses.length})</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by description..."
                value={expenseSearchTerm}
                onChange={(e) => setExpenseSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <select
              value={expenseFilterCategory}
              onChange={(e) => setExpenseFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <div className="relative">
              <input
                type="date"
                value={expenseDateFilter}
                onChange={(e) => setExpenseDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {expenseDateFilter && (
                <button
                  onClick={() => setExpenseDateFilter('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">No expense records found</td>
                  </tr>
                ) : (
                  filteredExpenses.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">{entry.date}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{entry.category}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{entry.description}</td>
                      <td className="py-3 px-4 text-sm text-red-600 font-semibold text-right">{formatCurrency(entry.amount)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              editExpenseRef.current = { ...entry };
                              setEditingExpense(entry);
                            }}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteExpense(entry.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editingExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Expense Entry</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    defaultValue={editingExpense.date}
                    onChange={(e) => {
                      editExpenseRef.current.date = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    defaultValue={editingExpense.category}
                    onChange={(e) => {
                      editExpenseRef.current.category = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    defaultValue={editingExpense.description}
                    onChange={(e) => {
                      editExpenseRef.current.description = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (UGX)</label>
                  <input
                    type="number"
                    defaultValue={editingExpense.amount}
                    onChange={(e) => {
                      editExpenseRef.current.amount = e.target.value;
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={updateExpense}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  const Reports = () => {
    const [reportType, setReportType] = useState('daily');
    const [categoryReportType, setCategoryReportType] = useState('income');
    const oldBalance = getOldBalance();
    
    const getReportData = () => {
      let filteredIncome = incomeEntries.filter(e => e.category !== 'Old Balance');
      let filteredExpenses = expenseEntries;
      let reportTitle = '';
      let dateRange = '';
      
      if (reportType === 'daily') {
        filteredIncome = filteredIncome.filter(e => e.date === selectedDate);
        filteredExpenses = filteredExpenses.filter(e => e.date === selectedDate);
        reportTitle = 'DAILY FINANCIAL REPORT';
        dateRange = selectedDate;
      } else if (reportType === 'monthly') {
        const month = selectedDate.substring(0, 7);
        filteredIncome = filteredIncome.filter(e => e.date.startsWith(month));
        filteredExpenses = filteredExpenses.filter(e => e.date.startsWith(month));
        reportTitle = 'MONTHLY FINANCIAL REPORT';
        dateRange = month;
      } else if (reportType === 'range') {
        filteredIncome = filteredIncome.filter(e => e.date >= startDate && e.date <= endDate);
        filteredExpenses = filteredExpenses.filter(e => e.date >= startDate && e.date <= endDate);
        reportTitle = 'DATE RANGE FINANCIAL REPORT';
        dateRange = `${startDate} to ${endDate}`;
      } else if (reportType === 'category') {
        filteredIncome = filteredIncome.filter(e => e.date >= startDate && e.date <= endDate);
        filteredExpenses = filteredExpenses.filter(e => e.date >= startDate && e.date <= endDate);
        reportTitle = 'CATEGORY-WISE FINANCIAL REPORT';
        dateRange = `${startDate} to ${endDate}`;
      }
      
      return { filteredIncome, filteredExpenses, reportTitle, dateRange };
    };

    const getCategoryBreakdown = () => {
      const { filteredIncome, filteredExpenses } = getReportData();
      
      if (categoryReportType === 'income') {
        const breakdown = {};
        filteredIncome.forEach(entry => {
          if (!breakdown[entry.category]) {
            breakdown[entry.category] = { count: 0, total: 0 };
          }
          breakdown[entry.category].count++;
          breakdown[entry.category].total += Number(entry.amount);
        });
        return breakdown;
      } else {
        const breakdown = {};
        filteredExpenses.forEach(entry => {
          if (!breakdown[entry.category]) {
            breakdown[entry.category] = { count: 0, total: 0 };
          }
          breakdown[entry.category].count++;
          breakdown[entry.category].total += Number(entry.amount);
        });
        return breakdown;
      }
    };
    
    const generatePDF = () => {
      try {
        const { filteredIncome, filteredExpenses, reportTitle, dateRange } = getReportData();
        const doc = new jsPDF();
        
        if (typeof doc.autoTable !== 'function') {
          alert('PDF library not loaded correctly. Please refresh the page and try again.');
          return;
        }
        
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, 210, 45, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(schoolName, 105, 15, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text(reportTitle, 105, 25, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${dateRange}`, 105, 32, { align: 'center' });
        doc.text(`To: Directors and Deputy Headteacher`, 105, 37, { align: 'center' });
        doc.text(`From: ${user.name}, School ${user.role}`, 105, 42, { align: 'center' });
        
        let yPos = 55;
        
        if (reportType === 'category') {
          const breakdown = getCategoryBreakdown();
          const categories = Object.keys(breakdown).sort();
          
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(categoryReportType === 'income' ? [34, 197, 94] : [239, 68, 68]);
          doc.rect(14, yPos - 5, 182, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(`${categoryReportType === 'income' ? 'Income' : 'Expense'} by Category`, 16, yPos);
          yPos += 10;
          
          const categoryData = categories.map(cat => [
            cat,
            breakdown[cat].count,
            formatCurrency(breakdown[cat].total)
          ]);
          
          const totalAmount = categories.reduce((sum, cat) => sum + breakdown[cat].total, 0);
          
          doc.autoTable({
            startY: yPos,
            head: [['Category', 'Count', 'Total Amount']],
            body: categoryData,
            foot: [['TOTAL', '', formatCurrency(totalAmount)]],
            theme: 'grid',
            headStyles: { 
              fillColor: categoryReportType === 'income' ? [219, 234, 254] : [254, 226, 226],
              textColor: categoryReportType === 'income' ? [30, 64, 175] : [153, 27, 27],
              fontStyle: 'bold'
            },
            footStyles: { 
              fillColor: categoryReportType === 'income' ? [34, 197, 94] : [239, 68, 68],
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            margin: { left: 14, right: 14 }
          });
        } else {
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(59, 130, 246);
          doc.rect(14, yPos - 5, 182, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text('1. Income Collected', 16, yPos);
          yPos += 10;
          
          const incomeData = [
            ['Old Balance', formatCurrency(oldBalance)],
            ...filteredIncome.map(e => [e.description, formatCurrency(e.amount)]),
          ];
          
          doc.autoTable({
            startY: yPos,
            head: [['Item', 'Amount (UGX)']],
            body: incomeData,
            foot: [['TOTAL COLLECTIONS', formatCurrency(calculateTotals(filteredIncome))]],
            theme: 'grid',
            headStyles: { 
              fillColor: [219, 234, 254],
              textColor: [30, 64, 175],
              fontStyle: 'bold',
              halign: 'left'
            },
            footStyles: { 
              fillColor: [34, 197, 94],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              halign: 'right'
            },
            bodyStyles: {
              textColor: [0, 0, 0]
            },
            columnStyles: {
              0: { halign: 'left' },
              1: { halign: 'right' }
            },
            margin: { left: 14, right: 14 }
          });
          
          yPos = doc.lastAutoTable.finalY + 15;
          
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(239, 68, 68);
          doc.rect(14, yPos - 5, 182, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text('2. Expenses Incurred', 16, yPos);
          yPos += 10;
          
          const expenseData = filteredExpenses.length > 0 
            ? filteredExpenses.map(e => [e.description, formatCurrency(e.amount)])
            : [['No expenses recorded', '0 UGX']];
          
          doc.autoTable({
            startY: yPos,
            head: [['Expense Description', 'Amount (UGX)']],
            body: expenseData,
            foot: [['TOTAL EXPENSES', formatCurrency(calculateTotals(filteredExpenses))]],
            theme: 'grid',
            headStyles: { 
              fillColor: [254, 226, 226],
              textColor: [153, 27, 27],
              fontStyle: 'bold',
              halign: 'left'
            },
            footStyles: { 
              fillColor: [239, 68, 68],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              halign: 'right'
            },
            bodyStyles: {
              textColor: [0, 0, 0]
            },
            columnStyles: {
              0: { halign: 'left' },
              1: { halign: 'right' }
            },
            margin: { left: 14, right: 14 }
          });
          
          yPos = doc.lastAutoTable.finalY + 15;
          
          doc.setFillColor(219, 234, 254);
          doc.rect(14, yPos - 5, 182, 40, 'F');
          
          doc.setTextColor(30, 64, 175);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('3. Summary', 20, yPos);
          yPos += 10;
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const totalIncome = calculateTotals(filteredIncome);
          const totalExpense = calculateTotals(filteredExpenses);
          const netAmount = totalIncome - totalExpense;
          
          doc.text(`Total Collected:`, 20, yPos);
          doc.text(formatCurrency(totalIncome), 180, yPos, { align: 'right' });
          yPos += 7;
          
          doc.text(`Less Expenses:`, 20, yPos);
          doc.text(formatCurrency(totalExpense), 180, yPos, { align: 'right' });
          yPos += 10;
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(`Net Amount:`, 20, yPos);
          doc.text(formatCurrency(netAmount), 180, yPos, { align: 'right' });
        }
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Prepared by: ${user.name}`, 105, 280, { align: 'center' });
        doc.text(schoolName, 105, 285, { align: 'center' });
        
        const fileName = `${schoolName.replace(/\s+/g, '_')}_Report_${dateRange.replace(/\s+/g, '_').replace(/\//g, '-')}.pdf`;
        doc.save(fileName);
        alert('PDF downloaded successfully!');
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF: ' + error.message);
      }
    };
    
    const exportToExcel = async () => {
      try {
        const XLSX = await import('xlsx');
        const { filteredIncome, filteredExpenses, reportTitle, dateRange } = getReportData();
        
        const wb = XLSX.utils.book_new();
        
        if (reportType === 'category') {
          const breakdown = getCategoryBreakdown();
          const categories = Object.keys(breakdown).sort();
          
          const categoryData = [
            [schoolName],
            [reportTitle],
            [`Date: ${dateRange}`],
            [],
            [`${categoryReportType === 'income' ? 'INCOME' : 'EXPENSE'} BY CATEGORY`],
            ['Category', 'Count', 'Total Amount (UGX)'],
            ...categories.map(cat => [cat, breakdown[cat].count, breakdown[cat].total]),
            [],
            ['TOTAL', '', categories.reduce((sum, cat) => sum + breakdown[cat].total, 0)]
          ];
          
          const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
          XLSX.utils.book_append_sheet(wb, categorySheet, 'Category Report');
        } else {
          const incomeData = [
            [schoolName],
            [reportTitle],
            [`Date: ${dateRange}`],
            [],
            ['INCOME RECORDS'],
            ['Receipt No', 'Date', 'Category', 'Description', 'Payment Method', 'Amount (UGX)'],
            ...filteredIncome.map(e => [e.receiptNo, e.date, e.category, e.description, e.paymentMethod, e.amount]),
            [],
            ['', '', '', '', 'TOTAL:', calculateTotals(filteredIncome)]
          ];
          
          const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);
          XLSX.utils.book_append_sheet(wb, incomeSheet, 'Income');
          
          const expenseData = [
            [schoolName],
            [reportTitle],
            [`Date: ${dateRange}`],
            [],
            ['EXPENSE RECORDS'],
            ['Date', 'Category', 'Description', 'Amount (UGX)'],
            ...(filteredExpenses.length > 0 
              ? filteredExpenses.map(e => [e.date, e.category, e.description, e.amount])
              : [['No expenses', '', '', 0]]
            ),
            [],
            ['', '', 'TOTAL:', calculateTotals(filteredExpenses)]
          ];
          
          const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
          XLSX.utils.book_append_sheet(wb, expenseSheet, 'Expenses');
          
          const totalIncome = calculateTotals(filteredIncome);
          const totalExpense = calculateTotals(filteredExpenses);
          const summaryData = [
            [schoolName],
            ['FINANCIAL SUMMARY'],
            [`Period: ${dateRange}`],
            [],
            ['Old Balance', oldBalance],
            ['Total Income Collected', totalIncome],
            ['Total Expenses', totalExpense],
            ['Net Amount', totalIncome - totalExpense],
            ['Total Balance', totalIncome - totalExpense + oldBalance]
          ];
          
          const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
        }
        
        const fileName = `${schoolName.replace(/\s+/g, '_')}_Report_${dateRange.replace(/\s+/g, '_').replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        alert('Excel file downloaded successfully!');
      } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Error exporting to Excel: ' + error.message);
      }
    };
    
    const printReport = () => {
      window.print();
    };
    
    const shareViaWhatsApp = () => {
      const { filteredIncome, filteredExpenses, reportTitle, dateRange } = getReportData();
      const totalIncome = calculateTotals(filteredIncome);
      const totalExpense = calculateTotals(filteredExpenses);
      const netAmount = totalIncome - totalExpense;
      
      let message = `*${schoolName}*\n${reportTitle}\nDate: ${dateRange}\n\n`;
      
      if (reportType === 'category') {
        const breakdown = getCategoryBreakdown();
        const categories = Object.keys(breakdown).sort();
        message += `*${categoryReportType === 'income' ? 'INCOME' : 'EXPENSE'} BY CATEGORY*\n`;
        categories.forEach(cat => {
          message += `${cat}: ${formatCurrency(breakdown[cat].total)} (${breakdown[cat].count} entries)\n`;
        });
        const total = categories.reduce((sum, cat) => sum + breakdown[cat].total, 0);
        message += `*Total:* ${formatCurrency(total)}`;
      } else {
        message += `*INCOME COLLECTED*\nOld Balance: ${formatCurrency(oldBalance)}\n`;
        message += `${filteredIncome.map(e => `${e.description}: ${formatCurrency(e.amount)}`).join('\n')}\n`;
        message += `*Total Income:* ${formatCurrency(totalIncome)}\n\n`;
        message += `*EXPENSES INCURRED*\n`;
        message += `${filteredExpenses.length > 0 ? filteredExpenses.map(e => `${e.description}: ${formatCurrency(e.amount)}`).join('\n') : 'No expenses recorded'}\n`;
        message += `*Total Expenses:* ${formatCurrency(totalExpense)}\n\n`;
        message += `*SUMMARY*\nTotal Collected: ${formatCurrency(totalIncome)}\n`;
        message += `Less Expenses: ${formatCurrency(totalExpense)}\n*Net Amount:* ${formatCurrency(netAmount)}`;
      }
      
      message += `\n\nPrepared by: ${user.name}`;
      
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    };
    
    const shareViaEmail = () => {
      const { filteredIncome, filteredExpenses, reportTitle, dateRange } = getReportData();
      const totalIncome = calculateTotals(filteredIncome);
      const totalExpense = calculateTotals(filteredExpenses);
      const netAmount = totalIncome - totalExpense;
      
      const subject = `${reportTitle} - ${dateRange}`;
      let body = `${schoolName}\n${reportTitle}\nDate: ${dateRange}\n\n`;
      
      if (reportType === 'category') {
        const breakdown = getCategoryBreakdown();
        const categories = Object.keys(breakdown).sort();
        body += `${categoryReportType === 'income' ? 'INCOME' : 'EXPENSE'} BY CATEGORY\n`;
        categories.forEach(cat => {
          body += `${cat}: ${formatCurrency(breakdown[cat].total)} (${breakdown[cat].count} entries)\n`;
        });
        const total = categories.reduce((sum, cat) => sum + breakdown[cat].total, 0);
        body += `Total: ${formatCurrency(total)}`;
      } else {
        body += `INCOME COLLECTED\nOld Balance: ${formatCurrency(oldBalance)}\n`;
        body += `${filteredIncome.map(e => `${e.description}: ${formatCurrency(e.amount)}`).join('\n')}\n`;
        body += `Total Income: ${formatCurrency(totalIncome)}\n\n`;
        body += `EXPENSES INCURRED\n`;
        body += `${filteredExpenses.length > 0 ? filteredExpenses.map(e => `${e.description}: ${formatCurrency(e.amount)}`).join('\n') : 'No expenses recorded'}\n`;
        body += `Total Expenses: ${formatCurrency(totalExpense)}\n\n`;
        body += `SUMMARY\nTotal Collected: ${formatCurrency(totalIncome)}\n`;
        body += `Less Expenses: ${formatCurrency(totalExpense)}\nNet Amount: ${formatCurrency(netAmount)}`;
      }
      
      body += `\n\nPrepared by: ${user.name}`;
      
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const { filteredIncome, filteredExpenses } = getReportData();
    const displayTotalIncome = calculateTotals(filteredIncome);
    const displayTotalExpense = calculateTotals(filteredExpenses);
    const categoryBreakdown = reportType === 'category' ? getCategoryBreakdown() : null;

    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Reports</h2>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Generate Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily Report</option>
                <option value="monthly">Monthly Report</option>
                <option value="range">Date Range Report</option>
                <option value="category">Category Report</option>
              </select>
            </div>
            
            {reportType === 'daily' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div></div>
                <div></div>
              </>
            )}
            
            {(reportType === 'range' || reportType === 'category') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {reportType === 'category' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category Type</label>
                    <select
                      value={categoryReportType}
                      onChange={(e) => setCategoryReportType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="income">Income Categories</option>
                      <option value="expense">Expense Categories</option>
                    </select>
                  </div>
                )}
              </>
            )}
            
            {reportType === 'monthly' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                  <input
                    type="month"
                    value={selectedDate.substring(0, 7)}
                    onChange={(e) => setSelectedDate(e.target.value + '-01')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div></div>
                <div></div>
              </>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={generatePDF}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              PDF
            </button>
            <button 
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Excel
            </button>
            <button 
              onClick={printReport}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
            <button 
              onClick={shareViaWhatsApp}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              WhatsApp
            </button>
            <button 
              onClick={shareViaEmail}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <Mail className="w-5 h-5" />
              Email
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 print:shadow-none" id="reportContent">
          <div className="text-center mb-6 bg-blue-900 text-white p-6 rounded-lg print:bg-blue-900">
            {schoolLogo && (
              <div className="flex justify-center mb-4">
                <img src={schoolLogo} alt="School Logo" className="w-20 h-20 object-contain rounded-full bg-white p-2" />
              </div>
            )}
            <h1 className="text-2xl font-bold">{schoolName}</h1>
            <h2 className="text-xl font-bold mt-2">
              {reportType === 'daily' ? 'DAILY' : reportType === 'monthly' ? 'MONTHLY' : reportType === 'category' ? 'CATEGORY-WISE' : 'DATE RANGE'} FINANCIAL REPORT
            </h2>
            <p className="mt-2 text-sm">
              Date: {reportType === 'range' || reportType === 'category' ? `${startDate} to ${endDate}` : reportType === 'monthly' ? selectedDate.substring(0, 7) : selectedDate}
            </p>
            <p className="text-sm">To: Directors and Deputy Headteacher</p>
            <p className="text-sm">From: {user.name}, School {user.role}</p>
          </div>

          {reportType === 'category' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-blue-800 p-3 rounded-t-lg">
                  {categoryReportType === 'income' ? 'Income' : 'Expense'} by Category
                </h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="border border-gray-300 text-left py-2 px-4 text-sm font-semibold text-gray-700">Category</th>
                      <th className="border border-gray-300 text-center py-2 px-4 text-sm font-semibold text-gray-700">Count</th>
                      <th className="border border-gray-300 text-right py-2 px-4 text-sm font-semibold text-gray-700">Total Amount (UGX)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(categoryBreakdown).sort().map(category => (
                      <tr key={category}>
                        <td className="border border-gray-300 py-2 px-4 text-sm">{category}</td>
                        <td className="border border-gray-300 py-2 px-4 text-sm text-center">{categoryBreakdown[category].count}</td>
                        <td className="border border-gray-300 py-2 px-4 text-sm text-right font-semibold">
                          {formatCurrency(categoryBreakdown[category].total)}
                        </td>
                      </tr>
                    ))}
                    <tr className={`${categoryReportType === 'income' ? 'bg-green-100' : 'bg-red-100'} font-bold`}>
                      <td className="border border-gray-300 py-2 px-4 text-sm">TOTAL</td>
                      <td className="border border-gray-300 py-2 px-4 text-sm text-center">
                        {Object.values(categoryBreakdown).reduce((sum, item) => sum + item.count, 0)}
                      </td>
                      <td className={`border border-gray-300 py-2 px-4 text-sm text-right ${categoryReportType === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(Object.values(categoryBreakdown).reduce((sum, item) => sum + item.total, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white bg-blue-600 p-3 rounded-t-lg">1. Income Collected</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="border border-gray-300 text-left py-2 px-4 text-sm font-semibold text-gray-700">Item</th>
                      <th className="border border-gray-300 text-right py-2 px-4 text-sm font-semibold text-gray-700">Amount (UGX)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 py-2 px-4 text-sm">Old Balance</td>
                      <td className="border border-gray-300 py-2 px-4 text-sm text-right">{formatCurrency(oldBalance)}</td>
                    </tr>
                    {filteredIncome.map((entry, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 py-2 px-4 text-sm">{entry.description}</td>
                        <td className="border border-gray-300 py-2 px-4 text-sm text-right">{formatCurrency(entry.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-green-100 font-bold">
                      <td className="border border-gray-300 py-2 px-4 text-sm">TOTAL COLLECTIONS</td>
                      <td className="border border-gray-300 py-2 px-4 text-sm text-right text-green-700">{formatCurrency(displayTotalIncome)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white bg-red-600 p-3 rounded-t-lg">2. Expenses Incurred</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-red-50">
                      <th className="border border-gray-300 text-left py-2 px-4 text-sm font-semibold text-gray-700">Expense Description</th>
                      <th className="border border-gray-300 text-right py-2 px-4 text-sm font-semibold text-gray-700">Amount (UGX)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length > 0 ? (
                      filteredExpenses.map((entry, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-300 py-2 px-4 text-sm">{entry.description}</td>
                          <td className="border border-gray-300 py-2 px-4 text-sm text-right">{formatCurrency(entry.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="border border-gray-300 py-2 px-4 text-sm" colSpan="2">No expenses recorded</td>
                      </tr>
                    )}
                    <tr className="bg-red-100 font-bold">
                      <td className="border border-gray-300 py-2 px-4 text-sm">TOTAL EXPENSES</td>
                      <td className="border border-gray-300 py-2 px-4 text-sm text-right text-red-700">{formatCurrency(displayTotalExpense)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-300">
                <h3 className="text-lg font-bold text-blue-900 mb-4">3. Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between pb-2 border-b border-blue-200">
                    <span className="font-medium">Total Collected:</span>
                    <span className="font-semibold text-green-700">{formatCurrency(displayTotalIncome)}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-blue-200">
                    <span className="font-medium">Less Expenses:</span>
                    <span className="font-semibold text-red-700">{formatCurrency(displayTotalExpense)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-blue-900 pt-3 border-t-2 border-blue-400">
                    <span>Net Amount:</span>
                    <span>{formatCurrency(displayTotalIncome - displayTotalExpense)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-4 border-t-2 border-gray-300 text-center text-sm text-gray-600">
            <p className="font-medium">Prepared by: {user.name}</p>
            <p className="font-bold text-gray-800 mt-1">{schoolName}</p>
          </div>
        </div>
      </div>
    );
  };

  // School Fees Collection Component
  const SchoolFeesCollection = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentBalance, setStudentBalance] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loadingStudent, setLoadingStudent] = useState(false);
    const [terms, setTerms] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);
    
    const [paymentForm, setPaymentForm] = useState({
      amount: '',
      paymentMethod: 'cash',
      termId: '',
      description: ''
    });

    useEffect(() => {
      loadTerms();
      loadRecentPayments();
    }, []);

    const loadTerms = async () => {
      const res = await api.get('/terms');
      if (res.success) {
        const data = Array.isArray(res.data) ? res.data : (res.data?.terms || []);
        setTerms(data);
        // Auto-select current term if available
        const currentTerm = data.find(t => t.isCurrent);
        if (currentTerm) {
          setPaymentForm(prev => ({ ...prev, termId: currentTerm.id }));
        }
      }
    };

    const loadRecentPayments = async () => {
      const res = await api.get('/fees/payments/recent');
      if (res.success) {
        const data = Array.isArray(res.data) ? res.data : (res.data?.payments || []);
        setRecentPayments(data);
      }
    };

    const searchStudents = async (query) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }
      
      const res = await api.get(`/students/search?q=${encodeURIComponent(query)}`);
      if (res.success) {
        const data = Array.isArray(res.data) ? res.data : (res.data?.students || []);
        setSearchResults(data);
      }
    };

    const selectStudent = async (student) => {
      setLoadingStudent(true);
      setSelectedStudent(student);
      setSearchResults([]);
      setSearchTerm(`${student.firstName} ${student.lastName}`);
      
      // Use balance from search if available, otherwise fetch
      if (student.balance) {
        setStudentBalance(student.balance);
      } else {
        const balanceRes = await api.get(`/students/${student.id}/balance`);
        if (balanceRes.success) {
          setStudentBalance(balanceRes.data);
        }
      }
      
      // Load payment history
      const historyRes = await api.get(`/students/${student.id}/payments`);
      if (historyRes.success) {
        const data = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data?.payments || []);
        setPaymentHistory(data);
      }
      
      setLoadingStudent(false);
    };

    const recordPayment = async () => {
      if (!selectedStudent) {
        alert('Please select a student first');
        return;
      }
      
      if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      const res = await api.post(`/students/${selectedStudent.id}/payments`, {
        amount: parseFloat(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        termId: paymentForm.termId || null,
        description: paymentForm.description || `School fees payment`
      });

      if (res.success) {
        alert('Payment recorded successfully!');
        
        // Calculate new balance after payment
        const previousBalance = studentBalance?.balance || 0;
        const newBalance = previousBalance - parseFloat(paymentForm.amount);
        
        // Print receipt with balance
        const receiptData = {
          id: res.data.id,
          receiptNo: res.data.receiptNumber,
          date: new Date().toISOString().split('T')[0],
          studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
          category: 'School Fees',
          description: paymentForm.description || 'School fees payment',
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod.replace('_', ' ').toUpperCase(),
          balance: newBalance > 0 ? newBalance : 0
        };
        printReceipt(receiptData);
        
        // Refresh data with updated balance
        const updatedStudent = {
          ...selectedStudent,
          balance: res.data.balance
        };
        setStudentBalance(res.data.balance);
        loadRecentPayments();
        
        // Reset form
        setPaymentForm(prev => ({
          ...prev,
          amount: '',
          description: ''
        }));
        
        logAction('ADD', 'FEE_PAYMENT', `Recorded ${formatCurrency(receiptData.amount)} for ${receiptData.studentName}`);
      } else {
        alert(res.message || 'Error recording payment');
      }
    };

    const clearSelection = () => {
      setSelectedStudent(null);
      setStudentBalance(null);
      setPaymentHistory([]);
      setSearchTerm('');
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">School Fees Collection</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Student Search & Payment Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Student Search */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">1. Select Student</h3>
              
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by student name or number..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    searchStudents(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg"
                />
                {selectedStudent && (
                  <button
                    onClick={clearSelection}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && !selectedStudent && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map(student => (
                    <div
                      key={student.id}
                      onClick={() => selectStudent(student)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">{student.firstName} {student.lastName}</p>
                          <p className="text-sm text-gray-500">{student.studentNumber} • {student.className || student.class?.name || 'N/A'}</p>
                        </div>
                        <span className="text-blue-600 font-medium">Select</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Student Info */}
              {selectedStudent && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-xl text-gray-800">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                      <p className="text-gray-600">Student No: <span className="font-medium">{selectedStudent.studentNumber}</span></p>
                      <p className="text-gray-600">Class: <span className="font-medium">{selectedStudent.class?.name || 'N/A'}</span></p>
                      {selectedStudent.guardianPhone && (
                        <p className="text-gray-600">Guardian: <span className="font-medium">{selectedStudent.guardianPhone}</span></p>
                      )}
                    </div>
                    {loadingStudent ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    ) : (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Current Balance</p>
                        <p className={`text-2xl font-bold ${(studentBalance?.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(studentBalance?.balance || 0)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(studentBalance?.balance || 0) > 0 ? 'Outstanding' : 'Cleared'}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Fees: {formatCurrency(studentBalance?.totalFees || 0)} | Paid: {formatCurrency(studentBalance?.amountPaid || 0)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Form */}
            {selectedStudent && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">2. Record Payment</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount (UGX) *</label>
                    <input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-xl font-bold"
                      placeholder="Enter amount"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      <option value="cash">Cash</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="school_pay">School Pay</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                    <select
                      value={paymentForm.termId}
                      onChange={(e) => setPaymentForm({...paymentForm, termId: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      <option value="">Select Term</option>
                      {terms.map(term => (
                        <option key={term.id} value={term.id}>
                          {term.name} {term.year} {term.isCurrent ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                    <input
                      type="text"
                      value={paymentForm.description}
                      onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                      placeholder="e.g., Term 1 partial payment"
                    />
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">Quick amounts:</p>
                  <div className="flex flex-wrap gap-2">
                    {[50000, 100000, 200000, 300000, 500000, 1000000].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setPaymentForm({...paymentForm, amount: amount.toString()})}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={recordPayment}
                  className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2"
                >
                  <Receipt className="w-6 h-6" />
                  Record Payment & Print Receipt
                </button>
              </div>
            )}

            {/* Payment History for Selected Student */}
            {selectedStudent && paymentHistory.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Payment History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Receipt</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Term</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Amount</th>
                        <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Print</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.slice(0, 10).map((payment) => (
                        <tr key={payment.id} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-sm font-medium text-blue-600">{payment.receiptNumber}</td>
                          <td className="py-2 px-3 text-sm text-gray-600">{payment.date?.split('T')[0]}</td>
                          <td className="py-2 px-3 text-sm text-gray-600">{payment.term?.name || 'N/A'}</td>
                          <td className="py-2 px-3 text-sm text-green-600 font-semibold text-right">{formatCurrency(payment.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => printReceipt({
                                receiptNo: payment.receiptNumber,
                                date: payment.date?.split('T')[0],
                                studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
                                category: 'School Fees',
                                description: payment.description || 'School fees payment',
                                amount: payment.amount,
                                paymentMethod: payment.paymentMethod?.replace('_', ' ').toUpperCase() || 'Cash'
                              })}
                              className="text-purple-600 hover:text-purple-700"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Balance Summary & Recent Payments */}
          <div className="space-y-6">
            {/* Student Balance Card */}
            {selectedStudent && studentBalance && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Fee Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-600">Total Fees:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(studentBalance.totalFees || 0)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-bold text-green-600">{formatCurrency(studentBalance.totalPaid || 0)}</span>
                  </div>
                  <div className={`flex justify-between p-3 rounded-lg border-2 ${(studentBalance.balance || 0) > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                    <span className="font-bold text-gray-800">Balance:</span>
                    <span className={`font-bold text-xl ${(studentBalance.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(studentBalance.balance || 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Payments (All Students) */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Collections</h3>
              {recentPayments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent payments</p>
              ) : (
                <div className="space-y-3">
                  {recentPayments.slice(0, 8).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">
                          {payment.student?.firstName} {payment.student?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{payment.receiptNumber}</p>
                      </div>
                      <span className="font-bold text-green-600 text-sm">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Students Management Component
  const StudentsManagement = () => {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('All');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentBalance, setStudentBalance] = useState(null);
    
    const [newStudent, setNewStudent] = useState({
      firstName: '',
      lastName: '',
      classId: '',
      gender: 'male',
      guardianName: '',
      guardianPhone: '',
      guardianEmail: '',
      address: '',
      totalFees: ''
    });
    
    const [editingStudent, setEditingStudent] = useState(null);
    const [editStudentForm, setEditStudentForm] = useState({
      firstName: '',
      lastName: '',
      classId: '',
      gender: 'male',
      guardianName: '',
      guardianPhone: '',
      guardianEmail: '',
      address: '',
      totalFees: '',
      isActive: true
    });
    
    // Promote Students States
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [promoteFromClass, setPromoteFromClass] = useState('');
    const [promoteToClass, setPromoteToClass] = useState('');
    const [studentsToPromote, setStudentsToPromote] = useState([]);
    const [selectedForPromotion, setSelectedForPromotion] = useState([]);
    const [carryForwardBalance, setCarryForwardBalance] = useState(true);
    const [newTermFees, setNewTermFees] = useState('');
    const [promotingInProgress, setPromotingInProgress] = useState(false);

    useEffect(() => {
      loadStudents();
      loadClasses();
    }, []);

    const loadStudents = async () => {
      setLoadingStudents(true);
      const res = await api.get('/students');
      if (res.success) {
        const dataArray = Array.isArray(res.data) ? res.data : (res.data?.students || res.data?.items || []);
        setStudents(dataArray);
      }
      setLoadingStudents(false);
    };

    const loadClasses = async () => {
      const res = await api.get('/students/classes');
      if (res.success) {
        const dataArray = Array.isArray(res.data) ? res.data : (res.data?.classes || []);
        setClasses(dataArray);
      }
    };

    const addStudent = async () => {
      if (!newStudent.firstName || !newStudent.lastName || !newStudent.classId) {
        alert('Please fill in First Name, Last Name, and Class');
        return;
      }

      const res = await api.post('/students', newStudent);
      if (res.success) {
        alert('Student added successfully!');
        setNewStudent({
          firstName: '',
          lastName: '',
          classId: '',
          gender: 'male',
          guardianName: '',
          guardianPhone: '',
          guardianEmail: '',
          address: '',
          totalFees: ''
        });
        setShowAddForm(false);
        loadStudents();
      } else {
        alert(res.message || 'Failed to add student');
      }
    };

    const viewStudentBalance = async (student) => {
      setSelectedStudent(student);
      const res = await api.get(`/students/${student.id}/balance`);
      if (res.success) {
        setStudentBalance(res.data);
      }
    };

    const startEditStudent = async (student) => {
      // Load student balance to get current fees
      const balanceRes = await api.get(`/students/${student.id}/balance`);
      const currentFees = balanceRes.success ? balanceRes.data.totalFees || 0 : 0;
      
      setEditStudentForm({
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        classId: student.classId || '',
        gender: student.gender || 'male',
        guardianName: student.guardianName || student.parentName || '',
        guardianPhone: student.guardianPhone || student.parentPhone || '',
        guardianEmail: student.guardianEmail || student.parentEmail || '',
        address: student.address || '',
        totalFees: currentFees.toString(),
        isActive: student.isActive !== false
      });
      setEditingStudent(student);
    };
    
    // Load students for promotion preview
    const loadStudentsForPromotion = async (classId) => {
      if (!classId) {
        setStudentsToPromote([]);
        return;
      }
      
      const res = await api.get(`/students?classId=${classId}&status=active`);
      if (res.success) {
        const data = res.data?.students || res.data || [];
        setStudentsToPromote(data);
        setSelectedForPromotion(data.map(s => s.id)); // Select all by default
      }
    };

    const handlePromoteStudents = async () => {
      if (!promoteFromClass || !promoteToClass) {
        alert('Please select both source and destination classes');
        return;
      }
      
      if (promoteFromClass === promoteToClass) {
        alert('Source and destination classes cannot be the same');
        return;
      }
      
      if (selectedForPromotion.length === 0) {
        alert('Please select at least one student to promote');
        return;
      }

      const fromClassName = classes.find(c => c.id === promoteFromClass)?.name;
      const toClassName = classes.find(c => c.id === promoteToClass)?.name;
      
      if (!confirm(`Are you sure you want to promote ${selectedForPromotion.length} students from ${fromClassName} to ${toClassName}?`)) {
        return;
      }

      setPromotingInProgress(true);
      
      const res = await api.post('/students/promote', {
        fromClassId: promoteFromClass,
        toClassId: promoteToClass,
        studentIds: selectedForPromotion,
        carryForwardBalance: carryForwardBalance,
        newTermFees: newTermFees ? parseFloat(newTermFees) : null
      });

      setPromotingInProgress(false);

      if (res.success) {
        alert(`Successfully promoted ${res.data.summary.successful} students!\n\n${res.data.summary.failed > 0 ? `Failed: ${res.data.summary.failed}` : ''}`);
        setShowPromoteModal(false);
        setPromoteFromClass('');
        setPromoteToClass('');
        setStudentsToPromote([]);
        setSelectedForPromotion([]);
        setNewTermFees('');
        loadStudents();
      } else {
        alert(res.message || 'Failed to promote students');
      }
    };

    const toggleStudentSelection = (studentId) => {
      setSelectedForPromotion(prev => 
        prev.includes(studentId) 
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      );
    };

    const toggleAllStudents = () => {
      if (selectedForPromotion.length === studentsToPromote.length) {
        setSelectedForPromotion([]);
      } else {
        setSelectedForPromotion(studentsToPromote.map(s => s.id));
      }
    };

    const updateStudent = async () => {
      if (!editStudentForm.firstName || !editStudentForm.lastName) {
        alert('Please fill in First Name and Last Name');
        return;
      }

      const res = await api.put(`/students/${editingStudent.id}`, {
        firstName: editStudentForm.firstName,
        lastName: editStudentForm.lastName,
        classId: editStudentForm.classId || null,
        gender: editStudentForm.gender,
        parentName: editStudentForm.guardianName,
        parentPhone: editStudentForm.guardianPhone,
        parentEmail: editStudentForm.guardianEmail,
        address: editStudentForm.address,
        isActive: editStudentForm.isActive,
        totalFees: editStudentForm.totalFees ? parseFloat(editStudentForm.totalFees) : null
      });

      if (res.success) {
        alert('Student updated successfully!');
        setEditingStudent(null);
        loadStudents();
      } else {
        alert(res.message || 'Failed to update student');
      }
    };

    const filteredStudents = students.filter(student => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                           (student.studentNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = filterClass === 'All' || student.classId === filterClass;
      return matchesSearch && matchesClass;
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">Students Management</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setShowPromoteModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              Promote Students
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Student
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Student</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={newStudent.firstName}
                  onChange={(e) => setNewStudent({...newStudent, firstName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  value={newStudent.lastName}
                  onChange={(e) => setNewStudent({...newStudent, lastName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                <select
                  value={newStudent.classId}
                  onChange={(e) => setNewStudent({...newStudent, classId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Class</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={newStudent.gender}
                  onChange={(e) => setNewStudent({...newStudent, gender: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Guardian Name</label>
                <input
                  type="text"
                  value={newStudent.guardianName}
                  onChange={(e) => setNewStudent({...newStudent, guardianName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter guardian name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Guardian Phone</label>
                <input
                  type="text"
                  value={newStudent.guardianPhone}
                  onChange={(e) => setNewStudent({...newStudent, guardianPhone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Guardian Email</label>
                <input
                  type="email"
                  value={newStudent.guardianEmail}
                  onChange={(e) => setNewStudent({...newStudent, guardianEmail: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={newStudent.address}
                  onChange={(e) => setNewStudent({...newStudent, address: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total School Fees (UGX) *</label>
                <input
                  type="number"
                  value={newStudent.totalFees}
                  onChange={(e) => setNewStudent({...newStudent, totalFees: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none font-bold text-green-700"
                  placeholder="e.g. 500000"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={addStudent}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                Save Student
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Student Records ({filteredStudents.length})</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or student number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="All">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {loadingStudents ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading students...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Student No</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Class</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Guardian</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Phone</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">No students found</td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium text-blue-600">{student.studentNumber}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{student.firstName} {student.lastName}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{student.class?.name || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{student.guardianName || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{student.guardianPhone || 'N/A'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => viewStudentBalance(student)}
                              className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-sm font-medium hover:bg-purple-200"
                            >
                              Balance
                            </button>
                            <button
                              onClick={() => startEditStudent(student)}
                              className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-medium hover:bg-blue-200"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>




{/* Promote Students Modal */}
        {showPromoteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">🎓 Promote Students</h3>
                <button onClick={() => setShowPromoteModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Class Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Class (Current)</label>
                  <select
                    value={promoteFromClass}
                    onChange={(e) => {
                      setPromoteFromClass(e.target.value);
                      loadStudentsForPromotion(e.target.value);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-lg"
                  >
                    <option value="">Select Source Class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name} ({cls.studentCount} students)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Class (Destination)</label>
                  <select
                    value={promoteToClass}
                    onChange={(e) => setPromoteToClass(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-lg"
                  >
                    <option value="">Select Destination Class</option>
                    {classes.filter(c => c.id !== promoteFromClass).map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="carryBalance"
                    checked={carryForwardBalance}
                    onChange={(e) => setCarryForwardBalance(e.target.checked)}
                    className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="carryBalance" className="text-sm font-medium text-gray-700">
                    Carry forward outstanding balances
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Term Fees (Optional)</label>
                  <input
                    type="number"
                    value={newTermFees}
                    onChange={(e) => setNewTermFees(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="Set new fees for all promoted students"
                  />
                </div>
              </div>

              {/* Students Preview */}
              {studentsToPromote.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-800">
                      Students to Promote ({selectedForPromotion.length}/{studentsToPromote.length} selected)
                    </h4>
                    <button
                      onClick={toggleAllStudents}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      {selectedForPromotion.length === studentsToPromote.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="py-2 px-3 text-left text-sm font-semibold text-gray-700">Select</th>
                          <th className="py-2 px-3 text-left text-sm font-semibold text-gray-700">Student No</th>
                          <th className="py-2 px-3 text-left text-sm font-semibold text-gray-700">Name</th>
                          <th className="py-2 px-3 text-left text-sm font-semibold text-gray-700">Guardian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsToPromote.map(student => (
                          <tr 
                            key={student.id} 
                            className={`border-b hover:bg-gray-50 cursor-pointer ${selectedForPromotion.includes(student.id) ? 'bg-purple-50' : ''}`}
                            onClick={() => toggleStudentSelection(student.id)}
                          >
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={selectedForPromotion.includes(student.id)}
                                onChange={() => toggleStudentSelection(student.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-sm font-medium text-blue-600">{student.studentNumber}</td>
                            <td className="py-2 px-3 text-sm text-gray-800">{student.firstName} {student.lastName}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{student.guardianName || student.parentName || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No students message */}
              {promoteFromClass && studentsToPromote.length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg mb-6">
                  No active students found in this class
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handlePromoteStudents}
                  disabled={promotingInProgress || selectedForPromotion.length === 0 || !promoteFromClass || !promoteToClass}
                  className={`flex-1 px-6 py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 ${
                    promotingInProgress || selectedForPromotion.length === 0 || !promoteFromClass || !promoteToClass
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {promotingInProgress ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Promoting...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5" />
                      Promote {selectedForPromotion.length} Students
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowPromoteModal(false)}
                  className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Student Modal */}
        {editingStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Edit Student: {editingStudent.firstName} {editingStudent.lastName}</h3>
                <button onClick={() => setEditingStudent(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={editStudentForm.firstName}
                    onChange={(e) => setEditStudentForm({...editStudentForm, firstName: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={editStudentForm.lastName}
                    onChange={(e) => setEditStudentForm({...editStudentForm, lastName: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                  <select
                    value={editStudentForm.classId}
                    onChange={(e) => setEditStudentForm({...editStudentForm, classId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select Class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <select
                    value={editStudentForm.gender}
                    onChange={(e) => setEditStudentForm({...editStudentForm, gender: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Guardian Name</label>
                  <input
                    type="text"
                    value={editStudentForm.guardianName}
                    onChange={(e) => setEditStudentForm({...editStudentForm, guardianName: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Guardian Phone</label>
                  <input
                    type="text"
                    value={editStudentForm.guardianPhone}
                    onChange={(e) => setEditStudentForm({...editStudentForm, guardianPhone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Guardian Email</label>
                  <input
                    type="email"
                    value={editStudentForm.guardianEmail}
                    onChange={(e) => setEditStudentForm({...editStudentForm, guardianEmail: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={editStudentForm.address}
                    onChange={(e) => setEditStudentForm({...editStudentForm, address: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total School Fees (UGX)</label>
                  <input
                    type="number"
                    value={editStudentForm.totalFees}
                    onChange={(e) => setEditStudentForm({...editStudentForm, totalFees: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-bold"
                    placeholder="Enter total fees"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editStudentForm.isActive}
                      onChange={(e) => setEditStudentForm({...editStudentForm, isActive: e.target.checked})}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active Student</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={updateStudent}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Student Balance</h3>
                <button onClick={() => {setSelectedStudent(null); setStudentBalance(null);}} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="font-bold text-lg text-gray-800">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                <p className="text-sm text-gray-600">Student No: {selectedStudent.studentNumber}</p>
                <p className="text-sm text-gray-600">Class: {selectedStudent.class?.name || 'N/A'}</p>
              </div>

              {studentBalance ? (
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-gray-700">Total Paid:</span>
                    <span className="font-bold text-green-600">{formatCurrency(studentBalance.totalPaid || 0)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                    <span className="font-medium text-gray-700">Total Fees:</span>
                    <span className="font-bold text-red-600">{formatCurrency(studentBalance.totalFees || 0)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-100 rounded-lg border-2 border-blue-300">
                    <span className="font-bold text-gray-800">Balance:</span>
                    <span className={`font-bold text-xl ${(studentBalance.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(studentBalance.balance || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading balance...</p>
                </div>
              )}

              <button
                onClick={() => {setSelectedStudent(null); setStudentBalance(null);}}
                className="w-full mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Settings Component
  const Settings = () => {
    const [localSchoolName, setLocalSchoolName] = useState('QUEEN MOTHER JUNIOR SCHOOL');
    const [localBursarName, setLocalBursarName] = useState('Ms. SHADIA');
    const [localSchoolLogo, setLocalSchoolLogo] = useState(null);
    const [customIncomeCategories, setCustomIncomeCategories] = useState([]);
    const [customExpenseCategories, setCustomExpenseCategories] = useState([]);
    const [newIncomeCategory, setNewIncomeCategory] = useState('');
    const [newExpenseCategory, setNewExpenseCategory] = useState('');
    
    // Backup & Audit States
    const [backupStartDate, setBackupStartDate] = useState('2024-01-01');
    const [backupEndDate, setBackupEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [showAuditTrail, setShowAuditTrail] = useState(false);
  
    useEffect(() => {
      loadSettings();
      loadAuditLogs();
    }, []);
  
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('qm_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setLocalSchoolName(settings.schoolName || 'QUEEN MOTHER JUNIOR SCHOOL');
        setLocalBursarName(settings.bursarName || 'Ms. SHADIA');
        setLocalSchoolLogo(settings.schoolLogo || null);
        setCustomIncomeCategories(settings.customIncomeCategories || []);
        setCustomExpenseCategories(settings.customExpenseCategories || []);
      }
    };
  
    const loadAuditLogs = () => {
      const logs = JSON.parse(localStorage.getItem('qm_audit_logs') || '[]');
      setAuditLogs(logs);
    };
  
    // Helper function for logging actions
    const logAction = (action, type, details) => {
      const logs = JSON.parse(localStorage.getItem('qm_audit_logs') || '[]');
      const newLog = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        user: 'Current User', // Replace with actual user from context
        role: 'Admin', // Replace with actual role from context
        action,
        type,
        details
      };
      logs.push(newLog);
      localStorage.setItem('qm_audit_logs', JSON.stringify(logs));
    };
  
    const saveSettings = () => {
      const settings = {
        schoolName: localSchoolName,
        bursarName: localBursarName,
        schoolLogo: localSchoolLogo,
        customIncomeCategories,
        customExpenseCategories
      };
      localStorage.setItem('qm_settings', JSON.stringify(settings));
      logAction('SETTINGS', 'SYSTEM', 'Settings updated');
      alert('Settings saved successfully! The page will reload to apply changes.');
      window.location.reload();
    };
  
    const handleLogoUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLocalSchoolLogo(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };
  
    const addIncomeCategory = () => {
      if (newIncomeCategory.trim() && !customIncomeCategories.includes(newIncomeCategory.trim())) {
        setCustomIncomeCategories([...customIncomeCategories, newIncomeCategory.trim()]);
        setNewIncomeCategory('');
      }
    };
  
    const removeIncomeCategory = (category) => {
      setCustomIncomeCategories(customIncomeCategories.filter(c => c !== category));
    };
  
    const addExpenseCategory = () => {
      if (newExpenseCategory.trim() && !customExpenseCategories.includes(newExpenseCategory.trim())) {
        setCustomExpenseCategories([...customExpenseCategories, newExpenseCategory.trim()]);
        setNewExpenseCategory('');
      }
    };
  
    const removeExpenseCategory = (category) => {
      setCustomExpenseCategories(customExpenseCategories.filter(c => c !== category));
    };
  
    // UPDATED BACKUP WITH DATE RANGE FILTERING
    const createBackup = async () => {
      const allIncome = JSON.parse(localStorage.getItem('qm_income') || '[]');
      const allExpenses = JSON.parse(localStorage.getItem('qm_expenses') || '[]');
      const allAudits = JSON.parse(localStorage.getItem('qm_audit_logs') || '[]');
      
      const filteredIncome = allIncome.filter(entry => 
        entry.date >= backupStartDate && entry.date <= backupEndDate
      );
      
      const filteredExpenses = allExpenses.filter(entry => 
        entry.date >= backupStartDate && entry.date <= backupEndDate
      );
      
      const filteredAudits = allAudits.filter(log => {
        const logDate = log.timestamp.split('T')[0];
        return logDate >= backupStartDate && logDate <= backupEndDate;
      });
    
      const backup = {
        version: '1.0',
        backupDate: new Date().toISOString(),
        dateRange: {
          start: backupStartDate,
          end: backupEndDate
        },
        data: {
          income: filteredIncome,
          expenses: filteredExpenses,
          receiptCounter: localStorage.getItem('qm_receipt_counter'),
          settings: JSON.parse(localStorage.getItem('qm_settings') || '{}'),
          users: JSON.parse(localStorage.getItem('qm_users') || '[]'),
          auditLogs: filteredAudits
        },
        statistics: {
          totalIncome: filteredIncome.reduce((sum, e) => sum + Number(e.amount), 0),
          totalExpenses: filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
          incomeCount: filteredIncome.length,
          expenseCount: filteredExpenses.length,
          auditCount: filteredAudits.length
        }
      };
    
      // Check if running in Electron
      if (window.electron && window.electron.showSaveDialog) {
        const result = await window.electron.showSaveDialog({
          title: 'Save Backup',
          defaultPath: `QM_Backup_${backupStartDate}_to_${backupEndDate}.json`,
          filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
    
        if (!result.canceled && result.filePath) {
          const saveResult = await window.electron.saveFile(
            result.filePath,
            JSON.stringify(backup, null, 2)
          );
    
          if (saveResult.success) {
            logAction('BACKUP', 'SYSTEM', `Backup created: ${result.filePath} - ${filteredIncome.length} income, ${filteredExpenses.length} expenses`);
            alert(`Backup saved successfully to:\n${result.filePath}\n\nIncome: ${filteredIncome.length} entries\nExpenses: ${filteredExpenses.length} entries\nAudit logs: ${filteredAudits.length} entries`);
          } else {
            alert('Error saving backup: ' + saveResult.error);
          }
        }
      } else {
        // Browser fallback
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QM_Backup_${backupStartDate}_to_${backupEndDate}.json`;
        a.click();
        URL.revokeObjectURL(url);
    
        logAction('BACKUP', 'SYSTEM', `Backup created for ${backupStartDate} to ${backupEndDate} - ${filteredIncome.length} income, ${filteredExpenses.length} expenses`);
    
        alert(`Backup created successfully!\n\nIncome: ${filteredIncome.length} entries\nExpenses: ${filteredExpenses.length} entries\nAudit logs: ${filteredAudits.length} entries`);
      }
    };
    // CRITICAL: RESTORE WITH DUPLICATE PREVENTION
    const restoreBackup = (event) => {
      const file = event.target.files[0];
      if (!file) return;
  
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backup = JSON.parse(e.target.result);
          
          if (!backup.version || !backup.data) {
            alert('Invalid backup file format');
            return;
          }
  
          const confirmMessage = `Restore backup from ${backup.backupDate}?\n\n` +
            `Income entries: ${backup.statistics.incomeCount}\n` +
            `Expense entries: ${backup.statistics.expenseCount}\n` +
            `Audit logs: ${backup.statistics.auditCount}\n\n` +
            `Duplicates will be automatically skipped`;
  
          if (!confirm(confirmMessage)) return;
  
          const currentIncome = JSON.parse(localStorage.getItem('qm_income') || '[]');
          const currentExpenses = JSON.parse(localStorage.getItem('qm_expenses') || '[]');
          const currentAudits = JSON.parse(localStorage.getItem('qm_audit_logs') || '[]');
  
          // CRITICAL: Remove duplicates based on receipt number for income
          const existingReceiptNos = new Set(currentIncome.map(e => e.receiptNo));
          const newIncome = backup.data.income.filter(e => 
            !existingReceiptNos.has(e.receiptNo)
          );
          
          // CRITICAL: Remove expense duplicates based on unique combination
          const existingExpenseKeys = new Set(
            currentExpenses.map(e => `${e.date}_${e.amount}_${e.description}_${e.category}`)
          );
          const newExpenses = backup.data.expenses.filter(e => 
            !existingExpenseKeys.has(`${e.date}_${e.amount}_${e.description}_${e.category}`)
          );
  
          // CRITICAL: Remove duplicate audit logs based on ID
          const existingAuditIds = new Set(currentAudits.map(log => log.id));
          const newAudits = backup.data.auditLogs.filter(log => 
            !existingAuditIds.has(log.id)
          );
  
          const mergedIncome = [...currentIncome, ...newIncome];
          const mergedExpenses = [...currentExpenses, ...newExpenses];
          const mergedAudits = [...currentAudits, ...newAudits];
          
          // CRITICAL: Update receipt counter only if backup has higher number
          const currentCounter = parseInt(localStorage.getItem('qm_receipt_counter') || '1');
          const backupCounter = parseInt(backup.data.receiptCounter || '1');
          const newCounter = Math.max(currentCounter, backupCounter);
  
          localStorage.setItem('qm_income', JSON.stringify(mergedIncome));
          localStorage.setItem('qm_expenses', JSON.stringify(mergedExpenses));
          localStorage.setItem('qm_audit_logs', JSON.stringify(mergedAudits));
          localStorage.setItem('qm_receipt_counter', newCounter.toString());
  
          if (backup.data.settings) {
            localStorage.setItem('qm_settings', JSON.stringify(backup.data.settings));
          }
  
          const skippedIncome = backup.data.income.length - newIncome.length;
          const skippedExpenses = backup.data.expenses.length - newExpenses.length;
          const skippedAudits = backup.data.auditLogs.length - newAudits.length;
  
          logAction('RESTORE', 'SYSTEM', `Backup restored - Added: ${newIncome.length} income, ${newExpenses.length} expenses. Skipped: ${skippedIncome} duplicate income, ${skippedExpenses} duplicate expenses`);
  
          alert(`Backup restored successfully!\n\nAdded:\n• ${newIncome.length} income entries\n• ${newExpenses.length} expense entries\n• ${newAudits.length} audit logs\n\nSkipped duplicates:\n• ${skippedIncome} income entries\n• ${skippedExpenses} expense entries\n• ${skippedAudits} audit logs\n\nReceipt counter: ${newCounter}\n\nPage will reload now.`);
          
          window.location.reload();
  
        } catch (error) {
          alert('Error restoring backup: ' + error.message);
          console.error('Restore error:', error);
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    };
  
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Settings</h2>
  
        {/* Backup Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-800">Data Backup & Restore</h3>
          </div>
          
          <p className="text-gray-600 mb-4">
            Select a date range to backup your financial records, settings, and audit logs.
          </p>
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={backupStartDate}
                onChange={(e) => setBackupStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={backupEndDate}
                onChange={(e) => setBackupEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
  
          <div className="flex gap-3 mb-4">
            <button
              onClick={createBackup}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Create Backup
            </button>
  
            <label className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 cursor-pointer">
              <Upload className="w-5 h-5" />
              Restore Backup
              <input
                type="file"
                accept=".json"
                onChange={restoreBackup}
                className="hidden"
              />
            </label>
          </div>
  
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>✅ Duplicate Prevention:</strong> Receipts with existing numbers will be automatically skipped during restore to prevent corruption.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Backup includes:</strong> Income records, Expense records, Receipt counter, 
              School settings, User accounts, and complete audit trail for the selected date range.
            </p>
          </div>
        </div>
  
        {/* Audit Trail Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-800">Audit Trail</h3>
            </div>
            <button
              onClick={() => {
                setShowAuditTrail(!showAuditTrail);
                if (!showAuditTrail) loadAuditLogs();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {showAuditTrail ? 'Hide' : 'Show'} Audit Logs ({auditLogs.length})
            </button>
          </div>
  
          {showAuditTrail && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Timestamp</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.slice().reverse().slice(0, 50).map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div>
                          <div className="font-medium text-gray-800">{log.user}</div>
                          <div className="text-xs text-gray-500">{log.role}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          log.action === 'ADD' ? 'bg-green-100 text-green-800' :
                          log.action === 'EDIT' ? 'bg-blue-100 text-blue-800' :
                          log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                          log.action === 'BACKUP' ? 'bg-purple-100 text-purple-800' :
                          log.action === 'RESTORE' ? 'bg-orange-100 text-orange-800' :
                          log.action === 'PRINT' ? 'bg-cyan-100 text-cyan-800' :
                          log.action === 'LOGIN' ? 'bg-teal-100 text-teal-800' :
                          log.action === 'LOGOUT' ? 'bg-gray-100 text-gray-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{log.type}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No audit logs yet. Actions will be recorded here.
                </div>
              )}
            </div>
          )}
  
          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <strong>Security:</strong> All actions are logged with timestamp, user details, and description. 
              Logs are included in backups and cannot be deleted through normal operations.
            </p>
          </div>
        </div>
  
        {/* School Information Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">School Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
              <input
                type="text"
                value={localSchoolName}
                onChange={(e) => setLocalSchoolName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter school name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bursar Name</label>
              <input
                type="text"
                value={localBursarName}
                onChange={(e) => setLocalBursarName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter bursar name"
              />
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {localSchoolLogo && (
                <div className="mt-4">
                  <img src={localSchoolLogo} alt="School Logo" className="w-32 h-32 object-contain border rounded" />
                </div>
              )}
            </div>
          </div>
        </div>
  
        {/* Custom Income Categories Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Custom Income Categories</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newIncomeCategory}
              onChange={(e) => setNewIncomeCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addIncomeCategory()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Add new income category"
            />
            <button
              onClick={addIncomeCategory}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {customIncomeCategories.map((category, index) => (
              <div key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center gap-2">
                <span>{category}</span>
                <button
                  onClick={() => removeIncomeCategory(category)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
  
        {/* Custom Expense Categories Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Custom Expense Categories</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newExpenseCategory}
              onChange={(e) => setNewExpenseCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addExpenseCategory()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Add new expense category"
            />
            <button
              onClick={addExpenseCategory}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {customExpenseCategories.map((category, index) => (
              <div key={index} className="bg-red-100 text-red-800 px-3 py-1 rounded-full flex items-center gap-2">
                <span>{category}</span>
                <button
                  onClick={() => removeExpenseCategory(category)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
  
        {/* Save Settings Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Save Settings
          </button>
        </div>
      </div>
    );
  };
  

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="School Logo" className="w-full h-full object-cover" />
                ) : (
                  <Receipt className="w-7 h-7 text-blue-600" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold">{schoolName}</h1>
                <p className="text-sm text-blue-100">Financial Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-blue-100">{user.role}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-md print:hidden">
  <div className="max-w-7xl mx-auto px-6">
    <div className="flex gap-1">
     {[
        { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
        { id: 'fees', label: 'School Fees', icon: <Receipt className="w-5 h-5" /> },
        { id: 'income', label: 'Other Income', icon: <TrendingUp className="w-5 h-5" /> },
        { id: 'expenses', label: 'Expenses', icon: <DollarSign className="w-5 h-5" /> },
        { id: 'students', label: 'Students', icon: <User className="w-5 h-5" /> },
        { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" /> }
      ].map(item => (        <button
          key={item.id}
          onClick={() => setCurrentView(item.id)}
          className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
            currentView === item.id
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  </div>
</nav>

<main className="max-w-7xl mx-auto px-6 py-8">
  {currentView === 'dashboard' && <Dashboard />}
  {currentView === 'fees' && <SchoolFeesCollection />}
  {currentView === 'income' && <IncomeManagement />}
  {currentView === 'expenses' && <ExpenseManagement />}
  {currentView === 'students' && <StudentsManagement />}
  {currentView === 'reports' && <Reports />}
  {currentView === 'settings' && <Settings />}
</main>
    </div>
  );
};

export default SchoolFinanceApp;