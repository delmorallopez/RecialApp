import API from "./api";

// GET all customers (with optional search/filter)
export const getSuppliers = (params = {}) =>
  API.get("/suppliers/", { params });

// GET one customer by ID
export const getSupplier = (id) =>
  API.get(`/suppliers/${id}`);

// POST — create new customer
export const createSupplier = (data) =>
  API.post("/suppliers/", data);

// PATCH — update existing customer
export const updateSupplier = (id, data) =>
  API.patch(`/suppliers/${id}`, data);

// DELETE — remove customer
export const deleteSupplier = (id) =>
  API.delete(`/suppliers/${id}`);