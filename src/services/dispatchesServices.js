import API from "./api";

export const getDispatches = (params = {}) =>
  API.get("/dispatches/", { params });

export const getDispatch = (id) =>
  API.get(`/dispatches/${id}`);

export const createDispatch = (data) =>
  API.post("/dispatches/", data);

export const updateDispatch = (id, data) =>
  API.patch(`/dispatches/${id}`, data);

export const deleteDispatch = (id) =>
  API.delete(`/dispatches/${id}`);