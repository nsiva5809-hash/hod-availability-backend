const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json());

// ==================================================
// SUPABASE
// ==================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==================================================
// JWT SECRET
// ==================================================

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "ERROR: JWT_SECRET environment variable is missing."
  );

  process.exit(1);
}

// ==================================================
// TEST ROUTE
// ==================================================

app.get("/", (req, res) => {
  res.json({
    message: "HOD Availability System Backend is running",
  });
});

// ==================================================
// ADMIN LOGIN
// ==================================================

app.post("/api/auth/admin-login", async (req, res) => {
  try {
    const { adminId, password } = req.body;

    if (!adminId || !password) {
      return res.status(400).json({
        error: "Admin ID and password are required",
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("admin_id", adminId.trim())
      .eq("active", true)
      .single();

    if (error || !admin) {
      console.error("Admin lookup error:", error);

      return res.status(401).json({
        error: "Invalid Admin ID or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid Admin ID or password",
      });
    }

    const token = jwt.sign(
      {
        userId: admin.id,
        adminId: admin.admin_id,
        name: admin.name,
        role: "admin",
      },
      JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    return res.json({
      message: "Admin login successful",

      token,

      user: {
        adminId: admin.admin_id,
        name: admin.name,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
});

// ==================================================
// HOD LOGIN
// ==================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { hodId, password } = req.body;

    if (!hodId || !password) {
      return res.status(400).json({
        error: "HOD ID and password are required",
      });
    }

    const { data: hod, error } = await supabase
      .from("hod_users")
      .select(`
        *,
        departments (
          id,
          department_code,
          department_name,
          active
        )
      `)
      .eq("hod_id", hodId.trim())
      .eq("active", true)
      .single();

    if (error || !hod) {
      console.error("HOD lookup error:", error);

      return res.status(401).json({
        error: "Invalid HOD ID or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      hod.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid HOD ID or password",
      });
    }

    const token = jwt.sign(
      {
        userId: hod.id,
        hodId: hod.hod_id,
        name: hod.name,
        role: "hod",
        departmentId: hod.department_id || null,
      },
      JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    return res.json({
      message: "Login successful",

      token,

      user: {
        hodId: hod.hod_id,
        name: hod.name,
        role: "hod",

        departmentId: hod.department_id || null,

        department: hod.departments
          ? {
              id: hod.departments.id,
              code: hod.departments.department_code,
              name: hod.departments.department_name,
              active: hod.departments.active,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("HOD login error:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
});

// ==================================================
// FACULTY LOGIN
// ==================================================

app.post("/api/auth/faculty-login", async (req, res) => {
  try {
    const { facultyId, password } = req.body;

    if (!facultyId || !password) {
      return res.status(400).json({
        error: "Faculty ID and password are required",
      });
    }

    const cleanFacultyId = facultyId.trim().toUpperCase();

    const { data: faculty, error } = await supabase
      .from("faculty_users")
      .select(`
        id,
        faculty_id,
        name,
        password_hash,
        department_id,
        role,
        active,
        departments (
          id,
          department_code,
          department_name,
          active
        )
      `)
      .eq("faculty_id", cleanFacultyId)
      .eq("active", true)
      .single();

    if (error || !faculty) {
      console.error("Faculty lookup error:", error);
      return res.status(401).json({
        error: "Invalid Faculty ID or password",
      });
    }

    if (!faculty.departments || !faculty.departments.active) {
      return res.status(403).json({
        error: "Your department is inactive. Please contact the administrator.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      faculty.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid Faculty ID or password",
      });
    }

    const token = jwt.sign(
      {
        userId: faculty.id,
        facultyId: faculty.faculty_id,
        name: faculty.name,
        role: "faculty",
        departmentId: faculty.department_id || null,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      message: "Faculty login successful",
      token,
      user: {
        facultyId: faculty.faculty_id,
        name: faculty.name,
        role: "faculty",
        departmentId: faculty.department_id || null,
        department: faculty.departments
          ? {
              id: faculty.departments.id,
              code: faculty.departments.department_code,
              name: faculty.departments.department_name,
              active: faculty.departments.active,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Faculty login error:", error);
    return res.status(500).json({
      error: "Server error",
    });
  }
});

// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const parts = authHeader.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer"
  ) {
    return res.status(401).json({
      error: "Invalid authorization format",
    });
  }

  const token = parts[1];

  if (!token) {
    return res.status(401).json({
      error: "Authentication token missing",
    });
  }

  try {
    const user = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = user;

    next();
  } catch (error) {
    console.error(
      "JWT verification error:",
      error
    );

    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

// ==================================================
// GET HOD STATUS
// PUBLIC
// ==================================================

app.get("/api/status", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("hod_status")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error(
        "Status fetch error:",
        error
      );

      return res.status(500).json({
        error: "Unable to fetch HOD status",
      });
    }

    return res.json({
      status: data.status,
      message: data.message,
      expectedReturnTime:
        data.expected_return_time,
    });
  } catch (error) {
    console.error(
      "Status error:",
      error
    );

    return res.status(500).json({
      error: "Server error",
    });
  }
});

// ==================================================
// UPDATE HOD STATUS
// HOD ONLY
// ==================================================

app.post(
  "/api/status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "hod") {
        return res.status(403).json({
          error:
            "Only HOD users can update HOD status",
        });
      }

      const {
        status,
        message,
        expectedReturnTime,
      } = req.body;

      const { data, error } =
        await supabase
          .from("hod_status")
          .update({
            status:
              status || "Available",

            message:
              message ?? "",

            expected_return_time:
              expectedReturnTime ?? "",
          })
          .eq("id", 1)
          .select()
          .single();

      if (error || !data) {
        console.error(
          "Status update error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to update HOD status",
        });
      }

      return res.json({
        status: data.status,
        message: data.message,
        expectedReturnTime:
          data.expected_return_time,
      });
    } catch (error) {
      console.error(
        "Status update error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// DEPARTMENT MANAGEMENT
// ADMIN ONLY
// ==================================================

// --------------------------------------------------
// GET ALL DEPARTMENTS
// --------------------------------------------------

app.get(
  "/api/admin/departments",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { data, error } =
        await supabase
          .from("departments")
          .select("*")
          .order("id", {
            ascending: true,
          });

      if (error) {
        console.error(
          "Get departments error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch departments",
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Department fetch error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// ADD DEPARTMENT
// --------------------------------------------------

app.post(
  "/api/admin/departments",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const {
        departmentCode,
        departmentName,
      } = req.body;

      if (
        !departmentCode ||
        !departmentName
      ) {
        return res.status(400).json({
          error:
            "Department code and department name are required",
        });
      }

      const cleanCode =
        departmentCode
          .trim()
          .toUpperCase();

      const cleanName =
        departmentName.trim();

      if (!cleanCode || !cleanName) {
        return res.status(400).json({
          error:
            "Department code and department name cannot be empty",
        });
      }

      const { data, error } =
        await supabase
          .from("departments")
          .insert([
            {
              department_code:
                cleanCode,

              department_name:
                cleanName,

              active: true,
            },
          ])
          .select()
          .single();

      if (error) {
        console.error(
          "Add department error:",
          error
        );

        if (error.code === "23505") {
          return res.status(409).json({
            error:
              "Department code already exists",
          });
        }

        return res.status(500).json({
          error:
            "Unable to add department",
        });
      }

      return res.status(201).json({
        message:
          "Department added successfully",

        department: data,
      });
    } catch (error) {
      console.error(
        "Department add error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// UPDATE DEPARTMENT
// --------------------------------------------------

app.put(
  "/api/admin/departments/:id",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { id } = req.params;

      const {
        departmentCode,
        departmentName,
      } = req.body;

      if (
        !departmentCode ||
        !departmentName
      ) {
        return res.status(400).json({
          error:
            "Department code and department name are required",
        });
      }

      const cleanCode =
        departmentCode
          .trim()
          .toUpperCase();

      const cleanName =
        departmentName.trim();

      if (!cleanCode || !cleanName) {
        return res.status(400).json({
          error:
            "Department code and department name cannot be empty",
        });
      }

      const { data, error } =
        await supabase
          .from("departments")
          .update({
            department_code:
              cleanCode,

            department_name:
              cleanName,
          })
          .eq("id", id)
          .select()
          .single();

      if (error) {
        console.error(
          "Update department error:",
          error
        );

        if (error.code === "23505") {
          return res.status(409).json({
            error:
              "Department code already exists",
          });
        }

        return res.status(500).json({
          error:
            "Unable to update department",
        });
      }

      return res.json({
        message:
          "Department updated successfully",

        department: data,
      });
    } catch (error) {
      console.error(
        "Department update error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// ACTIVATE / DEACTIVATE DEPARTMENT
// --------------------------------------------------

app.patch(
  "/api/admin/departments/:id/status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { id } = req.params;
      const { active } = req.body;

      if (typeof active !== "boolean") {
        return res.status(400).json({
          error:
            "Active must be true or false",
        });
      }

      const { data, error } =
        await supabase
          .from("departments")
          .update({
            active: active,
          })
          .eq("id", id)
          .select()
          .single();

      if (error) {
        console.error(
          "Department status error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to update department status",
        });
      }

      return res.json({
        message: active
          ? "Department activated successfully"
          : "Department deactivated successfully",

        department: data,
      });
    } catch (error) {
      console.error(
        "Department status error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// HOD MANAGEMENT
// ADMIN ONLY
// ==================================================

// --------------------------------------------------
// GET ALL HODS
// --------------------------------------------------

app.get(
  "/api/admin/hods",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { data, error } =
        await supabase
          .from("hod_users")
          .select(`
            id,
            hod_id,
            name,
            role,
            active,
            department_id,
            departments (
              id,
              department_code,
              department_name,
              active
            )
          `)
          .order("id", {
            ascending: true,
          });

      if (error) {
        console.error(
          "Get HODs error:",
          error
        );

        return res.status(500).json({
          error: "Unable to fetch HODs",
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "HOD fetch error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// ASSIGN HOD TO DEPARTMENT
// --------------------------------------------------

app.patch(
  "/api/admin/hods/:id/department",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { id } = req.params;
      const { departmentId } = req.body;

      if (!departmentId) {
        return res.status(400).json({
          error:
            "Department ID is required",
        });
      }

      const { data: department, error: departmentError } =
        await supabase
          .from("departments")
          .select(`
            id,
            department_code,
            department_name,
            active
          `)
          .eq("id", departmentId)
          .single();

      if (
        departmentError ||
        !department
      ) {
        return res.status(404).json({
          error:
            "Department not found",
        });
      }

      if (!department.active) {
        return res.status(400).json({
          error:
            "Cannot assign HOD to an inactive department",
        });
      }

      const { data, error } =
        await supabase
          .from("hod_users")
          .update({
            department_id:
              departmentId,
          })
          .eq("id", id)
          .select(`
            id,
            hod_id,
            name,
            role,
            active,
            department_id,
            departments (
              id,
              department_code,
              department_name,
              active
            )
          `)
          .single();

      if (error) {
        console.error(
          "Assign HOD department error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to assign HOD department",
        });
      }

      return res.json({
        message:
          "HOD department assigned successfully",

        hod: data,
      });
    } catch (error) {
      console.error(
        "HOD department assignment error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// ACTIVATE / DEACTIVATE HOD
// --------------------------------------------------

app.patch(
  "/api/admin/hods/:id/status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { id } = req.params;
      const { active } = req.body;

      if (typeof active !== "boolean") {
        return res.status(400).json({
          error:
            "Active must be true or false",
        });
      }

      const { data, error } =
        await supabase
          .from("hod_users")
          .update({
            active: active,
          })
          .eq("id", id)
          .select(`
            id,
            hod_id,
            name,
            role,
            active,
            department_id,
            departments (
              id,
              department_code,
              department_name,
              active
            )
          `)
          .single();

      if (error) {
        console.error(
          "HOD status error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to update HOD status",
        });
      }

      return res.json({
        message: active
          ? "HOD activated successfully"
          : "HOD deactivated successfully",

        hod: data,
      });
    } catch (error) {
      console.error(
        "HOD status error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// FACULTY MANAGEMENT
// ADMIN ONLY
// ==================================================

// --------------------------------------------------
// GET ALL FACULTY
// --------------------------------------------------

app.get(
  "/api/admin/faculty",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { data, error } =
        await supabase
          .from("faculty_users")
          .select(`
            id,
            faculty_id,
            name,
            department_id,
            role,
            active,
            created_at,
            departments (
              id,
              department_code,
              department_name,
              active
            )
          `)
          .order("id", {
            ascending: true,
          });

      if (error) {
        console.error(
          "Get faculty error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch faculty",
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Faculty fetch error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// ADD FACULTY
// --------------------------------------------------

app.post(
  "/api/admin/faculty",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const {
        facultyId,
        name,
        password,
        departmentId,
      } = req.body;

      if (
        !facultyId ||
        !name ||
        !password ||
        !departmentId
      ) {
        return res.status(400).json({
          error:
            "Faculty ID, name, password and department are required",
        });
      }

      const cleanFacultyId =
        facultyId.trim().toUpperCase();

      const cleanName =
        name.trim();

      const numericDepartmentId =
        Number(departmentId);

      if (
        !cleanFacultyId ||
        !cleanName ||
        !password.trim()
      ) {
        return res.status(400).json({
          error:
            "Faculty ID, name and password cannot be empty",
        });
      }

      if (
        !Number.isInteger(
          numericDepartmentId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid department",
        });
      }

      // Check department
      const {
        data: department,
        error: departmentError,
      } = await supabase
        .from("departments")
        .select(
          "id, department_code, department_name, active"
        )
        .eq("id", numericDepartmentId)
        .single();

      if (
        departmentError ||
        !department
      ) {
        return res.status(404).json({
          error:
            "Department not found",
        });
      }

      if (!department.active) {
        return res.status(400).json({
          error:
            "Cannot add faculty to an inactive department",
        });
      }

      // Hash password
      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      const { data, error } =
        await supabase
          .from("faculty_users")
          .insert([
            {
              faculty_id:
                cleanFacultyId,

              name:
                cleanName,

              password_hash:
                passwordHash,

              department_id:
                numericDepartmentId,

              role:
                "FACULTY",

              active:
                true,
            },
          ])
          .select(`
            id,
            faculty_id,
            name,
            department_id,
            role,
            active,
            created_at,
            departments (
              id,
              department_code,
              department_name,
              active
            )
          `)
          .single();

      if (error) {
        console.error(
          "Add faculty error:",
          error
        );

        if (error.code === "23505") {
          return res.status(409).json({
            error:
              "Faculty ID already exists",
          });
        }

        if (error.code === "23503") {
          return res.status(400).json({
            error:
              "Invalid department",
          });
        }

        return res.status(500).json({
          error:
            "Unable to add faculty",
        });
      }

      return res.status(201).json({
        message:
          "Faculty added successfully",

        faculty:
          data,
      });
    } catch (error) {
      console.error(
        "Faculty add error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// UPDATE FACULTY
// --------------------------------------------------

app.put(
  "/api/admin/faculty/:id",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { id } = req.params;

      const {
        facultyId,
        name,
        password,
        departmentId,
      } = req.body;

      if (
        !facultyId ||
        !name ||
        !departmentId
      ) {
        return res.status(400).json({
          error:
            "Faculty ID, name and department are required",
        });
      }

      const cleanFacultyId =
        facultyId.trim().toUpperCase();

      const cleanName =
        name.trim();

      const numericDepartmentId =
        Number(departmentId);

      if (
        !cleanFacultyId ||
        !cleanName
      ) {
        return res.status(400).json({
          error:
            "Faculty ID and name cannot be empty",
        });
      }

      if (
        !Number.isInteger(
          numericDepartmentId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid department",
        });
      }

      // Check department
      const {
        data: department,
        error: departmentError,
      } = await supabase
        .from("departments")
        .select(
          "id, department_code, department_name, active"
        )
        .eq("id", numericDepartmentId)
        .single();

      if (
        departmentError ||
        !department
      ) {
        return res.status(404).json({
          error:
            "Department not found",
        });
      }

      if (!department.active) {
        return res.status(400).json({
          error:
            "Cannot assign faculty to an inactive department",
        });
      }

      const updateData = {
        faculty_id:
          cleanFacultyId,

        name:
          cleanName,

        department_id:
          numericDepartmentId,
      };

      // Password is optional during edit
      if (
        password &&
        password.trim()
      ) {
        updateData.password_hash =
          await bcrypt.hash(
            password,
            10
          );
      }

      const { data, error } =
        await supabase
          .from("faculty_users")
          .update(updateData)
          .eq("id", id)
          .select(`
            id,
            faculty_id,
            name,
            department_id,
            role,
            active,
            created_at,
            departments (
              id,
              department_code,
              department_name,
              active
            )
          `)
          .single();

      if (error) {
        console.error(
          "Update faculty error:",
          error
        );

        if (error.code === "23505") {
          return res.status(409).json({
            error:
              "Faculty ID already exists",
          });
        }

        return res.status(500).json({
          error:
            "Unable to update faculty",
        });
      }

      return res.json({
        message:
          "Faculty updated successfully",

        faculty:
          data,
      });
    } catch (error) {
      console.error(
        "Faculty update error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// ACTIVATE / DEACTIVATE FACULTY
// --------------------------------------------------

app.patch(
  "/api/admin/faculty/:id/status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { id } = req.params;
      const { active } = req.body;

      if (typeof active !== "boolean") {
        return res.status(400).json({
          error:
            "Active must be true or false",
        });
      }

      const { data, error } =
        await supabase
          .from("faculty_users")
          .update({
            active:
              active,
          })
          .eq("id", id)
          .select(`
            id,
            faculty_id,
            name,
            department_id,
            role,
            active,
            created_at,
            departments (
              id,
              department_code,
              department_name,
              active
            )
          `)
          .single();

      if (error) {
        console.error(
          "Faculty status error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to update faculty status",
        });
      }

      return res.json({
        message:
          active
            ? "Faculty activated successfully"
            : "Faculty deactivated successfully",

        faculty:
          data,
      });
    } catch (error) {
      console.error(
        "Faculty status error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {
  console.log(
    `HOD Availability System Backend running on port ${PORT}`
  );
});