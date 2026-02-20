LASS Payroll Tracker com MongoDB
Esta aplicação é um rastreador de horas de trabalho e cálculo de salário para a Land Air Sea Space (LASS). A aplicação foi desenvolvida usando React para o frontend e Node.js com MongoDB para o backend, com funcionalidade de operação offline.

Características
Rastreamento de horas de trabalho por dia
Cálculo de salário baseado em períodos de pagamento
Suporte a feriados e finais de semana
Operação offline com sincronização automática
Persistência de dados com MongoDB
Backup local para garantir disponibilidade dos dados
Estrutura do Projeto
lass-payroll-tracker/
├── api/                         # Backend Node.js
│   ├── config/                  # Configurações
│   │   └── db.js                # Configuração do MongoDB
│   ├── models/                  # Modelos Mongoose
│   │   ├── User.js
│   │   ├── WorkHour.js
│   │   ├── PayrollPeriod.js
│   │   ├── PublicHoliday.js
│   │   ├── RateSetting.js
│   │   └── TaxBracket.js
│   ├── .env                     # Variáveis de ambiente
│   ├── server.js                # Servidor Express
│   └── package.json
├── public/                      # Arquivos estáticos
├── src/                         # Frontend React
│   ├── components/
│   │   ├── PayrollTracker.jsx   # Componente principal
│   │   └── OfflineManager.js    # Gerenciador de modo offline
│   ├── services/
│   │   ├── api.js               # Serviço de API
│   │   └── syncService.js       # Serviço de sincronização
│   ├── App.js
│   └── index.js
└── package.json
Pré-requisitos
Node.js (v14+)
MongoDB (v4.4+)
NPM ou Yarn
Configuração
Clone o repositório
git clone https://github.com/seu-usuario/lass-payroll-tracker.git
cd lass-payroll-tracker
Instale as dependências do frontend
npm install
Instale as dependências do backend
cd api
npm install
Configure o banco de dados MongoDB
Certifique-se de que o MongoDB está instalado e em execução
Crie um banco de dados chamado lass_payroll
Ajuste o arquivo .env na pasta api conforme necessário:
PORT=3003
MONGODB_URI=mongodb://localhost:27017/lass_payroll
NODE_ENV=development
Execução
Inicie o servidor backend
cd api
npm start
O servidor será iniciado na porta 3003 (ou na porta definida no arquivo .env)
Inicie o aplicativo frontend (em outro terminal)
cd lass-payroll-tracker
npm start
O aplicativo será aberto em http://localhost:3000
Funcionalidade Offline
O aplicativo foi projetado para funcionar mesmo sem conexão com o servidor:

Todos os dados são salvos localmente no navegador via localStorage
As alterações feitas offline são enfileiradas para sincronização posterior
Quando a conexão for restaurada, os dados serão sincronizados automaticamente
Uma indicação visual mostra o status da conexão e se há dados pendentes de sincronização
Cálculo de Salário
O sistema calcula:

Horas trabalhadas por dia/semana/período
Salário bruto baseado na taxa horária (AUD $32.00 por padrão)
Imposto PAYG (Pay As You Go) de acordo com a tabela da ATO australiana
Salário líquido após impostos
Desenvolvimento
Para facilitar o desenvolvimento:

Use npm run dev na pasta api para iniciar o servidor com hot-reload:
cd api
npm run dev
O projeto usa ESLint e Prettier para manter a qualidade do código. Execute:
npm run lint
Tecnologias Utilizadas
Frontend: React, Axios, Tailwind CSS
Backend: Node.js, Express, Mongoose
Banco de Dados: MongoDB
Sincronização Offline: LocalStorage, Queue System
