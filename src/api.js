import axios from "axios";

console.log("REACT_APP_BASE:", process.env.REACT_APP_BASE);

export const api = axios.create({
  baseURL: process.env.REACT_APP_BASE || "https://sheetsdb.onrender.com/api",
  timeout: 20000,
});