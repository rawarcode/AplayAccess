import React from 'react';

const RecentBookings = ({ bookings }) => {
  return (
    <div className="recent-bookings">
      <h2 className="recent-bookings-title">Recent Bookings</h2>
      <div className="recent-bookings-list">
        {bookings.map((booking) => (
          <div key={booking.id} className="booking-item">
            <div className="booking-avatar">
              <i className="fas fa-user"></i>
            </div>
            <div>
              <p className="booking-guest-name">{booking.guestName}</p>
              <p className="booking-room">{booking.room}</p>
              <p className={`booking-status ${booking.statusColor}`}>{booking.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentBookings;
