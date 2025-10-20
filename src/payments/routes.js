const express = require('express');
const authMiddleware = require('../middleware/auth');
const { stripe } = require('../services/stripeClient');
const EnhancedBookingService = require('../services/EnhancedBookingService');

const router = express.Router();
const enhancedBookingService = new EnhancedBookingService();

function toEnhancedPayloadFromSimplified(body, user) {
  // Accommodation path
  if (body.accommodationId && body.checkInDate && body.checkOutDate) {
    const { accommodationId, checkInDate, checkOutDate, selectedRooms = [], guestDetails = {} } = body;
    const nights = Math.max(1, Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000*60*60*24)));
    const roomsCount = selectedRooms.reduce((t, r) => t + (parseInt(r.quantity) || 0), 0);
    const subtotal = selectedRooms.reduce((t, r) => t + (Number(r.pricePerNight) * (parseInt(r.quantity)||0) * nights), 0);
    const serviceFee = 25;
    const totalAmount = subtotal + serviceFee;

    return {
      serviceType: 'accommodation',
      serviceId: accommodationId,
      serviceProvider: body.accommodationProviderId || 'Unknown Provider', // Include accommodation provider ID
      serviceName: 'Accommodation',
      totalAmount,
      bookingDetails: {
        currency: 'LKR',
        checkInDate,
        checkOutDate,
        rooms: roomsCount,
        adults: Math.max(1, roomsCount * 2),
        children: 0,
        nights,
        roomBreakdown: selectedRooms
      },
      paymentDetails: {
        cardholderName: `${(body.guestDetails?.firstName) || 'Guest'} ${(body.guestDetails?.lastName) || ''}`.trim()
      },
      contactInfo: {
        email: body.guestDetails?.email || 'guest@example.com',
        phone: body.guestDetails?.phone || 'N/A',
        emergencyContact: '',
        firstName: body.guestDetails?.firstName || 'Guest',
        lastName: body.guestDetails?.lastName || ''
      },
      userId: user?.userId
    };
  }

  // Transportation path (transportation or transport)
  if ((body.transportId || body.vehicleId) && body.startDate && body.days) {
    const transportId = body.transportId || body.vehicleId;
    const pricingPerKm = Number(body.pricingPerKm || body.pricePerKm || 0);
    const estDistance = Number(body.estimatedDistance || 0);
    const days = parseInt(body.days) || 1;
    const serviceFee = 500; // LKR
    const subtotal = pricingPerKm * estDistance * days;
    const totalAmount = subtotal + serviceFee;

    console.log('🚗 Transport booking transformation:', {
      transportId,
      transportProviderId: body.transportProviderId,
      hasTransportProviderId: !!body.transportProviderId,
      bodyKeys: Object.keys(body)
    });

    return {
      serviceType: 'transportation',
      serviceId: transportId,
      serviceProvider: body.transportProviderId || 'Unknown Provider', // Include transport provider ID
      serviceName: 'Transportation',
      totalAmount,
      bookingDetails: {
        currency: 'LKR',
        startDate: body.startDate,
        days,
        passengers: parseInt(body.passengers) || 1,
        pickupLocation: body.pickupLocation || '',
        dropoffLocation: body.dropoffLocation || '',
        estimatedDistance: estDistance,
        pricingPerKm,
        vehicleType: body.vehicleType || body.type || '',
        departureTime: body.departureTime || ''
      },
      paymentDetails: {
        cardholderName: `${(body.guestDetails?.firstName) || 'Guest'} ${(body.guestDetails?.lastName) || ''}`.trim()
      },
      contactInfo: {
        email: body.guestDetails?.email || 'guest@example.com',
        phone: body.guestDetails?.phone || 'N/A',
        emergencyContact: '',
        firstName: body.guestDetails?.firstName || 'Guest',
        lastName: body.guestDetails?.lastName || ''
      },
      userId: user?.userId
    };
  }

  throw new Error('Unsupported booking payload');
}

