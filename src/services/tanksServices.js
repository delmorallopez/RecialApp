import API from "./api";

export const getTanks = (params = {}) =>
  API.get("/tanks/", { params });

export const getTank = (id) =>
  API.get(`/tanks/${id}`);

export const createTank = (data) =>
  API.post("/tanks/", data);

export const updateTank = (id, data) =>
  API.patch(`/tanks/${id}`, data);

export const deleteTank = (id) =>
  API.delete(`/tanks/${id}`);