const mongoose = require('mongoose');

// Define the schema for a single lesson
const LessonSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    content: { type: String },
    videoUrl: { type: String }, 
    duration: { type: Number, default: 0 },
    lessonOrder: { type: Number, default: 0 } 
}, { _id: true }); 

// Quiz Questions
const QuizQuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: { 
        type: [String], 
        required: true,
        validate: [arrayLimit, '{PATH} must have at least 2 options'] 
    },
    correctAnswerIndex: { type: Number, required: true }
}, { _id: true }); // Adding IDs here allows for "Review Mistake" features later

function arrayLimit(val) {
    return val.length >= 2;
}

const CourseSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    // Fix: Default to a placeholder to avoid 404s
    thumbnail: { 
        type: String, 
        default: 'https://via.placeholder.com/300x200?text=Course+Thumbnail' 
    },
    category: { type: String, default: 'General' }, 
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    price: { type: Number, required: true, default: 0 },
    
    liveLink: { type: String, default: '' }, 
    
    lessons: [LessonSchema], 
    quiz: [QuizQuestionSchema], 
    
    isPublished: { type: Boolean, default: false },
    quizPage: { type: String, default: 'quiz.html' }
}, { 
    timestamps: true // This automatically creates createdAt and updatedAt
});

// Added Text Indexing for the Search Bar functionality
CourseSchema.index({ title: 'text', category: 'text', description: 'text' });

module.exports = mongoose.model('Course', CourseSchema);