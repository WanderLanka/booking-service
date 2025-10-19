// Test script to verify booking model and database storage
const mongoose = require('mongoose');
require('dotenv').config();

// Import the Booking model
const Booking = require('./src/models/Booking');

async function testBookingModel() {
  console.log('🧪 Testing Booking Model and Database Storage...\n');

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Create Accommodation Booking
    console.log('1️⃣ Testing Accommodation Booking...');
    const accommodationBooking = new Booking({
      userId: new mongoose.Types.ObjectId(),
      bookingId: Booking.generateBookingId('accommodation'),
      confirmationNumber: Booking.generateConfirmationNumber(),
      serviceType: 'accommodation',
      serviceId: 'hotel_001',
      serviceName: 'Grand Palace Hotel',
      serviceProvider: 'Palace Hotels',
      status: 'confirmed',
      totalAmount: 250.00,
      currency: 'LKR',
      contactInfo: {
        email: 'test@example.com',
        phone: '+94771234567'
      },
      bookingDetails: {
        currency: 'LKR',
        checkInDate: new Date('2025-01-20'),
        checkOutDate: new Date('2025-01-22'),
        rooms: 1,
        adults: 2,
        children: 0,
        nights: 2
      },
      paymentDetails: {
        transactionId: 'TXN_ACC_001',
        paymentStatus: 'completed',
        paymentMethod: 'card',
        cardholderName: 'John Doe',
        cardLast4: '1234',
        paymentDate: new Date()
      },
      reservationDetails: {
        reservationId: 'RES_ACC_001',
        reservationStatus: 'confirmed',
        confirmedAt: new Date()
      }
    });

    // Add timeline steps
    accommodationBooking.addTimelineStep('booking_created', 'completed', 'Booking created successfully');
    accommodationBooking.addTimelineStep('payment_completed', 'completed', 'Payment processed');
    accommodationBooking.addTimelineStep('booking_confirmed', 'completed', 'Booking confirmed');

    await accommodationBooking.save();
    console.log('✅ Accommodation booking saved:', {
      bookingId: accommodationBooking.bookingId,
      confirmationNumber: accommodationBooking.confirmationNumber,
      serviceType: accommodationBooking.serviceType
    });

    // Test 2: Create Transportation Booking
    console.log('\n2️⃣ Testing Transportation Booking...');
    const transportationBooking = new Booking({
      userId: new mongoose.Types.ObjectId(),
      bookingId: Booking.generateBookingId('transportation'),
      confirmationNumber: Booking.generateConfirmationNumber(),
      serviceType: 'transportation',
      serviceId: 'car_001',
      serviceName: 'Luxury Car Rental',
      serviceProvider: 'Elite Cars',
      status: 'confirmed',
      totalAmount: 150.00,
      currency: 'LKR',
      contactInfo: {
        email: 'transport@example.com',
        phone: '+94771234568'
      },
      bookingDetails: {
        currency: 'LKR',
        startDate: new Date('2025-01-25'),
        days: 3,
        passengers: 4,
        pickupLocation: 'Colombo Airport',
        dropoffLocation: 'Kandy Hotel',
        estimatedDistance: 120,
        pricingPerKm: 1.25
      },
      paymentDetails: {
        transactionId: 'TXN_TRN_001',
        paymentStatus: 'completed',
        paymentMethod: 'card',
        cardholderName: 'Jane Smith',
        cardLast4: '5678',
        paymentDate: new Date()
      },
      reservationDetails: {
        reservationId: 'RES_TRN_001',
        reservationStatus: 'confirmed',
        confirmedAt: new Date()
      }
    });

    await transportationBooking.save();
    console.log('✅ Transportation booking saved:', {
      bookingId: transportationBooking.bookingId,
      confirmationNumber: transportationBooking.confirmationNumber,
      serviceType: transportationBooking.serviceType
    });

    // Test 3: Create Guide Booking
    console.log('\n3️⃣ Testing Guide Booking...');
    const guideBooking = new Booking({
      userId: new mongoose.Types.ObjectId(),
      bookingId: Booking.generateBookingId('guide'),
      confirmationNumber: Booking.generateConfirmationNumber(),
      serviceType: 'guide',
      serviceId: 'guide_001',
      serviceName: 'Cultural Tour Guide',
      serviceProvider: 'Local Guides',
      status: 'confirmed',
      totalAmount: 75.00,
      currency: 'LKR',
      contactInfo: {
        email: 'guide@example.com',
        phone: '+94771234569'
      },
      bookingDetails: {
        currency: 'LKR',
        tourDate: new Date('2025-01-28'),
        duration: '4 hours',
        groupSize: 6,
        specialRequests: 'English speaking guide',
        guideLanguages: ['English', 'Sinhala']
      },
      paymentDetails: {
        transactionId: 'TXN_GDE_001',
        paymentStatus: 'completed',
        paymentMethod: 'card',
        cardholderName: 'Bob Wilson',
        cardLast4: '9012',
        paymentDate: new Date()
      },
      reservationDetails: {
        reservationId: 'RES_GDE_001',
        reservationStatus: 'confirmed',
        confirmedAt: new Date()
      }
    });

    await guideBooking.save();
    console.log('✅ Guide booking saved:', {
      bookingId: guideBooking.bookingId,
      confirmationNumber: guideBooking.confirmationNumber,
      serviceType: guideBooking.serviceType
    });

    // Test 4: Query bookings
    console.log('\n4️⃣ Testing Booking Queries...');
    const allBookings = await Booking.find({}).select('bookingId serviceType status totalAmount');
    console.log('📋 All bookings in database:', allBookings.map(b => ({
      bookingId: b.bookingId,
      serviceType: b.serviceType,
      status: b.status,
      amount: b.totalAmount
    })));

    // Test 5: Test service-specific methods
    console.log('\n5️⃣ Testing Service-Specific Methods...');
    const accommodationDetails = accommodationBooking.getServiceSpecificDetails();
    console.log('🏨 Accommodation details:', accommodationDetails);

    const transportationDetails = transportationBooking.getServiceSpecificDetails();
    console.log('🚗 Transportation details:', transportationDetails);

    const guideDetails = guideBooking.getServiceSpecificDetails();
    console.log('👨‍🏫 Guide details:', guideDetails);

    // Test 6: Test booking type checks
    console.log('\n6️⃣ Testing Booking Type Checks...');
    console.log('🏨 Is accommodation:', accommodationBooking.isAccommodation());
    console.log('🚗 Is transportation:', transportationBooking.isTransportation());
    console.log('👨‍🏫 Is guide:', guideBooking.isGuide());

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n💾 Database Status:');
    console.log(`   - Total bookings: ${allBookings.length}`);
    console.log(`   - Accommodation: ${allBookings.filter(b => b.serviceType === 'accommodation').length}`);
    console.log(`   - Transportation: ${allBookings.filter(b => b.serviceType === 'transportation').length}`);
    console.log(`   - Guide: ${allBookings.filter(b => b.serviceType === 'guide').length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n📊 MongoDB connection closed');
  }
}

// Run the test
testBookingModel();