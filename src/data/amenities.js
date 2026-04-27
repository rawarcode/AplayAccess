// Fallback list shown on /resort when the live amenities API returns
// empty (no rows seeded in admin → public page would otherwise have a
// blank amenities section). Was a template list of fictional resort
// features — "Infinity Pool" + "Gourmet Dining" + "Spa & Wellness" +
// "Water Sports" — which Aplaya doesn't have. Replaced with the
// minimum accurate set; the owner can extend via the CMS once the
// real amenities are decided.
export const amenities = [
  { title: "Beachfront access", desc: "Sand and water a few steps from every cottage and room.", icon: "🏖️" },
  { title: "Parking included",  desc: "A parking slot is held with every booking.",                 icon: "🅿️" },
  { title: "Walk-ins welcome",  desc: "Day visits, overnights, and 24-hour stays bookable on arrival.", icon: "🚪" },
];
