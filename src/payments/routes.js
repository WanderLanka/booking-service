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

    // If pricing data is missing, use a default amount based on days
    const finalTotalAmount = totalAmount > serviceFee ? totalAmount : (days * 1000 + serviceFee);

    console.log('🚗 Transport booking transformation:', {
      transportId,
      transportProviderId: body.transportProviderId,
      hasTransportProviderId: !!body.transportProviderId,
      bodyKeys: Object.keys(body),
      pricingPerKm,
      estDistance,
      days,
      subtotal,
      totalAmount,
      finalTotalAmount
    });

    return {
      serviceType: 'transportation',
      serviceId: transportId,
      serviceProvider: body.transportProviderId || 'Unknown Provider', // Include transport provider ID
      serviceName: 'Transportation',
      totalAmount: finalTotalAmount,
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

    const enhanced = toEnhancedPayloadFromSimplified(req.body, req.user);
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
    
    // Check if this is a whole-trip payment (accommodationId: 'trip_total')
    const isWholeTripPayment = md.serviceId === 'trip_total' || md.accommodationId === 'trip_total';
    
    if (isWholeTripPayment) {
      // Handle whole-trip payment by calling itinerary service
      try {
        const back = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/user/booking-payment?bookingStatus=success&sessionId=${sessionId}`;
        return res.redirect(back);
      } catch (err) {
        const back = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/user/booking-payment?bookingStatus=failed`;
        return res.redirect(back);
      }
    }
    
    // Continue with individual booking logic for accommodation/transportation
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
        
        // Map service types to match Payment model
        const paymentServiceType = isAccommodation ? 'accommodation' : 'transport';
        
        // Prepare provider information
        const providers = {
          accommodation: { 
            providerId: enhanced.serviceProvider || '', 
            providerName: enhanced.serviceProvider || 'Unknown Provider' 
          },
          transport: { 
            providerId: enhanced.serviceProvider || '', 
            providerName: enhanced.serviceProvider || 'Unknown Provider' 
          },
          guide: { 
            providerId: '', 
            providerName: '' 
          }
        };
        
        // Prepare amounts breakdown
        const amounts = isAccommodation ?
          { 
            accommodation: enhanced.totalAmount || 0, 
            transport: 0, 
            guide: 0, 
            total: enhanced.totalAmount || 0 
          } :
          { 
            accommodation: 0, 
            transport: enhanced.totalAmount || 0, 
            guide: 0, 
            total: enhanced.totalAmount || 0 
          };
        
        const paymentRecord = {
          userId: enhanced.userId || md.userId || 'unknown',
          paymentId: enhanced.paymentDetails?.transactionId || `PAY_${Date.now()}`,
          amount: enhanced.totalAmount || 0,
          currency: enhanced.bookingDetails?.currency || 'LKR',
          paymentMethod: 'stripe_checkout',
          status: 'completed',
          serviceType: paymentServiceType,
          serviceId: enhanced.serviceId,
          description: isAccommodation ? 'Accommodation booking payment' : 'Transportation booking payment',
          customerInfo: {
            name: `${enhanced.contactInfo?.firstName || 'Guest'} ${enhanced.contactInfo?.lastName || ''}`.trim(),
            email: enhanced.contactInfo?.email || 'guest@example.com',
            phone: enhanced.contactInfo?.phone || 'N/A'
          },
          paymentDetails: {
            transactionId: enhanced.paymentDetails?.transactionId,
            gatewayResponse: {
              sessionId: session.id,
              paymentIntent: session.payment_intent,
              amountTotal: session.amount_total,
              currency: session.currency
            },
            gatewayName: 'stripe',
            processedAt: new Date()
          },
          providers,
          amounts,
          metadata: { 
            source: 'booking-service', 
            bookingId: result?.data?.bookingId,
            sessionId: session.id,
            serviceType: enhanced.serviceType
          }
        };
        
        console.log('💳 Creating payment record:', {
          userId: paymentRecord.userId,
          paymentId: paymentRecord.paymentId,
          amount: paymentRecord.amount,
          serviceType: paymentRecord.serviceType,
          serviceId: paymentRecord.serviceId
        });
        
        const paymentResult = await paymentAdapter.createPaymentRecord(paymentRecord);
        console.log('✅ Payment record created successfully:', paymentResult);
        
      } catch (paymentError) {
        console.error('❌ Failed to create payment record:', paymentError);
        // Don't fail the entire booking process if payment record creation fails
        // The booking is already created, so we just log the error
      }

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

