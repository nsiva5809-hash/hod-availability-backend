const fs = require("fs");

const path = "server.js";
let content = fs.readFileSync(path, "utf8");

const marker = "// ==================================================\r\n// START SERVER";

if (!content.includes(marker)) {
  console.log("START SERVER marker not found.");
  process.exit(1);
}

const block = `// ==================================================
// FACULTY TASK MANAGEMENT
// ==================================================

// GET FACULTY TASKS
app.get(
  "/api/faculty/tasks",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const { data, error } = await supabase
        .from("faculty_tasks")
        .select(\`
          id,
          faculty_user_id,
          task_date,
          day_of_week,
          period_no,
          task_name,
          task_description,
          status_level,
          created_at,
          updated_at
        \`)
        .eq("faculty_user_id", req.user.userId)
        .order("task_date", { ascending: false })
        .order("period_no", { ascending: true });

      if (error) {
        console.error("Faculty tasks fetch error:", error);

        return res.status(500).json({
          error: "Unable to fetch tasks",
        });
      }

      return res.json(data || []);

    } catch (error) {
      console.error("Faculty tasks error:", error);

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// ADD FACULTY TASK
app.post(
  "/api/faculty/tasks",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const {
        taskDate,
        dayOfWeek,
        periodNo,
        taskName,
        taskDescription,
        statusLevel,
      } = req.body;

      const allowedDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const allowedLevels = ["L1", "L2", "L3"];

      if (!taskDate) {
        return res.status(400).json({
          error: "Task date is required",
        });
      }

      if (!allowedDays.includes(dayOfWeek)) {
        return res.status(400).json({
          error: "Invalid day",
        });
      }

      if (
        !Number.isInteger(Number(periodNo)) ||
        Number(periodNo) < 1 ||
        Number(periodNo) > 8
      ) {
        return res.status(400).json({
          error: "Invalid period",
        });
      }

      if (!taskName || !taskName.trim()) {
        return res.status(400).json({
          error: "Task name is required",
        });
      }

      const level = statusLevel || "L1";

      if (!allowedLevels.includes(level)) {
        return res.status(400).json({
          error: "Invalid task status",
        });
      }

      const taskData = {
        faculty_user_id: req.user.userId,
        task_date: taskDate,
        day_of_week: dayOfWeek,
        period_no: Number(periodNo),
        task_name: taskName.trim(),
        task_description: taskDescription?.trim() || "",
        status_level: level,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("faculty_tasks")
        .insert(taskData)
        .select("*")
        .single();

      if (error) {
        console.error("Faculty task save error:", error);

        return res.status(500).json({
          error: "Unable to save task",
        });
      }

      return res.json({
        message: "Task saved successfully",
        data,
      });

    } catch (error) {
      console.error("Faculty task save error:", error);

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// UPDATE FACULTY TASK
app.put(
  "/api/faculty/tasks/:id",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const taskId = Number(req.params.id);

      if (!Number.isInteger(taskId)) {
        return res.status(400).json({
          error: "Invalid task ID",
        });
      }

      const {
        taskDate,
        dayOfWeek,
        periodNo,
        taskName,
        taskDescription,
        statusLevel,
      } = req.body;

      const allowedDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const allowedLevels = ["L1", "L2", "L3"];

      if (!taskDate) {
        return res.status(400).json({
          error: "Task date is required",
        });
      }

      if (!allowedDays.includes(dayOfWeek)) {
        return res.status(400).json({
          error: "Invalid day",
        });
      }

      if (
        !Number.isInteger(Number(periodNo)) ||
        Number(periodNo) < 1 ||
        Number(periodNo) > 8
      ) {
        return res.status(400).json({
          error: "Invalid period",
        });
      }

      if (!taskName || !taskName.trim()) {
        return res.status(400).json({
          error: "Task name is required",
        });
      }

      if (!allowedLevels.includes(statusLevel)) {
        return res.status(400).json({
          error: "Invalid task status",
        });
      }

      const updateData = {
        task_date: taskDate,
        day_of_week: dayOfWeek,
        period_no: Number(periodNo),
        task_name: taskName.trim(),
        task_description: taskDescription?.trim() || "",
        status_level: statusLevel,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("faculty_tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("faculty_user_id", req.user.userId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Faculty task update error:", error);

        return res.status(500).json({
          error: "Unable to update task",
        });
      }

      if (!data) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      return res.json({
        message: "Task updated successfully",
        data,
      });

    } catch (error) {
      console.error("Faculty task update error:", error);

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// DELETE FACULTY TASK
app.delete(
  "/api/faculty/tasks/:id",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const taskId = Number(req.params.id);

      if (!Number.isInteger(taskId)) {
        return res.status(400).json({
          error: "Invalid task ID",
        });
      }

      const { data, error } = await supabase
        .from("faculty_tasks")
        .delete()
        .eq("id", taskId)
        .eq("faculty_user_id", req.user.userId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Faculty task delete error:", error);

        return res.status(500).json({
          error: "Unable to delete task",
        });
      }

      if (!data) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      return res.json({
        message: "Task deleted successfully",
      });

    } catch (error) {
      console.error("Faculty task delete error:", error);

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

`;

content = content.replace(marker, block + marker);

fs.writeFileSync(path, content, "utf8");

console.log("Faculty Task APIs added successfully.");