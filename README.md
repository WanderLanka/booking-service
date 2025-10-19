# Booking Service

Tour package booking microservice for WanderLanka. Connects to MongoDB database `wanderlanka_booking` and exposes endpoints to create, get, list, and cancel tour package bookings. Includes a mock payment gateway for non-production.

## Environment

Copy `.env.example` to `.env` and adjust as needed:

- PORT: default 3009
- BOOKING_MONGO_URI: e.g. mongodb://localhost:27017
- BOOKING_DB_NAME: wanderlanka_booking
- CORS_ORIGINS: comma-separated list
- LOG_LEVEL: info

## Run

1. Install deps in this folder
2. Start dev server with automatic reload

## Endpoints

Base URL: http://localhost:3009

- GET /health
- POST /tourpackage_booking/create
- GET /tourpackage_booking/get/:id
- GET /tourpackage_booking/list?userId=&tourPackageId=&status=
- POST /tourpackage_booking/cancel/:id
- POST /payments/mock/test

### Create booking payload

{
  "userId": "64b7e3f1c5a5f3c1a1b2c3d4",
  "tourPackageId": "64b7e3f1c5a5f3c1a1b2c3d5",
  "packageTitle": "Sri Lanka Highlights",
  "packageSlug": "sri-lanka-highlights",
  "guideId": "64b7e3f1c5a5f3c1a1b2c3d6",
  "startDate": "2025-11-01",
  "endDate": "2025-11-07",
  "peopleCount": 2,
  "pricing": { "currency": "USD", "unitAmount": 500, "totalAmount": 1000, "perPerson": true },
  "notes": "Honeymoon trip",
  "paymentMethod": "mock"
}

On success, booking is created and payment is captured via the mock gateway. The booking status becomes "confirmed" if capture succeeds, otherwise remains "pending".

## API Gateway

The API Gateway is configured to proxy booking requests under `/booking` to this service (default http://localhost:3009). Example through gateway:

- POST http://localhost:3000/booking/tourpackage_booking/create

## Implementation Notes

- Stack: Express, Mongoose, Joi, Winston, Morgan
- Model: `TourPackageBooking` collection `tourpackage_bookings`
- Mock Payment: `src/services/mockPaymentGateway.js` simulates intent + capture
- Folder structure mirrors other services under `src/`

## Next steps

- Add auth middleware verifying user identity (via JWT) once available
- Integrate with guide-service to increment `bookingCount` on confirmed payments
- Idempotency keys for create to avoid duplicate charges
- Webhook-style payment updates for real gateway (Stripe, PayHere, etc.)
