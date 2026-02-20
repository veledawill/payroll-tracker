// server.js - Servidor Express com MongoDB para LASS Payroll Tracker
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const moment = require('moment');

// Modelos do MongoDB
const User = require('./models/User');
const PayrollPeriod = require('./models/PayrollPeriod');
const WorkHour = require('./models/WorkHour');
const PublicHoliday = require('./models/PublicHoliday');
const RateSetting = require('./models/RateSetting');
const TaxBracket = require('./models/TaxBracket');

const app = express();
const PORT = process.env.PORT || 3003;

// Conectar ao MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept']
}));

// Função de inicialização do banco de dados com dados iniciais
async function initializeDatabase() {
  try {
    // Verificar se já existem dados no sistema
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('Inicializando banco de dados com dados iniciais...');
      
      // Criar usuário padrão
      const defaultUser = new User({
        username: 'default_user'
      });
      const savedUser = await defaultUser.save();
      
      // Adicionar períodos de pagamento de 2025
      const payrollPeriods = [
        { period_label: 'Jan 2025 Payroll', start_date: '2024-12-23', end_date: '2025-01-24', year: 2025 },
        { period_label: 'Feb 2025 Payroll', start_date: '2025-01-27', end_date: '2025-02-21', year: 2025 },
        { period_label: 'Mar 2025 Payroll', start_date: '2025-02-24', end_date: '2025-03-21', year: 2025 },
        { period_label: 'Apr 2025 Payroll', start_date: '2025-03-24', end_date: '2025-04-18', year: 2025 },
        { period_label: 'May 2025 Payroll', start_date: '2025-04-21', end_date: '2025-05-23', year: 2025 },
        { period_label: 'Jun 2025 Payroll', start_date: '2025-05-26', end_date: '2025-06-20', year: 2025 },
        { period_label: 'Jul 2025 Payroll', start_date: '2025-06-23', end_date: '2025-07-25', year: 2025 },
        { period_label: 'Aug 2025 Payroll', start_date: '2025-07-28', end_date: '2025-08-22', year: 2025 },
        { period_label: 'Sep 2025 Payroll', start_date: '2025-08-25', end_date: '2025-09-19', year: 2025 },
        { period_label: 'Oct 2025 Payroll', start_date: '2025-09-22', end_date: '2025-10-24', year: 2025 },
        { period_label: 'Nov 2025 Payroll', start_date: '2025-10-27', end_date: '2025-11-21', year: 2025 },
        { period_label: 'Dec 2025 Payroll', start_date: '2025-11-24', end_date: '2025-12-19', year: 2025 }
      ];
      
      await PayrollPeriod.insertMany(payrollPeriods);
      
      // Adicionar feriados públicos de 2025 da Austrália
      const publicHolidays = [
        { holiday_date: '2025-01-01', holiday_name: 'New Year\'s Day', year: 2025 },
        { holiday_date: '2025-01-27', holiday_name: 'Australia Day', year: 2025 },
        { holiday_date: '2025-04-18', holiday_name: 'Good Friday', year: 2025 },
        { holiday_date: '2025-04-25', holiday_name: 'ANZAC Day', year: 2025 },
        { holiday_date: '2025-10-06', holiday_name: 'Labour Day', year: 2025 },
        { holiday_date: '2025-12-25', holiday_name: 'Christmas Day', year: 2025 },
        { holiday_date: '2025-12-26', holiday_name: 'Boxing Day', year: 2025 }
      ];
      
      await PublicHoliday.insertMany(publicHolidays);
      
      // Definir a taxa horária padrão como 34
      const defaultRate = new RateSetting({
        hourly_rate: 34,
        effective_from: '2025-01-01',
        user: savedUser._id
      });
      
      await defaultRate.save();
      
      // Inserir faixas de imposto simplificadas
      const taxBrackets = [
        { earnings: 0, with_tax: 0, effective_from: '2025-01-01' },
        { earnings: 1576.00, with_tax: 0, effective_from: '2025-01-01' },
        { earnings: 1577.33, with_tax: 4.00, effective_from: '2025-01-01' },
        { earnings: 1603.33, with_tax: 9.00, effective_from: '2025-01-01' },
        { earnings: 1633.67, with_tax: 13.00, effective_from: '2025-01-01' },
        { earnings: 2000.00, with_tax: 87.00, effective_from: '2025-01-01' },
        { earnings: 3000.00, with_tax: 312.00, effective_from: '2025-01-01' },
        { earnings: 4000.00, with_tax: 572.00, effective_from: '2025-01-01' },
        { earnings: 5000.00, with_tax: 823.00, effective_from: '2025-01-01' },
        { earnings: 6000.00, with_tax: 1057.00, effective_from: '2025-01-01' },
        { earnings: 8000.00, with_tax: 1564.00, effective_from: '2025-01-01' },
        { earnings: 10000.00, with_tax: 2396.00, effective_from: '2025-01-01' },
        { earnings: 12000.00, with_tax: 3072.00, effective_from: '2025-01-01' },
        { earnings: 12675.00, with_tax: 3393.00, effective_from: '2025-01-01' }
      ];
      
      await TaxBracket.insertMany(taxBrackets);
      
      console.log('Banco de dados inicializado com sucesso!');
    } else {
      console.log('Banco de dados já contém dados, pulando inicialização');
      
      // Check if we need to update the hourly rate to 34
      const rateSettings = await RateSetting.find();
      if (rateSettings.length > 0) {
        const needsUpdate = rateSettings.some(rate => rate.hourly_rate !== 34);
        if (needsUpdate) {
          console.log('Atualizando taxa horária para $34...');
          await RateSetting.updateMany({}, { hourly_rate: 34 });
          console.log('Taxa horária atualizada com sucesso!');
        }
      }
    }
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
  }
}

