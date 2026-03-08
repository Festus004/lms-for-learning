const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    questions: [
        {
            questionText: { type: String, required: true },
            options: [{ type: String, required: true }],
            correctAnswerIndex: { type: Number, required: true }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Quiz', QuizSchema);