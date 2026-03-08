const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['student', 'instructor', 'admin'],
        default: 'student'
    },
    // Progress Percentage: { courseId: percentage }
    progress: {
        type: Map,
        of: Number, 
        default: {} 
    },
    // IMPORTANT UPDATE: Changed from [Number] to [String] 
    // This ensures compatibility with MongoDB _id strings used in your progress.js toggle.
    completedLessons: {
        type: Map,
        of: [String], 
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to hash the password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare password for login
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);