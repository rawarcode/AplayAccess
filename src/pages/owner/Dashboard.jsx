import React from 'react';
import MainLayout from '../../components/layout/MainLayout';
import StatCard from '../../components/dashboard/StatCard';
import RevenueChart from '../../components/dashboard/RevenueChart';
import RecentBookings from '../../components/dashboard/RecentBookings';
import { dashboardStats, recentBookings, revenueChartData } from '../../data/dashboardData';

const Dashboard = () => {
  return (
    <MainLayout pageTitle="Overview">
      <div className="stats-grid">
        <StatCard
          icon="fas fa-bed"
          iconColor="blue"
          title="Occupancy Rate"
          value={`${dashboardStats.occupancyRate.value}%`}
          change={dashboardStats.occupancyRate.change}
          trend={dashboardStats.occupancyRate.trend}
        />
        <StatCard
          icon="fas fa-chart-line"
          iconColor="green"
          title="Monthly Revenue"
          value={dashboardStats.monthlyRevenue.value}
          change={dashboardStats.monthlyRevenue.change}
          trend={dashboardStats.monthlyRevenue.trend}
        />
        <StatCard
          icon="fas fa-money-bill-wave"
          iconColor="yellow"
          title="Daily Revenue"
          value={dashboardStats.dailyRevenue.value}
          change={dashboardStats.dailyRevenue.change}
          trend={dashboardStats.dailyRevenue.trend}
        />
        <StatCard
          icon="fa-sharp fa-solid fa-money-bill-wave"
          iconColor="purple"
          title="Monthly Transactions"
          value={dashboardStats.monthlyTransactions.value}
          change={dashboardStats.monthlyTransactions.change}
          trend={dashboardStats.monthlyTransactions.trend}
        />
      </div>

      <div className="dashboard-grid">
        <RevenueChart data={revenueChartData} />
        <RecentBookings bookings={recentBookings} />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
