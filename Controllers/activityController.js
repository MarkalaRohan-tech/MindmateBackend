// controllers/activityController.js
const Activity = require("../Models/Activity.js");
const Mood = require("../Models/Mood.js");
const User = require("../Models/User.js");
const mongoose = require("mongoose");

// ✅ Add or replace activities (persistent)
const addActivities = async (req, res) => {
  try {
    const { activities, mood, time, userId } = req.body;

    console.log("🔥 addActivities called with:", {
      activitiesCount: activities?.length,
      mood,
      time,
      userId,
    });

    if (!userId) {
      return res.status(400).json({ error: "UserId is required" });
    }

    // Validate mood and time
    if (!mood || ![1, 2, 3, 4, 5].includes(Number(mood))) {
      return res.status(400).json({ error: "Valid mood (1-5) is required" });
    }

    if (!time || !["morning", "afternoon", "evening"].includes(time)) {
      return res
        .status(400)
        .json({ error: "Valid time (morning/afternoon/evening) is required" });
    }

    // Convert userId to ObjectId if it's a string
    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    console.log("🧹 Deleting old activities for:", {
      userId: userObjectId,
      mood: Number(mood),
      time,
    });

    // 🔄 Remove old activities for this user + mood + time
    const deleteResult = await Activity.deleteMany({
      userId: userObjectId,
      mood: Number(mood),
      time,
    });

    console.log("🗑️ Deleted activities count:", deleteResult.deletedCount);

    // Insert new ones
    const docs = (activities || []).map((a) => ({
      title: a.title,
      description: a.description,
      userId: userObjectId,
      mood: Number(mood),
      time,
      completed: a.completed || false,
      date: new Date(),
    }));

    console.log("💾 Inserting new activities:", docs.length);

    const saved = await Activity.insertMany(docs);

    console.log("✅ Successfully saved activities:", saved.length);

    res.status(201).json({ activities: saved });
  } catch (err) {
    console.error("❌ Error saving activities:", err);
    res
      .status(500)
      .json({ error: "Failed to save activities", details: err.message });
  }
};

// ✅ Get activities (persistent) - ENHANCED DEBUG VERSION
const getActivities = async (req, res) => {
  try {
    const { mood, time, userId } = req.query;

    console.log("📊 getActivities called with:", { mood, time, userId });

    if (!userId) {
      console.log("❌ No userId provided");
      return res.status(400).json({ error: "UserId is required" });
    }

    // Validate mood parameter
    if (!mood || isNaN(mood) || ![1, 2, 3, 4, 5].includes(Number(mood))) {
      console.log("❌ Invalid mood:", mood);
      return res.status(400).json({ error: "Valid mood (1-5) is required" });
    }

    // Validate time parameter
    if (!time || !["morning", "afternoon", "evening"].includes(time)) {
      console.log("❌ Invalid time:", time);
      return res
        .status(400)
        .json({ error: "Valid time (morning/afternoon/evening) is required" });
    }

    // Convert mood to number and userId to ObjectId
    const moodNumber = Number(mood);
    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    console.log("🔍 Searching with converted values:", {
      userId: userObjectId,
      mood: moodNumber,
      time,
    });

    // First, let's check if there are ANY activities for this user
    const allUserActivities = await Activity.find({ userId: userObjectId });
    console.log(
      `👤 Total activities for user ${userId}:`,
      allUserActivities.length
    );

    if (allUserActivities.length > 0) {
      console.log(
        "📋 Sample user activities:",
        allUserActivities.slice(0, 2).map((a) => ({
          mood: a.mood,
          time: a.time,
          title: a.title,
        }))
      );
    }

    // Now search for specific mood + time
    const activities = await Activity.find({
      userId: userObjectId,
      mood: moodNumber,
      time,
    });

    console.log(
      `📊 Found ${activities.length} activities for mood=${moodNumber}, time=${time}`
    );

    if (activities.length > 0) {
      console.log(
        "🎯 Found activities:",
        activities.map((a) => ({
          id: a._id,
          title: a.title,
          completed: a.completed,
        }))
      );
    }

    res.status(200).json({ activities: activities || [] });
  } catch (err) {
    console.error("❌ Error fetching activities:", err);
    res.status(500).json({
      error: "Failed to fetch activities",
      details: err.message,
    });
  }
};

