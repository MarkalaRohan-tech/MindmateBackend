const Mood = require("../Models/Mood");
const User = require("../Models/User");

const checkAndAwardBadges = require("../Util/checkAndAwardBadges");

const updateMood = async (req, res) => {
  const { userId, timeOfDay, moodValue } = req.body;

  if (!["morning", "afternoon", "evening"].includes(timeOfDay)) {
    return res.status(400).json({ message: "Invalid time of day" });
  }

  try {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const todayDay = days[now.getDay()];

    // 1️⃣ Find or create today's mood
    let moodDoc = await Mood.findOneAndUpdate(
      { userId, date: { $gte: startOfToday } },
      {
        $set: {
          [`mood.${timeOfDay}`]: moodValue,
          day: todayDay,
          date: now,
        },
      },
      { new: true, upsert: true }
    );

    // 2️⃣ Calculate average mood
    const { morning, afternoon, evening } = moodDoc.mood;
    const moods = [morning, afternoon, evening].filter((v) => v >= 1);
    moodDoc.averageMood = moods.length
      ? moods.reduce((a, b) => a + b, 0) / moods.length
      : 0;
    await moodDoc.save();

    // 3️⃣ Update mood streak using only User model
    const user = await User.findById(userId);
    if (user) {
      // Check if user already logged mood today
      const moodsLoggedToday = await Mood.findOne({
        userId,
        date: { $gte: startOfToday },
      });

      if (moodsLoggedToday && moodsLoggedToday._id.equals(moodDoc._id)) {
        // First entry today, calculate streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const yesterdayMood = await Mood.findOne({
          userId,
          date: { $gte: yesterday, $lt: startOfToday },
        });

        // Increment streak if yesterday had mood, else reset
        user.moodStreak = yesterdayMood ? (user.moodStreak || 0) + 1 : 1;

        // Check badges
        await checkAndAwardBadges(user);
        await user.save();
      }
    }

    return res.status(200).json({
      message: "Mood updated successfully!",
      mood: moodDoc,
      moodStreak: user?.moodStreak || 0,
    });
  } catch (error) {
    console.error("Mood update failed:", error);
    return res.status(500).json({ message: "Mood update failed" });
  }
};

const checkMoodLog = async (req, res) => {
  const { userId, timeOfDay } = req.query;

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const moodDoc = await Mood.findOne({
      userId,
      date: { $gte: startOfToday },
    });

    if (moodDoc && moodDoc.mood[timeOfDay] >= 1) {
      return res.json({ logged: true, moodValue: moodDoc.mood[timeOfDay] });
    } else {
      return res.json({ logged: false, moodValue: 0 });
    }
  } catch (err) {
    console.error("Error checking mood:", err);
    res.status(500).json({ logged: false, message: "Server error" });
  }
};

const fetchTrends = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }

    // last 7 days (including today)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const weekly = await Mood.find({
      userId,
      date: { $gte: sevenDaysAgo },
    }).sort({ date: 1 });

    // last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const monthly = await Mood.find({
      userId,
      date: { $gte: thirtyDaysAgo },
    }).sort({ date: 1 });

    // ✅ Format for frontend
    const weeklyData = {
      labels: weekly.map((m) =>
        new Date(m.date).toLocaleDateString("en-US", { weekday: "short" })
      ),
      datasets: [
        {
          label: "Morning",
          data: weekly.map((m) => m.mood.morning || 0),
          borderColor: "#3B82F6",
          backgroundColor: "#3B82F6",
          tension: 0.4,
        },
        {
          label: "Afternoon",
          data: weekly.map((m) => m.mood.afternoon || 0),
          borderColor: "#F59E0B",
          backgroundColor: "#F59E0B",
          tension: 0.4,
        },
        {
          label: "Evening",
          data: weekly.map((m) => m.mood.evening || 0),
          borderColor: "#10B981",
          backgroundColor: "#10B981",
          tension: 0.4,
        },
      ],
    };

    const monthlyData = {
      labels: monthly.map(
        (m, i) => `Day ${i + 1}` // or format date
      ),
      datasets: [
        {
          label: "Average Mood",
          data: monthly.map((m) => m.averageMood || 0),
          borderColor: "#EF4444",
          backgroundColor: "#EF4444",
          tension: 0.4,
        },
      ],
    };

    res.json({ weeklyData, monthlyData });
  } catch (error) {
    console.error("Mood trend fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { updateMood, checkMoodLog , fetchTrends};
