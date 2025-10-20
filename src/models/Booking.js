const mongoose = require('mongoose');

// Base booking schema that supports all service types (accommodation, transportation, guide)
const BookingSchema = new mongoose.Schema({
  // Basic booking information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  confirmationNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Service information
  serviceType: {
    type: String,
    enum: ['accommodation', 'transportation', 'guide'],
    required: true
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
  
  // Booking status and timeline
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'failed'],
    default: 'pending'
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
    emergencyContact: String,
    firstName: String,
    lastName: String
  },
  
  // Service-specific booking details (flexible object for different service types)
  bookingDetails: {
    // Common fields
    currency: {
      type: String,
      default: 'LKR'
    },
    
    // Accommodation specific fields
    checkInDate: {
      type: Date,
      required: function() { return this.serviceType === 'accommodation'; }
    },
    checkOutDate: {
      type: Date,
      required: function() { return this.serviceType === 'accommodation'; }
    },
    rooms: {
      type: Number,
      required: function() { return this.serviceType === 'accommodation'; }
    },
    adults: {
      type: Number,
      required: function() { return this.serviceType === 'accommodation'; }
    },
    children: {
      type: Number,
      default: 0
    },
    nights: {
      type: Number,
      required: function() { return this.serviceType === 'accommodation'; }
    },
    roomBreakdown: [{
      roomType: String,
      quantity: Number,
      pricePerNight: Number
    }],
    
    // Transportation specific fields
    startDate: {
      type: Date,
      required: function() { return this.serviceType === 'transportation'; }
    },
    days: {
      type: Number,
      required: function() { return this.serviceType === 'transportation'; }
    },
    passengers: {
      type: Number,
      required: function() { return this.serviceType === 'transportation'; }
    },
    pickupLocation: {
      type: String,
      required: function() { return this.serviceType === 'transportation'; }
    },
    dropoffLocation: {
      type: String,
      required: function() { return this.serviceType === 'transportation'; }
    },
    estimatedDistance: Number,
    pricingPerKm: Number,
    vehicleType: String,
    departureTime: String,
    
    // Guide service specific fields
    tourDate: {
      type: Date,
      required: function() { return this.serviceType === 'guide'; }
    },
    duration: {
      type: String,
      required: function() { return this.serviceType === 'guide'; }
    },
    groupSize: {
      type: Number,
      required: function() { return this.serviceType === 'guide'; }
    },
    specialRequests: String,
    guideLanguages: [String]
  },
  
  // Payment information (stored securely - no sensitive card data)
  paymentDetails: {
    transactionId: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    paymentMethod: String,
    cardholderName: String,
    // Only store last 4 digits for reference
    cardLast4: String,
    paymentDate: Date,
    refundAmount: {
      type: Number,
      default: 0
    },
    refundDate: Date,
    refundReason: String
  },
  
  // Reservation details (for tracking service reservations)
  reservationDetails: {
    reservationId: String,
    tempReservationId: String,
    reservationStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'expired'],
      default: 'pending'
    },
    confirmedAt: Date,
    expiresAt: Date,
    cancellationReason: String
  },
  
  // Booking timeline for tracking progress
  bookingTimeline: [{
    step: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'skipped'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    message: String,
    errorDetails: String
  }],
  
  // Additional metadata
  metadata: {
    platform: {
      type: String,
      enum: ['web', 'mobile'],
      default: 'web'
    },
    userAgent: String,
    ipAddress: String,
    source: String,
    referrer: String
  },
  
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  cancellationDate: Date,
  cancellationReason: String
});

// Update the updatedAt field before saving
BookingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ bookingId: 1 });
BookingSchema.index({ confirmationNumber: 1 });
BookingSchema.index({ serviceType: 1, status: 1 });
BookingSchema.index({ 'paymentDetails.transactionId': 1 });
BookingSchema.index({ 'reservationDetails.reservationId': 1 });

// Methods for different service types
BookingSchema.methods.isAccommodation = function() {
  return this.serviceType === 'accommodation';
};

BookingSchema.methods.isTransportation = function() {
  return this.serviceType === 'transportation';
};

BookingSchema.methods.isGuide = function() {
  return this.serviceType === 'guide';
};

// Method to add timeline step
BookingSchema.methods.addTimelineStep = function(step, status, message = null) {
  this.bookingTimeline.push({
    step,
    status,
    message,
    timestamp: new Date()
  });
};

// Method to get service-specific details
BookingSchema.methods.getServiceSpecificDetails = function() {
  const details = {};
  
  if (this.isAccommodation()) {
    details.checkInDate = this.bookingDetails.checkInDate;
    details.checkOutDate = this.bookingDetails.checkOutDate;
    details.rooms = this.bookingDetails.rooms;
    details.adults = this.bookingDetails.adults;
    details.children = this.bookingDetails.children;
    details.nights = this.bookingDetails.nights;
  } else if (this.isTransportation()) {
    details.startDate = this.bookingDetails.startDate;
    details.days = this.bookingDetails.days;
    details.passengers = this.bookingDetails.passengers;
    details.pickupLocation = this.bookingDetails.pickupLocation;
    details.dropoffLocation = this.bookingDetails.dropoffLocation;
    details.estimatedDistance = this.bookingDetails.estimatedDistance;
  } else if (this.isGuide()) {
    details.tourDate = this.bookingDetails.tourDate;
    details.duration = this.bookingDetails.duration;
    details.groupSize = this.bookingDetails.groupSize;
    details.specialRequests = this.bookingDetails.specialRequests;
  }
  
  return details;
};

// Static method to generate booking ID
BookingSchema.statics.generateBookingId = function(serviceType) {
  const prefix = {
    'accommodation': 'ACC',
    'transportation': 'TRN',
    'guide': 'GDE'
  }[serviceType] || 'BKG';
  
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Static method to generate confirmation number
BookingSchema.statics.generateConfirmationNumber = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

module.exports = mongoose.model('Booking', BookingSchema);