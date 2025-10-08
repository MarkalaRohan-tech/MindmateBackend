const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// models/User.js (snippet)
const selfCareActivitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, minlength: 2, maxlength: 50 },
    description: { type: String, maxlength: 200 },
    weeklyCount: { type: Number, default: 0 },
    lastPerformed: { type: Date },
    performedDates: [{ type: Date }],
  },
  { _id: true }
);


const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[A-Za-z][A-Za-z0-9\- .]*$/, "Invalid fullname"],
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
  },
  phone: {
    type: String,
    required: true,
    match: [/^[0-9]{10}$/, "Phone must be 10 digits"],
  },
  username: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 30,
    unique: true,
    match: [/^[A-Za-z][A-Za-z0-9\-]*$/, "Invalid username"],
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },

  activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity" }],

  selfCareActivities: [selfCareActivitySchema],

  badges: [{ type: mongoose.Schema.Types.ObjectId, ref: "Badge" }],

  firstLogin: { type: Boolean, default: true },

  firstSignup: { type: Boolean, default: true },

  moodStreak: { type: Number, default: 0 },
  
  selfCareStreak: { type: Number, default: 0 },

  jorunalStreak: { type: Number, default: 0 },

  communityEngagementStreak: { type: Number, default: 0 },

});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("User", userSchema);
