require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const certificateRoutes = require('./routes/certificates');
const progressRoutes = require('./routes/progress');
const announcementRoutes = require('./routes/announcements'); 
const userRoutes = require('./routes/users'); 

const app = express();
const PORT = process.env.PORT || 5001;
const mongoURI = process.env.MONGO_URI; 

// 1. MIDDLEWARE
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. UPDATED CORS: This allows your Netlify site to talk to this server
const allowedOrigins = [
    'http://127.0.0.1:5500', 
    'http://127.0.0.1:5501', 
    'http://localhost:5500', 
    'http://localhost:5501',
    'https://lms-final-prod.onrender.com',
    'https://meek-chebakia-d3053c.netlify.app' // Your Netlify Link
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps) or if it's in our allowed list
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS Policy: This origin is not allowed.'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle Preflight OPTIONS requests (Fixes the "Preflight" error)
app.options('*', cors());

// 3. API ROUTES
app.use('/api/auth', authRoutes); 
app.use('/api/courses', courseRoutes); 
app.use('/api/certificates', certificateRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/announcements', announcementRoutes); 
app.use('/api/users', userRoutes); 

// Root path for health check
app.get('/', (req, res) => res.send('NextGen-LMS Backend Operational!'));

// 4. DB CONNECTION & SERVER START
mongoose.connect(mongoURI)
    .then(() => {
        console.log('✅ MongoDB Connected');
        app.listen(PORT, () => {
            console.log(`🚀 NextGen-LMS Server running on Port: ${PORT}`);
            console.log(`📡 Production Link: https://meek-chebakia-d3053c.netlify.app`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });