import API from "./api";

export const login = (username, password) =>
  API.post("/auth/login",
    new URLSearchParams({ username, password }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

export const getMe = () => API.get("/auth/me");