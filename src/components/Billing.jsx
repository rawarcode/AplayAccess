import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './Layout/Sidebar';

const BILLING_STORAGE_KEY = 'fd_billing_guest_data_v1';

function parseCurrency(value) {
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0;
}

function formatCurrency(value) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

const Billing = () => {
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');

  const initialGuestData = {
    'Robert Chen': {
      room: '305',
      dates: 'Jun 12 - Jun 18, 2023',
      reservationId: '#4567',
      roomType: 'Deluxe Ocean View',
      items: [
        { date: 'Jun 12', description: 'Room Charge (1 night)', amount: '₱245.00' },
        { date: 'Jun 12', description: 'Beach Cabana Rental', amount: '₱75.00' },
        { date: 'Jun 13', description: 'Room Charge (1 night)', amount: '₱245.00' },
        { date: 'Jun 13', description: 'Spa Service', amount: '₱120.00' },
        { date: 'Jun 13', description: 'Restaurant Charges', amount: '₱86.50' }
      ],
      subtotal: '₱771.50',
      tax: '₱92.58',
      total: '₱864.08',
      payments: [
        { date: 'Jun 12, 2023', amount: '₱500.00', method: 'Credit Card (ending in 3456)' },
        { date: 'Jun 13, 2023', amount: '₱364.08', method: 'Credit Card (ending in 3456)' }
      ]
    },
    'Maria Garcia': {
      room: '412',
      dates: 'Jun 12 - Jun 15, 2023',
      reservationId: '#4566',
      roomType: 'Family Suite',
      items: [
        { date: 'Jun 12', description: 'Room Charge (1 night)', amount: '₱350.00' },
        { date: 'Jun 12', description: 'Dinner for 4', amount: '₱220.50' },
        { date: 'Jun 13', description: 'Room Charge (1 night)', amount: '₱350.00' },
        { date: 'Jun 13', description: 'Spa Package', amount: '₱250.00' },
        { date: 'Jun 14', description: 'Room Charge (1 night)', amount: '₱350.00' }
      ],
      subtotal: '₱1,112.50',
      tax: '₱133.50',
      total: '₱1,245.50',
      payments: [
        { date: 'Jun 12, 2023', amount: '₱500.00', method: 'Cash' },
        { date: 'Jun 14, 2023', amount: '₱500.00', method: 'Debit Card (ending in 7890)' }
      ]
    },
    'James Wilson': {
      room: '208',
      dates: 'Jun 12 - Jun 14, 2023',
      reservationId: '#4565',
      roomType: 'Standard Garden View',
      items: [
        { date: 'Jun 12', description: 'Room Charge (1 night)', amount: '₱180.00' },
        { date: 'Jun 13', description: 'Room Charge (1 night)', amount: '₱180.00' }
      ],
      subtotal: '₱360.00',
      tax: '₱43.20',
      total: '₱403.20',
      payments: [
        { date: 'Jun 12, 2023', amount: '₱200.00', method: 'Cash' }
      ]
    },
    'Lisa Thompson': {
      room: '207',
      dates: 'Jun 12 - Jun 14, 2023',
      reservationId: '#4564',
      roomType: 'Standard Garden View',
      items: [
        { date: 'Jun 12', description: 'Room Charge (1 night)', amount: '₱180.00' },
        { date: 'Jun 12', description: 'Pool Bar', amount: '₱42.50' },
        { date: 'Jun 13', description: 'Room Charge (1 night)', amount: '₱180.00' },
        { date: 'Jun 13', description: 'Massage', amount: '₱120.00' },
        { date: 'Jun 13', description: 'Dinner', amount: '₱85.80' }
      ],
      subtotal: '₱608.30',
      tax: '₱73.00',
      total: '₱681.30',
      payments: []
    }
  };

  const [guestData, setGuestData] = useState(() => {
    try {
      const raw = localStorage.getItem(BILLING_STORAGE_KEY);
      if (!raw) return initialGuestData;
      return JSON.parse(raw);
    } catch {
      return initialGuestData;
    }
  });

  useEffect(() => {
    localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(guestData));
  }, [guestData]);

  const guests = useMemo(() => {
    return Object.entries(guestData).map(([name, data], index) => {
      const totalDue = parseCurrency(data.total);
      const paid = (data.payments || []).reduce((sum, p) => sum + parseCurrency(p.amount), 0);
      const balance = Math.max(totalDue - paid, 0);
      const status = balance === 0 ? 'Checked Out' : paid > 0 ? 'Checked In' : 'Pending Payment';

      return {
        id: index + 1,
        name,
        reservationId: data.reservationId,
        room: `${data.room} - ${data.roomType}`,
        dates: data.dates,
        status,
        balance: formatCurrency(balance)
      };
    });
  }, [guestData]);

  const selectGuest = (guest) => {
    setSelectedGuest(guest);
    setShowBillDetails(true);
  };

  const backToGuestList = () => {
    setShowBillDetails(false);
    setSelectedGuest(null);
  };

  const processPayment = () => {
    if (!selectedGuest) {
      alert('Please select a guest first');
      return;
    }

    const amount = document.getElementById('paymentAmount')?.value;
    const numericAmount = Number(amount);

    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      alert('Please enter a payment amount');
      return;
    }

    const selected = guestData[selectedGuest];
    const totalDue = parseCurrency(selected.total);
    const alreadyPaid = (selected.payments || []).reduce((sum, p) => sum + parseCurrency(p.amount), 0);
    const remaining = Math.max(totalDue - alreadyPaid, 0);

    if (numericAmount > remaining) {
      alert(`Amount exceeds remaining balance (${formatCurrency(remaining)})`);
      return;
    }

    const paymentEntry = {
      date: new Date().toLocaleDateString(),
      amount: formatCurrency(numericAmount),
      method: paymentMethod
    };

    setGuestData((prev) => ({
      ...prev,
      [selectedGuest]: {
        ...prev[selectedGuest],
        payments: [...(prev[selectedGuest].payments || []), paymentEntry]
      }
    }));

    alert(`Processed ${formatCurrency(numericAmount)} payment via ${paymentMethod}`);
  };

  const getRemainingBalance = (guestName) => {
    const data = guestData[guestName];
    if (!data) return 0;
    const totalDue = parseCurrency(data.total);
    const paid = (data.payments || []).reduce((sum, p) => sum + parseCurrency(p.amount), 0);
    return Math.max(totalDue - paid, 0);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Checked In': return 'bg-blue-100 text-blue-800';
      case 'Checked Out': return 'bg-green-100 text-green-800';
      case 'Pending Payment': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Sidebar>
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Billing</h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Guest List View */}
          {!showBillDetails && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Guests with Outstanding Bills</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 guest-list">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in/Check-out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {guests.map((guest) => (
                      <tr 
                        key={guest.id} 
                        onClick={() => selectGuest(guest.name)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{guest.name}</div>
                          <div className="text-sm text-gray-500">{guest.reservationId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{guest.room}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{guest.dates}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(guest.status)}`}>
                            {guest.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">{guest.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bill Details View */}
          {showBillDetails && selectedGuest && (
            <div className="bill-details active">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Billing Details</h2>
                  <button onClick={backToGuestList} className="text-blue-600 hover:text-blue-800 flex items-center">
                    <i className="fas fa-arrow-left mr-2"></i> Back to Guest List
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                  <div className="lg:col-span-2 p-6">
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Guest Information</h3>
                        <span className="text-sm text-gray-600">Room {guestData[selectedGuest].room}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Guest Name</p>
                          <p className="font-medium">{selectedGuest}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Check-in/Check-out</p>
                          <p className="font-medium">{guestData[selectedGuest].dates}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Reservation ID</p>
                          <p className="font-medium">{guestData[selectedGuest].reservationId}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Room Type</p>
                          <p className="font-medium">{guestData[selectedGuest].roomType}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium mb-3">Current Charges</h3>
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left text-sm font-medium text-gray-700 pb-2">Date</th>
                            <th className="text-left text-sm font-medium text-gray-700 pb-2">Description</th>
                            <th className="text-right text-sm font-medium text-gray-700 pb-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guestData[selectedGuest].items.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-3 text-sm">{item.date}</td>
                              <td className="py-3 text-sm">{item.description}</td>
                              <td className="py-3 text-sm text-right">{item.amount}</td>
                            </tr>
                          ))}
                          <tr>
                            <td className="py-3 text-sm font-medium" colSpan="2">Subtotal</td>
                            <td className="py-3 text-sm text-right font-medium">{guestData[selectedGuest].subtotal}</td>
                          </tr>
                          <tr>
                            <td className="py-3 text-sm font-medium" colSpan="2">Tax (12%)</td>
                            <td className="py-3 text-sm text-right font-medium">{guestData[selectedGuest].tax}</td>
                          </tr>
                          <tr className="border-t-2 border-gray-300">
                            <td className="py-3 text-lg font-bold" colSpan="2">Total Due</td>
                            <td className="py-3 text-lg text-right font-bold">{guestData[selectedGuest].total}</td>
                          </tr>
                          <tr>
                            <td className="py-3 text-sm font-medium" colSpan="2">Remaining Balance</td>
                            <td className="py-3 text-sm text-right font-medium">{formatCurrency(getRemainingBalance(selectedGuest))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="payment-section p-6 bg-gray-50">
                    <div className="mb-6">
                      <h3 className="font-medium mb-3">Payment</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                          <select 
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option>Credit Card</option>
                            <option>Debit Card</option>
                            <option>Cash</option>
                            <option>Bank Transfer</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                          <input 
                            type="text" 
                            id="paymentAmount" 
                            defaultValue={String(getRemainingBalance(selectedGuest))} 
                            className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        {(paymentMethod === 'Credit Card' || paymentMethod === 'Debit Card') && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                              <input type="text" placeholder="1234 5678 9012 3456" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                <input type="text" placeholder="MM/YY" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                                <input type="text" placeholder="123" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                              </div>
                            </div>
                          </div>
                        )}
                        <button onClick={processPayment} className="bg-green-600 text-white px-4 py-2 rounded w-full hover:bg-green-700 transition flex items-center justify-center">
                          <i className="fas fa-credit-card mr-2"></i> Process Payment
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-3">Payment History</h3>
                      <div className="space-y-3">
                        {guestData[selectedGuest].payments.length === 0 ? (
                          <div className="text-sm text-gray-500 italic">No payments recorded yet</div>
                        ) : (
                          guestData[selectedGuest].payments.map((payment, index) => (
                            <div key={index} className="border-b pb-2">
                              <div className="flex justify-between">
                                <span className="text-sm font-medium">{payment.date}</span>
                                <span className="text-sm font-medium">{payment.amount}</span>
                              </div>
                              <p className="text-xs text-gray-600">{payment.method}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </Sidebar>
  );
};

export default Billing;