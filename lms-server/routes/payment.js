// lms-server/routes/payment.js

const express = require('express');
const router = express.Router();
// ... other imports

// Route for Firebase front-end certificate fallback
// Matches the path used in script.js: /api/payment/send-certificate
router.post('/send-certificate', (req, res) => {
    const { name, email, course } = req.body;

    // This is the placeholder logic for demonstration/testing
    console.log(`[CERTIFICATE REQUEST] Received request for ${name} to certify in ${course}. Email: ${email}`);

    // The client-side script expects a 200 OK response to proceed
    res.status(200).json({ 
        message: 'Certificate generation process initiated by REST fallback.',
        data: { name, email, course } 
    });
});

// ... all other payment-related routes should be defined below this

module.exports = router;