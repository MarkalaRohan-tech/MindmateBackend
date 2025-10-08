// routes/profile.js
const express = require("express");
const router = express.Router();
const {fetchProfile, fetchBadges} = require("../Controllers/profileController");

// GET /api/profile/:userId - Get user profile data
router.get("/:userId", fetchProfile);

// GET /api/profile/:userId/achievements - Get detailed achievements
router.get("/:userId/achievements", fetchBadges);

module.exports = router;
