const User = require("../Models/User");
const checkAndAwardBadges = require("../Util/checkAndAwardBadges");

// =======================
// Helper Functions
// =======================
const isSameUTCDate = (d1, d2) => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
};

// Compute consecutive days with activity
const computeSelfCareStreak = (activities) => {
  if (!activities || activities.length === 0) return 0;

  let allDates = [];
  activities.forEach((a) => {
    if (a.performedDates) allDates.push(...a.performedDates);
  });

  allDates = [
    ...new Set(allDates.map((d) => new Date(d).toISOString().split("T")[0])),
  ]
    .sort((a, b) => new Date(b) - new Date(a))
    .map((d) => new Date(d));

  if (allDates.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0);

  for (let date of allDates) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    if (isSameUTCDate(d, currentDate)) {
      streak++;
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    } else if (d < currentDate) {
      break;
    }
  }

  return streak;
};

// Compute weeklyCount: performedDates in last 7 days including today
const computeWeeklyCount = (performedDates = []) => {
  const today = new Date();
  const start = new Date(today);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  return performedDates.filter((d) => new Date(d) >= start).length;
};

// =======================
// Controller Functions
// =======================

const fetchActivities = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID is required" });

    const user = await User.findById(userId).populate("badges").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const activities = (user.selfCareActivities || []).map((a) => {
      const performedDates = a.performedDates || [];
      const weeklyCount = computeWeeklyCount(performedDates);
      const completedToday = performedDates.some((d) =>
        isSameUTCDate(d, new Date())
      );
      return {
        _id: a._id,
        title: a.title,
        description: a.description,
        weeklyCount,
        lastPerformed: a.lastPerformed,
        performedDates,
        completedToday,
      };
    });

    res.json({
      activities,
      selfCareStreak: user.selfCareStreak,
      badges: user.badges,
    });
  } catch (err) {
    console.error("Error fetching activities:", err);
    res.status(500).json({ error: err.message });
  }
};

const addActivity = async (req, res) => {
  try {
    const { userId, title, description } = req.body;
    if (!userId || !title || !description)
      return res
        .status(400)
        .json({ error: "User ID, title, and description are required" });

    const newActivity = {
      title: title.trim(),
      description: description.trim(),
      weeklyCount: 0,
      lastPerformed: null,
      performedDates: [],
      completedToday: false,
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { selfCareActivities: newActivity } },
      { new: true }
    ).populate("badges");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ activities: user.selfCareActivities, badges: user.badges });
  } catch (err) {
    console.error("Error adding activity:", err);
    res.status(500).json({ error: err.message });
  }
};


// ✅ UPDATE activity
const updateActivity = async (req, res) => {
  try {
    const { userId } = req.body;
    const { activityId } = req.params;

    const user = await User.findOne({
      _id: userId,
      "selfCareActivities._id": activityId,
    }).populate("badges");

    if (!user)
      return res.status(404).json({ error: "User or activity not found" });

    const activity = user.selfCareActivities.id(activityId);

    activity.weeklyCount = (activity.weeklyCount || 0) + 1;
    activity.lastPerformed = new Date();
    activity.performedDates.push(new Date());

    // update streak
    user.selfCareStreak = computeSelfCareStreak(user.selfCareActivities);

    // award badges
    checkAndAwardBadges(user);

    // single save
    await user.save();

    res.json({
      success: true,
      activity,
      selfCareStreak: user.selfCareStreak,
      badges: user.badges,
    });
  } catch (err) {
    console.error("Error updating activity:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ DECREMENT activity
const decrementActivity = async (req, res) => {
  try {
    const { userId } = req.body;
    const { activityId } = req.params;

    const user = await User.findOne({
      _id: userId,
      "selfCareActivities._id": activityId,
    }).populate("badges");

    if (!user)
      return res.status(404).json({ error: "User or activity not found" });

    const activity = user.selfCareActivities.id(activityId);

    if (activity.weeklyCount > 0) activity.weeklyCount -= 1;
    if (activity.performedDates.length > 0) activity.performedDates.pop();

    // update streak
    user.selfCareStreak = computeSelfCareStreak(user.selfCareActivities);

    // award badges
    checkAndAwardBadges(user);

    // save once
    await user.save();

    res.json({
      success: true,
      activity,
      selfCareStreak: user.selfCareStreak,
      badges: user.badges,
    });
  } catch (err) {
    console.error("Error decrementing activity:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ DELETE activity
const deleteActivity = async (req, res) => {
  try {
    const { userId } = req.body;
    const { activityId } = req.params;

    const user = await User.findById(userId).populate("badges");
    if (!user) return res.status(404).json({ error: "User not found" });

    const activity = user.selfCareActivities.id(activityId);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    activity.deleteOne();

    // update streak
    user.selfCareStreak = computeSelfCareStreak(user.selfCareActivities);

    // award badges
    checkAndAwardBadges(user);

    // save once
    await user.save();

    res.json({
      success: true,
      message: "Activity deleted",
      selfCareStreak: user.selfCareStreak,
      badges: user.badges,
    });
  } catch (err) {
    console.error("Error deleting activity:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  fetchActivities,
  addActivity,
  deleteActivity,
  updateActivity,
  decrementActivity,
};
