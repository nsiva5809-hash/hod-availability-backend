const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 5000;

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("ERROR: JWT_SECRET environment variable is missing.");
  process.exit(1);
}

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());


// ==================================================
// TEST ROUTE
// ==================================================

app.get("/", (req, res) => {
  res.json({
    message: "HOD Availability System Backend is running"
  });
});


// ==================================================
// HOD LOGIN
// ==================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { hodId, password } = req.body;

    // Check input
    if (!hodId || !password) {
      return res.status(400).json({
        error: "HOD ID and password are required"
      });
    }

    // Find HOD
    const { data: user, error } = await supabase
      .from("hod_users")
      .select("*")
      .eq("hod_id", hodId)
      .eq("active", true)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid HOD ID or password"
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid HOD ID or password"
      });
    }

    // Create login token
    const token = jwt.sign(
      {
        userId: user.id,
        hodId: user.hod_id,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      {
        expiresIn: "8h"
      }
    );

    res.json({
      message: "Login successful",
      token: token,
      user: {
        hodId: user.hod_id,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Server error"
    });
  }
});


// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

const authenticateToken = (req, res, next) => {

  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Authentication token missing"
    });
  }

  try {

    const user = jwt.verify(token, JWT_SECRET);

    req.user = user;

    next();

  } catch (error) {

    return res.status(401).json({
      error: "Invalid or expired token"
    });

  }
};


// ==================================================
// GET CURRENT HOD STATUS
// PUBLIC - Students and staff can use this
// ==================================================

app.get("/api/status", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("hod_status")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {

      console.error("Supabase GET error:", error);

      return res.status(500).json({
        error: "Unable to get HOD status"
      });

    }

    res.json({
      status: data.status,
      message: data.message,
      expectedReturnTime: data.expected_return_time
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Server error"
    });

  }

});


// ==================================================
// UPDATE HOD STATUS
// PROTECTED - HOD LOGIN REQUIRED
// ==================================================

app.post("/api/status", authenticateToken, async (req, res) => {

  try {

    const { status, message, expectedReturnTime } = req.body;

    const { data, error } = await supabase
      .from("hod_status")
      .update({
        status: status,
        message: message ?? "",
        expected_return_time: expectedReturnTime ?? ""
      })
      .eq("id", 1)
      .select()
      .single();

    if (error) {

      console.error("Supabase UPDATE error:", error);

      return res.status(500).json({
        error: "Unable to update HOD status"
      });

    }

    res.json({
      status: data.status,
      message: data.message,
      expectedReturnTime: data.expected_return_time
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Server error"
    });

  }

});


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {

  console.log(`Backend server running on port ${PORT}`);

});