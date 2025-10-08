const express = require("express");
const router = express.Router();
const {
  fetchActivities,
  addActivity,
  deleteActivity,
  updateActivity,
  decrementActivity,
} = require("../Controllers/selfCareController");

// routes/selfCareRouter.js
router
  .get("/", fetchActivities)
  .post("/", addActivity)
  .delete("/:activityId", deleteActivity)
  .patch("/:activityId/increment", updateActivity)
  .patch("/:activityId/decrement", decrementActivity);


module.exports = router;
