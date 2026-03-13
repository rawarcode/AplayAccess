export const transactionStats = {
  totalTransactions: 1248,
  totalRevenue: "₱1.25M",
  avgTransaction: "₱1,002",
  trends: {
    transactions: "+18% from last month",
    revenue: "+15% from last month",
    average: "-3% from last month"
  }
};

export const transactions = [
  {
    id: "TRX-10001",
    date: "Jun 15, 2023 14:30",
    guest: "Robert Chen",
    type: "Room Booking",
    paymentMethod: "Credit Card",
    amount: "₱25,000",
    status: "Completed"
  },
  {
    id: "TRX-10002",
    date: "Jun 14, 2023 18:45",
    guest: "Maria Garcia",
    type: "Restaurant",
    paymentMethod: "Cash",
    amount: "₱3,250",
    status: "Completed"
  },
  {
    id: "TRX-10003",
    date: "Jun 14, 2023 11:20",
    guest: "James Wilson",
    type: "Spa Services",
    paymentMethod: "Gcash",
    amount: "₱5,800",
    status: "Completed"
  },
  {
    id: "TRX-10004",
    date: "Jun 13, 2023 09:15",
    guest: "Lisa Thompson",
    type: "Activity Booking",
    paymentMethod: "Bank Transfer",
    amount: "₱7,500",
    status: "Pending"
  },
  {
    id: "TRX-10005",
    date: "Jun 12, 2023 16:30",
    guest: "David Miller",
    type: "Gift Shop",
    paymentMethod: "Credit Card",
    amount: "₱2,450",
    status: "Completed"
  },
  {
    id: "TRX-10006",
    date: "Jun 12, 2023 10:15",
    guest: "Sarah Johnson",
    type: "Room Booking",
    paymentMethod: "Credit Card",
    amount: "₱30,000",
    status: "Completed"
  },
  {
    id: "TRX-10007",
    date: "Jun 11, 2023 19:20",
    guest: "Michael Brown",
    type: "Restaurant",
    paymentMethod: "Gcash",
    amount: "₱4,800",
    status: "Completed"
  },
  {
    id: "TRX-10008",
    date: "Jun 11, 2023 14:00",
    guest: "Emily Davis",
    type: "Spa Services",
    paymentMethod: "Cash",
    amount: "₱6,200",
    status: "Completed"
  }
];

export const transactionTypeData = {
  labels: ['Room Booking', 'Restaurant', 'Spa Services', 'Activities', 'Gift Shop'],
  datasets: [
    {
      data: [45, 25, 15, 10, 5],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ]
    }
  ]
};

export const paymentMethodData = {
  labels: ['Credit Card', 'Cash', 'Gcash', 'Bank Transfer'],
  datasets: [
    {
      data: [50, 25, 15, 10],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(139, 92, 246, 0.8)'
      ]
    }
  ]
};
