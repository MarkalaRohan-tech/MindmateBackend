// models/Activity.js
const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
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
    },
  },
  time: {
    type: String,
    enum: ["morning", "afternoon", "evening"],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  mood: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
    required: true,
  },
  completed: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Activity", activitySchema);
