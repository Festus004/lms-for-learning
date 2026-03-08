const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Added for faster dashboard lookups
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    studentName: {
        type: String,
        required: true
    },
    courseName: {
        type: String,
        required: true
    },
    // Matches your naming convention perfectly
    certificateCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true // Added for instant public verification
    },
    pdfData: {
        type: String, 
        // Note: MongoDB has a 16MB limit per document. 
        // A Base64 PDF is usually 500KB - 2MB, so this is safe for now.
    }
}, { timestamps: true });

// Export the model
module.exports = mongoose.model('Certificate', CertificateSchema);