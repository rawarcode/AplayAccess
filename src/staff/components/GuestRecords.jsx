import React, { useState } from 'react';
import Sidebar from './Layout/Sidebar';

const GuestRecords = () => {
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [customSubjectVisible, setCustomSubjectVisible] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');

  const guests = [
    {
      id: 1,
      name: 'Michael Brown',
      loyalty: 'Gold',
      email: 'michael.brown@example.com',
      phone: '(555) 123-4567',
      stays: 5,
      lastVisit: 'May 15-20, 2023',
      totalSpend: '₱3,245.75',
      image: 'https://randomuser.me/api/portraits/men/32.jpg',
      stayHistory: [
        { date: 'May 15-20, 2023', room: 'Deluxe Ocean View', nights: 5, amount: '₱3,245.75' },
        { date: 'Feb 10-12, 2023', room: 'Standard Room', nights: 2, amount: '₱1,020.50' },
        { date: 'Nov 5-10, 2022', room: 'Deluxe Ocean View', nights: 5, amount: '₱3,100.00' }
      ]
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      loyalty: 'Platinum',
      email: 'sarah.johnson@example.com',
      phone: '(555) 987-6543',
      stays: 12,
      lastVisit: 'Apr 28-May 5, 2023',
      totalSpend: '₱8,745.20',
      image: 'https://randomuser.me/api/portraits/women/44.jpg',
      stayHistory: [
        { date: 'Apr 28-May 5, 2023', room: 'Executive Suite', nights: 7, amount: '₱5,245.20' },
        { date: 'Jan 15-20, 2023', room: 'Deluxe Ocean View', nights: 5, amount: '₱3,500.00' }
      ]
    },
    {
      id: 3,
      name: 'David Wilson',
      loyalty: 'Silver',
      email: 'david.wilson@example.com',
      phone: '(555) 456-7890',
      stays: 3,
      lastVisit: 'Mar 10-15, 2023',
      totalSpend: '₱1,875.50',
      image: 'https://randomuser.me/api/portraits/men/75.jpg',
      stayHistory: [
        { date: 'Mar 10-15, 2023', room: 'Standard Room', nights: 5, amount: '₱1,875.50' },
        { date: 'Dec 20-22, 2022', room: 'Standard Room', nights: 2, amount: '₱750.00' }
      ]
    }
  ];

  const emailTemplates = {
    'Special Offer for Our Valued Guest': 'Dear {guestName},\n\nWe\'re delighted to offer you an exclusive 15% discount on your next stay with us! As a valued {loyaltyLevel} member, we appreciate your loyalty and want to reward you.\n\nBook by {date} to take advantage of this special offer.\n\nBest regards,\nThe AplayAccess Team',
    'Thank You for Your Recent Stay': 'Dear {guestName},\n\nThank you for choosing AplayAccess for your recent stay. We hope you enjoyed your time with us and we look forward to welcoming you back soon!\n\nAs a {loyaltyLevel} member, you\'ve earned {points} points from this stay.\n\nWarm regards,\nThe AplayAccess Team',
    'Upcoming Events at Our Resort': 'Dear {guestName},\n\nWe\'re excited to share our upcoming events that you might enjoy during your next visit:\n\n- Beachside BBQ: Every Friday evening\n- Live Music Nights: Saturdays at the pool bar\n- Spa Special: 20% off massages in June\n\nAs a {loyaltyLevel} member, you\'ll receive priority booking!\n\nBest,\nThe AplayAccess Team',
    'Feedback Request': 'Dear {guestName},\n\nWe would love to hear about your recent experience at AplayAccess. Your feedback helps us improve our services for you and other guests.\n\nPlease take a moment to complete our short survey: {surveyLink}\n\nThank you for being a valued {loyaltyLevel} member!\n\nSincerely,\nThe AplayAccess Team'
  };

  const openViewModal = (guest) => {
    setSelectedGuest(guest);
    setViewModalOpen(true);
  };

  const openEmailModal = (guest) => {
    setSelectedGuest(guest);
    setEmailSubject('Special Offer for Our Valued Guest');
    const template = emailTemplates['Special Offer for Our Valued Guest']
      .replace('{guestName}', guest.name)
      .replace('{loyaltyLevel}', guest.loyalty)
      .replace('{date}', new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString());
    setEmailMessage(template);
    setEmailModalOpen(true);
  };

  const closeModal = () => {
    setViewModalOpen(false);
    setEmailModalOpen(false);
    setSelectedGuest(null);
  };

  const handleEmailSubjectChange = (e) => {
    const value = e.target.value;
    setEmailSubject(value);
    
    if (value === 'Custom') {
      setCustomSubjectVisible(true);
    } else {
      setCustomSubjectVisible(false);
      if (selectedGuest && emailTemplates[value]) {
        const template = emailTemplates[value]
          .replace('{guestName}', selectedGuest.name)
          .replace('{loyaltyLevel}', selectedGuest.loyalty)
          .replace('{date}', new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString())
          .replace('{points}', Math.floor(Math.random() * 1000) + 500)
          .replace('{surveyLink}', 'https://survey.aplayaccess.com/' + selectedGuest.name.replace(' ', ''));
        setEmailMessage(template);
      }
    }
  };

  const sendEmail = () => {
    const to = selectedGuest?.email;
    const subject = emailSubject === 'Custom' ? document.getElementById('customSubject')?.value : emailSubject;
    const message = emailMessage;
    const sendCopy = document.getElementById('emailCopy')?.checked;

    console.log('Email sent:', { to, subject, message, sendCopy });
    alert(`Email to ${to} has been sent successfully!`);
    closeModal();
  };

  return (
    <Sidebar>
      {/* View Guest Modal */}
      {viewModalOpen && selectedGuest && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{selectedGuest.name}'s Details</h3>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <img src={selectedGuest.image} alt="Guest" className="h-16 w-16 rounded-full" />
                  <div>
                    <h4 className="text-xl font-semibold">{selectedGuest.name}</h4>
                    <p className="text-sm text-gray-600">Loyalty: {selectedGuest.loyalty}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-700">Contact Information</h5>
                    <p className="text-sm">{selectedGuest.email}</p>
                    <p className="text-sm">{selectedGuest.phone}</p>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-700">Stay Statistics</h5>
                    <p className="text-sm">Total Stays: {selectedGuest.stays}</p>
                    <p className="text-sm">Last Visit: {selectedGuest.lastVisit}</p>
                    <p className="text-sm">Total Spend: {selectedGuest.totalSpend}</p>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Recent Stays</h5>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nights</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedGuest.stayHistory.map((stay, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{stay.date}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{stay.room}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{stay.nights}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{stay.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Guest Modal */}
      {emailModalOpen && selectedGuest && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Send Email to {selectedGuest.name}</h3>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="email" value={selectedGuest.email} className="w-full border rounded px-3 py-2" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select 
                    value={emailSubject}
                    onChange={handleEmailSubjectChange}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select a template</option>
                    <option value="Special Offer for Our Valued Guest">Special Offer</option>
                    <option value="Thank You for Your Recent Stay">Thank You</option>
                    <option value="Upcoming Events at Our Resort">Event Invitation</option>
                    <option value="Feedback Request">Feedback Request</option>
                    <option value="Custom">Custom</option>
                  </select>
                  {customSubjectVisible && (
                    <input 
                      id="customSubject"
                      type="text" 
                      className="w-full border rounded px-3 py-2 mt-2" 
                      placeholder="Enter custom subject"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea 
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    className="w-full border rounded px-3 py-2 h-40"
                  />
                </div>
                <div className="flex items-center">
                  <input id="emailCopy" type="checkbox" className="mr-2" />
                  <label htmlFor="emailCopy" className="text-sm text-gray-700">Send a copy to myself</label>
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition">
                    Cancel
                  </button>
                  <button onClick={sendEmail} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                    <i className="fas fa-paper-plane mr-2"></i> Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Guest Stay Records</h1>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">Guest Stay Records</h2>

          <div className="mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Guest</label>
                <div className="flex space-x-2">
                  <select className="border rounded px-3 py-2 w-full md:w-auto">
                    <option>Guest Name</option>
                    <option>Phone Number</option>
                    <option>Email</option>
                    <option>Loyalty Number</option>
                  </select>
                  <input type="text" placeholder="Enter search term..." className="border rounded px-3 py-2 flex-1" />
                  <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                    <i className="fas fa-search mr-2"></i> Search
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <div className="flex space-x-2">
                  <input type="date" className="border rounded px-3 py-2" />
                  <span className="flex items-center">to</span>
                  <input type="date" className="border rounded px-3 py-2" />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stays</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Visit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spend</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img className="h-10 w-10 rounded-full" src={guest.image} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{guest.name}</div>
                          <div className="text-sm text-gray-500">Loyalty: {guest.loyalty}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{guest.email}</div>
                      <div className="text-sm text-gray-500">{guest.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{guest.stays}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{guest.lastVisit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{guest.totalSpend}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button onClick={() => openViewModal(guest)} className="text-blue-600 hover:text-blue-900 mr-3">
                        <i className="fas fa-eye"></i>
                      </button>
                      <button onClick={() => openEmailModal(guest)} className="text-yellow-600 hover:text-yellow-900">
                        <i className="fas fa-envelope"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </Sidebar>
  );
};

export default GuestRecords;