// ========================================
// Mobile App Payment Intent Endpoints for Tour Guide Bookings
// ========================================

/**
 * POST /create-intent - Create payment intent for existing tour guide booking
 * Used by mobile app to initiate Stripe payment flow
 * Note: Booking should already exist (created via /tourpackage_booking/create)
 */
router.post('/create-intent', authMiddleware, async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ 
        success: false, 
        message: 'Stripe not configured' 
      });
    }

    console.log('💳 Creating payment intent for tour guide booking:', {
      user: req.user?.userId,
      bodyKeys: Object.keys(req.body)
    });

    const {
      bookingId,  // NEW: Accept bookingId if booking already exists
      serviceType,
      serviceId,
      serviceProvider,
      totalAmount,
      bookingDetails,
      contactInfo,
      guestDetails,
      tourPackageId,
      packageSlug,
      guideId,
      startDate,
      endDate,
      peopleCount,
      notes
    } = req.body;

    // Validate required fields
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid total amount'
      });
    }

    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: 'Guide ID is required'
      });
    }

    // Import TourPackageBooking model
    const TourPackageBooking = require('../models/TourPackageBooking');

    let booking;

    // Check if booking already exists or create new one
    if (bookingId) {
      // Fetch existing booking
      booking = await TourPackageBooking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Verify booking belongs to user (convert both to strings for comparison)
      const bookingUserId = String(booking.userId);
      const requestUserId = String(req.user?.userId);
      
      console.log('🔍 User verification:', {
        bookingUserId,
        requestUserId,
        match: bookingUserId === requestUserId
      });
      
      if (bookingUserId !== requestUserId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to booking'
        });
      }

      console.log('✅ Found existing booking:', booking._id);
    } else {
      // Create new pending booking (fallback for direct payment flow)
      const bookingData = {
        userId: req.user?.userId || 'guest',
        tourPackageId: tourPackageId || packageSlug,
        packageTitle: bookingDetails?.tourDate || 'Tour Package',
        packageSlug: packageSlug,
        guideId: guideId,
        startDate: startDate,
        endDate: endDate,
        peopleCount: peopleCount || 1,
        pricing: {
          currency: bookingDetails?.currency || 'LKR',
          unitAmount: totalAmount / (peopleCount || 1),
          totalAmount: totalAmount,
          perPerson: true
        },
        status: 'pending',
        payment: {
          provider: 'stripe',
          status: 'pending',
          currency: bookingDetails?.currency || 'LKR',
          amount: totalAmount,
          method: 'card'
        },
        notes: notes || '',
        guestDetails: guestDetails || {}
      };

      booking = await TourPackageBooking.create(bookingData);
      console.log('✅ New booking created:', booking._id);
    }

    // Create Stripe payment intent
    const amountInCents = Math.round(totalAmount * 100); // Convert to cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: (bookingDetails?.currency || 'lkr').toLowerCase(),
      metadata: {
        bookingId: String(booking._id),
        userId: req.user?.userId || 'guest',
        serviceType: 'guide',
        guideId: guideId || booking.guideId,
        tourPackageId: tourPackageId || booking.tourPackageId || packageSlug || '',
        startDate: startDate || booking.startDate,
        endDate: endDate || booking.endDate,
        peopleCount: String(peopleCount || booking.peopleCount || 1)
      },
      description: `Tour guide booking - ${booking.packageTitle}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Stripe payment intent created:', paymentIntent.id);

    // Update booking with payment intent ID
    booking.payment.intentId = paymentIntent.id;
    booking.payment.provider = 'stripe';
    await booking.save();

    // Generate confirmation number
    const confirmationNumber = `WL-${booking._id.toString().slice(-8).toUpperCase()}`;

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      bookingId: String(booking._id),
      confirmationNumber: confirmationNumber,
      amount: totalAmount,
      currency: bookingDetails?.currency || 'LKR'
    });

  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    next(error);
  }
});

/**
 * POST /confirm - Confirm payment and update booking status
 * Called by mobile app after successful Stripe payment
 */
router.post('/confirm', authMiddleware, async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ 
        success: false, 
        message: 'Stripe not configured' 
      });
    }

    const { paymentIntentId, bookingId } = req.body;

    console.log('🔄 Confirming payment:', { paymentIntentId, bookingId });

    if (!paymentIntentId || !bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID and booking ID are required'
      });
    }

    const TourPackageBooking = require('../models/TourPackageBooking');

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Find and update booking
    const booking = await TourPackageBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check guide availability before confirming
    if (booking.guideId) {
      const conflictingBooking = await TourPackageBooking.findOne({
        guideId: booking.guideId,
        status: 'confirmed',
        _id: { $ne: booking._id },
        $or: [
          {
            startDate: { $lte: booking.endDate },
            endDate: { $gte: booking.startDate }
          }
        ]
      });

      if (conflictingBooking) {
        // Refund the payment
        try {
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
          });
        } catch (refundError) {
          console.error('❌ Failed to refund payment:', refundError);
        }

        return res.status(409).json({
          success: false,
          message: 'Guide is not available on the selected dates. Payment has been refunded.',
          conflictingDates: {
            start: conflictingBooking.startDate,
            end: conflictingBooking.endDate
          }
        });
      }
    }

    // Update booking status to confirmed after successful payment
    booking.status = 'confirmed';
    booking.payment = {
      ...booking.payment,
      provider: 'stripe',
      intentId: paymentIntentId,
      status: 'captured', // Use 'captured' instead of 'succeeded' to match model enum
      method: 'card',
      paidAt: new Date()
    };
    await booking.save();

    console.log('✅ Booking status updated to confirmed:', booking._id);

    // Store payment record in payment-service
    try {
      const paymentAdapter = require('../adapters').getPaymentAdapter();
      
      const paymentRecord = {
        userId: booking.userId || req.user?.userId || 'guest',
        paymentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        paymentMethod: 'stripe',
        status: 'completed',
        serviceType: 'tour_guide',
        serviceId: booking.tourPackageId || booking.packageSlug,
        description: `Tour guide booking - ${booking.packageTitle}`,
        customerInfo: {
          name: booking.guestDetails?.fullName || `${booking.guestDetails?.firstName || 'Guest'} ${booking.guestDetails?.lastName || ''}`.trim(),
          email: booking.guestDetails?.email || 'guest@example.com',
          phone: booking.guestDetails?.phone || 'N/A'
        },
        paymentDetails: {
          transactionId: paymentIntent.id,
          gatewayResponse: {
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency
          },
          gatewayName: 'stripe',
          processedAt: new Date()
        },
        providers: {
          accommodation: { providerId: '', providerName: '' },
          transport: { providerId: '', providerName: '' },
          guide: { 
            providerId: booking.guideId || '', 
            providerName: booking.guideId || 'Unknown Guide' 
          }
        },
        amounts: {
          accommodation: 0,
          transport: 0,
          guide: paymentIntent.amount / 100,
          total: paymentIntent.amount / 100
        },
        metadata: {
          source: 'booking-service',
          bookingId: String(booking._id),
          paymentIntentId: paymentIntent.id,
          tourPackageId: booking.tourPackageId,
          packageSlug: booking.packageSlug,
          guideId: booking.guideId,
          startDate: booking.startDate,
          endDate: booking.endDate,
          peopleCount: booking.peopleCount
        }
      };

      console.log('💳 Creating payment record in payment-service:', {
        userId: paymentRecord.userId,
        paymentId: paymentRecord.paymentId,
        amount: paymentRecord.amount,
        serviceType: paymentRecord.serviceType
      });

      const paymentResult = await paymentAdapter.createPaymentRecord(paymentRecord);
      console.log('✅ Payment record created successfully:', paymentResult);

    } catch (paymentError) {
      console.error('❌ Failed to create payment record:', paymentError);
      // Don't fail the entire booking process if payment record creation fails
    }

    // Update guide metrics and block availability
    try {
      const { 
        incrementTourPackageBookingCount, 
        incrementGuideBookingCount, 
        blockGuideAvailability 
      } = require('../services/guideServiceClient');
      
      // Increment tour package booking count
      if (booking.tourPackageId) {
        await incrementTourPackageBookingCount(booking.tourPackageId, 1);
        console.log('✅ Tour package booking count incremented');
      }
      
      // Increment guide's total bookings metric and block the date range
      if (booking.guideId) {
        await incrementGuideBookingCount(booking.guideId, 1);
        console.log('✅ Guide booking count incremented');
        
        // Block the guide's availability for the booked date range
        await blockGuideAvailability(
          booking.guideId,
          booking.startDate,
          booking.endDate
        );
        console.log('✅ Guide availability blocked');
      }
    } catch (metricsError) {
      console.error('❌ Failed to update metrics or block availability:', metricsError);
      // Non-blocking error - don't fail the entire booking
    }

    const confirmationNumber = `WL-${booking._id.toString().slice(-8).toUpperCase()}`;

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        bookingId: String(booking._id),
        confirmationNumber: confirmationNumber,
        status: booking.status,
        paymentStatus: booking.payment.status,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency
      }
    });

  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    next(error);
  }
});

/**
 * POST /cancel-intent - Cancel payment intent
 * Called when user cancels payment in mobile app
 */
router.post('/cancel-intent', authMiddleware, async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ 
        success: false, 
        message: 'Stripe not configured' 
      });
    }

    const { paymentIntentId, bookingId } = req.body;

    console.log('🚫 Cancelling payment intent:', { paymentIntentId, bookingId });

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    // Cancel the payment intent in Stripe
    try {
      await stripe.paymentIntents.cancel(paymentIntentId);
      console.log('✅ Payment intent cancelled in Stripe');
    } catch (stripeError) {
      console.error('❌ Failed to cancel in Stripe:', stripeError);
      // Continue even if Stripe cancellation fails
    }

    // Update booking status if bookingId provided
    if (bookingId) {
      try {
        const TourPackageBooking = require('../models/TourPackageBooking');
        const booking = await TourPackageBooking.findById(bookingId);
        
        if (booking && booking.status === 'pending') {
          booking.status = 'cancelled';
          booking.payment.status = 'cancelled';
          await booking.save();
          console.log('✅ Booking cancelled:', bookingId);
        }
      } catch (bookingError) {
        console.error('❌ Failed to cancel booking:', bookingError);
      }
    }

    res.json({
      success: true,
      message: 'Payment intent cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling payment intent:', error);
    next(error);
  }
});

/**
 * GET /status/:paymentIntentId - Get payment status
 * Get the status of a payment intent
 */
router.get('/status/:paymentIntentId', authMiddleware, async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ 
        success: false, 
        message: 'Stripe not configured' 
      });
    }

    const { paymentIntentId } = req.params;

    console.log('🔍 Getting payment status:', { paymentIntentId });

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    res.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase()
    });

  } catch (error) {
    console.error('❌ Error getting payment status:', error);
    next(error);
  }
});

module.exports = router;
