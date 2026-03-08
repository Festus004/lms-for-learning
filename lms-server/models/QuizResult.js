const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    passed: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure a user has only one record per course (updates previous attempts)
QuizResultSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('QuizResult', QuizResultSchema);