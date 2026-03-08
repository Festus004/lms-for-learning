const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const { protect } = require('../middleware/auth');

// ====================================================================
// 1. GET /api/courses (Public - List all courses)
// ====================================================================
router.get('/', async (req, res) => {
    try {
        // We filter for published courses only for the general public
        const courses = await Course.find({ isPublished: true })
            .select('title description price thumbnail lessons quiz isPublished createdAt')
            .sort({ createdAt: -1 });
        res.json(courses);
    } catch (error) {
        console.error("Fetch Courses Error:", error);
        res.status(500).json({ message: 'Server error retrieving courses.' });
    }
});

// ====================================================================
// 2. GET /api/courses/recommended (Public - Top 3)
// ====================================================================
router.get('/recommended', async (req, res) => {
    try {
        const courses = await Course.find({ isPublished: true })
            .sort({ createdAt: -1 })
            .limit(3)
            .select('title description thumbnail price'); 
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: 'Server error retrieving recommendations.' });
    }
});

// ====================================================================
// 3. GET /api/courses/:id (Public Detail)
// ====================================================================
router.get('/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ message: 'Course not found.' });
        }
        res.json(course);
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid Course ID format.' });
        res.status(500).json({ message: 'Server error retrieving course details.' });
    }
});

// ====================================================================
// 4. POST /api/courses (Private - Admin/Instructor only)
// ====================================================================
router.post('/', protect, async (req, res) => {
    // Check if user has correct permissions from JWT
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
        return res.status(403).json({ message: 'Access denied. Instructors or Admins only.' });
    }

    try {
        const { title, description, price, thumbnail, lessons, quiz, isPublished } = req.body;

        // Basic validation
        if (!title || !description) {
            return res.status(400).json({ message: 'Please provide at least a title and description.' });
        }

        const course = new Course({
            title,
            description,
            price: price || 0,
            thumbnail: thumbnail || 'default-thumbnail.jpg',
            instructor: req.user.id,
            lessons: lessons || [], 
            quiz: quiz || [],       
            isPublished: isPublished !== undefined ? isPublished : true 
        });

        const savedCourse = await course.save();
        res.status(201).json(savedCourse);
    } catch (error) {
        console.error("Course Creation Error:", error);
        res.status(500).json({ message: 'Error creating course: ' + error.message });
    }
});

// ====================================================================
// 5. PUT /api/courses/:id (Private - Owner or Admin)
// ====================================================================
router.put('/:id', protect, async (req, res) => {
    try {
        let course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Authorization Check
        const isOwner = course.instructor.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to edit this course' });
        }

        course = await Course.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.json(course);
    } catch (error) {
        res.status(500).json({ message: 'Update failed: ' + error.message });
    }
});

// ====================================================================
// 6. DELETE /api/courses/:id (Private - Admin Only)
// ====================================================================
router.delete('/:id', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrators can delete courses.' });
    }

    try {
        const course = await Course.findByIdAndDelete(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course already removed.' });
        res.json({ message: 'Course and associated data deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Deletion failed.' });
    }
});

module.exports = router;