# Guide Availability Check on Booking Approval

## Overview
When a tour guide approves a booking request, the system automatically checks if the guide already has another approved or confirmed booking on the same dates. This prevents double-booking and ensures guides can only accept bookings when they are available.

## Implementation Details

### Backend Logic (`/src/tourpackage_booking/approve/index.js`)

#### Validation Steps
1. **Fetch the booking** to be approved
2. **Check booking status** - Only `pending` bookings can be approved
3. **Query for conflicts** - Search for existing bookings with:
   - Same `guideId`
   - Status is `approved` OR `confirmed`
   - Date ranges overlap with the requested booking
4. **Date overlap detection** using the formula:
   ```
   existing.startDate <= new.endDate AND existing.endDate >= new.startDate
   ```
5. **Atomic update** - Uses `findOneAndUpdate` with status check to prevent race conditions

#### Response Codes
- **200 OK** - Booking approved successfully
- **400 Bad Request** - Booking is not in pending status
- **404 Not Found** - Booking doesn't exist
- **409 Conflict** - Guide has conflicting booking on same dates

### Conflict Response Format
```json
{
  "success": false,
  "error": "Guide is not available on the selected dates",
  "message": "You already have an approved or confirmed booking that overlaps with this date range",
  "conflict": {
    "bookingId": "507f1f77bcf86cd799439011",
    "packageTitle": "Ancient Cities Tour",
    "startDate": "2025-10-20T00:00:00.000Z",
    "endDate": "2025-10-23T00:00:00.000Z",
    "status": "confirmed"
  }
}
```

### Database Optimization
A compound index is created for efficient conflict queries:
```javascript
{ guideId: 1, status: 1, startDate: 1, endDate: 1 }
```

This index optimizes the following query pattern:
```javascript
TourPackageBooking.findOne({
  guideId: booking.guideId,
  status: { $in: ['approved', 'confirmed'] },
  startDate: { $lte: booking.endDate },
  endDate: { $gte: booking.startDate }
})
```

## Frontend Implementation

### Mobile App (`/app/tourGuide/bookings.tsx`)

#### Error Handling
The frontend detects 409 conflict errors and displays a user-friendly alert with:
- Conflicting booking details (package name, dates, status)
- Option to decline the conflicting request
- Clear explanation of why approval failed

#### User Experience Flow
1. Guide clicks **"Approve"** button
2. System checks availability on backend
3. **If available:**
   - Booking status changes to `approved`
   - Success alert: "Booking was approved. The client can now proceed with payment."
4. **If conflict detected:**
   - Alert shows conflicting booking details
   - Options: "Decline This Request" or "OK"
   - Guide can review their calendar to resolve conflicts

### Sample Alert Message
```
Booking Conflict

You already have a confirmed booking for "Ancient Cities Tour" 
from Oct 20, 2025 to Oct 23, 2025.

You cannot approve this request as it overlaps with your existing booking.

[Decline This Request]  [OK]
```

## Race Condition Prevention

### Atomic Update Pattern
The implementation uses MongoDB's atomic `findOneAndUpdate` operation:

```javascript
const updatedBooking = await TourPackageBooking.findOneAndUpdate(
  { 
    _id: booking._id, 
    status: 'pending' // Ensure status hasn't changed
  },
  { 
    $set: { status: 'approved' }
  },
  { 
    new: true,
    runValidators: true 
  }
);

if (!updatedBooking) {
  // Status changed between check and update
  return res.status(400).json({
    error: 'Booking status has changed. Please refresh and try again.'
  });
}
```

This prevents scenarios where:
- Two guides try to approve different bookings for the same date simultaneously
- The booking status is changed by another process during approval
- Network delays cause stale data issues

## Testing Scenarios

### Test Case 1: Successful Approval
**Given:** Guide has no conflicting bookings  
**When:** Guide approves a pending booking  
**Then:** Booking status changes to `approved`

### Test Case 2: Date Conflict Detection
**Given:** Guide has confirmed booking from Oct 20-23  
**When:** Guide tries to approve booking from Oct 22-25  
**Then:** 409 error returned with conflict details

### Test Case 3: Edge Case - Same Start/End Date
**Given:** Guide has booking on Oct 20 (single day)  
**When:** Guide tries to approve another booking on Oct 20  
**Then:** Conflict detected (same day overlap)

### Test Case 4: No Conflict - Adjacent Dates
**Given:** Guide has booking ending Oct 20  
**When:** Guide approves booking starting Oct 21  
**Then:** Approval succeeds (no overlap)

### Test Case 5: Race Condition
**Given:** Two approval requests sent simultaneously  
**When:** Both try to approve conflicting bookings  
**Then:** First succeeds, second gets 409 conflict

### Test Case 6: Status Change During Approval
**Given:** Booking is pending  
**When:** Status changes to cancelled during approval process  
**Then:** 400 error returned, guide prompted to refresh

## API Usage Example

### Request
```bash
POST /api/booking/tourpackage_booking/approve/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

### Success Response
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "approved",
    "packageTitle": "Coastal Adventure",
    "startDate": "2025-11-01T00:00:00.000Z",
    "endDate": "2025-11-03T00:00:00.000Z",
    "guideId": "507f191e810c19729de860ea",
    ...
  },
  "message": "Booking approved successfully. Client can now proceed with payment."
}
```

### Conflict Response
```json
{
  "success": false,
  "error": "Guide is not available on the selected dates",
  "message": "You already have an approved or confirmed booking that overlaps with this date range",
  "conflict": {
    "bookingId": "507f1f77bcf86cd799439012",
    "packageTitle": "Mountain Trek",
    "startDate": "2025-11-01T00:00:00.000Z",
    "endDate": "2025-11-04T00:00:00.000Z",
    "status": "confirmed"
  }
}
```

## Future Enhancements

1. **Partial Availability**: Allow guides to set specific available hours per day
2. **Multi-Guide Support**: Enable package bookings with multiple guides
3. **Calendar Integration**: Sync with external calendars (Google, Outlook)
4. **Automatic Conflict Resolution**: Suggest alternative dates to clients
5. **Buffer Time**: Add configurable preparation/rest time between bookings
6. **Notification System**: Alert guides of pending approvals via push notifications

## Related Documentation
- [Booking Flow Guide](./BOOKING_FLOW_GUIDE.md)
- [Cancellation Policies](./CANCELLATION_POLICY.md)
- [Payment Processing](./PAYMENT_PROCESSING.md)
