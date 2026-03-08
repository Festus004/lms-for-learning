// lms-server/routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); 
const Course = require('../models/Course'); // Required for the clear-all-courses route
const { protect } = require('../middleware/auth');

// ====================================================================
// 1. GET /api/users (Admin Only - For Admin Panel)
// ====================================================================
router.get('/', protect, async (req, res) => {
    try {
        // Security Check: Only allow 'admin' role to see the user list
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden. Admin access required.' });
        }

        // Fetch all users, excluding passwords for security
        const users = await User.find({})
            .select('-password') 
            .sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        console.error("Error fetching users list:", error);
        res.status(500).json({ message: 'Server error retrieving user list.' });
    }
});

// ====================================================================
// 2. GET /api/users/profile (Current Logged-in User)
// ====================================================================
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: "User not found" });
        
        res.json(user);
    } catch (error) {
        console.error("Profile Fetch Error:", error);
        res.status(500).json({ message: "Error fetching profile" });
    }
});

// ====================================================================
// 3. DELETE /api/users/:id (Admin Only)
// ====================================================================
router.delete('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized. Admin access required.' });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error("User Deletion Error:", error);
        res.status(500).json({ message: 'Server error during deletion' });
    }
});

// ====================================================================
// 4. ADMIN TOOL: DELETE ALL COURSES (Fresh Start)
// ====================================================================
router.delete('/admin/clear-all-courses', protect, async (req, res) => {
    try {
        // Security Check
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden. Admin only.' });
        }

        // 1. Delete all courses
        await Course.deleteMany({});
        
        // 2. Reset progress for all users so there are no orphan IDs
        // Note: We use empty objects {} if Map initialization causes issues in some MongoDB versions
        await User.updateMany({}, { 
            $set: { 
                progress: {}, 
                completedLessonIds: {} 
            } 
        });
        
        res.json({ message: "Database wiped. All courses and progress maps cleared." });
    } catch (err) {
        console.error("Wipe Error:", err);
        res.status(500).json({ message: "Error clearing database." });
    }
});

module.exports = router;