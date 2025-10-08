const User = require("../Models/User");
const Activity = require("../Models/Activity");
const Badge = require("../Models/Badge");

// Helper: get days in current month
const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const fetchDashboard = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user
    const user = await User.findById(userId).populate("badges");
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDaysInMonth = getDaysInMonth(year, month);

    // ---------- Mood Logs ----------
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const moodLogs = await Activity.find({
      userId,
      mood: { $exists: true },
      date: { $gte: monthStart, $lte: monthEnd },
    });

    // Count unique days with mood entries
    const moodDays = new Set(
      moodLogs.map((log) => new Date(log.date).getDate())
    ).size;

    const moodStreakPercent = Math.round((moodDays / totalDaysInMonth) * 100);

    // ---------- Self-care ----------
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Saturday

    let selfCareLogs = user.selfCareActivities || [];

    let selfCarePercent = 0;
    if (selfCareLogs.length > 0) {
      let totalCompletionRate = 0;

      selfCareLogs.forEach((activity) => {
        const performedThisWeek = activity.performedDates.filter(
          (d) => d >= weekStart && d <= weekEnd
        ).length;

        const rate = performedThisWeek / 7; // out of 7 days
        totalCompletionRate += rate;
      });

      selfCarePercent = Math.round(
        (totalCompletionRate / selfCareLogs.length) * 100
      );
    }

    // ---------- Badges ----------
    const badges = await Badge.find({ _id: { $in: user.badges } });

    res.json({
      moodStreak: moodStreakPercent,
      moodLogsCount: moodDays,
      selfCareStreak: selfCarePercent,
      selfCareLogsCount: selfCareLogs.length,
      badges,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { fetchDashboard };
