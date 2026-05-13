import API from "./api";

export const getReceipts = (params = {}) =>
  API.get("/receipts/", { params });

export const getReceipt = (id) =>
  API.get(`/receipts/${id}`);

export const createReceipt = (data) =>
  API.post("/receipts/", data);

export const updateReceipt = (id, data) =>
  API.patch(`/receipts/${id}`, data);

export const deleteReceipt = (id) =>
  API.delete(`/receipts/${id}`);