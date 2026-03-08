const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement'); 
const { protect } = require('../middleware/auth'); 

// ====================================================================
// 1. GET /api/announcements (Dashboard View)
// ====================================================================
router.get('/', async (req, res) => {
    try {
        // Fetch only the 10 most recent announcements
        // We use .populate('author', 'name') to show who posted it
        const announcements = await Announcement.find({})
            .sort({ createdAt: -1 })
            .populate('author', 'name') 
            .limit(10)
            .lean(); 

        // CRITICAL: Always return an array, even if empty, to prevent Frontend 404/Errors
        res.json(announcements || []); 

    } catch (error) {
        console.error("❌ Error fetching announcements:", error);
        // Fallback: Send empty array so dashboard.js doesn't crash with SyntaxError
        res.status(200).json([]); 
    }
});

// ====================================================================
// 2. POST /api/announcements (Admin Only)
// ====================================================================
router.post('/', protect, async (req, res) => {
    try {
        // Security Guard: Check if the user role is admin
        if (req.user.role !== 'admin') { 
            return res.status(403).json({ message: 'Access denied. Admins only.' }); 
        }

        const { title, body } = req.body;
        if (!title || !body) {
            return res.status(400).json({ message: 'Title and body are required.' });
        }

        const announcement = new Announcement({
            title,
            body, 
            author: req.user.id 
        });

        const createdAnnouncement = await announcement.save();
        
        // Populate the author name immediately for the UI
        const populatedAnnouncement = await Announcement.findById(createdAnnouncement._id).populate('author', 'name');
        
        res.status(201).json(populatedAnnouncement);

    } catch (error) {
        console.error("❌ Error creating announcement:", error);
        res.status(500).json({ message: 'Server error during creation.' });
    }
});

// ====================================================================
// 3. DELETE /api/announcements/:id (Admin Only)
// ====================================================================
router.delete('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const announcement = await Announcement.findByIdAndDelete(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found.' });
        }

        res.json({ message: 'Announcement removed.' });

    } catch (error) {
        console.error("❌ Error deleting announcement:", error);
        res.status(500).json({ message: 'Server error during deletion.' });
    }
});

module.exports = router;