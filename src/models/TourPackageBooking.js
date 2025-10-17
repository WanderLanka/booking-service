const mongoose = require('mongoose');

const TourPackageBookingSchema = new mongoose.Schema(
  {
    // User and Package References
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    username: { type: String, required: true }, // Denormalized for quick access
    packageId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    packageSlug: { type: String, required: true }, // Denormalized for quick access
    packageTitle: { type: String, required: true },
    guideId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    guideUsername: { type: String, required: true },
    
    // Booking Details
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    numberOfTravelers: { type: Number, required: true, min: 1, default: 1 },
    
    // Pricing Information
    basePrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    
    // Payment Information
    payment: {
      method: { 
        type: String, 
        enum: ['mock', 'credit_card', 'paypal', 'bank_transfer'], 
        default: 'mock' 
      },
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
        default: 'pending',
      },
      transactionId: { type: String, unique: true, sparse: true },
      paidAt: { type: Date },
      refundedAt: { type: Date },
      refundAmount: { type: Number, min: 0 },
    },
    
    // Booking Status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    
    // Cancellation Details
    cancellation: {
      cancelledAt: { type: Date },
      cancelledBy: { type: mongoose.Schema.Types.ObjectId },
      reason: { type: String },
      refundEligible: { type: Boolean, default: false },
      refundAmount: { type: Number, min: 0 },
    },
    
    // Additional Information
    notes: { type: String, maxlength: 2000 },
    specialRequests: { type: String, maxlength: 1000 },
    contactPhone: { type: String },
    contactEmail: { type: String },
    
    // Audit Trail
    createdBy: { type: mongoose.Schema.Types.ObjectId },
    updatedBy: { type: mongoose.Schema.Types.ObjectId },
  },
  {
    timestamps: true,
    collection: 'tourpackage_bookings',
  }
);

// Indexes for efficient queries
TourPackageBookingSchema.index({ packageId: 1, startDate: 1, endDate: 1 });
TourPackageBookingSchema.index({ userId: 1, status: 1 });
TourPackageBookingSchema.index({ guideId: 1, status: 1 });
TourPackageBookingSchema.index({ 'payment.status': 1 });
TourPackageBookingSchema.index({ 'payment.transactionId': 1 });

// Virtual for duration in days
TourPackageBookingSchema.virtual('durationDays').get(function() {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.ceil((this.endDate - this.startDate) / MS_PER_DAY);
});

// Method to check if booking can be cancelled
TourPackageBookingSchema.methods.canBeCancelled = function(cancellationPolicy) {
  if (this.status === 'cancelled' || this.status === 'completed') {
    return { allowed: false, reason: 'Booking is already cancelled or completed' };
  }
  
  if (!cancellationPolicy || !cancellationPolicy.freeCancellation) {
    return { allowed: false, reason: 'This package does not allow free cancellation' };
  }
  
  const now = new Date();
  const startDate = new Date(this.startDate);
  const daysUntilStart = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
  
  const windowMap = {
    'anytime': 0,
    '1_day_before': 1,
    '7_days_before': 7,
    '14_days_before': 14,
  };
  
  const requiredDays = windowMap[cancellationPolicy.freeCancellationWindow] || 0;
  
  if (daysUntilStart < requiredDays) {
    return { 
      allowed: false, 
      reason: `Cancellation must be made at least ${requiredDays} day(s) before the start date`,
      daysUntilStart,
      requiredDays
    };
  }
  
  return { allowed: true, refundEligible: true };
};

// Method to calculate refund amount
TourPackageBookingSchema.methods.calculateRefund = function(cancellationPolicy) {
  const cancellationCheck = this.canBeCancelled(cancellationPolicy);
  
  if (!cancellationCheck.allowed || !cancellationCheck.refundEligible) {
    return 0;
  }
  
  // Full refund for free cancellation within window
  return this.totalPrice;
};

module.exports = mongoose.model('TourPackageBooking', TourPackageBookingSchema);
