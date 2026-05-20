import API from "./api";

export const getPickupPoints = (params = {}) =>
  API.get("/pickup-points/", { params });

export const createPickupPoint = (data) =>
  API.post("/pickup-points/", data);

export const updatePickupPoint = (id, data) =>
  API.patch(`/pickup-points/${id}`, data);

export const deletePickupPoint = (id) =>
  API.delete(`/pickup-points/${id}`);