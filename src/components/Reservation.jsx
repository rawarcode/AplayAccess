import React, { useMemo, useState } from 'react';
import Sidebar from './Layout/Sidebar';
import { getReservations, removeReservationById, updateReservation } from '../utils/appData';

const Reservation = () => {
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [activeActions, setActiveActions] = useState(null);
  const [modalState, setModalState] = useState({
    assignRoom: false,
    extraServices: false,
    moveRoom: false,
    checkout: false,
    viewReservation: false,
    editReservation: false,
    deleteReservation: false,
    viewBill: false
  });
  const [selectedServices, setSelectedServices] = useState([]);
  const [currentReservation, setCurrentReservation] = useState(null);
  const [reservations, setReservations] = useState(() => getReservations());
  const [searchBy, setSearchBy] = useState('Reservation ID');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReservations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return reservations;

    return reservations.filter((r) => {
      if (searchBy === 'Guest Name') return r.guest.toLowerCase().includes(term);
      if (searchBy === 'Room Number') return r.room.toLowerCase().includes(term);
      return r.id.toLowerCase().includes(term);
    });
  }, [reservations, searchBy, searchTerm]);

  const toggleActions = (actionId) => {
    setActiveActions(activeActions === actionId ? null : actionId);
  };

  const openModal = (modalName) => {
    setModalState({ ...modalState, [modalName]: true });
  };

  const closeModal = (modalName) => {
    setModalState({ ...modalState, [modalName]: false });
    if (modalName === 'extraServices') {
      setSelectedServices([]);
    }
  };

  const viewReservation = (reservation) => {
    setCurrentReservation(reservation);
    openModal('viewReservation');
  };

  const editReservation = (reservation) => {
    setCurrentReservation(reservation);
    openModal('editReservation');
  };

  const deleteReservation = (reservation) => {
    setCurrentReservation(reservation);
    openModal('deleteReservation');
  };

  const viewBill = (reservation) => {
    setCurrentReservation(reservation);
    openModal('viewBill');
  };

  const addService = (serviceType) => {
    const services = {
      breakfast: { type: 'breakfast', name: 'Breakfast Buffet', price: 15 },
      spa: { type: 'spa', name: 'Spa Package', price: 120 },
      transfer: { type: 'transfer', name: 'Airport Transfer', price: 75 },
      lateCheckout: { type: 'lateCheckout', name: 'Late Checkout', price: 50 }
    };

    if (!selectedServices.some(s => s.type === serviceType)) {
      setSelectedServices([...selectedServices, services[serviceType]]);
    }
  };

  const removeService = (serviceType) => {
    setSelectedServices(selectedServices.filter(s => s.type !== serviceType));
  };

  const confirmServices = () => {
    if (selectedServices.length === 0) {
      alert('Please select at least one service');
      return;
    }
    const serviceNames = selectedServices.map(s => s.name).join(', ');
    alert(`Added services: ${serviceNames} to ${currentReservation?.guest}'s reservation`);
    closeModal('extraServices');
  };

  const confirmMove = () => {
    const newRoom = document.getElementById('newRoomSelection')?.value;
    const reason = document.getElementById('moveReason')?.value;

    if (!newRoom) {
      alert('Please select a new room');
      return;
    }
    if (!reason) {
      alert('Please provide a reason for the move');
      return;
    }

    const next = updateReservation(currentReservation.id, {
      room: newRoom,
      status: 'checked-in'
    });
    setReservations(next);
    alert(`Moved ${currentReservation?.guest} to ${newRoom}\nReason: ${reason}`);
    closeModal('moveRoom');
  };

  const processCheckout = () => {
    const printReceipt = document.getElementById('printReceipt')?.checked;
    const sendEmail = document.getElementById('sendEmail')?.checked;

    const next = updateReservation(currentReservation.id, { status: 'checked-out' });
    setReservations(next);
    alert(`Checked out ${currentReservation?.guest}\nPrint receipt: ${printReceipt ? 'Yes' : 'No'}\nSend email: ${sendEmail ? 'Yes' : 'No'}`);
    closeModal('checkout');
  };

  const handleDeleteReservation = () => {
    const next = removeReservationById(currentReservation.id);
    setReservations(next);
    setCurrentReservation(null);
    closeModal('deleteReservation');
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'checked-in': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'checked-out': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'confirmed': return 'Confirmed';
      case 'checked-in': return 'Checked In';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled';
      case 'checked-out': return 'Checked Out';
      default: return status;
    }
  };

  return (
    <Sidebar>
      {/* Assign Room Modal */}
      {modalState.assignRoom && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Assign Room/Cottage</h3>
              <button onClick={() => closeModal('assignRoom')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Rooms/Cottages</label>
              <select className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select a room</option>
                <option value="201">201 - Standard Garden View</option>
                <option value="202">202 - Standard Garden View</option>
                <option value="301">301 - Deluxe Ocean View</option>
                <option value="302">302 - Deluxe Ocean View</option>
                <option value="401">401 - Family Suite</option>
                <option value="402">402 - Family Suite</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => closeModal('assignRoom')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => closeModal('assignRoom')} className="px-4 py-2 border rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                Assign Room/Cottage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Services Modal */}
      {modalState.extraServices && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Extra Services</h3>
              <button onClick={() => closeModal('extraServices')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <div className="service-item flex justify-between p-3 border-b">
                <div>
                  <h4 className="font-medium">Breakfast Buffet</h4>
                  <p className="text-sm text-gray-600">Daily breakfast for one person</p>
                </div>
                <div className="flex items-center">
                  <span className="font-medium mr-4">₱15/day</span>
                  <button onClick={() => addService('breakfast')} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                    Add
                  </button>
                </div>
              </div>
              <div className="service-item flex justify-between p-3 border-b">
                <div>
                  <h4 className="font-medium">Spa Package</h4>
                  <p className="text-sm text-gray-600">60-minute massage and facial</p>
                </div>
                <div className="flex items-center">
                  <span className="font-medium mr-4">₱120</span>
                  <button onClick={() => addService('spa')} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                    Add
                  </button>
                </div>
              </div>
              <div className="service-item flex justify-between p-3 border-b">
                <div>
                  <h4 className="font-medium">Airport Transfer</h4>
                  <p className="text-sm text-gray-600">Round-trip private car service</p>
                </div>
                <div className="flex items-center">
                  <span className="font-medium mr-4">₱75</span>
                  <button onClick={() => addService('transfer')} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                    Add
                  </button>
                </div>
              </div>
              <div className="service-item flex justify-between p-3">
                <div>
                  <h4 className="font-medium">Late Checkout</h4>
                  <p className="text-sm text-gray-600">Extend checkout to 4pm</p>
                </div>
                <div className="flex items-center">
                  <span className="font-medium mr-4">₱50</span>
                  <button onClick={() => addService('lateCheckout')} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Selected Services</h4>
              <div id="selectedServices" className="mb-4">
                {selectedServices.length === 0 ? (
                  <p className="text-gray-500">No services selected</p>
                ) : (
                  selectedServices.map((service) => (
                    <div key={service.type} className="flex justify-between items-center py-2 border-b">
                      <span>{service.name}</span>
                      <div className="flex items-center">
                        <span className="font-medium mr-4">₱{service.price}</span>
                        <button onClick={() => removeService(service.type)} className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <button onClick={() => closeModal('extraServices')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={confirmServices} className="px-4 py-2 border rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                  Confirm Services
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Room Modal */}
      {modalState.moveRoom && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Move Room/Cottage</h3>
              <button onClick={() => closeModal('moveRoom')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <p className="mb-2">Current Room: <span id="currentRoom" className="font-medium">305 - Deluxe Ocean View</span></p>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Room/Cottage</label>
              <select id="newRoomSelection" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select a new room/Cottage</option>
                <option value="306">306 - Deluxe Ocean View</option>
                <option value="307">307 - Deluxe Ocean View</option>
                <option value="501">501 - Premium Suite</option>
                <option value="502">502 - Premium Suite</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Move</label>
              <textarea id="moveReason" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" rows="3"></textarea>
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => closeModal('moveRoom')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmMove} className="px-4 py-2 border rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                Move Guest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {modalState.checkout && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Checkout Guest</h3>
              <button onClick={() => closeModal('checkout')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <p>You are about to check out <span id="checkoutGuestName" className="font-medium">{currentReservation?.guest}</span> from room <span id="checkoutRoom" className="font-medium">305</span>.</p>
              <div className="mt-4">
                <label className="flex items-center">
                  <input type="checkbox" id="printReceipt" className="rounded text-blue-600" defaultChecked />
                  <span className="ml-2">Print receipt</span>
                </label>
                <label className="flex items-center mt-2">
                  <input type="checkbox" id="sendEmail" className="rounded text-blue-600" defaultChecked />
                  <span className="ml-2">Send receipt via email</span>
                </label>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Final Bill Summary</h4>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Room Charges (3 nights)</span>
                  <span>₱675.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span>₱81.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Services</span>
                  <span>₱45.00</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total</span>
                  <span>₱801.00</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => closeModal('checkout')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={processCheckout} className="px-4 py-2 border rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                Process Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Reservation Modal */}
      {modalState.viewReservation && currentReservation && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Reservation Details</h3>
              <button onClick={() => closeModal('viewReservation')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Reservation ID</p>
                  <p className="font-medium">{currentReservation.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(currentReservation.status)}`}>
                      {getStatusText(currentReservation.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Guest Name</p>
                  <p className="font-medium">{currentReservation.guest}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Room/Cottage</p>
                  <p className="font-medium">{currentReservation.room}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-in Date</p>
                  <p className="font-medium">{currentReservation.dates.split(' - ')[0]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-out Date</p>
                  <p className="font-medium">{currentReservation.dates.split(' - ')[1]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Adults</p>
                  <p className="font-medium">2</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Children</p>
                  <p className="font-medium">1</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Special Requests</p>
                <p className="font-medium">Non-smoking room, extra pillows</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact Information</p>
                <p className="font-medium">robert.chen@email.com | +1 (555) 123-4567</p>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => closeModal('viewReservation')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalState.deleteReservation && currentReservation && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Delete Reservation</h3>
              <button onClick={() => closeModal('deleteReservation')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <p>Are you sure you want to delete the reservation for <span className="font-medium">{currentReservation.guest}</span> (ID: <span className="font-medium">{currentReservation.id}</span>)?</p>
              <p className="mt-2 text-sm text-gray-600">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => closeModal('deleteReservation')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDeleteReservation} className="px-4 py-2 border rounded text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Delete Reservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Bill Modal */}
      {modalState.viewBill && currentReservation && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Bill Details</h3>
              <button onClick={() => closeModal('viewBill')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-4">
              <p className="mb-2">Reservation: <span className="font-medium">{currentReservation.id}</span></p>
              <p className="mb-2">Guest: <span className="font-medium">{currentReservation.guest}</span></p>
              <p className="mb-2">Room: <span className="font-medium">{currentReservation.room}</span></p>
              <p className="mb-2">Dates: <span className="font-medium">{currentReservation.dates}</span></p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Charges</h4>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Room Charges (3 nights @ ₱225/night)</span>
                  <span>₱675.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes (12%)</span>
                  <span>₱81.00</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total</span>
                  <span>₱801.00</span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-600">Payment Status: <span className="font-medium text-green-600">Paid</span></p>
                  <p className="text-sm text-gray-600">Payment Method: <span className="font-medium">Credit Card</span></p>
                </div>
                <button onClick={() => {
                  alert('Printing receipt...');
                  closeModal('viewBill');
                }} className="px-4 py-2 border rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center">
                  <i className="fas fa-print mr-2"></i> Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Reservation Lookup</h1>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6">Reservation Lookup</h2>

            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search by</label>
                  <div className="flex space-x-2">
                    <select
                      value={searchBy}
                      onChange={(e) => setSearchBy(e.target.value)}
                      className="border rounded px-3 py-2 w-full md:w-auto focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option>Reservation ID</option>
                      <option>Guest Name</option>
                      <option>Room Number</option>
                    </select>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Enter search term..."
                      className="border rounded px-3 py-2 flex-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button type="button" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition flex items-center">
                      <i className="fas fa-search mr-2"></i> Search
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 reservation-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.map((reservation, index) => (
                  <React.Fragment key={reservation.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleActions(`actions${index + 1}`)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{reservation.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reservation.guest}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reservation.room}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reservation.dates}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button onClick={(e) => { e.stopPropagation(); viewReservation(reservation); }} className="text-blue-600 hover:text-blue-900 mr-3" title="View">
                          <i className="fas fa-eye"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); editReservation(reservation); }} className="text-yellow-600 hover:text-yellow-900 mr-3" title="Edit">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteReservation(reservation); }} className="text-red-600 hover:text-red-900" title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                    <tr className="hidden-row">
                      <td colSpan="5" className="p-0">
                        <div id={`actions${index + 1}`} className={`action-buttons ${activeActions === `actions${index + 1}` ? 'flex' : 'hidden'} p-2 bg-gray-50 border-t`}>
                          <button onClick={() => openModal('assignRoom')} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center mr-2">
                            <i className="fas fa-door-open mr-2"></i> Assign Room
                          </button>
                          <button onClick={() => openModal('extraServices')} className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 flex items-center mr-2">
                            <i className="fas fa-concierge-bell mr-2"></i> Extra Services
                          </button>
                          <button onClick={() => openModal('moveRoom')} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 flex items-center mr-2">
                            <i className="fas fa-exchange-alt mr-2"></i> Move Room
                          </button>
                          <button onClick={() => openModal('checkout')} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 flex items-center">
                            <i className="fas fa-sign-out-alt mr-2"></i> Checkout
                          </button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredReservations.length}</span> of <span className="font-medium">{reservations.length}</span> results
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Previous
              </button>
              <button className="px-3 py-1 border rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                1
              </button>
              <button className="px-3 py-1 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                2
              </button>
              <button className="px-3 py-1 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </Sidebar>
  );
};

export default Reservation;