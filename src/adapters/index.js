const AccommodationAdapter = require('./AccommodationAdapter');
const PaymentAdapter = require('./PaymentAdapter');

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
    this.initializeAdapters();
  }

  initializeAdapters() {
    // Register all service adapters
    this.adapters.set('accommodation', new AccommodationAdapter());
    this.adapters.set('payment', new PaymentAdapter());
    
    // Future adapters can be added here:
    // this.adapters.set('transportation', new TransportationAdapter());
    // this.adapters.set('guide', new GuideAdapter());
    // this.adapters.set('notification', new NotificationAdapter());
  }

  /**
   * Get adapter for specific service
   * @param {string} serviceName - Name of the service
   * @returns {Object} Service adapter instance
   */
  getAdapter(serviceName) {
    const adapter = this.adapters.get(serviceName);
    if (!adapter) {
      throw new Error(`Adapter not found for service: ${serviceName}`);
    }
    return adapter;
  }

  /**
   * Get accommodation service adapter
   * @returns {AccommodationAdapter} Accommodation adapter instance
   */
  getAccommodationAdapter() {
    return this.getAdapter('accommodation');
  }

  /**
   * Get payment service adapter
   * @returns {PaymentAdapter} Payment adapter instance
   */
  getPaymentAdapter() {
    return this.getAdapter('payment');
  }

  /**
   * Check if adapter exists for service
   * @param {string} serviceName - Service name to check
   * @returns {boolean} True if adapter exists
   */
  hasAdapter(serviceName) {
    return this.adapters.has(serviceName);
  }

  /**
   * List all available adapters
   * @returns {Array<string>} Array of available service names
   */
  listAdapters() {
    return Array.from(this.adapters.keys());
  }
}

// Export singleton instance
module.exports = new AdapterRegistry();