const Badge = require("../Models/Badge");

const BADGES = [
  { type: "STREAK_10", key: "moodStreak", value: 10 },
  { type: "STREAK_50", key: "moodStreak", value: 50 },
  { type: "STREAK_100", key: "moodStreak", value: 100 },
  { type: "SELF_CARE_5", key: "selfCareStreak", value: 5 },
  { type: "SELF_CARE_10", key: "selfCareStreak", value: 10 },
  { type: "SELF_CARE_30", key: "selfCareStreak", value: 30 },
  { type: "SELF_CARE_50", key: "selfCareStreak", value: 50 },
  { type: "SELF_CARE_75", key: "selfCareStreak", value: 75 },
  { type: "SELF_CARE_100", key: "selfCareStreak", value: 100 },
  { type: "JOURNALING_10", key: "jorunalStreak", value: 10 },
  { type: "JOURNALING_50", key: "jorunalStreak", value: 50 },
  {
    type: "COMMUNITY_ENGAGEMENT_50",
    key: "communityEngagementStreak",
    value: 50,
  },
  {
    type: "COMMUNITY_ENGAGEMENT_100",
    key: "communityEngagementStreak",
    value: 100,
  },
];

async function checkAndAwardBadges(user) {
  const allBadges = await Badge.find(); // all badge documents
  const userBadges = new Set(
    user.badges.map((b) => (b._id ? b._id.toString() : b.toString()))
  );

  for (const badgeDef of BADGES) {
    const { type, key, value } = badgeDef;

    // only check if user streak meets threshold
    if (user[key] >= value) {
      const badgeDoc = allBadges.find((b) => b.type === type);
      if (badgeDoc && !userBadges.has(badgeDoc._id.toString())) {
        user.badges.push(badgeDoc._id);
      }
    }
  }

}

module.exports = checkAndAwardBadges;
