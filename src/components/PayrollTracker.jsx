import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, DollarSign, Clock, Database, CloudOff } from 'lucide-react';
import apiService from '../services/api';
import syncService from '../services/syncService';
import OfflineManager from './OfflineManager';

const MIN_HOURS = 0;
const MAX_HOURS = 12;
const STANDARD_HOURS_BY_DAY = {
  0: 0,  // Sunday
  1: 10, // Monday
  2: 10, // Tuesday
  3: 4.5,  // Wednesday
  4: 4.5, // Thursday
  5: 6, // Friday
  6: 0   // Saturday
};
// O ID de usuário padrão - em uma versão futura, isso seria gerenciado com autenticação
const DEFAULT_USER_ID = '680db60ba77dff12ddc79e2d';

const PayrollTracker = () => {
  // Estado
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [workHours, setWorkHours] = useState({});
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [apiStatus, setApiStatus] = useState({ status: 'unknown', message: 'Verificando conexão...' });
  const [totalStats, setTotalStats] = useState({ hours: 0, salary: 0, grossSalary: 0, tax: 0 });
  const [showRateInfo, setShowRateInfo] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(34); // Changed default to 34
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [publicHolidays, setPublicHolidays] = useState([]);

  // Carregar dados iniciais ao montar o componente
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Teste de conexão com a API
        try {
          const response = await apiService.testConnection();
          console.log('Teste de API bem-sucedido:', response.data);
          setApiStatus({ status: 'connected', message: 'Conectado à API com sucesso' });
          setIsOffline(false);
        } catch (error) {
          console.error('Erro no teste de API:', error.message);
          setApiStatus({ status: 'error', message: `Erro: ${error.message}` });
          setIsOffline(true);
          
          // Usar dados locais de backup
          loadFromLocalStorage();
          setIsLoading(false);
          return;
        }
        
        // Se chegamos aqui, a API está online
        
        // Carregar períodos de pagamento
        const periodsResponse = await apiService.getPayrollPeriods();
        const apiPeriods = periodsResponse.data.map(period => ({
          id: period._id,
          start: new Date(period.start_date).toISOString().split('T')[0],
          end: new Date(period.end_date).toISOString().split('T')[0],
          label: period.period_label
        }));
        setPayrollPeriods(apiPeriods);
        
        // Carregar período atual
        const currentPeriodResponse = await apiService.getCurrentPayrollPeriod();
        const currentPeriod = {
          id: currentPeriodResponse.data._id,
          start: new Date(currentPeriodResponse.data.start_date).toISOString().split('T')[0],
          end: new Date(currentPeriodResponse.data.end_date).toISOString().split('T')[0],
          label: currentPeriodResponse.data.period_label
        };
        setSelectedPeriod(currentPeriod);
        
        // Carregar taxa horária - Force to 34 if different
        try {
          const rateResponse = await apiService.getHourlyRate(DEFAULT_USER_ID);
          const fetchedRate = rateResponse.data.hourly_rate;
          console.log('Fetched hourly rate:', fetchedRate);
          // Always use 34
          setHourlyRate(34);
        } catch (rateError) {
          console.error('Error fetching hourly rate:', rateError);
          // Use default 34
          setHourlyRate(34);
        }
        
        // Carregar feriados para 2025
        const holidaysResponse = await apiService.getPublicHolidays(2025);
        setPublicHolidays(
          holidaysResponse.data.map(h => new Date(h.holiday_date).toISOString().split('T')[0])
        );
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        setError("Erro ao carregar dados do servidor. Usando modo offline.");
        setIsOffline(true);
        
        // Usar dados locais de backup
        loadFromLocalStorage();
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  // Função para carregar dados do localStorage como backup
  const loadFromLocalStorage = () => {
    try {
      // Always set hourly rate to 34 in offline mode
      setHourlyRate(34);
      
      // Carregar horas de trabalho
      const storedHours = localStorage.getItem('lass_work_hours');
      if (storedHours) {
        const parsedHours = JSON.parse(storedHours);
        const hours = {};
        
        // Converter formato de armazenamento para formato de uso
        Object.keys(parsedHours).forEach(date => {
          if (typeof parsedHours[date] === 'object') {
            // New format with clock-in time
            hours[date] = {
              hours: parsedHours[date].hours || 0,
              clockIn: parsedHours[date].clockIn || ''
            };
          } else {
            // Legacy format (just hours)
            hours[date] = {
              hours: parsedHours[date] || 0,
              clockIn: ''
            };
          }
        });
        
        setWorkHours(hours);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do localStorage:', error);
    }
  };

  // Carregar horas de trabalho quando o período muda
  useEffect(() => {
    const fetchWorkHours = async () => {
      if (!selectedPeriod) return;
      
      if (!isOffline) {
        try {
          // Carregar horas de trabalho para o período selecionado
          const hoursResponse = await apiService.getWorkHours(DEFAULT_USER_ID, selectedPeriod.id);
          
          // Transformar para o formato esperado pelo componente
          const hoursMap = {};
          hoursResponse.data.forEach(day => {
            if (day.date) {
              hoursMap[day.date] = {
                hours: day.hours || 0,
                clockIn: day.clock_in_time || ''
              };
            }
          });
          
          setWorkHours(hoursMap);
        } catch (error) {
          console.error('Erro ao carregar horas de trabalho:', error);
          setIsOffline(true);
          // Continuar usando os dados do localStorage
          loadFromLocalStorage();
        }
      } else {
        // Se estiver offline, carregue as horas de trabalho do localStorage
        loadFromLocalStorage();
      }
    };
    
    fetchWorkHours();
  }, [selectedPeriod, isOffline]);

  // Carregar estatísticas quando o período ou as horas de trabalho mudam
  useEffect(() => {
    if (selectedPeriod) {
      if (!isOffline) {
        // Tentar carregar estatísticas do servidor
        fetchStats();
      } else {
        // Calcular estatísticas localmente
        calculateStats();
      }
    }
  }, [selectedPeriod, workHours, isOffline]);

  // Função para buscar estatísticas do servidor
  async function fetchStats() {
    if (!selectedPeriod) return;
    
    try {
      // Carregar estatísticas semanais
      const weeklyStatsResponse = await apiService.getWeeklyStats(DEFAULT_USER_ID, selectedPeriod.id);
      setWeeklyStats(weeklyStatsResponse.data);
      
      // Carregar estatísticas do período
      const periodStatsResponse = await apiService.getPeriodStats(DEFAULT_USER_ID, selectedPeriod.id);
      const stats = periodStatsResponse.data;
      
      setTotalStats({
        hours: stats.totalHours || 0,
        salary: stats.netSalary || 0,
        grossSalary: stats.grossSalary || 0,
        tax: stats.tax || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setIsOffline(true);
      // Se falhar, calcular estatísticas localmente
      calculateStats();
    }
  }

  // Calculate work days in the selected period
  function getDaysInPeriod() {
    if (!selectedPeriod) return [];
    
    const days = [];
    const startDate = new Date(selectedPeriod.start);
    const endDate = new Date(selectedPeriod.end);
    
    for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
      const dateStr = day.toISOString().split('T')[0];
      const dayOfWeek = day.getUTCDay(); // 👈 Use 'day' not 'date'
      
      // Skip only Sundays (0), include Saturdays (6)
      if (dayOfWeek !== 0) {
        const isHoliday = publicHolidays.includes(dateStr);
        const isSaturday = dayOfWeek === 6;
        days.push({
          date: dateStr,
          dayOfWeek,
          isHoliday,
          isSaturday,
          dayName: new Date(dateStr).toLocaleDateString('en-AU', { weekday: 'long' }),
          formattedDate: new Date(dateStr).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
        });
      }
    }
    
    return days;
  }

  function calculateStats() {
    if (!selectedPeriod) return;
    
    const days = getDaysInPeriod();
    const weekMap = new Map();
    const calculationRate = 34;
    
    days.forEach(day => {
      // 'day' is already an object with date string and dayOfWeek
      // So use day.date and day.dayOfWeek directly!
      const dateObj = new Date(day.date + 'T00:00:00Z'); // Create Date from string
      const dayOfWeek = dateObj.getUTCDay();
      
      // Calculate Monday for this date
      const monday = new Date(dateObj);
      monday.setUTCHours(0, 0, 0, 0);
      const daysFromMonday = (dayOfWeek + 6) % 7;
      monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
      const weekKey = monday.toISOString().split('T')[0];
      
      // Calculate Saturday for this week (Monday + 5 days)
      const saturday = new Date(monday);
      saturday.setUTCDate(saturday.getUTCDate() + 5);
      const saturdayStr = saturday.toISOString().split('T')[0];
      
      // Create week if doesn't exist
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          start: weekKey,
          end: saturdayStr,
          days: [],
          totalHours: 0,
          totalSalary: 0,
          grossSalary: 0,
          tax: 0
        });
      }
      
      const weekData = weekMap.get(weekKey);
      const workData = workHours[day.date];
      const hours = typeof workData === 'object' ? workData.hours || 0 : workData || 0;
      const clockIn = typeof workData === 'object' ? workData.clockIn || '' : '';
      
      weekData.days.push({ ...day, hours, clockIn });
      weekData.totalHours += hours;
      weekData.grossSalary += hours * calculationRate;
    });
        
    const weeklyStatsArray = Array.from(weekMap.values()).sort((a, b) => 
      new Date(a.start) - new Date(b.start)
    );
    
    const totalHours = weeklyStatsArray.reduce((sum, week) => sum + week.totalHours, 0);
    const totalGrossSalary = weeklyStatsArray.reduce((sum, week) => sum + week.grossSalary, 0);
    const totalTax = calculateTax(totalGrossSalary);
    const totalNetSalary = totalGrossSalary - totalTax;
    
    weeklyStatsArray.forEach(week => {
      if (totalGrossSalary > 0) {
        week.tax = (week.grossSalary / totalGrossSalary) * totalTax;
        week.totalSalary = week.grossSalary - week.tax;
      } else {
        week.tax = 0;
        week.totalSalary = 0;
      }
    });
    
    setWeeklyStats(weeklyStatsArray);
    setTotalStats({ 
      hours: totalHours, 
      salary: totalNetSalary,
      grossSalary: totalGrossSalary,
      tax: totalTax
    });
  }
  
  // Function to calculate tax based on monthly earnings
  function calculateTax(grossSalary) {
    // If salary is zero or negative, no tax
    if (grossSalary <= 0) return 0;
    
    // For amounts above the maximum in the table
    if (grossSalary > 12675.00) {
      // More than $12,675.00 but less than $15,829.67
      if (grossSalary < 15829.67) {
        return 3393.00 + (grossSalary - 12675.00) * 0.39;
      } 
      // More than $15,829.66
      else {
        return 4624.00 + (grossSalary - 15829.66) * 0.47;
      }
    }
    
    // Simplified tax table for offline calculation
    const taxTableSimplified = [
      { earnings: 4.33, withTax: 0.00 },
      { earnings: 8.67, withTax: 0.00 },
      { earnings: 13.00, withTax: 0.00 },
      { earnings: 17.33, withTax: 0.00 },
      { earnings: 21.67, withTax: 0.00 },
      { earnings: 26.00, withTax: 0.00 },
      { earnings: 30.33, withTax: 0.00 },
      { earnings: 34.67, withTax: 0.00 },
      { earnings: 39.00, withTax: 0.00 },
      { earnings: 43.33, withTax: 0.00 },
      { earnings: 47.67, withTax: 0.00 },
      { earnings: 52.00, withTax: 0.00 },
      { earnings: 56.33, withTax: 0.00 },
      { earnings: 60.67, withTax: 0.00 },
      { earnings: 65.00, withTax: 0.00 },
      { earnings: 69.33, withTax: 0.00 },
      { earnings: 73.67, withTax: 0.00 },
      { earnings: 78.00, withTax: 0.00 },
      { earnings: 82.33, withTax: 0.00 },
      { earnings: 86.67, withTax: 0.00 },
      { earnings: 91.00, withTax: 0.00 },
      { earnings: 95.33, withTax: 0.00 },
      { earnings: 99.67, withTax: 0.00 },
      { earnings: 104.00, withTax: 0.00 },
      { earnings: 108.33, withTax: 0.00 },
      { earnings: 112.67, withTax: 0.00 },
      { earnings: 117.00, withTax: 0.00 },
      { earnings: 121.33, withTax: 0.00 },
      { earnings: 125.67, withTax: 0.00 },
      { earnings: 130.00, withTax: 0.00 },
      { earnings: 134.33, withTax: 0.00 },
      { earnings: 138.67, withTax: 0.00 },
      { earnings: 143.00, withTax: 0.00 },
      { earnings: 147.33, withTax: 0.00 },
      { earnings: 151.67, withTax: 0.00 },
      { earnings: 156.00, withTax: 0.00 },
      { earnings: 160.33, withTax: 0.00 },
      { earnings: 164.67, withTax: 0.00 },
      { earnings: 169.00, withTax: 0.00 },
      { earnings: 173.33, withTax: 0.00 },
      { earnings: 177.67, withTax: 0.00 },
      { earnings: 182.00, withTax: 0.00 },
      { earnings: 186.33, withTax: 0.00 },
      { earnings: 190.67, withTax: 0.00 },
      { earnings: 195.00, withTax: 0.00 },
      { earnings: 199.33, withTax: 0.00 },
      { earnings: 203.67, withTax: 0.00 },
      { earnings: 208.00, withTax: 0.00 },
      { earnings: 212.33, withTax: 0.00 },
      { earnings: 216.67, withTax: 0.00 },
      { earnings: 221.00, withTax: 0.00 },
      { earnings: 225.33, withTax: 0.00 },
      { earnings: 229.67, withTax: 0.00 },
      { earnings: 234.00, withTax: 0.00 },
      { earnings: 238.33, withTax: 0.00 },
      { earnings: 242.67, withTax: 0.00 },
      { earnings: 247.00, withTax: 0.00 },
      { earnings: 251.33, withTax: 0.00 },
      { earnings: 255.67, withTax: 0.00 },
      { earnings: 260.00, withTax: 0.00 },
      { earnings: 264.33, withTax: 0.00 },
      { earnings: 268.67, withTax: 0.00 },
      { earnings: 273.00, withTax: 0.00 },
      { earnings: 277.33, withTax: 0.00 },
      { earnings: 281.67, withTax: 0.00 },
      { earnings: 286.00, withTax: 0.00 },
      { earnings: 290.33, withTax: 0.00 },
      { earnings: 294.67, withTax: 0.00 },
      { earnings: 299.00, withTax: 0.00 },
      { earnings: 303.33, withTax: 0.00 },
      { earnings: 307.67, withTax: 0.00 },
      { earnings: 312.00, withTax: 0.00 },
      { earnings: 316.33, withTax: 0.00 },
      { earnings: 320.67, withTax: 0.00 },
      { earnings: 325.00, withTax: 0.00 },
      { earnings: 329.33, withTax: 0.00 },
      { earnings: 333.67, withTax: 0.00 },
      { earnings: 338.00, withTax: 0.00 },
      { earnings: 342.33, withTax: 0.00 },
      { earnings: 346.67, withTax: 0.00 },
      { earnings: 351.00, withTax: 0.00 },
      { earnings: 355.33, withTax: 0.00 },
      { earnings: 359.67, withTax: 0.00 },
      { earnings: 364.00, withTax: 0.00 },
      { earnings: 368.33, withTax: 0.00 },
      { earnings: 372.67, withTax: 0.00 },
      { earnings: 377.00, withTax: 0.00 },
      { earnings: 381.33, withTax: 0.00 },
      { earnings: 385.67, withTax: 0.00 },
      { earnings: 390.00, withTax: 0.00 },
      { earnings: 394.33, withTax: 0.00 },
      { earnings: 398.67, withTax: 0.00 },
      { earnings: 403.00, withTax: 0.00 },
      { earnings: 407.33, withTax: 0.00 },
      { earnings: 411.67, withTax: 0.00 },
      { earnings: 416.00, withTax: 0.00 },
      { earnings: 420.33, withTax: 0.00 },
      { earnings: 424.67, withTax: 0.00 },
      { earnings: 429.00, withTax: 0.00 },
      { earnings: 433.33, withTax: 0.00 },
      { earnings: 437.67, withTax: 0.00 },
      { earnings: 442.00, withTax: 0.00 },
      { earnings: 446.33, withTax: 0.00 },
      { earnings: 450.67, withTax: 0.00 },
      { earnings: 455.00, withTax: 0.00 },
      { earnings: 459.33, withTax: 0.00 },
      { earnings: 463.67, withTax: 0.00 },
      { earnings: 468.00, withTax: 0.00 },
      { earnings: 472.33, withTax: 0.00 },
      { earnings: 476.67, withTax: 0.00 },
      { earnings: 481.00, withTax: 0.00 },
      { earnings: 485.33, withTax: 0.00 },
      { earnings: 489.67, withTax: 0.00 },
      { earnings: 494.00, withTax: 0.00 },
      { earnings: 498.33, withTax: 0.00 },
      { earnings: 502.67, withTax: 0.00 },
      { earnings: 507.00, withTax: 0.00 },
      { earnings: 511.33, withTax: 0.00 },
      { earnings: 515.67, withTax: 0.00 },
      { earnings: 520.00, withTax: 0.00 },
      { earnings: 524.33, withTax: 0.00 },
      { earnings: 528.67, withTax: 0.00 },
      { earnings: 533.00, withTax: 0.00 },
      { earnings: 537.33, withTax: 0.00 },
      { earnings: 541.67, withTax: 0.00 },
      { earnings: 546.00, withTax: 0.00 },
      { earnings: 550.33, withTax: 0.00 },
      { earnings: 554.67, withTax: 0.00 },
      { earnings: 559.00, withTax: 0.00 },
      { earnings: 563.33, withTax: 0.00 },
      { earnings: 567.67, withTax: 0.00 },
      { earnings: 572.00, withTax: 0.00 },
      { earnings: 576.33, withTax: 0.00 },
      { earnings: 580.67, withTax: 0.00 },
      { earnings: 585.00, withTax: 0.00 },
      { earnings: 589.33, withTax: 0.00 },
      { earnings: 593.67, withTax: 0.00 },
      { earnings: 598.00, withTax: 0.00 },
      { earnings: 602.33, withTax: 0.00 },
      { earnings: 606.67, withTax: 0.00 },
      { earnings: 611.00, withTax: 0.00 },
      { earnings: 615.33, withTax: 0.00 },
      { earnings: 619.67, withTax: 0.00 },
      { earnings: 624.00, withTax: 0.00 },
      { earnings: 628.33, withTax: 0.00 },
      { earnings: 632.67, withTax: 0.00 },
      { earnings: 637.00, withTax: 0.00 },
      { earnings: 641.33, withTax: 0.00 },
      { earnings: 645.67, withTax: 0.00 },
      { earnings: 650.00, withTax: 0.00 },
      { earnings: 654.33, withTax: 0.00 },
      { earnings: 658.67, withTax: 0.00 },
      { earnings: 663.00, withTax: 0.00 },
      { earnings: 667.33, withTax: 0.00 },
      { earnings: 671.67, withTax: 0.00 },
      { earnings: 676.00, withTax: 0.00 },
      { earnings: 680.33, withTax: 0.00 },
      { earnings: 684.67, withTax: 0.00 },
      { earnings: 689.00, withTax: 0.00 },
      { earnings: 693.33, withTax: 0.00 },
      { earnings: 697.67, withTax: 0.00 },
      { earnings: 702.00, withTax: 0.00 },
      { earnings: 706.33, withTax: 0.00 },
      { earnings: 710.67, withTax: 0.00 },
      { earnings: 715.00, withTax: 0.00 },
      { earnings: 719.33, withTax: 0.00 },
      { earnings: 723.67, withTax: 0.00 },
      { earnings: 728.00, withTax: 0.00 },
      { earnings: 732.33, withTax: 0.00 },
      { earnings: 736.67, withTax: 0.00 },
      { earnings: 741.00, withTax: 0.00 },
      { earnings: 745.33, withTax: 0.00 },
      { earnings: 749.67, withTax: 0.00 },
      { earnings: 754.00, withTax: 0.00 },
      { earnings: 758.33, withTax: 0.00 },
      { earnings: 762.67, withTax: 0.00 },
      { earnings: 767.00, withTax: 0.00 },
      { earnings: 771.33, withTax: 0.00 },
      { earnings: 775.67, withTax: 0.00 },
      { earnings: 780.00, withTax: 0.00 },
      { earnings: 784.33, withTax: 0.00 },
      { earnings: 788.67, withTax: 0.00 },
      { earnings: 793.00, withTax: 0.00 },
      { earnings: 797.33, withTax: 0.00 },
      { earnings: 801.67, withTax: 0.00 },
      { earnings: 806.00, withTax: 0.00 },
      { earnings: 810.33, withTax: 0.00 },
      { earnings: 814.67, withTax: 0.00 },
      { earnings: 819.00, withTax: 0.00 },
      { earnings: 823.33, withTax: 0.00 },
      { earnings: 827.67, withTax: 0.00 },
      { earnings: 832.00, withTax: 0.00 },
      { earnings: 836.33, withTax: 0.00 },
      { earnings: 840.67, withTax: 0.00 },
      { earnings: 845.00, withTax: 0.00 },
      { earnings: 849.33, withTax: 0.00 },
      { earnings: 853.67, withTax: 0.00 },
      { earnings: 858.00, withTax: 0.00 },
      { earnings: 862.33, withTax: 0.00 },
      { earnings: 866.67, withTax: 0.00 },
      { earnings: 871.00, withTax: 0.00 },
      { earnings: 875.33, withTax: 0.00 },
      { earnings: 879.67, withTax: 0.00 },
      { earnings: 884.00, withTax: 0.00 },
      { earnings: 888.33, withTax: 0.00 },
      { earnings: 892.67, withTax: 0.00 },
      { earnings: 897.00, withTax: 0.00 },
      { earnings: 901.33, withTax: 0.00 },
      { earnings: 905.67, withTax: 0.00 },
      { earnings: 910.00, withTax: 0.00 },
      { earnings: 914.33, withTax: 0.00 },
      { earnings: 918.67, withTax: 0.00 },
      { earnings: 923.00, withTax: 0.00 },
      { earnings: 927.33, withTax: 0.00 },
      { earnings: 931.67, withTax: 0.00 },
      { earnings: 936.00, withTax: 0.00 },
      { earnings: 940.33, withTax: 0.00 },
      { earnings: 944.67, withTax: 0.00 },
      { earnings: 949.00, withTax: 0.00 },
      { earnings: 953.33, withTax: 0.00 },
      { earnings: 957.67, withTax: 0.00 },
      { earnings: 962.00, withTax: 0.00 },
      { earnings: 966.33, withTax: 0.00 },
      { earnings: 970.67, withTax: 0.00 },
      { earnings: 975.00, withTax: 0.00 },
      { earnings: 979.33, withTax: 0.00 },
      { earnings: 983.67, withTax: 0.00 },
      { earnings: 988.00, withTax: 0.00 },
      { earnings: 992.33, withTax: 0.00 },
      { earnings: 996.67, withTax: 0.00 },
      { earnings: 1001.00, withTax: 0.00 },
      { earnings: 1005.33, withTax: 0.00 },
      { earnings: 1009.67, withTax: 0.00 },
      { earnings: 1014.00, withTax: 0.00 },
      { earnings: 1018.33, withTax: 0.00 },
      { earnings: 1022.67, withTax: 0.00 },
      { earnings: 1027.00, withTax: 0.00 },
      { earnings: 1031.33, withTax: 0.00 },
      { earnings: 1035.67, withTax: 0.00 },
      { earnings: 1040.00, withTax: 0.00 },
      { earnings: 1044.33, withTax: 0.00 },
      { earnings: 1048.67, withTax: 0.00 },
      { earnings: 1053.00, withTax: 0.00 },
      { earnings: 1057.33, withTax: 0.00 },
      { earnings: 1061.67, withTax: 0.00 },
      { earnings: 1066.00, withTax: 0.00 },
      { earnings: 1070.33, withTax: 0.00 },
      { earnings: 1074.67, withTax: 0.00 },
      { earnings: 1079.00, withTax: 0.00 },
      { earnings: 1083.33, withTax: 0.00 },
      { earnings: 1087.67, withTax: 0.00 },
      { earnings: 1092.00, withTax: 0.00 },
      { earnings: 1096.33, withTax: 0.00 },
      { earnings: 1100.67, withTax: 0.00 },
      { earnings: 1105.00, withTax: 0.00 },
      { earnings: 1109.33, withTax: 0.00 },
      { earnings: 1113.67, withTax: 0.00 },
      { earnings: 1118.00, withTax: 0.00 },
      { earnings: 1122.33, withTax: 0.00 },
      { earnings: 1126.67, withTax: 0.00 },
      { earnings: 1131.00, withTax: 0.00 },
      { earnings: 1135.33, withTax: 0.00 },
      { earnings: 1139.67, withTax: 0.00 },
      { earnings: 1144.00, withTax: 0.00 },
      { earnings: 1148.33, withTax: 0.00 },
      { earnings: 1152.67, withTax: 0.00 },
      { earnings: 1157.00, withTax: 0.00 },
      { earnings: 1161.33, withTax: 0.00 },
      { earnings: 1165.67, withTax: 0.00 },
      { earnings: 1170.00, withTax: 0.00 },
      { earnings: 1174.33, withTax: 0.00 },
      { earnings: 1178.67, withTax: 0.00 },
      { earnings: 1183.00, withTax: 0.00 },
      { earnings: 1187.33, withTax: 0.00 },
      { earnings: 1191.67, withTax: 0.00 },
      { earnings: 1196.00, withTax: 0.00 },
      { earnings: 1200.33, withTax: 0.00 },
      { earnings: 1204.67, withTax: 0.00 },
      { earnings: 1209.00, withTax: 0.00 },
      { earnings: 1213.33, withTax: 0.00 },
      { earnings: 1217.67, withTax: 0.00 },
      { earnings: 1222.00, withTax: 0.00 },
      { earnings: 1226.33, withTax: 0.00 },
      { earnings: 1230.67, withTax: 0.00 },
      { earnings: 1235.00, withTax: 0.00 },
      { earnings: 1239.33, withTax: 0.00 },
      { earnings: 1243.67, withTax: 0.00 },
      { earnings: 1248.00, withTax: 0.00 },
      { earnings: 1252.33, withTax: 0.00 },
      { earnings: 1256.67, withTax: 0.00 },
      { earnings: 1261.00, withTax: 0.00 },
      { earnings: 1265.33, withTax: 0.00 },
      { earnings: 1269.67, withTax: 0.00 },
      { earnings: 1274.00, withTax: 0.00 },
      { earnings: 1278.33, withTax: 0.00 },
      { earnings: 1282.67, withTax: 0.00 },
      { earnings: 1287.00, withTax: 0.00 },
      { earnings: 1291.33, withTax: 0.00 },
      { earnings: 1295.67, withTax: 0.00 },
      { earnings: 1300.00, withTax: 0.00 },
      { earnings: 1304.33, withTax: 0.00 },
      { earnings: 1308.67, withTax: 0.00 },
      { earnings: 1313.00, withTax: 0.00 },
      { earnings: 1317.33, withTax: 0.00 },
      { earnings: 1321.67, withTax: 0.00 },
      { earnings: 1326.00, withTax: 0.00 },
      { earnings: 1330.33, withTax: 0.00 },
      { earnings: 1334.67, withTax: 0.00 },
      { earnings: 1339.00, withTax: 0.00 },
      { earnings: 1343.33, withTax: 0.00 },
      { earnings: 1347.67, withTax: 0.00 },
      { earnings: 1352.00, withTax: 0.00 },
      { earnings: 1356.33, withTax: 0.00 },
      { earnings: 1360.67, withTax: 0.00 },
      { earnings: 1365.00, withTax: 0.00 },
      { earnings: 1369.33, withTax: 0.00 },
      { earnings: 1373.67, withTax: 0.00 },
      { earnings: 1378.00, withTax: 0.00 },
      { earnings: 1382.33, withTax: 0.00 },
      { earnings: 1386.67, withTax: 0.00 },
      { earnings: 1391.00, withTax: 0.00 },
      { earnings: 1395.33, withTax: 0.00 },
      { earnings: 1399.67, withTax: 0.00 },
      { earnings: 1404.00, withTax: 0.00 },
      { earnings: 1408.33, withTax: 0.00 },
      { earnings: 1412.67, withTax: 0.00 },
      { earnings: 1417.00, withTax: 0.00 },
      { earnings: 1421.33, withTax: 0.00 },
      { earnings: 1425.67, withTax: 0.00 },
      { earnings: 1430.00, withTax: 0.00 },
      { earnings: 1434.33, withTax: 0.00 },
      { earnings: 1438.67, withTax: 0.00 },
      { earnings: 1443.00, withTax: 0.00 },
      { earnings: 1447.33, withTax: 0.00 },
      { earnings: 1451.67, withTax: 0.00 },
      { earnings: 1456.00, withTax: 0.00 },
      { earnings: 1460.33, withTax: 0.00 },
      { earnings: 1464.67, withTax: 0.00 },
      { earnings: 1469.00, withTax: 0.00 },
      { earnings: 1473.33, withTax: 0.00 },
      { earnings: 1477.67, withTax: 0.00 },
      { earnings: 1482.00, withTax: 0.00 },
      { earnings: 1486.33, withTax: 0.00 },
      { earnings: 1490.67, withTax: 0.00 },
      { earnings: 1495.00, withTax: 0.00 },
      { earnings: 1499.33, withTax: 0.00 },
      { earnings: 1503.67, withTax: 0.00 },
      { earnings: 1508.00, withTax: 0.00 },
      { earnings: 1512.33, withTax: 0.00 },
      { earnings: 1516.67, withTax: 0.00 },
      { earnings: 1521.00, withTax: 0.00 },
      { earnings: 1525.33, withTax: 0.00 },
      { earnings: 1529.67, withTax: 0.00 },
      { earnings: 1534.00, withTax: 0.00 },
      { earnings: 1538.33, withTax: 0.00 },
      { earnings: 1542.67, withTax: 0.00 },
      { earnings: 1547.00, withTax: 0.00 },
      { earnings: 1551.33, withTax: 0.00 },
      { earnings: 1555.67, withTax: 0.00 },
      { earnings: 1560.00, withTax: 0.00 },
      { earnings: 1564.33, withTax: 0.00 },
      { earnings: 1568.67, withTax: 0.00 },
      { earnings: 1573.00, withTax: 0.00 },
      { earnings: 1577.33, withTax: 4.00 },
      { earnings: 1581.67, withTax: 4.00 },
      { earnings: 1586.00, withTax: 4.00 },
      { earnings: 1590.33, withTax: 4.00 },
      { earnings: 1594.67, withTax: 4.00 },
      { earnings: 1599.00, withTax: 4.00 },
      { earnings: 1603.33, withTax: 9.00 },
      { earnings: 1607.67, withTax: 9.00 },
      { earnings: 1612.00, withTax: 9.00 },
      { earnings: 1616.33, withTax: 9.00 },
      { earnings: 1620.67, withTax: 9.00 },
      { earnings: 1625.00, withTax: 9.00 },
      { earnings: 1629.33, withTax: 9.00 },
      { earnings: 1633.67, withTax: 13.00 },
      { earnings: 1638.00, withTax: 13.00 },
      { earnings: 1642.33, withTax: 13.00 },
      { earnings: 1646.67, withTax: 13.00 },
      { earnings: 1651.00, withTax: 13.00 },
      { earnings: 1655.33, withTax: 13.00 },
      { earnings: 1659.67, withTax: 17.00 },
      { earnings: 1664.00, withTax: 17.00 },
      { earnings: 1668.33, withTax: 17.00 },
      { earnings: 1672.67, withTax: 17.00 },
      { earnings: 1677.00, withTax: 17.00 },
      { earnings: 1681.33, withTax: 17.00 },
      { earnings: 1685.67, withTax: 22.00 },
      { earnings: 1690.00, withTax: 22.00 },
      { earnings: 1694.33, withTax: 22.00 },
      { earnings: 1698.67, withTax: 22.00 },
      { earnings: 1703.00, withTax: 22.00 },
      { earnings: 1707.33, withTax: 22.00 },
      { earnings: 1711.67, withTax: 26.00 },
      { earnings: 1716.00, withTax: 26.00 },
      { earnings: 1720.33, withTax: 26.00 },
      { earnings: 1724.67, withTax: 26.00 },
      { earnings: 1729.00, withTax: 26.00 },
      { earnings: 1733.33, withTax: 26.00 },
      { earnings: 1737.67, withTax: 26.00 },
      { earnings: 1742.00, withTax: 30.00 },
      { earnings: 1746.33, withTax: 30.00 },
      { earnings: 1750.67, withTax: 30.00 },
      { earnings: 1755.00, withTax: 30.00 },
      { earnings: 1759.33, withTax: 30.00 },
      { earnings: 1763.67, withTax: 30.00 },
      { earnings: 1768.00, withTax: 35.00 },
      { earnings: 1772.33, withTax: 35.00 },
      { earnings: 1776.67, withTax: 35.00 },
        { earnings: 1794.00, withTax: 39.00 },
        { earnings: 1820.00, withTax: 43.00 },
        { earnings: 1850.33, withTax: 48.00 },
        { earnings: 1876.33, withTax: 52.00 },
        { earnings: 1902.33, withTax: 56.00 },
        { earnings: 1928.33, withTax: 61.00 },
        { earnings: 1958.67, withTax: 65.00 },
        { earnings: 1984.67, withTax: 69.00 },
        { earnings: 2010.67, withTax: 74.00 },
        { earnings: 2036.67, withTax: 78.00 },
        { earnings: 2067.00, withTax: 82.00 },
        { earnings: 2088.67, withTax: 82.00 },
{ earnings: 2093.00, withTax: 87.00 },
{ earnings: 2097.33, withTax: 87.00 },
{ earnings: 2101.67, withTax: 87.00 },
{ earnings: 2106.00, withTax: 87.00 },
{ earnings: 2110.33, withTax: 87.00 },
{ earnings: 2114.67, withTax: 87.00 },
{ earnings: 2119.00, withTax: 91.00 },
{ earnings: 2123.33, withTax: 91.00 },
{ earnings: 2127.67, withTax: 91.00 },
{ earnings: 2132.00, withTax: 91.00 },
{ earnings: 2136.33, withTax: 91.00 },
{ earnings: 2140.67, withTax: 91.00 },
{ earnings: 2145.00, withTax: 95.00 },
{ earnings: 2149.33, withTax: 95.00 },
{ earnings: 2153.67, withTax: 95.00 },
{ earnings: 2158.00, withTax: 95.00 },
{ earnings: 2162.33, withTax: 95.00 },
{ earnings: 2166.67, withTax: 95.00 },
{ earnings: 2171.00, withTax: 100.00 },
{ earnings: 2175.33, withTax: 100.00 },
{ earnings: 2179.67, withTax: 100.00 },
{ earnings: 2184.00, withTax: 100.00 },
{ earnings: 2188.33, withTax: 104.00 },
{ earnings: 2192.67, withTax: 104.00 },
{ earnings: 2197.00, withTax: 104.00 },
{ earnings: 2201.33, withTax: 104.00 },
{ earnings: 2205.67, withTax: 108.00 },
{ earnings: 2210.00, withTax: 108.00 },
{ earnings: 2214.33, withTax: 108.00 },
{ earnings: 2218.67, withTax: 113.00 },
{ earnings: 2223.00, withTax: 113.00 },
{ earnings: 2227.33, withTax: 113.00 },
{ earnings: 2231.67, withTax: 113.00 },
{ earnings: 2236.00, withTax: 117.00 },
{ earnings: 2240.33, withTax: 117.00 },
{ earnings: 2244.67, withTax: 117.00 },
{ earnings: 2249.00, withTax: 117.00 },
{ earnings: 2253.33, withTax: 121.00 },
{ earnings: 2257.67, withTax: 121.00 },
{ earnings: 2262.00, withTax: 121.00 },
{ earnings: 2266.33, withTax: 121.00 },
{ earnings: 2270.67, withTax: 126.00 },
{ earnings: 2275.00, withTax: 126.00 },
{ earnings: 2279.33, withTax: 126.00 },
{ earnings: 2283.67, withTax: 126.00 },
{ earnings: 2288.00, withTax: 130.00 },
{ earnings: 2292.33, withTax: 130.00 },
{ earnings: 2296.67, withTax: 130.00 },
{ earnings: 2301.00, withTax: 130.00 },
{ earnings: 2305.33, withTax: 134.00 },
{ earnings: 2309.67, withTax: 134.00 },
{ earnings: 2314.00, withTax: 134.00 },
{ earnings: 2318.33, withTax: 139.00 },
{ earnings: 2322.67, withTax: 139.00 },
{ earnings: 2327.00, withTax: 139.00 },
{ earnings: 2331.33, withTax: 139.00 },
{ earnings: 2335.67, withTax: 143.00 },
{ earnings: 2340.00, withTax: 143.00 },
{ earnings: 2344.33, withTax: 143.00 },
{ earnings: 2348.67, withTax: 143.00 },
{ earnings: 2353.00, withTax: 147.00 },
{ earnings: 2357.33, withTax: 147.00 },
{ earnings: 2361.67, withTax: 147.00 },
{ earnings: 2366.00, withTax: 147.00 },
{ earnings: 2370.33, withTax: 152.00 },
{ earnings: 2374.67, withTax: 152.00 },
{ earnings: 2379.00, withTax: 152.00 },
{ earnings: 2383.33, withTax: 152.00 },
{ earnings: 2387.67, withTax: 156.00 },
{ earnings: 2392.00, withTax: 156.00 },
{ earnings: 2396.33, withTax: 156.00 },
{ earnings: 2400.67, withTax: 156.00 },
{ earnings: 2405.00, withTax: 160.00 },
{ earnings: 2409.33, withTax: 160.00 },
{ earnings: 2413.67, withTax: 160.00 },
{ earnings: 2418.00, withTax: 160.00 },
{ earnings: 2422.33, withTax: 165.00 },
{ earnings: 2426.67, withTax: 165.00 },
{ earnings: 2431.00, withTax: 165.00 },
{ earnings: 2435.33, withTax: 169.00 },
{ earnings: 2439.67, withTax: 169.00 },
{ earnings: 2444.00, withTax: 169.00 },
{ earnings: 2448.33, withTax: 169.00 },
{ earnings: 2452.67, withTax: 173.00 },
{ earnings: 2457.00, withTax: 173.00 },
{ earnings: 2461.33, withTax: 173.00 },
{ earnings: 2465.67, withTax: 173.00 },
{ earnings: 2470.00, withTax: 178.00 },
{ earnings: 2474.33, withTax: 178.00 },
{ earnings: 2478.67, withTax: 178.00 },
{ earnings: 2483.00, withTax: 178.00 },
{ earnings: 2487.33, withTax: 182.00 },
{ earnings: 2491.67, withTax: 182.00 },
{ earnings: 2496.00, withTax: 182.00 },
{ earnings: 2500.33, withTax: 182.00 },
{ earnings: 2504.67, withTax: 186.00 },
{ earnings: 2509.00, withTax: 186.00 },
{ earnings: 2513.33, withTax: 186.00 },
{ earnings: 2517.67, withTax: 186.00 },
{ earnings: 2522.00, withTax: 191.00 },
{ earnings: 2526.33, withTax: 191.00 },
{ earnings: 2530.67, withTax: 191.00 },
{ earnings: 2535.00, withTax: 195.00 },
{ earnings: 2539.33, withTax: 195.00 },
{ earnings: 2543.67, withTax: 195.00 },
{ earnings: 2548.00, withTax: 195.00 },
{ earnings: 2552.33, withTax: 199.00 },
{ earnings: 2556.67, withTax: 199.00 },
{ earnings: 2561.00, withTax: 199.00 },
{ earnings: 2565.33, withTax: 199.00 },
{ earnings: 2569.67, withTax: 204.00 },
{ earnings: 2574.00, withTax: 204.00 },
{ earnings: 2578.33, withTax: 204.00 },
{ earnings: 2582.67, withTax: 204.00 },
{ earnings: 2587.00, withTax: 208.00 },
{ earnings: 2591.33, withTax: 208.00 },
{ earnings: 2595.67, withTax: 208.00 },
{ earnings: 2600.00, withTax: 208.00 },
{ earnings: 2604.33, withTax: 212.00 },
{ earnings: 2608.67, withTax: 212.00 },
{ earnings: 2613.00, withTax: 212.00 },
{ earnings: 2617.33, withTax: 212.00 },
{ earnings: 2621.67, withTax: 217.00 },
{ earnings: 2626.00, withTax: 217.00 },
{ earnings: 2630.33, withTax: 217.00 },
{ earnings: 2634.67, withTax: 217.00 },
{ earnings: 2639.00, withTax: 221.00 },
{ earnings: 2643.33, withTax: 221.00 },
{ earnings: 2647.67, withTax: 221.00 },
{ earnings: 2652.00, withTax: 225.00 },
{ earnings: 2656.33, withTax: 225.00 },
{ earnings: 2660.67, withTax: 225.00 },
{ earnings: 2665.00, withTax: 225.00 },
{ earnings: 2669.33, withTax: 230.00 },
{ earnings: 2673.67, withTax: 230.00 },
{ earnings: 2678.00, withTax: 230.00 },
{ earnings: 2682.33, withTax: 230.00 },
{ earnings: 2686.67, withTax: 234.00 },
{ earnings: 2691.00, withTax: 234.00 },
{ earnings: 2695.33, withTax: 234.00 },
{ earnings: 2699.67, withTax: 234.00 },
{ earnings: 2704.00, withTax: 238.00 },
{ earnings: 2708.33, withTax: 238.00 },
{ earnings: 2712.67, withTax: 238.00 },
{ earnings: 2717.00, withTax: 238.00 },
{ earnings: 2721.33, withTax: 238.00 },
{ earnings: 2725.67, withTax: 243.00 },
{ earnings: 2730.00, withTax: 243.00 },
{ earnings: 2734.33, withTax: 243.00 },
{ earnings: 2738.67, withTax: 243.00 },
{ earnings: 2743.00, withTax: 243.00 },
{ earnings: 2747.33, withTax: 243.00 },
{ earnings: 2751.67, withTax: 247.00 },
{ earnings: 2756.00, withTax: 247.00 },
{ earnings: 2760.33, withTax: 247.00 },
{ earnings: 2764.67, withTax: 247.00 },
{ earnings: 2769.00, withTax: 247.00 },
{ earnings: 2773.33, withTax: 251.00 },
{ earnings: 2777.67, withTax: 251.00 },
{ earnings: 2782.00, withTax: 251.00 },
{ earnings: 2786.33, withTax: 251.00 },
{ earnings: 2790.67, withTax: 251.00 },
{ earnings: 2795.00, withTax: 251.00 },
{ earnings: 2799.33, withTax: 256.00 },
{ earnings: 2803.67, withTax: 256.00 },
{ earnings: 2808.00, withTax: 256.00 },
{ earnings: 2812.33, withTax: 256.00 },
{ earnings: 2816.67, withTax: 256.00 },
{ earnings: 2821.00, withTax: 260.00 },
{ earnings: 2825.33, withTax: 260.00 },
{ earnings: 2829.67, withTax: 260.00 },
{ earnings: 2834.00, withTax: 260.00 },
{ earnings: 2838.33, withTax: 260.00 },
{ earnings: 2842.67, withTax: 260.00 },
{ earnings: 2847.00, withTax: 264.00 },
{ earnings: 2851.33, withTax: 264.00 },
{ earnings: 2855.67, withTax: 264.00 },
{ earnings: 2860.00, withTax: 264.00 },
{ earnings: 2864.33, withTax: 264.00 },
{ earnings: 2868.67, withTax: 264.00 },
{ earnings: 2873.00, withTax: 269.00 },
{ earnings: 2877.33, withTax: 269.00 },
{ earnings: 2881.67, withTax: 269.00 },
{ earnings: 2886.00, withTax: 269.00 },
{ earnings: 2890.33, withTax: 269.00 },
{ earnings: 2894.67, withTax: 273.00 },
{ earnings: 2899.00, withTax: 273.00 },
{ earnings: 2903.33, withTax: 273.00 },
{ earnings: 2907.67, withTax: 273.00 },
{ earnings: 2912.00, withTax: 273.00 },
{ earnings: 2916.33, withTax: 273.00 },
{ earnings: 2920.67, withTax: 277.00 },
{ earnings: 2925.00, withTax: 277.00 },
{ earnings: 2929.33, withTax: 277.00 },
{ earnings: 2933.67, withTax: 277.00 },
{ earnings: 2938.00, withTax: 277.00 },
{ earnings: 2942.33, withTax: 282.00 },
{ earnings: 2946.67, withTax: 282.00 },
{ earnings: 2951.00, withTax: 282.00 },
{ earnings: 2955.33, withTax: 282.00 },
{ earnings: 2959.67, withTax: 282.00 },
{ earnings: 2964.00, withTax: 282.00 },
{ earnings: 2968.33, withTax: 286.00 },
{ earnings: 2972.67, withTax: 286.00 },
{ earnings: 2977.00, withTax: 286.00 },
{ earnings: 2981.33, withTax: 286.00 },
{ earnings: 2985.67, withTax: 286.00 },
{ earnings: 2990.00, withTax: 290.00 },
{ earnings: 2994.33, withTax: 290.00 },
{ earnings: 2998.67, withTax: 290.00 },
{ earnings: 3003.00, withTax: 290.00 },
{ earnings: 3007.33, withTax: 290.00 },
{ earnings: 3011.67, withTax: 290.00 },
{ earnings: 3016.00, withTax: 295.00 },
{ earnings: 3020.33, withTax: 295.00 },
{ earnings: 3024.67, withTax: 295.00 },
{ earnings: 3029.00, withTax: 295.00 },
{ earnings: 3033.33, withTax: 295.00 },
{ earnings: 3037.67, withTax: 299.00 },
{ earnings: 3042.00, withTax: 299.00 },
{ earnings: 3046.33, withTax: 299.00 },
{ earnings: 3050.67, withTax: 299.00 },
{ earnings: 3055.00, withTax: 299.00 },
{ earnings: 3059.33, withTax: 299.00 },
{ earnings: 3063.67, withTax: 303.00 },
{ earnings: 3068.00, withTax: 303.00 },
{ earnings: 3072.33, withTax: 303.00 },
{ earnings: 3076.67, withTax: 303.00 },
{ earnings: 3081.00, withTax: 303.00 },
{ earnings: 3085.33, withTax: 303.00 },
{ earnings: 3089.67, withTax: 308.00 },
{ earnings: 3094.00, withTax: 308.00 },
{ earnings: 3098.33, withTax: 308.00 },
{ earnings: 3102.67, withTax: 308.00 },
{ earnings: 3107.00, withTax: 308.00 },
{ earnings: 3111.33, withTax: 312.00 },
{ earnings: 3115.67, withTax: 312.00 },
{ earnings: 3120.00, withTax: 312.00 },
{ earnings: 3124.33, withTax: 312.00 },
{ earnings: 3128.67, withTax: 312.00 },
{ earnings: 3133.00, withTax: 312.00 },
{ earnings: 3137.33, withTax: 316.00 },
{ earnings: 3141.67, withTax: 316.00 },
{ earnings: 3146.00, withTax: 316.00 },
{ earnings: 3150.33, withTax: 316.00 },
{ earnings: 3154.67, withTax: 316.00 },
{ earnings: 3159.00, withTax: 321.00 },
{ earnings: 3163.33, withTax: 321.00 },
{ earnings: 3167.67, withTax: 321.00 },
{ earnings: 3172.00, withTax: 321.00 },
{ earnings: 3176.33, withTax: 321.00 },
{ earnings: 3180.67, withTax: 325.00 },
{ earnings: 3185.00, withTax: 325.00 },
{ earnings: 3189.33, withTax: 325.00 },
{ earnings: 3193.67, withTax: 325.00 },
{ earnings: 3198.00, withTax: 325.00 },
{ earnings: 3202.33, withTax: 329.00 },
{ earnings: 3206.67, withTax: 329.00 },
{ earnings: 3211.00, withTax: 329.00 },
{ earnings: 3215.33, withTax: 329.00 },
{ earnings: 3219.67, withTax: 329.00 },
{ earnings: 3224.00, withTax: 329.00 },
{ earnings: 3228.33, withTax: 334.00 },
{ earnings: 3232.67, withTax: 334.00 },
{ earnings: 3237.00, withTax: 334.00 },
{ earnings: 3241.33, withTax: 334.00 },
{ earnings: 3245.67, withTax: 334.00 },
{ earnings: 3250.00, withTax: 338.00 },
{ earnings: 3254.33, withTax: 338.00 },
{ earnings: 3258.67, withTax: 338.00 },
{ earnings: 3263.00, withTax: 338.00 },
{ earnings: 3267.33, withTax: 338.00 },
{ earnings: 3271.67, withTax: 342.00 },
{ earnings: 3276.00, withTax: 342.00 },
{ earnings: 3280.33, withTax: 342.00 },
{ earnings: 3284.67, withTax: 342.00 },
{ earnings: 3289.00, withTax: 342.00 },
{ earnings: 3293.33, withTax: 342.00 },
{ earnings: 3297.67, withTax: 347.00 },
{ earnings: 3302.00, withTax: 347.00 },
{ earnings: 3306.33, withTax: 347.00 },
{ earnings: 3310.67, withTax: 347.00 },
{ earnings: 3315.00, withTax: 347.00 },
{ earnings: 3319.33, withTax: 351.00 },
{ earnings: 3323.67, withTax: 351.00 },
{ earnings: 3328.00, withTax: 351.00 },
{ earnings: 3332.33, withTax: 351.00 },
{ earnings: 3336.67, withTax: 351.00 },
{ earnings: 3341.00, withTax: 355.00 },
{ earnings: 3345.33, withTax: 355.00 },
{ earnings: 3349.67, withTax: 355.00 },
{ earnings: 3354.00, withTax: 355.00 },
{ earnings: 3358.33, withTax: 355.00 },
{ earnings: 3362.67, withTax: 360.00 },
{ earnings: 3367.00, withTax: 360.00 },
{ earnings: 3371.33, withTax: 360.00 },
{ earnings: 3375.67, withTax: 360.00 },
{ earnings: 3380.00, withTax: 360.00 },
{ earnings: 3384.33, withTax: 360.00 },
{ earnings: 3388.67, withTax: 364.00 },
{ earnings: 3393.00, withTax: 364.00 },
{ earnings: 3397.33, withTax: 364.00 },
{ earnings: 3401.67, withTax: 364.00 },
{ earnings: 3406.00, withTax: 364.00 },
{ earnings: 3410.33, withTax: 368.00 },
{ earnings: 3414.67, withTax: 368.00 },
{ earnings: 3419.00, withTax: 368.00 },
{ earnings: 3423.33, withTax: 368.00 },
{ earnings: 3427.67, withTax: 368.00 },
{ earnings: 3432.00, withTax: 373.00 },
{ earnings: 3436.33, withTax: 373.00 },
{ earnings: 3440.67, withTax: 373.00 },
{ earnings: 3445.00, withTax: 373.00 },
{ earnings: 3449.33, withTax: 373.00 },
{ earnings: 3453.67, withTax: 373.00 },
{ earnings: 3458.00, withTax: 377.00 },
{ earnings: 3462.33, withTax: 377.00 },
{ earnings: 3466.67, withTax: 377.00 },
{ earnings: 3471.00, withTax: 377.00 },
{ earnings: 3475.33, withTax: 377.00 },
{ earnings: 3479.67, withTax: 381.00 },
{ earnings: 3484.00, withTax: 381.00 },
{ earnings: 3488.33, withTax: 381.00 },
{ earnings: 3492.67, withTax: 381.00 },
{ earnings: 3497.00, withTax: 381.00 },
{ earnings: 3501.33, withTax: 386.00 },
{ earnings: 3505.67, withTax: 386.00 },
{ earnings: 3510.00, withTax: 386.00 },
{ earnings: 3514.33, withTax: 386.00 },
{ earnings: 3518.67, withTax: 386.00 },
{ earnings: 3523.00, withTax: 390.00 },
{ earnings: 3527.33, withTax: 390.00 },
{ earnings: 3531.67, withTax: 390.00 },
{ earnings: 3536.00, withTax: 390.00 },
{ earnings: 3540.33, withTax: 390.00 },
{ earnings: 3544.67, withTax: 390.00 },
{ earnings: 3549.00, withTax: 394.00 },
{ earnings: 3553.33, withTax: 394.00 },
{ earnings: 3557.67, withTax: 394.00 },
{ earnings: 3562.00, withTax: 394.00 },
{ earnings: 3566.33, withTax: 394.00 },
{ earnings: 3570.67, withTax: 399.00 },
{ earnings: 3575.00, withTax: 399.00 },
{ earnings: 3579.33, withTax: 399.00 },
{ earnings: 3583.67, withTax: 399.00 },
{ earnings: 3588.00, withTax: 399.00 },
{ earnings: 3592.33, withTax: 403.00 },
{ earnings: 3596.67, withTax: 403.00 },
{ earnings: 3601.00, withTax: 403.00 },
{ earnings: 3605.33, withTax: 403.00 },
{ earnings: 3609.67, withTax: 403.00 },
{ earnings: 3614.00, withTax: 403.00 },
{ earnings: 3618.33, withTax: 407.00 },
{ earnings: 3622.67, withTax: 407.00 },
{ earnings: 3627.00, withTax: 407.00 },
{ earnings: 3631.33, withTax: 407.00 },
{ earnings: 3635.67, withTax: 407.00 },
{ earnings: 3640.00, withTax: 412.00 },
{ earnings: 3644.33, withTax: 412.00 },
{ earnings: 3648.67, withTax: 412.00 },
{ earnings: 3653.00, withTax: 412.00 },
{ earnings: 3657.33, withTax: 412.00 },
{ earnings: 3661.67, withTax: 416.00 },
{ earnings: 3666.00, withTax: 416.00 },
{ earnings: 3670.33, withTax: 416.00 },
{ earnings: 3674.67, withTax: 416.00 },
{ earnings: 3679.00, withTax: 416.00 },
{ earnings: 3683.33, withTax: 420.00 },
{ earnings: 3687.67, withTax: 420.00 },
{ earnings: 3692.00, withTax: 420.00 },
{ earnings: 3696.33, withTax: 420.00 },
{ earnings: 3700.67, withTax: 420.00 },
{ earnings: 3705.00, withTax: 420.00 },
{ earnings: 3709.33, withTax: 425.00 },
{ earnings: 3713.67, withTax: 425.00 },
{ earnings: 3718.00, withTax: 425.00 },
{ earnings: 3722.33, withTax: 425.00 },
{ earnings: 3726.67, withTax: 425.00 },
{ earnings: 3731.00, withTax: 429.00 },
{ earnings: 3735.33, withTax: 429.00 },
{ earnings: 3739.67, withTax: 429.00 },
{ earnings: 3744.00, withTax: 429.00 },
{ earnings: 3748.33, withTax: 429.00 },
{ earnings: 3752.67, withTax: 433.00 },
{ earnings: 3757.00, withTax: 433.00 },
{ earnings: 3761.33, withTax: 433.00 },
{ earnings: 3765.67, withTax: 438.00 },
{ earnings: 3770.00, withTax: 438.00 },
{ earnings: 3774.33, withTax: 438.00 },
{ earnings: 3778.67, withTax: 442.00 },
{ earnings: 3783.00, withTax: 442.00 },
{ earnings: 3787.33, withTax: 442.00 },
{ earnings: 3791.67, withTax: 446.00 },
{ earnings: 3796.00, withTax: 446.00 },
{ earnings: 3800.33, withTax: 446.00 },
{ earnings: 3804.67, withTax: 451.00 },
{ earnings: 3809.00, withTax: 451.00 },
{ earnings: 3813.33, withTax: 451.00 },
{ earnings: 3817.67, withTax: 455.00 },
{ earnings: 3822.00, withTax: 455.00 },
{ earnings: 3826.33, withTax: 455.00 },
{ earnings: 3830.67, withTax: 459.00 },
{ earnings: 3835.00, withTax: 459.00 },
{ earnings: 3839.33, withTax: 459.00 },
{ earnings: 3843.67, withTax: 464.00 },
{ earnings: 3848.00, withTax: 464.00 },
{ earnings: 3852.33, withTax: 464.00 },
{ earnings: 3856.67, withTax: 464.00 },
{ earnings: 3861.00, withTax: 468.00 },
{ earnings: 3865.33, withTax: 468.00 },
{ earnings: 3869.67, withTax: 468.00 },
{ earnings: 3874.00, withTax: 472.00 },
{ earnings: 3878.33, withTax: 472.00 },
{ earnings: 3882.67, withTax: 472.00 },
{ earnings: 3887.00, withTax: 477.00 },
{ earnings: 3891.33, withTax: 477.00 },
{ earnings: 3895.67, withTax: 477.00 },
{ earnings: 3900.00, withTax: 481.00 },
{ earnings: 3904.33, withTax: 481.00 },
{ earnings: 3908.67, withTax: 481.00 },
{ earnings: 3913.00, withTax: 485.00 },
{ earnings: 3917.33, withTax: 485.00 },
{ earnings: 3921.67, withTax: 485.00 },
{ earnings: 3926.00, withTax: 490.00 },
{ earnings: 3930.33, withTax: 490.00 },
{ earnings: 3934.67, withTax: 490.00 },
{ earnings: 3939.00, withTax: 494.00 },
{ earnings: 3943.33, withTax: 494.00 },
{ earnings: 3947.67, withTax: 494.00 },
{ earnings: 3952.00, withTax: 498.00 },
{ earnings: 3956.33, withTax: 498.00 },
{ earnings: 3960.67, withTax: 498.00 },
{ earnings: 3965.00, withTax: 503.00 },
{ earnings: 3969.33, withTax: 503.00 },
{ earnings: 3973.67, withTax: 503.00 },
{ earnings: 3978.00, withTax: 507.00 },
{ earnings: 3982.33, withTax: 507.00 },
{ earnings: 3986.67, withTax: 507.00 },
{ earnings: 3991.00, withTax: 507.00 },
{ earnings: 3995.33, withTax: 511.00 },
{ earnings: 3999.67, withTax: 511.00 },
{ earnings: 4004.00, withTax: 511.00 },
{ earnings: 4008.33, withTax: 516.00 },
{ earnings: 4012.67, withTax: 516.00 },
{ earnings: 4017.00, withTax: 516.00 },
{ earnings: 4021.33, withTax: 520.00 },
{ earnings: 4025.67, withTax: 520.00 },
{ earnings: 4030.00, withTax: 520.00 },
{ earnings: 4034.33, withTax: 524.00 },
{ earnings: 4038.67, withTax: 524.00 },
{ earnings: 4043.00, withTax: 524.00 },
{ earnings: 4047.33, withTax: 529.00 },
{ earnings: 4051.67, withTax: 529.00 },
{ earnings: 4056.00, withTax: 529.00 },
{ earnings: 4060.33, withTax: 533.00 },
{ earnings: 4064.67, withTax: 533.00 },
{ earnings: 4069.00, withTax: 533.00 },
{ earnings: 4073.33, withTax: 537.00 },
{ earnings: 4077.67, withTax: 537.00 },
{ earnings: 4082.00, withTax: 537.00 },
{ earnings: 4086.33, withTax: 542.00 },
{ earnings: 4090.67, withTax: 542.00 },
{ earnings: 4095.00, withTax: 542.00 },
{ earnings: 4099.33, withTax: 546.00 },
{ earnings: 4103.67, withTax: 546.00 },
{ earnings: 4108.00, withTax: 546.00 },
{ earnings: 4112.33, withTax: 550.00 },
{ earnings: 4116.67, withTax: 550.00 },
{ earnings: 4121.00, withTax: 550.00 },
{ earnings: 4125.33, withTax: 550.00 },
{ earnings: 4129.67, withTax: 555.00 },
{ earnings: 4134.00, withTax: 555.00 },
{ earnings: 4138.33, withTax: 555.00 },
{ earnings: 4142.67, withTax: 559.00 },
{ earnings: 4147.00, withTax: 559.00 },
{ earnings: 4151.33, withTax: 559.00 },
{ earnings: 4155.67, withTax: 563.00 },
{ earnings: 4160.00, withTax: 563.00 },
{ earnings: 4164.33, withTax: 563.00 },
{ earnings: 4168.67, withTax: 568.00 },
{ earnings: 4173.00, withTax: 568.00 },
{ earnings: 4177.33, withTax: 568.00 },
{ earnings: 4181.67, withTax: 572.00 },
{ earnings: 4186.00, withTax: 572.00 },
{ earnings: 4190.33, withTax: 572.00 },
{ earnings: 4194.67, withTax: 576.00 },
{ earnings: 4199.00, withTax: 576.00 },
{ earnings: 4203.33, withTax: 576.00 },
{ earnings: 4207.67, withTax: 581.00 },
{ earnings: 4212.00, withTax: 581.00 },
{ earnings: 4216.33, withTax: 581.00 },
{ earnings: 4220.67, withTax: 585.00 },
{ earnings: 4225.00, withTax: 585.00 },
{ earnings: 4229.33, withTax: 585.00 },
{ earnings: 4233.67, withTax: 589.00 },
{ earnings: 4238.00, withTax: 589.00 },
{ earnings: 4242.33, withTax: 589.00 },
{ earnings: 4246.67, withTax: 594.00 },
{ earnings: 4251.00, withTax: 594.00 },
{ earnings: 4255.33, withTax: 594.00 },
{ earnings: 4259.67, withTax: 594.00 },
{ earnings: 4264.00, withTax: 598.00 },
{ earnings: 4268.33, withTax: 598.00 },
{ earnings: 4272.67, withTax: 598.00 },
{ earnings: 4277.00, withTax: 602.00 },
{ earnings: 4281.33, withTax: 602.00 },
{ earnings: 4285.67, withTax: 602.00 },
{ earnings: 4290.00, withTax: 607.00 },
{ earnings: 4294.33, withTax: 607.00 },
{ earnings: 4298.67, withTax: 607.00 },
{ earnings: 4303.00, withTax: 611.00 },
{ earnings: 4307.33, withTax: 611.00 },
{ earnings: 4311.67, withTax: 611.00 },
{ earnings: 4316.00, withTax: 615.00 },
{ earnings: 4320.33, withTax: 615.00 },
{ earnings: 4324.67, withTax: 615.00 },
{ earnings: 4329.00, withTax: 620.00 },
{ earnings: 4333.33, withTax: 620.00 },
{ earnings: 4337.67, withTax: 620.00 },
{ earnings: 4342.00, withTax: 624.00 },
{ earnings: 4346.33, withTax: 624.00 },
{ earnings: 4350.67, withTax: 624.00 },
{ earnings: 4355.00, withTax: 628.00 },
{ earnings: 4359.33, withTax: 628.00 },
{ earnings: 4363.67, withTax: 628.00 },
{ earnings: 4368.00, withTax: 633.00 },
{ earnings: 4372.33, withTax: 633.00 },
{ earnings: 4376.67, withTax: 633.00 },
{ earnings: 4381.00, withTax: 637.00 },
{ earnings: 4385.33, withTax: 637.00 },
{ earnings: 4389.67, withTax: 637.00 },
{ earnings: 4394.00, withTax: 637.00 },
{ earnings: 4398.33, withTax: 641.00 },
{ earnings: 4402.67, withTax: 641.00 },
{ earnings: 4407.00, withTax: 641.00 },
{ earnings: 4411.33, withTax: 646.00 },
{ earnings: 4415.67, withTax: 646.00 },
{ earnings: 4420.00, withTax: 646.00 },
{ earnings: 4424.33, withTax: 650.00 },
{ earnings: 4428.67, withTax: 650.00 },
{ earnings: 4433.00, withTax: 650.00 },
{ earnings: 4437.33, withTax: 654.00 },
{ earnings: 4441.67, withTax: 654.00 },
{ earnings: 4446.00, withTax: 654.00 },
{ earnings: 4450.33, withTax: 659.00 },
{ earnings: 4454.67, withTax: 659.00 },
{ earnings: 4459.00, withTax: 659.00 },
{ earnings: 4463.33, withTax: 663.00 },
{ earnings: 4467.67, withTax: 663.00 },
{ earnings: 4472.00, withTax: 663.00 },
{ earnings: 4476.33, withTax: 667.00 },
{ earnings: 4480.67, withTax: 667.00 },
{ earnings: 4485.00, withTax: 667.00 },
{ earnings: 4489.33, withTax: 672.00 },
{ earnings: 4493.67, withTax: 672.00 },
{ earnings: 4498.00, withTax: 672.00 },
{ earnings: 4502.33, withTax: 676.00 },
{ earnings: 4506.67, withTax: 676.00 },
{ earnings: 4511.00, withTax: 676.00 },
{ earnings: 4515.33, withTax: 680.00 },
{ earnings: 4519.67, withTax: 680.00 },
{ earnings: 4524.00, withTax: 680.00 },
{ earnings: 4528.33, withTax: 685.00 },
{ earnings: 4532.67, withTax: 685.00 },
{ earnings: 4537.00, withTax: 685.00 },
{ earnings: 4541.33, withTax: 685.00 },
{ earnings: 4545.67, withTax: 689.00 },
{ earnings: 4550.00, withTax: 689.00 },
{ earnings: 4554.33, withTax: 689.00 },
{ earnings: 4558.67, withTax: 693.00 },
{ earnings: 4563.00, withTax: 693.00 },
{ earnings: 4567.33, withTax: 693.00 },
{ earnings: 4571.67, withTax: 698.00 },
{ earnings: 4576.00, withTax: 698.00 },
{ earnings: 4580.33, withTax: 698.00 },
{ earnings: 4584.67, withTax: 702.00 },
{ earnings: 4589.00, withTax: 702.00 },
{ earnings: 4593.33, withTax: 702.00 },
{ earnings: 4597.67, withTax: 706.00 },
{ earnings: 4602.00, withTax: 706.00 },
{ earnings: 4606.33, withTax: 706.00 },
{ earnings: 4610.67, withTax: 711.00 },
{ earnings: 4615.00, withTax: 711.00 },
{ earnings: 4619.33, withTax: 711.00 },
{ earnings: 4623.67, withTax: 715.00 },
{ earnings: 4628.00, withTax: 715.00 },
{ earnings: 4632.33, withTax: 715.00 },
{ earnings: 4636.67, withTax: 719.00 },
{ earnings: 4641.00, withTax: 719.00 },
{ earnings: 4645.33, withTax: 719.00 },
{ earnings: 4649.67, withTax: 724.00 },
{ earnings: 4654.00, withTax: 724.00 },
{ earnings: 4658.33, withTax: 724.00 },
{ earnings: 4662.67, withTax: 728.00 },
{ earnings: 4667.00, withTax: 728.00 },
{ earnings: 4671.33, withTax: 728.00 },
{ earnings: 4675.67, withTax: 728.00 },
{ earnings: 4680.00, withTax: 732.00 },
{ earnings: 4684.33, withTax: 732.00 },
{ earnings: 4688.67, withTax: 732.00 },
{ earnings: 4693.00, withTax: 737.00 },
{ earnings: 4697.33, withTax: 737.00 },
{ earnings: 4701.67, withTax: 737.00 },
{ earnings: 4706.00, withTax: 741.00 },
{ earnings: 4710.33, withTax: 741.00 },
{ earnings: 4714.67, withTax: 741.00 },
{ earnings: 4719.00, withTax: 745.00 },
{ earnings: 4723.33, withTax: 745.00 },
{ earnings: 4727.67, withTax: 745.00 },
{ earnings: 4732.00, withTax: 750.00 },
{ earnings: 4736.33, withTax: 750.00 },
{ earnings: 4740.67, withTax: 750.00 },
{ earnings: 4745.00, withTax: 754.00 },
{ earnings: 4749.33, withTax: 754.00 },
{ earnings: 4753.67, withTax: 754.00 },
{ earnings: 4758.00, withTax: 758.00 },
{ earnings: 4762.33, withTax: 758.00 },
{ earnings: 4766.67, withTax: 758.00 },
{ earnings: 4771.00, withTax: 763.00 },
{ earnings: 4775.33, withTax: 763.00 },
{ earnings: 4779.67, withTax: 763.00 },
{ earnings: 4784.00, withTax: 767.00 },
{ earnings: 4788.33, withTax: 767.00 },
{ earnings: 4792.67, withTax: 767.00 },
{ earnings: 4797.00, withTax: 771.00 },
{ earnings: 4801.33, withTax: 771.00 },
{ earnings: 4805.67, withTax: 771.00 },
{ earnings: 4810.00, withTax: 771.00 },
{ earnings: 4814.33, withTax: 776.00 },
{ earnings: 4818.67, withTax: 776.00 },
{ earnings: 4823.00, withTax: 776.00 },
{ earnings: 4827.33, withTax: 780.00 },
{ earnings: 4831.67, withTax: 780.00 },
{ earnings: 4836.00, withTax: 780.00 },
{ earnings: 4840.33, withTax: 784.00 },
{ earnings: 4844.67, withTax: 784.00 },
{ earnings: 4849.00, withTax: 784.00 },
{ earnings: 4853.33, withTax: 789.00 },
{ earnings: 4857.67, withTax: 789.00 },
{ earnings: 4862.00, withTax: 789.00 },
{ earnings: 4866.33, withTax: 793.00 },
{ earnings: 4870.67, withTax: 793.00 },
{ earnings: 4875.00, withTax: 793.00 },
{ earnings: 4879.33, withTax: 797.00 },
{ earnings: 4883.67, withTax: 797.00 },
{ earnings: 4888.00, withTax: 797.00 },
{ earnings: 4892.33, withTax: 802.00 },
{ earnings: 4896.67, withTax: 802.00 },
{ earnings: 4901.00, withTax: 802.00 },
{ earnings: 4905.33, withTax: 806.00 },
{ earnings: 4909.67, withTax: 806.00 },
{ earnings: 4914.00, withTax: 806.00 },
{ earnings: 4918.33, withTax: 810.00 },
{ earnings: 4922.67, withTax: 810.00 },
{ earnings: 4927.00, withTax: 810.00 },
{ earnings: 4931.33, withTax: 815.00 },
{ earnings: 4935.67, withTax: 815.00 },
{ earnings: 4940.00, withTax: 815.00 },
{ earnings: 4944.33, withTax: 815.00 },
{ earnings: 4948.67, withTax: 819.00 },
{ earnings: 4953.00, withTax: 819.00 },
{ earnings: 4957.33, withTax: 819.00 },
{ earnings: 4961.67, withTax: 823.00 },
{ earnings: 4966.00, withTax: 823.00 },
{ earnings: 4970.33, withTax: 823.00 },
{ earnings: 4974.67, withTax: 828.00 },
{ earnings: 4979.00, withTax: 828.00 },
{ earnings: 4983.33, withTax: 828.00 },
{ earnings: 4987.67, withTax: 832.00 },
{ earnings: 4992.00, withTax: 832.00 },
{ earnings: 4996.33, withTax: 832.00 },
{ earnings: 5000.67, withTax: 836.00 },
{ earnings: 5005.00, withTax: 836.00 },
{ earnings: 5009.33, withTax: 836.00 },
{ earnings: 5013.67, withTax: 841.00 },
{ earnings: 5018.00, withTax: 841.00 },
{ earnings: 5022.33, withTax: 841.00 },
{ earnings: 5026.67, withTax: 845.00 },
{ earnings: 5031.00, withTax: 845.00 },
{ earnings: 5035.33, withTax: 845.00 },
{ earnings: 5039.67, withTax: 849.00 },
{ earnings: 5044.00, withTax: 849.00 },
{ earnings: 5048.33, withTax: 849.00 },
{ earnings: 5052.67, withTax: 854.00 },
{ earnings: 5057.00, withTax: 854.00 },
{ earnings: 5061.33, withTax: 854.00 },
{ earnings: 5065.67, withTax: 858.00 },
{ earnings: 5070.00, withTax: 858.00 },
{ earnings: 5074.33, withTax: 858.00 },
{ earnings: 5078.67, withTax: 858.00 },
{ earnings: 5083.00, withTax: 862.00 },
{ earnings: 5087.33, withTax: 862.00 },
{ earnings: 5091.67, withTax: 862.00 },
{ earnings: 5096.00, withTax: 867.00 },
{ earnings: 5100.33, withTax: 867.00 },
{ earnings: 5104.67, withTax: 867.00 },
{ earnings: 5109.00, withTax: 871.00 },
{ earnings: 5113.33, withTax: 871.00 },
{ earnings: 5117.67, withTax: 871.00 },
{ earnings: 5122.00, withTax: 875.00 },
{ earnings: 5126.33, withTax: 875.00 },
{ earnings: 5130.67, withTax: 875.00 },
{ earnings: 5135.00, withTax: 880.00 },
{ earnings: 5139.33, withTax: 880.00 },
{ earnings: 5143.67, withTax: 880.00 },
{ earnings: 5148.00, withTax: 884.00 },
{ earnings: 5152.33, withTax: 884.00 },
{ earnings: 5156.67, withTax: 884.00 },
{ earnings: 5161.00, withTax: 888.00 },
{ earnings: 5165.33, withTax: 888.00 },
{ earnings: 5169.67, withTax: 888.00 },
{ earnings: 5174.00, withTax: 893.00 },
{ earnings: 5178.33, withTax: 893.00 },
{ earnings: 5182.67, withTax: 893.00 },
{ earnings: 5187.00, withTax: 897.00 },
{ earnings: 5191.33, withTax: 897.00 },
{ earnings: 5195.67, withTax: 897.00 },
{ earnings: 5200.00, withTax: 901.00 },
{ earnings: 5204.33, withTax: 901.00 },
{ earnings: 5208.67, withTax: 901.00 },
{ earnings: 5213.00, withTax: 901.00 },
{ earnings: 5217.33, withTax: 906.00 },
{ earnings: 5221.67, withTax: 906.00 },
{ earnings: 5226.00, withTax: 906.00 },
{ earnings: 5230.33, withTax: 910.00 },
{ earnings: 5234.67, withTax: 910.00 },
{ earnings: 5239.00, withTax: 910.00 },
{ earnings: 5243.33, withTax: 914.00 },
{ earnings: 5247.67, withTax: 914.00 },
{ earnings: 5252.00, withTax: 914.00 },
{ earnings: 5256.33, withTax: 919.00 },
{ earnings: 5260.67, withTax: 919.00 },
{ earnings: 5265.00, withTax: 919.00 },
{ earnings: 5269.33, withTax: 923.00 },
{ earnings: 5273.67, withTax: 923.00 },
{ earnings: 5278.00, withTax: 923.00 },
{ earnings: 5282.33, withTax: 927.00 },
{ earnings: 5286.67, withTax: 927.00 },
{ earnings: 5291.00, withTax: 927.00 },
{ earnings: 5295.33, withTax: 932.00 },
{ earnings: 5299.67, withTax: 932.00 },
{ earnings: 5304.00, withTax: 932.00 },
{ earnings: 5308.33, withTax: 936.00 },
{ earnings: 5312.67, withTax: 936.00 },
{ earnings: 5317.00, withTax: 936.00 },
{ earnings: 5321.33, withTax: 940.00 },
{ earnings: 5325.67, withTax: 940.00 },
{ earnings: 5330.00, withTax: 940.00 },
{ earnings: 5334.33, withTax: 945.00 },
{ earnings: 5338.67, withTax: 945.00 },
{ earnings: 5343.00, withTax: 945.00 },
{ earnings: 5347.33, withTax: 945.00 },
{ earnings: 5351.67, withTax: 949.00 },
{ earnings: 5356.00, withTax: 949.00 },
{ earnings: 5360.33, withTax: 949.00 },
{ earnings: 5364.67, withTax: 953.00 },
{ earnings: 5369.00, withTax: 953.00 },
{ earnings: 5373.33, withTax: 953.00 },
{ earnings: 5377.67, withTax: 958.00 },
{ earnings: 5382.00, withTax: 958.00 },
{ earnings: 5386.33, withTax: 958.00 },
{ earnings: 5390.67, withTax: 962.00 },
{ earnings: 5395.00, withTax: 962.00 },
{ earnings: 5399.33, withTax: 962.00 },
{ earnings: 5403.67, withTax: 966.00 },
{ earnings: 5408.00, withTax: 966.00 },
{ earnings: 5412.33, withTax: 966.00 },
{ earnings: 5416.67, withTax: 971.00 },
{ earnings: 5421.00, withTax: 971.00 },
{ earnings: 5425.33, withTax: 971.00 },
{ earnings: 5429.67, withTax: 975.00 },
{ earnings: 5434.00, withTax: 975.00 },
{ earnings: 5438.33, withTax: 975.00 },
{ earnings: 5442.67, withTax: 979.00 },
{ earnings: 5447.00, withTax: 979.00 },
{ earnings: 5451.33, withTax: 979.00 },
{ earnings: 5455.67, withTax: 984.00 },
{ earnings: 5460.00, withTax: 984.00 },
{ earnings: 5464.33, withTax: 984.00 },
{ earnings: 5468.67, withTax: 988.00 },
{ earnings: 5473.00, withTax: 988.00 },
{ earnings: 5477.33, withTax: 988.00 },
{ earnings: 5481.67, withTax: 988.00 },
{ earnings: 5486.00, withTax: 992.00 },
{ earnings: 5490.33, withTax: 992.00 },
{ earnings: 5494.67, withTax: 992.00 },
{ earnings: 5499.00, withTax: 997.00 },
{ earnings: 5503.33, withTax: 997.00 },
{ earnings: 5507.67, withTax: 997.00 },
{ earnings: 5512.00, withTax: 1001.00 },
{ earnings: 5516.33, withTax: 1001.00 },
{ earnings: 5520.67, withTax: 1001.00 },
{ earnings: 5525.00, withTax: 1005.00 },
{ earnings: 5529.33, withTax: 1005.00 },
{ earnings: 5533.67, withTax: 1005.00 },
{ earnings: 5538.00, withTax: 1010.00 },
{ earnings: 5542.33, withTax: 1010.00 },
{ earnings: 5546.67, withTax: 1010.00 },
{ earnings: 5551.00, withTax: 1014.00 },
{ earnings: 5555.33, withTax: 1014.00 },
{ earnings: 5559.67, withTax: 1014.00 },
{ earnings: 5564.00, withTax: 1018.00 },
{ earnings: 5568.33, withTax: 1018.00 },
{ earnings: 5572.67, withTax: 1018.00 },
{ earnings: 5577.00, withTax: 1023.00 },
{ earnings: 5581.33, withTax: 1023.00 },
{ earnings: 5585.67, withTax: 1023.00 },
{ earnings: 5590.00, withTax: 1027.00 },
{ earnings: 5594.33, withTax: 1027.00 },
{ earnings: 5598.67, withTax: 1027.00 },
{ earnings: 5603.00, withTax: 1027.00 },
{ earnings: 5607.33, withTax: 1031.00 },
{ earnings: 5611.67, withTax: 1031.00 },
{ earnings: 5616.00, withTax: 1031.00 },
{ earnings: 5620.33, withTax: 1036.00 },
{ earnings: 5624.67, withTax: 1036.00 },
{ earnings: 5629.00, withTax: 1036.00 },
{ earnings: 5633.33, withTax: 1040.00 },
{ earnings: 5637.67, withTax: 1040.00 },
{ earnings: 5642.00, withTax: 1040.00 },
{ earnings: 5646.33, withTax: 1044.00 },
{ earnings: 5650.67, withTax: 1044.00 },
{ earnings: 5655.00, withTax: 1044.00 },
{ earnings: 5659.33, withTax: 1049.00 },
{ earnings: 5663.67, withTax: 1049.00 },
{ earnings: 5668.00, withTax: 1049.00 },
{ earnings: 5672.33, withTax: 1053.00 },
{ earnings: 5676.67, withTax: 1053.00 },
{ earnings: 5681.00, withTax: 1053.00 },
{ earnings: 5685.33, withTax: 1057.00 },
{ earnings: 5689.67, withTax: 1057.00 },
{ earnings: 5694.00, withTax: 1057.00 },
{ earnings: 5698.33, withTax: 1062.00 },
{ earnings: 5702.67, withTax: 1062.00 },
{ earnings: 5707.00, withTax: 1062.00 },
{ earnings: 5711.33, withTax: 1062.00 },
{ earnings: 5715.67, withTax: 1066.00 },
{ earnings: 5720.00, withTax: 1066.00 },
{ earnings: 5724.33, withTax: 1066.00 },
{ earnings: 5728.67, withTax: 1070.00 },
{ earnings: 5733.00, withTax: 1070.00 },
{ earnings: 5737.33, withTax: 1070.00 },
{ earnings: 5741.67, withTax: 1075.00 },
{ earnings: 5746.00, withTax: 1075.00 },
{ earnings: 5750.33, withTax: 1075.00 },
{ earnings: 5754.67, withTax: 1079.00 },
{ earnings: 5759.00, withTax: 1079.00 },
{ earnings: 5763.33, withTax: 1079.00 },
{ earnings: 5767.67, withTax: 1083.00 },
{ earnings: 5772.00, withTax: 1083.00 },
{ earnings: 5776.33, withTax: 1083.00 },
{ earnings: 5780.67, withTax: 1088.00 },
{ earnings: 5785.00, withTax: 1088.00 },
{ earnings: 5789.33, withTax: 1088.00 },
{ earnings: 5793.67, withTax: 1092.00 },
{ earnings: 5798.00, withTax: 1092.00 },
{ earnings: 5802.33, withTax: 1092.00 },
{ earnings: 5806.67, withTax: 1096.00 },
{ earnings: 5811.00, withTax: 1096.00 },
{ earnings: 5815.33, withTax: 1096.00 },
{ earnings: 5819.67, withTax: 1096.00 },
{ earnings: 5824.00, withTax: 1101.00 },
{ earnings: 5828.33, withTax: 1101.00 },
{ earnings: 5832.67, withTax: 1101.00 },
{ earnings: 5837.00, withTax: 1105.00 },
{ earnings: 5841.33, withTax: 1105.00 },
{ earnings: 5845.67, withTax: 1105.00 },
{ earnings: 5850.00, withTax: 1109.00 },
{ earnings: 5854.33, withTax: 1109.00 },
{ earnings: 5858.67, withTax: 1109.00 },
{ earnings: 5863.00, withTax: 1114.00 },
{ earnings: 5867.33, withTax: 1114.00 },
{ earnings: 5871.67, withTax: 1114.00 },
{ earnings: 5876.00, withTax: 1118.00 },
{ earnings: 5880.33, withTax: 1118.00 },
{ earnings: 5884.67, withTax: 1118.00 },
{ earnings: 5889.00, withTax: 1122.00 },
{ earnings: 5893.33, withTax: 1122.00 },
{ earnings: 5897.67, withTax: 1122.00 },
{ earnings: 5902.00, withTax: 1127.00 },
{ earnings: 5906.33, withTax: 1127.00 },
{ earnings: 5910.67, withTax: 1127.00 },
{ earnings: 5915.00, withTax: 1131.00 },
{ earnings: 5919.33, withTax: 1131.00 },
{ earnings: 5923.67, withTax: 1131.00 },
{ earnings: 5928.00, withTax: 1131.00 },
{ earnings: 5932.33, withTax: 1135.00 },
{ earnings: 5936.67, withTax: 1135.00 },
{ earnings: 5941.00, withTax: 1135.00 },
{ earnings: 5945.33, withTax: 1140.00 },
{ earnings: 5949.67, withTax: 1140.00 },
{ earnings: 5954.00, withTax: 1140.00 },
{ earnings: 5958.33, withTax: 1144.00 },
{ earnings: 5962.67, withTax: 1144.00 },
{ earnings: 5967.00, withTax: 1144.00 },
{ earnings: 5971.33, withTax: 1148.00 },
{ earnings: 5975.67, withTax: 1148.00 },
{ earnings: 5980.00, withTax: 1148.00 },
{ earnings: 5984.33, withTax: 1153.00 },
{ earnings: 5988.67, withTax: 1153.00 },
{ earnings: 5993.00, withTax: 1153.00 },
{ earnings: 5997.33, withTax: 1157.00 },
{ earnings: 6001.67, withTax: 1157.00 },
{ earnings: 6006.00, withTax: 1157.00 },
{ earnings: 6010.33, withTax: 1161.00 },
{ earnings: 6014.67, withTax: 1161.00 },
{ earnings: 6019.00, withTax: 1161.00 },
{ earnings: 6023.33, withTax: 1166.00 },
{ earnings: 6027.67, withTax: 1166.00 },
{ earnings: 6032.00, withTax: 1166.00 },
{ earnings: 6036.33, withTax: 1166.00 },
{ earnings: 6040.67, withTax: 1170.00 },
{ earnings: 6045.00, withTax: 1170.00 },
{ earnings: 6049.33, withTax: 1170.00 },
{ earnings: 6053.67, withTax: 1174.00 },
{ earnings: 6058.00, withTax: 1174.00 },
{ earnings: 6062.33, withTax: 1174.00 },
{ earnings: 6066.67, withTax: 1179.00 },
{ earnings: 6071.00, withTax: 1179.00 },
{ earnings: 6075.33, withTax: 1179.00 },
{ earnings: 6079.67, withTax: 1183.00 },
{ earnings: 6084.00, withTax: 1183.00 },
{ earnings: 6088.33, withTax: 1183.00 },
{ earnings: 6092.67, withTax: 1187.00 },
{ earnings: 6097.00, withTax: 1187.00 },
{ earnings: 6101.33, withTax: 1187.00 },
{ earnings: 6105.67, withTax: 1192.00 },
{ earnings: 6110.00, withTax: 1192.00 },
{ earnings: 6114.33, withTax: 1192.00 },
{ earnings: 6118.67, withTax: 1196.00 },
{ earnings: 6123.00, withTax: 1196.00 },
{ earnings: 6127.33, withTax: 1196.00 },
{ earnings: 6131.67, withTax: 1200.00 },
{ earnings: 6136.00, withTax: 1200.00 },
{ earnings: 6140.33, withTax: 1200.00 },
{ earnings: 6144.67, withTax: 1200.00 },
{ earnings: 6149.00, withTax: 1205.00 },
{ earnings: 6153.33, withTax: 1205.00 },
{ earnings: 6157.67, withTax: 1205.00 },
{ earnings: 6162.00, withTax: 1209.00 },
{ earnings: 6166.33, withTax: 1209.00 },
{ earnings: 6170.67, withTax: 1209.00 },
{ earnings: 6175.00, withTax: 1213.00 },
{ earnings: 6179.33, withTax: 1213.00 },
{ earnings: 6183.67, withTax: 1213.00 },
{ earnings: 6188.00, withTax: 1218.00 },
{ earnings: 6192.33, withTax: 1218.00 },
{ earnings: 6196.67, withTax: 1218.00 },
{ earnings: 6201.00, withTax: 1222.00 },
{ earnings: 6205.33, withTax: 1222.00 },
{ earnings: 6209.67, withTax: 1222.00 },
{ earnings: 6214.00, withTax: 1226.00 },
{ earnings: 6218.33, withTax: 1226.00 },
{ earnings: 6222.67, withTax: 1226.00 },
{ earnings: 6227.00, withTax: 1231.00 },
{ earnings: 6231.33, withTax: 1231.00 },
{ earnings: 6235.67, withTax: 1231.00 },
{ earnings: 6240.00, withTax: 1235.00 },
{ earnings: 6244.33, withTax: 1235.00 },
{ earnings: 6248.67, withTax: 1235.00 },
{ earnings: 6253.00, withTax: 1235.00 },
{ earnings: 6257.33, withTax: 1239.00 },
{ earnings: 6261.67, withTax: 1239.00 },
{ earnings: 6266.00, withTax: 1239.00 },
{ earnings: 6270.33, withTax: 1244.00 },
{ earnings: 6274.67, withTax: 1244.00 },
{ earnings: 6279.00, withTax: 1244.00 },
{ earnings: 6283.33, withTax: 1248.00 },
{ earnings: 6287.67, withTax: 1248.00 },
{ earnings: 6292.00, withTax: 1248.00 },
{ earnings: 6296.33, withTax: 1252.00 },
{ earnings: 6300.67, withTax: 1252.00 },
{ earnings: 6305.00, withTax: 1252.00 },
{ earnings: 6309.33, withTax: 1257.00 },
{ earnings: 6313.67, withTax: 1257.00 },
{ earnings: 6318.00, withTax: 1257.00 },
{ earnings: 6322.33, withTax: 1261.00 },
{ earnings: 6326.67, withTax: 1261.00 },
{ earnings: 6331.00, withTax: 1261.00 },
{ earnings: 6335.33, withTax: 1265.00 },
{ earnings: 6339.67, withTax: 1265.00 },
{ earnings: 6344.00, withTax: 1265.00 },
{ earnings: 6348.33, withTax: 1270.00 },
{ earnings: 6352.67, withTax: 1270.00 },
{ earnings: 6357.00, withTax: 1270.00 },
{ earnings: 6361.33, withTax: 1270.00 },
{ earnings: 6365.67, withTax: 1274.00 },
{ earnings: 6370.00, withTax: 1274.00 },
{ earnings: 6374.33, withTax: 1274.00 },
{ earnings: 6378.67, withTax: 1278.00 },
{ earnings: 6383.00, withTax: 1278.00 },
{ earnings: 6387.33, withTax: 1278.00 },
{ earnings: 6391.67, withTax: 1283.00 },
{ earnings: 6396.00, withTax: 1283.00 },
{ earnings: 6400.33, withTax: 1283.00 },
{ earnings: 6404.67, withTax: 1287.00 },
{ earnings: 6409.00, withTax: 1287.00 },
{ earnings: 6413.33, withTax: 1287.00 },
{ earnings: 6417.67, withTax: 1291.00 },
{ earnings: 6422.00, withTax: 1291.00 },
{ earnings: 6426.33, withTax: 1291.00 },
{ earnings: 6430.67, withTax: 1296.00 },
{ earnings: 6435.00, withTax: 1296.00 },
{ earnings: 6439.33, withTax: 1296.00 },
{ earnings: 6443.67, withTax: 1300.00 },
{ earnings: 6448.00, withTax: 1300.00 },
{ earnings: 6452.33, withTax: 1300.00 },
{ earnings: 6456.67, withTax: 1304.00 },
{ earnings: 6461.00, withTax: 1304.00 },
{ earnings: 6465.33, withTax: 1304.00 },
{ earnings: 6469.67, withTax: 1304.00 },
{ earnings: 6474.00, withTax: 1309.00 },
{ earnings: 6478.33, withTax: 1309.00 },
{ earnings: 6482.67, withTax: 1309.00 },
{ earnings: 6487.00, withTax: 1313.00 },
{ earnings: 6491.33, withTax: 1313.00 },
{ earnings: 6495.67, withTax: 1313.00 },
{ earnings: 6500.00, withTax: 1317.00 },
{ earnings: 6504.33, withTax: 1317.00 },
{ earnings: 6508.67, withTax: 1317.00 },
{ earnings: 6513.00, withTax: 1322.00 },
{ earnings: 6517.33, withTax: 1322.00 },
{ earnings: 6521.67, withTax: 1322.00 },
{ earnings: 6526.00, withTax: 1326.00 },
{ earnings: 6530.33, withTax: 1326.00 },
{ earnings: 6534.67, withTax: 1326.00 },
{ earnings: 6539.00, withTax: 1330.00 },
{ earnings: 6543.33, withTax: 1330.00 },
{ earnings: 6547.67, withTax: 1330.00 },
{ earnings: 6552.00, withTax: 1335.00 },
{ earnings: 6556.33, withTax: 1335.00 },
{ earnings: 6560.67, withTax: 1335.00 },
{ earnings: 6565.00, withTax: 1339.00 },
{ earnings: 6569.33, withTax: 1339.00 },
{ earnings: 6573.67, withTax: 1339.00 },
{ earnings: 6578.00, withTax: 1339.00 },
{ earnings: 6582.33, withTax: 1343.00 },
{ earnings: 6586.67, withTax: 1343.00 },
{ earnings: 6591.00, withTax: 1343.00 },
{ earnings: 6595.33, withTax: 1348.00 },
{ earnings: 6599.67, withTax: 1348.00 },
{ earnings: 6604.00, withTax: 1348.00 },
{ earnings: 6608.33, withTax: 1352.00 },
{ earnings: 6612.67, withTax: 1352.00 },
{ earnings: 6617.00, withTax: 1352.00 },
{ earnings: 6621.33, withTax: 1356.00 },
{ earnings: 6625.67, withTax: 1356.00 },
{ earnings: 6630.00, withTax: 1356.00 },
{ earnings: 6634.33, withTax: 1361.00 },
{ earnings: 6638.67, withTax: 1361.00 },
{ earnings: 6643.00, withTax: 1361.00 },
{ earnings: 6647.33, withTax: 1365.00 },
{ earnings: 6651.67, withTax: 1365.00 },
{ earnings: 6656.00, withTax: 1365.00 },
{ earnings: 6660.33, withTax: 1369.00 },
{ earnings: 6664.67, withTax: 1369.00 },
{ earnings: 6669.00, withTax: 1369.00 },
{ earnings: 6673.33, withTax: 1374.00 },
{ earnings: 6677.67, withTax: 1374.00 },
{ earnings: 6682.00, withTax: 1374.00 },
{ earnings: 6686.33, withTax: 1374.00 },
{ earnings: 6690.67, withTax: 1378.00 },
{ earnings: 6695.00, withTax: 1378.00 },
{ earnings: 6699.33, withTax: 1378.00 },
{ earnings: 6703.67, withTax: 1382.00 },
{ earnings: 6708.00, withTax: 1382.00 },
{ earnings: 6712.33, withTax: 1382.00 },
{ earnings: 6716.67, withTax: 1387.00 },
{ earnings: 6721.00, withTax: 1387.00 },
{ earnings: 6725.33, withTax: 1387.00 },
{ earnings: 6729.67, withTax: 1391.00 },
{ earnings: 6734.00, withTax: 1391.00 },
{ earnings: 6738.33, withTax: 1391.00 },
{ earnings: 6742.67, withTax: 1395.00 },
{ earnings: 6747.00, withTax: 1395.00 },
{ earnings: 6751.33, withTax: 1395.00 },
{ earnings: 6755.67, withTax: 1400.00 },
{ earnings: 6760.00, withTax: 1400.00 },
{ earnings: 6764.33, withTax: 1400.00 },
{ earnings: 6768.67, withTax: 1404.00 },
{ earnings: 6773.00, withTax: 1404.00 },
{ earnings: 6777.33, withTax: 1404.00 },
{ earnings: 6781.67, withTax: 1408.00 },
{ earnings: 6786.00, withTax: 1408.00 },
{ earnings: 6790.33, withTax: 1408.00 },
{ earnings: 6794.67, withTax: 1408.00 },
{ earnings: 6799.00, withTax: 1413.00 },
{ earnings: 6803.33, withTax: 1413.00 },
{ earnings: 6807.67, withTax: 1413.00 },
{ earnings: 6812.00, withTax: 1417.00 },
{ earnings: 6816.33, withTax: 1417.00 },
{ earnings: 6820.67, withTax: 1417.00 },
{ earnings: 6825.00, withTax: 1421.00 },
{ earnings: 6829.33, withTax: 1421.00 },
{ earnings: 6833.67, withTax: 1421.00 },
{ earnings: 6838.00, withTax: 1426.00 },
{ earnings: 6842.33, withTax: 1426.00 },
{ earnings: 6846.67, withTax: 1426.00 },
{ earnings: 6851.00, withTax: 1430.00 },
{ earnings: 6855.33, withTax: 1430.00 },
{ earnings: 6859.67, withTax: 1430.00 },
{ earnings: 6864.00, withTax: 1434.00 },
{ earnings: 6868.33, withTax: 1434.00 },
{ earnings: 6872.67, withTax: 1434.00 },
{ earnings: 6877.00, withTax: 1439.00 },
{ earnings: 6881.33, withTax: 1439.00 },
{ earnings: 6885.67, withTax: 1439.00 },
{ earnings: 6890.00, withTax: 1443.00 },
{ earnings: 6894.33, withTax: 1443.00 },
{ earnings: 6898.67, withTax: 1443.00 },
{ earnings: 6903.00, withTax: 1443.00 },
{ earnings: 6907.33, withTax: 1447.00 },
{ earnings: 6911.67, withTax: 1447.00 },
{ earnings: 6916.00, withTax: 1447.00 },
{ earnings: 6920.33, withTax: 1452.00 },
{ earnings: 6924.67, withTax: 1452.00 },
{ earnings: 6929.00, withTax: 1452.00 },
{ earnings: 6933.33, withTax: 1456.00 },
{ earnings: 6937.67, withTax: 1456.00 },
{ earnings: 6942.00, withTax: 1456.00 },
{ earnings: 6946.33, withTax: 1460.00 },
{ earnings: 6950.67, withTax: 1460.00 },
{ earnings: 6955.00, withTax: 1460.00 },
{ earnings: 6959.33, withTax: 1465.00 },
{ earnings: 6963.67, withTax: 1465.00 },
{ earnings: 6968.00, withTax: 1465.00 },
{ earnings: 6972.33, withTax: 1469.00 },
{ earnings: 6976.67, withTax: 1469.00 },
{ earnings: 6981.00, withTax: 1469.00 },
{ earnings: 6985.33, withTax: 1473.00 },
{ earnings: 6989.67, withTax: 1473.00 },
{ earnings: 6994.00, withTax: 1473.00 },
{ earnings: 6998.33, withTax: 1478.00 },
{ earnings: 7002.67, withTax: 1478.00 },
{ earnings: 7007.00, withTax: 1478.00 },
{ earnings: 7011.33, withTax: 1478.00 },
{ earnings: 7015.67, withTax: 1482.00 },
{ earnings: 7020.00, withTax: 1482.00 },
{ earnings: 7024.33, withTax: 1482.00 },
{ earnings: 7028.67, withTax: 1486.00 },
{ earnings: 7033.00, withTax: 1486.00 },
{ earnings: 7037.33, withTax: 1486.00 },
{ earnings: 7041.67, withTax: 1491.00 },
{ earnings: 7046.00, withTax: 1491.00 },
{ earnings: 7050.33, withTax: 1491.00 },
{ earnings: 7054.67, withTax: 1495.00 },
{ earnings: 7059.00, withTax: 1495.00 },
{ earnings: 7063.33, withTax: 1495.00 },
{ earnings: 7067.67, withTax: 1499.00 },
{ earnings: 7072.00, withTax: 1499.00 },
{ earnings: 7076.33, withTax: 1499.00 },
{ earnings: 7080.67, withTax: 1504.00 },
{ earnings: 7085.00, withTax: 1504.00 },
{ earnings: 7089.33, withTax: 1504.00 },
{ earnings: 7093.67, withTax: 1508.00 },
{ earnings: 7098.00, withTax: 1508.00 },
{ earnings: 7102.33, withTax: 1508.00 },
{ earnings: 7106.67, withTax: 1512.00 },
{ earnings: 7111.00, withTax: 1512.00 },
{ earnings: 7115.33, withTax: 1512.00 },
{ earnings: 7119.67, withTax: 1512.00 },
{ earnings: 7124.00, withTax: 1517.00 },
{ earnings: 7128.33, withTax: 1517.00 },
{ earnings: 7132.67, withTax: 1517.00 },
{ earnings: 7137.00, withTax: 1521.00 },
{ earnings: 7141.33, withTax: 1521.00 },
{ earnings: 7145.67, withTax: 1521.00 },
{ earnings: 7150.00, withTax: 1525.00 },
{ earnings: 7154.33, withTax: 1525.00 },
{ earnings: 7158.67, withTax: 1525.00 },
{ earnings: 7163.00, withTax: 1530.00 },
{ earnings: 7167.33, withTax: 1530.00 },
{ earnings: 7171.67, withTax: 1530.00 },
{ earnings: 7176.00, withTax: 1534.00 },
{ earnings: 7180.33, withTax: 1534.00 },
{ earnings: 7184.67, withTax: 1534.00 },
{ earnings: 7189.00, withTax: 1538.00 },
{ earnings: 7193.33, withTax: 1538.00 },
{ earnings: 7197.67, withTax: 1538.00 },
{ earnings: 7202.00, withTax: 1543.00 },
{ earnings: 7206.33, withTax: 1543.00 },
{ earnings: 7210.67, withTax: 1543.00 },
{ earnings: 7215.00, withTax: 1547.00 },
{ earnings: 7219.33, withTax: 1547.00 },
{ earnings: 7223.67, withTax: 1547.00 },
{ earnings: 7228.00, withTax: 1547.00 },
{ earnings: 7232.33, withTax: 1551.00 },
{ earnings: 7236.67, withTax: 1551.00 },
{ earnings: 7241.00, withTax: 1551.00 },
{ earnings: 7245.33, withTax: 1556.00 },
{ earnings: 7249.67, withTax: 1556.00 },
{ earnings: 7254.00, withTax: 1556.00 },
{ earnings: 7258.33, withTax: 1560.00 },
{ earnings: 7262.67, withTax: 1560.00 },
{ earnings: 7267.00, withTax: 1560.00 },
{ earnings: 7271.33, withTax: 1564.00 },
{ earnings: 7275.67, withTax: 1564.00 },
{ earnings: 7280.00, withTax: 1564.00 },
{ earnings: 7284.33, withTax: 1569.00 },
{ earnings: 7288.67, withTax: 1569.00 },
{ earnings: 7293.00, withTax: 1569.00 },
{ earnings: 7297.33, withTax: 1573.00 },
{ earnings: 7301.67, withTax: 1573.00 },
{ earnings: 7306.00, withTax: 1573.00 },
{ earnings: 7310.33, withTax: 1577.00 },
{ earnings: 7314.67, withTax: 1577.00 },
{ earnings: 7319.00, withTax: 1577.00 },
{ earnings: 7323.33, withTax: 1582.00 },
{ earnings: 7327.67, withTax: 1582.00 },
{ earnings: 7332.00, withTax: 1582.00 },
{ earnings: 7336.33, withTax: 1582.00 },
{ earnings: 7340.67, withTax: 1586.00 },
{ earnings: 7345.00, withTax: 1586.00 },
{ earnings: 7349.33, withTax: 1586.00 },
{ earnings: 7353.67, withTax: 1590.00 },
{ earnings: 7358.00, withTax: 1590.00 },
{ earnings: 7362.33, withTax: 1590.00 },
{ earnings: 7366.67, withTax: 1595.00 },
{ earnings: 7371.00, withTax: 1595.00 },
{ earnings: 7375.33, withTax: 1595.00 },
{ earnings: 7379.67, withTax: 1599.00 },
{ earnings: 7384.00, withTax: 1599.00 },
{ earnings: 7388.33, withTax: 1599.00 },
{ earnings: 7392.67, withTax: 1603.00 },
{ earnings: 7397.00, withTax: 1603.00 },
{ earnings: 7401.33, withTax: 1603.00 },
{ earnings: 7405.67, withTax: 1608.00 },
{ earnings: 7410.00, withTax: 1608.00 },
{ earnings: 7414.33, withTax: 1608.00 },
{ earnings: 7418.67, withTax: 1612.00 },
{ earnings: 7423.00, withTax: 1612.00 },
{ earnings: 7427.33, withTax: 1612.00 },
{ earnings: 7431.67, withTax: 1616.00 },
{ earnings: 7436.00, withTax: 1616.00 },
{ earnings: 7440.33, withTax: 1616.00 },
{ earnings: 7444.67, withTax: 1616.00 },
{ earnings: 7449.00, withTax: 1621.00 },
{ earnings: 7453.33, withTax: 1621.00 },
{ earnings: 7457.67, withTax: 1621.00 },
{ earnings: 7462.00, withTax: 1625.00 },
{ earnings: 7466.33, withTax: 1625.00 },
{ earnings: 7470.67, withTax: 1625.00 },
{ earnings: 7475.00, withTax: 1629.00 },
{ earnings: 7479.33, withTax: 1629.00 },
{ earnings: 7483.67, withTax: 1629.00 },
{ earnings: 7488.00, withTax: 1634.00 },
{ earnings: 7492.33, withTax: 1634.00 },
{ earnings: 7496.67, withTax: 1634.00 },
{ earnings: 7501.00, withTax: 1638.00 },
{ earnings: 7505.33, withTax: 1638.00 },
{ earnings: 7509.67, withTax: 1638.00 },
{ earnings: 7514.00, withTax: 1642.00 },
{ earnings: 7518.33, withTax: 1642.00 },
{ earnings: 7522.67, withTax: 1642.00 },
{ earnings: 7527.00, withTax: 1647.00 },
{ earnings: 7531.33, withTax: 1647.00 },
{ earnings: 7535.67, withTax: 1647.00 },
{ earnings: 7540.00, withTax: 1651.00 },
{ earnings: 7544.33, withTax: 1651.00 },
{ earnings: 7548.67, withTax: 1651.00 },
{ earnings: 7553.00, withTax: 1651.00 },
{ earnings: 7557.33, withTax: 1655.00 },
{ earnings: 7561.67, withTax: 1655.00 },
{ earnings: 7566.00, withTax: 1655.00 },
{ earnings: 7570.33, withTax: 1660.00 },
{ earnings: 7574.67, withTax: 1660.00 },
{ earnings: 7579.00, withTax: 1660.00 },
{ earnings: 7583.33, withTax: 1664.00 },
{ earnings: 7587.67, withTax: 1664.00 },
{ earnings: 7592.00, withTax: 1664.00 },
{ earnings: 7596.33, withTax: 1668.00 },
{ earnings: 7600.67, withTax: 1668.00 },
{ earnings: 7605.00, withTax: 1668.00 },
{ earnings: 7609.33, withTax: 1673.00 },
{ earnings: 7613.67, withTax: 1673.00 },
{ earnings: 7618.00, withTax: 1673.00 },
{ earnings: 7622.33, withTax: 1677.00 },
{ earnings: 7626.67, withTax: 1677.00 },
{ earnings: 7631.00, withTax: 1677.00 },
{ earnings: 7635.33, withTax: 1681.00 },
{ earnings: 7639.67, withTax: 1681.00 },
{ earnings: 7644.00, withTax: 1681.00 },
{ earnings: 7648.33, withTax: 1686.00 },
{ earnings: 7652.67, withTax: 1686.00 },
{ earnings: 7657.00, withTax: 1686.00 },
{ earnings: 7661.33, withTax: 1686.00 },
{ earnings: 7665.67, withTax: 1690.00 },
{ earnings: 7670.00, withTax: 1690.00 },
{ earnings: 7674.33, withTax: 1690.00 },
{ earnings: 7678.67, withTax: 1694.00 },
{ earnings: 7683.00, withTax: 1694.00 },
{ earnings: 7687.33, withTax: 1694.00 },
{ earnings: 7691.67, withTax: 1699.00 },
{ earnings: 7696.00, withTax: 1699.00 },
{ earnings: 7700.33, withTax: 1699.00 },
{ earnings: 7704.67, withTax: 1703.00 },
{ earnings: 7709.00, withTax: 1703.00 },
{ earnings: 7713.33, withTax: 1703.00 },
{ earnings: 7717.67, withTax: 1707.00 },
{ earnings: 7722.00, withTax: 1707.00 },
{ earnings: 7726.33, withTax: 1707.00 },
{ earnings: 7730.67, withTax: 1712.00 },
{ earnings: 7735.00, withTax: 1712.00 },
{ earnings: 7739.33, withTax: 1712.00 },
{ earnings: 7743.67, withTax: 1716.00 },
{ earnings: 7748.00, withTax: 1716.00 },
{ earnings: 7752.33, withTax: 1716.00 },
{ earnings: 7756.67, withTax: 1720.00 },
{ earnings: 7761.00, withTax: 1720.00 },
{ earnings: 7765.33, withTax: 1720.00 },
{ earnings: 7769.67, withTax: 1720.00 },
{ earnings: 7774.00, withTax: 1725.00 },
{ earnings: 7778.33, withTax: 1725.00 },
{ earnings: 7782.67, withTax: 1725.00 },
{ earnings: 7787.00, withTax: 1729.00 },
{ earnings: 7791.33, withTax: 1729.00 },
{ earnings: 7795.67, withTax: 1729.00 },
{ earnings: 7800.00, withTax: 1733.00 },
{ earnings: 7804.33, withTax: 1733.00 },
{ earnings: 7808.67, withTax: 1733.00 },
{ earnings: 7813.00, withTax: 1738.00 },
{ earnings: 7817.33, withTax: 1738.00 },
{ earnings: 7821.67, withTax: 1738.00 },
{ earnings: 7826.00, withTax: 1742.00 },
{ earnings: 7830.33, withTax: 1742.00 },
{ earnings: 7834.67, withTax: 1742.00 },
{ earnings: 7839.00, withTax: 1746.00 },
{ earnings: 7843.33, withTax: 1746.00 },
{ earnings: 7847.67, withTax: 1746.00 },
{ earnings: 7852.00, withTax: 1751.00 },
{ earnings: 7856.33, withTax: 1751.00 },
{ earnings: 7860.67, withTax: 1751.00 },
{ earnings: 7865.00, withTax: 1755.00 },
{ earnings: 7869.33, withTax: 1755.00 },
{ earnings: 7873.67, withTax: 1755.00 },
{ earnings: 7878.00, withTax: 1755.00 },
{ earnings: 7882.33, withTax: 1759.00 },
{ earnings: 7886.67, withTax: 1759.00 },
{ earnings: 7891.00, withTax: 1759.00 },
{ earnings: 7895.33, withTax: 1764.00 },
{ earnings: 7899.67, withTax: 1764.00 },
{ earnings: 7904.00, withTax: 1764.00 },
{ earnings: 7908.33, withTax: 1768.00 },
{ earnings: 7912.67, withTax: 1768.00 },
{ earnings: 7917.00, withTax: 1768.00 },
{ earnings: 7921.33, withTax: 1772.00 },
{ earnings: 7925.67, withTax: 1772.00 },
{ earnings: 7930.00, withTax: 1772.00 },
{ earnings: 7934.33, withTax: 1777.00 },
{ earnings: 7938.67, withTax: 1777.00 },
{ earnings: 7943.00, withTax: 1777.00 },
{ earnings: 7947.33, withTax: 1781.00 },
{ earnings: 7951.67, withTax: 1781.00 },
{ earnings: 7956.00, withTax: 1781.00 },
{ earnings: 7960.33, withTax: 1785.00 },
{ earnings: 7964.67, withTax: 1785.00 },
{ earnings: 7969.00, withTax: 1785.00 },
{ earnings: 7973.33, withTax: 1790.00 },
{ earnings: 7977.67, withTax: 1790.00 },
{ earnings: 7982.00, withTax: 1790.00 },
{ earnings: 7986.33, withTax: 1790.00 },
{ earnings: 7990.67, withTax: 1794.00 },
{ earnings: 7995.00, withTax: 1794.00 },
{ earnings: 7999.33, withTax: 1794.00 },
{ earnings: 8003.67, withTax: 1798.00 },
{ earnings: 8008.00, withTax: 1798.00 },
{ earnings: 8012.33, withTax: 1798.00 },
{ earnings: 8016.67, withTax: 1803.00 },
{ earnings: 8021.00, withTax: 1803.00 },
{ earnings: 8025.33, withTax: 1803.00 },
{ earnings: 8029.67, withTax: 1807.00 },
{ earnings: 8034.00, withTax: 1807.00 },
{ earnings: 8038.33, withTax: 1807.00 },
{ earnings: 8042.67, withTax: 1811.00 },
{ earnings: 8047.00, withTax: 1811.00 },
{ earnings: 8051.33, withTax: 1811.00 },
{ earnings: 8055.67, withTax: 1816.00 },
{ earnings: 8060.00, withTax: 1816.00 },
{ earnings: 8064.33, withTax: 1816.00 },
{ earnings: 8068.67, withTax: 1820.00 },
{ earnings: 8073.00, withTax: 1820.00 },
{ earnings: 8077.33, withTax: 1820.00 },
{ earnings: 8081.67, withTax: 1824.00 },
{ earnings: 8086.00, withTax: 1824.00 },
{ earnings: 8090.33, withTax: 1824.00 },
{ earnings: 8094.67, withTax: 1824.00 },
{ earnings: 8099.00, withTax: 1829.00 },
{ earnings: 8103.33, withTax: 1829.00 },
{ earnings: 8107.67, withTax: 1829.00 },
{ earnings: 8112.00, withTax: 1833.00 },
{ earnings: 8116.33, withTax: 1833.00 },
{ earnings: 8120.67, withTax: 1833.00 },
{ earnings: 8125.00, withTax: 1837.00 },
{ earnings: 8129.33, withTax: 1837.00 },
{ earnings: 8133.67, withTax: 1837.00 },
{ earnings: 8138.00, withTax: 1842.00 },
{ earnings: 8142.33, withTax: 1842.00 },
{ earnings: 8146.67, withTax: 1842.00 },
{ earnings: 8151.00, withTax: 1846.00 },
{ earnings: 8155.33, withTax: 1846.00 },
{ earnings: 8159.67, withTax: 1846.00 },
{ earnings: 8164.00, withTax: 1850.00 },
{ earnings: 8168.33, withTax: 1850.00 },
{ earnings: 8172.67, withTax: 1850.00 },
{ earnings: 8177.00, withTax: 1855.00 },
{ earnings: 8181.33, withTax: 1855.00 },
{ earnings: 8185.67, withTax: 1855.00 },
{ earnings: 8190.00, withTax: 1859.00 },
{ earnings: 8194.33, withTax: 1859.00 },
{ earnings: 8198.67, withTax: 1859.00 },
{ earnings: 8203.00, withTax: 1859.00 },
{ earnings: 8207.33, withTax: 1863.00 },
{ earnings: 8211.67, withTax: 1863.00 },
{ earnings: 8216.00, withTax: 1863.00 },
{ earnings: 8220.33, withTax: 1868.00 },
{ earnings: 8224.67, withTax: 1868.00 },
{ earnings: 8229.00, withTax: 1868.00 },
{ earnings: 8233.33, withTax: 1872.00 },
{ earnings: 8237.67, withTax: 1872.00 },
{ earnings: 8242.00, withTax: 1872.00 },
{ earnings: 8246.33, withTax: 1876.00 },
{ earnings: 8250.67, withTax: 1876.00 },
{ earnings: 8255.00, withTax: 1876.00 },
{ earnings: 8259.33, withTax: 1881.00 },
{ earnings: 8263.67, withTax: 1881.00 },
{ earnings: 8268.00, withTax: 1881.00 },
{ earnings: 8272.33, withTax: 1885.00 },
{ earnings: 8276.67, withTax: 1885.00 },
{ earnings: 8281.00, withTax: 1885.00 },
{ earnings: 8285.33, withTax: 1889.00 },
{ earnings: 8289.67, withTax: 1889.00 },
{ earnings: 8294.00, withTax: 1889.00 },
{ earnings: 8298.33, withTax: 1894.00 },
{ earnings: 8302.67, withTax: 1894.00 },
{ earnings: 8307.00, withTax: 1894.00 },
{ earnings: 8311.33, withTax: 1894.00 },
{ earnings: 8315.67, withTax: 1898.00 },
{ earnings: 8320.00, withTax: 1898.00 },
{ earnings: 8324.33, withTax: 1898.00 },
{ earnings: 8328.67, withTax: 1902.00 },
{ earnings: 8333.00, withTax: 1902.00 },
{ earnings: 8337.33, withTax: 1902.00 },
{ earnings: 8341.67, withTax: 1907.00 },
{ earnings: 8346.00, withTax: 1907.00 },
{ earnings: 8350.33, withTax: 1907.00 },
{ earnings: 8354.67, withTax: 1911.00 },
{ earnings: 8359.00, withTax: 1911.00 },
{ earnings: 8363.33, withTax: 1911.00 },
{ earnings: 8367.67, withTax: 1915.00 },
{ earnings: 8372.00, withTax: 1915.00 },
{ earnings: 8376.33, withTax: 1915.00 },
{ earnings: 8380.67, withTax: 1920.00 },
{ earnings: 8385.00, withTax: 1920.00 },
{ earnings: 8389.33, withTax: 1920.00 },
{ earnings: 8393.67, withTax: 1924.00 },
{ earnings: 8398.00, withTax: 1924.00 },
{ earnings: 8402.33, withTax: 1924.00 },
{ earnings: 8406.67, withTax: 1928.00 },
{ earnings: 8411.00, withTax: 1928.00 },
{ earnings: 8415.33, withTax: 1928.00 },
{ earnings: 8419.67, withTax: 1928.00 },
{ earnings: 8424.00, withTax: 1933.00 },
{ earnings: 8428.33, withTax: 1933.00 },
{ earnings: 8432.67, withTax: 1933.00 },
{ earnings: 8437.00, withTax: 1937.00 },
{ earnings: 8441.33, withTax: 1937.00 },
{ earnings: 8445.67, withTax: 1937.00 },
{ earnings: 8450.00, withTax: 1941.00 },
{ earnings: 8454.33, withTax: 1941.00 },
{ earnings: 8458.67, withTax: 1941.00 },
{ earnings: 8463.00, withTax: 1946.00 },
{ earnings: 8467.33, withTax: 1946.00 },
{ earnings: 8471.67, withTax: 1946.00 },
{ earnings: 8476.00, withTax: 1950.00 },
{ earnings: 8480.33, withTax: 1950.00 },
{ earnings: 8484.67, withTax: 1950.00 },
{ earnings: 8489.00, withTax: 1954.00 },
{ earnings: 8493.33, withTax: 1954.00 },
{ earnings: 8497.67, withTax: 1954.00 },
{ earnings: 8502.00, withTax: 1959.00 },
{ earnings: 8506.33, withTax: 1959.00 },
{ earnings: 8510.67, withTax: 1959.00 },
{ earnings: 8515.00, withTax: 1963.00 },
{ earnings: 8519.33, withTax: 1963.00 },
{ earnings: 8523.67, withTax: 1963.00 },
{ earnings: 8528.00, withTax: 1963.00 },
{ earnings: 8532.33, withTax: 1967.00 },
{ earnings: 8536.67, withTax: 1967.00 },
{ earnings: 8541.00, withTax: 1967.00 },
{ earnings: 8545.33, withTax: 1972.00 },
{ earnings: 8549.67, withTax: 1972.00 },
{ earnings: 8554.00, withTax: 1972.00 },
{ earnings: 8558.33, withTax: 1976.00 },
{ earnings: 8562.67, withTax: 1976.00 },
{ earnings: 8567.00, withTax: 1976.00 },
{ earnings: 8571.33, withTax: 1980.00 },
{ earnings: 8575.67, withTax: 1980.00 },
{ earnings: 8580.00, withTax: 1980.00 },
{ earnings: 8584.33, withTax: 1985.00 },
{ earnings: 8588.67, withTax: 1985.00 },
{ earnings: 8593.00, withTax: 1985.00 },
{ earnings: 8597.33, withTax: 1989.00 },
{ earnings: 8601.67, withTax: 1989.00 },
{ earnings: 8606.00, withTax: 1989.00 },
{ earnings: 8610.33, withTax: 1993.00 },
{ earnings: 8614.67, withTax: 1993.00 },
{ earnings: 8619.00, withTax: 1993.00 },
{ earnings: 8623.33, withTax: 1998.00 },
{ earnings: 8627.67, withTax: 1998.00 },
{ earnings: 8632.00, withTax: 1998.00 },
{ earnings: 8636.33, withTax: 1998.00 },
{ earnings: 8640.67, withTax: 2002.00 },
{ earnings: 8645.00, withTax: 2002.00 },
{ earnings: 8649.33, withTax: 2002.00 },
{ earnings: 8653.67, withTax: 2006.00 },
{ earnings: 8658.00, withTax: 2006.00 },
{ earnings: 8662.33, withTax: 2006.00 },
{ earnings: 8666.67, withTax: 2011.00 },
{ earnings: 8671.00, withTax: 2011.00 },
{ earnings: 8675.33, withTax: 2011.00 },
{ earnings: 8679.67, withTax: 2015.00 },
{ earnings: 8684.00, withTax: 2015.00 },
{ earnings: 8688.33, withTax: 2015.00 },
{ earnings: 8692.67, withTax: 2019.00 },
{ earnings: 8697.00, withTax: 2019.00 },
{ earnings: 8701.33, withTax: 2019.00 },
{ earnings: 8705.67, withTax: 2024.00 },
{ earnings: 8710.00, withTax: 2024.00 },
{ earnings: 8714.33, withTax: 2024.00 },
{ earnings: 8718.67, withTax: 2028.00 },
{ earnings: 8723.00, withTax: 2028.00 },
{ earnings: 8727.33, withTax: 2028.00 },
{ earnings: 8731.67, withTax: 2032.00 },
{ earnings: 8736.00, withTax: 2032.00 },
{ earnings: 8740.33, withTax: 2032.00 },
{ earnings: 8744.67, withTax: 2032.00 },
{ earnings: 8749.00, withTax: 2037.00 },
{ earnings: 8753.33, withTax: 2037.00 },
{ earnings: 8757.67, withTax: 2037.00 },
{ earnings: 8762.00, withTax: 2041.00 },
{ earnings: 8766.33, withTax: 2041.00 },
{ earnings: 8770.67, withTax: 2041.00 },
{ earnings: 8775.00, withTax: 2045.00 },
{ earnings: 8779.33, withTax: 2045.00 },
{ earnings: 8783.67, withTax: 2045.00 },
{ earnings: 8788.00, withTax: 2050.00 },
{ earnings: 8792.33, withTax: 2050.00 },
{ earnings: 8796.67, withTax: 2050.00 },
{ earnings: 8801.00, withTax: 2054.00 },
{ earnings: 8805.33, withTax: 2054.00 },
{ earnings: 8809.67, withTax: 2054.00 },
{ earnings: 8814.00, withTax: 2058.00 },
{ earnings: 8818.33, withTax: 2058.00 },
{ earnings: 8822.67, withTax: 2058.00 },
{ earnings: 8827.00, withTax: 2063.00 },
{ earnings: 8831.33, withTax: 2063.00 },
{ earnings: 8835.67, withTax: 2063.00 },
{ earnings: 8840.00, withTax: 2067.00 },
{ earnings: 8844.33, withTax: 2067.00 },
{ earnings: 8848.67, withTax: 2067.00 },
{ earnings: 8853.00, withTax: 2067.00 },
{ earnings: 8857.33, withTax: 2071.00 },
{ earnings: 8861.67, withTax: 2071.00 },
{ earnings: 8866.00, withTax: 2071.00 },
{ earnings: 8870.33, withTax: 2076.00 },
{ earnings: 8874.67, withTax: 2076.00 },
{ earnings: 8879.00, withTax: 2076.00 },
{ earnings: 8883.33, withTax: 2080.00 },
{ earnings: 8887.67, withTax: 2080.00 },
{ earnings: 8892.00, withTax: 2080.00 },
{ earnings: 8896.33, withTax: 2084.00 },
{ earnings: 8900.67, withTax: 2084.00 },
{ earnings: 8905.00, withTax: 2084.00 },
{ earnings: 8909.33, withTax: 2089.00 },
{ earnings: 8913.67, withTax: 2089.00 },
{ earnings: 8918.00, withTax: 2089.00 },
{ earnings: 8922.33, withTax: 2093.00 },
{ earnings: 8926.67, withTax: 2093.00 },
{ earnings: 8931.00, withTax: 2093.00 },
{ earnings: 8935.33, withTax: 2097.00 },
{ earnings: 8939.67, withTax: 2097.00 },
{ earnings: 8944.00, withTax: 2097.00 },
{ earnings: 8948.33, withTax: 2102.00 },
{ earnings: 8952.67, withTax: 2102.00 },
{ earnings: 8957.00, withTax: 2102.00 },
{ earnings: 8961.33, withTax: 2102.00 },
{ earnings: 8965.67, withTax: 2106.00 },
{ earnings: 8970.00, withTax: 2106.00 },
{ earnings: 8974.33, withTax: 2106.00 },
{ earnings: 8978.67, withTax: 2110.00 },
{ earnings: 8983.00, withTax: 2110.00 },
{ earnings: 8987.33, withTax: 2110.00 },
{ earnings: 8991.67, withTax: 2115.00 },
{ earnings: 8996.00, withTax: 2115.00 },
{ earnings: 9000.33, withTax: 2115.00 },
{ earnings: 9004.67, withTax: 2119.00 },
{ earnings: 9009.00, withTax: 2119.00 },
{ earnings: 9013.33, withTax: 2119.00 },
{ earnings: 9017.67, withTax: 2123.00 },
{ earnings: 9022.00, withTax: 2123.00 },
{ earnings: 9026.33, withTax: 2123.00 },
{ earnings: 9030.67, withTax: 2128.00 },
{ earnings: 9035.00, withTax: 2128.00 },
{ earnings: 9039.33, withTax: 2128.00 },
{ earnings: 9043.67, withTax: 2132.00 },
{ earnings: 9048.00, withTax: 2132.00 },
{ earnings: 9052.33, withTax: 2132.00 },
{ earnings: 9056.67, withTax: 2136.00 },
{ earnings: 9061.00, withTax: 2136.00 },
{ earnings: 9065.33, withTax: 2136.00 },
{ earnings: 9069.67, withTax: 2136.00 },
{ earnings: 9074.00, withTax: 2141.00 },
{ earnings: 9078.33, withTax: 2141.00 },
{ earnings: 9082.67, withTax: 2141.00 },
{ earnings: 9087.00, withTax: 2145.00 },
{ earnings: 9091.33, withTax: 2145.00 },
{ earnings: 9095.67, withTax: 2145.00 },
{ earnings: 9100.00, withTax: 2149.00 },
{ earnings: 9104.33, withTax: 2149.00 },
{ earnings: 9108.67, withTax: 2149.00 },
{ earnings: 9113.00, withTax: 2154.00 },
{ earnings: 9117.33, withTax: 2154.00 },
{ earnings: 9121.67, withTax: 2154.00 },
{ earnings: 9126.00, withTax: 2158.00 },
{ earnings: 9130.33, withTax: 2158.00 },
{ earnings: 9134.67, withTax: 2158.00 },
{ earnings: 9139.00, withTax: 2162.00 },
{ earnings: 9143.33, withTax: 2162.00 },
{ earnings: 9147.67, withTax: 2162.00 },
{ earnings: 9152.00, withTax: 2167.00 },
{ earnings: 9156.33, withTax: 2167.00 },
{ earnings: 9160.67, withTax: 2167.00 },
{ earnings: 9165.00, withTax: 2171.00 },
{ earnings: 9169.33, withTax: 2171.00 },
{ earnings: 9173.67, withTax: 2171.00 },
{ earnings: 9178.00, withTax: 2171.00 },
{ earnings: 9182.33, withTax: 2175.00 },
{ earnings: 9186.67, withTax: 2175.00 },
{ earnings: 9191.00, withTax: 2175.00 },
{ earnings: 9195.33, withTax: 2180.00 },
{ earnings: 9199.67, withTax: 2180.00 },
{ earnings: 9204.00, withTax: 2180.00 },
{ earnings: 9208.33, withTax: 2184.00 },
{ earnings: 9212.67, withTax: 2184.00 },
{ earnings: 9217.00, withTax: 2184.00 },
{ earnings: 9221.33, withTax: 2188.00 },
{ earnings: 9225.67, withTax: 2188.00 },
{ earnings: 9230.00, withTax: 2188.00 },
{ earnings: 9234.33, withTax: 2193.00 },
{ earnings: 9238.67, withTax: 2193.00 },
{ earnings: 9243.00, withTax: 2193.00 },
{ earnings: 9247.33, withTax: 2197.00 },
{ earnings: 9251.67, withTax: 2197.00 },
{ earnings: 9256.00, withTax: 2197.00 },
{ earnings: 9260.33, withTax: 2201.00 },
{ earnings: 9264.67, withTax: 2201.00 },
{ earnings: 9269.00, withTax: 2201.00 },
{ earnings: 9273.33, withTax: 2206.00 },
{ earnings: 9277.67, withTax: 2206.00 },
{ earnings: 9282.00, withTax: 2206.00 },
{ earnings: 9286.33, withTax: 2206.00 },
{ earnings: 9290.67, withTax: 2210.00 },
{ earnings: 9295.00, withTax: 2210.00 },
{ earnings: 9299.33, withTax: 2210.00 },
{ earnings: 9303.67, withTax: 2214.00 },
{ earnings: 9308.00, withTax: 2214.00 },
{ earnings: 9312.33, withTax: 2214.00 },
{ earnings: 9316.67, withTax: 2219.00 },
{ earnings: 9321.00, withTax: 2219.00 },
{ earnings: 9325.33, withTax: 2219.00 },
{ earnings: 9329.67, withTax: 2223.00 },
{ earnings: 9334.00, withTax: 2223.00 },
{ earnings: 9338.33, withTax: 2223.00 },
{ earnings: 9342.67, withTax: 2227.00 },
{ earnings: 9347.00, withTax: 2227.00 },
{ earnings: 9351.33, withTax: 2227.00 },
{ earnings: 9355.67, withTax: 2232.00 },
{ earnings: 9360.00, withTax: 2232.00 },
{ earnings: 9364.33, withTax: 2232.00 },
{ earnings: 9368.67, withTax: 2236.00 },
{ earnings: 9373.00, withTax: 2236.00 },
{ earnings: 9377.33, withTax: 2236.00 },
{ earnings: 9381.67, withTax: 2240.00 },
{ earnings: 9386.00, withTax: 2240.00 },
{ earnings: 9390.33, withTax: 2240.00 },
{ earnings: 9394.67, withTax: 2240.00 },
{ earnings: 9399.00, withTax: 2245.00 },
{ earnings: 9403.33, withTax: 2245.00 },
{ earnings: 9407.67, withTax: 2245.00 },
{ earnings: 9412.00, withTax: 2249.00 },
{ earnings: 9416.33, withTax: 2249.00 },
{ earnings: 9420.67, withTax: 2249.00 },
{ earnings: 9425.00, withTax: 2253.00 },
{ earnings: 9429.33, withTax: 2253.00 },
{ earnings: 9433.67, withTax: 2253.00 },
{ earnings: 9438.00, withTax: 2258.00 },
{ earnings: 9442.33, withTax: 2258.00 },
{ earnings: 9446.67, withTax: 2258.00 },
{ earnings: 9451.00, withTax: 2262.00 },
{ earnings: 9455.33, withTax: 2262.00 },
{ earnings: 9459.67, withTax: 2262.00 },
{ earnings: 9464.00, withTax: 2266.00 },
{ earnings: 9468.33, withTax: 2266.00 },
{ earnings: 9472.67, withTax: 2266.00 },
{ earnings: 9477.00, withTax: 2271.00 },
{ earnings: 9481.33, withTax: 2271.00 },
{ earnings: 9485.67, withTax: 2271.00 },
{ earnings: 9490.00, withTax: 2275.00 },
{ earnings: 9494.33, withTax: 2275.00 },
{ earnings: 9498.67, withTax: 2275.00 },
{ earnings: 9503.00, withTax: 2275.00 },
{ earnings: 9507.33, withTax: 2279.00 },
{ earnings: 9511.67, withTax: 2279.00 },
{ earnings: 9516.00, withTax: 2279.00 },
{ earnings: 9520.33, withTax: 2284.00 },
{ earnings: 9524.67, withTax: 2284.00 },
{ earnings: 9529.00, withTax: 2284.00 },
{ earnings: 9533.33, withTax: 2288.00 },
{ earnings: 9537.67, withTax: 2288.00 },
{ earnings: 9542.00, withTax: 2288.00 },
{ earnings: 9546.33, withTax: 2292.00 },
{ earnings: 9550.67, withTax: 2292.00 },
{ earnings: 9555.00, withTax: 2292.00 },
{ earnings: 9559.33, withTax: 2297.00 },
{ earnings: 9563.67, withTax: 2297.00 },
{ earnings: 9568.00, withTax: 2297.00 },
{ earnings: 9572.33, withTax: 2301.00 },
{ earnings: 9576.67, withTax: 2301.00 },
{ earnings: 9581.00, withTax: 2301.00 },
{ earnings: 9585.33, withTax: 2305.00 },
{ earnings: 9589.67, withTax: 2305.00 },
{ earnings: 9594.00, withTax: 2305.00 },
{ earnings: 9598.33, withTax: 2310.00 },
{ earnings: 9602.67, withTax: 2310.00 },
{ earnings: 9607.00, withTax: 2310.00 },
{ earnings: 9611.33, withTax: 2310.00 },
{ earnings: 9615.67, withTax: 2314.00 },
{ earnings: 9620.00, withTax: 2314.00 },
{ earnings: 9624.33, withTax: 2314.00 },
{ earnings: 9628.67, withTax: 2318.00 },
{ earnings: 9633.00, withTax: 2318.00 },
{ earnings: 9637.33, withTax: 2318.00 },
{ earnings: 9641.67, withTax: 2323.00 },
{ earnings: 9646.00, withTax: 2323.00 },
{ earnings: 9650.33, withTax: 2323.00 },
{ earnings: 9654.67, withTax: 2327.00 },
{ earnings: 9659.00, withTax: 2327.00 },
{ earnings: 9663.33, withTax: 2327.00 },
{ earnings: 9667.67, withTax: 2331.00 },
{ earnings: 9672.00, withTax: 2331.00 },
{ earnings: 9676.33, withTax: 2331.00 },
{ earnings: 9680.67, withTax: 2336.00 },
{ earnings: 9685.00, withTax: 2336.00 },
{ earnings: 9689.33, withTax: 2336.00 },
{ earnings: 9693.67, withTax: 2340.00 },
{ earnings: 9698.00, withTax: 2340.00 },
{ earnings: 9702.33, withTax: 2340.00 },
{ earnings: 9706.67, withTax: 2344.00 },
{ earnings: 9711.00, withTax: 2344.00 },
{ earnings: 9715.33, withTax: 2344.00 },
{ earnings: 9719.67, withTax: 2344.00 },
{ earnings: 9724.00, withTax: 2349.00 },
{ earnings: 9728.33, withTax: 2349.00 },
{ earnings: 9732.67, withTax: 2349.00 },
{ earnings: 9737.00, withTax: 2353.00 },
{ earnings: 9741.33, withTax: 2353.00 },
{ earnings: 9745.67, withTax: 2353.00 },
{ earnings: 9750.00, withTax: 2357.00 },
{ earnings: 9754.33, withTax: 2357.00 },
{ earnings: 9758.67, withTax: 2357.00 },
{ earnings: 9763.00, withTax: 2362.00 },
{ earnings: 9767.33, withTax: 2362.00 },
{ earnings: 9771.67, withTax: 2362.00 },
{ earnings: 9776.00, withTax: 2366.00 },
{ earnings: 9780.33, withTax: 2366.00 },
{ earnings: 9784.67, withTax: 2366.00 },
{ earnings: 9789.00, withTax: 2370.00 },
{ earnings: 9793.33, withTax: 2370.00 },
{ earnings: 9797.67, withTax: 2370.00 },
{ earnings: 9802.00, withTax: 2375.00 },
{ earnings: 9806.33, withTax: 2375.00 },
{ earnings: 9810.67, withTax: 2375.00 },
{ earnings: 9815.00, withTax: 2379.00 },
{ earnings: 9819.33, withTax: 2379.00 },
{ earnings: 9823.67, withTax: 2379.00 },
{ earnings: 9828.00, withTax: 2379.00 },
{ earnings: 9832.33, withTax: 2383.00 },
{ earnings: 9836.67, withTax: 2383.00 },
{ earnings: 9841.00, withTax: 2383.00 },
{ earnings: 9845.33, withTax: 2388.00 },
{ earnings: 9849.67, withTax: 2388.00 },
{ earnings: 9854.00, withTax: 2388.00 },
{ earnings: 9858.33, withTax: 2392.00 },
{ earnings: 9862.67, withTax: 2392.00 },
{ earnings: 9867.00, withTax: 2392.00 },
{ earnings: 9871.33, withTax: 2396.00 },
{ earnings: 9875.67, withTax: 2396.00 },
{ earnings: 9880.00, withTax: 2396.00 },
{ earnings: 9884.33, withTax: 2401.00 },
{ earnings: 9888.67, withTax: 2401.00 },
{ earnings: 9893.00, withTax: 2401.00 },
{ earnings: 9897.33, withTax: 2405.00 },
{ earnings: 9901.67, withTax: 2405.00 },
{ earnings: 9906.00, withTax: 2405.00 },
{ earnings: 9910.33, withTax: 2409.00 },
{ earnings: 9914.67, withTax: 2409.00 },
{ earnings: 9919.00, withTax: 2409.00 },
{ earnings: 9923.33, withTax: 2414.00 },
{ earnings: 9927.67, withTax: 2414.00 },
{ earnings: 9932.00, withTax: 2414.00 },
{ earnings: 9936.33, withTax: 2414.00 },
{ earnings: 9940.67, withTax: 2418.00 },
{ earnings: 9945.00, withTax: 2418.00 },
{ earnings: 9949.33, withTax: 2418.00 },
{ earnings: 9953.67, withTax: 2422.00 },
{ earnings: 9958.00, withTax: 2422.00 },
{ earnings: 9962.33, withTax: 2422.00 },
{ earnings: 9966.67, withTax: 2427.00 },
{ earnings: 9971.00, withTax: 2427.00 },
{ earnings: 9975.33, withTax: 2427.00 },
{ earnings: 9979.67, withTax: 2431.00 },
{ earnings: 9984.00, withTax: 2431.00 },
{ earnings: 9988.33, withTax: 2431.00 },
{ earnings: 9992.67, withTax: 2435.00 },
{ earnings: 9997.00, withTax: 2435.00 },
{ earnings: 1781.00, withTax: 35.00 },
{ earnings: 1785.33, withTax: 35.00 },
{ earnings: 1789.67, withTax: 35.00 },
{ earnings: 1794.00, withTax: 39.00 },
{ earnings: 1798.33, withTax: 39.00 },
{ earnings: 1802.67, withTax: 39.00 },
{ earnings: 1807.00, withTax: 39.00 },
{ earnings: 1811.33, withTax: 39.00 },
{ earnings: 1815.67, withTax: 39.00 },
{ earnings: 1820.00, withTax: 43.00 },
{ earnings: 1824.33, withTax: 43.00 },
{ earnings: 1828.67, withTax: 43.00 },
{ earnings: 1833.00, withTax: 43.00 },
{ earnings: 1837.33, withTax: 43.00 },
{ earnings: 1841.67, withTax: 43.00 },
{ earnings: 1846.00, withTax: 43.00 },
{ earnings: 1850.33, withTax: 48.00 },
{ earnings: 1854.67, withTax: 48.00 },
{ earnings: 1859.00, withTax: 48.00 },
{ earnings: 1863.33, withTax: 48.00 },
{ earnings: 1867.67, withTax: 48.00 },
{ earnings: 1872.00, withTax: 48.00 },
{ earnings: 1876.33, withTax: 52.00 },
{ earnings: 1880.67, withTax: 52.00 },
{ earnings: 1885.00, withTax: 52.00 },
{ earnings: 1889.33, withTax: 52.00 },
{ earnings: 1893.67, withTax: 52.00 },
{ earnings: 1898.00, withTax: 52.00 },
{ earnings: 1902.33, withTax: 56.00 },
{ earnings: 1906.67, withTax: 56.00 },
{ earnings: 1911.00, withTax: 56.00 },
{ earnings: 1915.33, withTax: 56.00 },
{ earnings: 1919.67, withTax: 56.00 },
{ earnings: 1924.00, withTax: 56.00 },
{ earnings: 1928.33, withTax: 61.00 },
{ earnings: 1932.67, withTax: 61.00 },
{ earnings: 1937.00, withTax: 61.00 },
{ earnings: 1941.33, withTax: 61.00 },
{ earnings: 1945.67, withTax: 61.00 },
{ earnings: 1950.00, withTax: 61.00 },
{ earnings: 1954.33, withTax: 61.00 },
{ earnings: 1958.67, withTax: 65.00 },
{ earnings: 1963.00, withTax: 65.00 },
{ earnings: 1967.33, withTax: 65.00 },
{ earnings: 1971.67, withTax: 65.00 },
{ earnings: 1976.00, withTax: 65.00 },
{ earnings: 1980.33, withTax: 65.00 },
{ earnings: 1984.67, withTax: 69.00 },
{ earnings: 1989.00, withTax: 69.00 },
{ earnings: 1993.33, withTax: 69.00 },
{ earnings: 1997.67, withTax: 69.00 },
{ earnings: 2002.00, withTax: 69.00 },
{ earnings: 2006.33, withTax: 69.00 },
{ earnings: 2010.67, withTax: 74.00 },
{ earnings: 2015.00, withTax: 74.00 },
{ earnings: 2019.33, withTax: 74.00 },
{ earnings: 2023.67, withTax: 74.00 },
{ earnings: 2028.00, withTax: 74.00 },
{ earnings: 2032.33, withTax: 74.00 },
{ earnings: 2036.67, withTax: 78.00 },
{ earnings: 2041.00, withTax: 78.00 },
{ earnings: 2045.33, withTax: 78.00 },
{ earnings: 2049.67, withTax: 78.00 },
{ earnings: 2054.00, withTax: 78.00 },
{ earnings: 2058.33, withTax: 78.00 },
{ earnings: 2062.67, withTax: 78.00 },
{ earnings: 2067.00, withTax: 82.00 },
{ earnings: 2071.33, withTax: 82.00 },
{ earnings: 2075.67, withTax: 82.00 },
{ earnings: 2080.00, withTax: 82.00 },
{ earnings: 2084.33, withTax: 82.00 },
{ earnings: 10005.67, withTax: 2440.00 },
{ earnings: 10010.00, withTax: 2440.00 },
{ earnings: 10014.33, withTax: 2440.00 },
{ earnings: 10018.67, withTax: 2444.00 },
{ earnings: 10023.00, withTax: 2444.00 },
{ earnings: 10027.33, withTax: 2444.00 },
{ earnings: 10031.67, withTax: 2448.00 },
{ earnings: 10036.00, withTax: 2448.00 },
{ earnings: 10040.33, withTax: 2448.00 },
{ earnings: 10044.67, withTax: 2448.00 },
{ earnings: 10049.00, withTax: 2453.00 },
{ earnings: 10053.33, withTax: 2453.00 },
{ earnings: 10057.67, withTax: 2453.00 },
{ earnings: 10062.00, withTax: 2457.00 },
{ earnings: 10066.33, withTax: 2457.00 },
{ earnings: 10070.67, withTax: 2457.00 },
{ earnings: 10075.00, withTax: 2461.00 },
{ earnings: 10079.33, withTax: 2461.00 },
{ earnings: 10083.67, withTax: 2461.00 },
{ earnings: 10088.00, withTax: 2466.00 },
{ earnings: 10092.33, withTax: 2466.00 },
{ earnings: 10096.67, withTax: 2466.00 },
{ earnings: 10101.00, withTax: 2470.00 },
{ earnings: 10105.33, withTax: 2470.00 },
{ earnings: 10109.67, withTax: 2470.00 },
{ earnings: 10114.00, withTax: 2474.00 },
{ earnings: 10118.33, withTax: 2474.00 },
{ earnings: 10122.67, withTax: 2474.00 },
{ earnings: 10127.00, withTax: 2479.00 },
{ earnings: 10131.33, withTax: 2479.00 },
{ earnings: 10135.67, withTax: 2479.00 },
{ earnings: 10140.00, withTax: 2483.00 },
{ earnings: 10144.33, withTax: 2483.00 },
{ earnings: 10148.67, withTax: 2483.00 },
{ earnings: 10153.00, withTax: 2483.00 },
{ earnings: 10157.33, withTax: 2487.00 },
{ earnings: 10161.67, withTax: 2487.00 },
{ earnings: 10166.00, withTax: 2487.00 },
{ earnings: 10170.33, withTax: 2492.00 },
{ earnings: 10174.67, withTax: 2492.00 },
{ earnings: 10179.00, withTax: 2492.00 },
{ earnings: 10183.33, withTax: 2496.00 },
{ earnings: 10187.67, withTax: 2496.00 },
{ earnings: 10192.00, withTax: 2496.00 },
{ earnings: 10196.33, withTax: 2500.00 },
{ earnings: 10200.67, withTax: 2500.00 },
{ earnings: 10205.00, withTax: 2500.00 },
{ earnings: 10209.33, withTax: 2505.00 },
{ earnings: 10213.67, withTax: 2505.00 },
{ earnings: 10218.00, withTax: 2505.00 },
{ earnings: 10222.33, withTax: 2509.00 },
{ earnings: 10226.67, withTax: 2509.00 },
{ earnings: 10231.00, withTax: 2509.00 },
{ earnings: 10235.33, withTax: 2513.00 },
{ earnings: 10239.67, withTax: 2513.00 },
{ earnings: 10244.00, withTax: 2513.00 },
{ earnings: 10248.33, withTax: 2518.00 },
{ earnings: 10252.67, withTax: 2518.00 },
{ earnings: 10257.00, withTax: 2518.00 },
{ earnings: 10261.33, withTax: 2518.00 },
{ earnings: 10265.67, withTax: 2522.00 },
{ earnings: 10270.00, withTax: 2522.00 },
{ earnings: 10274.33, withTax: 2522.00 },
{ earnings: 10278.67, withTax: 2526.00 },
{ earnings: 10283.00, withTax: 2526.00 },
{ earnings: 10287.33, withTax: 2526.00 },
{ earnings: 10291.67, withTax: 2531.00 },
{ earnings: 10296.00, withTax: 2531.00 },
{ earnings: 10300.33, withTax: 2531.00 },
{ earnings: 10304.67, withTax: 2535.00 },
{ earnings: 10309.00, withTax: 2535.00 },
{ earnings: 10313.33, withTax: 2535.00 },
{ earnings: 10317.67, withTax: 2539.00 },
{ earnings: 10322.00, withTax: 2539.00 },
{ earnings: 10326.33, withTax: 2539.00 },
{ earnings: 10330.67, withTax: 2544.00 },
{ earnings: 10335.00, withTax: 2544.00 },
{ earnings: 10339.33, withTax: 2544.00 },
{ earnings: 10343.67, withTax: 2548.00 },
{ earnings: 10348.00, withTax: 2548.00 },
{ earnings: 10352.33, withTax: 2548.00 },
{ earnings: 10356.67, withTax: 2552.00 },
{ earnings: 10361.00, withTax: 2552.00 },
{ earnings: 10365.33, withTax: 2552.00 },
{ earnings: 10369.67, withTax: 2552.00 },
{ earnings: 10374.00, withTax: 2557.00 },
{ earnings: 10378.33, withTax: 2557.00 },
{ earnings: 10382.67, withTax: 2557.00 },
{ earnings: 10387.00, withTax: 2561.00 },
{ earnings: 10391.33, withTax: 2561.00 },
{ earnings: 10395.67, withTax: 2561.00 },
{ earnings: 10400.00, withTax: 2565.00 },
{ earnings: 10404.33, withTax: 2565.00 },
{ earnings: 10408.67, withTax: 2565.00 },
{ earnings: 10413.00, withTax: 2570.00 },
{ earnings: 10417.33, withTax: 2570.00 },
{ earnings: 10421.67, withTax: 2570.00 },
{ earnings: 10426.00, withTax: 2574.00 },
{ earnings: 10430.33, withTax: 2574.00 },
{ earnings: 10434.67, withTax: 2574.00 },
{ earnings: 10439.00, withTax: 2578.00 },
{ earnings: 10443.33, withTax: 2578.00 },
{ earnings: 10447.67, withTax: 2578.00 },
{ earnings: 10452.00, withTax: 2583.00 },
{ earnings: 10456.33, withTax: 2583.00 },
{ earnings: 10460.67, withTax: 2583.00 },
{ earnings: 10465.00, withTax: 2587.00 },
{ earnings: 10469.33, withTax: 2587.00 },
{ earnings: 10473.67, withTax: 2587.00 },
{ earnings: 10478.00, withTax: 2587.00 },
{ earnings: 10482.33, withTax: 2591.00 },
{ earnings: 10486.67, withTax: 2591.00 },
{ earnings: 10491.00, withTax: 2591.00 },
{ earnings: 10495.33, withTax: 2596.00 },
{ earnings: 10499.67, withTax: 2596.00 },
{ earnings: 10504.00, withTax: 2596.00 },
{ earnings: 10508.33, withTax: 2600.00 },
{ earnings: 10512.67, withTax: 2600.00 },
{ earnings: 10517.00, withTax: 2600.00 },
{ earnings: 10521.33, withTax: 2604.00 },
{ earnings: 10525.67, withTax: 2604.00 },
{ earnings: 10530.00, withTax: 2604.00 },
{ earnings: 10534.33, withTax: 2609.00 },
{ earnings: 10538.67, withTax: 2609.00 },
{ earnings: 10543.00, withTax: 2609.00 },
{ earnings: 10547.33, withTax: 2613.00 },
{ earnings: 10551.67, withTax: 2613.00 },
{ earnings: 10556.00, withTax: 2613.00 },
{ earnings: 10560.33, withTax: 2617.00 },
{ earnings: 10564.67, withTax: 2617.00 },
{ earnings: 10569.00, withTax: 2617.00 },
{ earnings: 10573.33, withTax: 2622.00 },
{ earnings: 10577.67, withTax: 2622.00 },
{ earnings: 10582.00, withTax: 2622.00 },
{ earnings: 10586.33, withTax: 2622.00 },
{ earnings: 10590.67, withTax: 2626.00 },
{ earnings: 10595.00, withTax: 2626.00 },
{ earnings: 10599.33, withTax: 2626.00 },
{ earnings: 10603.67, withTax: 2630.00 },
{ earnings: 10608.00, withTax: 2630.00 },
{ earnings: 10612.33, withTax: 2630.00 },
{ earnings: 10616.67, withTax: 2635.00 },
{ earnings: 10621.00, withTax: 2635.00 },
{ earnings: 10625.33, withTax: 2635.00 },
{ earnings: 10629.67, withTax: 2639.00 },
{ earnings: 10634.00, withTax: 2639.00 },
{ earnings: 10638.33, withTax: 2639.00 },
{ earnings: 10642.67, withTax: 2643.00 },
{ earnings: 10647.00, withTax: 2643.00 },
{ earnings: 10651.33, withTax: 2643.00 },
{ earnings: 10655.67, withTax: 2648.00 },
{ earnings: 10660.00, withTax: 2648.00 },
{ earnings: 10664.33, withTax: 2648.00 },
{ earnings: 10668.67, withTax: 2652.00 },
{ earnings: 10673.00, withTax: 2652.00 },
{ earnings: 10677.33, withTax: 2652.00 },
{ earnings: 10681.67, withTax: 2656.00 },
{ earnings: 10686.00, withTax: 2656.00 },
{ earnings: 10690.33, withTax: 2656.00 },
{ earnings: 10694.67, withTax: 2656.00 },
{ earnings: 10699.00, withTax: 2661.00 },
{ earnings: 10703.33, withTax: 2661.00 },
{ earnings: 10707.67, withTax: 2661.00 },
{ earnings: 10712.00, withTax: 2665.00 },
{ earnings: 10716.33, withTax: 2665.00 },
{ earnings: 10720.67, withTax: 2665.00 },
{ earnings: 10725.00, withTax: 2669.00 },
{ earnings: 10729.33, withTax: 2669.00 },
{ earnings: 10733.67, withTax: 2669.00 },
{ earnings: 10738.00, withTax: 2674.00 },
{ earnings: 10742.33, withTax: 2674.00 },
{ earnings: 10746.67, withTax: 2674.00 },
{ earnings: 10751.00, withTax: 2678.00 },
{ earnings: 10755.33, withTax: 2678.00 },
{ earnings: 10759.67, withTax: 2678.00 },
{ earnings: 10764.00, withTax: 2682.00 },
{ earnings: 10768.33, withTax: 2682.00 },
{ earnings: 10772.67, withTax: 2682.00 },
{ earnings: 10777.00, withTax: 2687.00 },
{ earnings: 10781.33, withTax: 2687.00 },
{ earnings: 10785.67, withTax: 2687.00 },
{ earnings: 10790.00, withTax: 2691.00 },
{ earnings: 10794.33, withTax: 2691.00 },
{ earnings: 10798.67, withTax: 2691.00 },
{ earnings: 10803.00, withTax: 2691.00 },
{ earnings: 10807.33, withTax: 2695.00 },
{ earnings: 10811.67, withTax: 2695.00 },
{ earnings: 10816.00, withTax: 2695.00 },
{ earnings: 10820.33, withTax: 2700.00 },
{ earnings: 10824.67, withTax: 2700.00 },
{ earnings: 10829.00, withTax: 2700.00 },
{ earnings: 10833.33, withTax: 2704.00 },
{ earnings: 10837.67, withTax: 2704.00 },
{ earnings: 10842.00, withTax: 2704.00 },
{ earnings: 10846.33, withTax: 2708.00 },
{ earnings: 10850.67, withTax: 2708.00 },
{ earnings: 10855.00, withTax: 2708.00 },
{ earnings: 10859.33, withTax: 2713.00 },
{ earnings: 10863.67, withTax: 2713.00 },
{ earnings: 10868.00, withTax: 2713.00 },
{ earnings: 10872.33, withTax: 2717.00 },
{ earnings: 10876.67, withTax: 2717.00 },
{ earnings: 10881.00, withTax: 2717.00 },
{ earnings: 10885.33, withTax: 2721.00 },
{ earnings: 10889.67, withTax: 2721.00 },
{ earnings: 10894.00, withTax: 2721.00 },
{ earnings: 10898.33, withTax: 2726.00 },
{ earnings: 10902.67, withTax: 2726.00 },
{ earnings: 10907.00, withTax: 2726.00 },
{ earnings: 10911.33, withTax: 2726.00 },
{ earnings: 10915.67, withTax: 2730.00 },
{ earnings: 10920.00, withTax: 2730.00 },
{ earnings: 10924.33, withTax: 2730.00 },
{ earnings: 10928.67, withTax: 2734.00 },
{ earnings: 10933.00, withTax: 2734.00 },
{ earnings: 10937.33, withTax: 2734.00 },
{ earnings: 10941.67, withTax: 2739.00 },
{ earnings: 10946.00, withTax: 2739.00 },
{ earnings: 10950.33, withTax: 2739.00 },
{ earnings: 10954.67, withTax: 2743.00 },
{ earnings: 10959.00, withTax: 2743.00 },
{ earnings: 10963.33, withTax: 2743.00 },
{ earnings: 10967.67, withTax: 2747.00 },
{ earnings: 10972.00, withTax: 2747.00 },
{ earnings: 10976.33, withTax: 2747.00 },
{ earnings: 10980.67, withTax: 2752.00 },
{ earnings: 10985.00, withTax: 2752.00 },
{ earnings: 10989.33, withTax: 2752.00 },
{ earnings: 10993.67, withTax: 2756.00 },
{ earnings: 10998.00, withTax: 2756.00 },
{ earnings: 11002.33, withTax: 2756.00 },
{ earnings: 11006.67, withTax: 2760.00 },
{ earnings: 11011.00, withTax: 2760.00 },
{ earnings: 11015.33, withTax: 2760.00 },
{ earnings: 11019.67, withTax: 2760.00 },
{ earnings: 11024.00, withTax: 2765.00 },
{ earnings: 11028.33, withTax: 2765.00 },
{ earnings: 11032.67, withTax: 2765.00 },
{ earnings: 11037.00, withTax: 2769.00 },
{ earnings: 11041.33, withTax: 2769.00 },
{ earnings: 11045.67, withTax: 2769.00 },
{ earnings: 11050.00, withTax: 2773.00 },
{ earnings: 11054.33, withTax: 2773.00 },
{ earnings: 11058.67, withTax: 2773.00 },
{ earnings: 11063.00, withTax: 2778.00 },
{ earnings: 11067.33, withTax: 2778.00 },
{ earnings: 11071.67, withTax: 2778.00 },
{ earnings: 11076.00, withTax: 2782.00 },
{ earnings: 11080.33, withTax: 2782.00 },
{ earnings: 11084.67, withTax: 2782.00 },
{ earnings: 11089.00, withTax: 2786.00 },
{ earnings: 11093.33, withTax: 2786.00 },
{ earnings: 11097.67, withTax: 2786.00 },
{ earnings: 11102.00, withTax: 2791.00 },
{ earnings: 11106.33, withTax: 2791.00 },
{ earnings: 11110.67, withTax: 2791.00 },
{ earnings: 11115.00, withTax: 2795.00 },
{ earnings: 11119.33, withTax: 2795.00 },
{ earnings: 11123.67, withTax: 2795.00 },
{ earnings: 11128.00, withTax: 2795.00 },
{ earnings: 11132.33, withTax: 2799.00 },
{ earnings: 11136.67, withTax: 2799.00 },
{ earnings: 11141.00, withTax: 2799.00 },
{ earnings: 11145.33, withTax: 2804.00 },
{ earnings: 11149.67, withTax: 2804.00 },
{ earnings: 11154.00, withTax: 2804.00 },
{ earnings: 11158.33, withTax: 2808.00 },
{ earnings: 11162.67, withTax: 2808.00 },
{ earnings: 11167.00, withTax: 2808.00 },
{ earnings: 11171.33, withTax: 2812.00 },
{ earnings: 11175.67, withTax: 2812.00 },
{ earnings: 11180.00, withTax: 2812.00 },
{ earnings: 11184.33, withTax: 2817.00 },
{ earnings: 11188.67, withTax: 2817.00 },
{ earnings: 11193.00, withTax: 2817.00 },
{ earnings: 11197.33, withTax: 2821.00 },
{ earnings: 11201.67, withTax: 2821.00 },
{ earnings: 11206.00, withTax: 2821.00 },
{ earnings: 11210.33, withTax: 2825.00 },
{ earnings: 11214.67, withTax: 2825.00 },
{ earnings: 11219.00, withTax: 2825.00 },
{ earnings: 11223.33, withTax: 2830.00 },
{ earnings: 11227.67, withTax: 2830.00 },
{ earnings: 11232.00, withTax: 2830.00 },
{ earnings: 11236.33, withTax: 2830.00 },
{ earnings: 11240.67, withTax: 2834.00 },
{ earnings: 11245.00, withTax: 2834.00 },
{ earnings: 11249.33, withTax: 2834.00 },
{ earnings: 11253.67, withTax: 2838.00 },
{ earnings: 11258.00, withTax: 2838.00 },
{ earnings: 11262.33, withTax: 2838.00 },
{ earnings: 11266.67, withTax: 2843.00 },
{ earnings: 11271.00, withTax: 2843.00 },
{ earnings: 11275.33, withTax: 2843.00 },
{ earnings: 11279.67, withTax: 2847.00 },
{ earnings: 11284.00, withTax: 2847.00 },
{ earnings: 11288.33, withTax: 2851.00 },
{ earnings: 11292.67, withTax: 2851.00 },
{ earnings: 11297.00, withTax: 2851.00 },
{ earnings: 11301.33, withTax: 2856.00 },
{ earnings: 11305.67, withTax: 2856.00 },
{ earnings: 11310.00, withTax: 2860.00 },
{ earnings: 11314.33, withTax: 2860.00 },
{ earnings: 11318.67, withTax: 2860.00 },
{ earnings: 11323.00, withTax: 2864.00 },
{ earnings: 11327.33, withTax: 2864.00 },
{ earnings: 11331.67, withTax: 2869.00 },
{ earnings: 11336.00, withTax: 2869.00 },
{ earnings: 11340.33, withTax: 2869.00 },
{ earnings: 11344.67, withTax: 2873.00 },
{ earnings: 11349.00, withTax: 2873.00 },
{ earnings: 11353.33, withTax: 2873.00 },
{ earnings: 11357.67, withTax: 2877.00 },
{ earnings: 11362.00, withTax: 2877.00 },
{ earnings: 11366.33, withTax: 2882.00 },
{ earnings: 11370.67, withTax: 2882.00 },
{ earnings: 11375.00, withTax: 2882.00 },
{ earnings: 11379.33, withTax: 2886.00 },
{ earnings: 11383.67, withTax: 2886.00 },
{ earnings: 11388.00, withTax: 2890.00 },
{ earnings: 11392.33, withTax: 2890.00 },
{ earnings: 11396.67, withTax: 2890.00 },
{ earnings: 11401.00, withTax: 2895.00 },
{ earnings: 11405.33, withTax: 2895.00 },
{ earnings: 11409.67, withTax: 2899.00 },
{ earnings: 11414.00, withTax: 2899.00 },
{ earnings: 11418.33, withTax: 2899.00 },
{ earnings: 11422.67, withTax: 2903.00 },
{ earnings: 11427.00, withTax: 2903.00 },
{ earnings: 11431.33, withTax: 2908.00 },
{ earnings: 11435.67, withTax: 2908.00 },
{ earnings: 11440.00, withTax: 2908.00 },
{ earnings: 11444.33, withTax: 2912.00 },
{ earnings: 11448.67, withTax: 2912.00 },
{ earnings: 11453.00, withTax: 2912.00 },
{ earnings: 11457.33, withTax: 2916.00 },
{ earnings: 11461.67, withTax: 2916.00 },
{ earnings: 11466.00, withTax: 2921.00 },
{ earnings: 11470.33, withTax: 2921.00 },
{ earnings: 11474.67, withTax: 2921.00 },
{ earnings: 11479.00, withTax: 2925.00 },
{ earnings: 11483.33, withTax: 2925.00 },
{ earnings: 11487.67, withTax: 2929.00 },
{ earnings: 11492.00, withTax: 2929.00 },
{ earnings: 11496.33, withTax: 2929.00 },
{ earnings: 11500.67, withTax: 2934.00 },
{ earnings: 11505.00, withTax: 2934.00 },
{ earnings: 11509.33, withTax: 2938.00 },
{ earnings: 11513.67, withTax: 2938.00 },
{ earnings: 11518.00, withTax: 2938.00 },
{ earnings: 11522.33, withTax: 2942.00 },
{ earnings: 11526.67, withTax: 2942.00 },
{ earnings: 11531.00, withTax: 2942.00 },
{ earnings: 11535.33, withTax: 2947.00 },
{ earnings: 11539.67, withTax: 2947.00 },
{ earnings: 11544.00, withTax: 2951.00 },
{ earnings: 11548.33, withTax: 2951.00 },
{ earnings: 11552.67, withTax: 2951.00 },
{ earnings: 11557.00, withTax: 2955.00 },
{ earnings: 11561.33, withTax: 2955.00 },
{ earnings: 11565.67, withTax: 2960.00 },
{ earnings: 11570.00, withTax: 2960.00 },
{ earnings: 11574.33, withTax: 2960.00 },
{ earnings: 11578.67, withTax: 2964.00 },
{ earnings: 11583.00, withTax: 2964.00 },
{ earnings: 11587.33, withTax: 2968.00 },
{ earnings: 11591.67, withTax: 2968.00 },
{ earnings: 11596.00, withTax: 2968.00 },
{ earnings: 11600.33, withTax: 2973.00 },
{ earnings: 11604.67, withTax: 2973.00 },
{ earnings: 11609.00, withTax: 2973.00 },
{ earnings: 11613.33, withTax: 2977.00 },
{ earnings: 11617.67, withTax: 2977.00 },
{ earnings: 11622.00, withTax: 2981.00 },
{ earnings: 11626.33, withTax: 2981.00 },
{ earnings: 11630.67, withTax: 2981.00 },
{ earnings: 11635.00, withTax: 2986.00 },
{ earnings: 11639.33, withTax: 2986.00 },
{ earnings: 11643.67, withTax: 2990.00 },
{ earnings: 11648.00, withTax: 2990.00 },
{ earnings: 11652.33, withTax: 2990.00 },
{ earnings: 11656.67, withTax: 2994.00 },
{ earnings: 11661.00, withTax: 2994.00 },
{ earnings: 11665.33, withTax: 2999.00 },
{ earnings: 11669.67, withTax: 2999.00 },
{ earnings: 11674.00, withTax: 2999.00 },
{ earnings: 11678.33, withTax: 3003.00 },
{ earnings: 11682.67, withTax: 3003.00 },
{ earnings: 11687.00, withTax: 3007.00 },
{ earnings: 11691.33, withTax: 3007.00 },
{ earnings: 11695.67, withTax: 3007.00 },
{ earnings: 11700.00, withTax: 3012.00 },
{ earnings: 11704.33, withTax: 3012.00 },
{ earnings: 11708.67, withTax: 3012.00 },
{ earnings: 11713.00, withTax: 3016.00 },
{ earnings: 11717.33, withTax: 3016.00 },
{ earnings: 11721.67, withTax: 3020.00 },
{ earnings: 11726.00, withTax: 3020.00 },
{ earnings: 11730.33, withTax: 3020.00 },
{ earnings: 11734.67, withTax: 3025.00 },
{ earnings: 11739.00, withTax: 3025.00 },
{ earnings: 11743.33, withTax: 3029.00 },
{ earnings: 11747.67, withTax: 3029.00 },
{ earnings: 11752.00, withTax: 3029.00 },
{ earnings: 11756.33, withTax: 3033.00 },
{ earnings: 11760.67, withTax: 3033.00 },
{ earnings: 11765.00, withTax: 3038.00 },
{ earnings: 11769.33, withTax: 3038.00 },
{ earnings: 11773.67, withTax: 3038.00 },
{ earnings: 11778.00, withTax: 3042.00 },
{ earnings: 11782.33, withTax: 3042.00 },
{ earnings: 11786.67, withTax: 3042.00 },
{ earnings: 11791.00, withTax: 3046.00 },
{ earnings: 11795.33, withTax: 3046.00 },
{ earnings: 11799.67, withTax: 3051.00 },
{ earnings: 11804.00, withTax: 3051.00 },
{ earnings: 11808.33, withTax: 3051.00 },
{ earnings: 11812.67, withTax: 3055.00 },
{ earnings: 11817.00, withTax: 3055.00 },
{ earnings: 11821.33, withTax: 3059.00 },
{ earnings: 11825.67, withTax: 3059.00 },
{ earnings: 11830.00, withTax: 3059.00 },
{ earnings: 11834.33, withTax: 3064.00 },
{ earnings: 11838.67, withTax: 3064.00 },
{ earnings: 11843.00, withTax: 3068.00 },
{ earnings: 11847.33, withTax: 3068.00 },
{ earnings: 11851.67, withTax: 3068.00 },
{ earnings: 11856.00, withTax: 3072.00 },
{ earnings: 11860.33, withTax: 3072.00 },
{ earnings: 11864.67, withTax: 3077.00 },
{ earnings: 11869.00, withTax: 3077.00 },
{ earnings: 11873.33, withTax: 3077.00 },
{ earnings: 11877.67, withTax: 3081.00 },
{ earnings: 11882.00, withTax: 3081.00 },
{ earnings: 11886.33, withTax: 3081.00 },
{ earnings: 11890.67, withTax: 3085.00 },
{ earnings: 11895.00, withTax: 3085.00 },
{ earnings: 11899.33, withTax: 3090.00 },
{ earnings: 11903.67, withTax: 3090.00 },
{ earnings: 11908.00, withTax: 3090.00 },
{ earnings: 11912.33, withTax: 3094.00 },
{ earnings: 11916.67, withTax: 3094.00 },
{ earnings: 11921.00, withTax: 3098.00 },
{ earnings: 11925.33, withTax: 3098.00 },
{ earnings: 11929.67, withTax: 3098.00 },
{ earnings: 11934.00, withTax: 3103.00 },
{ earnings: 11938.33, withTax: 3103.00 },
{ earnings: 11942.67, withTax: 3107.00 },
{ earnings: 11947.00, withTax: 3107.00 },
{ earnings: 11951.33, withTax: 3107.00 },
{ earnings: 11955.67, withTax: 3111.00 },
{ earnings: 11960.00, withTax: 3111.00 },
{ earnings: 11964.33, withTax: 3116.00 },
{ earnings: 11968.67, withTax: 3116.00 },
{ earnings: 11973.00, withTax: 3116.00 },
{ earnings: 11977.33, withTax: 3120.00 },
{ earnings: 11981.67, withTax: 3120.00 },
{ earnings: 11986.00, withTax: 3120.00 },
{ earnings: 11990.33, withTax: 3124.00 },
{ earnings: 11994.67, withTax: 3124.00 },
{ earnings: 11999.00, withTax: 3129.00 },
{ earnings: 12003.33, withTax: 3129.00 },
{ earnings: 12007.67, withTax: 3129.00 },
{ earnings: 12012.00, withTax: 3133.00 },
{ earnings: 12016.33, withTax: 3133.00 },
{ earnings: 12020.67, withTax: 3137.00 },
{ earnings: 12025.00, withTax: 3137.00 },
{ earnings: 12029.33, withTax: 3137.00 },
{ earnings: 12033.67, withTax: 3142.00 },
{ earnings: 12038.00, withTax: 3142.00 },
{ earnings: 12042.33, withTax: 3146.00 },
{ earnings: 12046.67, withTax: 3146.00 },
{ earnings: 12051.00, withTax: 3146.00 },
{ earnings: 12055.33, withTax: 3150.00 },
{ earnings: 12059.67, withTax: 3150.00 },
{ earnings: 12064.00, withTax: 3155.00 },
{ earnings: 12068.33, withTax: 3155.00 },
{ earnings: 12072.67, withTax: 3155.00 },
{ earnings: 12077.00, withTax: 3159.00 },
{ earnings: 12081.33, withTax: 3159.00 },
{ earnings: 12085.67, withTax: 3159.00 },
{ earnings: 12090.00, withTax: 3163.00 },
{ earnings: 12094.33, withTax: 3163.00 },
{ earnings: 12098.67, withTax: 3168.00 },
{ earnings: 12103.00, withTax: 3168.00 },
{ earnings: 12107.33, withTax: 3168.00 },
{ earnings: 12111.67, withTax: 3172.00 },
{ earnings: 12116.00, withTax: 3172.00 },
{ earnings: 12120.33, withTax: 3176.00 },
{ earnings: 12124.67, withTax: 3176.00 },
{ earnings: 12129.00, withTax: 3176.00 },
{ earnings: 12133.33, withTax: 3181.00 },
{ earnings: 12137.67, withTax: 3181.00 },
{ earnings: 12142.00, withTax: 3185.00 },
{ earnings: 12146.33, withTax: 3185.00 },
{ earnings: 12150.67, withTax: 3185.00 },
{ earnings: 12155.00, withTax: 3189.00 },
{ earnings: 12159.33, withTax: 3189.00 },
{ earnings: 12163.67, withTax: 3194.00 },
{ earnings: 12168.00, withTax: 3194.00 },
{ earnings: 12172.33, withTax: 3194.00 },
{ earnings: 12176.67, withTax: 3198.00 },
{ earnings: 12181.00, withTax: 3198.00 },
{ earnings: 12185.33, withTax: 3198.00 },
{ earnings: 12189.67, withTax: 3202.00 },
{ earnings: 12194.00, withTax: 3202.00 },
{ earnings: 12198.33, withTax: 3207.00 },
{ earnings: 12202.67, withTax: 3207.00 },
{ earnings: 12207.00, withTax: 3207.00 },
{ earnings: 12211.33, withTax: 3211.00 },
{ earnings: 12215.67, withTax: 3211.00 },
{ earnings: 12220.00, withTax: 3215.00 },
{ earnings: 12224.33, withTax: 3215.00 },
{ earnings: 12228.67, withTax: 3215.00 },
{ earnings: 12233.00, withTax: 3220.00 },
{ earnings: 12237.33, withTax: 3220.00 },
{ earnings: 12241.67, withTax: 3224.00 },
{ earnings: 12246.00, withTax: 3224.00 },
{ earnings: 12250.33, withTax: 3224.00 },
{ earnings: 12254.67, withTax: 3228.00 },
{ earnings: 12259.00, withTax: 3228.00 },
{ earnings: 12263.33, withTax: 3233.00 },
{ earnings: 12267.67, withTax: 3233.00 },
{ earnings: 12272.00, withTax: 3233.00 },
{ earnings: 12276.33, withTax: 3237.00 },
{ earnings: 12280.67, withTax: 3237.00 },
{ earnings: 12285.00, withTax: 3237.00 },
{ earnings: 12289.33, withTax: 3241.00 },
{ earnings: 12293.67, withTax: 3241.00 },
{ earnings: 12298.00, withTax: 3246.00 },
{ earnings: 12302.33, withTax: 3246.00 },
{ earnings: 12306.67, withTax: 3246.00 },
{ earnings: 12311.00, withTax: 3250.00 },
{ earnings: 12315.33, withTax: 3250.00 },
{ earnings: 12319.67, withTax: 3250.00 },
{ earnings: 12324.00, withTax: 3254.00 },
{ earnings: 12328.33, withTax: 3254.00 },
{ earnings: 12332.67, withTax: 3259.00 },
{ earnings: 12337.00, withTax: 3259.00 },
{ earnings: 12341.33, withTax: 3259.00 },
{ earnings: 12345.67, withTax: 3263.00 },
{ earnings: 12350.00, withTax: 3263.00 },
{ earnings: 12354.33, withTax: 3267.00 },
{ earnings: 12358.67, withTax: 3267.00 },
{ earnings: 12363.00, withTax: 3267.00 },
{ earnings: 12367.33, withTax: 3272.00 },
{ earnings: 12371.67, withTax: 3272.00 },
{ earnings: 12376.00, withTax: 3276.00 },
{ earnings: 12380.33, withTax: 3276.00 },
{ earnings: 12384.67, withTax: 3276.00 },
{ earnings: 12389.00, withTax: 3280.00 },
{ earnings: 12393.33, withTax: 3280.00 },
{ earnings: 12397.67, withTax: 3285.00 },
{ earnings: 12402.00, withTax: 3285.00 },
{ earnings: 12406.33, withTax: 3285.00 },
{ earnings: 12410.67, withTax: 3289.00 },
{ earnings: 12415.00, withTax: 3289.00 },
{ earnings: 12419.33, withTax: 3289.00 },
{ earnings: 12423.67, withTax: 3293.00 },
{ earnings: 12428.00, withTax: 3293.00 },
{ earnings: 12432.33, withTax: 3298.00 },
{ earnings: 12436.67, withTax: 3298.00 },
{ earnings: 12441.00, withTax: 3298.00 },
{ earnings: 12445.33, withTax: 3302.00 },
{ earnings: 12449.67, withTax: 3302.00 },
{ earnings: 12454.00, withTax: 3306.00 },
{ earnings: 12458.33, withTax: 3306.00 },
{ earnings: 12462.67, withTax: 3306.00 },
{ earnings: 12467.00, withTax: 3311.00 },
{ earnings: 12471.33, withTax: 3311.00 },
{ earnings: 12475.67, withTax: 3315.00 },
{ earnings: 12480.00, withTax: 3315.00 },
{ earnings: 12484.33, withTax: 3315.00 },
{ earnings: 12488.67, withTax: 3319.00 },
{ earnings: 12493.00, withTax: 3319.00 },
{ earnings: 12497.33, withTax: 3319.00 },
{ earnings: 12501.67, withTax: 3324.00 },
{ earnings: 12506.00, withTax: 3324.00 },
{ earnings: 12510.33, withTax: 3328.00 },
{ earnings: 12514.67, withTax: 3328.00 },
{ earnings: 12519.00, withTax: 3328.00 },
{ earnings: 12523.33, withTax: 3332.00 },
{ earnings: 12527.67, withTax: 3332.00 },
{ earnings: 12532.00, withTax: 3337.00 },
{ earnings: 12536.33, withTax: 3337.00 },
{ earnings: 12540.67, withTax: 3337.00 },
{ earnings: 12545.00, withTax: 3341.00 },
{ earnings: 12549.33, withTax: 3341.00 },
{ earnings: 12553.67, withTax: 3345.00 },
{ earnings: 12558.00, withTax: 3345.00 },
{ earnings: 12562.33, withTax: 3345.00 },
{ earnings: 12566.67, withTax: 3350.00 },
{ earnings: 12571.00, withTax: 3350.00 },
{ earnings: 12575.33, withTax: 3350.00 },
{ earnings: 12579.67, withTax: 3354.00 },
{ earnings: 12584.00, withTax: 3354.00 },
{ earnings: 12588.33, withTax: 3358.00 },
{ earnings: 12592.67, withTax: 3358.00 },
{ earnings: 12597.00, withTax: 3358.00 },
{ earnings: 12601.33, withTax: 3363.00 },
{ earnings: 12605.67, withTax: 3363.00 },
{ earnings: 12610.00, withTax: 3367.00 },
{ earnings: 12614.33, withTax: 3367.00 },
{ earnings: 12618.67, withTax: 3367.00 },
{ earnings: 12623.00, withTax: 3371.00 },
{ earnings: 12627.33, withTax: 3371.00 },
{ earnings: 12631.67, withTax: 3376.00 },
{ earnings: 12636.00, withTax: 3376.00 },
{ earnings: 12640.33, withTax: 3376.00 },
{ earnings: 12644.67, withTax: 3380.00 },
{ earnings: 12649.00, withTax: 3380.00 },
{ earnings: 12653.33, withTax: 3384.00 },
{ earnings: 12657.67, withTax: 3384.00 },
{ earnings: 12662.00, withTax: 3384.00 },
{ earnings: 12666.33, withTax: 3389.00 },
{ earnings: 12670.67, withTax: 3389.00 },
{ earnings: 12675.00, withTax: 3389.00 }
      ];
    
    // Find the highest earnings value that does not exceed the salary
    let applicableTax = 0;
for (let i = 0; i < taxTableSimplified.length; i++) {
  if (grossSalary >= taxTableSimplified[i].earnings) {
    applicableTax = taxTableSimplified[i].withTax;
  } else {
    break;
      }
    }
    
    return applicableTax;
  }

  // Handle hour change for a specific day
  async function handleHoursChange(date, hours) {
    const parsedHours = parseFloat(hours);
    
    // Update local state immediately for responsive UX - preserve existing clock-in time
    setWorkHours(prev => {
      const existingData = prev[date];
      const existingClockIn = typeof existingData === 'object' ? existingData.clockIn || '' : '';
      
      return {
        ...prev,
        [date]: {
          hours: parsedHours,
          clockIn: existingClockIn
        }
      };
    });
    
    // Usar o serviço de sincronização que vai gerenciar tanto online quanto offline
    try {
      await syncService.saveWorkHours(DEFAULT_USER_ID, date, parsedHours);
    } catch (err) {
      console.error('Erro ao salvar horas de trabalho:', err);
      // Estado local já foi atualizado, não é necessário reverter
    }
  }

  // Handle clock-in time change for a specific day
  async function handleClockInChange(date, clockInTime) {
    // Update local state immediately for responsive UX - preserve existing hours
    setWorkHours(prev => {
      const existingData = prev[date];
      const existingHours = typeof existingData === 'object' ? existingData.hours || 0 : existingData || 0;
      
      return {
        ...prev,
        [date]: {
          hours: existingHours,
          clockIn: clockInTime
        }
      };
    });
    
    // Save clock-in time using sync service
    try {
      await syncService.saveClockInTime(DEFAULT_USER_ID, date, clockInTime);
    } catch (err) {
      console.error('Erro ao salvar horário de entrada:', err);
    }
  }

  // Navigate between payroll periods
  function navigatePeriod(direction) {
    if (!selectedPeriod || !payrollPeriods || payrollPeriods.length === 0) {
      return;
    }
    
    const currentIndex = payrollPeriods.findIndex(period => period.id === selectedPeriod.id);
    if (currentIndex === -1) return; // Período atual não encontrado no array
    
    if (direction === 'next' && currentIndex < payrollPeriods.length - 1) {
      setSelectedPeriod(payrollPeriods[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setSelectedPeriod(payrollPeriods[currentIndex - 1]);
    }
  }

  // Generate hours options for dropdown
  function renderHoursOptions() {
    const options = [];
    for (let i = MIN_HOURS; i <= MAX_HOURS; i += 0.5) {
      options.push(<option key={i} value={i}>{i}</option>);
    }
    return options;
  }

  // Set standard hours for period
  async function setStandardHoursForPeriod() {
    if (!selectedPeriod) return;
    
    // Local implementation to work offline
    const daysInPeriod = getDaysInPeriod();
    const newWorkHours = {...workHours};
    const updatedEntries = [];
    
    daysInPeriod.forEach(day => {
      if (!day.isHoliday) {
        // Set hours based on the day of the week
        const hours = STANDARD_HOURS_BY_DAY[day.dayOfWeek];
        const existingData = newWorkHours[day.date];
        const clockIn = typeof existingData === 'object' ? existingData.clockIn || '' : '';
        
        newWorkHours[day.date] = {
          hours: hours,
          clockIn: clockIn
        };
        
        // Adicionar à lista para sincronização
        updatedEntries.push({
          date: day.date,
          hours: hours,
          clockIn: clockIn
        });
      }
    });
    
    // Update local state
    setWorkHours(newWorkHours);
    
    // Se não estiver offline, enviar para o servidor
    if (!isOffline) {
      try {
        await apiService.setStandardHours(DEFAULT_USER_ID, selectedPeriod.id);
      } catch (err) {
        console.error('Erro ao definir horas padrão no servidor:', err);
        setIsOffline(true);
        
        // Como estamos offline, precisamos salvar cada entrada individualmente
        for (const entry of updatedEntries) {
          await syncService.saveWorkHours(DEFAULT_USER_ID, entry.date, entry.hours);
        }
      }
    } else {
      // Se já estamos offline, salvamos cada entrada individualmente
      for (const entry of updatedEntries) {
        await syncService.saveWorkHours(DEFAULT_USER_ID, entry.date, entry.hours);
      }
    }
  }

  // Reset hours for period
  async function resetPeriodHours() {
    if (!selectedPeriod) return;
    
    if (window.confirm('Resetar todas as horas para este período de pagamento?')) {
      // Local implementation to work offline
      const daysInPeriod = getDaysInPeriod();
      const newWorkHours = {...workHours};
      
      daysInPeriod.forEach(day => {
        delete newWorkHours[day.date];
      });
      
      // Update local state
      setWorkHours(newWorkHours);
      
      // Se não estiver offline, enviar para o servidor
      if (!isOffline) {
        try {
          await apiService.resetPeriodHours(DEFAULT_USER_ID, selectedPeriod.id);
        } catch (err) {
          console.error('Error resetting period hours on the server:', err);
          setIsOffline(true);
          
          // Offline — reset each day individually
          for (const day of daysInPeriod) {
            await syncService.saveWorkHours(DEFAULT_USER_ID, day.date, 0);
          }
        }
      } else {
        // Already offline — reset each day individually
        for (const day of daysInPeriod) {
          await syncService.saveWorkHours(DEFAULT_USER_ID, day.date, 0);
        }
      }
    }
  }

  // Callback for offline/online status changes
  const handleOfflineStatusChange = (status) => {
    setIsOffline(status);
  };

  // Renderizar estado de carregamento
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white font-sans flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Verificar se selectedPeriod está definido
  if (!selectedPeriod) {
    return (
      <div className="min-h-screen bg-gray-900 text-white font-sans flex items-center justify-center">
        <div className="text-xl">Error: Pay period not found</div>
      </div>
    );
  }

  
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Offline Mode Manager */}
      <OfflineManager onStatusChange={handleOfflineStatusChange} />
      
      {/* Header */}
      <header className="bg-blue-900 p-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
  PT
</div>
<span className="ml-2 text-sm text-blue-300">Payroll Tracker</span>
          </div>
          <h1 className="text-xl font-bold">Payroll Tracker 2026</h1>
        </div>
      </header>
      
      {/* API Status */}
      {apiStatus.status !== 'connected' && (
        <div className={`bg-${apiStatus.status === 'error' ? 'red' : 'yellow'}-800 text-white p-2 text-center text-sm my-2`}>
          Status da API: {apiStatus.message}
        </div>
      )}
      
      {/* Main Content */}
      <main className="container mx-auto p-4">
        {/* Period Selector */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigatePeriod('prev')}
              className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              disabled={!payrollPeriods.length || selectedPeriod.id === payrollPeriods[0]?.id}
            >
              <ChevronLeft size={20} className={!payrollPeriods.length || selectedPeriod.id === payrollPeriods[0]?.id ? "text-gray-600" : "text-blue-400"} />
            </button>
            
            <div className="flex items-center">
              <Calendar size={20} className="text-blue-400 mr-2" />
              <h2 className="text-lg font-semibold">{selectedPeriod.label}</h2>
            </div>
            
            <button 
              onClick={() => navigatePeriod('next')}
              className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              disabled={!payrollPeriods.length || selectedPeriod.id === payrollPeriods[payrollPeriods.length - 1]?.id}
            >
              <ChevronRight size={20} className={!payrollPeriods.length || selectedPeriod.id === payrollPeriods[payrollPeriods.length - 1]?.id ? "text-gray-600" : "text-blue-400"} />
            </button>
          </div>
          
          <div className="mt-2 text-sm text-gray-400 text-center">
            Período: {new Date(selectedPeriod.start).toLocaleDateString()} - {new Date(selectedPeriod.end).toLocaleDateString()}
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-blue-900">
            <div className="flex items-center mb-2">
              <Clock size={20} className="text-blue-400 mr-2" />
              <h3 className="text-lg font-semibold">Total Hours</h3>
            </div>
            <div className="text-3xl font-bold text-blue-300">{totalStats.hours.toFixed(1)}</div>
            <div className="text-sm text-gray-400 mt-1">Hours logged this period</div>
          </div>

          {/* Period Progress Dashboard */}
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-blue-900">
            <div className="flex items-center mb-2">
              <Calendar size={20} className="text-blue-400 mr-2" />
              <h3 className="text-lg font-semibold">Period Progress</h3>
            </div>
            
            {(() => {
              const today = new Date();
              const startDate = new Date(selectedPeriod.start);
              const endDate = new Date(selectedPeriod.end);
              
              // Calculate total days in period
              const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
              
              // Calculate days elapsed
              const daysElapsed = Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)));
              
              // Calculate days remaining
              const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
              
              // Calculate progress percentage
              const progressPercent = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
              
              // Determine status and color
              const isOverdue = today > endDate;
              const isComplete = today >= endDate;
              const isActive = today >= startDate && today <= endDate;
              
              let statusColor = 'text-blue-400';
              let progressColor = 'bg-blue-500';
              let statusText = 'Upcoming';
              
              if (isOverdue) {
                statusColor = 'text-red-400';
                progressColor = 'bg-red-500';
                statusText = 'Overdue';
              } else if (isComplete) {
                statusColor = 'text-green-400';
                progressColor = 'bg-green-500';
                statusText = 'Complete';
              } else if (isActive) {
                statusColor = 'text-yellow-400';
                progressColor = 'bg-yellow-500';
                statusText = 'Active';
              }

              return (
                <>
                  <div className={`text-3xl font-bold ${statusColor} mb-1`}>
                    {isComplete ? '0' : daysRemaining}
                  </div>
                  <div className="text-sm text-gray-400 mb-3">
                    {isComplete ? 'Period ended' : 'Days remaining'}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{progressPercent.toFixed(1)}% complete</span>
                    <span className={statusColor}>{statusText}</span>
                  </div>
                </>
              );
            })()}
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-blue-900">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <DollarSign size={20} className="text-blue-400 mr-2" />
                <h3 className="text-lg font-semibold">Estimated Salary</h3>
              </div>
              <button 
                onClick={() => setShowRateInfo(!showRateInfo)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-2 rounded transition-colors"
              >
                {showRateInfo ? 'Hide Rate' : 'Show Rate'}
              </button>
            </div>
            <div className="text-3xl font-bold text-green-400">
              AUD ${totalStats.salary.toFixed(2)}
            </div>
            <div className="flex flex-col text-sm text-gray-400 mt-1">
              <span>Gross Salary: AUD ${totalStats.grossSalary.toFixed(2)}</span>
              <span>Tax (PAYG): AUD ${totalStats.tax.toFixed(2)}</span>
              {showRateInfo && (
                <span className="mt-1">Based on $30/hour</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Weekly Breakdown */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Weekly Breakdown</h3>
          
          {weeklyStats.map((week, index) => (
            <div key={week.start} className="bg-gray-800 rounded-lg p-4 mb-4 shadow-md">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">
                  Week {index + 1}: {new Date(week.start).toLocaleDateString()} - {new Date(week.end).toLocaleDateString()}
                </h4>
                <div className="flex flex-col items-end">
                  <span className="text-blue-300 font-semibold">{week.totalHours} hrs</span>
                  <div className="text-sm">
                    <span className="text-green-400 font-semibold">AUD ${week.totalSalary !== undefined ? week.totalSalary.toFixed(2) : (week.grossSalary - (week.tax || 0)).toFixed(2)}</span>
                    <span className="text-gray-400 ml-1">(tax: ${(week.tax || 0).toFixed(2)})</span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="text-left py-2 w-20">Day</th>
                      <th className="text-left py-2 w-24">Date</th>
                      <th className="text-left py-2 w-24">Clock-in</th>
                      <th className="text-right py-2 w-20">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.days.map(day => {
                      const workData = workHours[day.date];
                      const hours = typeof workData === 'object' ? workData.hours || 0 : workData || 0;
                      const clockIn = typeof workData === 'object' ? workData.clockIn || '' : '';
                      
                      return (
                        <tr key={day.date} className={`border-b border-gray-700 last:border-0 ${day.isHoliday ? 'text-red-400' : ''} ${day.isSaturday ? 'text-yellow-400' : ''}`}>
                          <td className="py-2 w-20">{day.dayName}</td>
                          <td className="py-2 w-24">
                            {day.formattedDate}
                            {day.isHoliday && <span className="ml-2 text-xs bg-red-900 text-red-200 px-1 rounded">Holiday</span>}
                            {day.isSaturday && <span className="ml-2 text-xs bg-yellow-900 text-yellow-200 px-1 rounded">Weekend</span>}
                          </td>
                          <td className="py-2 w-24">
                            <input
                              type="time"
                              className="bg-gray-700 text-white border border-gray-600 rounded p-1 text-sm w-full max-w-[120px]"
                              value={clockIn}
                              onChange={(e) => handleClockInChange(day.date, e.target.value)}
                              placeholder="HH:MM"
                            />
                          </td>
                          <td className="py-2 text-right w-20">
                            <select
                              className="bg-gray-700 text-white border border-gray-600 rounded p-1"
                              value={hours}
                              onChange={(e) => handleHoursChange(day.date, e.target.value)}
                            >
                              {renderHoursOptions()}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-blue-900">
            <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={resetPeriodHours}
                className="bg-red-900 hover:bg-red-800 text-white py-2 px-4 rounded transition-colors"
              >
                Reset Period
              </button>
              
              <button 
                onClick={setStandardHoursForPeriod}
                className="bg-blue-900 hover:bg-blue-800 text-white py-2 px-4 rounded transition-colors"
              >
                Set Weekly Hours
              </button>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-blue-900">
            <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Info</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Standard weekly hours: Mon (10h), Tue (10h), Wed (4.5h), Thu (4.5h), Fri (6h), Sat (0h)</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Tax calculated according to ATO PAYG Tax Table NAT 1007 (July 2024)</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Public holidays marked in red may have different pay rates. Consult your supervisor.</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <div className="flex items-center">
                  {isOffline ? <CloudOff size={14} className="mr-1 text-red-400" /> : <Database size={14} className="mr-1 text-green-400" />}
                  <span>{isOffline ? 'Data stored locally and will sync when connection is restored.' : 'Data stored in MongoDB with local backup for offline use.'}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="container mx-auto text-sm text-gray-400 text-center">
          <p>Payroll Tracker 2026 — Developed by <a href="mailto:veleda.will@gmail.com" className="text-blue-400 hover:text-blue-300 transition-colors">William Veleda</a></p>
<p className="mt-1 text-xs flex items-center justify-center">
  <span className="mr-2">Hourly Rate: AUD $30</span>
  <span className="flex items-center">
    {isOffline ? <CloudOff size={14} className="mr-1 text-red-400" /> : <Database size={14} className="mr-1 text-green-400" />}
    {isOffline ? 'Offline — Data stored locally' : 'Connected to MongoDB'}
  </span>
</p>
        </div>
      </footer>
    </div>
  );
};

export default PayrollTracker;