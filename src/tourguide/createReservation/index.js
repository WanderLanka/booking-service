const TourGuideReservation = require('../../models/TourGuideReservation');
const { createReservationSchema } = require('../../validators/tourGuideValidators');
const validate = require('../../middleware/validate');
const { calculateTourGuidePrice } = require('../../utils/pricing');

// Express-style middleware chain: validate -> handler
const validateCreate = validate(createReservationSchema);

const handler = async (req, res) => {
	try {
		const { userId, guideId, startDate, endDate, notes } = req.body;

		// Basic overlap check for guide's availability
		const overlapping = await TourGuideReservation.findOne({
			guideId,
			status: { $in: ['pending', 'confirmed'] },
			$or: [
				{ startDate: { $lt: new Date(endDate) }, endDate: { $gt: new Date(startDate) } },
			],
		});
		if (overlapping) {
			return res.status(409).json({ success: false, message: 'Guide is not available for the selected dates' });
		}

		const { total } = calculateTourGuidePrice({ startDate, endDate });

		const reservation = await TourGuideReservation.create({
			userId,
			guideId,
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
		console.error('Create tour guide reservation error:', err);
		return res.status(500).json({ success: false, message: 'Failed to create reservation' });
	}
};

module.exports = [validateCreate, handler];
