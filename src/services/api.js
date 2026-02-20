import axios from 'axios';

// API base URL - ajuste conforme necessário
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003/api';

// Instância do axios com configuração base
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor para tratar erros e respostas
api.interceptors.response.use(
  response => response,
  error => {
    console.error('Erro na requisição API:', error.message, error.config?.url);
    
    // Adiciona flag para identificar que houve erro na API
    error.isApiError = true;
    
    // Guarda URL que falhou para referência
    if (error.config) {
      error.failedUrl = error.config.url;
    }
    
    return Promise.reject(error);
  }
);

// Funções de API
const apiService = {
  // Testes e status
  testConnection: () => api.get('/test'),
  getStatus: () => api.get('/status'),
  
  // Períodos de pagamento
  getPayrollPeriods: () => api.get('/payroll-periods'),
  getCurrentPayrollPeriod: () => api.get('/current-payroll-period'),
  
  // Horas de trabalho
  getWorkHours: (userId, periodId) => api.get(`/work-hours/${userId}/${periodId}`),
  saveWorkHours: (workHourData) => api.post('/work-hours', workHourData),
  syncWorkHours: (userId, hoursData) => api.post('/sync-work-hours', { userId, hours: hoursData }),
  
  // Estatísticas
  getWeeklyStats: (userId, periodId) => api.get(`/weekly-stats/${userId}/${periodId}`),
  getPeriodStats: (userId, periodId) => api.get(`/period-stats/${userId}/${periodId}`),
  
  // Ações do período
  resetPeriodHours: (userId, periodId) => api.post(`/reset-period/${userId}/${periodId}`),
  setStandardHours: (userId, periodId) => api.post(`/set-standard-hours/${userId}/${periodId}`),
  
  // Outras informações
  getPublicHolidays: (year) => api.get(`/public-holidays/${year}`),
  getHourlyRate: (userId) => api.get(`/hourly-rate/${userId}`)
};

export default apiService;