// Create a checkout session
router.post('/create-session', authMiddleware, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ success: false, message: 'Stripe not configured' });

    console.log('🎯 Payment create-session received:', {
      serviceType: req.body.serviceType,
      transportId: req.body.transportId,
      transportProviderId: req.body.transportProviderId,
      bodyKeys: Object.keys(req.body)
    });

    const enhanced = toEnhancedPayloadFromSimplified(req.body, req.user);
    
    console.log('🔄 Enhanced payload created:', {
      serviceType: enhanced.serviceType,
      serviceProvider: enhanced.serviceProvider,
      serviceId: enhanced.serviceId
    });
    const amountLkr = Math.round((enhanced.totalAmount || 0) * 100);

    const rb = (req.body.selectedRooms || []).map(r => ({ t: r.roomType || r.type, q: parseInt(r.quantity)||0 }));
    const metadata = { serviceType: enhanced.serviceType, serviceId: enhanced.serviceId, userId: enhanced.userId || '', email: enhanced.contactInfo.email, phone: enhanced.contactInfo.phone };
    if (enhanced.serviceType === 'accommodation') {
      Object.assign(metadata, {
        checkInDate: enhanced.bookingDetails.checkInDate,
        checkOutDate: enhanced.bookingDetails.checkOutDate,
        rooms: String(enhanced.bookingDetails.rooms),
        nights: String(enhanced.bookingDetails.nights),
        roomBreakdown: JSON.stringify(rb),
        serviceProvider: enhanced.serviceProvider || 'Unknown Provider'
      });
    } else if (enhanced.serviceType === 'transportation') {
      Object.assign(metadata, {
        startDate: enhanced.bookingDetails.startDate,
        days: String(enhanced.bookingDetails.days),
        passengers: String(enhanced.bookingDetails.passengers),
        pickupLocation: enhanced.bookingDetails.pickupLocation,
        dropoffLocation: enhanced.bookingDetails.dropoffLocation,
        estimatedDistance: String(enhanced.bookingDetails.estimatedDistance),
        pricingPerKm: String(enhanced.bookingDetails.pricingPerKm),
        vehicleType: enhanced.bookingDetails.vehicleType || '',
        serviceProvider: enhanced.serviceProvider || 'Unknown Provider'
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'lkr',
            product_data: { name: enhanced.serviceType === 'accommodation' ? 'Accommodation Booking' : 'Transportation Booking' },
            unit_amount: amountLkr
          },
          quantity: 1
        }
      ],
      success_url: `${process.env.BOOKING_PUBLIC_URL || 'http://localhost:3009'}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BOOKING_PUBLIC_URL || 'http://localhost:3009'}/payments/cancel`,
      metadata
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  }
});

