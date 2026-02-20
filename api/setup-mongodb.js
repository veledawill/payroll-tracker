/**
 * Script para configuração inicial do MongoDB para o LASS Payroll Tracker
 * 
 * Este script cria o banco de dados e as coleções necessárias com dados iniciais.
 * Execute-o uma vez antes de iniciar o aplicativo pela primeira vez.
 * 
 * Uso: node setup-mongodb.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Importar modelos
const User = require('./models/User');
const PayrollPeriod = require('./models/PayrollPeriod');
const PublicHoliday = require('./models/PublicHoliday');
const RateSetting = require('./models/RateSetting');
const TaxBracket = require('./models/TaxBracket');

// URL de conexão MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lass_payroll';

// Interface de linha de comando para confirmar ações
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Conectar ao MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Conectado ao MongoDB em:', MONGODB_URI);
    return true;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error.message);
    return false;
  }
}

// Checar se já existem dados no sistema
async function checkExistingData() {
  try {
    const userCount = await User.countDocuments();
    const periodCount = await PayrollPeriod.countDocuments();
    
    if (userCount > 0 || periodCount > 0) {
      console.log('\nAtenção: Dados já existem no banco de dados!');
      console.log(`- Usuários: ${userCount}`);
      console.log(`- Períodos de Pagamento: ${periodCount}`);
      
      return new Promise((resolve) => {
        rl.question('\nDeseja limpar todos os dados e recriar? (sim/não): ', (answer) => {
          resolve(answer.toLowerCase() === 'sim');
        });
      });
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar dados existentes:', error);
    return false;
  }
}

// Limpar todas as coleções
async function clearAllCollections() {
  try {
    console.log('\nLimpando todas as coleções...');
    
    await User.deleteMany({});
    await PayrollPeriod.deleteMany({});
    await PublicHoliday.deleteMany({});
    await RateSetting.deleteMany({});
    await TaxBracket.deleteMany({});
    
    console.log('Todas as coleções foram limpas com sucesso.');
    return true;
  } catch (error) {
    console.error('Erro ao limpar coleções:', error);
    return false;
  }
}

// Criar dados iniciais
async function createInitialData() {
  try {
    console.log('\nCriando dados iniciais...');
    
    // Criar usuário padrão
    console.log('Criando usuário padrão...');
    const defaultUser = new User({
      username: 'default_user'
    });
    const savedUser = await defaultUser.save();
    
    // Adicionar períodos de pagamento de 2025
    console.log('Criando períodos de pagamento...');
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
    console.log('Criando feriados públicos...');
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
    console.log('Configurando taxa horária padrão...');
    const defaultRate = new RateSetting({
      hourly_rate: 34,
      effective_from: '2025-01-01',
      user: savedUser._id
    });
    
    await defaultRate.save();
    
    // Inserir faixas de imposto simplificadas
    console.log('Criando tabela de imposto...');
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
    
    console.log('\nBanco de dados inicializado com sucesso!');
    
    // Exibir resumo
    console.log('\nResumo da configuração:');
    console.log(`- 1 usuário padrão criado (ID: ${savedUser._id})`);
    console.log(`- ${payrollPeriods.length} períodos de pagamento criados`);
    console.log(`- ${publicHolidays.length} feriados públicos configurados`);
    console.log(`- ${taxBrackets.length} faixas de imposto definidas`);
    console.log(`- Taxa horária padrão: AUD ${defaultRate.hourly_rate.toFixed(2)}`);
    
    return true;
  } catch (error) {
    console.error('Erro ao criar dados iniciais:', error);
    return false;
  }
}

// Função principal
async function main() {
  console.log('='.repeat(50));
  console.log('LASS Payroll Tracker - Configuração do MongoDB');
  console.log('='.repeat(50));
  
  // Conectar ao banco de dados
  const connected = await connectDB();
  if (!connected) {
    console.error('\nNão foi possível conectar ao MongoDB. Verifique se o MongoDB está em execução e tente novamente.');
    process.exit(1);
  }
  
  // Verificar dados existentes
  const shouldProceed = await checkExistingData();
  if (!shouldProceed) {
    console.log('\nOperação cancelada pelo usuário.');
    await mongoose.connection.close();
    rl.close();
    return;
  }
  
  // Limpar dados existentes
  const cleared = await clearAllCollections();
  if (!cleared) {
    console.error('\nErro ao limpar dados existentes. Operação abortada.');
    await mongoose.connection.close();
    rl.close();
    return;
  }
  
  // Criar novos dados
  const created = await createInitialData();
  if (!created) {
    console.error('\nErro ao criar dados iniciais. O banco de dados pode estar em um estado inconsistente.');
  } else {
    console.log('\nConfiguração concluída com sucesso! O LASS Payroll Tracker está pronto para uso.');
  }
  
  // Fechar conexões
  await mongoose.connection.close();
  rl.close();
}

// Executar script
main();