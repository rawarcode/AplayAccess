# Aplaya Beach Resort - Owner Dashboard (Frontend)

A React-based owner dashboard for Aplaya Beach Resort, converted from HTML to React with modern technologies.

## 🚀 Technologies Used

### Frontend
- **React** - Main UI framework
- **Vite** - Build tool and development server
- **React Router** - Navigation between pages
- **Tailwind CSS** - Styling and design
- **Axios** - API calls (ready for Laravel backend)
- **Chart.js & React-Chartjs-2** - Data visualization
- **Font Awesome** - Icons

## 📁 Project Structure

```
src/
├── assets/
│   └── css/
│       └── custom.css          # Custom CSS styles
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx         # Navigation sidebar
│   │   ├── Header.jsx          # Top header with search & notifications
│   │   └── MainLayout.jsx      # Main layout wrapper
│   ├── dashboard/
│   │   ├── StatCard.jsx        # Metric cards (occupancy, revenue, etc.)
│   │   ├── RevenueChart.jsx    # Revenue trend chart
│   │   └── RecentBookings.jsx  # Recent bookings list
│   └── modals/
│       ├── AccountSettingsModal.jsx    # Account settings
│       └── ChangePasswordModal.jsx     # Password change
├── pages/
│   ├── Dashboard.jsx           # Overview page
│   ├── Financials.jsx          # Financial reports page
│   └── Transactions.jsx        # Transaction records page
├── data/
│   ├── dashboardData.js        # Mock data for dashboard
│   ├── financialData.js        # Mock data for financials
│   └── transactionData.js      # Mock data for transactions
├── App.jsx                     # Main app with routing
└── main.jsx                    # Entry point
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Install Dependencies
```bash
cd aplaya-resort-frontend
npm install
```

### Run Development Server
```bash
npm run dev
```

The app will run on `http://localhost:5173`

### Build for Production
```bash
npm run build
```

## 📊 Features

### Dashboard (Overview)
- Occupancy rate statistics
- Monthly and daily revenue metrics
- Monthly transactions count
- Revenue trend chart
- Recent bookings list

### Financials Page
- Revenue summary breakdown
- Expense summary
- Profit summary with margins
- Revenue by category (pie chart)
- Monthly comparison chart (year-over-year)
- Detailed financial records table

### Transactions Page
- Transaction statistics cards
- Search and filter functionality
- Date range filtering
- Transactions table with pagination
- Transaction type distribution chart
- Payment method distribution chart
- Print receipt functionality

### Common Features
- Responsive sidebar navigation
- User notifications dropdown
- User profile dropdown
- Account settings modal
- Change password modal
- Collapsible sidebar

## 🔗 Backend Integration (Ready for Laravel)

The frontend is ready to connect to a Laravel backend. Here's what you need to do:

### 1. Create API Service File

Create `src/services/api.js`:

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

### 2. Replace Mock Data with API Calls

Example for Dashboard:

```javascript
// Instead of importing mock data
import { dashboardStats } from '../data/dashboardData';

// Use API call
import { useState, useEffect } from 'react';
import apiClient from '../services/api';

const [stats, setStats] = useState(null);

useEffect(() => {
  const fetchStats = async () => {
    const response = await apiClient.get('/dashboard/stats');
    setStats(response.data);
  };
  fetchStats();
}, []);
```

### 3. Expected Laravel API Endpoints

```
GET  /api/dashboard/stats          - Dashboard statistics
GET  /api/dashboard/bookings       - Recent bookings
GET  /api/financials/summary       - Financial summary
GET  /api/financials/records       - Financial records
GET  /api/transactions              - Transaction list (with pagination)
GET  /api/transactions/stats       - Transaction statistics
POST /api/user/profile             - Update user profile
POST /api/user/change-password     - Change password
GET  /api/notifications            - User notifications
```

## 🎨 Customization

### Colors
The project uses Tailwind CSS. You can customize colors in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#1e40af', // blue-800
      secondary: '#10b981', // green-500
    }
  }
}
```

### Fonts
Update fonts in `src/index.css`

## 📝 Notes

- All data is currently mock data in the `src/data` folder
- Charts use Chart.js v4
- Icons from Font Awesome 6
- Fully responsive design
- Ready for Laravel backend integration

## 🐛 Known Issues

None at the moment. Please report any issues you find!

## 📄 License

This project is proprietary to Aplaya Beach Resort.