// ✅ Toggle activity completion
const toggleActivity = async (req, res) => {
  try {
    const { activityId, completed,userId } = req.body;

    console.log("🔄 toggleActivity called:", { activityId, completed });

    if (!activityId) {
      return res.status(400).json({ error: "Activity ID is required" });
    }

    const activity = await Activity.findById(activityId);
    if (!activity) {
      console.log("❌ Activity not found:", activityId);
      return res.status(404).json({ error: "Activity not found" });
    }

    console.log("🎯 Found activity:", {
      id: activity._id,
      title: activity.title,
      currentCompleted: activity.completed,
    });

    activity.completed = Boolean(completed);

    if (Boolean(completed)) {
      await User.findOneAndUpdate(
        { _id: userId },
        {
          $inc: { completedActivities: 1 },
          $push: { activities: activityId },
        },
        { new: true }
      );
    } else {
      await User.findOneAndUpdate(
        { _id: userId },
        {
          $inc: { completedActivities: -1 },
          $pull: { activities: activityId },
        },
        { new: true }
      );
    }

    // Optional: track completion stats
    if (completed && !activity.performedDates) {
      activity.performedDates = [];
    }

    if (completed) {
      activity.weeklyCount = (activity.weeklyCount || 0) + 1;
      if (activity.performedDates) {
        activity.performedDates.push(new Date());
      }
    }

    await activity.save();

    console.log("✅ Activity updated:", {
      id: activity._id,
      completed: activity.completed,
    });

    res.status(200).json({ activity });
  } catch (err) {
    console.error("❌ Error toggling activity:", err);
    res.status(500).json({
      error: "Failed to toggle activity",
      details: err.message,
    });
  }
};

// ✅ Fixed getLatestMood function
const getLatestMood = async (req, res) => {
  try {
    const { userId, timeOfDay } = req.query;

    console.log("🔍 getLatestMood called with:", { userId, timeOfDay });

    if (!userId) {
      return res.status(400).json({ error: "UserId is required" });
    }

    if (!timeOfDay) {
      return res.status(400).json({ error: "TimeOfDay is required" });
    }

    // Convert userId to ObjectId
    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    // Find the most recent mood entry for this user and time of day
    const latestMood = await Mood.findOne({
      userId: userObjectId,
      timeOfDay: timeOfDay,
    }).sort({ date: -1 }); // Sort by date descending to get the latest

    if (latestMood) {
      console.log("📊 Latest mood found:", latestMood.moodValue);
      res.status(200).json({
        mood: latestMood.moodValue,
        date: latestMood.date,
        timeOfDay: latestMood.timeOfDay,
      });
    } else {
      console.log("📭 No previous mood found");
      res.status(200).json({ mood: null });
    }
  } catch (err) {
    console.error("❌ Error fetching latest mood:", err);
    res.status(500).json({
      error: "Failed to fetch latest mood",
      details: err.message,
    });
  }
};

const getAllUserActivities = async (req, res) => {
  try {
    const { userId, time } = req.query;

    console.log("📊 getAllUserActivities called with:", { userId, time });

    if (!userId) {
      return res.status(400).json({ error: "UserId is required" });
    }

    if (!time || !["morning", "afternoon", "evening"].includes(time)) {
      return res
        .status(400)
        .json({ error: "Valid time (morning/afternoon/evening) is required" });
    }

    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    // Get all activities for this user and time, sorted by date (most recent first)
    const activities = await Activity.find({
      userId: userObjectId,
      time,
    }).sort({ date: -1 });

    console.log(`📊 Found ${activities.length} total activities for user`);

    res.status(200).json({ activities: activities || [] });
  } catch (err) {
    console.error("❌ Error fetching all user activities:", err);
    res.status(500).json({
      error: "Failed to fetch activities",
      details: err.message,
    });
  }
};

// Don't forget to export it:
module.exports = { 
  addActivities, 
  getActivities, 
  toggleActivity, 
  getLatestMood, 
  getAllUserActivities  // Add this
};