const User = require("../Models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Badge = require("../Models/Badge");

const registerUser = async (req, res) => {
  const userData = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }],
    });

    if (existingUser) {
      const field =
        existingUser.email === userData.email ? "Email" : "Username";
      return res.status(400).json({
        success: false,
        message: `${field} already exists! Try another ${field.toLowerCase()} or login`,
      });
    }

    // Create user (password will be hashed by pre-save hook)
    await User.create(userData);

    return res.status(201).json({
      success: true,
      message: "User registered successfully! Please log in.",
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    console.error("Error details:", error.message);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${
          field.charAt(0).toUpperCase() + field.slice(1)
        } already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to register. Please try again.",
    });
  }
};


const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Award badges on first login
    if (user.firstLogin) {
      const firstLoginBadge = await Badge.findOne({ type: "FIRST_LOGIN" });
      const firstCheckinBadge = await Badge.findOne({ type: "FIRST_CHECKIN" });

      if (firstLoginBadge && !user.badges.includes(firstLoginBadge._id)) {
        user.badges.push(firstLoginBadge._id);
      }
      if (firstCheckinBadge && !user.badges.includes(firstCheckinBadge._id)) {
        user.badges.push(firstCheckinBadge._id);
      }

      user.firstLogin = false;
      await user.save();
    }

    const { password: _, ...cookieData } = user.toObject();
    const token = jwt.sign(cookieData, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    console.error("Error details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to login, Internal Server Error!",
    });
  }
};

const addActivity = async (req, res) => {
  const { userId, activityId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { activities: activityId } }, // prevents duplicates
      { new: true }
    ).populate("activities");
    res.json({ success: true, activities: user.activities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const removeActivity = async (req, res) => {
  const { userId, activityId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { activities: activityId } },
      { new: true }
    ).populate("activities");
    res.json({ success: true, activities: user.activities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUserActivities = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate("activities");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ activities: user.activities.map(act => act._id) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user activities" });
  }
};

module.exports = { registerUser, loginUser, addActivity, removeActivity, getUserActivities };
