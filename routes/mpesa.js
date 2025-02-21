const express = require('express');
const router = express.Router();
const { getAccessToken, initiateSTKPush, querySTKStatus } = require('../utils/mpesa');

// Middleware to log requests
router.use((req, res, next) => {
    console.log('Request Headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    next();
});

// Test route
router.get("/", (req, res) => {
  res.send("MPESA API is running");
});

// Get access token route
router.get("/access_token", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    res.send("Your access token is " + accessToken);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to get access token");
  }
});

// Initiate STK Push
router.post("/stkpush", async (req, res) => {
  // Debug log to see what's being received
  console.log("Received request body:", req.body);
  
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({
        error: "Missing required fields. Please provide both 'phone' and 'amount'"
      });
    }

    const result = await initiateSTKPush(phone, amount);
    res.json(result);
  } catch (error) {
    console.error('STK Push Error:', error);
    res.status(500).json({
      error: 'Failed to initiate payment',
      details: error.message
    });
  }
});

// Query STK Push Status
router.post("/query", async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({
        error: "Missing checkoutRequestId"
      });
    }

    const result = await querySTKStatus(checkoutRequestId);
    res.json(result);
  } catch (error) {
    console.error('Query Status Error:', error);
    res.status(500).json({
      error: 'Failed to query payment status',
      details: error.message
    });
  }
});

// M-Pesa Callback URL
router.post('/callback', (req, res) => {
  console.log('M-Pesa Callback Data:', req.body);
  
  // Handle the callback data here
  const callbackData = req.body;
  
  // Send response to M-Pesa
  res.json({
    ResultCode: 0,
    ResultDesc: "Success"
  });
});

module.exports = router;
