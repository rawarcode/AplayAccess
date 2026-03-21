import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import StatCard from '../../components/dashboard/StatCard';
import RevenueChart from '../../components/dashboard/RevenueChart';
import RecentBookings from '../../components/dashboard/RecentBookings';
import { getOverview, getRecentBookings } from '../../lib/ownerApi';

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;
};

const calcPctChange = (current, previous) => {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

const mapBooking = (b) => {
  const checkIn  = new Date(b.checkIn);
  const checkOut = new Date(b.checkOut);

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const inDay  = new Date(checkIn);  inDay.setHours(0, 0, 0, 0);
  const outDay = new Date(checkOut); outDay.setHours(0, 0, 0, 0);

  const timeStr = (d) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  let status, statusColor;
  if (inDay.getTime() === today.getTime()) {
    status = `Arriving today at ${timeStr(checkIn)}`;
    statusColor = 'green';
  } else if (inDay.getTime() === tomorrow.getTime()) {
    status = `Arriving tomorrow at ${timeStr(checkIn)}`;
    statusColor = 'blue';
  } else if (outDay.getTime() === today.getTime()) {
    status = `Checking out today at ${timeStr(checkOut)}`;
    statusColor = 'red';
  } else {
    status = b.status;
    statusColor =
      b.status === 'Confirmed' ? 'green' :
      b.status === 'Pending'   ? 'blue'  : 'red';
  }

  return { id: b.booking_id, guestName: b.guest, room: b.roomType, status, statusColor };
};

const Dashboard = () => {
  const [stats,    setStats]    = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overview, recentRaw] = await Promise.all([
          getOverview(),
          getRecentBookings(),
        ]);

        const now        = new Date();
        const dayOfMonth = now.getDate();
        const dailyAvg   = overview.revenue_this_month / Math.max(dayOfMonth, 1);

        const revPct   = calcPctChange(overview.revenue_this_month, overview.revenue_last_month);
        const bookDiff = overview.bookings_this_month - overview.bookings_last_month;

        setStats({
          confirmedBookings: {
            value:  overview.confirmed_bookings,
            change: `${overview.pending_bookings} pending`,
            trend:  'up',
          },
          monthlyRevenue: {
            value:  formatCurrency(overview.revenue_this_month),
            change: revPct !== null
              ? `${revPct >= 0 ? '+' : ''}${revPct}% from last month`
              : 'No data last month',
            trend: revPct === null || revPct >= 0 ? 'up' : 'down',
          },
          dailyRevenue: {
            value:  formatCurrency(Math.round(dailyAvg)),
            change: `avg over ${dayOfMonth} day${dayOfMonth !== 1 ? 's' : ''}`,
            trend:  'up',
          },
          monthlyTransactions: {
            value:  overview.bookings_this_month,
            change: `${bookDiff >= 0 ? '+' : ''}${bookDiff} from last month`,
            trend:  bookDiff >= 0 ? 'up' : 'down',
          },
        });

        setBookings(recentRaw.slice(0, 5).map(mapBooking));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard data. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <MainLayout pageTitle="Overview">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          Loading dashboard data...
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout pageTitle="Overview">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#e53e3e' }}>
          {error}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pageTitle="Overview">
      <div className="stats-grid">
        <StatCard
          icon="fas fa-calendar-check"
          iconColor="blue"
          title="Confirmed Bookings"
          value={stats.confirmedBookings.value}
          change={stats.confirmedBookings.change}
          trend={stats.confirmedBookings.trend}
        />
        <StatCard
          icon="fas fa-chart-line"
          iconColor="green"
          title="Monthly Revenue"
          value={stats.monthlyRevenue.value}
          change={stats.monthlyRevenue.change}
          trend={stats.monthlyRevenue.trend}
        />
        <StatCard
          icon="fas fa-money-bill-wave"
          iconColor="yellow"
          title="Daily Revenue (Avg)"
          value={stats.dailyRevenue.value}
          change={stats.dailyRevenue.change}
          trend={stats.dailyRevenue.trend}
        />
        <StatCard
          icon="fas fa-receipt"
          iconColor="purple"
          title="Monthly Transactions"
          value={stats.monthlyTransactions.value}
          change={stats.monthlyTransactions.change}
          trend={stats.monthlyTransactions.trend}
        />
      </div>

      <div className="dashboard-grid">
        <RevenueChart />
        <RecentBookings bookings={bookings} />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
