export const dashboardStats = {
  occupancyRate: {
    value: 82,
    change: "+5% from last month",
    trend: "up"
  },
  monthlyRevenue: {
    value: "₱1,250,000",
    change: "15% from last month",
    trend: "up"
  },
  dailyRevenue: {
    value: "₱42,500",
    change: "+12% from average",
    trend: "up"
  },
  monthlyTransactions: {
    value: 57,
    change: "+5 transactions",
    trend: "up"
  }
};

export const recentBookings = [
  {
    id: 1,
    guestName: "Robert Chen",
    room: "Beach Villa #5",
    status: "Arriving today at 2:00 PM",
    statusColor: "green"
  },
  {
    id: 2,
    guestName: "Maria Garcia",
    room: "Ocean Suite #12",
    status: "Arriving tomorrow at 3:30 PM",
    statusColor: "blue"
  },
  {
    id: 3,
    guestName: "James Wilson",
    room: "Garden Bungalow #8",
    status: "Checking out today at 11:00 AM",
    statusColor: "red"
  }
];

export const revenueChartData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Revenue',
      data: [850000, 920000, 1050000, 1100000, 1150000, 1200000, 1280000, 1300000, 1320000, 1380000, 1420000, 1500000],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: false,
      pointBackgroundColor: 'rgb(59, 130, 246)',
      pointBorderColor: 'rgb(59, 130, 246)',
      pointRadius: 4
    }
  ]
};

export const notifications = [
  {
    id: 1,
    message: "New reservation #4567",
    time: "2 mins ago"
  },
  {
    id: 2,
    message: "Room 205 check-out reminder",
    time: "1 hour ago"
  },
  {
    id: 3,
    message: "Maintenance request for pool",
    time: "3 hours ago"
  }
];
