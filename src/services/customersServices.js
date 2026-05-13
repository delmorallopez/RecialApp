// src/services/customersService.js
// All API calls for the Customers module

import API from "./api";

// GET all customers (with optional search/filter)
export const getCustomers = (params = {}) =>
  API.get("/customers/", { params });

// GET one customer by ID
export const getCustomer = (id) =>
  API.get(`/customers/${id}`);

// POST — create new customer
export const createCustomer = (data) =>
  API.post("/customers/", data);

// PATCH — update existing customer
export const updateCustomer = (id, data) =>
  API.patch(`/customers/${id}`, data);

// DELETE — remove customer
export const deleteCustomer = (id) =>
  API.delete(`/customers/${id}`);