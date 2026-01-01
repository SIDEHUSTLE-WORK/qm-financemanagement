import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, CreditCard, DollarSign, X, Check, AlertCircle, Printer } from 'lucide-react';
import api from './api';

/**
 * Improved Fee Payment Form Component
 * Features:
 * - Student search with typeahead
 * - Balance display
 * - Multiple payment methods
 * - Receipt printing
 */
const FeePaymentForm = ({ onSuccess, onCancel }) => {
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    studentId: '',
    categoryId: '',
    termId: '',
    description: '',
    amount: '',
    paymentMethod: 'cash',
    mobileMoneyRef: '',
    bankRef: '',
    schoolPayRef: '',
    notes: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  
  // Data state
  const [categories, setCategories] = useState([]);
  const [terms, setTerms] = useState([]);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [classes, setClasses] = useState([]);
  
  // Student search state
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentBalance, setStudentBalance] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesRes, termsRes, currentTermRes] = await Promise.all([
          api.income.getCategories(),
          api.settings.getTerms(),
          api.settings.getCurrentTerm()
        ]);

        if (categoriesRes.success) {
          // Filter to fee-related categories
          const feeCategories = categoriesRes.data.filter(c => 
            ['School Fees', 'Old Balance', 'Uniform', 'Swimming', 'School Van', 'School Tour'].includes(c.name)
          );
          setCategories(feeCategories.length > 0 ? feeCategories : categoriesRes.data);
        }

        if (termsRes.success) {
          setTerms(termsRes.data);
        }

        if (currentTermRes.success) {
          setCurrentTerm(currentTermRes.data);
          setFormData(prev => ({ ...prev, termId: currentTermRes.data.id }));
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };

    loadData();
  }, []);

  // Debounced student search
  const searchStudents = useCallback(async (query) => {
    if (query.length < 2) {
      setStudentResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.student.search(query);
      if (response.success) {
        setStudentResults(response.data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Handle student search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (studentSearch) {
        searchStudents(studentSearch);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [studentSearch, searchStudents]);

  // Select student and load balance
  const selectStudent = async (student) => {
    setSelectedStudent(student);
    setFormData(prev => ({ ...prev, studentId: student.id }));
    setStudentSearch('');
    setStudentResults([]);

    // Load student balance
    try {
      const response = await api.student.getBalance(student.id, formData.termId);
      if (response.success) {
        setStudentBalance(response.data);
      }
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  };

  // Clear selected student
  const clearStudent = () => {
    setSelectedStudent(null);
    setStudentBalance(null);
    setFormData(prev => ({ ...prev, studentId: '' }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }
      if (!formData.categoryId) {
        throw new Error('Please select a category');
      }
      if (!formData.description.trim()) {
        throw new Error('Please enter a description');
      }

      // Validate reference numbers for non-cash payments
      if (formData.paymentMethod === 'mobile_money' && !formData.mobileMoneyRef) {
        throw new Error('Please enter Mobile Money reference number');
      }
      if (formData.paymentMethod === 'bank_transfer' && !formData.bankRef) {
        throw new Error('Please enter Bank reference number');
      }
      if (formData.paymentMethod === 'school_pay' && !formData.schoolPayRef) {
        throw new Error('Please enter School Pay reference number');
      }

      const response = await api.income.create({
        ...formData,
        amount: parseFloat(formData.amount)
      });

      if (response.success) {
        setSuccess(response.data);
        
        // Refresh balance if student was selected
        if (selectedStudent) {
          const balanceRes = await api.student.getBalance(selectedStudent.id, formData.termId);
          if (balanceRes.success) {
            setStudentBalance(balanceRes.data);
          }
        }

        // Call success callback
        if (onSuccess) {
          onSuccess(response.data);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  // Print receipt
  const printReceipt = async () => {
    if (!success) return;

    try {
      const response = await api.print.getReceiptData(success.id);
      if (response.success) {
        // Open print dialog with formatted receipt
        const printWindow = window.open('', '_blank');
        printWindow.document.write(generateReceiptHTML(response.data));
        printWindow.document.close();
        printWindow.print();
      }
    } catch (err) {
      console.error('Print failed:', err);
    }
  };

  // Generate receipt HTML for printing
  const generateReceiptHTML = (data) => {
    const { header, receipt, footer } = data;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${receipt.number}</title>
        <style>
          body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 20px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .separator { border-top: 1px dashed #000; margin: 10px 0; }
          .amount { font-size: 1.5em; }
          .row { display: flex; justify-content: space-between; margin: 5px 0; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 1.2em">${header.schoolName}</div>
        <div class="center">${header.address || ''}</div>
        <div class="center">Tel: ${header.phone || ''}</div>
        <div class="center">${header.poBox || ''}</div>
        
        <div class="separator"></div>
        <div class="center bold">PAYMENT RECEIPT</div>
        <div class="separator"></div>
        
        <div class="row"><span>Receipt No:</span><span class="bold">${receipt.number}</span></div>
        <div class="row"><span>Date:</span><span>${receipt.date}</span></div>
        <div class="row"><span>Time:</span><span>${receipt.time}</span></div>
        
        ${receipt.studentName ? `
          <div class="separator"></div>
          <div class="row"><span>Student:</span><span>${receipt.studentName}</span></div>
          ${receipt.className ? `<div class="row"><span>Class:</span><span>${receipt.className}</span></div>` : ''}
        ` : ''}
        
        <div class="separator"></div>
        <div class="row"><span>Category:</span><span>${receipt.category}</span></div>
        <div>Description: ${receipt.description}</div>
        <div class="row"><span>Method:</span><span>${receipt.paymentMethod}</span></div>
        
        ${receipt.mobileMoneyRef ? `<div class="row"><span>MoMo Ref:</span><span>${receipt.mobileMoneyRef}</span></div>` : ''}
        ${receipt.bankRef ? `<div class="row"><span>Bank Ref:</span><span>${receipt.bankRef}</span></div>` : ''}
        
        <div class="separator"></div>
        <div class="center bold amount">${receipt.amountFormatted}</div>
        
        ${receipt.balanceFormatted ? `
          <div class="separator"></div>
          <div class="row"><span>Balance:</span><span class="bold">${receipt.balanceFormatted}</span></div>
        ` : ''}
        
        <div class="separator"></div>
        <div class="center">${footer.message}</div>
        <div class="center" style="font-size: 0.8em">${footer.note}</div>
      </body>
      </html>
    `;
  };

  // Reset form for new entry
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      studentId: selectedStudent?.id || '',
      categoryId: '',
      termId: currentTerm?.id || '',
      description: '',
      amount: '',
      paymentMethod: 'cash',
      mobileMoneyRef: '',
      bankRef: '',
      schoolPayRef: '',
      notes: ''
    });
    setSuccess(null);
    setError('');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG').format(amount) + ' UGX';
  };

  // Success view
  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Payment Recorded!</h2>
          <p className="text-gray-600 mt-2">Receipt #{success.receipt_number}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Amount Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(success.amount)}</p>
            </div>
            {studentBalance && (
              <div>
                <p className="text-sm text-gray-500">Remaining Balance</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(studentBalance.balance)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={printReceipt}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Print Receipt
          </button>
          <button
            onClick={resetForm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium"
          >
            Record Another Payment
          </button>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full mt-3 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium"
          >
            Done
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Fee Payment</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student (Optional)
          </label>
          
          {selectedStudent ? (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedStudent.student_number} • {selectedStudent.class_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearStudent}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or student number..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              
              {/* Search Results Dropdown */}
              {studentResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {studentResults.map(student => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => selectStudent(student)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {student.student_number} • {student.class_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {searchLoading && (
                <div className="absolute z-10 w-full mt-1 p-4 bg-white border border-gray-200 rounded-lg shadow-lg text-center text-gray-500">
                  Searching...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Student Balance Display */}
        {studentBalance && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Total Fees</p>
              <p className="font-bold text-gray-800">{formatCurrency(studentBalance.total_fees)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid</p>
              <p className="font-bold text-green-600">{formatCurrency(studentBalance.amount_paid)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Balance</p>
              <p className="font-bold text-orange-600">{formatCurrency(studentBalance.balance)}</p>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term *</label>
            <select
              value={formData.termId}
              onChange={(e) => setFormData({ ...formData, termId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value="">Select Term</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>
                  {term.name} {term.is_current && '(Current)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="school_pay">School Pay</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        {/* Reference Number Fields */}
        {formData.paymentMethod === 'mobile_money' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Money Reference *</label>
            <input
              type="text"
              value={formData.mobileMoneyRef}
              onChange={(e) => setFormData({ ...formData, mobileMoneyRef: e.target.value })}
              placeholder="e.g., MP123456789"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        {formData.paymentMethod === 'bank_transfer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bank Reference *</label>
            <input
              type="text"
              value={formData.bankRef}
              onChange={(e) => setFormData({ ...formData, bankRef: e.target.value })}
              placeholder="Bank transaction reference"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        {formData.paymentMethod === 'school_pay' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">School Pay Reference *</label>
            <input
              type="text"
              value={formData.schoolPayRef}
              onChange={(e) => setFormData({ ...formData, schoolPayRef: e.target.value })}
              placeholder="School Pay transaction ID"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g., School fees payment for Term 1"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (UGX) *</label>
          <div className="relative">
            <DollarSign className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Enter amount"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xl font-bold"
              min="0"
              step="100"
              required
            />
          </div>
          {formData.amount && (
            <p className="mt-1 text-lg text-green-600 font-semibold">
              {formatCurrency(parseFloat(formData.amount) || 0)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional notes..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            rows={2}
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Record Payment
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default FeePaymentForm;
