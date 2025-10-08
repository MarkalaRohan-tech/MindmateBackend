const express = require("express");
const router = express.Router();
const { fetchDashboard } = require("../Controllers/dashboardController");

// Dashboard API
router.get("/:userId", fetchDashboard);

module.exports = router;
