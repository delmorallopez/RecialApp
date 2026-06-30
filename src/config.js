const config = {
  apiUrl: (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/$/, ""),
};

export default config;