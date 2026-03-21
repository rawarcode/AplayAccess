export const financialSummary = {
  revenue: {
    roomRevenue: "₱850,000",
    foodBeverage: "₱220,000",
    activities: "₱95,000",
    otherServices: "₱85,000",
    total: "₱1,250,000"
  },
  expenses: {
    payroll: "₱420,000",
    foodSupplies: "₱180,000",
    utilities: "₱75,000",
    maintenance: "₱45,000",
    total: "₱720,000"
  },
  profit: {
    gross: "₱530,000",
    net: "₱425,000",
    margin: "34%"
  }
};

export const financialRecords = [
  {
    id: 1,
    date: "Jun 15, 2023",
    type: "Revenue",
    description: "Room Booking - Villa #3",
    amount: "₱25,000",
    balance: "₱1,250,000"
  },
  {
    id: 2,
    date: "Jun 14, 2023",
    type: "Expense",
    description: "Food Supplies",
    amount: "-₱45,000",
    balance: "₱1,225,000"
  },
  {
    id: 3,
    date: "Jun 14, 2023",
    type: "Revenue",
    description: "Spa Services",
    amount: "₱32,000",
    balance: "₱1,270,000"
  },
  {
    id: 4,
    date: "Jun 13, 2023",
    type: "Expense",
    description: "Staff Salaries",
    amount: "-₱420,000",
    balance: "₱1,238,000"
  },
  {
    id: 5,
    date: "Jun 12, 2023",
    type: "Revenue",
    description: "Restaurant Sales",
    amount: "₱78,500",
    balance: "₱1,658,000"
  }
];

export const revenueCategoryData = {
  labels: ['Room Revenue', 'F&B', 'Activities', 'Other Services'],
  datasets: [
    {
      data: [850000, 220000, 95000, 85000],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(139, 92, 246, 0.8)'
      ]
    }
  ]
};

export const comparisonData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    {
      label: '2023',
      data: [850000, 920000, 1100000, 1050000, 1180000, 1250000],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)'
    },
    {
      label: '2022',
      data: [720000, 780000, 950000, 900000, 1020000, 1100000],
      borderColor: 'rgb(107, 114, 128)',
      backgroundColor: 'rgba(107, 114, 128, 0.1)'
    }
  ]
};
