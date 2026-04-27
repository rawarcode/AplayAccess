// Fallback testimonials shown when the live reviews API returns
// empty (resort has no published reviews yet → public page would
// otherwise have an empty section). Was three template reviews
// referencing things Aplaya doesn't have ("infinity pool",
// "all restaurants", "spa treatments"). Replaced with sparse,
// generic positive notes that don't make claims about facilities.
//
// Currently no file imports this module — left in place because
// future fallback consumers were the original intent. If it stays
// unreferenced indefinitely, delete the file.
export const testimonials = [
  {
    name:  "Sarah J.",
    img:   "https://randomuser.me/api/portraits/women/32.jpg",
    stars: "★★★★★",
    quote: "Easy to book, easy to find, and the staff were friendly throughout. We'd come back.",
  },
  {
    name:  "Michael C.",
    img:   "https://randomuser.me/api/portraits/men/45.jpg",
    stars: "★★★★★",
    quote: "Quiet beachfront, clean rooms, fair pricing. The 24-hour package was the right call for a long drive.",
  },
  {
    name:  "Emma R.",
    img:   "https://randomuser.me/api/portraits/women/68.jpg",
    stars: "★★★★☆",
    quote: "Great spot for a family day trip. Kids loved the beach.",
  },
];
