const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    provider: { type: String, default: 'mockpay' },
    intentId: { type: String },
    status: { type: String, enum: ['pending', 'authorized', 'captured', 'failed', 'cancelled'], default: 'pending' },
    currency: { type: String, default: 'USD' },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['card', 'wallet', 'bank', 'cash', 'mock'], default: 'mock' },
    metadata: { type: Object },
  },
  { _id: false }
);

const TourPackageBookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tourPackageId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    // Snapshot some package fields for historical accuracy
    packageTitle: { type: String, required: true },
    packageSlug: { type: String },
    guideId: { type: mongoose.Schema.Types.ObjectId },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    peopleCount: { type: Number, min: 1, default: 1 },
    pricing: {
      currency: { type: String, default: 'USD' },
      unitAmount: { type: Number, required: true, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
      perPerson: { type: Boolean, default: false },
    },
  status: { type: String, enum: ['pending', 'approved', 'confirmed', 'completed', 'cancelled', 'declined'], default: 'pending', index: true },
    payment: PaymentSchema,
    notes: { type: String },
    // Cancellation policy snapshot from package
    cancellationPolicy: {
      freeCancellation: { type: Boolean, default: false },
      freeCancellationWindow: { type: String }, // '1_day_before', '7_days_before', etc.
    },
  },
  { timestamps: true, collection: 'tourpackage_bookings' }
);

// Compound index for efficient availability checking
// Used to find conflicting bookings by guide and date range
TourPackageBookingSchema.index({ guideId: 1, status: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('TourPackageBooking', TourPackageBookingSchema);
