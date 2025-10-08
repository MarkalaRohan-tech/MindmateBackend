const express = require("express");
const router = express.Router();
const { updateMood, checkMoodLog, fetchTrends } = require("../Controllers/moodController");

router
  .post("/update", updateMood)
  .get("/check", checkMoodLog)
  .get("/trends", fetchTrends);

module.exports = router;
