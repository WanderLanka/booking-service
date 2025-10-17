# WanderLanka Booking Service

Booking microservice focusing on Tour Package bookings (Transport and Accommodation stubs included).

## Structure

```
booking-service/
  index.js
  package.json
  .env (create)
  src/
    config/
      index.js
      database.js
    middleware/
      auth.js
      validate.js
    models/
      TourPackageBooking.js
    tourpackage/
      common/
        index.js
      createBooking/
        index.js
      getBooking/
        index.js
      listBookings/
        index.js
      updateBooking/
        index.js
      cancelBooking/
        index.js
      routes.js
    transport/
      README.md
    accommodation/
      README.md
    utils/
      pricing.js
    validators/
      tourPackageValidators.js
```

## API

Base path: `/tourpackage`

- POST `/bookings` (auth required)
  - body: { userId, packageId, startDate, endDate, notes? }
  - creates a booking (status=pending) if no overlap; computes simple price

- GET `/bookings` (auth required)
  - query: packageId?, userId?, status?

- GET `/bookings/:id` (auth required)

- PATCH `/bookings/:id` (auth required)
  - body: startDate?, endDate?, status?, notes?
  - prevents overlaps on date changes

- POST `/bookings/:id/cancel` (auth required)

## Env

Create `.env` at project root:

```
PORT=3009
# Booking service dedicated DB (preferred)
BOOKING_MONGO_URI=mongodb://localhost:27017/wanderlanka_booking
# Optional explicit db name if your URI omits it
# BOOKING_DB_NAME=wanderlanka_booking

# Fallbacks (used only if BOOKING_MONGO_URI is not set)
# MONGO_URI=mongodb://localhost:27017/wanderlanka_booking

JWT_SECRET=dev-secret
CORS_ORIGINS=http://localhost:5173
```

## Run

- Install deps
- Start dev

If using npm scripts:

- `npm run dev`

Health check: `GET /health`
