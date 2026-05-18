import API from "./api";

export const getEntrances = (params = {}) =>
  API.get("/entrances/", { params });

export const getEntrance = (id) =>
  API.get(`/entrances/${id}`);

export const createEntrance = (data) =>
  API.post("/entrances/", data);

export const updateEntrance = (id, data) =>
  API.patch(`/entrances/${id}`, data);

export const deleteEntrance = (id) =>
  API.delete(`/entrances/${id}`);