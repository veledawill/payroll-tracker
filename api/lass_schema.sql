-- Esquema SQLite para LASS Payroll Tracker
-- Salve este arquivo como lass_schema.sql

-- Criação das tabelas
-- Tabela de Usuários (para expansão futura)
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Períodos de Pagamento (baseada no seu array payrollPeriods)
CREATE TABLE payroll_periods (
    period_id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_label TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    year INTEGER NOT NULL
);

-- Tabela de Feriados Públicos (baseada no seu array publicHolidays)
CREATE TABLE public_holidays (
    holiday_id INTEGER PRIMARY KEY AUTOINCREMENT,
    holiday_date TEXT NOT NULL,
    holiday_name TEXT,
    year INTEGER NOT NULL
);

-- Tabela principal para armazenar as horas trabalhadas
CREATE TABLE work_hours (
    work_hours_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    hours_worked REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE (user_id, work_date)
);

-- Tabela para configurações padrão de horas por dia da semana
CREATE TABLE standard_hours (
    standard_hours_id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    hours REAL NOT NULL DEFAULT 0,
    UNIQUE (day_of_week)
);

-- Tabela para armazenar a taxa horária
CREATE TABLE rate_settings (
    rate_id INTEGER PRIMARY KEY AUTOINCREMENT,
    hourly_rate REAL NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Tabela para faixas de imposto simplificadas
CREATE TABLE tax_brackets (
    bracket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    earnings REAL NOT NULL,
    with_tax REAL NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT
);

-- Adicionar triggers para atualizar o campo updated_at automaticamente
CREATE TRIGGER update_work_hours_timestamp 
AFTER UPDATE ON work_hours
BEGIN
    UPDATE work_hours SET updated_at = CURRENT_TIMESTAMP WHERE work_hours_id = NEW.work_hours_id;
END;

-- Inserir dados iniciais para um usuário padrão
INSERT INTO users (username) VALUES ('default_user');

-- Inserir períodos de pagamento de 2025 (baseados no seu código)
INSERT INTO payroll_periods (period_label, start_date, end_date, year) VALUES
('Jan 2025 Payroll', '2024-12-23', '2025-01-24', 2025),
('Feb 2025 Payroll', '2025-01-27', '2025-02-21', 2025),
('Mar 2025 Payroll', '2025-02-24', '2025-03-21', 2025),
('Apr 2025 Payroll', '2025-03-24', '2025-04-18', 2025),
('May 2025 Payroll', '2025-04-21', '2025-05-23', 2025),
('Jun 2025 Payroll', '2025-05-26', '2025-06-20', 2025),
('Jul 2025 Payroll', '2025-06-23', '2025-07-25', 2025),
('Aug 2025 Payroll', '2025-07-28', '2025-08-22', 2025),
('Sep 2025 Payroll', '2025-08-25', '2025-09-19', 2025),
('Oct 2025 Payroll', '2025-09-22', '2025-10-24', 2025),
('Nov 2025 Payroll', '2025-10-27', '2025-11-21', 2025),
('Dec 2025 Payroll', '2025-11-24', '2025-12-19', 2025);

-- Inserir feriados públicos de 2025 da Austrália (baseados no seu código)
INSERT INTO public_holidays (holiday_date, holiday_name, year) VALUES
('2025-01-01', 'New Year''s Day', 2025),
('2025-01-27', 'Australia Day', 2025),
('2025-04-18', 'Good Friday', 2025),
('2025-04-25', 'ANZAC Day', 2025),
('2025-10-06', 'Labour Day', 2025),
('2025-12-25', 'Christmas Day', 2025),
('2025-12-26', 'Boxing Day', 2025);

-- Inserir configurações padrão de horas por dia da semana (baseadas no seu STANDARD_HOURS_BY_DAY)
INSERT INTO standard_hours (day_of_week, hours) VALUES
(0, 0),  -- Sunday
(1, 10), -- Monday
(2, 4.5), -- Tuesday
(3, 8),  -- Wednesday
(4, 10), -- Thursday
(5, 4.5), -- Friday
(6, 0);  -- Saturday

-- Definir a taxa horária padrão
INSERT INTO rate_settings (hourly_rate, effective_from, user_id) 
VALUES (34.00, '2025-01-01', 1);

-- Inserir apenas algumas faixas de imposto para exemplo (baseadas no seu taxTableSimplified)
INSERT INTO tax_brackets (earnings, with_tax, effective_from) VALUES
(0, 0, '2025-01-01'),
(1576.00, 0, '2025-01-01'),
(1577.33, 4.00, '2025-01-01'),
(1603.33, 9.00, '2025-01-01'),
(1633.67, 13.00, '2025-01-01'),
(2000.00, 87.00, '2025-01-01'),
(3000.00, 312.00, '2025-01-01'),
(4000.00, 572.00, '2025-01-01'),
(5000.00, 823.00, '2025-01-01'),
(6000.00, 1057.00, '2025-01-01'),
(8000.00, 1564.00, '2025-01-01'),
(10000.00, 2396.00, '2025-01-01'),
(12000.00, 3072.00, '2025-01-01'),
(12675.00, 3393.00, '2025-01-01');

-- Criar índices para melhorar o desempenho das consultas
CREATE INDEX idx_work_hours_user_date ON work_hours(user_id, work_date);
CREATE INDEX idx_work_hours_date ON work_hours(work_date);
CREATE INDEX idx_payroll_periods_dates ON payroll_periods(start_date, end_date);
CREATE INDEX idx_tax_brackets_earnings ON tax_brackets(earnings);