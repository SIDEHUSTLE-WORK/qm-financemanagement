import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, FileText, Download, Send, DollarSign, TrendingUp, Calendar, BarChart3, Receipt, Printer, Mail, LogOut, Settings as SettingsIcon, Edit, Search, Filter, X, Lock, User, Eye, EyeOff, Upload, Shield } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


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
    
    const receiptNo = `QM${String(receiptCounter).padStart(4, '0')}`;
    const entry = {
      date: form.date,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      receiptNo: receiptNo,
      paymentMethod: form.paymentMethod,
      studentName: form.studentName || ''
    };
    
    if (isElectron) {
      try {
        const id = await window.electronAPI.addIncome(entry);
        entry.id = id;
        await window.electronAPI.setReceiptCounter(receiptCounter + 1);
      } catch (error) {
        console.error('Error saving income:', error);
        alert('Error saving income to database');
        return;
      }
    } else {
      entry.id = Date.now();
    }
    
    setIncomeEntries(prev => [...prev, entry]);
    setReceiptCounter(prev => prev + 1);
    
    incomeFormRef.current = {
      date: new Date().toISOString().split('T')[0],
      category: 'School Fees',
      description: '',
      amount: '',
      paymentMethod: 'Cash',
      studentName: ''
    };
    logAction('ADD', 'INCOME', `Added ${entry.category}: ${entry.description} - ${formatCurrency(entry.amount)} (Receipt: ${receiptNo})`);
    rerender();
    
  };

  const addExpense = async () => {
    const form = expenseFormRef.current;
    
    if (!form.amount || !form.description) {
      alert('Please fill in all required fields');
      return;
    }
    
    const entry = {
      date: form.date,
      category: form.category,
      description: form.description,
      amount: Number(form.amount)
    };
    
    if (isElectron) {
      try {
        const id = await window.electronAPI.addExpense(entry);
        entry.id = id;
      } catch (error) {
        console.error('Error saving expense:', error);
        alert('Error saving expense to database');
        return;
      }
    } else {
      entry.id = Date.now();
    }
    
    setExpenseEntries(prev => [...prev, entry]);
    
    expenseFormRef.current = {
      date: new Date().toISOString().split('T')[0],
      category: 'Food & Supplies',
      description: '',
      amount: ''
    };
    rerender();
  };

  const updateIncome = async () => {
    const entry = editIncomeRef.current;
    
    if (!entry.amount || !entry.description) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (isElectron) {
      try {
        await window.electronAPI.updateIncome(entry.id, entry);
      } catch (error) {
        console.error('Error updating income:', error);
        alert('Error updating income in database');
        return;
      }
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
    
    if (isElectron) {
      try {
        await window.electronAPI.updateExpense(entry.id, entry);
      } catch (error) {
        console.error('Error updating expense:', error);
        alert('Error updating expense in database');
        return;
      }
    }
    
    setExpenseEntries(prev => prev.map(e => 
      e.id === entry.id ? { ...e, ...entry, amount: Number(entry.amount) } : e
    ));
    setEditingExpense(null);
    logAction('EDIT', 'EXPENSE', `Updated ${entry.category}: ${entry.description} - ${formatCurrency(entry.amount)}`);
  };

  const deleteIncome = async (id) => {
    if (!confirm('Are you sure you want to delete this income entry?')) {
      return;
    }
    
    if (isElectron) {
      try {
        await window.electronAPI.deleteIncome(id);
      } catch (error) {
        console.error('Error deleting income:', error);
        alert('Error deleting income from database');
        return;
      }
    }
    
    setIncomeEntries(prev => prev.filter(e => e.id !== id));
    const deletedEntry = incomeEntries.find(e => e.id === id);
logAction('DELETE', 'INCOME', `Deleted ${deletedEntry.category}: ${deletedEntry.description} - ${formatCurrency(deletedEntry.amount)} (Receipt: ${deletedEntry.receiptNo})`);
  };

  const deleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense entry?')) {
      return;
    }
    
    if (isElectron) {
      try {
        await window.electronAPI.deleteExpense(id);
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense from database');
        return;
      }
    }
    
    setExpenseEntries(prev => prev.filter(e => e.id !== id));
    const deletedEntry = expenseEntries.find(e => e.id === id);
logAction('DELETE', 'EXPENSE', `Deleted ${deletedEntry.category}: ${deletedEntry.description} - ${formatCurrency(deletedEntry.amount)}`);
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
  
    // Balance - Light yellow background (blank for manual entry)
    doc.setFillColor(254, 249, 195);
    doc.rect(8, yPos - 1, 64, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(161, 98, 7);
    doc.text('Balance:', 10, yPos + 3);
    // Draw a line for manual writing
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(28, yPos + 3.5, 68, yPos + 3.5);
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


  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    
    const users = JSON.parse(localStorage.getItem('qm_users') || '[]');
    const foundUser = users.find(u => u.username === loginUsername && u.password === loginPassword);
    
    if (foundUser) {
      setCurrentUser(foundUser);
      setUser({ name: foundUser.name, role: foundUser.role });
      localStorage.setItem('qm_current_user', JSON.stringify(foundUser));
      setIsAuthenticated(true);
    } else {
      setLoginError('Invalid username or password');
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
        { id: 'income', label: 'Income', icon: <TrendingUp className="w-5 h-5" /> },
        { id: 'expenses', label: 'Expenses', icon: <DollarSign className="w-5 h-5" /> },
        { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" /> }
      ].map(item => (
        <button
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
  {currentView === 'income' && <IncomeManagement />}
  {currentView === 'expenses' && <ExpenseManagement />}
  {currentView === 'reports' && <Reports />}
  {currentView === 'settings' && <Settings />}
</main>
    </div>
  );
};

export default SchoolFinanceApp;