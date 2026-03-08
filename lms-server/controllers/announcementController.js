const Announcement = require('../models/Announcement');

// ====================================================================
// 1. Create Announcement (Admin Only)
// ====================================================================
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, body } = req.body; 

        // Validation
        if (!title || !body) {
            return res.status(400).json({ error: 'Both Title and Body are required.' });
        }

        // Create with Author ID from Protect Middleware
        const newAnnouncement = new Announcement({ 
            title, 
            body,
            author: req.user.id // This ensures the announcement is linked to the admin
        });

        await newAnnouncement.save();

        // Populate the author's name before sending back to frontend
        const populatedAnnouncement = await newAnnouncement.populate('author', 'name');

        res.status(201).json({ 
            message: 'Announcement posted successfully!', 
            announcement: populatedAnnouncement 
        });

    } catch (error) {
        console.error('Error posting announcement:', error);
        res.status(500).json({ error: 'Server error: Could not post announcement.' });
    }
};

// ====================================================================
// 2. Get All Announcements (Public/Dashboard)
// ====================================================================
exports.getAllAnnouncements = async (req, res) => {
    try {
        // Fetch, Populate author, and Sort by newest first
        const announcements = await Announcement.find({})
            .populate('author', 'name')
            .sort({ createdAt: -1 })
            .limit(10) // Prevents the dashboard from becoming too cluttered
            .lean();   // Improves performance for read-only data

        res.status(200).json(announcements);
    } catch (error) {
        console.error('Fetch error:', error);
        res.status(500).json({ error: 'Server error: Could not fetch announcements.' });
    }
};