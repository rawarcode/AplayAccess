import { api } from "./api";

export async function getResorts() {
  const res = await api.get("/api/resorts");
  return res.data?.data ?? res.data;
}

export async function getResort(resortId) {
  const res = await api.get(`/api/resorts/${resortId}`);
  return res.data?.data ?? res.data;
}

export async function getResortRooms(resortId) {
  const res = await api.get(`/api/resorts/${resortId}/rooms`);
  return res.data?.data ?? res.data;
}

export async function getResortAmenities(resortId) {
  const res = await api.get(`/api/resorts/${resortId}/amenities`);
  return res.data?.data ?? res.data;
}

export async function getResortRoomTypes(resortId) {
  const res = await api.get(`/api/resorts/${resortId}/room-types`);
  return res.data?.data ?? res.data;
}

export async function getResortGallery(resortId) {
  const res = await api.get(`/api/resorts/${resortId}/gallery`);
  return res.data?.data ?? res.data;
}

export async function getResortReviews(resortId) {
  const res = await api.get(`/api/resorts/${resortId}/reviews`);
  return res.data?.data ?? res.data;
}