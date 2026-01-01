# QM Finance Frontend

School Financial Management System - Electron/React Frontend

## Features

- 📊 Dashboard with daily/monthly summaries
- 💰 Income management with receipt generation
- 💸 Expense tracking
- 👨‍🎓 Student fee management with balance tracking
- 📄 PDF report generation
- 🖨️ Thermal printer support for receipts
- 🔐 Role-based access (Director, Bursar, Admin)

## Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (see qm-finance-backend)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` to point to your backend:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Run Development Server

**Web only:**
```bash
npm run dev
```

**With Electron (Desktop App):**
```bash
npm run electron:dev
```

### 4. Build for Production

**Web build:**
```bash
npm run build
```

**Desktop app (Windows):**
```bash
npm run electron:build:win
```

**Desktop app (Mac):**
```bash
npm run electron:build:mac
```

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── main.js          # Main entry point
│   └── database.js      # SQLite for offline (legacy)
├── renderer/            # React frontend
│   ├── App.jsx          # Main app component
│   ├── api.js           # API client for backend
│   ├── components/      # Reusable components
│   │   └── FeePaymentForm.jsx
│   ├── index.jsx        # React entry
│   └── index.css        # Tailwind styles
├── preload.js           # Electron preload script
public/
├── icon.png             # App icon
└── electron.js          # Electron bootstrap
```

## Connecting to Backend

The frontend uses the API client in `src/renderer/api.js` to communicate with the backend.

Make sure:
1. Backend is running on `http://localhost:5000`
2. `.env` has correct `VITE_API_URL`
3. CORS is enabled in backend for your frontend URL

## Default Users

After backend seeding:

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Super Admin |
| shadia | shadia123 | Bursar |
| princess | james123 | Director |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run electron:dev` | Run with Electron |
| `npm run electron:build:win` | Build Windows app |
| `npm run electron:build:mac` | Build Mac app |

## License

MIT
