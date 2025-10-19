const axios = require('axios');

// Test the enhanced booking API endpoints
async function testEnhancedBookingAPI() {
  console.log('🧪 Testing Enhanced Booking API...\n');

  const baseURL = 'http://localhost:3009';
  
  // Mock JWT token for testing (replace with real token in production)
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzQ0YjA5NjAzMzUyMDBiYTQ2OGIxMmQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3MzQ2MTQ0MDAsImV4cCI6MTczNDcwMDgwMH0.test_signature';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${mockToken}`
  };

  // Test data for accommodation booking
  const testBookingData = {
    serviceType: 'accommodation',
    serviceId: 'hotel_001',
    serviceName: 'Grand Palace Hotel',
    totalAmount: 250.00,
    bookingDetails: {
      checkInDate: '2025-01-15',
      checkOutDate: '2025-01-18',
      rooms: 1,
      adults: 2,
      children: 0
    },
    paymentDetails: {
      cardNumber: '4111111111111111',
      expiryDate: '12/26',
      cvv: '123',
      cardholderName: 'John Doe'
    },
    contactInfo: {
      email: 'test@example.com',
      phone: '+94771234567'
    }
  };

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    console.log('');

    // Test 2: Create enhanced booking
    console.log('2️⃣ Testing enhanced booking creation...');
    const bookingResponse = await axios.post(
      `${baseURL}/api/bookings/enhanced`,
      testBookingData,
      { headers }
    );
    console.log('✅ Enhanced booking created:', bookingResponse.data);
    
    const bookingId = bookingResponse.data.data?.bookingId;
    console.log('');

    // Test 3: Get booking details (if booking was created)
    if (bookingId) {
      console.log('3️⃣ Testing get booking details...');
      const detailsResponse = await axios.get(
        `${baseURL}/api/bookings/enhanced/${bookingId}`,
        { headers }
      );
      console.log('✅ Booking details retrieved:', detailsResponse.data);
      console.log('');

      // Test 4: Cancel booking
      console.log('4️⃣ Testing booking cancellation...');
      const cancelResponse = await axios.post(
        `${baseURL}/api/bookings/enhanced/${bookingId}/cancel`,
        { reason: 'Test cancellation' },
        { headers }
      );
      console.log('✅ Booking cancelled:', cancelResponse.data);
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the booking service is running on port 3009');
      console.log('   Run: npm start in the booking-service directory');
    }
  }
}

// Run the test
testEnhancedBookingAPI();