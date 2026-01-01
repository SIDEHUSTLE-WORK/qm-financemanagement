/**
 * QM Finance API Client
 * Handles all communication with the backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token storage
let accessToken = localStorage.getItem('qm_access_token');
let refreshToken = localStorage.getItem('qm_refresh_token');

// Token management
const setTokens = (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('qm_access_token', access);
  localStorage.setItem('qm_refresh_token', refresh);
};

const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('qm_access_token');
  localStorage.removeItem('qm_refresh_token');
  localStorage.removeItem('qm_user');
  localStorage.removeItem('qm_school');
};

const getAccessToken = () => accessToken;

// HTTP client with automatic token refresh
const request = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    let response = await fetch(url, {
      ...options,
      headers
    });

    // If token expired, try to refresh
    if (response.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        response = await fetch(url, { ...options, headers });
      } else {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Refresh access token
const refreshAccessToken = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (data.success && data.data.accessToken) {
      accessToken = data.data.accessToken;
      localStorage.setItem('qm_access_token', accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ==================== AUTH API ====================
export const authApi = {
  login: async (username, password) => {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (response.success) {
      const { tokens, user, school } = response.data;
      setTokens(tokens.accessToken, tokens.refreshToken);
      localStorage.setItem('qm_user', JSON.stringify(user));
      localStorage.setItem('qm_school', JSON.stringify(school));
    }
    
    return response;
  },

  logout: async () => {
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });
    } finally {
      clearTokens();
    }
  },

  getProfile: () => request('/auth/profile'),

  changePassword: (currentPassword, newPassword) => 
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    }),

  isAuthenticated: () => !!accessToken,

  getCurrentUser: () => {
    const user = localStorage.getItem('qm_user');
    return user ? JSON.parse(user) : null;
  },

  getCurrentSchool: () => {
    const school = localStorage.getItem('qm_school');
    return school ? JSON.parse(school) : null;
  }
};

// ==================== INCOME API ====================
export const incomeApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/income${query ? `?${query}` : ''}`);
  },

  getById: (id) => request(`/income/${id}`),

  create: (data) => request('/income', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => request(`/income/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  void: (id, reason) => request(`/income/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),

  getSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/income/summary${query ? `?${query}` : ''}`);
  },

  getCategories: () => request('/income/categories')
};

// ==================== EXPENSE API ====================
export const expenseApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/expenses${query ? `?${query}` : ''}`);
  },

  getById: (id) => request(`/expenses/${id}`),

  create: (data) => request('/expenses', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => request(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  void: (id, reason) => request(`/expenses/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),

  getSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/expenses/summary${query ? `?${query}` : ''}`);
  },

  getCategories: () => request('/expenses/categories')
};

// ==================== STUDENT API ====================
export const studentApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/students${query ? `?${query}` : ''}`);
  },

  getById: (id) => request(`/students/${id}`),

  create: (data) => request('/students', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => request(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  search: (q) => request(`/students/search?q=${encodeURIComponent(q)}`),

  getBalance: (id, termId) => {
    const query = termId ? `?termId=${termId}` : '';
    return request(`/students/${id}/balance${query}`);
  },

  getAllWithBalances: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/students/balances${query ? `?${query}` : ''}`);
  },

  getClasses: () => request('/students/classes')
};

// ==================== REPORT API ====================
export const reportApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/reports${query ? `?${query}` : ''}`);
  },

  generateDaily: (date) => 
    request(`/reports/daily${date ? `?date=${date}` : ''}`),

  generateMonthly: (year, month) => 
    request(`/reports/monthly?year=${year}&month=${month}`),

  generateRange: (startDate, endDate) => 
    request(`/reports/range?startDate=${startDate}&endDate=${endDate}`),

  generateStudentBalances: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/reports/student-balances${query ? `?${query}` : ''}`);
  },

  delete: (id) => request(`/reports/${id}`, { method: 'DELETE' })
};

// ==================== DASHBOARD API ====================
export const dashboardApi = {
  getSummary: () => request('/dashboard/summary')
};

// ==================== PRINT API ====================
export const printApi = {
  getReceiptData: (id) => request(`/print/receipt/${id}`, { method: 'POST' }),

  printThermal: (id, printerConfig = {}) => 
    request(`/print/thermal/${id}`, {
      method: 'POST',
      body: JSON.stringify({ printerConfig })
    })
};

// ==================== SETTINGS API ====================
export const settingsApi = {
  get: () => request('/settings'),

  getTerms: () => request('/terms'),

  getCurrentTerm: () => request('/terms/current')
};

// ==================== AUDIT API ====================
export const auditApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit-logs${query ? `?${query}` : ''}`);
  }
};

// Export default API object
export default {
  auth: authApi,
  income: incomeApi,
  expense: expenseApi,
  student: studentApi,
  report: reportApi,
  dashboard: dashboardApi,
  print: printApi,
  settings: settingsApi,
  audit: auditApi,
  getAccessToken,
  clearTokens,
  isAuthenticated: authApi.isAuthenticated
};
