const mongoose = require('mongoose');

const TourGuideReservationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    guideId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    notes: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'tourguide_reservations',
  }
);

TourGuideReservationSchema.index({ guideId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('TourGuideReservation', TourGuideReservationSchema);
