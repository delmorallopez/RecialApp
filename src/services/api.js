// src/services/api.js
// Base Axios instance — all API calls go through here

import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;