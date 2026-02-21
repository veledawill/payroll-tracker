
# Payroll Tracker 2026

A full-stack payroll tracking application built with  **React** ,  **Node.js** ,  **Express** , and  **MongoDB** . Designed to track working hours, calculate gross/net salary with Australian PAYG tax, and operate seamlessly even without an internet connection.

---

## 🚀 Tech Stack

| Layer            | Technology                         |
| ---------------- | ---------------------------------- |
| Frontend         | React 18, Tailwind CSS, Axios      |
| Backend          | Node.js, Express.js                |
| Database         | MongoDB + Mongoose                 |
| State Management | React Hooks (useState, useEffect)  |
| Offline Support  | localStorage + custom sync queue   |
| Icons            | Lucide React                       |
| Tooling          | ESLint, Prettier, Create React App |

---

## ✨ Features

* **Hour Tracking** — Log daily work hours with clock-in times across fortnightly pay periods
* **Salary Calculation** — Automatic gross/net salary based on hourly rate (AUD $30/h)
* **PAYG Tax Engine** — Implements the ATO NAT 1007 tax table (July 2024) for accurate withholding
* **Weekly Breakdown** — Summary per week including total hours and net pay
* **Public Holidays** — Highlights public holidays with a visual indicator
* **Offline-First** — All data saved locally via `localStorage`; changes sync automatically when reconnected
* **REST API** — Full backend with Express + MongoDB for persistent cloud storage
* **Responsive UI** — Clean dark-mode interface that works on desktop and mobile

---

## 📁 Project Structure

```
payroll-tracker/
├── api/                         # Node.js Backend
│   ├── config/
│   │   └── db.js                # MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   ├── WorkHour.js
│   │   ├── PayrollPeriod.js
│   │   ├── PublicHoliday.js
│   │   ├── RateSetting.js
│   │   └── TaxBracket.js
│   ├── server.js                # Express server & routes
│   ├── .env
│   └── package.json
├── public/
├── src/
│   ├── components/
│   │   ├── PayrollTracker.jsx   # Main component
│   │   └── OfflineManager.js   # Offline sync manager
│   ├── services/
│   │   ├── api.js               # Axios API service
│   │   └── syncService.js       # Offline queue & sync logic
│   ├── App.js
│   └── index.js
├── vercel.json                  # Vercel deployment config
└── package.json
```

---

## ⚙️ Getting Started

### Prerequisites

* Node.js v14+
* MongoDB v4.4+
* npm or Yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/payroll-tracker.git
cd payroll-tracker

# Install frontend dependencies
npm install

# Install backend dependencies
cd api && npm install
```

### Environment Setup

Create a `.env` file inside the `api/` folder:

```env
PORT=3003
MONGODB_URI=mongodb://localhost:27017/payroll_tracker
NODE_ENV=development
```

### Running Locally

```bash
# Start the backend (from /api)
npm run dev

# Start the frontend (from root, in a separate terminal)
npm start
```

Frontend runs at `http://localhost:3000` — Backend at `http://localhost:3003`.

---

## 🌐 Deploying to Vercel

> Vercel deployment configuration coming soon. When deploying, set your environment variables (`MONGODB_URI`, `REACT_APP_API_URL`, `NODE_ENV=production`) in the Vercel dashboard under  **Project → Settings → Environment Variables** .

---

## 🧮 How Salary Calculation Works

1. Hours entered per day are multiplied by the hourly rate (AUD $30/h)
2. Gross weekly salary is computed
3. PAYG tax is looked up from the ATO NAT 1007 fortnightly table
4. Net salary = Gross − Tax

---

## 💡 Use Cases

This app is ideal for:

* **Contractors and casuals** who need to track hours across pay periods
* **Freelancers** working in Australia who want accurate PAYG estimates before their tax return
* **Small businesses** wanting a lightweight, self-hosted payroll preview tool
* **Anyone** who prefers a transparent, offline-capable alternative to spreadsheets

---

## 👨‍💻 Author

Developed by **William Veleda** — [veleda.will@gmail.com](mailto:veleda.will@gmail.com)

---

## 📄 License

MIT — free to use, modify, and distribute.
