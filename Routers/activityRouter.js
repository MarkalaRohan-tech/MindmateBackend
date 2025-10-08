const express = require("express");
const router = express.Router();
const {
  addActivities,
  getActivities,
    toggleActivity,
    getLatestMood,
  getAllUserActivities
} = require("../Controllers/activityController");

router
  .post("/addActivities", addActivities)
  .get("/getActivities", getActivities)// routes/activityRoutes.js
  .post("/toggle", toggleActivity)
    .get("/getLatestMood", getLatestMood)
    .get("/getAllUserActivities", getAllUserActivities);


module.exports = router;
