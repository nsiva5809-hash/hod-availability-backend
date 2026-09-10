const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 5000;

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());


// Test route
app.get("/", (req, res) => {
  res.json({
    message: "HOD Availability System Backend is running"
  });
});


// Get current HOD status
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


// Update HOD status
app.post("/api/status", async (req, res) => {
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


// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});