// Inicializar banco de dados ao iniciar o servidor
initializeDatabase();

// Rotas da API

// Obter todos os períodos de pagamento
app.get('/api/payroll-periods', async (req, res) => {
  try {
    const periods = await PayrollPeriod.find().sort({ start_date: 1 });
    res.json(periods);
  } catch (error) {
    console.error('Erro ao buscar períodos de pagamento:', error);
    res.status(500).json({ error: 'Erro ao buscar períodos de pagamento' });
  }
});

// Obter o período de pagamento atual
app.get('/api/current-payroll-period', async (req, res) => {
  try {
    const today = new Date();
    
    // Buscar período que contém a data atual
    const currentPeriod = await PayrollPeriod.findOne({
      start_date: { $lte: today },
      end_date: { $gte: today }
    });
    
    // Se não encontrar, retorna o primeiro período
    if (!currentPeriod) {
      const firstPeriod = await PayrollPeriod.findOne().sort({ start_date: 1 });
      res.json(firstPeriod || null);
    } else {
      res.json(currentPeriod);
    }
  } catch (error) {
    console.error('Erro ao buscar período de pagamento atual:', error);
    res.status(500).json({ error: 'Erro ao buscar período de pagamento atual' });
  }
});

// Obter horas de trabalho para um período específico
app.get('/api/work-hours/:userId/:periodId', async (req, res) => {
  try {
    const { userId, periodId } = req.params;
    console.log('Requested work hours for:', userId, periodId); // Debug logging

    // Obter usuário
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Obter datas do período de pagamento
    const period = await PayrollPeriod.findById(periodId);
    if (!period) {
      return res.status(404).json({ error: 'Período não encontrado' });
    }
    
    // Obter feriados públicos
    const holidays = await PublicHoliday.find({
      holiday_date: {
        $gte: period.start_date,
        $lte: period.end_date
      }
    });
    
    const holidayDates = holidays.map(h => h.holiday_date.toISOString().split('T')[0]);
    
    // Gerar todas as datas no período (exceto domingos)
    const days = [];
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    
    for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
      const dayOfWeek = day.getDay(); // 0 = Domingo
      
      if (dayOfWeek !== 0) { // Pular domingos
        const dateStr = day.toISOString().split('T')[0];
        days.push(dateStr);
      }
    }
    
    // Obter horas de trabalho salvas para este período
    const workHours = await WorkHour.find({
      user: userId,
      work_date: {
        $gte: period.start_date,
        $lte: period.end_date
      }
    });
    
    // Criar map para fácil acesso às horas por data
    const workHoursMap = {};
    workHours.forEach(wh => {
      const dateStr = wh.work_date.toISOString().split('T')[0];
      workHoursMap[dateStr] = wh.hours_worked;
    });
    
    // Formatar resultados
    const formattedWorkHours = days.map(dateStr => {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const isHoliday = holidayDates.includes(dateStr);
      const isSaturday = dayOfWeek === 6;
      
      const workHour = workHours.find(wh => wh.work_date.toISOString().split('T')[0] === dateStr);
      
      return {
        date: dateStr,
        dayOfWeek,
        isHoliday,
        isSaturday,
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        formattedDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours: workHoursMap[dateStr] || 0,
        clock_in_time: workHour?.clock_in_time || '',
        sync_id: workHour?.sync_id || null
      };
    });
    
    res.json(formattedWorkHours);
  } catch (error) {
    console.error('Erro ao buscar horas de trabalho:', error);
    res.status(500).json({ error: 'Erro ao buscar horas de trabalho' });
  }
});

