require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const certificateRoutes = require('./routes/certificates');
const progressRoutes = require('./routes/progress');
const announcementRoutes = require('./routes/announcements'); 
// ADDED: Import the missing users routes
const userRoutes = require('./routes/users'); 

const app = express();
const PORT = process.env.PORT || 5001;
const mongoURI = process.env.MONGO_URI; 

// MIDDLEWARE - Set limits BEFORE routes
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// UPDATED: Allow all origins (*) for the initial launch so you don't get blocked
app.use(cors({
    origin: '*', 
    credentials: true
}));

// API ROUTES
app.use('/api/auth', authRoutes); 
app.use('/api/courses', courseRoutes); 
app.use('/api/certificates', certificateRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/announcements', announcementRoutes); 
// ADDED: Register the user routes under /api/users
app.use('/api/users', userRoutes); 

app.get('/', (req, res) => res.send('LMS Backend Operational!'));

// DB CONNECTION & SERVER START
mongoose.connect(mongoURI)
    .then(() => {
        console.log('✅ MongoDB Connected');
        // Port is dynamic for Render/Cloud hosting
        app.listen(PORT, () => {
            console.log(`🚀 Server running on Port: ${PORT}`);
            console.log(`📜 Certificate Verification service is active.`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1); // Stop the process if DB fails
    });