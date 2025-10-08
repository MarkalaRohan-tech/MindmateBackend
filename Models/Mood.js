const mongoose = require("mongoose");

const moodSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  day: {
  type: String,
  default: () => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[new Date().getDay()];
  }
  },
  averageMood: { type: Number, default: 3 },
  mood: {
    morning: {
      type: Number,
      default: 0,
    },
    afternoon: {
      type: Number,
      default: 0,
    },
    evening: {
      type: Number,
      default: 0,
    },
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Mood", moodSchema);