// Registrar ou atualizar horas trabalhadas
app.post('/api/work-hours', async (req, res) => {
  try {
    const { userId, workDate, hours, clockInTime, sync_id } = req.body;
    
    if (!userId || !workDate || hours === undefined) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Buscar usuário
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se já existe registro para esta data
    let workHour = await WorkHour.findOne({
      user: userId,
      work_date: new Date(workDate)
    });
    
    if (workHour) {
      // Atualizar registro existente
      workHour.hours_worked = hours;
      workHour.clock_in_time = clockInTime || workHour.clock_in_time;
      workHour.updated_at = new Date();
      workHour.last_synced = new Date();
      if (sync_id) workHour.sync_id = sync_id;
      
      await workHour.save();
    } else {
      // Inserir novo registro
      workHour = new WorkHour({
        user: userId,
        work_date: workDate,
        hours_worked: hours,
        clock_in_time: clockInTime || '',
        last_synced: new Date(),
        sync_id: sync_id || undefined
      });
      
      await workHour.save();
    }
    
    res.json({ 
      success: true, 
      work_hour: {
        ...workHour.toObject(),
        date: workHour.work_date.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Erro ao registrar horas de trabalho:', error);
    res.status(500).json({ error: 'Erro ao registrar horas de trabalho' });
  }
});

// Sincronizar múltiplas horas de trabalho (para operação offline)
app.post('/api/sync-work-hours', async (req, res) => {
  try {
    const { userId, hours } = req.body;
    
    if (!userId || !hours || !Array.isArray(hours)) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Buscar usuário
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const results = [];
    
    // Processar cada registro de horas
    for (const hourData of hours) {
      const { workDate, hours, clockInTime, sync_id } = hourData;
      
      if (!workDate || hours === undefined || !sync_id) {
        results.push({ 
          success: false, 
          sync_id, 
          error: 'Dados incompletos para este registro' 
        });
        continue;
      }
      
      try {
        // Verificar se já existe registro para esta data
        let workHour = await WorkHour.findOne({
          user: userId,
          work_date: new Date(workDate)
        });
        
        if (workHour) {
          // Atualizar registro existente se for mais recente
          const clientUpdatedAt = new Date(hourData.updated_at || 0);
          const serverUpdatedAt = new Date(workHour.updated_at || 0);
          
          if (clientUpdatedAt > serverUpdatedAt) {
            workHour.hours_worked = hours;
            workHour.clock_in_time = clockInTime || workHour.clock_in_time;
            workHour.updated_at = new Date();
            workHour.last_synced = new Date();
            workHour.sync_id = sync_id;
            
            await workHour.save();
          }
        } else {
          // Inserir novo registro
          workHour = new WorkHour({
            user: userId,
            work_date: workDate,
            hours_worked: hours,
            clock_in_time: clockInTime || '',
            last_synced: new Date(),
            sync_id
          });
          
          await workHour.save();
        }
        
        results.push({ 
          success: true, 
          sync_id, 
          date: workDate,
          server_updated_at: workHour.updated_at
        });
      } catch (err) {
        results.push({ 
          success: false, 
          sync_id, 
          error: err.message 
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Erro ao sincronizar horas de trabalho:', error);
    res.status(500).json({ error: 'Erro ao sincronizar horas de trabalho' });
  }
});

// Calcular estatísticas semanais
app.get('/api/weekly-stats/:userId/:periodId', async (req, res) => {
  try {
    console.log('=== WEEKLY STATS CALLED ===');
const { userId, periodId } = req.params;
console.log('1. Got params - userId:', userId, 'periodId:', periodId);

// TEMPORARILY SKIP USER CHECK
console.log('2. Skipping user check for testing');
    
const period = await PayrollPeriod.findById(periodId);

    console.log('3. Found period:', period.start_date, 'to', period.end_date);
    
    const hourlyRate = 34;
    
    const workHours = await WorkHour.find({
      user: userId,
      work_date: { $gte: period.start_date, $lte: period.end_date }
    });
    console.log('4. Found', workHours.length, 'work hour records');
    
    const holidays = await PublicHoliday.find({
      holiday_date: { $gte: period.start_date, $lte: period.end_date }
    });
    console.log('5. Found', holidays.length, 'holidays');
    
    const holidayDates = holidays.map(h => h.holiday_date.toISOString().split('T')[0]);
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    const weekMap = new Map();
    
    console.log('6. Starting date loop from', startDate.toISOString(), 'to', endDate.toISOString());
    
    let daysProcessed = 0;

   // Process each date in period
let currentDate = new Date(startDate);
while (currentDate <= endDate) {
  const dateStr = currentDate.toISOString().split('T')[0];
  const dayOfWeek = currentDate.getUTCDay();
  
  // SKIP SUNDAYS
  if (dayOfWeek !== 0) {
    daysProcessed++;
    
    const isHoliday = holidayDates.includes(dateStr);
    const isSaturday = (dayOfWeek === 6);
    
    // Calculate Monday for this date
    const monday = new Date(currentDate);
    monday.setUTCHours(0, 0, 0, 0);
    const daysFromMonday = (dayOfWeek + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
    const mondayStr = monday.toISOString().split('T')[0];
    
    // Calculate Saturday for this week (Monday + 5 days)
    const saturday = new Date(monday);
    saturday.setUTCDate(saturday.getUTCDate() + 5);
    const saturdayStr = saturday.toISOString().split('T')[0];
    
    // Create week if doesn't exist
    if (!weekMap.has(mondayStr)) {
      console.log('Creating week:', mondayStr, 'to', saturdayStr);
      weekMap.set(mondayStr, {
        start: mondayStr,
        end: saturdayStr,
        days: [],
        totalHours: 0,
        grossSalary: 0
      });
    }
    
    const week = weekMap.get(mondayStr);
    const workHour = workHours.find(wh => 
      wh.work_date.toISOString().split('T')[0] === dateStr
    );
    const hours = workHour ? workHour.hours_worked : 0;
    
    week.days.push({ date: dateStr, dayOfWeek, isHoliday, isSaturday, hours });
    week.totalHours += hours;
    week.grossSalary += hours * hourlyRate;
    
    // DEBUG: Log what's being added to week 2
    if (mondayStr === '2025-09-29') {
      console.log('Adding to Week 2:', dateStr, 'dayOfWeek:', dayOfWeek);
    }
  }
  
  // Increment date using UTC to avoid timezone issues
  currentDate.setUTCDate(currentDate.getUTCDate() + 1);
}
    
    console.log('7. Processed', daysProcessed, 'days, created', weekMap.size, 'weeks');
    
    const weeklyStats = Array.from(weekMap.values()).sort((a, b) => 
      new Date(a.start) - new Date(b.start)
    );
    
    console.log('8. Sorted weeks, calculating tax');
    
    const totalGrossSalary = weeklyStats.reduce((sum, week) => sum + week.grossSalary, 0);
    
    let totalTax = 0;
    if (totalGrossSalary > 0) {
      if (totalGrossSalary > 12675.00) {
        if (totalGrossSalary < 15829.67) {
          totalTax = 3393.00 + (totalGrossSalary - 12675.00) * 0.39;
        } else {
          totalTax = 4624.00 + (totalGrossSalary - 15829.66) * 0.47;
        }
      } else {
        const taxBracket = await TaxBracket.findOne({
          earnings: { $lte: totalGrossSalary },
          effective_from: { $lte: new Date() }
        }).sort({ earnings: -1 });
        totalTax = taxBracket ? taxBracket.with_tax : 0;
      }
    }
    
    weeklyStats.forEach(week => {
      if (totalGrossSalary > 0) {
        week.tax = (week.grossSalary / totalGrossSalary) * totalTax;
        week.totalSalary = week.grossSalary - week.tax;
      } else {
        week.tax = 0;
        week.totalSalary = 0;
      }
    });
    
    console.log('9. Final weeks:');
    weeklyStats.forEach((week, index) => {
      console.log(`   Week ${index + 1}:`, week.start, 'to', week.end, '- Days:', week.days.length);
    });
    
    console.log('10. Sending response with', weeklyStats.length, 'weeks');
    res.json(weeklyStats);
  } catch (error) {
    console.error('ERROR in weekly stats:', error);
    res.status(500).json({ error: 'Error calculating weekly statistics' });
  }
});

// Redefinir horas de um período
app.post('/api/reset-period/:userId/:periodId', async (req, res) => {
  try {
    const { userId, periodId } = req.params;
    
    // Obter usuário
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Obter datas do período
    const period = await PayrollPeriod.findById(periodId);
    if (!period) {
      return res.status(404).json({ error: 'Período não encontrado' });
    }
    
    // Deletar todas as horas do período
    await WorkHour.deleteMany({
      user: userId,
      work_date: {
        $gte: period.start_date,
        $lte: period.end_date
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao redefinir horas do período:', error);
    res.status(500).json({ error: 'Erro ao redefinir horas do período' });
  }
});

// Definir horas padrão para um período
app.post('/api/set-standard-hours/:userId/:periodId', async (req, res) => {
  try {
    const { userId, periodId } = req.params;
    
    // Obter usuário
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Obter datas do período
    const period = await PayrollPeriod.findById(periodId);
    if (!period) {
      return res.status(404).json({ error: 'Período não encontrado' });
    }
    
    // Definição de horas padrão por dia da semana
    const standardHours = {
      0: 0,  // Sunday
      1: 10, // Monday
      2: 4.5, // Tuesday
      3: 8,  // Wednesday
      4: 10, // Thursday
      5: 4.5, // Friday
      6: 0   // Saturday
    };
    
    // Obter feriados
    const holidays = await PublicHoliday.find({
      holiday_date: {
        $gte: period.start_date,
        $lte: period.end_date
      }
    });
    
    const holidayDates = holidays.map(h => h.holiday_date.toISOString().split('T')[0]);
    
    // Gerar todas as datas no período (exceto domingos)
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    
    // Arrays para operações em massa
    const bulkOps = [];
    
    // Para cada data no período
    for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
      const dateStr = day.toISOString().split('T')[0];
      const dayOfWeek = day.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      
      // Pular domingos e feriados
      if (dayOfWeek !== 0 && !holidayDates.includes(dateStr)) {
        const hours = standardHours[dayOfWeek] || 0;
        
        // Preparar operação upsert
        bulkOps.push({
          updateOne: {
            filter: {
              user: userId,
              work_date: new Date(dateStr)
            },
            update: {
              $set: {
                hours_worked: hours,
                updated_at: new Date(),
                last_synced: new Date()
              }
            },
            upsert: true
          }
        });
      }
    }
    
    // Executar operações em massa se houver alguma
    if (bulkOps.length > 0) {
      await WorkHour.bulkWrite(bulkOps);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao definir horas padrão:', error);
    res.status(500).json({ error: 'Erro ao definir horas padrão' });
  }
});

// Obter feriados públicos
app.get('/api/public-holidays/:year', async (req, res) => {
  try {
    const { year } = req.params;
    
    const holidays = await PublicHoliday.find({ year: parseInt(year) });
    
    res.json(holidays);
  } catch (error) {
    console.error('Erro ao buscar feriados públicos:', error);
    res.status(500).json({ error: 'Erro ao buscar feriados públicos' });
  }
});

// Obter taxa horária - sempre retornar 34
app.get('/api/hourly-rate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Always return 34 as the hourly rate
    res.json({ hourly_rate: 34 });
  } catch (error) {
    console.error('Erro ao buscar taxa horária:', error);
    res.status(500).json({ error: 'Erro ao buscar taxa horária' });
  }
});

// Rota de teste para verificação de conexão
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API LASS Payroll com MongoDB funcionando corretamente', 
    timestamp: new Date().toISOString() 
  });
});

// Rota de status para verificar se o servidor está funcionando
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date(),
    mongo_status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Iniciar o servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API rodando no endereço: http://localhost:${PORT}`);
  console.log(`Para acesso externo, use seu IP local na porta ${PORT}`);
  console.log('Diretório do servidor:', __dirname);
  
  // Verificar o status da conexão MongoDB usando o método do módulo connectDB
  // Em vez de usar mongoose diretamente
  const { connection } = require('mongoose');
  console.log('Status da conexão MongoDB:', connection.readyState === 1 ? 'Conectado' : 'Desconectado');
});