// Note: Do NOT require auth here; browser redirect from Stripe won't carry JWT
router.get('/success', async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ success: false, message: 'Stripe not configured' });
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ success: false, message: 'Missing session_id' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ success: false, message: 'Payment not completed' });
    }

    const md = session.metadata || {};
    let parsedBreakdown = [];
    try { parsedBreakdown = JSON.parse(md.roomBreakdown || '[]'); } catch {}
    const roomBreakdown = Array.isArray(parsedBreakdown)
      ? parsedBreakdown.filter(x => x && (x.t || x.roomType)).map(x => ({
          roomType: x.roomType || x.t,
          quantity: parseInt(x.quantity || x.q || 0) || 0
        }))
      : [];
    const isAccommodation = (md.serviceType || 'accommodation') === 'accommodation';
    const enhanced = isAccommodation ? {
      serviceType: 'accommodation',
      serviceId: md.serviceId,
      serviceName: 'Accommodation',
      totalAmount: session.amount_total ? session.amount_total / 100 : 0,
      bookingDetails: {
        currency: session.currency?.toUpperCase() || 'LKR',
        checkInDate: md.checkInDate,
        checkOutDate: md.checkOutDate,
        rooms: parseInt(md.rooms || '1'),
        adults: Math.max(1, parseInt(md.rooms || '1') * 2),
        children: 0,
        nights: parseInt(md.nights || '1'),
        roomBreakdown
      },
      paymentDetails: {
        paymentMethod: 'stripe_checkout',
        transactionId: session.payment_intent || session.id,
        paymentStatus: 'completed'
      },
      contactInfo: {
        email: md.email || 'guest@example.com',
        phone: md.phone || 'N/A',
        firstName: 'Guest',
        lastName: ''
      },
      userId: md.userId || null
    } : {
      serviceType: 'transportation',
      serviceId: md.serviceId,
      serviceProvider: md.serviceProvider || 'Unknown Provider', // Include service provider
      serviceName: 'Transportation',
      totalAmount: session.amount_total ? session.amount_total / 100 : 0,
      bookingDetails: {
        currency: session.currency?.toUpperCase() || 'LKR',
        startDate: md.startDate,
        days: parseInt(md.days || '1'),
        passengers: parseInt(md.passengers || '1'),
        pickupLocation: md.pickupLocation,
        dropoffLocation: md.dropoffLocation,
        estimatedDistance: parseFloat(md.estimatedDistance || '0'),
        pricingPerKm: parseFloat(md.pricingPerKm || '0'),
        vehicleType: md.vehicleType || ''
      },
      paymentDetails: {
        paymentMethod: 'stripe_checkout',
        transactionId: session.payment_intent || session.id,
        paymentStatus: 'completed'
      },
      contactInfo: {
        email: md.email || 'guest@example.com',
        phone: md.phone || 'N/A',
        firstName: 'Guest',
        lastName: ''
      },
      userId: md.userId || null
    };

    try {
      const result = await enhancedBookingService.createCompleteBooking(enhanced);
      // Decrease availability after booking persisted
      // Adjust accommodation availability immediately after success (previous behavior)
      if (isAccommodation) {
        const adapter = require('../adapters').getAccommodationAdapter();
        let breakdown = [];
        try { breakdown = JSON.parse(md.roomBreakdown || '[]'); } catch {}
        if (Array.isArray(breakdown) && breakdown.length > 0) {
          const adjustments = breakdown
            .filter(x => x && (x.t || x.roomType) && (x.q || x.quantity))
            .map(x => ({ type: x.t || x.roomType, quantity: parseInt(x.q || x.quantity) || 0 }));
          if (adjustments.length) {
            await adapter.adjustAvailability(md.serviceId, adjustments, 'decrease');
          }
        }
      }
      // Persist payment record in payment-service
      try {
        const paymentAdapter = require('../adapters').getPaymentAdapter();
        const amounts = isAccommodation ?
          { accommodation: enhanced.totalAmount || 0, transport: 0, guide: 0, total: enhanced.totalAmount || 0 } :
          { accommodation: 0, transport: enhanced.totalAmount || 0, guide: 0, total: enhanced.totalAmount || 0 };
        await paymentAdapter.createPaymentRecord({
          userId: enhanced.userId || md.userId || 'unknown',
          paymentId: enhanced.paymentDetails?.transactionId || `PAY_${Date.now()}`,
          amount: enhanced.totalAmount || 0,
          currency: enhanced.bookingDetails?.currency || 'LKR',
          paymentMethod: 'stripe_checkout',
          status: 'completed',
          serviceType: isAccommodation ? 'accommodation' : 'transport',
          serviceId: enhanced.serviceId,
          description: isAccommodation ? 'Accommodation booking payment' : 'Transportation booking payment',
          customerInfo: {
            name: `${enhanced.contactInfo?.firstName || 'Guest'} ${enhanced.contactInfo?.lastName || ''}`.trim(),
            email: enhanced.contactInfo?.email || 'guest@example.com',
            phone: enhanced.contactInfo?.phone || 'N/A'
          },
          paymentDetails: {
            transactionId: enhanced.paymentDetails?.transactionId,
            gatewayResponse: {},
            gatewayName: 'stripe',
            processedAt: new Date()
          },
          providers: {
            accommodation: { providerId: '', providerName: isAccommodation ? (enhanced.serviceName || 'Accommodation') : '' },
            transport: { providerId: '', providerName: isAccommodation ? '' : (enhanced.serviceName || 'Transportation') },
            guide: { providerId: '', providerName: '' }
          },
          amounts,
          metadata: { source: 'booking-service', bookingId: result?.data?.bookingId }
        });
      } catch (e) { /* swallow payment record errors to not block redirect */ }

      // For transportation, mark vehicle unavailable (booked)
      if (!isAccommodation) {
        try {
          const transportAdapter = require('../adapters').getTransportationAdapter();
          await transportAdapter.setAvailability(enhanced.serviceId, 'unavailable');
        } catch (e) { /* ignore availability errors */ }
      }

      const back = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/user/${isAccommodation ? 'accommodations' : 'transportation'}?bookingStatus=success`;
      return res.redirect(back);
    } catch (persistErr) {
      const back = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/user/${isAccommodation ? 'accommodations' : 'transportation'}?bookingStatus=failed`;
      return res.redirect(back);
    }
  } catch (err) {
    const md = (err && err.metadata) || {};
    const isAccommodation = (md.serviceType || 'accommodation') === 'accommodation';
    const back = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/user/${isAccommodation ? 'accommodations' : 'transportation'}?bookingStatus=failed`;
    try { return res.redirect(back); } catch { return next(err); }
  }
});

// Cancel handler: simply redirect back with failure status
router.get('/cancel', async (req, res) => {
  const back = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/user/accommodations?bookingStatus=cancelled`;
  return res.redirect(back);
});

module.exports = router;
