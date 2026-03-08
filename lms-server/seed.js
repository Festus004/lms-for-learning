// seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('./models/Course');

const mongoURI = process.env.MONGO_URI;

const seedCourse = async () => {
    try {
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to DB for seeding...');

        // Clear existing version of this specific course to prevent duplicates
        await Course.deleteMany({ title: "Engineering Mathematics: Linear Algebra" });

        const mathCourse = new Course({
            title: "Engineering Mathematics: Linear Algebra",
            description: "Master Matrices, Eigenvalues, and Vector Spaces. Essential for Engineering and Data Science.",
            thumbnail: "https://images.unsplash.com/photo-1509228468518-180dd4822955?auto=format&fit=crop&w=800",
            category: "Engineering",
            price: 49.99,
            isPublished: true,
            quizPage: "quiz.html",
            
            // UPDATED: Field names now match your Course Model exactly
            lessons: [
                {
                    title: "Introduction to Matrices",
                    content: "Basic operations: Addition, Subtraction, and Scalar Multiplication.",
                    videoUrl: "https://www.youtube.com/watch?v=xyAuNHPsq-g",
                    lessonOrder: 1 // Changed from 'order' to 'lessonOrder'
                },
                {
                    title: "Matrix Multiplication & Inverse",
                    content: "Learn the dot product method and how to find the inverse of a 2x2 matrix.",
                    videoUrl: "https://www.youtube.com/watch?v=XkY2DOUCWMU",
                    lessonOrder: 2 // Changed from 'order' to 'lessonOrder'
                },
                {
                    title: "Eigenvalues and Eigenvectors",
                    content: "The characteristic equation and finding the principal components.",
                    videoUrl: "https://www.youtube.com/watch?v=IdsV0RaC9jU",
                    lessonOrder: 3 // Changed from 'order' to 'lessonOrder'
                }
            ],
            
            // ADDED: Sample Quiz data to match your QuizQuestionSchema
            quiz: [
                {
                    questionText: "What is the identity matrix of a 2x2 matrix?",
                    options: ["[1,0; 0,1]", "[0,1; 1,0]", "[1,1; 1,1]", "[0,0; 0,0]"],
                    correctAnswerIndex: 0
                }
            ]
        });

        await mathCourse.save();
        console.log('🚀 Engineering Mathematics Course Added Successfully!');
        
        // Always close the connection when done
        mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        console.error('❌ Seeding Error:', err);
        process.exit(1);
    }
};

seedCourse();