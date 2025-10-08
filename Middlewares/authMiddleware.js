const validateRegister = (req, res, next) => {
  const { fullname, email, phone, username, password } = req.body;

  // 1. Check required fields
  if (!fullname || !email || !phone || !username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // 2. Validate fullname
  const fullnameRegex = /^[A-Za-z][A-Za-z0-9\- .]{2,29}$/;
  if (!fullnameRegex.test(fullname)) {
    return res.status(400).json({ error: "Invalid fullname format" });
  }

  // 3. Validate email
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // 4. Validate phone (must be 10 digits)
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: "Phone must be 10 digits" });
  }

  // 5. Validate username
  const usernameRegex = /^[A-Za-z][A-Za-z0-9\-]{2,29}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: "Invalid username format" });
  }

  // 6. Validate password
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  // 1. Check required fields
  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  
  // 3. Validate email
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // 6. Validate password
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  next();
};

module.exports = { validateRegister,validateLogin };
