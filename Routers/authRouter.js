const express = require("express");
const router = express.Router();
const { validateRegister, validateLogin } = require("../Middlewares/authMiddleware");
const {registerUser, loginUser, addActivity, removeActivity, getUserActivities}  = require("../Controllers/authController");

router.post("/register", validateRegister, registerUser)
    .post("/login", validateLogin, loginUser)

router.post("/addActivity", addActivity);

router.post("/removeActivity", removeActivity);

router.get("/getUserActivities/:userId", getUserActivities);

module.exports = router;