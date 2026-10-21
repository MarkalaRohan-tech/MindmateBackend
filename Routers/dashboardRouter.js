const express = require("express");
const router = express.Router();
const {
  fetchDashboard,
  fetchDailyQuote,
} = require("../Controllers/dashboardController");

// Dashboard API
router.get("/quote", fetchDailyQuote);
router.get("/:userId", fetchDashboard);

module.exports = router;
