const express = require("express");
const cors = require("cors");

const app = express();

// Online hosting provides PORT automatically.
// If running on your PC, it will use 5000.
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let hodStatus = {
  status: "Available",
  message: "",
  expectedReturnTime: ""
};

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "HOD Availability System Backend is running"
  });
});

// Get current HOD status
app.get("/api/status", (req, res) => {
  res.json(hodStatus);
});

// Update HOD status
app.post("/api/status", (req, res) => {
  const { status, message, expectedReturnTime } = req.body;

  hodStatus = {
    status: status || hodStatus.status,
    message: message ?? hodStatus.message,
    expectedReturnTime:
      expectedReturnTime ?? hodStatus.expectedReturnTime
  };

  res.json(hodStatus);
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});