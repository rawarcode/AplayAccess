import { createContext, useContext } from 'react';

const NotificationContext = createContext({
  counts:  { unreadMessages: 0, pendingBookings: 0, todayArrivals: 0, dirtyRooms: 0 },
  items:   [],
  total:   0,
  refresh: () => {},
});

export const useNotifications = () => useContext(NotificationContext);
export default NotificationContext;
