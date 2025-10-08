const User = require("../Models/User");
const Badge = require("../Models/Badge");
const Activity = require("../Models/Activity");

const fetchProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user with relations
    const user = await User.findById(userId)
      .populate("badges")
      .populate("activities"); // all completed activities

    if (!user) return res.status(404).json({ message: "User not found" });

    // Stats
    const totalActivities = user.activities.length; // all activities
    const journalCount = user.journalActivities?.length || 0; // your journal activities array
    const totalSelfCareActivities = user.selfCareActivities?.length || 0;

    const totalPoints =
      totalActivities * 2 + journalCount * 3 + totalSelfCareActivities * 3;
    const level = Math.floor(totalPoints / 50) + 1;

    // Evolution
    let evolutionStage, profileImage;
    if (level >= 20) {
      evolutionStage = "Master";
      profileImage = "/profile/Master.png";
    } else if (level >= 15) {
      evolutionStage = "Expert";
      profileImage = "/profile/Expert.png";
    } else if (level >= 10) {
      evolutionStage = "Advanced";
      profileImage = "/profile/Advance.png";
    } else if (level >= 5) {
      evolutionStage = "Intermediate";
      profileImage = "/profile/Intermediate.png";
    } else {
      evolutionStage = "Beginner";
      profileImage = "/profile/Beginner.png";
    }

    const currentLevelPoints = totalPoints % 50;
    const progressToNextLevel = (currentLevelPoints / 50) * 100;

    // Streaks
    const streaksSummary = {
      mood: user.moodStreak || 0,
      selfCare: user.selfCareStreak || 0,
      journal: user.jorunalStreak || 0,
      community: user.communityEngagementStreak || 0,
    };

    // Recent Activities: only last 5
    const recentActivities = await Activity.find({
      _id: { $in: user.activities },
      completed: true,
    })
      .sort({ date: -1 })
      .limit(5);

    // Badges
    const allBadges = await Badge.find();
    const unlockedBadgeIds = user.badges.map((b) => b._id.toString());
    const lockedBadges = allBadges.filter(
      (b) => !unlockedBadgeIds.includes(b._id.toString())
    );

    const profileData = {
      user: {
        id: user._id,
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        phone: user.phone,
        joinDate: user._id.getTimestamp(),
      },
      stats: {
        level,
        evolutionStage,
        profileImage,
        totalPoints,
        progressToNextLevel: Math.round(progressToNextLevel),
        totalActivities,
        journalCount :streaksSummary.journal,
        selfCareStreak: streaksSummary.selfCare,
        communityStreak: streaksSummary.community,
      },
      badges: {
        unlocked: user.badges,
        locked: lockedBadges,
        totalAvailable: allBadges.length,
      },
      recentActivities, // only last 5
    };

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching profile data:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const fetchBadges = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate("badges");

    if (!user) return res.status(404).json({ message: "User not found" });

    const allBadges = await Badge.find();
    const unlockedBadgeIds = user.badges.map((b) => b._id.toString());
    const lockedBadges = allBadges.filter(
      (b) => !unlockedBadgeIds.includes(b._id.toString())
    );

    const achievementsData = {
      unlocked: user.badges,
      locked: lockedBadges,
      unlockedCount: user.badges.length,
      totalCount: allBadges.length,
      completionPercentage: Math.round(
        (user.badges.length / allBadges.length) * 100
      ),
    };

    res.json(achievementsData);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { fetchProfile, fetchBadges };
