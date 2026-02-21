/**
 * Script para configuração inicial do MongoDB para o LASS Payroll Tracker
 *
 * Este script cria o banco de dados e as coleções necessárias com dados iniciais.
 * Execute-o uma vez antes de iniciar o aplicativo pela primeira vez.
 *
 * Uso: node setup-mongodb.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");

// Importar modelos
const User = require("./models/User");
const PayrollPeriod = require("./models/PayrollPeriod");
const PublicHoliday = require("./models/PublicHoliday");
const RateSetting = require("./models/RateSetting");
const TaxBracket = require("./models/TaxBracket");

// URL de conexão MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/lass_payroll";

// Interface de linha de comando para confirmar ações
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Conectar ao MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Conectado ao MongoDB em:", MONGODB_URI);
    return true;
  } catch (error) {
    console.error("Erro ao conectar ao MongoDB:", error.message);
    return false;
  }
}

// Checar se já existem dados no sistema
async function checkExistingData() {
  try {
    const userCount = await User.countDocuments();
    const periodCount = await PayrollPeriod.countDocuments();

    if (userCount > 0 || periodCount > 0) {
      console.log("\nAtenção: Dados já existem no banco de dados!");
      console.log(`- Usuários: ${userCount}`);
      console.log(`- Períodos de Pagamento: ${periodCount}`);

      return new Promise((resolve) => {
        rl.question(
          "\nDeseja limpar todos os dados e recriar? (sim/não): ",
          (answer) => {
            resolve(answer.toLowerCase() === "sim");
          }
        );
      });
    }

    return true;
  } catch (error) {
    console.error("Erro ao verificar dados existentes:", error);
    return false;
  }
}

// Limpar todas as coleções
async function clearAllCollections() {
  try {
    console.log("\nLimpando todas as coleções...");

    await User.deleteMany({});
    await PayrollPeriod.deleteMany({});
    await PublicHoliday.deleteMany({});
    await RateSetting.deleteMany({});
    await TaxBracket.deleteMany({});

    console.log("Todas as coleções foram limpas com sucesso.");
    return true;
  } catch (error) {
    console.error("Erro ao limpar coleções:", error);
    return false;
  }
}

// Criar dados iniciais
async function createInitialData() {
  try {
    console.log("\nCriando dados iniciais...");

    // Criar usuário padrão
    console.log("Criando usuário padrão...");
    const defaultUser = new User({
      username: "default_user",
    });
    const savedUser = await defaultUser.save();

    // Períodos de pagamento 2026 (quinzenal)
    console.log("Criando períodos de pagamento...");
    const payrollPeriods = [
      {
        period_label: "Jan 2026 Payroll",
        start_date: "2025-12-22",
        end_date: "2026-01-23",
        year: 2026,
      },
      {
        period_label: "Feb 2026 Payroll",
        start_date: "2026-01-26",
        end_date: "2026-02-20",
        year: 2026,
      },
      {
        period_label: "Mar 2026 Payroll",
        start_date: "2026-02-23",
        end_date: "2026-03-20",
        year: 2026,
      },
      {
        period_label: "Apr 2026 Payroll",
        start_date: "2026-03-23",
        end_date: "2026-04-17",
        year: 2026,
      },
      {
        period_label: "May 2026 Payroll",
        start_date: "2026-04-20",
        end_date: "2026-05-22",
        year: 2026,
      },
      {
        period_label: "Jun 2026 Payroll",
        start_date: "2026-05-25",
        end_date: "2026-06-19",
        year: 2026,
      },
      {
        period_label: "Jul 2026 Payroll",
        start_date: "2026-06-22",
        end_date: "2026-07-24",
        year: 2026,
      },
      {
        period_label: "Aug 2026 Payroll",
        start_date: "2026-07-27",
        end_date: "2026-08-21",
        year: 2026,
      },
      {
        period_label: "Sep 2026 Payroll",
        start_date: "2026-08-24",
        end_date: "2026-09-18",
        year: 2026,
      },
      {
        period_label: "Oct 2026 Payroll",
        start_date: "2026-09-21",
        end_date: "2026-10-23",
        year: 2026,
      },
      {
        period_label: "Nov 2026 Payroll",
        start_date: "2026-10-26",
        end_date: "2026-11-20",
        year: 2026,
      },
      {
        period_label: "Dec 2026 Payroll",
        start_date: "2026-11-23",
        end_date: "2026-12-18",
        year: 2026,
      },
    ];

    await PayrollPeriod.insertMany(payrollPeriods);

    // Feriados públicos NSW 2026
    // Fonte: https://www.nsw.gov.au/about-nsw/public-holidays
    console.log("Criando feriados públicos NSW...");
    const publicHolidays = [
      {
        holiday_date: "2026-01-01",
        holiday_name: "New Year's Day",
        year: 2026,
      },
      { holiday_date: "2026-01-26", holiday_name: "Australia Day", year: 2026 },
      { holiday_date: "2026-04-03", holiday_name: "Good Friday", year: 2026 },
      {
        holiday_date: "2026-04-04",
        holiday_name: "Easter Saturday",
        year: 2026,
      },
      { holiday_date: "2026-04-05", holiday_name: "Easter Sunday", year: 2026 },
      { holiday_date: "2026-04-06", holiday_name: "Easter Monday", year: 2026 },
      // ANZAC Day cai no sábado (25 Apr) — Premier Chris Minns declarou 27 Apr como feriado adicional
      {
        holiday_date: "2026-04-27",
        holiday_name: "ANZAC Day (Additional Day)",
        year: 2026,
      },
      {
        holiday_date: "2026-06-08",
        holiday_name: "King's Birthday",
        year: 2026,
      },
      { holiday_date: "2026-10-05", holiday_name: "Labour Day", year: 2026 },
      { holiday_date: "2026-12-25", holiday_name: "Christmas Day", year: 2026 },
      // Boxing Day cai no sábado (26 Dec) — feriado substituto na segunda 28 Dec
      {
        holiday_date: "2026-12-28",
        holiday_name: "Boxing Day (Additional Day)",
        year: 2026,
      },
    ];

    await PublicHoliday.insertMany(publicHolidays);

    // Taxa horária padrão: AUD $30.00
    console.log("Configurando taxa horária padrão...");
    const defaultRate = new RateSetting({
      hourly_rate: 30.0,
      effective_from: "2026-01-01",
      user: savedUser._id,
    });

    await defaultRate.save();

    // Tabela de impostos (ATO PAYG NAT 1007 - julho 2024)
    console.log("Criando tabela de imposto...");
    const taxBrackets = [
      { minWeekly: 0, maxWeekly: 359, taxRate: 0, fixedAmount: 0, year: 2026 },
      {
        minWeekly: 360,
        maxWeekly: 438,
        taxRate: 0.19,
        fixedAmount: 0,
        year: 2026,
      },
      {
        minWeekly: 439,
        maxWeekly: 548,
        taxRate: 0.19,
        fixedAmount: 3,
        year: 2026,
      },
      {
        minWeekly: 549,
        maxWeekly: 721,
        taxRate: 0.19,
        fixedAmount: 16,
        year: 2026,
      },
      {
        minWeekly: 722,
        maxWeekly: 865,
        taxRate: 0.325,
        fixedAmount: 44,
        year: 2026,
      },
      {
        minWeekly: 866,
        maxWeekly: 1282,
        taxRate: 0.325,
        fixedAmount: 55,
        year: 2026,
      },
      {
        minWeekly: 1283,
        maxWeekly: 1538,
        taxRate: 0.325,
        fixedAmount: 57,
        year: 2026,
      },
      {
        minWeekly: 1539,
        maxWeekly: 1923,
        taxRate: 0.37,
        fixedAmount: 127,
        year: 2026,
      },
      {
        minWeekly: 1924,
        maxWeekly: 3461,
        taxRate: 0.37,
        fixedAmount: 152,
        year: 2026,
      },
      {
        minWeekly: 3462,
        maxWeekly: 9999,
        taxRate: 0.45,
        fixedAmount: 430,
        year: 2026,
      },
    ];

    await TaxBracket.insertMany(taxBrackets);

    console.log("\nBanco de dados inicializado com sucesso!");

    // Resumo
    console.log("\nResumo da configuração:");
    console.log(`- 1 usuário padrão criado (ID: ${savedUser._id})`);
    console.log(
      `- ${payrollPeriods.length} períodos de pagamento criados (2026)`
    );
    console.log(
      `- ${publicHolidays.length} feriados públicos NSW configurados (2026)`
    );
    console.log(
      `- ${taxBrackets.length} faixas de imposto definidas (ATO NAT 1007)`
    );
    console.log(
      `- Taxa horária padrão: AUD $${defaultRate.hourly_rate.toFixed(2)}`
    );

    return true;
  } catch (error) {
    console.error("Erro ao criar dados iniciais:", error);
    return false;
  }
}

// Função principal
async function main() {
  console.log("=".repeat(50));
  console.log("LASS Payroll Tracker - Configuração do MongoDB");
  console.log("=".repeat(50));

  // Conectar ao banco de dados
  const connected = await connectDB();
  if (!connected) {
    console.error(
      "\nNão foi possível conectar ao MongoDB. Verifique se o MongoDB está em execução e tente novamente."
    );
    process.exit(1);
  }

  // Verificar dados existentes
  const shouldProceed = await checkExistingData();
  if (!shouldProceed) {
    console.log("\nOperação cancelada pelo usuário.");
    await mongoose.connection.close();
    rl.close();
    return;
  }

  // Limpar dados existentes
  const cleared = await clearAllCollections();
  if (!cleared) {
    console.error("\nErro ao limpar dados existentes. Operação abortada.");
    await mongoose.connection.close();
    rl.close();
    return;
  }

  // Criar novos dados
  const created = await createInitialData();
  if (!created) {
    console.error(
      "\nErro ao criar dados iniciais. O banco de dados pode estar em um estado inconsistente."
    );
  } else {
    console.log(
      "\nConfiguração concluída com sucesso! O LASS Payroll Tracker está pronto para uso."
    );
  }

  // Fechar conexões
  await mongoose.connection.close();
  rl.close();
}

// Executar script
main();
