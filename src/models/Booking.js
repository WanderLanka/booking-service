const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  // Primary identifiers
  bookingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  reservationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  confirmationNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Service information
  serviceType: {
    type: String,
    required: true,
    enum: ['accommodation', 'transportation', 'guide'],
    index: true
  },
  serviceId: {
    type: String,
    required: true
  },
  serviceName: {
    type: String,
    required: true
  },
  serviceProvider: {
    type: String,
    required: true
  },
  
  // Financial information
  totalAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'LKR'
  },
  
  // Booking status tracking
  status: {
    type: String,
    required: true,
    enum: [
      'pending',
      'reserved', 
      'confirmed', 
      'cancelled', 
      'completed',
      'failed',
      'payment_failed',
      'payment_success_pending_confirmation',
      'error'
    ],
    default: 'pending',
    index: true
  },
  
  // External service references
  reservationId: {
    type: String,
    index: true
  },
  paymentTransactionId: {
    type: String,
    index: true
  },
  confirmationNumber: {
    type: String,
    index: true
  },
  
  // Service-specific booking details
  bookingDetails: {
    currency: String,
    
    // Accommodation specific
    checkInDate: Date,
    checkOutDate: Date,
    rooms: Number,
    adults: Number,
    children: Number,
    nights: Number,
    roomType: String,
    amenities: [String],
    
    // Transportation specific
    startDate: Date,
    days: Number,
    passengers: Number,
    pickupLocation: String,
    dropoffLocation: String,
    estimatedDistance: Number,
    pricingPerKm: Number,
    vehicleDetails: {
      brand: String,
      model: String,
      licensePlate: String,
      driverName: String,
      driverPhone: String
    },
    pricingPerKm: Number,
    
    // Guide service specific
    tourDate: Date,
    duration: Number,
    groupSize: Number,
    specialRequests: String,
    guideDetails: {
      name: String,
      phone: String,
      languages: [String],
      specialties: [String]
    },
    
    // Additional flexible data
    additionalServices: [String],
    notes: String
  },
  
  // Store the complete service response data
  serviceResponseData: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Contact information
  contactInfo: {
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    emergencyContact: String
  },
  
  // Failure and cancellation tracking
  failureReason: String,
  cancellationReason: String,
  
  // Request metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      enum: ['web-app', 'mobile-app', 'api'],
      default: 'web-app'
    },
    referrer: String
  },
  
  // Timestamps
  timestamps: {
    created: {
      type: Date,
      default: Date.now,
      index: true
    },
    updated: {
      type: Date,
      default: Date.now
    },
    confirmed: Date,
    cancelled: Date,
    completed: Date
  }
}, {
  collection: 'bookings',
  timestamps: false // We handle timestamps manually for more control
});

// Indexes for efficient querying
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ serviceType: 1, status: 1 });
BookingSchema.index({ 'timestamps.created': -1 });
BookingSchema.index({ confirmationNumber: 1 }, { sparse: true });

// Pre-save middleware to update the 'updated' timestamp
BookingSchema.pre('save', function(next) {
  this.timestamps.updated = new Date();
  next();
});

BookingSchema.pre('findOneAndUpdate', function(next) {
  this.set({ 'timestamps.updated': new Date() });
  next();
});

// Virtual for booking age
BookingSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.timestamps.created) / (1000 * 60 * 60));
});

// Virtual for formatted confirmation number
BookingSchema.virtual('formattedConfirmationNumber').get(function() {
  if (!this.confirmationNumber) return null;
  return this.confirmationNumber.replace(/(.{2})/g, '$1-').slice(0, -1);
});

// Instance method to check if booking is modifiable
BookingSchema.methods.isModifiable = function() {
  return ['pending', 'reserved'].includes(this.status);
};

// Instance method to check if booking is cancellable
BookingSchema.methods.isCancellable = function() {
  return ['confirmed'].includes(this.status);
};

// Static method to find bookings by status
BookingSchema.statics.findByStatus = function(status, userId = null) {
  const query = { status };
  if (userId) query.userId = userId;
  return this.find(query);
};

// Static method to find recent bookings
BookingSchema.statics.findRecent = function(days = 7, userId = null) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const query = {
    'timestamps.created': { $gte: cutoffDate }
  };
  if (userId) query.userId = userId;
  
  return this.find(query).sort({ 'timestamps.created': -1 });
};

module.exports = mongoose.model('Booking', BookingSchema);