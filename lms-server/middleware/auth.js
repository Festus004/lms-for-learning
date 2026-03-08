const jwt = require('jsonwebtoken');
const User = require('../models/User'); 

/**
 * @desc Verify JWT Token and attach User to Request
 */
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            if (!process.env.JWT_SECRET) {
                console.error("FATAL ERROR: JWT_SECRET is missing in .env");
                return res.status(500).json({ message: "Internal server configuration error" });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.user?.id || decoded.id;

            req.user = await User.findById(userId).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Authorization failed: User no longer exists.' });
            }

            next();

        } catch (error) {
            console.error('Auth Middleware Error:', error.message);
            const message = error.name === 'TokenExpiredError' 
                ? 'Session expired. Please login again.' 
                : 'Invalid token. Authorization denied.';
                
            return res.status(401).json({ message }); 
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' }); 
    }
};

/**
 * @desc Admin Authorization Middleware
 * Check if the user attached to the request has an 'admin' role
 */
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ 
            message: 'Access denied: Administrator privileges required.' 
        });
    }
};

// CRITICAL: Export BOTH functions
module.exports = { protect, admin };