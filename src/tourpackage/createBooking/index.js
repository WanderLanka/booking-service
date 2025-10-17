const TourPackageBooking = require('../../models/TourPackageBooking');
const { createBookingSchema } = require('../../validators/tourPackageValidators');
const validate = require('../../middleware/validate');
const { calculateTourPackagePrice } = require('../../utils/pricing');

// Express-style middleware chain: validate -> handler
const validateCreate = validate(createBookingSchema);

const handler = async (req, res) => {
	try {
		const { userId, packageId, startDate, endDate, notes } = req.body;

		// Basic overlap check for package's availability
		const overlapping = await TourPackageBooking.findOne({
			packageId,
			status: { $in: ['pending', 'confirmed'] },
			$or: [
				{ startDate: { $lt: new Date(endDate) }, endDate: { $gt: new Date(startDate) } },
			],
		});
		if (overlapping) {
			return res.status(409).json({ success: false, message: 'Package is not available for the selected dates' });
		}

		const { total } = calculateTourPackagePrice({ startDate, endDate });

		const booking = await TourPackageBooking.create({
			userId,
			packageId,
			startDate,
			endDate,
			totalPrice: total,
			status: 'pending',
			notes,
			createdBy: req.user?.id || userId,
			updatedBy: req.user?.id || userId,
		});

		return res.status(201).json({ success: true, data: booking });
	} catch (err) {
		console.error('Create tour package booking error:', err);
		return res.status(500).json({ success: false, message: 'Failed to create booking' });
	}
};

module.exports = [validateCreate, handler];
