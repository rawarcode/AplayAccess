// src/data/dashboard.js
export const sampleBookings = [
    {
      id: "RES-2023-001",
      roomType: "Deluxe Ocean View",
      checkIn: "2023-12-15",
      checkOut: "2023-12-20",
      guests: 2,
      total: 199 * 5,
      status: "Confirmed",
    },
    {
      id: "RES-2023-000",
      roomType: "Beachfront Suite",
      checkIn: "2023-11-01",
      checkOut: "2023-11-05",
      guests: 2,
      total: 299 * 4,
      status: "Completed",
    },
    {
      id: "RES-2024-100",
      roomType: "Garden View Room",
      checkIn: "2024-03-10",
      checkOut: "2024-03-12",
      guests: 1,
      total: 149 * 2,
      status: "Pending",
    },
  ];
  
  export const sampleConversations = [
    {
      id: 1,
      name: "Aplaya Support",
      avatar: "https://randomuser.me/api/portraits/men/32.jpg",
      timestamp: "2 hours ago",
      lastMessage: "Your booking confirmation for December has been sent.",
      unread: 1,
      messages: [
        { id: 101, sender: "support", text: "Welcome to Aplaya Beach Resort! How can we assist you today?", timestamp: "2023-12-01 10:00" },
        { id: 102, sender: "user", text: "Hi, I have a question about my upcoming booking.", timestamp: "2023-12-01 10:05" },
        { id: 103, sender: "support", text: "Sure! Please share your booking ID and question.", timestamp: "2023-12-01 10:07" },
      ],
    },
    {
      id: 2,
      name: "Front Desk",
      avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      timestamp: "Yesterday",
      lastMessage: "We can arrange airport pickup for you.",
      unread: 0,
      messages: [
        { id: 201, sender: "support", text: "Hello! Would you like airport pickup?", timestamp: "2023-11-30 08:30" },
        { id: 202, sender: "user", text: "Yes please. What are the rates?", timestamp: "2023-11-30 08:35" },
        { id: 203, sender: "support", text: "We can arrange airport pickup for you.", timestamp: "2023-11-30 08:40" },
      ],
    },
  ];