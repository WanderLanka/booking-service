// axiosConfig.js - Node-safe Axios client for server-to-server calls
const axios = require('axios');

// Factory to create a configured Axios instance per request/context
const createApiClient = ({ baseURL, token, timeout = 10000, headers = {} } = {}) => {
  const instance = axios.create({
    baseURL: baseURL || process.env.DOWNSTREAM_BASE_URL || 'http://localhost:3000',
    timeout,
    headers,
  });

  // Add Authorization header if provided
  instance.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Identify this service in downstream logs
      config.headers['x-requested-by'] = 'booking-service';
      if (process.env.NODE_ENV !== 'production') {
        console.log('➡️  HTTP', config.method?.toUpperCase(), config.baseURL + config.url);
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('⬅️  HTTP', response.status, response.config.url);
      }
      return response;
    },
    (error) => {
      const status = error.response?.status;
      const url = error.config?.url;
      console.error('❌ HTTP error', status || 'unknown', url || '');
      return Promise.reject(error);
    }
  );

  return instance;
};

module.exports = { createApiClient };