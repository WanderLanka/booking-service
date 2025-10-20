const axios = require('axios');

class TransportationAdapter {
  constructor() {
    this.baseURL = process.env.TRANSPORT_SERVICE_URL || 'http://localhost:3002';
    this.timeout = 10000;
  }

  async setAvailability(vehicleId, availability) {
    const url = `${this.baseURL}/internal/vehicles/${vehicleId}/availability`;
    const res = await axios.put(url, { availability }, {
      timeout: this.timeout,
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data;
  }
}

module.exports = TransportationAdapter;


