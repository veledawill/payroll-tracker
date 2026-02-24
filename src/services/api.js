import axios from "axios";

// API base URL — override with REACT_APP_API_URL environment variable for production
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3003/api";

// Axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API request error:", error.message, error.config?.url);

    // Flag to identify API errors
    error.isApiError = true;

    // Store the failed URL for reference
    if (error.config) {
      error.failedUrl = error.config.url;
    }

    return Promise.reject(error);
  }
);

// API service methods
const apiService = {
  // Health & status
  testConnection: () => api.get("/test"),
  getStatus: () => api.get("/status", { timeout: 3000 }),

  // Payroll periods
  getPayrollPeriods: () => api.get("/payroll-periods"),
  getCurrentPayrollPeriod: () => api.get("/current-payroll-period"),

  // Work hours
  getWorkHours: (userId, periodId) =>
    api.get(`/work-hours/${userId}/${periodId}`),
  saveWorkHours: (workHourData) => api.post("/work-hours", workHourData),
  syncWorkHours: (userId, hoursData) =>
    api.post("/sync-work-hours", { userId, hours: hoursData }),

  // Statistics
  getWeeklyStats: (userId, periodId) =>
    api.get(`/weekly-stats/${userId}/${periodId}`),
  getPeriodStats: (userId, periodId) =>
    api.get(`/period-stats/${userId}/${periodId}`),

  // Period actions
  resetPeriodHours: (userId, periodId) =>
    api.post(`/reset-period/${userId}/${periodId}`),
  setStandardHours: (userId, periodId) =>
    api.post(`/set-standard-hours/${userId}/${periodId}`),

  // Other data
  getPublicHolidays: (year) => api.get(`/public-holidays/${year}`),
  getHourlyRate: (userId) => api.get(`/hourly-rate/${userId}`),
};

export default apiService;
