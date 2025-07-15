require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors({ 
  origin: 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});


// Database connection with better error handling
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wanderlanka';
    console.log('Connecting to MongoDB:', mongoUri);
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};



const bookingSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  user: {
    type: String,
    required: true
  },
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  bookingType: {
    type: String,
    enum: ["day", "night"],
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
}, {
  timestamps: true,
  collection:'bookings'
});

const Booking = mongoose.model("Booking", bookingSchema);


// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(400).json({ error: 'Invalid token' });
  }
};

const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 3009;
    app.listen(PORT, () => {
      console.log(`🔐 Auth service running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

app.get('/current', verifyToken, async (req, res) => {
  try {
    console.log('Fetching bookings for hotel:', req.user.username);

    const bookings = await Booking.find({ user: req.user.username });

    // Fetch hotel and room details for each booking
    const bookingsWithDetails = await Promise.all(
  bookings.map(async (booking) => {
    try {
      const config = {
        headers: {
          Authorization: req.headers.authorization // Pass user's token to the other service
        }
      };
      const hotid = '686950d7157ab0885a0f1220'
      const roid = '686cf169841b98250856f05a'
      const strhot=(booking.hotel).toString()
      const strrom=(booking.room).toString()
      console.log(`Fetching hotel ${hotid} and room ${roid} details for booking ${booking._id}`);
      console.log(booking.hotel, booking.room);
      console.log(strhot, strrom);
      console.log(hotid, roid);
      console.log(typeof booking.hotel, typeof booking.room);
      console.log(typeof strhot, typeof strrom);
      console.log(typeof hotid, typeof roid); 

      const [hotelRes, roomRes] = await Promise.all([
        axios.get(`http://localhost:3000/accommodation/hotel/${strhot}`, config),
        axios.get(`http://localhost:3000/accommodation/rooms/${strrom}`, config)
      ]);

      return {
        ...booking._doc,
        hotel: hotelRes.data,
        room: roomRes.data
      };
    } catch (err) {
      console.error('Error fetching hotel/room:', err.message);
      return {
        ...booking._doc,
        hotel: {
          _id: booking.hotel,
          name: 'Hotel details unavailable',
          location: 'Unknown',
          error: err.message
        },
        room: {
          _id: booking.room,
          name: 'Room details unavailable',
          type: 'Unknown',
          error: err.message
        }
      };
    }
  })
);

     

    res.status(200).json(bookingsWithDetails);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

startServer();