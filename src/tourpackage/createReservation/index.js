const TourPackageReservation = require('../../models/TourPackageReservation');
const { createReservationSchema } = require('../../validators/tourPackageValidators');
const validate = require('../../middleware/validate');
const { calculateTourPackagePrice } = require('../../utils/pricing');

// Express-style middleware chain: validate -> handler
const validateCreate = validate(createReservationSchema);

const handler = async (req, res) => {
	try {
		const { userId, packageId, startDate, endDate, notes } = req.body;

		// Basic overlap check for package's availability
		const overlapping = await TourPackageReservation.findOne({
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

		const reservation = await TourPackageReservation.create({
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

		return res.status(201).json({ success: true, data: reservation });
	} catch (err) {
		console.error('Create tour package reservation error:', err);
		return res.status(500).json({ success: false, message: 'Failed to create reservation' });
	}
};

module.exports = [validateCreate, handler];
