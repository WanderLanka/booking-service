const mongoose = require('mongoose');

const TourPackageReservationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    packageId: { type: String, required: true },
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
    collection: 'tourpackage_reservations',
  }
);

TourPackageReservationSchema.index({ packageId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('TourPackageReservation', TourPackageReservationSchema);
