const User = require("../Models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Badge = require("../Models/Badge");

const registerUser = async (req, res) => {
  const userData = req.body;

  try {
    const exists = await User.findOne({ email: userData.email });
    if (exists) {
      return res.status(400).json({
        message: "User email already exists! Try another email or login",
      });
    }

    // Create user
    const newUser = await User.create(userData);

    // Assign FIRST_SIGNUP badge only once
    if (newUser.firstSignup) {
      const badge = await Badge.findOne({ type: "FIRST_LOGIN" });
      if (badge) {
        newUser.badges.push(badge._id);
      }
      newUser.firstSignup = false;
      await newUser.save();
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully! Please log in.",
    });

  } catch (error) {
    console.error("Register error:", error);
    return res
      .status(500)
      .json({ message: "Failed to register, Internal Server Error!" });
  }
};


const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Award FIRST_CHECKIN badge if firstLogin
    if (user.firstLogin) {
      const badge = await Badge.findOne({ type: "FIRST_CHECKIN" });
      if (badge) {
        user.badges.push(badge._id);
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

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ message: "Failed to login, Internal Server Error!" });
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
