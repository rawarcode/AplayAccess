// Fallback gallery shown when the live gallery API returns empty.
//
// Stripped: 3 pool entries ("Resort Pool", "Infinity Pool View",
// "Poolside Lounge") — Aplaya doesn't have a pool, so the
// fictional photos shouldn't ship as fallback content.
//
// Still present and probably also fiction (different audit pass):
// fine-dining table, spa treatment room, water sports. Owner can
// curate the real gallery via the CMS; this list only renders if
// nothing is uploaded.
export const gallery = [
  {
    src: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?auto=format&fit=crop&w=2071&q=80",
    alt: "Beach View",
    caption: "Beach view",
  },
  {
    src: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=2089&q=80",
    alt: "Restaurant",
    caption: "Restaurant interior",
  },
  {
    src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80",
    alt: "Sunset",
    caption: "Sunset over the ocean",
  },
  {
    src: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2070&q=80",
    alt: "Room interior",
    caption: "Room interior",
  },
  {
    src: "https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=1926&q=80",
    alt: "Beachfront pathway",
    caption: "Beachfront pathway",
  },
  {
    src: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=2070&q=80",
    alt: "Deluxe room balcony",
    caption: "Deluxe room balcony",
  },
  {
    src: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=2070&q=80",
    alt: "Room interior",
    caption: "Room interior",
  },
  {
    src: "https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=1974&q=80",
    alt: "Family room",
    caption: "Family room",
  },
  {
    src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80",
    alt: "Resort view",
    caption: "Resort view",
  },
  {
    src: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?auto=format&fit=crop&w=2071&q=80",
    alt: "Beach at sunrise",
    caption: "Beach at sunrise",
  },
];
