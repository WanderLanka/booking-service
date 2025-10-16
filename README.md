# WanderLanka Booking Service

Booking microservice focusing on Tour Guide bookings (Transport and Accommodation stubs included).

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
      TourGuideReservation.js
    tourguide/
      common/
        index.js
      createReservation/
        index.js
      getReservation/
        index.js
      listReservations/
        index.js
      updateReservation/
        index.js
      cancelReservation/
        index.js
      routes.js
    transport/
      README.md
    accommodation/
      README.md
    utils/
      pricing.js
    validators/
      tourGuideValidators.js
```

## API

Base path: `/tourguide`

- POST `/reservations` (auth required)
  - body: { userId, guideId, startDate, endDate, notes? }
  - creates a reservation (status=pending) if no overlap; computes simple price

- GET `/reservations` (auth required)
  - query: guideId?, userId?, status?

- GET `/reservations/:id` (auth required)

- PATCH `/reservations/:id` (auth required)
  - body: startDate?, endDate?, status?, notes?
  - prevents overlaps on date changes

- POST `/reservations/:id/cancel` (auth required)

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
