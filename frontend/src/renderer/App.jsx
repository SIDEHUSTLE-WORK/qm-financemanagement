import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, FileText, Download, Send, DollarSign, TrendingUp, Calendar, BarChart3, Receipt, Printer, Mail, LogOut, Settings as SettingsIcon, Edit, Search, Filter, X, Lock, User, Eye, EyeOff, Upload, Shield, MessageSquare } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode/lib/browser';



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

// SMS Center Component - MOVED OUTSIDE to prevent re-render issues
const SMSCenter = ({ 
  smsStats, smsHistory, defaulters, selectedDefaulters, defaultersLoading,
  smsMessage, setSmsMessage, smsPhone, setSmsPhone, smsTemplate, setSmsTemplate,
  smsStudentSearch, setSmsStudentSearch, smsSearchResults, selectedSmsStudent,
  setSelectedSmsStudent, setSmsSearchResults, minBalance, setMinBalance,
  smsFilterClass, setSmsFilterClass, classes, smsLoading,
  loadSmsStats, loadSmsHistory, loadDefaulters, loadClasses, searchSmsStudents,
  selectSmsStudent, applySmsTemplate, sendSms, sendBulkSms,
  toggleDefaulterSelection, selectAllDefaulters, formatCurrency, smsTemplates
}) => {
  const [localSmsTab, setLocalSmsTab] = useState('send');
  const phoneInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const studentSearchRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadSmsStats();
      loadSmsHistory();
      loadClasses();
    }
  }, []);

  const handleTabChange = (tab) => {
    setLocalSmsTab(tab);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">📱 SMS Center</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">Today's SMS</p>
          <p className="text-2xl font-bold">{smsStats.todaySent || 0}</p>
          <p className="text-xs opacity-70">Cost: {formatCurrency(smsStats.todayCost || 0)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">Total SMS Sent</p>
          <p className="text-2xl font-bold">{smsStats.totalSent || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">Total Cost</p>
          <p className="text-2xl font-bold">{formatCurrency(smsStats.totalCost || 0)}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">Cost Per SMS</p>
          <p className="text-2xl font-bold">{formatCurrency(25)}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b">
          <button 
            type="button"
            onClick={() => handleTabChange('send')} 
            className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${localSmsTab === 'send' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            📱 Send SMS
          </button>
          <button 
            type="button"
            onClick={() => handleTabChange('defaulters')} 
            className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${localSmsTab === 'defaulters' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            💸 Fee Defaulters
          </button>
          <button 
            type="button"
            onClick={() => handleTabChange('history')} 
            className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${localSmsTab === 'history' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            📜 SMS History
          </button>
        </div>

        {/* Send SMS Tab */}
        {localSmsTab === 'send' && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Send SMS to Parent</h3>
                
                {/* Student Search */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Student (Optional)</label>
                  <input 
                    type="text" 
                    ref={studentSearchRef}
                    defaultValue={smsStudentSearch} 
                    onChange={(e) => searchSmsStudents(e.target.value)} 
                    placeholder="Type student name..." 
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    autoComplete="off"
                  />
                  {smsSearchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {smsSearchResults.map(student => (
                        <div 
                          key={student.id} 
                          onClick={() => {
                            selectSmsStudent(student);
                            if (studentSearchRef.current) {
                              studentSearchRef.current.value = `${student.firstName} ${student.lastName}`;
                            }
                          }} 
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                        >
                          <p className="font-medium">{student.firstName} {student.lastName}</p>
                          <p className="text-xs text-gray-500">{student.studentNumber}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Student Info */}
                {selectedSmsStudent && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-blue-800">{selectedSmsStudent.firstName} {selectedSmsStudent.lastName}</p>
                        <p className="text-sm text-blue-600">Class: {selectedSmsStudent.className || 'N/A'}</p>
                        <p className="text-sm text-blue-600">Balance: {formatCurrency(selectedSmsStudent.balance || 0)}</p>
                        <p className="text-sm text-blue-600">Phone: {selectedSmsStudent.phone || 'No phone'}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => { 
                          setSelectedSmsStudent(null); 
                          setSmsStudentSearch(''); 
                          setSmsPhone(''); 
                          if (studentSearchRef.current) studentSearchRef.current.value = '';
                          if (phoneInputRef.current) phoneInputRef.current.value = '';
                        }}
                        className="text-blue-400 hover:text-blue-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input 
                    type="tel" 
                    ref={phoneInputRef}
                    defaultValue={smsPhone} 
                    onChange={(e) => setSmsPhone(e.target.value)} 
                    placeholder="0772123456 or 256772123456" 
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    autoComplete="off"
                  />
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message Template</label>
                  <select 
                    value={smsTemplate} 
                    onChange={(e) => {
                      const templateId = e.target.value;
                      setSmsTemplate(templateId);
                      const template = smsTemplates.find(t => t.id === templateId);
                      if (template && templateId !== 'custom') {
                        let msg = template.template;
                        if (selectedSmsStudent) {
                          msg = msg.replace('{student}', `${selectedSmsStudent.firstName} ${selectedSmsStudent.lastName}`);
                          msg = msg.replace('{balance}', formatCurrency(selectedSmsStudent.balance || 0));
                        }
                        msg = msg.replace('{amount}', '___').replace('{receipt}', '___');
                        setSmsMessage(msg);
                        if (messageInputRef.current) messageInputRef.current.value = msg;
                      } else { 
                        setSmsMessage(''); 
                        if (messageInputRef.current) messageInputRef.current.value = '';
                      }
                    }} 
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- Select Template --</option>
                    {smsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message * 
                    <span className={`ml-2 ${smsMessage.length > 160 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                      ({smsMessage.length}/160)
                    </span>
                  </label>
                  <textarea 
                    ref={messageInputRef}
                    defaultValue={smsMessage} 
                    onChange={(e) => setSmsMessage(e.target.value)} 
                    rows={4} 
                    maxLength={160} 
                    placeholder="Type your message here..." 
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Variables: {'{student}'}, {'{balance}'}, {'{amount}'}, {'{receipt}'}</p>
                </div>

                {/* Cost Display */}
                <div className="bg-yellow-50 p-3 rounded-lg flex justify-between items-center border border-yellow-200">
                  <span className="text-yellow-800 font-medium">SMS Cost:</span>
                  <span className="text-yellow-800 font-bold text-lg">{formatCurrency(25)}</span>
                </div>

                {/* Send Button */}
                <button 
                  type="button"
                  onClick={() => {
                    const phone = phoneInputRef.current?.value || smsPhone;
                    const message = messageInputRef.current?.value || smsMessage;
                    if (!phone || !message) { alert('Please enter phone number and message'); return; }
                    if (message.length > 160) { alert('Message exceeds 160 characters'); return; }
                    sendSms(phone, message);
                  }} 
                  disabled={smsLoading} 
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {smsLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-5 h-5" />
                      Send SMS
                    </>
                  )}
                </button>
              </div>

              {/* Preview Panel */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Message Preview</h3>
                <div className="bg-gray-100 rounded-xl p-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm max-w-xs mx-auto">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">QM</div>
                      <div>
                        <p className="font-medium text-sm">QMJS</p>
                        <p className="text-xs text-gray-500">{smsPhone || 'No number'}</p>
                      </div>
                    </div>
                    <div className="bg-green-100 rounded-lg p-3 text-sm min-h-[60px]">
                      {smsMessage || 'Your message will appear here...'}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-right">{new Date().toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Defaulters Tab */}
        {localSmsTab === 'defaulters' && (
          <div className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Balance</label>
                <input 
                  type="number" 
                  defaultValue={minBalance} 
                  onChange={(e) => setMinBalance(e.target.value)} 
                  placeholder="e.g., 100000" 
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none w-40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Class</label>
                <select 
                  defaultValue={smsFilterClass} 
                  onChange={(e) => setSmsFilterClass(e.target.value)} 
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  type="button"
                  onClick={loadDefaulters} 
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
                >
                  🔍 Filter
                </button>
              </div>
            </div>

            {/* Message for Defaulters */}
            <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message for Selected Defaulters
                <span className={`ml-2 ${smsMessage.length > 160 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                  ({smsMessage.length}/160)
                </span>
              </label>
              <textarea 
                defaultValue={smsMessage} 
                onChange={(e) => setSmsMessage(e.target.value)} 
                rows={2} 
                maxLength={160} 
                placeholder="QMJS: {student} has balance of {balance}. Kindly clear fees. Thank you!" 
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">Use {'{student}'} and {'{balance}'} - they'll be replaced for each parent</p>
            </div>

            {/* Selection Summary & Actions */}
            <div className="flex flex-wrap items-center justify-between bg-green-50 p-4 rounded-lg mb-4 border border-green-200 gap-4">
              <div>
                <span className="font-bold text-green-800 text-lg">
                  Selected: {selectedDefaulters.length} / {defaulters.length} students
                </span>
                <span className="ml-4 text-green-600">
                  Total Balance: {formatCurrency(selectedDefaulters.reduce((sum, s) => sum + s.balance, 0))}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={selectAllDefaulters} 
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium transition-colors"
                >
                  {selectedDefaulters.length === defaulters.length ? 'Deselect All' : 'Select All'}
                </button>
                <button 
                  type="button"
                  onClick={sendBulkSms} 
                  disabled={smsLoading || selectedDefaulters.length === 0 || !smsMessage} 
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 transition-colors"
                >
                  {smsLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>📱 Send SMS ({formatCurrency(selectedDefaulters.length * 25)})</>
                  )}
                </button>
              </div>
            </div>

            {/* Defaulters Table */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-3 px-4 text-left">
                      <input 
                        type="checkbox" 
                        checked={selectedDefaulters.length === defaulters.length && defaulters.length > 0} 
                        onChange={selectAllDefaulters}
                        className="w-4 h-4 rounded"
                      />
                    </th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Student</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Class</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Parent Phone</th>
                    <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {defaultersLoading ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                          Loading defaulters...
                        </div>
                      </td>
                    </tr>
                  ) : defaulters.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-gray-500">
                        No defaulters found. Try adjusting filters.
                      </td>
                    </tr>
                  ) : (
                    defaulters.map(student => (
                      <tr 
                        key={student.id} 
                        className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${selectedDefaulters.find(s => s.id === student.id) ? 'bg-blue-50' : ''}`}
                        onClick={() => toggleDefaulterSelection(student)}
                      >
                        <td className="py-3 px-4">
                          <input 
                            type="checkbox" 
                            checked={!!selectedDefaulters.find(s => s.id === student.id)} 
                            onChange={() => toggleDefaulterSelection(student)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-800">{student.fullName}</p>
                          <p className="text-xs text-gray-500">{student.studentNumber}</p>
                        </td>
                        <td className="py-3 px-4 text-purple-600 font-medium">{student.className}</td>
                        <td className="py-3 px-4 text-gray-600">{student.phone || <span className="text-red-500">No phone</span>}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-bold">{formatCurrency(student.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History Tab */}
        {localSmsTab === 'history' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">SMS History (Last 100)</h3>
              <button 
                type="button"
                onClick={loadSmsHistory}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Phone</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Student</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Message</th>
                    <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">Status</th>
                    <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {smsHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-gray-500">
                        No SMS history yet. Send your first SMS!
                      </td>
                    </tr>
                  ) : (
                    smsHistory.map(sms => (
                      <tr key={sms.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-600">{new Date(sms.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{sms.phone}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{sms.studentName || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                          <span className="truncate block" title={sms.message}>{sms.message}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${sms.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {sms.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-gray-800">{formatCurrency(sms.cost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
  
  // SMS Center State
  const [smsTab, setSmsTab] = useState('send');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsTemplate, setSmsTemplate] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsHistory, setSmsHistory] = useState([]);
  const [smsStats, setSmsStats] = useState({ totalSent: 0, todaySent: 0, totalCost: 0, todayCost: 0 });
  const [defaulters, setDefaulters] = useState([]);
  const [selectedDefaulters, setSelectedDefaulters] = useState([]);
  const [defaultersLoading, setDefaultersLoading] = useState(false);
  const [smsStudentSearch, setSmsStudentSearch] = useState('');
  const [smsSearchResults, setSmsSearchResults] = useState([]);
  const [selectedSmsStudent, setSelectedSmsStudent] = useState(null);
  const [minBalance, setMinBalance] = useState('');
  const [smsFilterClass, setSmsFilterClass] = useState('');
  const [classes, setClasses] = useState([]);
  
  // Budget State
  const [budgets, setBudgets] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  
  // Payment Plans State
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [planSummary, setPlanSummary] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);
  
  // Permissions State
  const [userPermissions, setUserPermissions] = useState(null);
  const [roles, setRoles] = useState([]);
  const [usersWithRoles, setUsersWithRoles] = useState([]);
  
  // Email Receipt Modal State
  const [emailReceiptModal, setEmailReceiptModal] = useState(null);
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('qm_dark_mode');
    return saved === 'true';
  });
  
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
    const defaultersLoadingRef = useRef(false);
    const smsInitializedRef = useRef(false);
    const messageInputRef = useRef(null);
  
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
        studentName: item.student?.fullName || (item.student ? `${item.student.firstName || ''} ${item.student.lastName || ''}`.trim() : ''),
        studentClass: item.student?.class?.name || '',
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
  // ==================== SMS FUNCTIONS ====================
  const smsTemplates = [
    { id: 'receipt', name: 'Payment Receipt', template: 'QMJS: Received {amount} for {student}. Bal: {balance}. Rcpt: {receipt}. Thank you!' },
    { id: 'reminder', name: 'Fee Reminder', template: 'QMJS: {student} has balance of {balance}. Kindly clear fees. Thank you!' },
    { id: 'general', name: 'General Reminder', template: 'QMJS: School fees for Term 1 is due. Clear pending balances. Contact 0200939322' },
    { id: 'custom', name: 'Custom Message', template: '' }
  ];

  const loadSmsStats = async () => {
    if (smsStats.totalSent !== 0 && smsStats.todaySent !== undefined) return; // Already loaded
    const res = await api.get('/sms/stats');
    if (res.success) setSmsStats(res.data);
  };

  const loadSmsHistory = async () => {
    if (smsHistory.length > 0) return; // Already loaded
    const res = await api.get('/sms/history');
    if (res.success) setSmsHistory(res.data || []);
  };

  const loadDefaulters = async () => {
    if (defaultersLoadingRef.current) return; // Prevent concurrent calls
    defaultersLoadingRef.current = true;
    setDefaultersLoading(true);
    try {
      const params = new URLSearchParams();
      if (minBalance) params.append('minBalance', minBalance);
      if (smsFilterClass) params.append('classId', smsFilterClass);
      const res = await api.get(`/sms/defaulters?${params.toString()}`);
      if (res.success) {
        setDefaulters(res.data || []);
      } else {
        console.error('Defaulters API error:', res.message);
        setDefaulters([]); // Set empty to prevent retry loops
      }
    } catch (error) {
      console.error('Defaulters fetch error:', error);
      setDefaulters([]);
    } finally {
      setDefaultersLoading(false);
      defaultersLoadingRef.current = false;
    }
  };

  const loadClasses = async () => {
    if (classes.length > 0) return; // Already loaded
    const res = await api.get('/students/classes');
    if (res.success) {
      const dataArray = Array.isArray(res.data) ? res.data : (res.data?.classes || []);
      setClasses(dataArray);
    }
  };

  const searchSmsStudents = async (query) => {
    if (query.length < 2) { setSmsSearchResults([]); return; }
    const res = await api.get(`/students/search?q=${encodeURIComponent(query)}`);
    if (res.success) setSmsSearchResults(Array.isArray(res.data) ? res.data : []);
  };

  const selectSmsStudent = async (student) => {
    setSmsSearchResults([]);
    setSmsStudentSearch(`${student.firstName} ${student.lastName}`);
    const studentRes = await api.get(`/students/${student.id}`);
    const balanceRes = await api.get(`/students/${student.id}/balance`);
    if (studentRes.success) {
      const fullStudent = {
        ...student, ...studentRes.data,
        phone: studentRes.data.parentPhone || studentRes.data.parentPhoneAlt || '',
        className: studentRes.data.class?.name || studentRes.data.className || '',
        balance: balanceRes.success ? (balanceRes.data?.balance || 0) : 0
      };
      setSelectedSmsStudent(fullStudent);
      setSmsPhone(fullStudent.phone);
    }
  };

  const applySmsTemplate = (templateId) => {
    setSmsTemplate(templateId);
    const template = smsTemplates.find(t => t.id === templateId);
    if (template && templateId !== 'custom') {
      let msg = template.template;
      if (selectedSmsStudent) {
        msg = msg.replace('{student}', `${selectedSmsStudent.firstName} ${selectedSmsStudent.lastName}`);
        msg = msg.replace('{balance}', formatCurrency(selectedSmsStudent.balance || 0));
      }
      // Remove unused placeholders
      msg = msg.replace('{amount}', '___').replace('{receipt}', '___');
      setSmsMessage(msg);
      if (messageInputRef.current) messageInputRef.current.value = msg;
    } else { 
      setSmsMessage(''); 
      if (messageInputRef.current) messageInputRef.current.value = '';
    }
  };

  const sendSms = async (phone, message) => {
    const finalPhone = phone || smsPhone;
    const finalMessage = message || smsMessage;
    if (!finalPhone || !finalMessage) { alert('Please enter phone number and message'); return; }
    if (finalMessage.length > 160) { alert('Message exceeds 160 characters'); return; }
    setSmsLoading(true);
    const res = await api.post('/sms/send', {
      phone: finalPhone, message: finalMessage,
      studentId: selectedSmsStudent?.id || null,
      studentName: selectedSmsStudent ? `${selectedSmsStudent.firstName} ${selectedSmsStudent.lastName}` : null
    });
    setSmsLoading(false);
    if (res.success) {
      alert(`SMS sent successfully! Cost: ${formatCurrency(25)}`);
      setSmsMessage(''); setSmsPhone(''); setSelectedSmsStudent(null); setSmsStudentSearch(''); setSmsTemplate('');
      loadSmsStats(); loadSmsHistory();
    } else { alert('Failed to send SMS: ' + res.message); }
  };

  const sendBulkSms = async () => {
    if (selectedDefaulters.length === 0) { alert('Please select at least one student'); return; }
    if (!smsMessage) { alert('Please enter a message'); return; }
    if (smsMessage.length > 160) { alert('Message exceeds 160 characters'); return; }
    const confirmSend = window.confirm(`Send SMS to ${selectedDefaulters.length} parents?\n\nTotal Cost: ${formatCurrency(selectedDefaulters.length * 25)}\n\nMessage:\n${smsMessage}`);
    if (!confirmSend) return;
    setSmsLoading(true);
    const messages = selectedDefaulters.map(student => ({
      phone: student.phone,
      message: smsMessage.replace('{student}', student.fullName).replace('{balance}', formatCurrency(student.balance)),
      studentId: student.id, studentName: student.fullName
    }));
    const res = await api.post('/sms/send-bulk', { messages });
    setSmsLoading(false);
    if (res.success) {
      alert(`${res.count} SMS sent successfully!\n\nTotal Cost: ${formatCurrency(res.totalCost)}`);
      setSelectedDefaulters([]); setSmsMessage(''); loadSmsStats(); loadSmsHistory();
    } else { alert('Failed to send SMS: ' + res.message); }
  };

  const toggleDefaulterSelection = (student) => {
    setSelectedDefaulters(prev => prev.find(s => s.id === student.id) ? prev.filter(s => s.id !== student.id) : [...prev, student]);
  };

  const selectAllDefaulters = () => {
    setSelectedDefaulters(selectedDefaulters.length === defaulters.length ? [] : [...defaulters]);
  };

  // ==================== BUDGET FUNCTIONS ====================
  const budgetsLoadingRef = useRef(false);
  const budgetsLoadedRef = useRef(false);
  const budgetSummaryLoadingRef = useRef(false);
  const budgetSummaryLoadedRef = useRef(false);

  const loadBudgets = async (year, month, period = 'monthly', force = false) => {
    if (budgetsLoadedRef.current && !force) return;
    if (budgetsLoadingRef.current) return;
    
    budgetsLoadingRef.current = true;
    setBudgetLoading(true);
    try {
      const params = new URLSearchParams({ year, period });
      if (period === 'monthly') params.append('month', month);
      
      const res = await api.get(`/budgets?${params.toString()}`);
      if (res.success) {
        setBudgets(res.data || []);
        budgetsLoadedRef.current = true;
      }
    } finally {
      setBudgetLoading(false);
      budgetsLoadingRef.current = false;
    }
  };

  const loadBudgetSummary = async (year, month, force = false) => {
    if (budgetSummaryLoadedRef.current && !force) return;
    if (budgetSummaryLoadingRef.current) return;
    
    budgetSummaryLoadingRef.current = true;
    try {
      const res = await api.get(`/budgets/summary?year=${year}&month=${month}`);
      if (res.success) {
        setBudgetSummary(res.data);
        budgetSummaryLoadedRef.current = true;
      }
    } finally {
      budgetSummaryLoadingRef.current = false;
    }
  };

  const saveBudget = async (category, amount, period, year, month) => {
    const res = await api.post('/budgets', { category, amount, period, year, month });
    if (res.success) {
      loadBudgets(year, month, period);
      loadBudgetSummary(year, month);
      return true;
    }
    return false;
  };

  const saveBulkBudgets = async (budgetsData, period, year, month) => {
    const res = await api.post('/budgets/bulk', { 
      budgets: budgetsData, 
      period, 
      year, 
      month 
    });
    if (res.success) {
      alert(`${res.message}`);
      loadBudgets(year, month, period);
      loadBudgetSummary(year, month);
      return true;
    }
    alert(res.message || 'Failed to save budgets');
    return false;
  };

  const deleteBudget = async (id, year, month, period) => {
    if (!confirm('Delete this budget?')) return;
    const res = await api.delete(`/budgets/${id}`);
    if (res.success) {
      loadBudgets(year, month, period);
      loadBudgetSummary(year, month);
    }
  };

  // ==================== PAYMENT PLAN FUNCTIONS ====================
  const plansLoadedRef = useRef(false);
  
  const loadPaymentPlans = async (force = false) => {
    if (plansLoadedRef.current && !force) return;
    const res = await api.get('/payment-plans');
    if (res.success) {
      setPaymentPlans(res.data || []);
      plansLoadedRef.current = true;
    }
  };

  const installmentsLoadingRef = useRef(false);
  const installmentsLoadedRef = useRef(false);
  
  const loadInstallments = async (filter = '', force = false) => {
    // Prevent repeat calls after initial load (unless forced)
    if (installmentsLoadedRef.current && !force) return;
    // Prevent concurrent calls
    if (installmentsLoadingRef.current) return;
    
    installmentsLoadingRef.current = true;
    setPlansLoading(true);
    try {
      const res = await api.get(`/installments${filter}`);
      if (res.success) {
        setInstallments(res.data || []);
        installmentsLoadedRef.current = true;
      }
    } finally {
      setPlansLoading(false);
      installmentsLoadingRef.current = false;
    }
  };

  const loadPlanSummary = async (force = false) => {
    if (planSummary && !force) return;
    const res = await api.get('/payment-plans/summary');
    if (res.success) setPlanSummary(res.data);
  };

  const createPaymentPlan = async (planData) => {
    const res = await api.post('/payment-plans', planData);
    if (res.success) {
      loadPaymentPlans();
      return res.data;
    }
    return null;
  };

  const assignPlanToStudent = async (data) => {
    const res = await api.post('/payment-plans/assign', data);
    if (res.success) {
      alert('Payment plan assigned successfully!');
      loadInstallments();
      loadPlanSummary();
      return true;
    }
    alert(res.message || 'Failed to assign plan');
    return false;
  };

  const recordInstallmentPayment = async (installmentId, amount) => {
    const res = await api.post(`/installments/${installmentId}/pay`, { amount });
    if (res.success) {
      loadInstallments();
      loadPlanSummary();
      return true;
    }
    alert(res.message || 'Failed to record payment');
    return false;
  };

  // ==================== EMAIL FUNCTIONS ====================
  const sendReceiptEmail = async (receiptId, email) => {
    const res = await api.post('/email/send-receipt', { receiptId, email });
    if (res.success) {
      alert(res.message);
      return true;
    }
    alert(res.message || 'Failed to send email');
    return false;
  };

  const getEmailSettings = async () => {
    const res = await api.get('/email/settings');
    return res.success ? res.data : null;
  };

  const saveEmailSettings = async (settings) => {
    const res = await api.post('/email/settings', settings);
    if (res.success) {
      alert('Email settings saved!');
      return true;
    }
    alert(res.message || 'Failed to save settings');
    return false;
  };

  const testEmailConfig = async (testEmail) => {
    const res = await api.post('/email/test', { testEmail });
    if (res.success) {
      alert(res.message);
      return true;
    }
    alert(res.message || 'Email test failed');
    return false;
  };

  const sendInstallmentReminder = async (installmentId) => {
    const res = await api.post(`/installments/${installmentId}/remind`, {});
    if (res.success) {
      alert('Reminder sent successfully!');
      loadInstallments();
      return true;
    }
    alert(res.message || 'Failed to send reminder');
    return false;
  };

  // ==================== PERMISSION FUNCTIONS ====================
  const loadMyPermissions = async () => {
    const res = await api.get('/permissions/me');
    if (res.success) {
      setUserPermissions(res.data);
    }
  };

  const rolesLoadedRef = useRef(false);
  
  const loadRoles = async (force = false) => {
    if (rolesLoadedRef.current && !force) return;
    const res = await api.get('/roles');
    if (res.success) {
      setRoles(res.data || []);
      rolesLoadedRef.current = true;
    }
  };

  const loadUsersWithRoles = async (force = false) => {
    if (usersWithRoles.length > 0 && !force) return;
    const res = await api.get('/users/with-roles');
    if (res.success) setUsersWithRoles(res.data || []);
  };

  const initializeRoles = async () => {
    const res = await api.post('/roles/initialize', {});
    if (res.success) {
      alert(res.message);
      loadRoles();
    }
  };

  const assignRole = async (userId, roleId) => {
    const res = await api.post('/roles/assign', { userId, roleId });
    if (res.success) {
      alert('Role assigned successfully!');
      loadUsersWithRoles();
      return true;
    }
    alert(res.message || 'Failed to assign role');
    return false;
  };

  const createRole = async (roleData) => {
    const res = await api.post('/roles', roleData);
    if (res.success) {
      loadRoles();
      return true;
    }
    alert(res.message || 'Failed to create role');
    return false;
  };

  const updateRolePermissions = async (roleId, permissions) => {
    const res = await api.put(`/roles/${roleId}`, { permissions });
    if (res.success) {
      alert('Permissions updated!');
      loadRoles();
      loadMyPermissions();
      return true;
    }
    alert(res.message || 'Failed to update permissions');
    return false;
  };

  // Permission check helper
  const hasPermission = (module, action) => {
    if (!userPermissions?.permissions) return true; // Allow all if no permissions set
    const modulePerms = userPermissions.permissions[module];
    if (!modulePerms) return false;
    return modulePerms[action] === true;
  };

  // Check if user can access a view
  const canAccess = (viewId) => {
    if (!userPermissions?.permissions) return true;
    const moduleMap = {
      'dashboard': 'dashboard',
      'fees': 'fees',
      'income': 'income',
      'expenses': 'expenses',
      'students': 'students',
      'reports': 'reports',
      'sms': 'sms',
      'budgets': 'budgets',
      'plans': 'plans',
      'settings': 'settings'
    };
    const module = moduleMap[viewId];
    if (!module) return true;
    return hasPermission(module, 'view');
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

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('qm_dark_mode', darkMode.toString());
  }, [darkMode]);

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

  const getTodayIncome = () => calculateTotals(incomeEntries.filter(e => e.category !== 'Old Balance' && !e.studentId), selectedDate);
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

  // Dark mode helper classes
  const cardClass = darkMode 
    ? 'bg-gray-800 text-white' 
    : 'bg-white text-gray-800';
  
  const inputClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
    : 'bg-white border-gray-300 text-gray-800';
  
  const tableRowClass = darkMode
    ? 'border-gray-700 hover:bg-gray-700'
    : 'border-gray-100 hover:bg-gray-50';


  const printReceipt = async (entry) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 220]
    });
  
    let yPos = 10;
    
    // Generate QR Code for verification
    const verifyUrl = `https://qm-financemanagement-production.up.railway.app/api/verify/${entry.receiptNo}`;
    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#1e40af', light: '#ffffff' }
      });
    } catch (err) {
      console.error('QR generation error:', err);
    }
  
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
  
    // QR Code Section
    if (qrDataUrl) {
      yPos += 3;
      
      // QR Code container
      doc.setFillColor(240, 249, 255);
      doc.roundedRect(8, yPos, 64, 35, 2, 2, 'F');
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.3);
      doc.roundedRect(8, yPos, 64, 35, 2, 2, 'S');
      
      // QR Code
      doc.addImage(qrDataUrl, 'PNG', 25, yPos + 2, 30, 30);
      
      // Scan text
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('SCAN TO VERIFY', 40, yPos + 33, { align: 'center' });
      
      yPos += 38;
    }

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
        await loadMyPermissions();
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
    // Total Income excludes School Fees Collection (entries with studentId)
    const totalIncome = calculateTotals(incomeEntries.filter(e => e.category !== 'Old Balance' && !e.studentId));
    const totalExpense = calculateTotals(expenseEntries);
    const oldBalance = getOldBalance();
    const netAmount = totalIncome - totalExpense + oldBalance;
    
    const today = selectedDate;
    // Only count fees from School Fees Collection tab (entries with studentId)
    const todaySchoolFees = incomeEntries
      .filter(e => e.date === today && e.studentId)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    // School Fees Modal State
    const [showFeesModal, setShowFeesModal] = useState(false);
    const [feesDateRange, setFeesDateRange] = useState('today');
    const [feesStartDate, setFeesStartDate] = useState(today);
    const [feesEndDate, setFeesEndDate] = useState(today);
    
    // Get filtered school fees based on date range
    const getFilteredSchoolFees = () => {
      let start, end;
      const todayDate = new Date();
      const todayStr = todayDate.toISOString().split('T')[0];
      
      switch(feesDateRange) {
        case 'today':
          start = todayStr;
          end = todayStr;
          break;
        case 'week':
          const weekStart = new Date(todayDate);
          weekStart.setDate(todayDate.getDate() - todayDate.getDay());
          start = weekStart.toISOString().split('T')[0];
          end = todayStr;
          break;
        case 'month':
          const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
          start = monthStart.toISOString().split('T')[0];
          end = todayStr;
          break;
        case 'term':
          const termStart = new Date(todayDate.getFullYear(), Math.floor(todayDate.getMonth() / 3) * 3, 1);
          start = termStart.toISOString().split('T')[0];
          end = todayStr;
          break;
        case 'year':
          const yearStart = new Date(todayDate.getFullYear(), 0, 1);
          start = yearStart.toISOString().split('T')[0];
          end = todayStr;
          break;
        case 'custom':
          start = feesStartDate;
          end = feesEndDate;
          break;
        default:
          start = todayStr;
          end = todayStr;
      }
      
      return incomeEntries.filter(e => e.studentId && e.date >= start && e.date <= end);
    };
    
    const filteredFees = showFeesModal ? getFilteredSchoolFees() : [];
    const filteredFeesTotal = filteredFees.reduce((sum, e) => sum + Number(e.amount), 0);

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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Today's Income</h3>
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(getTodayIncome())}</p>
            <p className="text-xs opacity-75 mt-2">{incomeEntries.filter(e => e.date === selectedDate && e.category !== 'Old Balance').length} transactions</p>
          </div>

          <div 
            onClick={() => setShowFeesModal(true)}
            className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:from-teal-600 hover:to-teal-700 transition-all transform hover:scale-105"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Today's School Fees</h3>
              <Receipt className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(todaySchoolFees)}</p>
            <p className="text-xs opacity-75 mt-2">Fees collected today • Click to view details</p>
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

        <div className={`rounded-xl shadow-md p-6 ${cardClass}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Recent Transactions</h3>
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
        {/* School Fees Details Modal */}
        {showFeesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">💰 School Fees Collection Details</h3>
                <button onClick={() => setShowFeesModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Date Range Filter */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="font-medium text-gray-700">Period:</span>
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                    { value: 'term', label: 'This Term' },
                    { value: 'year', label: 'This Year' },
                    { value: 'custom', label: 'Custom' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFeesDateRange(option.value)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        feesDateRange === option.value
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                
                {feesDateRange === 'custom' && (
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={feesStartDate}
                        onChange={(e) => setFeesStartDate(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={feesEndDate}
                        onChange={(e) => setFeesEndDate(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Card */}
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-6 text-white mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm opacity-80">Total Collected</p>
                    <p className="text-3xl font-bold">{formatCurrency(filteredFeesTotal)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm opacity-80">Number of Payments</p>
                    <p className="text-3xl font-bold">{filteredFees.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm opacity-80">Unique Students</p>
                    <p className="text-3xl font-bold">{new Set(filteredFees.map(f => f.studentId)).size}</p>
                  </div>
                </div>
              </div>

              {/* Payments Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Receipt No</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Student Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Class</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment Method</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Print</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFees.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-gray-500">
                          No school fees collected in this period
                        </td>
                      </tr>
                    ) : (
                      filteredFees
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((payment) => (
                          <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-medium text-blue-600">{payment.receiptNo}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{payment.date}</td>
                            <td className="py-3 px-4 text-sm text-gray-800 font-medium">{payment.studentName || 'N/A'}</td>
                            <td className="py-3 px-4 text-sm text-purple-600 font-medium">{payment.studentClass || 'N/A'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{payment.paymentMethod}</td>
                            <td className="py-3 px-4 text-sm text-green-600 font-bold text-right">{formatCurrency(payment.amount)}</td>
                            <td className="py-3 px-4 text-center">
                             <button
                              onClick={() => printReceipt(entry)}
                              className="text-purple-600 hover:text-purple-700"
                              title="Print Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEmailReceiptModal(entry)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Email Receipt"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                  {filteredFees.length > 0 && (
                    <tfoot>
                      <tr className="bg-teal-50 font-bold">
                        <td colSpan="5" className="py-3 px-4 text-sm text-gray-800">TOTAL</td>
                        <td className="py-3 px-4 text-sm text-teal-700 text-right">{formatCurrency(filteredFeesTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowFeesModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Income Title (Optional)</label>
              <input
                key="income-student"
                type="text"
                defaultValue={form.studentName}
                onChange={(e) => {
                  incomeFormRef.current.studentName = e.target.value;
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Today's Total Fees Collections"
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
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' or 'generate'
    const oldBalance = getOldBalance();

    // Date range states
    const [dateRange, setDateRange] = useState('today'); // today, week, month, term, year, custom
    
    // Ref to prevent recalculation loop
    const isCalculatingRef = useRef(false);
    
    // Calculate date ranges
    const getDateRange = () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      switch(dateRange) {
        case 'today':
          return { start: todayStr, end: todayStr, label: 'Today' };
        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          return { start: weekStart.toISOString().split('T')[0], end: todayStr, label: 'This Week' };
        case 'month':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return { start: monthStart.toISOString().split('T')[0], end: todayStr, label: 'This Month' };
        case 'term':
          // Assume term is 3 months
          const termStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
          return { start: termStart.toISOString().split('T')[0], end: todayStr, label: 'This Term' };
        case 'year':
          const yearStart = new Date(today.getFullYear(), 0, 1);
          return { start: yearStart.toISOString().split('T')[0], end: todayStr, label: 'This Year' };
        case 'custom':
          return { start: startDate, end: endDate, label: `${startDate} to ${endDate}` };
        default:
          return { start: todayStr, end: todayStr, label: 'Today' };
      }
    };

    // Calculate analytics - with loop prevention
    useEffect(() => {
      if (isCalculatingRef.current) return;
      isCalculatingRef.current = true;
      calculateAnalytics();
      // Reset after a short delay to allow future legitimate updates
      setTimeout(() => { isCalculatingRef.current = false; }, 500);
    }, [dateRange, startDate, endDate]);

    const calculateAnalytics = () => {
      // Only show loading on first load, not on updates (prevents blinking)
      if (!analyticsData) setLoadingAnalytics(true);
      const range = getDateRange();
      
      // Filter data by date range - exclude School Fees Collection (entries with studentId)
      const filteredIncome = incomeEntries.filter(e => 
        e.date >= range.start && e.date <= range.end && e.category !== 'Old Balance' && !e.studentId
      );
      
      // School Fees Collection entries (with studentId) - separate
      const filteredSchoolFees = incomeEntries.filter(e => 
        e.date >= range.start && e.date <= range.end && e.studentId
      );
      const filteredExpenses = expenseEntries.filter(e => 
        e.date >= range.start && e.date <= range.end
      );

      // Income by category
      const incomeByCategory = {};
      filteredIncome.forEach(e => {
        if (!incomeByCategory[e.category]) {
          incomeByCategory[e.category] = 0;
        }
        incomeByCategory[e.category] += Number(e.amount);
      });

      // Expenses by category
      const expensesByCategory = {};
      filteredExpenses.forEach(e => {
        if (!expensesByCategory[e.category]) {
          expensesByCategory[e.category] = 0;
        }
        expensesByCategory[e.category] += Number(e.amount);
      });

      // Payment methods breakdown
      const paymentMethods = {};
      filteredIncome.forEach(e => {
        const method = e.paymentMethod || 'Cash';
        if (!paymentMethods[method]) {
          paymentMethods[method] = 0;
        }
        paymentMethods[method] += Number(e.amount);
      });

      // School Fees specific totals - from filteredSchoolFees
      const schoolFeesTotal = filteredSchoolFees.reduce((sum, e) => sum + Number(e.amount), 0);
      const schoolFeesCount = filteredSchoolFees.length;

      // Daily breakdown for charts
      const dailyData = {};
      filteredIncome.forEach(e => {
        if (!dailyData[e.date]) {
          dailyData[e.date] = { date: e.date, income: 0, expenses: 0 };
        }
        dailyData[e.date].income += Number(e.amount);
      });
      filteredExpenses.forEach(e => {
        if (!dailyData[e.date]) {
          dailyData[e.date] = { date: e.date, income: 0, expenses: 0 };
        }
        dailyData[e.date].expenses += Number(e.amount);
      });

      // Today's data - exclude School Fees Collection from income
      const today = new Date().toISOString().split('T')[0];
      const todayIncome = incomeEntries.filter(e => e.date === today && e.category !== 'Old Balance' && !e.studentId);
      const todayExpenses = expenseEntries.filter(e => e.date === today);

      // Today's school fees - only from School Fees Collection tab (entries with studentId)
      const todaySchoolFees = incomeEntries.filter(e => e.date === today && e.studentId);

      setAnalyticsData({
        totalIncome: filteredIncome.reduce((sum, e) => sum + Number(e.amount), 0),
        totalExpenses: filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
        incomeCount: filteredIncome.length,
        expenseCount: filteredExpenses.length,
        incomeByCategory: Object.entries(incomeByCategory).map(([name, value]) => ({ name, value })),
        expensesByCategory: Object.entries(expensesByCategory).map(([name, value]) => ({ name, value })),
        paymentMethods: Object.entries(paymentMethods).map(([name, value]) => ({ name, value })),
        dailyTrend: Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)),
        todayIncome: todayIncome.reduce((sum, e) => sum + Number(e.amount), 0),
        todayExpenses: todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
        todayTransactions: todayIncome.length + todayExpenses.length,
        todaySchoolFees: todaySchoolFees.reduce((sum, e) => sum + Number(e.amount), 0),
        schoolFeesTotal,
        schoolFeesCount,
        dateRange: range
      });
      
      setLoadingAnalytics(false);
    };

    // Colors for charts
    const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
    
    // Simple Pie Chart Component
    const SimplePieChart = ({ data, title, colors = COLORS }) => {
      if (!data || data.length === 0) {
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
            <div className="text-center py-8 text-gray-500">No data available</div>
          </div>
        );
      }

      const total = data.reduce((sum, item) => sum + item.value, 0);
      let currentAngle = 0;

      return (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
          <div className="flex items-center justify-center">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {data.map((item, index) => {
                const percentage = (item.value / total) * 100;
                const angle = (percentage / 100) * 360;
                const startAngle = currentAngle;
                currentAngle += angle;
                
                const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
                const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
                const x2 = 100 + 80 * Math.cos((startAngle + angle - 90) * Math.PI / 180);
                const y2 = 100 + 80 * Math.sin((startAngle + angle - 90) * Math.PI / 180);
                const largeArcFlag = angle > 180 ? 1 : 0;

                return (
                  <path
                    key={index}
                    d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                    fill={colors[index % colors.length]}
                    stroke="white"
                    strokeWidth="2"
                  />
                );
              })}
              <circle cx="100" cy="100" r="40" fill="white" />
              <text x="100" y="95" textAnchor="middle" className="text-xs font-bold fill-gray-800">Total</text>
              <text x="100" y="115" textAnchor="middle" className="text-sm font-bold fill-gray-800">{formatCurrency(total).replace(' UGX', '')}</text>
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {data.slice(0, 6).map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }}></div>
                <span className="text-gray-600 truncate">{item.name}</span>
                <span className="font-bold text-gray-800 ml-auto">{((item.value / total) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    // Simple Bar Chart Component
    const SimpleBarChart = ({ data, title }) => {
      if (!data || data.length === 0) {
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
            <div className="text-center py-8 text-gray-500">No data available</div>
          </div>
        );
      }

      const maxValue = Math.max(...data.map(d => Math.max(d.income, d.expenses)));

      return (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
          <div className="flex items-end gap-2 h-48 overflow-x-auto">
            {data.slice(-14).map((item, index) => (
              <div key={index} className="flex flex-col items-center min-w-[40px]">
                <div className="flex gap-1 items-end h-36">
                  <div 
                    className="w-4 bg-green-500 rounded-t"
                    style={{ height: `${(item.income / maxValue) * 100}%`, minHeight: item.income > 0 ? '4px' : '0' }}
                    title={`Income: ${formatCurrency(item.income)}`}
                  ></div>
                  <div 
                    className="w-4 bg-red-500 rounded-t"
                    style={{ height: `${(item.expenses / maxValue) * 100}%`, minHeight: item.expenses > 0 ? '4px' : '0' }}
                    title={`Expenses: ${formatCurrency(item.expenses)}`}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top-left">
                  {item.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-600">Income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-600">Expenses</span>
            </div>
          </div>
        </div>
      );
    };

    // Analytics Dashboard
    const AnalyticsDashboard = () => {
      if (loadingAnalytics || !analyticsData) {
        return (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading analytics...</p>
          </div>
        );
      }

      const netAmount = analyticsData.totalIncome - analyticsData.totalExpenses;

      return (
        <div className="space-y-6">
          {/* Date Range Selector */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-gray-700">Period:</span>
              {[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'term', label: 'This Term' },
                { value: 'year', label: 'This Year' },
                { value: 'custom', label: 'Custom' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    dateRange === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div className="flex gap-4 mt-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Today's Quick Stats */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
            <h3 className="text-lg font-medium opacity-90 mb-4">📅 Today's Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white/20 rounded-lg p-4">
                <p className="text-sm opacity-80">Today's Income</p>
                <p className="text-2xl font-bold">{formatCurrency(analyticsData.todayIncome)}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4 border-2 border-white/40">
                <p className="text-sm opacity-80">Today's School Fees</p>
                <p className="text-2xl font-bold">{formatCurrency(analyticsData.todaySchoolFees || 0)}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="text-sm opacity-80">Today's Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(analyticsData.todayExpenses)}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="text-sm opacity-80">Today's Net</p>
                <p className="text-2xl font-bold">{formatCurrency(analyticsData.todayIncome - analyticsData.todayExpenses)}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="text-sm opacity-80">Transactions</p>
                <p className="text-2xl font-bold">{analyticsData.todayTransactions}</p>
              </div>
            </div>
          </div>

          {/* Period Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">Total Income</h3>
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(analyticsData.totalIncome)}</p>
              <p className="text-xs opacity-75 mt-2">{analyticsData.incomeCount} transactions • {analyticsData.dateRange.label}</p>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">School Fees</h3>
                <Receipt className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(analyticsData.schoolFeesTotal || 0)}</p>
              <p className="text-xs opacity-75 mt-2">{analyticsData.schoolFeesCount || 0} payments • {analyticsData.dateRange.label}</p>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">Total Expenses</h3>
                <DollarSign className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(analyticsData.totalExpenses)}</p>
              <p className="text-xs opacity-75 mt-2">{analyticsData.expenseCount} transactions • {analyticsData.dateRange.label}</p>
            </div>

            <div className={`bg-gradient-to-br ${netAmount >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-xl p-6 text-white shadow-lg`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">Net Amount</h3>
                <BarChart3 className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(netAmount)}</p>
              <p className="text-xs opacity-75 mt-2">{netAmount >= 0 ? 'Profit' : 'Loss'} • {analyticsData.dateRange.label}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">Overall Balance</h3>
                <Receipt className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(netAmount + oldBalance)}</p>
              <p className="text-xs opacity-75 mt-2">Including old balance</p>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SimplePieChart 
              data={analyticsData.incomeByCategory} 
              title="📊 Income by Category" 
              colors={['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6']}
            />
            <SimplePieChart 
              data={analyticsData.expensesByCategory} 
              title="📊 Expenses by Category" 
              colors={['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#14B8A6', '#6366F1']}
            />
            <SimplePieChart 
              data={analyticsData.paymentMethods} 
              title="💳 Payment Methods" 
              colors={['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6']}
            />
          </div>

          {/* Daily Trend Chart */}
          <SimpleBarChart 
            data={analyticsData.dailyTrend} 
            title="📈 Daily Income vs Expenses Trend"
          />

          {/* Top Categories Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Income Categories */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🏆 Top Income Categories</h3>
              <div className="space-y-3">
                {analyticsData.incomeByCategory
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5)
                  .map((cat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-800">{cat.name}</span>
                      </div>
                      <span className="font-bold text-green-600">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Top Expense Categories */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">💸 Top Expense Categories</h3>
              <div className="space-y-3">
                {analyticsData.expensesByCategory
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5)
                  .map((cat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-red-500' : index === 1 ? 'bg-red-400' : index === 2 ? 'bg-red-300' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-800">{cat.name}</span>
                      </div>
                      <span className="font-bold text-red-600">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      );
    };
    
    const getReportData = () => {
      // Exclude Old Balance AND School Fees Collection entries (those with studentId)
      let filteredIncome = incomeEntries.filter(e => e.category !== 'Old Balance' && !e.studentId);
      let filteredExpenses = expenseEntries;
      let reportTitle = '';
      let dateRangeStr = '';
      
      if (reportType === 'daily') {
        filteredIncome = filteredIncome.filter(e => e.date === selectedDate);
        filteredExpenses = filteredExpenses.filter(e => e.date === selectedDate);
        reportTitle = 'DAILY FINANCIAL REPORT';
        dateRangeStr = selectedDate;
      } else if (reportType === 'monthly') {
        const month = selectedDate.substring(0, 7);
        filteredIncome = filteredIncome.filter(e => e.date.startsWith(month));
        filteredExpenses = filteredExpenses.filter(e => e.date.startsWith(month));
        reportTitle = 'MONTHLY FINANCIAL REPORT';
        dateRangeStr = month;
      } else if (reportType === 'range') {
        filteredIncome = filteredIncome.filter(e => e.date >= startDate && e.date <= endDate);
        filteredExpenses = filteredExpenses.filter(e => e.date >= startDate && e.date <= endDate);
        reportTitle = 'DATE RANGE FINANCIAL REPORT';
        dateRangeStr = `${startDate} to ${endDate}`;
      } else if (reportType === 'category') {
        filteredIncome = filteredIncome.filter(e => e.date >= startDate && e.date <= endDate);
        filteredExpenses = filteredExpenses.filter(e => e.date >= startDate && e.date <= endDate);
        reportTitle = 'CATEGORY-WISE FINANCIAL REPORT';
        dateRangeStr = `${startDate} to ${endDate}`;
      }
      
      return { filteredIncome, filteredExpenses, reportTitle, dateRange: dateRangeStr };
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
        const { filteredIncome, filteredExpenses, reportTitle, dateRange: dateRangeStr } = getReportData();
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
        doc.text(`Date: ${dateRangeStr}`, 105, 32, { align: 'center' });
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
        
        const fileName = `${schoolName.replace(/\s+/g, '_')}_Report_${dateRangeStr.replace(/\s+/g, '_').replace(/\//g, '-')}.pdf`;
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
        const { filteredIncome, filteredExpenses, reportTitle, dateRange: dateRangeStr } = getReportData();
        
        const wb = XLSX.utils.book_new();
        
        if (reportType === 'category') {
          const breakdown = getCategoryBreakdown();
          const categories = Object.keys(breakdown).sort();
          
          const categoryData = [
            [schoolName],
            [reportTitle],
            [`Date: ${dateRangeStr}`],
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
            [`Date: ${dateRangeStr}`],
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
            [`Date: ${dateRangeStr}`],
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
            [`Period: ${dateRangeStr}`],
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
        
        const fileName = `${schoolName.replace(/\s+/g, '_')}_Report_${dateRangeStr.replace(/\s+/g, '_').replace(/\//g, '-')}.xlsx`;
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
      const { filteredIncome, filteredExpenses, reportTitle, dateRange: dateRangeStr } = getReportData();
      const totalIncome = calculateTotals(filteredIncome);
      const totalExpense = calculateTotals(filteredExpenses);
      const netAmount = totalIncome - totalExpense;
      
      let message = `*${schoolName}*\n${reportTitle}\nDate: ${dateRangeStr}\n\n`;
      
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
      const { filteredIncome, filteredExpenses, reportTitle, dateRange: dateRangeStr } = getReportData();
      const totalIncome = calculateTotals(filteredIncome);
      const totalExpense = calculateTotals(filteredExpenses);
      const netAmount = totalIncome - totalExpense;
      
      const subject = `${reportTitle} - ${dateRangeStr}`;
      let body = `${schoolName}\n${reportTitle}\nDate: ${dateRangeStr}\n\n`;
      
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
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">Reports & Analytics</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'analytics' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'generate' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              📄 Generate Report
            </button>
          </div>
        </div>

        {activeTab === 'analytics' ? (
          <AnalyticsDashboard />
        ) : (
          <>
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
          </>
        )}
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
        console.log('Search results:', data); // Debug - check what fields are available
        setSearchResults(data);
      }
    };

    const selectStudent = async (student) => {
      setLoadingStudent(true);
      setSearchResults([]);
      setSearchTerm(`${student.firstName} ${student.lastName}`);
      
      // Fetch full student data to get class info
      const studentRes = await api.get(`/students/${student.id}`);
      console.log('Full student data from API:', studentRes); // Debug - see what API returns
      
       if (studentRes.success) {
        const fullStudent = studentRes.data;
        console.log('Full student object:', fullStudent);
        console.log('All student fields:', Object.keys(fullStudent));
        
        // Debug class fields specifically
        console.log('CLASS DEBUG:', {
          'fullStudent.class': fullStudent.class,
          'fullStudent.className': fullStudent.className,
          'fullStudent.classId': fullStudent.classId
        });
        
        // Get class name - check all possible locations
        let finalClassName = '';
        if (fullStudent.class && typeof fullStudent.class === 'object') {
          finalClassName = fullStudent.class.name || '';
        } else if (fullStudent.className) {
          finalClassName = fullStudent.className;
        }
        
        console.log('Final className:', finalClassName);
        
        const mergedStudent = {
          ...student,
          ...fullStudent,
          fullName: fullStudent.fullName || student.fullName || `${student.firstName} ${student.lastName}`,
          className: finalClassName
        };
        console.log('Merged student with className:', mergedStudent.className);
        setSelectedStudent(mergedStudent);
      } else {
        setSelectedStudent(student);
      }
      
      // Fetch balance
      const balanceRes = await api.get(`/students/${student.id}/balance`);
      if (balanceRes.success) {
        setStudentBalance(balanceRes.data);
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
        
         // Create full entry with student info
        const studentFullName = selectedStudent.fullName || `${selectedStudent.firstName || ''} ${selectedStudent.lastName || ''}`.trim() || 'Unknown';
        const studentClassName = selectedStudent.className || '';
        
        console.log('Recording payment:', { studentFullName, studentClassName }); // Debug - see all fields
        
        const newEntry = {
          id: res.data.id,
          receiptNo: res.data.receiptNumber,
          date: new Date().toISOString().split('T')[0],
          studentName: studentFullName,
          studentClass: studentClassName,
          studentId: selectedStudent.id,
          category: 'School Fees',
          description: paymentForm.description || 'School fees payment',
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod.replace('_', ' ').toUpperCase(),
          balance: newBalance > 0 ? newBalance : 0
        };
        
        // Add to incomeEntries so it shows in Dashboard immediately
        setIncomeEntries(prev => [newEntry, ...prev]);
        
        // Print receipt
        await printReceipt(newEntry);
        
        // Refresh data with updated balance
        setStudentBalance(res.data.balance);
        loadRecentPayments();
        
        // Reset form
        setPaymentForm(prev => ({
          ...prev,
          amount: '',
          description: ''
        }));
        
        logAction('ADD', 'FEE_PAYMENT', `Recorded ${formatCurrency(newEntry.amount)} for ${newEntry.studentName}`);
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
                        <td className="py-3 px-4 text-sm text-gray-600">{student.guardianName || student.parentName || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{student.guardianPhone || student.parentPhone || 'N/A'}</td>
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
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium text-gray-700">Total Fees:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(studentBalance.totalFees || 0)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-gray-700">Total Paid:</span>
                    <span className="font-bold text-green-600">{formatCurrency(studentBalance.amountPaid || studentBalance.totalPaid || 0)}</span>
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

// Payment Plans Component
  const PaymentPlansManagement = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showCreatePlan, setShowCreatePlan] = useState(false);
    const [showAssignPlan, setShowAssignPlan] = useState(false);
    const [installmentFilter, setInstallmentFilter] = useState('');
    const [selectedInstallment, setSelectedInstallment] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    
    const [newPlan, setNewPlan] = useState({
      name: '',
      totalAmount: '',
      installments: 3
    });

    const [assignForm, setAssignForm] = useState({
      studentId: '',
      paymentPlanId: '',
      customAmount: '',
      dueDates: ['', '', '']
    });
    const [studentSearch, setStudentSearch] = useState('');
    const [studentResults, setStudentResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);

    const plansMgmtInitRef = useRef(false);
    
    const initRef = useRef(false);
    const lastFilterRef = useRef('');

    useEffect(() => {
      if (initRef.current) return;
      initRef.current = true;
      
      loadPaymentPlans();
      loadInstallments();
      loadPlanSummary();
    }, []);

    useEffect(() => {
      // Skip if this is the initial mount (already handled above)
      // or if filter hasn't actually changed
      const newFilter = installmentFilter ? `?${installmentFilter}=true` : '';
      if (!initRef.current || lastFilterRef.current === newFilter) return;
      
      lastFilterRef.current = newFilter;
      loadInstallments(newFilter, true); // force=true since user requested filter change
    }, [installmentFilter]);

    const searchStudents = async (query) => {
      if (query.length < 2) { setStudentResults([]); return; }
      const res = await api.get(`/students/search?q=${encodeURIComponent(query)}`);
      if (res.success) setStudentResults(Array.isArray(res.data) ? res.data : []);
    };

    const handleCreatePlan = async () => {
      if (!newPlan.name || !newPlan.totalAmount || !newPlan.installments) {
        alert('Please fill all fields');
        return;
      }
      const result = await createPaymentPlan(newPlan);
      if (result) {
        alert('Payment plan created!');
        setShowCreatePlan(false);
        setNewPlan({ name: '', totalAmount: '', installments: 3 });
      }
    };

    const handleAssignPlan = async () => {
      if (!selectedStudent || !assignForm.paymentPlanId) {
        alert('Please select student and plan');
        return;
      }
      
      const validDates = assignForm.dueDates.filter(d => d);
      if (validDates.length === 0) {
        alert('Please set at least one due date');
        return;
      }

      const success = await assignPlanToStudent({
        studentId: selectedStudent.id,
        paymentPlanId: assignForm.paymentPlanId,
        customAmount: assignForm.customAmount || null,
        dueDates: validDates
      });
      
      setShowAssignPlan(false);
      setSelectedStudent(null);
      setAssignForm({ studentId: '', paymentPlanId: '', customAmount: '', dueDates: ['', '', ''] });
      
      if (success) {
        // Reload data after assigning plan
        loadInstallments('', true);
        loadPlanSummary(true);
      }
    };

    const handleRecordPayment = async () => {
      if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
        alert('Enter valid amount');
        return;
      }
      const success = await recordInstallmentPayment(selectedInstallment.id, parseFloat(paymentAmount));
      if (success) {
        setSelectedInstallment(null);
        setPaymentAmount('');
        // Reload data after payment
        loadInstallments(installmentFilter ? `?${installmentFilter}=true` : '', true);
        loadPlanSummary(true);
      }
    };

    const getStatusBadge = (status) => {
      const styles = {
        pending: 'bg-yellow-100 text-yellow-700',
        partial: 'bg-blue-100 text-blue-700',
        paid: 'bg-green-100 text-green-700',
        overdue: 'bg-red-100 text-red-700'
      };
      return styles[status] || 'bg-gray-100 text-gray-700';
    };

    const updatePlanInstallments = (count, newPaymentPlanId = null) => {
      const newDates = Array(count).fill('');
      setAssignForm(prev => ({ 
        ...prev, 
        dueDates: newDates,
        ...(newPaymentPlanId !== null && { paymentPlanId: newPaymentPlanId })
      }));
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>📋 Payment Plans</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreatePlan(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Plan
            </button>
            <button
              onClick={() => setShowAssignPlan(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <User className="w-5 h-5" />
              Assign to Student
            </button>
          </div>
        </div>

        {planSummary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
              <p className="text-sm opacity-80">Active Plans</p>
              <p className="text-2xl font-bold">{planSummary.activePlans}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg">
              <p className="text-sm opacity-80">Overdue</p>
              <p className="text-2xl font-bold">{planSummary.overdueInstallments}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white shadow-lg">
              <p className="text-sm opacity-80">Due This Week</p>
              <p className="text-2xl font-bold">{planSummary.upcomingInstallments}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
              <p className="text-sm opacity-80">Total Expected</p>
              <p className="text-xl font-bold">{formatCurrency(planSummary.totalExpected)}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
              <p className="text-sm opacity-80">Total Collected</p>
              <p className="text-xl font-bold">{formatCurrency(planSummary.totalCollected)}</p>
            </div>
          </div>
        )}

        <div className={`rounded-xl shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'overview', label: '📊 All Installments' },
              { id: 'overdue', label: '🚨 Overdue' },
              { id: 'upcoming', label: '📅 Due Soon' },
              { id: 'plans', label: '📋 Plan Templates' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Always reload data on tab click
                  if (tab.id === 'overdue') {
                    setInstallmentFilter('overdue');
                    loadInstallments('?overdue=true', true);
                  } else if (tab.id === 'upcoming') {
                    setInstallmentFilter('upcoming');
                    loadInstallments('?upcoming=true', true);
                  } else if (tab.id === 'overview') {
                    setInstallmentFilter('');
                    loadInstallments('', true);
                  } else if (tab.id === 'plans') {
                    loadPaymentPlans(true);
                  }
                  // Always refresh summary
                  loadPlanSummary(true);
                }}
                className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? darkMode ? 'bg-gray-700 text-blue-400 border-b-2 border-blue-400' : 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== 'plans' && (
            <div className="p-6">
              {plansLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : installments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No installments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Student</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Plan</th>
                        <th className={`text-center py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Inst #</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Due Date</th>
                        <th className={`text-right py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Amount</th>
                        <th className={`text-right py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Paid</th>
                        <th className={`text-center py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                        <th className={`text-center py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst) => (
                        <tr key={inst.id} className={`border-b ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <td className="py-3 px-4">
                            <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{inst.studentName}</p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{inst.className}</p>
                          </td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{inst.planName}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold">
                              #{inst.installmentNumber}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {new Date(inst.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className={`py-3 px-4 text-sm text-right font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            {formatCurrency(inst.amount)}
                          </td>
                          <td className={`py-3 px-4 text-sm text-right font-medium ${inst.paidAmount > 0 ? 'text-green-600' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {formatCurrency(inst.paidAmount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(inst.status)}`}>
                              {inst.status.charAt(0).toUpperCase() + inst.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {inst.status !== 'paid' && (
                                <>
                                  <button
                                    onClick={() => setSelectedInstallment(inst)}
                                    className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium hover:bg-green-200"
                                  >
                                    Pay
                                  </button>
                                  {inst.phone && !inst.reminderSent && (
                                    <button
                                      onClick={() => sendInstallmentReminder(inst.id)}
                                      className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium hover:bg-blue-200"
                                    >
                                      📱 Remind
                                    </button>
                                  )}
                                  {inst.reminderSent && (
                                    <span className="text-xs text-gray-400">✓ Sent</span>
                                  )}
                                </>
                              )}
                              {inst.status === 'paid' && (
                                <span className="text-green-600 text-xs">✓ Complete</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paymentPlans.map((plan) => (
                  <div key={plan.id} className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                    <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{plan.name}</h4>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {plan.installments} installments × {formatCurrency(parseFloat(plan.totalAmount) / plan.installments)}
                    </p>
                    <p className="text-lg font-bold text-blue-600 mt-2">{formatCurrency(parseFloat(plan.totalAmount))}</p>
                  </div>
                ))}
                {paymentPlans.length === 0 && (
                  <div className={`col-span-full text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No payment plan templates yet. Create one to get started!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showCreatePlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-xl shadow-xl p-6 max-w-md w-full mx-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Create Payment Plan Template</h3>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Plan Name</label>
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    placeholder="e.g., Term 1 2025 - 3 Installments"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total Amount (UGX)</label>
                  <input
                    type="number"
                    value={newPlan.totalAmount}
                    onChange={(e) => setNewPlan({ ...newPlan, totalAmount: e.target.value })}
                    placeholder="e.g., 1500000"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Number of Installments</label>
                  <select
                    value={newPlan.installments}
                    onChange={(e) => setNewPlan({ ...newPlan, installments: parseInt(e.target.value) })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    {[2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n} Installments</option>
                    ))}
                  </select>
                </div>
                
                {newPlan.totalAmount && newPlan.installments && (
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
                    <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                      Each installment: <span className="font-bold">{formatCurrency(parseFloat(newPlan.totalAmount) / newPlan.installments)}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleCreatePlan} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium">
                  Create Plan
                </button>
                <button onClick={() => setShowCreatePlan(false)} className={`flex-1 px-6 py-2 rounded-lg font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-800'}`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAssignPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Assign Payment Plan to Student</h3>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Search Student</label>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                    placeholder="Type student name..."
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                  {studentResults.length > 0 && (
                    <div className={`mt-1 border rounded-lg max-h-40 overflow-y-auto ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                      {studentResults.map(s => (
                        <div
                          key={s.id}
                          onClick={() => { setSelectedStudent(s); setStudentSearch(`${s.firstName} ${s.lastName}`); setStudentResults([]); }}
                          className={`px-4 py-2 cursor-pointer ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-blue-50'}`}
                        >
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{s.firstName} {s.lastName}</p>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{s.studentNumber}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedStudent && (
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border`}>
                    <p className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{selectedStudent.firstName} {selectedStudent.lastName}</p>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{selectedStudent.studentNumber}</p>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Select Payment Plan</label>
                  <select
                    value={assignForm.paymentPlanId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const plan = paymentPlans.find(p => String(p.id) === selectedId);
                      if (plan) {
                        updatePlanInstallments(plan.installments, selectedId);
                      } else {
                        setAssignForm(prev => ({ ...prev, paymentPlanId: selectedId }));
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="">Select a plan...</option>
                    {paymentPlans.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.name} - {formatCurrency(parseFloat(p.totalAmount))}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Custom Amount (Optional)</label>
                  <input
                    type="number"
                    value={assignForm.customAmount}
                    onChange={(e) => setAssignForm({ ...assignForm, customAmount: e.target.value })}
                    placeholder="Leave empty to use plan default"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </div>

                {assignForm.dueDates.length > 0 && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Set Due Dates</label>
                    <div className="space-y-2">
                      {assignForm.dueDates.map((date, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className={`w-24 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Installment {idx + 1}:</span>
                          <input
                            type="date"
                            value={date}
                            onChange={(e) => {
                              const newDates = [...assignForm.dueDates];
                              newDates[idx] = e.target.value;
                              setAssignForm({ ...assignForm, dueDates: newDates });
                            }}
                            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleAssignPlan} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                  Assign Plan
                </button>
                <button onClick={() => { setShowAssignPlan(false); setSelectedStudent(null); }} className={`flex-1 px-6 py-2 rounded-lg font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-800'}`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedInstallment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-xl shadow-xl p-6 max-w-md w-full mx-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Record Installment Payment</h3>
              
              <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{selectedInstallment.studentName}</p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Installment #{selectedInstallment.installmentNumber} - {selectedInstallment.planName}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Amount Due:</span>
                    <span className={`ml-2 font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{formatCurrency(selectedInstallment.amount)}</span>
                  </div>
                  <div>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Already Paid:</span>
                    <span className="ml-2 font-bold text-green-600">{formatCurrency(selectedInstallment.paidAmount)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Remaining:</span>
                    <span className="ml-2 font-bold text-red-600">{formatCurrency(selectedInstallment.amount - selectedInstallment.paidAmount)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Payment Amount (UGX)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-xl font-bold ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setPaymentAmount((selectedInstallment.amount - selectedInstallment.paidAmount).toString())}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                  >
                    Full ({formatCurrency(selectedInstallment.amount - selectedInstallment.paidAmount)})
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleRecordPayment} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold">
                  Record Payment
                </button>
                <button onClick={() => { setSelectedInstallment(null); setPaymentAmount(''); }} className={`flex-1 px-6 py-2 rounded-lg font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-800'}`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

// User & Role Management Component
  const UserManagement = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [showAssignRole, setShowAssignRole] = useState(null);
    
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [editingRole, setEditingRole] = useState(null);
    
    const userMgmtInitRef = useRef(false);
    
    const userInitRef = useRef(false);

    useEffect(() => {
      if (userInitRef.current) return;
      userInitRef.current = true;
      
      loadRoles();
      loadUsersWithRoles();
    }, []);

    const handleAssignRole = async () => {
      if (!selectedRoleId) {
        alert('Please select a role');
        return;
      }
      await assignRole(showAssignRole.id, selectedRoleId);
      setShowAssignRole(null);
      setSelectedRoleId('');
    };

    const getRoleBadgeColor = (roleName) => {
      const colors = {
        admin: 'bg-red-100 text-red-700',
        bursar: 'bg-blue-100 text-blue-700',
        director: 'bg-purple-100 text-purple-700',
        accountant: 'bg-green-100 text-green-700',
        viewer: 'bg-gray-100 text-gray-700'
      };
      return colors[roleName] || 'bg-gray-100 text-gray-700';
    };

    const permissionModules = [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'income', label: 'Income' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'fees', label: 'School Fees' },
      { key: 'students', label: 'Students' },
      { key: 'reports', label: 'Reports' },
      { key: 'sms', label: 'SMS' },
      { key: 'budgets', label: 'Budgets' },
      { key: 'plans', label: 'Payment Plans' },
      { key: 'settings', label: 'Settings' },
      { key: 'users', label: 'Users' }
    ];

    const permissionActions = ['view', 'create', 'edit', 'delete'];

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>👥 User & Role Management</h2>
          <button
            onClick={initializeRoles}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Initialize Default Roles
          </button>
        </div>

        {/* Current User Info */}
        {userPermissions && (
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border`}>
            <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
              You are logged in as: <span className="font-bold">{user.name}</span> | 
              Role: <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(userPermissions.role)}`}>
                {userPermissions.role?.toUpperCase()}
              </span>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className={`rounded-xl shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'users', label: '👥 Users' },
              { id: 'roles', label: '🔐 Roles & Permissions' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? darkMode ? 'bg-gray-700 text-blue-400 border-b-2 border-blue-400' : 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>User</th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Username</th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Role</th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Last Login</th>
                      <th className={`text-center py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersWithRoles.length === 0 ? (
                      <tr>
                        <td colSpan="6" className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          No users found
                        </td>
                      </tr>
                    ) : (
                      usersWithRoles.map((u) => (
                        <tr key={u.id} className={`border-b ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <td className="py-3 px-4">
                            <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{u.fullName}</p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{u.email || 'No email'}</p>
                          </td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{u.username}</td>
                          <td className="py-3 px-4">
                            {u.role ? (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role.name)}`}>
                                {u.role.name.toUpperCase()}
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                NO ROLE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => { setShowAssignRole(u); setSelectedRoleId(u.role?.id || ''); }}
                              className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-medium hover:bg-blue-200"
                            >
                              Assign Role
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Roles Tab */}
          {activeTab === 'roles' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <div key={role.id} className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRoleBadgeColor(role.name)}`}>
                          {role.name.toUpperCase()}
                        </span>
                        <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {role.description || 'No description'}
                        </p>
                      </div>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {role._count?.users || 0} users
                      </span>
                    </div>
                    <button
                      onClick={() => setEditingRole(role)}
                      className={`w-full mt-2 px-3 py-2 rounded text-sm font-medium ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      Edit Permissions
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assign Role Modal */}
        {showAssignRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-xl shadow-xl p-6 max-w-md w-full mx-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Assign Role to {showAssignRole.fullName}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Select Role</label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="">Select a role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name.toUpperCase()} - {r.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleAssignRole} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                  Assign Role
                </button>
                <button onClick={() => setShowAssignRole(null)} className={`flex-1 px-6 py-2 rounded-lg font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-800'}`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Permissions Modal */}
        {editingRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-xl shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Edit Permissions: <span className={`${getRoleBadgeColor(editingRole.name)} px-2 py-1 rounded`}>{editingRole.name.toUpperCase()}</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-2 px-3 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Module</th>
                      {permissionActions.map(action => (
                        <th key={action} className={`text-center py-2 px-3 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionModules.map(module => (
                      <tr key={module.key} className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                        <td className={`py-2 px-3 font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{module.label}</td>
                        {permissionActions.map(action => (
                          <td key={action} className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={editingRole.permissions?.[module.key]?.[action] || false}
                              onChange={(e) => {
                                const newPerms = { ...editingRole.permissions };
                                if (!newPerms[module.key]) newPerms[module.key] = {};
                                newPerms[module.key][action] = e.target.checked;
                                setEditingRole({ ...editingRole, permissions: newPerms });
                              }}
                              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => {
                    updateRolePermissions(editingRole.id, editingRole.permissions);
                    setEditingRole(null);
                  }} 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Save Permissions
                </button>
                <button onClick={() => setEditingRole(null)} className={`flex-1 px-6 py-2 rounded-lg font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-800'}`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  // Budget Management Component
  const BudgetManagement = () => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedPeriod, setSelectedPeriod] = useState('monthly');
    const [showSetBudgets, setShowSetBudgets] = useState(false);
    const [budgetInputs, setBudgetInputs] = useState({});
    const [savingBudgets, setSavingBudgets] = useState(false);

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const budgetInitRef = useRef(false);
    const lastBudgetParamsRef = useRef('');
    
    useEffect(() => {
      const paramsKey = `${selectedYear}-${selectedMonth}-${selectedPeriod}`;
      const isParamChange = lastBudgetParamsRef.current !== '' && lastBudgetParamsRef.current !== paramsKey;
      
      // Skip if same params (prevents loops) 
      if (budgetInitRef.current && lastBudgetParamsRef.current === paramsKey) return;
      
      budgetInitRef.current = true;
      lastBudgetParamsRef.current = paramsKey;
      
      // Force reload if user changed params, otherwise normal load
      loadBudgets(selectedYear, selectedMonth, selectedPeriod, isParamChange);
      loadBudgetSummary(selectedYear, selectedMonth, isParamChange);
    }, [selectedYear, selectedMonth, selectedPeriod]);

    const initializeBudgetInputs = () => {
      const inputs = {};
      expenseCategories.forEach(cat => {
        const existing = budgets.find(b => b.category === cat);
        inputs[cat] = existing ? existing.amount.toString() : '';
      });
      setBudgetInputs(inputs);
      setShowSetBudgets(true);
    };

    const handleSaveBulkBudgets = async () => {
      setSavingBudgets(true);
      const budgetsToSave = Object.entries(budgetInputs)
        .filter(([_, amount]) => amount && parseFloat(amount) > 0)
        .map(([category, amount]) => ({ category, amount: parseFloat(amount) }));
      
      await saveBulkBudgets(budgetsToSave, selectedPeriod, selectedYear, selectedMonth);
      setSavingBudgets(false);
      setShowSetBudgets(false);
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'exceeded': return 'bg-red-500';
        case 'warning': return 'bg-yellow-500';
        default: return 'bg-green-500';
      }
    };

    const getStatusBg = (status) => {
      switch (status) {
        case 'exceeded': return darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200';
        case 'warning': return darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200';
        default: return darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200';
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>💰 Budget Tracking</h2>
          <button
            onClick={initializeBudgetInputs}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Set Budgets
          </button>
        </div>

        {/* Period Selector */}
        <div className={`rounded-xl shadow-md p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Period Type</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {selectedPeriod === 'monthly' && (
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  {months.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Budget Summary Cards */}
        {budgetSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`rounded-xl p-6 shadow-lg ${darkMode ? 'bg-gradient-to-br from-blue-600 to-blue-700' : 'bg-gradient-to-br from-blue-500 to-blue-600'} text-white`}>
              <p className="text-sm opacity-80">Total Budget</p>
              <p className="text-2xl font-bold">{formatCurrency(budgetSummary.totalBudget)}</p>
              <p className="text-xs opacity-70 mt-1">{selectedPeriod === 'monthly' ? months[selectedMonth - 1] : 'Full Year'} {selectedYear}</p>
            </div>
            
            <div className={`rounded-xl p-6 shadow-lg ${darkMode ? 'bg-gradient-to-br from-red-600 to-red-700' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white`}>
              <p className="text-sm opacity-80">Total Spent</p>
              <p className="text-2xl font-bold">{formatCurrency(budgetSummary.totalSpent)}</p>
              <p className="text-xs opacity-70 mt-1">{budgetSummary.percentage}% of budget</p>
            </div>
            
            <div className={`rounded-xl p-6 shadow-lg ${
              budgetSummary.remaining >= 0 
                ? (darkMode ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-green-500 to-green-600')
                : (darkMode ? 'bg-gradient-to-br from-orange-600 to-orange-700' : 'bg-gradient-to-br from-orange-500 to-orange-600')
            } text-white`}>
              <p className="text-sm opacity-80">{budgetSummary.remaining >= 0 ? 'Remaining' : 'Over Budget'}</p>
              <p className="text-2xl font-bold">{formatCurrency(Math.abs(budgetSummary.remaining))}</p>
              <p className="text-xs opacity-70 mt-1">{budgetSummary.remaining >= 0 ? 'Available to spend' : 'Exceeded!'}</p>
            </div>
            
            <div className={`rounded-xl p-6 shadow-lg ${
              budgetSummary.overBudgetCount === 0
                ? (darkMode ? 'bg-gradient-to-br from-purple-600 to-purple-700' : 'bg-gradient-to-br from-purple-500 to-purple-600')
                : (darkMode ? 'bg-gradient-to-br from-red-700 to-red-800' : 'bg-gradient-to-br from-red-600 to-red-700')
            } text-white`}>
              <p className="text-sm opacity-80">Categories Over Budget</p>
              <p className="text-2xl font-bold">{budgetSummary.overBudgetCount}</p>
              <p className="text-xs opacity-70 mt-1">{budgetSummary.overBudgetCount === 0 ? 'All good! ✓' : 'Need attention!'}</p>
            </div>
          </div>
        )}

        {/* Overall Progress Bar */}
        {budgetSummary && budgetSummary.totalBudget > 0 && (
          <div className={`rounded-xl shadow-md p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Overall Budget Usage</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                budgetSummary.status === 'exceeded' ? 'bg-red-100 text-red-700' :
                budgetSummary.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {budgetSummary.status === 'exceeded' ? '🚨 Over Budget' :
                 budgetSummary.status === 'warning' ? '⚠️ Warning' : '✅ On Track'}
              </span>
            </div>
            <div className={`w-full h-6 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className={`h-6 rounded-full transition-all duration-500 ${getStatusColor(budgetSummary.status)} flex items-center justify-end pr-2`}
                style={{ width: `${Math.min(budgetSummary.percentage, 100)}%` }}
              >
                {budgetSummary.percentage >= 20 && (
                  <span className="text-white text-sm font-bold">{budgetSummary.percentage}%</span>
                )}
              </div>
            </div>
            <div className="flex justify-between mt-2">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Spent: {formatCurrency(budgetSummary.totalSpent)}
              </span>
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Budget: {formatCurrency(budgetSummary.totalBudget)}
              </span>
            </div>
          </div>
        )}

        {/* Budget by Category */}
        <div className={`rounded-xl shadow-md p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Budget by Category</h3>
          
          {budgetLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading budgets...</p>
            </div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No budgets set for this period</p>
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>Click "Set Budgets" to create your first budget</p>
              <button
                onClick={initializeBudgetInputs}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                Set Budgets Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map((budget) => (
                <div
                  key={budget.id}
                  className={`p-4 rounded-lg border-2 ${getStatusBg(budget.status)}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{budget.category}</h4>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatCurrency(budget.spent)} of {formatCurrency(budget.amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${
                        budget.status === 'exceeded' ? 'text-red-600' :
                        budget.status === 'warning' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {budget.percentage}%
                      </span>
                      <p className={`text-sm ${
                        budget.remaining >= 0 
                          ? (darkMode ? 'text-green-400' : 'text-green-600')
                          : (darkMode ? 'text-red-400' : 'text-red-600')
                      }`}>
                        {budget.remaining >= 0 
                          ? `${formatCurrency(budget.remaining)} left`
                          : `${formatCurrency(Math.abs(budget.remaining))} over`
                        }
                      </p>
                    </div>
                  </div>
                  <div className={`w-full h-3 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${getStatusColor(budget.status)}`}
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Over Budget Alerts */}
        {budgetSummary && budgetSummary.overBudgetCategories?.length > 0 && (
          <div className={`rounded-xl shadow-md p-6 border-2 ${darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'}`}>
            <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
              🚨 Over Budget Alerts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {budgetSummary.overBudgetCategories.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-lg ${darkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
                  <p className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{item.category}</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Budget: {formatCurrency(item.budget)} | Spent: {formatCurrency(item.spent)}
                  </p>
                  <p className="text-red-600 font-bold">
                    Over by: {formatCurrency(item.over)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Set Budgets Modal */}
        {showSetBudgets && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  💰 Set {selectedPeriod === 'monthly' ? months[selectedMonth - 1] : 'Yearly'} {selectedYear} Budgets
                </h3>
                <button onClick={() => setShowSetBudgets(false)} className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Set budget amounts for each expense category. Leave empty to skip a category.
              </p>

              <div className="space-y-4">
                {expenseCategories.map((category) => (
                  <div key={category} className="flex items-center gap-4">
                    <label className={`w-48 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{category}</label>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={budgetInputs[category] || ''}
                        onChange={(e) => setBudgetInputs({ ...budgetInputs, [category]: e.target.value })}
                        placeholder="Enter budget amount"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300'}`}
                      />
                      <span className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>UGX</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Set Buttons */}
              <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Quick Set All Categories:</p>
                <div className="flex flex-wrap gap-2">
                  {[100000, 200000, 500000, 1000000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => {
                        const newInputs = {};
                        expenseCategories.forEach(cat => newInputs[cat] = amount.toString());
                        setBudgetInputs(newInputs);
                      }}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${darkMode ? 'bg-blue-800 text-blue-200 hover:bg-blue-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                  <button
                    onClick={() => setBudgetInputs({})}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveBulkBudgets}
                  disabled={savingBudgets}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingBudgets ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5" />
                      Save Budgets
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowSetBudgets(false)}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
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



// Email Receipt Modal Component
  const EmailReceiptModal = ({ receipt, onClose }) => {
    const [email, setEmail] = useState(receipt?.student?.parentEmail || '');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
      if (!email) {
        alert('Please enter an email address');
        return;
      }
      setSending(true);
      const success = await sendReceiptEmail(receipt.id, email);
      setSending(false);
      if (success) onClose();
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`rounded-xl shadow-xl p-6 max-w-md w-full mx-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            📧 Email Receipt
          </h3>
          
          <div className={`p-3 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Receipt: <span className="font-bold">{receipt?.receiptNumber}</span>
            </p>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Amount: <span className="font-bold text-green-600">UGX {receipt?.amount?.toLocaleString()}</span>
            </p>
          </div>

          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Send to Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@email.com"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleSend} 
              disabled={sending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Email
                </>
              )}
            </button>
            <button 
              onClick={onClose} 
              className={`flex-1 px-6 py-2 rounded-lg font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-800'}`}
            >
              Cancel
            </button>
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
           

           {/* Email Settings Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-800">Email Settings (SMTP)</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Configure email settings to send receipts to parents via email.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
              <input
                type="text"
                placeholder="587"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
              <input
                type="text"
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
              <input
                type="email"
                placeholder="noreply@school.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
              <input
                type="text"
                placeholder="School Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
              Save Email Settings
            </button>
            <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium">
              Send Test Email
            </button>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Gmail Users:</strong> Use an "App Password" instead of your regular password. 
              Generate one in Google Account → Security → 2-Step Verification → App passwords.
            </p>
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
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
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
                onClick={() => setDarkMode(!darkMode)}
                className="bg-blue-700 hover:bg-blue-800 p-2 rounded-lg"
                title={darkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
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

      <nav className={`shadow-md print:hidden transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
  <div className="max-w-7xl mx-auto px-4">
    <div className="flex gap-0 overflow-x-auto">
     {[
        { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'fees', label: 'Fees', icon: <Receipt className="w-4 h-4" /> },
        { id: 'income', label: 'Income', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'expenses', label: 'Expenses', icon: <DollarSign className="w-4 h-4" /> },
        { id: 'students', label: 'Students', icon: <User className="w-4 h-4" /> },
        { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
        { id: 'sms', label: 'SMS', icon: <MessageSquare className="w-4 h-4" /> },
        { id: 'budgets', label: 'Budgets', icon: <DollarSign className="w-4 h-4" /> },
        { id: 'plans', label: 'Plans', icon: <Calendar className="w-4 h-4" /> },
        { id: 'users', label: 'Users', icon: <Shield className="w-4 h-4" />, requiresAdmin: true },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> }
      ].filter(item => !item.requiresAdmin || hasPermission('users', 'view')).map(item => (
        <button
          key={item.id}
          onClick={() => setCurrentView(item.id)}
          className={`flex items-center gap-1 px-3 py-3 text-xs font-medium transition-colors whitespace-nowrap ${
            currentView === item.id
              ? darkMode 
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700'
                : 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : darkMode
                ? 'text-gray-300 hover:text-blue-400 hover:bg-gray-700'
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
  {currentView === 'budgets' && <BudgetManagement />}
  {currentView === 'plans' && <PaymentPlansManagement />}
  {currentView === 'users' && <UserManagement />}
  {currentView === 'sms' && <SMSCenter 
  smsStats={smsStats} smsHistory={smsHistory} defaulters={defaulters}
  selectedDefaulters={selectedDefaulters} defaultersLoading={defaultersLoading}
  smsMessage={smsMessage} setSmsMessage={setSmsMessage}
  smsPhone={smsPhone} setSmsPhone={setSmsPhone}
  smsTemplate={smsTemplate} setSmsTemplate={setSmsTemplate}
  smsStudentSearch={smsStudentSearch} setSmsStudentSearch={setSmsStudentSearch}
  smsSearchResults={smsSearchResults} selectedSmsStudent={selectedSmsStudent}
  setSelectedSmsStudent={setSelectedSmsStudent} setSmsSearchResults={setSmsSearchResults}
  minBalance={minBalance} setMinBalance={setMinBalance}
  smsFilterClass={smsFilterClass} setSmsFilterClass={setSmsFilterClass}
  classes={classes} smsLoading={smsLoading}
  loadSmsStats={loadSmsStats} loadSmsHistory={loadSmsHistory}
  loadDefaulters={loadDefaulters} loadClasses={loadClasses}
  searchSmsStudents={searchSmsStudents} selectSmsStudent={selectSmsStudent}
  applySmsTemplate={applySmsTemplate} sendSms={sendSms} sendBulkSms={sendBulkSms}
  toggleDefaulterSelection={toggleDefaulterSelection} selectAllDefaulters={selectAllDefaulters}
  formatCurrency={formatCurrency} smsTemplates={smsTemplates}
/>}
  {currentView === 'settings' && <Settings />}
    </main>

    {/* Email Receipt Modal */}
    {emailReceiptModal && (
      <EmailReceiptModal 
        receipt={emailReceiptModal} 
        onClose={() => setEmailReceiptModal(null)} 
      />
    )}
    </div>
  );
};

export default SchoolFinanceApp;