// lms-server/routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Mongoose User Model
const { protect } = require('../middleware/auth'); // For protected routes

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Simple validation
    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields.' });
    }

    try {
        // 1. Check for existing user
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists.' });
        }

        // 2. Create new user instance (default role: 'student')
        user = new User({
            name,
            email,
            password, 
            role: 'student' 
        });

        // 3. Save user to MongoDB (hashing happens automatically)
        await user.save();

        // 4. Generate JWT token
        const payload = {
            user: {
                id: user.id,
                // CRITICAL FIX: Include role for future checks
                role: user.role 
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1d' }, // Token expires in 1 day
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ 
                    msg: 'Registration successful',
                    token,
                    user: { id: user.id, name: user.name, email: user.email, role: user.role }
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields.' });
    }

    try {
        // 1. Check for user existence
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials.' });
        }

        // 2. Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials.' });
        }

        // 3. Generate JWT token
        const payload = {
            user: {
                id: user.id,
                // CRITICAL FIX: Include role for future checks
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1d' },
            (err, token) => {
                if (err) throw err;
                res.json({ 
                    msg: 'Login successful',
                    token,
                    user: { id: user.id, name: user.name, email: user.email, role: user.role }
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/auth/me
// @desc    Get logged in user details (used by frontend for role check)
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        // req.user is set by the protect middleware (it excludes the password)
        // Find user using ID stored in req.user from middleware
        const user = await User.findById(req.user.id).select('-password');
        res.json({ user });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error fetching user data' });
    }
});

module.exports = router;