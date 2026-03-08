// lms-server/models/Announcement.js

const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    body: {
        type: String,
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Matches the name used in mongoose.model('User', ...)
        required: true,
        index: true // ADDED: Increases performance when dashboard populates names
    },
    // NEW FIELD: Used by the TTL index for automatic deletion
    expiresAt: {
        type: Date,
        // Default value: 60 days from creation time
        default: () => new Date(Date.now() + (60 * 24 * 60 * 60 * 1000)),
        required: true,
    }
}, { 
    // ADDED: Automatically handles createdAt and updatedAt fields for you
    timestamps: true 
});

// CRITICAL STEP: Define the TTL Index
// MongoDB will automatically delete the document when the current time reaches 'expiresAt'
AnnouncementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// If you have a search bar for announcements, this index helps:
AnnouncementSchema.index({ title: 'text', body: 'text' });

module.exports = mongoose.model('Announcement', AnnouncementSchema);