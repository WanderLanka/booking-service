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
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    peopleCount: { type: Number, min: 1, default: 1 },
    pricing: {
      currency: { type: String, default: 'USD' },
      unitAmount: { type: Number, required: true, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
      perPerson: { type: Boolean, default: false },
    },
  status: { type: String, enum: ['pending', 'approved', 'confirmed', 'cancelled'], default: 'pending', index: true },
    payment: PaymentSchema,
    notes: { type: String },
  },
  { timestamps: true, collection: 'tourpackage_bookings' }
);

module.exports = mongoose.model('TourPackageBooking', TourPackageBookingSchema);
