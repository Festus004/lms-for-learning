const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Course = require('../models/Course');

// ====================================================================
// 1. GET /api/progress/map (For Dashboard Overview)
// ====================================================================
router.get('/map', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('progress completedLessonIds');
        if (!user) return res.status(404).json({ message: "User not found." });

        const dashboardProgressMap = {};

        if (user.progress instanceof Map) {
            for (const [courseId, progressPercent] of user.progress.entries()) {
                const completedLessons = user.completedLessonIds ? user.completedLessonIds.get(courseId) : [];
                
                dashboardProgressMap[courseId] = {
                    progressPercent: progressPercent,
                    completedLessons: completedLessons || []
                };
            }
        }
        
        res.json(dashboardProgressMap);
    } catch (error) {
        console.error("Dashboard Map Error:", error);
        res.status(500).json({ message: 'Server error retrieving progress map.' });
    }
});

// ====================================================================
// 2. GET /api/progress/:courseId (For Individual Course Pages)
// ====================================================================
router.get('/:courseId', protect, async (req, res) => {
    try {
        const { courseId } = req.params;
        const user = await User.findById(req.user.id).select('progress completedLessonIds');

        if (!user) return res.status(404).json({ message: "User not found." });

        const percent = (user.progress && typeof user.progress.get === 'function') 
            ? (user.progress.get(courseId) || 0) 
            : 0;

        const completedLessons = (user.completedLessonIds && typeof user.completedLessonIds.get === 'function')
            ? (user.completedLessonIds.get(courseId) || [])
            : [];

        res.json({
            progressPercent: percent,
            completedLessons: completedLessons
        });
    } catch (error) {
        console.error("Fetch single progress error:", error);
        res.status(500).json({ message: 'Error retrieving course progress.' });
    }
});

// ====================================================================
// 3. POST /api/progress/toggle (For Lesson Checkboxes)
// ====================================================================
router.post('/toggle', protect, async (req, res) => {
    try {
        const { courseId, lessonId } = req.body; 

        if (!courseId || !lessonId) {
            return res.status(400).json({ message: "Missing courseId or lessonId." });
        }

        const user = await User.findById(req.user.id);
        const course = await Course.findById(courseId).select('lessons');

        if (!user || !course) {
            return res.status(404).json({ message: "User or Course not found." });
        }

        if (!user.completedLessonIds) user.completedLessonIds = new Map();
        if (!user.progress) user.progress = new Map();

        let completedList = user.completedLessonIds.get(courseId) || [];
        const lessonIdStr = String(lessonId);

        if (completedList.includes(lessonIdStr)) {
            completedList = completedList.filter(id => id !== lessonIdStr);
        } else {
            completedList.push(lessonIdStr);
        }

        user.completedLessonIds.set(courseId, completedList);

        const totalLessons = course.lessons ? course.lessons.length : 0;
        let percent = 0;
        
        if (totalLessons > 0) {
            percent = Math.round((completedList.length / totalLessons) * 100);
            if (percent > 100) percent = 100;
        }
        
        user.progress.set(courseId, percent);

        user.markModified('completedLessonIds');
        user.markModified('progress');
        await user.save(); 

        res.json({
            success: true,
            completedLessons: completedList,
            progressPercent: percent,
            isCourseComplete: percent === 100 
        });
    } catch (error) {
        console.error("Toggle error:", error);
        res.status(500).json({ message: 'Error updating lesson status.' });
    }
});

// ====================================================================
// 4. NEW: POST /api/progress/complete-course (CRITICAL FOR QUIZ)
//    Triggered by quiz.js when the student passes the assessment.
// ====================================================================
router.post('/complete-course', protect, async (req, res) => {
    try {
        const { courseId } = req.body;
        if (!courseId) return res.status(400).json({ message: "Course ID required." });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found." });

        if (!user.progress) user.progress = new Map();

        // Pass the quiz = 100% progress instantly
        user.progress.set(courseId, 100);

        // Tell Mongoose the Map has changed so it actually saves to Atlas/MongoDB
        user.markModified('progress');
        await user.save();

        res.json({ 
            success: true, 
            message: "Course marks as 100% complete. Certificate unlocked.", 
            progressPercent: 100 
        });
    } catch (error) {
        console.error("Complete Course Error:", error);
        res.status(500).json({ message: 'Failed to finalize course completion.' });
    }
});

module.exports = router;