import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:8000/api"
    : "/api");

export const api = axios.create({
  baseURL: API_BASE_URL
});


