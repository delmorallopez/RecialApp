import API from "./api";

export const getDashboard = (year) =>
  API.get("/dashboard/", { params: { year } });