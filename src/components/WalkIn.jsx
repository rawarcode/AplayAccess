import React, { useState } from 'react';
import Sidebar from './Layout/Sidebar';
import { addReservationFromWalkin, addWalkin, getWalkins, updateWalkin } from '../utils/appData';

const WalkIn = () => {
  const [modalState, setModalState] = useState({
    newWalkin: false,
    checkin: false,
    checkout: false,
    noshow: false
  });
  const [showManualCheckin, setShowManualCheckin] = useState(false);
  const [activeActions, setActiveActions] = useState(null);
  const [walkins, setWalkins] = useState(() => getWalkins());

  const openModal = (modalName) => {
    setModalState({ ...modalState, [modalName]: true });
  };

  const closeModal = (modalName) => {
    setModalState({ ...modalState, [modalName]: false });
    setShowManualCheckin(false);
  };

  const toggleActions = (actionId) => {
    setActiveActions(activeActions === actionId ? null : actionId);
  };

  const createWalkin = () => {
    const firstName = document.getElementById('walkinFirstName')?.value;
    const lastName = document.getElementById('walkinLastName')?.value;
    const phone = document.getElementById('walkinPhone')?.value;
    const checkin = document.getElementById('walkinCheckin')?.value;
    const checkout = document.getElementById('walkinCheckout')?.value;
    const roomType = document.getElementById('walkinRoomType')?.value;
    const adults = document.getElementById('walkinAdults')?.value;

    if (!firstName || !lastName || !phone || !checkin || !checkout || !roomType || !adults) {
      alert('Please fill in all required fields');
      return;
    }

    const guest = `${firstName} ${lastName}`;
    const next = addWalkin({
      guest,
      room: 'Pending Assignment',
      dates: `${checkin} - ${checkout}`,
      status: 'Pending'
    });
    setWalkins(next);
    addReservationFromWalkin({ guest, roomType, checkin, checkout });
    alert(`Created walk-in booking for ${guest}\nRoom: ${roomType}\nDates: ${checkin} to ${checkout}`);
    closeModal('newWalkin');
  };

  const processCheckin = () => {
    const guestSelect = document.getElementById('checkinGuestSelect')?.value;
    const room = document.getElementById('checkinRoom')?.value;

    if (!guestSelect || !room) {
      alert('Please select a guest and room');
      return;
    }

    let guestName = guestSelect;
    if (guestSelect === 'New Guest') {
      const firstName = document.getElementById('manualFirstName')?.value;
      const lastName = document.getElementById('manualLastName')?.value;
      if (!firstName || !lastName) {
        alert('Please enter guest name');
        return;
      }
      guestName = `${firstName} ${lastName}`;
    }

    const next = updateWalkin(guestName, { status: 'Checked In', room });
    setWalkins(next);
    alert(`Checked in ${guestName} to room ${room}`);
    closeModal('checkin');
  };

  const processCheckout = () => {
    const guestName = document.getElementById('checkoutGuestSelect')?.value;
    const paymentMethod = document.getElementById('checkoutPayment')?.value;
    const printReceipt = document.getElementById('printReceipt')?.checked;

    if (!guestName) {
      alert('Please select a guest');
      return;
    }

    const next = updateWalkin(guestName, { status: 'Checked Out' });
    setWalkins(next);
    alert(`Checked out ${guestName}\nPayment: ${paymentMethod}\nReceipt: ${printReceipt ? 'Printed' : 'Not printed'}`);
    closeModal('checkout');
  };

  const markNoshow = () => {
    const guestName = document.getElementById('noshowGuestSelect')?.value;
    const reason = document.getElementById('noshowReason')?.value;

    if (!guestName || !reason) {
      alert('Please select a guest and provide a reason');
      return;
    }

    const next = updateWalkin(guestName, { status: 'No-show' });
    setWalkins(next);
    alert(`Marked ${guestName} as no-show\nReason: ${reason}`);
    closeModal('noshow');
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Checked In': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Sidebar>
      {/* New Walk-in Modal */}
      {modalState.newWalkin && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">New Walk-in Booking</h3>
              <button onClick={() => closeModal('newWalkin')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div id="walkinForm">
              <h4 className="font-medium mb-3">Guest Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
                  <input type="text" id="walkinFirstName" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name*</label>
                  <input type="text" id="walkinLastName" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone*</label>
                  <input type="tel" id="walkinPhone" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" id="walkinEmail" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <h4 className="font-medium mb-3">Stay Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date*</label>
                  <input type="date" id="walkinCheckin" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date*</label>
                  <input type="date" id="walkinCheckout" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Type*</label>
                  <select id="walkinRoomType" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Select room type</option>
                    <option value="Standard Garden View">Standard Garden View</option>
                    <option value="Deluxe Ocean View">Deluxe Ocean View</option>
                    <option value="Family Suite">Family Suite</option>
                    <option value="Premium Suite">Premium Suite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adults*</label>
                  <select id="walkinAdults" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button onClick={() => closeModal('newWalkin')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={createWalkin} className="px-4 py-2 border rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                  Create Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {modalState.checkin && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Check-in Guest</h3>
              <button onClick={() => closeModal('checkin')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Guest*</label>
              <select 
                id="checkinGuestSelect" 
                className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500"
                onChange={(e) => setShowManualCheckin(e.target.value === 'New Guest')}
              >
                <option value="">Select a guest to check-in</option>
                {walkins
                  .filter((w) => w.status === 'Pending')
                  .map((w) => (
                    <option key={`checkin-${w.id}`} value={w.guest}>{w.guest} - Pending</option>
                  ))}
                <option value="New Guest">New Guest (Manual Entry)</option>
              </select>
            </div>

            {showManualCheckin && (
              <div id="manualCheckinForm" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
                  <input type="text" id="manualFirstName" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name*</label>
                  <input type="text" id="manualLastName" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Assignment*</label>
              <select id="checkinRoom" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select a room</option>
                <option value="201">201 - Standard Garden View</option>
                <option value="202">202 - Standard Garden View</option>
                <option value="301">301 - Deluxe Ocean View</option>
                <option value="302">302 - Deluxe Ocean View</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2">
              <button onClick={() => closeModal('checkin')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={processCheckin} className="px-4 py-2 border rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                Complete Check-in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-out Modal */}
      {modalState.checkout && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Check-out Guest</h3>
              <button onClick={() => closeModal('checkout')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Guest*</label>
              <select id="checkoutGuestSelect" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select a guest to check-out</option>
                {walkins
                  .filter((w) => w.status === 'Checked In')
                  .map((w) => (
                    <option key={`checkout-${w.id}`} value={w.guest}>{w.guest} - {w.room}</option>
                  ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method*</label>
              <select id="checkoutPayment" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="flex items-center">
                <input type="checkbox" id="printReceipt" className="rounded text-blue-600" defaultChecked />
                <span className="ml-2">Print receipt</span>
              </label>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Bill Summary</h4>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Room Charges</span>
                  <span>₱4,200.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Services</span>
                  <span>₱850.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span>₱505.00</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total</span>
                  <span>₱5,555.00</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button onClick={() => closeModal('checkout')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={processCheckout} className="px-4 py-2 border rounded text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700">
                Complete Check-out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No-show Modal */}
      {modalState.noshow && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Mark as No-show</h3>
              <button onClick={() => closeModal('noshow')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Guest*</label>
              <select id="noshowGuestSelect" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select a guest</option>
                {walkins
                  .filter((w) => w.status === 'Pending')
                  .map((w) => (
                    <option key={`noshow-${w.id}`} value={w.guest}>{w.guest} - Pending</option>
                  ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason*</label>
              <textarea id="noshowReason" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" rows="3"></textarea>
            </div>

            <div className="flex justify-end space-x-2">
              <button onClick={() => closeModal('noshow')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={markNoshow} className="px-4 py-2 border rounded text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Confirm No-show
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Walk-in Bookings</h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">Walk-in Bookings</h2>

          <div className="mb-6">
            <div className="flex flex-wrap gap-4">
              <button onClick={() => openModal('newWalkin')} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                <i className="fas fa-plus mr-2"></i> New Booking
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {walkins.map((walkin, index) => (
                  <React.Fragment key={walkin.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleActions(`actions${index + 1}`)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{walkin.guest}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{walkin.room}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{walkin.dates}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button className="text-blue-600 hover:text-blue-900 mr-3"><i className="fas fa-eye"></i></button>
                        <button className="text-yellow-600 hover:text-yellow-900 mr-3"><i className="fas fa-edit"></i></button>
                        <button className="text-red-600 hover:text-red-900"><i className="fas fa-trash"></i></button>
                      </td>
                    </tr>
                    <tr className="hidden-row">
                      <td colSpan="4" className="p-0">
                        <div id={`actions${index + 1}`} className={`action-buttons ${activeActions === `actions${index + 1}` ? 'flex' : 'hidden'} p-2 bg-gray-50 border-t`}>
                          {walkin.status === 'Pending' ? (
                            <>
                              <button onClick={() => openModal('checkin')} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center mr-2">
                                <i className="fas fa-door-open mr-2"></i> Check-in
                              </button>
                              <button className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 flex items-center mr-2">
                                <i className="fas fa-concierge-bell mr-2"></i> Extra Services
                              </button>
                              <button onClick={() => openModal('noshow')} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 flex items-center">
                                <i className="fas fa-user-slash mr-2"></i> No-show
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 flex items-center mr-2">
                                <i className="fas fa-concierge-bell mr-2"></i> Add Service
                              </button>
                              <button className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 flex items-center mr-2">
                                <i className="fas fa-exchange-alt mr-2"></i> Move Room
                              </button>
                              <button onClick={() => openModal('checkout')} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 flex items-center">
                                <i className="fas fa-sign-out-alt mr-2"></i> Checkout
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </Sidebar>
  );
};

export default WalkIn;