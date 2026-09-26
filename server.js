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

app.use(
  cors({
    origin: [
      "https://hod-availability-frontend.vercel.app",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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

    res.status(500).json({
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

    if (
      !faculty.departments ||
      !faculty.departments.active
    ) {
      return res.status(403).json({
        error:
          "Your department is inactive. Please contact the administrator.",
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
        departmentId:
          faculty.department_id || null,
      },
      JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    return res.json({
      message: "Faculty login successful",

      token,

      user: {
        facultyId: faculty.faculty_id,
        name: faculty.name,
        role: "faculty",

        departmentId:
          faculty.department_id || null,

        department: faculty.departments
          ? {
              id: faculty.departments.id,
              code:
                faculty.departments.department_code,
              name:
                faculty.departments.department_name,
              active:
                faculty.departments.active,
            }
          : null,
      },
    });
  } catch (error) {
    console.error(
      "Faculty login error:",
      error
    );

    return res.status(500).json({
      error: "Server error",
    });
  }
});

// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

function authenticateToken(req, res, next) {
  const authHeader =
    req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const parts =
    authHeader.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer"
  ) {
    return res.status(401).json({
      error:
        "Invalid authorization format",
    });
  }

  const token = parts[1];

  if (!token) {
    return res.status(401).json({
      error:
        "Authentication token missing",
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
      error:
        "Invalid or expired token",
    });
  }
}

// ==================================================
// GET HOD STATUS
// HOD TOKEN OR PUBLIC hodId QUERY
// ==================================================

app.get(
  "/api/status",
  async (req, res) => {
    try {
      let hodUserId = null;

      // If a logged-in HOD token is supplied, always use
      // that HOD's database ID.
      const authHeader =
        req.headers.authorization;

      if (authHeader) {
        const parts =
          authHeader.split(" ");

        if (
          parts.length === 2 &&
          parts[0] === "Bearer" &&
          parts[1]
        ) {
          try {
            const user = jwt.verify(
              parts[1],
              JWT_SECRET
            );

            if (user.role === "hod") {
              hodUserId = Number(user.userId);
            }
          } catch {
            // Fall back to the public hodId query below.
          }
        }
      }

      // Public compatibility:
      // /api/status?hodId=HOD001
      if (!hodUserId && req.query.hodId) {
        const {
          data: hod,
          error: hodError,
        } = await supabase
          .from("hod_users")
          .select("id")
          .eq(
            "hod_id",
            String(req.query.hodId)
              .trim()
              .toUpperCase()
          )
          .eq("active", true)
          .maybeSingle();

        if (hodError) {
          console.error(
            "HOD lookup error:",
            hodError
          );

          return res.status(500).json({
            error:
              "Unable to identify HOD",
          });
        }

        if (hod) {
          hodUserId = hod.id;
        }
      }

      // If neither authentication nor hodId was supplied,
      // do not silently return one HOD's status.
      if (!hodUserId) {
        return res.status(400).json({
          error:
            "HOD identification is required. Use a HOD login token or ?hodId=HOD001.",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("hod_status")
        .select(`
          id,
          hod_user_id,
          status,
          message,
          expected_return_time,
          updated_at
        `)
        .eq(
          "hod_user_id",
          hodUserId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Status fetch error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch HOD status",
        });
      }

      // A HOD may exist before its status row is created.
      if (!data) {
        return res.json({
          status: "Available",
          message: "",
          expectedReturnTime: "",
          hodUserId,
        });
      }

      return res.json({
        status:
          data.status ||
          "Available",

        message:
          data.message ||
          "",

        expectedReturnTime:
          data.expected_return_time ||
          "",

        hodUserId:
          data.hod_user_id,

        updatedAt:
          data.updated_at ||
          null,
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
  }
);

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

      const hodUserId =
        Number(req.user.userId);

      if (!Number.isInteger(hodUserId)) {
        return res.status(401).json({
          error:
            "Invalid HOD identity in authentication token",
        });
      }

      const {
        status,
        message,
        expectedReturnTime,
      } = req.body;

      const statusValue =
        status || "Available";

      const {
        data,
        error,
      } = await supabase
        .from("hod_status")
        .upsert(
          {
            hod_user_id:
              hodUserId,

            status:
              statusValue,

            message:
              message ?? "",

            expected_return_time:
              expectedReturnTime ?? "",

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "hod_user_id",
          }
        )
        .select(`
          id,
          hod_user_id,
          status,
          message,
          expected_return_time,
          updated_at
        `)
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
        message:
          "HOD status updated successfully",

        status:
          data.status,

        hodUserId:
          data.hod_user_id,

        facultyMessage:
          data.message,

        expectedReturnTime:
          data.expected_return_time,

        updatedAt:
          data.updated_at,
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
          .order(
            "department_name",
            {
              ascending: true,
            }
          );

      if (error) {
        console.error(
          "Departments fetch error:",
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
        "Departments error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// CREATE DEPARTMENT
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

      const { data, error } =
        await supabase
          .from("departments")
          .insert([
            {
              department_code:
                departmentCode
                  .trim()
                  .toUpperCase(),

              department_name:
                departmentName.trim(),

              active: true,
            },
          ])
          .select()
          .single();

      if (error) {
        console.error(
          "Department creation error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to create department",
        });
      }

      return res.status(201).json({
        message:
          "Department created successfully",
        department: data,
      });
    } catch (error) {
      console.error(
        "Department creation error:",
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

      const departmentId =
        Number(req.params.id);

      if (!Number.isInteger(departmentId)) {
        return res.status(400).json({
          error:
            "Invalid department ID",
        });
      }

      const {
        departmentCode,
        departmentName,
        active,
      } = req.body;

      const updateData = {};

      if (departmentCode !== undefined) {
        updateData.department_code =
          departmentCode
            .trim()
            .toUpperCase();
      }

      if (departmentName !== undefined) {
        updateData.department_name =
          departmentName.trim();
      }

      if (active !== undefined) {
        updateData.active = active;
      }

      const { data, error } =
        await supabase
          .from("departments")
          .update(updateData)
          .eq("id", departmentId)
          .select()
          .single();

      if (error) {
        console.error(
          "Department update error:",
          error
        );

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
// ==================================================
// HOD MANAGEMENT
// ADMIN ONLY
// ==================================================

// --------------------------------------------------
// GET ALL HOD USERS
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

      const {
        data: hods,
        error,
      } = await supabase
        .from("hod_users")
        .select(`
          id,
          hod_id,
          name,
          department_id,
          active,
          departments (
            id,
            department_code,
            department_name
          )
        `)
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "HOD fetch error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch HOD users",
        });
      }

      const hodList =
        hods || [];

      const hodIds =
        hodList.map(
          (hod) => hod.id
        );

      let statusList = [];

      if (hodIds.length > 0) {
        const {
          data: statuses,
          error: statusError,
        } = await supabase
          .from("hod_status")
          .select(`
            id,
            hod_user_id,
            status,
            message,
            expected_return_time,
            updated_at
          `)
          .in(
            "hod_user_id",
            hodIds
          );

        if (statusError) {
          console.error(
            "HOD status fetch error:",
            statusError
          );

          return res.status(500).json({
            error:
              "Unable to fetch HOD statuses",
          });
        }

        statusList =
          statuses || [];
      }

      const result =
        hodList.map(
          (hod) => {
            const status =
              statusList.find(
                (item) =>
                  item.hod_user_id ===
                  hod.id
              );

            return {
              ...hod,

              status:
                status?.status ||
                "Available",

              message:
                status?.message ||
                "",

              expected_return_time:
                status?.expected_return_time ||
                "",

              updated_at:
                status?.updated_at ||
                null,
            };
          }
        );

      return res.json(result);
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
// CREATE HOD
// --------------------------------------------------

app.post(
  "/api/admin/hods",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const {
        hodId,
        name,
        password,
        departmentId,
      } = req.body;

      if (
        !hodId ||
        !name ||
        !password ||
        !departmentId
      ) {
        return res.status(400).json({
          error:
            "HOD ID, name, password and department are required",
        });
      }

      const hashedPassword =
        await bcrypt.hash(password, 10);

      const { data, error } =
        await supabase
          .from("hod_users")
          .insert([
            {
              hod_id: hodId
                .trim()
                .toUpperCase(),

              name: name.trim(),

              password_hash:
                hashedPassword,

              department_id:
                Number(departmentId),

              active: true,
            },
          ])
          .select(`
            id,
            hod_id,
            name,
            department_id,
            active
          `)
          .single();

      if (error) {
        console.error(
          "HOD creation error:",
          error
        );

        return res.status(500).json({
          error: "Unable to create HOD",
        });
      }

      // Create the HOD's own availability record.
      // This keeps every HOD completely independent.
      const {
        error: statusError,
      } = await supabase
        .from("hod_status")
        .upsert(
          {
            hod_user_id:
              data.id,

            status:
              "Available",

            message:
              "",

            expected_return_time:
              "",

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "hod_user_id",
          }
        );

      if (statusError) {
        console.error(
          "HOD status creation error:",
          statusError
        );

        // HOD account was created successfully.
        // Report the status initialization problem clearly.
        return res.status(201).json({
          message:
            "HOD created successfully, but the initial availability record could not be created.",
          hod: data,
          statusWarning:
            "Please refresh or update this HOD's status once.",
        });
      }

      return res.status(201).json({
        message:
          "HOD created successfully",
        hod: data,
      });
    } catch (error) {
      console.error(
        "HOD creation error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// UPDATE HOD
// --------------------------------------------------

app.put(
  "/api/admin/hods/:id",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const hodUserId =
        Number(req.params.id);

      if (!Number.isInteger(hodUserId)) {
        return res.status(400).json({
          error: "Invalid HOD ID",
        });
      }

      const {
        hodId,
        name,
        password,
        departmentId,
        active,
      } = req.body;

      const updateData = {};

      if (hodId !== undefined) {
        updateData.hod_id =
          hodId
            .trim()
            .toUpperCase();
      }

      if (name !== undefined) {
        updateData.name =
          name.trim();
      }

      if (departmentId !== undefined) {
        updateData.department_id =
          Number(departmentId);
      }

      if (active !== undefined) {
        updateData.active = active;
      }

      if (
        password !== undefined &&
        password !== ""
      ) {
        updateData.password_hash =
          await bcrypt.hash(
            password,
            10
          );
      }

      const { data, error } =
        await supabase
          .from("hod_users")
          .update(updateData)
          .eq("id", hodUserId)
          .select(`
            id,
            hod_id,
            name,
            department_id,
            active
          `)
          .single();

      if (error) {
        console.error(
          "HOD update error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to update HOD",
        });
      }

      return res.json({
        message:
          "HOD updated successfully",
        hod: data,
      });
    } catch (error) {
      console.error(
        "HOD update error:",
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
            departments (
              id,
              department_code,
              department_name
            )
          `)
          .order("name", {
            ascending: true,
          });

      if (error) {
        console.error(
          "Faculty fetch error:",
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
// CREATE FACULTY
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
        role,
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

      const hashedPassword =
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
                facultyId
                  .trim()
                  .toUpperCase(),

              name: name.trim(),

              password_hash:
                hashedPassword,

              department_id:
                Number(departmentId),

              role:
                role || "FACULTY",

              active: true,
            },
          ])
          .select(`
            id,
            faculty_id,
            name,
            department_id,
            role,
            active
          `)
          .single();

      if (error) {
        console.error(
          "Faculty creation error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to create faculty",
        });
      }

      return res.status(201).json({
        message:
          "Faculty created successfully",
        faculty: data,
      });
    } catch (error) {
      console.error(
        "Faculty creation error:",
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

      const facultyUserId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          facultyUserId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid faculty ID",
        });
      }

      const {
        facultyId,
        name,
        password,
        departmentId,
        role,
        active,
      } = req.body;

      const updateData = {};

      if (facultyId !== undefined) {
        updateData.faculty_id =
          facultyId
            .trim()
            .toUpperCase();
      }

      if (name !== undefined) {
        updateData.name =
          name.trim();
      }

      if (
        departmentId !==
        undefined
      ) {
        updateData.department_id =
          Number(departmentId);
      }

      if (role !== undefined) {
        updateData.role = role;
      }

      if (active !== undefined) {
        updateData.active =
          active;
      }

      if (
        password !== undefined &&
        password !== ""
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
          .eq(
            "id",
            facultyUserId
          )
          .select(`
            id,
            faculty_id,
            name,
            department_id,
            role,
            active
          `)
          .single();

      if (error) {
        console.error(
          "Faculty update error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to update faculty",
        });
      }

      return res.json({
        message:
          "Faculty updated successfully",
        faculty: data,
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

// ==================================================
// ADMIN - DELETE / DEACTIVATE FACULTY
// ==================================================

app.delete(
  "/api/admin/faculty/:id",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const facultyUserId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          facultyUserId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid faculty ID",
        });
      }

      const { data, error } =
        await supabase
          .from("faculty_users")
          .update({
            active: false,
          })
          .eq(
            "id",
            facultyUserId
          )
          .select()
          .single();

      if (error) {
        console.error(
          "Faculty deactivate error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to deactivate faculty",
        });
      }

      return res.json({
        message:
          "Faculty deactivated successfully",
        faculty: data,
      });
    } catch (error) {
      console.error(
        "Faculty deactivate error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// =====================================================
// GET CURRENT FACULTY STATUS FROM TIMETABLE
// =====================================================

app.get(
  "/api/faculty/current-status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const indiaParts =
        new Intl.DateTimeFormat(
          "en-IN",
          {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        ).formatToParts(new Date());

      const dayOfWeek =
        indiaParts.find(
          (part) => part.type === "weekday"
        )?.value || "";

      const year =
        indiaParts.find(
          (part) => part.type === "year"
        )?.value || "";

      const month =
        indiaParts.find(
          (part) => part.type === "month"
        )?.value || "";

      const day =
        indiaParts.find(
          (part) => part.type === "day"
        )?.value || "";

      const currentDate =
        `${year}-${month}-${day}`;

      const currentHour = Number(
        indiaParts.find(
          (part) => part.type === "hour"
        )?.value || 0
      );

      const currentMinute = Number(
        indiaParts.find(
          (part) => part.type === "minute"
        )?.value || 0
      );

      const currentMinutes =
        currentHour * 60 +
        currentMinute;

      // =====================================================
      // 1. CHECK COLLEGE HOLIDAY
      // =====================================================

      const {
        data: holiday,
        error: holidayError,
      } = await supabase
        .from("college_holidays")
        .select(`
          id,
          holiday_date,
          holiday_name,
          description
        `)
        .eq(
          "holiday_date",
          currentDate
        )
        .maybeSingle();

      if (holidayError) {
        console.error(
          "Faculty holiday lookup error:",
          holidayError
        );

        return res.status(500).json({
          error:
            "Unable to check holiday status",
        });
      }

      if (holiday) {
        return res.json({
          status: "Holiday",
          date: currentDate,
          dayOfWeek: dayOfWeek,
          periodNo: null,
          subject: null,
          className: null,
          section: null,
          room: null,
          holidayName:
            holiday.holiday_name || "",
          holidayDescription:
            holiday.description || "",
        });
      }

      // =====================================================
      // 2. CHECK FACULTY LEAVE
      // =====================================================

      const {
        data: leave,
        error: leaveError,
      } = await supabase
        .from("faculty_leaves")
        .select(`
          id,
          leave_date,
          reason
        `)
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .eq(
          "leave_date",
          currentDate
        )
        .maybeSingle();

      if (leaveError) {
        console.error(
          "Faculty leave lookup error:",
          leaveError
        );

        return res.status(500).json({
          error:
            "Unable to check leave status",
        });
      }

      if (leave) {
        return res.json({
          status: "Leave",
          date: currentDate,
          dayOfWeek: dayOfWeek,
          periodNo: null,
          subject: null,
          className: null,
          section: null,
          room: null,
          leaveReason:
            leave.reason || "",
        });
      }

      // =====================================================
      // 3. COLLEGE TIMING
      // =====================================================

      const collegeStart =
        9 * 60 + 15;

      const collegeEnd =
        16 * 60 + 50;

      const isSunday =
        dayOfWeek === "Sunday";

      const collegeClosed =
        isSunday ||
        currentMinutes < collegeStart ||
        currentMinutes >= collegeEnd;

      if (collegeClosed) {
        return res.json({
          status: "Unavailable",
          date: currentDate,
          dayOfWeek: dayOfWeek,
          periodNo: null,
          subject: null,
          className: null,
          section: null,
          room: null,
        });
      }

      // =====================================================
      // 4. PERIOD TIMINGS
      // =====================================================

      const periodTimes = {
        1: {
          start: 9 * 60 + 15,
          end: 10 * 60 + 5,
        },
        2: {
          start: 10 * 60 + 5,
          end: 10 * 60 + 55,
        },
        3: {
          start: 10 * 60 + 55,
          end: 11 * 60 + 45,
        },
        4: {
          start: 11 * 60 + 45,
          end: 12 * 60 + 35,
        },
        5: {
          start: 13 * 60 + 30,
          end: 14 * 60 + 20,
        },
        6: {
          start: 14 * 60 + 20,
          end: 15 * 60 + 10,
        },
        7: {
          start: 15 * 60 + 10,
          end: 16 * 60,
        },
        8: {
          start: 16 * 60,
          end: 16 * 60 + 50,
        },
      };

      // =====================================================
      // 5. GET TODAY'S TIMETABLE
      // =====================================================

      const {
        data,
        error,
      } = await supabase
        .from("faculty_timetable")
        .select(`
          id,
          day_of_week,
          period_no,
          subject,
          class_name,
          section,
          room
        `)
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .eq(
          "day_of_week",
          dayOfWeek
        )
        .order("period_no", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Faculty current status database error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to calculate faculty status",
        });
      }

      // =====================================================
      // 6. FIND CURRENT CLASS
      // =====================================================

      let currentClass = null;

      for (
        const timetableEntry of data || []
      ) {
        const period =
          periodTimes[
            Number(
              timetableEntry.period_no
            )
          ];

        if (!period) {
          continue;
        }

        if (
          currentMinutes >=
            period.start &&
          currentMinutes <
            period.end
        ) {
          currentClass =
            timetableEntry;

          break;
        }
      }

      // =====================================================
      // 7. IN CLASS
      // =====================================================

      if (currentClass) {
        return res.json({
          status: "In Class",
          date: currentDate,
          dayOfWeek: dayOfWeek,
          periodNo:
            Number(
              currentClass.period_no
            ),
          subject:
            currentClass.subject ||
            "",
          className:
            currentClass.class_name ||
            "",
          section:
            currentClass.section ||
            "",
          room:
            currentClass.room ||
            "",
        });
      }

      // =====================================================
      // 8. AVAILABLE
      // =====================================================

      return res.json({
        status: "Available",
        date: currentDate,
        dayOfWeek: dayOfWeek,
        periodNo: null,
        subject: null,
        className: null,
        section: null,
        room: null,
      });

    } catch (error) {
      console.error(
        "Faculty current status error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// ==================================================
// ADMIN - DELETE / DEACTIVATE HOD
// ==================================================

app.delete(
  "/api/admin/hods/:id",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const hodUserId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          hodUserId
        )
      ) {
        return res.status(400).json({
          error: "Invalid HOD ID",
        });
      }

      const { data, error } =
        await supabase
          .from("hod_users")
          .update({
            active: false,
          })
          .eq(
            "id",
            hodUserId
          )
          .select()
          .single();

      if (error) {
        console.error(
          "HOD deactivate error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to deactivate HOD",
        });
      }

      return res.json({
        message:
          "HOD deactivated successfully",
        hod: data,
      });
    } catch (error) {
      console.error(
        "HOD deactivate error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// ADMIN - RESET FACULTY PASSWORD
// ==================================================

app.post(
  "/api/admin/faculty/:id/reset-password",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const facultyUserId =
        Number(req.params.id);

      const {
        newPassword,
      } = req.body;

      if (
        !Number.isInteger(
          facultyUserId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid faculty ID",
        });
      }

      if (
        !newPassword ||
        newPassword.length < 4
      ) {
        return res.status(400).json({
          error:
            "Password must contain at least 4 characters",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          newPassword,
          10
        );

      const { error } =
        await supabase
          .from("faculty_users")
          .update({
            password_hash:
              passwordHash,
          })
          .eq(
            "id",
            facultyUserId
          );

      if (error) {
        console.error(
          "Faculty password reset error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to reset faculty password",
        });
      }

      return res.json({
        message:
          "Faculty password reset successfully",
      });
    } catch (error) {
      console.error(
        "Faculty password reset error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// ADMIN - RESET HOD PASSWORD
// ==================================================

app.post(
  "/api/admin/hods/:id/reset-password",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const hodUserId =
        Number(req.params.id);

      const {
        newPassword,
      } = req.body;

      if (
        !Number.isInteger(
          hodUserId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid HOD ID",
        });
      }

      if (
        !newPassword ||
        newPassword.length < 4
      ) {
        return res.status(400).json({
          error:
            "Password must contain at least 4 characters",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          newPassword,
          10
        );

      const { error } =
        await supabase
          .from("hod_users")
          .update({
            password_hash:
              passwordHash,
          })
          .eq(
            "id",
            hodUserId
          );

      if (error) {
        console.error(
          "HOD password reset error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to reset HOD password",
        });
      }

      return res.json({
        message:
          "HOD password reset successfully",
      });
    } catch (error) {
      console.error(
        "HOD password reset error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// ADMIN DASHBOARD SUMMARY
// ==================================================

app.get(
  "/api/admin/dashboard",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const [
        departmentsResult,
        hodsResult,
        facultyResult,
      ] = await Promise.all([
        supabase
          .from("departments")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("active", true),

        supabase
          .from("hod_users")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("active", true),

        supabase
          .from("faculty_users")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("active", true),
      ]);

      return res.json({
        departments:
          departmentsResult.count || 0,

        hods:
          hodsResult.count || 0,

        faculty:
          facultyResult.count || 0,
      });
    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// ==================================================
// FACULTY AVAILABILITY
// ==================================================

// GET CURRENT FACULTY STATUS
app.get(
  "/api/faculty/status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const { data, error } =
        await supabase
          .from("faculty_status")
          .select("*")
          .eq(
            "faculty_user_id",
            req.user.userId
          )
          .maybeSingle();

      if (error) {
        console.error(
          "Faculty status fetch error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch faculty status",
        });
      }

      return res.json(
        data || {
          status: "Not Available",
          message: "",
          expectedReturnTime: "",
        }
      );
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

// --------------------------------------------------
// UPDATE FACULTY STATUS
// --------------------------------------------------

app.post(
  "/api/faculty/status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const {
        status,
        message,
        expectedReturnTime,
      } = req.body;

      const allowedStatuses = [
        "Available",
        "In Meeting",
        "Away",
        "Not Available",
      ];

      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          error:
            "Invalid faculty status",
        });
      }

      const {
        data: existingStatus,
        error: existingError,
      } = await supabase
        .from("faculty_status")
        .select("id")
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Faculty status lookup error:",
          existingError
        );

        return res.status(500).json({
          error:
            "Unable to check faculty status",
        });
      }

      let data;
      let error;

      // ------------------------------------------------
      // UPDATE EXISTING STATUS
      // ------------------------------------------------

      if (existingStatus) {
        const result =
          await supabase
            .from("faculty_status")
            .update({
              status,
              message:
                message ?? "",
              expected_return_time:
                expectedReturnTime ??
                "",
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "faculty_user_id",
              req.user.userId
            )
            .select("*")
            .single();

        data = result.data;
        error = result.error;
      }

      // ------------------------------------------------
      // INSERT NEW STATUS
      // ------------------------------------------------

      else {
        const result =
          await supabase
            .from("faculty_status")
            .insert([
              {
                faculty_user_id:
                  req.user.userId,

                status,

                message:
                  message ?? "",

                expected_return_time:
                  expectedReturnTime ??
                  "",

                updated_at:
                  new Date().toISOString(),
              },
            ])
            .select("*")
            .single();

        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error(
          "Faculty status update error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to update faculty status",
        });
      }

      return res.json({
        message:
          "Faculty status updated successfully",

        status:
          data.status,

        facultyUserId:
          data.faculty_user_id,

        facultyMessage:
          data.message,

        expectedReturnTime:
          data.expected_return_time,

        updatedAt:
          data.updated_at,
      });
    } catch (error) {
      console.error(
        "Faculty status update error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// STUDENT PORTAL
// PUBLIC APIs
// NO LOGIN REQUIRED
// ==================================================

// --------------------------------------------------
// GET ACTIVE DEPARTMENTS
// --------------------------------------------------

app.get(
  "/api/student/departments",
  async (req, res) => {
    try {
      const { data, error } =
        await supabase
          .from("departments")
          .select(`
            id,
            department_code,
            department_name
          `)
          .eq("active", true)
          .order(
            "department_name",
            {
              ascending: true,
            }
          );

      if (error) {
        console.error(
          "Student departments error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch departments",
        });
      }

      return res.json(
        (data || []).map(
          (department) => ({
            id: department.id,

            code:
              department.department_code,

            name:
              department.department_name,
          })
        )
      );
    } catch (error) {
      console.error(
        "Student departments error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// --------------------------------------------------
// GET DEPARTMENT AVAILABILITY
// HOD + FACULTY
// PUBLIC API
// --------------------------------------------------

app.get(
  "/api/student/department/:departmentId",
  async (req, res) => {
    try {
      const departmentId = Number(
        req.params.departmentId
      );

      if (!Number.isInteger(departmentId)) {
        return res.status(400).json({
          error: "Invalid department ID",
        });
      }

      // ==================================================
      // GET DEPARTMENT
      // ==================================================

      const {
        data: department,
        error: departmentError,
      } = await supabase
        .from("departments")
        .select(`
          id,
          department_code,
          department_name,
          active
        `)
        .eq("id", departmentId)
        .eq("active", true)
        .maybeSingle();

      if (departmentError) {
        console.error(
          "Department lookup error:",
          departmentError
        );

        return res.status(500).json({
          error: "Unable to fetch department",
        });
      }

      if (!department) {
        return res.status(404).json({
          error: "Department not found",
        });
      }

      // ==================================================
      // GET HOD
      // ==================================================

      const {
        data: hod,
        error: hodError,
      } = await supabase
        .from("hod_users")
        .select(`
          id,
          hod_id,
          name,
          department_id,
          active
        `)
        .eq("department_id", departmentId)
        .eq("active", true)
        .maybeSingle();

      if (hodError) {
        console.error(
          "Student HOD lookup error:",
          hodError
        );

        return res.status(500).json({
          error: "Unable to fetch HOD",
        });
      }

      // ==================================================
      // GET HOD STATUS
      // ==================================================

      let hodStatus = {
        status: "Unavailable",
        message: "",
        expectedReturnTime: "",
      };

      const {
        data: hodStatusData,
        error: hodStatusError,
      } = await supabase
        .from("hod_status")
        .select(`
          id,
          hod_user_id,
          status,
          message,
          expected_return_time,
          updated_at
        `)
        .eq(
          "hod_user_id",
          hod?.id || -1
        )
        .maybeSingle();

      if (hodStatusError) {
        console.error(
          "HOD status lookup error:",
          hodStatusError
        );
      }

      if (hodStatusData) {
        hodStatus = {
          status:
            hodStatusData.status ||
            "Unavailable",

          message:
            hodStatusData.message ||
            "",

          expectedReturnTime:
            hodStatusData.expected_return_time ||
            "",
        };
      }

      // ==================================================
      // GET FACULTY
      // ==================================================

      const {
        data: faculty,
        error: facultyError,
      } = await supabase
        .from("faculty_users")
        .select(`
          id,
          faculty_id,
          name,
          department_id,
          role,
          active
        `)
        .eq("department_id", departmentId)
        .eq("active", true)
        .order("name", {
          ascending: true,
        });

      if (facultyError) {
        console.error(
          "Student faculty lookup error:",
          facultyError
        );

        return res.status(500).json({
          error: "Unable to fetch faculty",
        });
      }

      // ==================================================
      // INDIA CURRENT DATE + TIME
      // ==================================================

      const indiaParts =
        new Intl.DateTimeFormat(
          "en-IN",
          {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        ).formatToParts(new Date());

      const currentDay =
        indiaParts.find(
          (part) =>
            part.type === "weekday"
        )?.value || "";

      const currentHour = Number(
        indiaParts.find(
          (part) =>
            part.type === "hour"
        )?.value || 0
      );

      const currentMinute = Number(
        indiaParts.find(
          (part) =>
            part.type === "minute"
        )?.value || 0
      );

      const currentMinutes =
        currentHour * 60 +
        currentMinute;

      // ==================================================
      // COLLEGE HOURS
      // ==================================================
      //
      // Monday-Saturday:
      // 09:15 AM - 04:50 PM
      //
      // Sunday:
      // College closed
      //
      // Before 09:15:
      // Unavailable
      //
      // After 04:50:
      // Unavailable
      // ==================================================

      const collegeStart =
        9 * 60 + 15;

      const collegeEnd =
        16 * 60 + 50;

      const isSunday =
        currentDay === "Sunday";

      const collegeClosed =
        isSunday ||
        currentMinutes < collegeStart ||
        currentMinutes >= collegeEnd;

      // ==================================================
      // PERIOD TIMINGS
      // ==================================================

      const periodTimes = {
        1: [555, 605],   // 09:15 - 10:05
        2: [605, 655],   // 10:05 - 10:55
        3: [655, 705],   // 10:55 - 11:45
        4: [705, 755],   // 11:45 - 12:35
        5: [810, 860],   // 13:30 - 14:20
        6: [860, 910],   // 14:20 - 15:10
        7: [910, 960],   // 15:10 - 16:00
        8: [960, 1010],  // 16:00 - 16:50
      };

      // ==================================================
      // GET TODAY'S FACULTY TIMETABLE
      // ==================================================

      const facultyIds =
        (faculty || []).map(
          (member) => member.id
        );

      let facultyTimetable = [];

      if (
        facultyIds.length > 0 &&
        !isSunday
      ) {
        const {
          data: timetableData,
          error: timetableError,
        } = await supabase
          .from("faculty_timetable")
          .select(`
            faculty_user_id,
            day_of_week,
            period_no,
            subject,
            class_name,
            section,
            room
          `)
          .in(
            "faculty_user_id",
            facultyIds
          )
          .eq(
            "day_of_week",
            currentDay
          );

        if (timetableError) {
          console.error(
            "Student faculty timetable lookup error:",
            timetableError
          );

          return res.status(500).json({
            error:
              "Unable to fetch faculty timetable",
          });
        }

        facultyTimetable =
          timetableData || [];
      }

      // ==================================================
      // CALCULATE LIVE FACULTY STATUS
      // ==================================================

      const facultyWithStatus =
        (faculty || []).map(
          (member) => {

            // ------------------------------------------------
            // COLLEGE CLOSED
            // ------------------------------------------------

            if (collegeClosed) {
              return {
                id: member.id,

                facultyId:
                  member.faculty_id,

                name:
                  member.name,

                departmentId:
                  member.department_id,

                role:
                  member.role ||
                  "FACULTY",

                status:
                  "Unavailable",

                message:
                  "College closed",

                expectedReturnTime:
                  "",

                updatedAt:
                  new Date().toISOString(),

                periodNo: null,
                subject: null,
                className: null,
                section: null,
                room: null,
              };
            }

            // ------------------------------------------------
            // FIND CURRENT CLASS
            // ------------------------------------------------

            const currentClass =
              facultyTimetable.find(
                (item) => {

                  if (
                    item.faculty_user_id !==
                    member.id
                  ) {
                    return false;
                  }

                  const period =
                    periodTimes[
                      Number(
                        item.period_no
                      )
                    ];

                  if (!period) {
                    return false;
                  }

                  return (
                    currentMinutes >=
                      period[0] &&
                    currentMinutes <
                      period[1]
                  );
                }
              );

            // ------------------------------------------------
            // CHECK WHETHER FACULTY HAS A TIMETABLE TODAY
            // ------------------------------------------------

            const hasTimetableToday =
              facultyTimetable.some(
                (item) =>
                  item.faculty_user_id ===
                  member.id
              );

            // ------------------------------------------------
            // FACULTY HAS CLASS NOW
            // ------------------------------------------------

            if (currentClass) {
              return {
                id: member.id,

                facultyId:
                  member.faculty_id,

                name:
                  member.name,

                departmentId:
                  member.department_id,

                role:
                  member.role ||
                  "FACULTY",

                status:
                  "In Class",

                message:
                  currentClass.subject ||
                  "Currently in class",

                expectedReturnTime:
                  "",

                updatedAt:
                  new Date().toISOString(),

                periodNo:
                  Number(
                    currentClass.period_no
                  ),

                subject:
                  currentClass.subject ||
                  "",

                className:
                  currentClass.class_name ||
                  "",

                section:
                  currentClass.section ||
                  "",

                room:
                  currentClass.room ||
                  "",
              };
            }

            // ------------------------------------------------
            // FACULTY HAS TIMETABLE BUT FREE NOW
            // ------------------------------------------------

            if (hasTimetableToday) {
              return {
                id: member.id,

                facultyId:
                  member.faculty_id,

                name:
                  member.name,

                departmentId:
                  member.department_id,

                role:
                  member.role ||
                  "FACULTY",

                status:
                  "Available",

                message:
                  "Currently available",

                expectedReturnTime:
                  "",

                updatedAt:
                  new Date().toISOString(),

                periodNo: null,
                subject: null,
                className: null,
                section: null,
                room: null,
              };
            }

            // ------------------------------------------------
            // NO TIMETABLE CONFIGURED FOR TODAY
            // ------------------------------------------------

            return {
              id: member.id,

              facultyId:
                member.faculty_id,

              name:
                member.name,

              departmentId:
                member.department_id,

              role:
                member.role ||
                "FACULTY",

              status:
                "Not Configured",

              message:
                "Timetable not configured",

              expectedReturnTime:
                "",

              updatedAt:
                new Date().toISOString(),

              periodNo: null,
              subject: null,
              className: null,
              section: null,
              room: null,
            };
          }
        );

      // ==================================================
      // FINAL RESPONSE
      // ==================================================

      return res.json({
        department: {
          id:
            department.id,

          code:
            department.department_code,

          name:
            department.department_name,
        },

        hod: hod
          ? {
              id:
                hod.id,

              hodId:
                hod.hod_id,

              name:
                hod.name,

              departmentId:
                hod.department_id,

              status:
                hodStatus.status,

              message:
                hodStatus.message,

              expectedReturnTime:
                hodStatus.expectedReturnTime,
            }
          : null,

        faculty:
          facultyWithStatus,
      });

    } catch (error) {
      console.error(
        "Student department availability error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// ==================================================
// STUDENT - GET HOD AVAILABILITY ONLY
// OPTIONAL PUBLIC API
// ==================================================

app.get(
  "/api/student/hod/:departmentId",
  async (req, res) => {
    try {
      const departmentId =
        Number(
          req.params.departmentId
        );

      if (
        !Number.isInteger(
          departmentId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid department ID",
        });
      }

      const {
        data: hod,
        error: hodError,
      } = await supabase
        .from("hod_users")
        .select(`
          id,
          hod_id,
          name,
          department_id
        `)
        .eq(
          "department_id",
          departmentId
        )
        .eq("active", true)
        .maybeSingle();

      if (hodError) {
        console.error(
          "Student HOD API error:",
          hodError
        );

        return res.status(500).json({
          error:
            "Unable to fetch HOD",
        });
      }

      if (!hod) {
        return res.status(404).json({
          error:
            "HOD not found",
        });
      }

      const {
        data: status,
        error: statusError,
      } = await supabase
        .from("hod_status")
        .select(`
          id,
          hod_user_id,
          status,
          message,
          expected_return_time,
          updated_at
        `)
        .eq(
          "hod_user_id",
          hod.id
        )
        .maybeSingle();

      if (statusError) {
        console.error(
          "Student HOD status error:",
          statusError
        );

        return res.status(500).json({
          error:
            "Unable to fetch HOD status",
        });
      }

      return res.json({
        id: hod.id,

        hodId:
          hod.hod_id,

        name:
          hod.name,

        departmentId:
          hod.department_id,

        status:
          status?.status ||
          "Unavailable",

        message:
          status?.message ||
          "",

        expectedReturnTime:
          status
            ?.expected_return_time ||
          "",
      });
    } catch (error) {
      console.error(
        "Student HOD API error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// STUDENT - GET FACULTY AVAILABILITY ONLY
// OPTIONAL PUBLIC API
// ==================================================

app.get(
  "/api/student/faculty/:departmentId",
  async (req, res) => {
    try {
      const departmentId =
        Number(
          req.params.departmentId
        );

      if (
        !Number.isInteger(
          departmentId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid department ID",
        });
      }

      const {
        data: faculty,
        error: facultyError,
      } = await supabase
        .from("faculty_users")
        .select(`
          id,
          faculty_id,
          name,
          department_id,
          role
        `)
        .eq(
          "department_id",
          departmentId
        )
        .eq("active", true)
        .order("name", {
          ascending: true,
        });

      if (facultyError) {
        console.error(
          "Student faculty API error:",
          facultyError
        );

        return res.status(500).json({
          error:
            "Unable to fetch faculty",
        });
      }

      const facultyIds =
        (faculty || []).map(
          (member) => member.id
        );

      let statuses = [];

      if (facultyIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from("faculty_status")
          .select("*")
          .in(
            "faculty_user_id",
            facultyIds
          );

        if (error) {
          console.error(
            "Student faculty status error:",
            error
          );

          return res.status(500).json({
            error:
              "Unable to fetch faculty status",
          });
        }

        statuses = data || [];
      }

      const result =
        (faculty || []).map(
          (member) => {
            const status =
              statuses.find(
                (item) =>
                  item.faculty_user_id ===
                  member.id
              );

            return {
              id: member.id,

              facultyId:
                member.faculty_id,

              name:
                member.name,

              departmentId:
                member.department_id,

              role:
                member.role ||
                "FACULTY",

              status:
                status?.status ||
                "Not Available",

              message:
                status?.message ||
                "",

              expectedReturnTime:
                status
                  ?.expected_return_time ||
                "",

              updatedAt:
                status
                  ?.updated_at ||
                null,
            };
          }
        );

      return res.json(result);
    } catch (error) {
      console.error(
        "Student faculty API error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// ==================================================
// FACULTY TIMETABLE
// ==================================================

// GET FACULTY TIMETABLE
app.get(
  "/api/faculty/timetable",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const { data, error } = await supabase
        .from("faculty_timetable")
        .select(`
          id,
          faculty_user_id,
          day_of_week,
          period_no,
          subject,
          class_name,
          section,
          room,
          created_at,
          updated_at
        `)
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .order("period_no", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Faculty timetable fetch error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch timetable",
        });
      }

      return res.json(data || []);

    } catch (error) {
      console.error(
        "Faculty timetable error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// ADD / UPDATE FACULTY TIMETABLE ENTRY
app.post(
  "/api/faculty/timetable",
  authenticateToken,
  async (req, res) => {
    try {

      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const {
        dayOfWeek,
        periodNo,
        subject,
        className,
        section,
        room,
      } = req.body;

      const allowedDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      if (
        !allowedDays.includes(dayOfWeek)
      ) {
        return res.status(400).json({
          error: "Invalid day",
        });
      }

      if (
        !Number.isInteger(
          Number(periodNo)
        ) ||
        Number(periodNo) < 1 ||
        Number(periodNo) > 8
      ) {
        return res.status(400).json({
          error: "Invalid period",
        });
      }

      if (
        !subject ||
        !subject.trim()
      ) {
        return res.status(400).json({
          error: "Subject is required",
        });
      }

      const timetableData = {
        faculty_user_id:
          req.user.userId,

        day_of_week:
          dayOfWeek,

        period_no:
          Number(periodNo),

        subject:
          subject.trim(),

        class_name:
          className?.trim() || "",

        section:
          section?.trim() || "",

        room:
          room?.trim() || "",

        updated_at:
          new Date().toISOString(),
      };

      const { data, error } =
        await supabase
          .from("faculty_timetable")
          .upsert(
            timetableData,
            {
              onConflict:
                "faculty_user_id,day_of_week,period_no",
            }
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "Faculty timetable save error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to save timetable",
        });
      }

      return res.json({
        message:
          "Timetable saved successfully",
        data,
      });

    } catch (error) {

      console.error(
        "Faculty timetable save error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// DELETE FACULTY TIMETABLE ENTRY
app.delete(
  "/api/faculty/timetable/:id",
  authenticateToken,
  async (req, res) => {

    try {

      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const timetableId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          timetableId
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid timetable ID",
        });
      }

      const { data, error } =
        await supabase
          .from("faculty_timetable")
          .delete()
          .eq(
            "id",
            timetableId
          )
          .eq(
            "faculty_user_id",
            req.user.userId
          )
          .select("*")
          .maybeSingle();

      if (error) {

        console.error(
          "Faculty timetable delete error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to delete timetable entry",
        });
      }

      if (!data) {
        return res.status(404).json({
          error:
            "Timetable entry not found",
        });
      }

      return res.json({
        message:
          "Timetable entry deleted successfully",
      });

    } catch (error) {

      console.error(
        "Faculty timetable delete error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// ==================================================
// FACULTY REPORTS
// ==================================================

// GET FACULTY TASK + DAILY ACTIVITY REPORT
app.get(
  "/api/faculty/reports",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const { from, to } = req.query;

      if (!from || !to) {
        return res.status(400).json({
          error: "From and to dates are required",
        });
      }

      // --------------------------------------------------
      // GET TASKS
      // --------------------------------------------------

      const { data: tasks, error: taskError } = await supabase
        .from("faculty_tasks")
        .select(`
          id,
          task_date,
          day_of_week,
          period_no,
          task_name,
          task_description,
          status_level,
          created_at,
          updated_at
        `)
        .eq("faculty_user_id", req.user.userId)
        .gte("task_date", from)
        .lte("task_date", to)
        .order("task_date", { ascending: true })
        .order("period_no", { ascending: true });

      if (taskError) {
        console.error("Faculty report task error:", taskError);

        return res.status(500).json({
          error: "Unable to fetch faculty tasks",
        });
      }

      const taskList = tasks || [];

      // --------------------------------------------------
      // SUMMARY
      // --------------------------------------------------

      const totalTasks = taskList.length;

      const l1Count = taskList.filter(
        (task) => task.status_level === "L1"
      ).length;

      const l2Count = taskList.filter(
        (task) => task.status_level === "L2"
      ).length;

      const l3Count = taskList.filter(
        (task) => task.status_level === "L3"
      ).length;

      const completionPercentage =
        totalTasks > 0
          ? Math.round((l3Count / totalTasks) * 100)
          : 0;

      // --------------------------------------------------
      // DAILY P1-P8 REPORT
      // Only generated when From Date = To Date
      // --------------------------------------------------

      let periods = [];

      if (from === to) {
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        const selectedDate = new Date(`${from}T00:00:00Z`);
        const dayOfWeek = dayNames[selectedDate.getUTCDay()];

        const { data: timetable, error: timetableError } =
          await supabase
            .from("faculty_timetable")
            .select(`
              period_no,
              subject,
              class_name,
              section,
              room
            `)
            .eq("faculty_user_id", req.user.userId)
            .eq("day_of_week", dayOfWeek)
            .order("period_no", { ascending: true });

        if (timetableError) {
          console.error(
            "Faculty report timetable error:",
            timetableError
          );

          return res.status(500).json({
            error: "Unable to fetch faculty timetable",
          });
        }

        const periodTimes = {
          1: "09:15 AM - 10:05 AM",
          2: "10:05 AM - 10:55 AM",
          3: "10:55 AM - 11:45 AM",
          4: "11:45 AM - 12:35 PM",
          5: "01:30 PM - 02:20 PM",
          6: "02:20 PM - 03:10 PM",
          7: "03:10 PM - 04:00 PM",
          8: "04:00 PM - 04:50 PM",
        };

        periods = Object.keys(periodTimes).map((period) => {
          const periodNo = Number(period);

          const classData =
            (timetable || []).find(
              (item) =>
                Number(item.period_no) === periodNo
            ) || null;

          const taskData =
            taskList.find(
              (task) =>
                task.task_date === from &&
                Number(task.period_no) === periodNo
            ) || null;

          if (classData) {
            return {
              periodNo,
              time: periodTimes[periodNo],
              activityType: "Class",
              status: "Class",
              subject: classData.subject || "",
              className: classData.class_name || "",
              section: classData.section || "",
              room: classData.room || "",
              taskName: "",
              taskDescription: "",
              statusLevel: null,
            };
          }

          if (taskData) {
            return {
              periodNo,
              time: periodTimes[periodNo],
              activityType: "Task",
              status: taskData.status_level,
              subject: "",
              className: "",
              section: "",
              room: "",
              taskName: taskData.task_name,
              taskDescription:
                taskData.task_description || "",
              statusLevel: taskData.status_level,
            };
          }

          return {
            periodNo,
            time: periodTimes[periodNo],
            activityType: "Free",
            status: "Free",
            subject: "",
            className: "",
            section: "",
            room: "",
            taskName: "",
            taskDescription: "",
            statusLevel: null,
          };
        });
      }

      return res.json({
        from,
        to,
        summary: {
          totalTasks,
          l1Count,
          l2Count,
          l3Count,
          completionPercentage,
        },
        periods,
        tasks: taskList,
      });

    } catch (error) {
      console.error("Faculty report error:", error);

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// ==================================================
// FACULTY REPORTS
// ==================================================

// GET FACULTY TASK + DAILY ACTIVITY REPORT
app.get(
  "/api/faculty/reports",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const { from, to } = req.query;

      if (!from || !to) {
        return res.status(400).json({
          error: "From and to dates are required",
        });
      }

      // --------------------------------------------------
      // GET FACULTY LEAVES IN REPORT RANGE
      // --------------------------------------------------

      const {
        data: leaveData,
        error: leaveError,
      } = await supabase
        .from("faculty_leaves")
        .select(`
          leave_date,
          reason
        `)
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .gte("leave_date", from)
        .lte("leave_date", to);

      if (leaveError) {
        console.error(
          "Faculty report leave error:",
          leaveError
        );

        return res.status(500).json({
          error: "Unable to fetch faculty leave data",
        });
      }

      const leaveMap = {};

      (leaveData || []).forEach((leave) => {
        leaveMap[leave.leave_date] = {
          status: "Leave",
          reason: leave.reason || "",
        };
      });

      // --------------------------------------------------
      // GET COLLEGE HOLIDAYS IN REPORT RANGE
      // --------------------------------------------------

      const {
        data: holidayData,
        error: holidayError,
      } = await supabase
        .from("college_holidays")
        .select(`
          holiday_date,
          holiday_name,
          description
        `)
        .gte("holiday_date", from)
        .lte("holiday_date", to);

      if (holidayError) {
        console.error(
          "Faculty report holiday error:",
          holidayError
        );

        return res.status(500).json({
          error: "Unable to fetch holiday data",
        });
      }

      const holidayMap = {};

      (holidayData || []).forEach((holiday) => {
        holidayMap[holiday.holiday_date] = {
          status: "Holiday",
          name: holiday.holiday_name || "",
          description: holiday.description || "",
        };
      });

      // --------------------------------------------------
      // GET TASKS
      // --------------------------------------------------

      const {
        data: tasks,
        error: taskError,
      } = await supabase
        .from("faculty_tasks")
        .select(`
          id,
          task_date,
          day_of_week,
          period_no,
          task_name,
          task_description,
          status_level,
          created_at,
          updated_at
        `)
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .gte("task_date", from)
        .lte("task_date", to)
        .order("task_date", {
          ascending: true,
        })
        .order("period_no", {
          ascending: true,
        });

      if (taskError) {
        console.error(
          "Faculty report task error:",
          taskError
        );

        return res.status(500).json({
          error: "Unable to fetch faculty tasks",
        });
      }

      // --------------------------------------------------
      // REMOVE TASKS FROM LEAVE / HOLIDAY DATES
      // --------------------------------------------------

      const taskList = (tasks || []).filter(
        (task) =>
          !leaveMap[task.task_date] &&
          !holidayMap[task.task_date]
      );

      // --------------------------------------------------
      // SUMMARY
      // --------------------------------------------------

      const totalTasks =
        taskList.length;

      const l1Count =
        taskList.filter(
          (task) =>
            task.status_level === "L1"
        ).length;

      const l2Count =
        taskList.filter(
          (task) =>
            task.status_level === "L2"
        ).length;

      const l3Count =
        taskList.filter(
          (task) =>
            task.status_level === "L3"
        ).length;

      const completionPercentage =
        totalTasks > 0
          ? Math.round(
              (l3Count / totalTasks) * 100
            )
          : 0;

      // --------------------------------------------------
      // DAILY P1-P8 REPORT
      // Only generated when From Date = To Date
      // --------------------------------------------------

      let periods = [];

      let dayStatus = "Working Day";
      let leaveReason = "";
      let holidayName = "";
      let holidayDescription = "";

      if (from === to) {
        // ------------------------------------------------
        // CHECK HOLIDAY FIRST
        // Holiday has highest priority
        // ------------------------------------------------

        if (holidayMap[from]) {
          dayStatus = "Holiday";

          holidayName =
            holidayMap[from].name;

          holidayDescription =
            holidayMap[from].description || "";

          periods = Array.from(
            { length: 8 },
            (_, index) => ({
              periodNo: index + 1,
              time: [
                "09:15 AM - 10:05 AM",
                "10:05 AM - 10:55 AM",
                "10:55 AM - 11:45 AM",
                "11:45 AM - 12:35 PM",
                "01:30 PM - 02:20 PM",
                "02:20 PM - 03:10 PM",
                "03:10 PM - 04:00 PM",
                "04:00 PM - 04:50 PM",
              ][index],
              activityType: "Holiday",
              status: "Holiday",
              subject: "",
              className: "",
              section: "",
              room: "",
              taskName: "",
              taskDescription: "",
              statusLevel: null,
            })
          );
        }

        // ------------------------------------------------
        // CHECK FACULTY LEAVE
        // ------------------------------------------------

        else if (leaveMap[from]) {
          dayStatus = "Leave";

          leaveReason =
            leaveMap[from].reason || "";

          periods = Array.from(
            { length: 8 },
            (_, index) => ({
              periodNo: index + 1,
              time: [
                "09:15 AM - 10:05 AM",
                "10:05 AM - 10:55 AM",
                "10:55 AM - 11:45 AM",
                "11:45 AM - 12:35 PM",
                "01:30 PM - 02:20 PM",
                "02:20 PM - 03:10 PM",
                "03:10 PM - 04:00 PM",
                "04:00 PM - 04:50 PM",
              ][index],
              activityType: "Leave",
              status: "Leave",
              subject: "",
              className: "",
              section: "",
              room: "",
              taskName: "",
              taskDescription: "",
              statusLevel: null,
            })
          );
        }

        // ------------------------------------------------
        // NORMAL WORKING DAY
        // ------------------------------------------------

        else {
          const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ];

          const selectedDate =
            new Date(
              `${from}T00:00:00Z`
            );

          const dayOfWeek =
            dayNames[
              selectedDate.getUTCDay()
            ];

          const {
            data: timetable,
            error: timetableError,
          } = await supabase
            .from("faculty_timetable")
            .select(`
              period_no,
              subject,
              class_name,
              section,
              room
            `)
            .eq(
              "faculty_user_id",
              req.user.userId
            )
            .eq(
              "day_of_week",
              dayOfWeek
            )
            .order("period_no", {
              ascending: true,
            });

          if (timetableError) {
            console.error(
              "Faculty report timetable error:",
              timetableError
            );

            return res.status(500).json({
              error:
                "Unable to fetch faculty timetable",
            });
          }

          const periodTimes = {
            1: "09:15 AM - 10:05 AM",
            2: "10:05 AM - 10:55 AM",
            3: "10:55 AM - 11:45 AM",
            4: "11:45 AM - 12:35 PM",
            5: "01:30 PM - 02:20 PM",
            6: "02:20 PM - 03:10 PM",
            7: "03:10 PM - 04:00 PM",
            8: "04:00 PM - 04:50 PM",
          };

          periods =
            Object.keys(periodTimes).map(
              (period) => {
                const periodNo =
                  Number(period);

                const classData =
                  (timetable || []).find(
                    (item) =>
                      Number(
                        item.period_no
                      ) === periodNo
                  ) || null;

                const taskData =
                  taskList.find(
                    (task) =>
                      task.task_date ===
                        from &&
                      Number(
                        task.period_no
                      ) === periodNo
                  ) || null;

                if (classData) {
                  return {
                    periodNo,
                    time:
                      periodTimes[
                        periodNo
                      ],
                    activityType:
                      "Class",
                    status: "Class",
                    subject:
                      classData.subject ||
                      "",
                    className:
                      classData.class_name ||
                      "",
                    section:
                      classData.section ||
                      "",
                    room:
                      classData.room ||
                      "",
                    taskName: "",
                    taskDescription: "",
                    statusLevel: null,
                  };
                }

                if (taskData) {
                  return {
                    periodNo,
                    time:
                      periodTimes[
                        periodNo
                      ],
                    activityType:
                      "Task",
                    status:
                      taskData.status_level,
                    subject: "",
                    className: "",
                    section: "",
                    room: "",
                    taskName:
                      taskData.task_name,
                    taskDescription:
                      taskData.task_description ||
                      "",
                    statusLevel:
                      taskData.status_level,
                  };
                }

                return {
                  periodNo,
                  time:
                    periodTimes[
                      periodNo
                    ],
                  activityType: "Free",
                  status: "Free",
                  subject: "",
                  className: "",
                  section: "",
                  room: "",
                  taskName: "",
                  taskDescription: "",
                  statusLevel: null,
                };
              }
            );
        }
      }

      // --------------------------------------------------
      // FINAL RESPONSE
      // --------------------------------------------------

      return res.json({
        from,
        to,

        dayStatus,

        leaveReason,

        holidayName,

        holidayDescription,

        summary: {
          totalTasks,
          l1Count,
          l2Count,
          l3Count,
          completionPercentage,
        },

        periods,

        tasks: taskList,
      });
    } catch (error) {
      console.error(
        "Faculty report error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// ==================================================
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
        .select(`
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
        `)
        .eq("faculty_user_id", req.user.userId)
        .order("task_date", { ascending: true })
        .order("period_no", { ascending: true });

      if (error) {
        console.error("Faculty tasks fetch error:", error);

        return res.status(500).json({
          error: "Unable to fetch faculty tasks",
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error("Faculty tasks GET error:", error);

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

      if (
        !taskDate ||
        !dayOfWeek ||
        !periodNo ||
        !taskName
      ) {
        return res.status(400).json({
          error:
            "Task date, day, period and task name are required",
        });
      }

      if (
        !["L1", "L2", "L3"].includes(
          statusLevel || "L1"
        )
      ) {
        return res.status(400).json({
          error: "Invalid completion level",
        });
      }

      // Check whether the faculty member already has a class
      // in this period.
      const {
        data: existingClass,
        error: classError,
      } = await supabase
        .from("faculty_timetable")
        .select("id")
        .eq("faculty_user_id", req.user.userId)
        .eq("day_of_week", dayOfWeek)
        .eq("period_no", Number(periodNo))
        .maybeSingle();

      if (classError) {
        console.error(
          "Faculty timetable check error:",
          classError
        );

        return res.status(500).json({
          error: "Unable to validate free period",
        });
      }

      if (existingClass) {
        return res.status(400).json({
          error:
            "This period already contains a class in your timetable",
        });
      }

      // Check whether another task already exists
      // for the same date and period.
      const {
        data: existingTask,
        error: taskCheckError,
      } = await supabase
        .from("faculty_tasks")
        .select("id")
        .eq("faculty_user_id", req.user.userId)
        .eq("task_date", taskDate)
        .eq("period_no", Number(periodNo))
        .maybeSingle();

      if (taskCheckError) {
        console.error(
          "Faculty task check error:",
          taskCheckError
        );

        return res.status(500).json({
          error: "Unable to validate task period",
        });
      }

      if (existingTask) {
        return res.status(400).json({
          error:
            "A task is already recorded for this date and period",
        });
      }

      const { data, error } = await supabase
        .from("faculty_tasks")
        .insert({
          faculty_user_id: req.user.userId,
          task_date: taskDate,
          day_of_week: dayOfWeek,
          period_no: Number(periodNo),
          task_name: taskName,
          task_description:
            taskDescription || "",
          status_level:
            statusLevel || "L1",
        })
        .select(`
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
        `)
        .single();

      if (error) {
        console.error(
          "Faculty task insert error:",
          error
        );

        return res.status(500).json({
          error: "Unable to add faculty task",
        });
      }

      return res.status(201).json({
        message: "Task added successfully",
        task: data,
      });
    } catch (error) {
      console.error(
        "Faculty task POST error:",
        error
      );

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

      if (
        !taskDate ||
        !dayOfWeek ||
        !periodNo ||
        !taskName
      ) {
        return res.status(400).json({
          error:
            "Task date, day, period and task name are required",
        });
      }

      if (
        !["L1", "L2", "L3"].includes(
          statusLevel || "L1"
        )
      ) {
        return res.status(400).json({
          error: "Invalid completion level",
        });
      }

      const {
        data: currentTask,
        error: currentTaskError,
      } = await supabase
        .from("faculty_tasks")
        .select("id")
        .eq("id", taskId)
        .eq("faculty_user_id", req.user.userId)
        .maybeSingle();

      if (currentTaskError) {
        console.error(
          "Current faculty task lookup error:",
          currentTaskError
        );

        return res.status(500).json({
          error: "Unable to find task",
        });
      }

      if (!currentTask) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      // Check timetable conflict.
      const {
        data: existingClass,
        error: classError,
      } = await supabase
        .from("faculty_timetable")
        .select("id")
        .eq("faculty_user_id", req.user.userId)
        .eq("day_of_week", dayOfWeek)
        .eq("period_no", Number(periodNo))
        .maybeSingle();

      if (classError) {
        console.error(
          "Faculty timetable update check error:",
          classError
        );

        return res.status(500).json({
          error: "Unable to validate free period",
        });
      }

      if (existingClass) {
        return res.status(400).json({
          error:
            "This period already contains a class in your timetable",
        });
      }

      // Check another task in same date/period.
      const {
        data: duplicateTask,
        error: duplicateError,
      } = await supabase
        .from("faculty_tasks")
        .select("id")
        .eq("faculty_user_id", req.user.userId)
        .eq("task_date", taskDate)
        .eq("period_no", Number(periodNo))
        .neq("id", taskId)
        .maybeSingle();

      if (duplicateError) {
        console.error(
          "Duplicate faculty task check error:",
          duplicateError
        );

        return res.status(500).json({
          error: "Unable to validate task period",
        });
      }

      if (duplicateTask) {
        return res.status(400).json({
          error:
            "Another task already exists for this date and period",
        });
      }

      const { data, error } = await supabase
        .from("faculty_tasks")
        .update({
          task_date: taskDate,
          day_of_week: dayOfWeek,
          period_no: Number(periodNo),
          task_name: taskName,
          task_description:
            taskDescription || "",
          status_level:
            statusLevel || "L1",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("faculty_user_id", req.user.userId)
        .select(`
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
        `)
        .single();

      if (error) {
        console.error(
          "Faculty task update error:",
          error
        );

        return res.status(500).json({
          error: "Unable to update faculty task",
        });
      }

      return res.json({
        message: "Task updated successfully",
        task: data,
      });
    } catch (error) {
      console.error(
        "Faculty task PUT error:",
        error
      );

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
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "Faculty task delete error:",
          error
        );

        return res.status(500).json({
          error: "Unable to delete faculty task",
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
      console.error(
        "Faculty task DELETE error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ==================================================
// ADMIN FACULTY REPORTS
// ==================================================

app.get(
  "/api/admin/faculty-reports",
  authenticateToken,
  async (req, res) => {
    try {
      // Admin access only
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { facultyId, from, to } = req.query;

      if (!facultyId || !from || !to) {
        return res.status(400).json({
          error: "Faculty, from date and to date are required",
        });
      }

      const facultyUserId = Number(facultyId);

      if (!Number.isInteger(facultyUserId)) {
        return res.status(400).json({
          error: "Invalid faculty ID",
        });
      }

      // --------------------------------------------------
      // Get faculty information
      // --------------------------------------------------

      const {
        data: faculty,
        error: facultyError,
      } = await supabase
        .from("faculty_users")
        .select(`
          id,
          faculty_id,
          name,
          department_id,
          departments (
            department_code,
            department_name
          )
        `)
        .eq("id", facultyUserId)
        .maybeSingle();

      if (facultyError) {
        console.error(
          "Admin faculty lookup error:",
          facultyError
        );

        return res.status(500).json({
          error: "Unable to fetch faculty details",
        });
      }

      if (!faculty) {
        return res.status(404).json({
          error: "Faculty not found",
        });
      }

      // --------------------------------------------------
      // Get faculty tasks
      // --------------------------------------------------

      const {
        data: tasks,
        error: taskError,
      } = await supabase
        .from("faculty_tasks")
        .select(`
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
        `)
        .eq("faculty_user_id", facultyUserId)
        .gte("task_date", from)
        .lte("task_date", to)
        .order("task_date", {
          ascending: true,
        })
        .order("period_no", {
          ascending: true,
        });

      if (taskError) {
        console.error(
          "Admin faculty task report error:",
          taskError
        );

        return res.status(500).json({
          error: "Unable to fetch faculty tasks",
        });
      }

      const taskList = tasks || [];

      // --------------------------------------------------
      // Get faculty timetable
      // --------------------------------------------------

      const {
        data: timetable,
        error: timetableError,
      } = await supabase
        .from("faculty_timetable")
        .select(`
          day_of_week,
          period_no,
          subject,
          class_name,
          section,
          room
        `)
        .eq("faculty_user_id", facultyUserId)
        .order("period_no", {
          ascending: true,
        });

      if (timetableError) {
        console.error(
          "Admin faculty timetable report error:",
          timetableError
        );

        return res.status(500).json({
          error: "Unable to fetch faculty timetable",
        });
      }

      // --------------------------------------------------
      // Period timings
      // --------------------------------------------------

      const periodTimes = {
        1: "09:15 AM - 10:05 AM",
        2: "10:05 AM - 10:55 AM",
        3: "10:55 AM - 11:45 AM",
        4: "11:45 AM - 12:35 PM",
        5: "01:30 PM - 02:20 PM",
        6: "02:20 PM - 03:10 PM",
        7: "03:10 PM - 04:00 PM",
        8: "04:00 PM - 04:50 PM",
      };

      // --------------------------------------------------
      // Summary
      // --------------------------------------------------

      const totalTasks = taskList.length;

      const l1Count = taskList.filter(
        (task) => task.status_level === "L1"
      ).length;

      const l2Count = taskList.filter(
        (task) => task.status_level === "L2"
      ).length;

      const l3Count = taskList.filter(
        (task) => task.status_level === "L3"
      ).length;

      const completionPercentage =
        totalTasks > 0
          ? Math.round((l3Count / totalTasks) * 100)
          : 0;

      // --------------------------------------------------
      // Create daily period reports
      // --------------------------------------------------

      const startDate = new Date(`${from}T00:00:00`);
      const endDate = new Date(`${to}T00:00:00`);

      const dailyReports = [];

      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      for (
        let current = new Date(startDate);
        current <= endDate;
        current.setDate(current.getDate() + 1)
      ) {
        const year = current.getFullYear();
        const month = String(
          current.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
          current.getDate()
        ).padStart(2, "0");

        const dateString =
          `${year}-${month}-${day}`;

        const dayOfWeek =
          dayNames[current.getDay()];

        const periods = Object.keys(periodTimes).map(
          (period) => {
            const periodNo = Number(period);

            const classData =
              (timetable || []).find(
                (item) =>
                  item.day_of_week === dayOfWeek &&
                  Number(item.period_no) === periodNo
              ) || null;

            const taskData =
              taskList.find(
                (task) =>
                  task.task_date === dateString &&
                  Number(task.period_no) === periodNo
              ) || null;

            if (classData) {
              return {
                periodNo,
                time: periodTimes[periodNo],
                activityType: "Class",
                status: "Class",
                subject: classData.subject || "",
                className:
                  classData.class_name || "",
                section:
                  classData.section || "",
                room: classData.room || "",
                taskName: "",
                taskDescription: "",
                statusLevel: null,
              };
            }

            if (taskData) {
              return {
                periodNo,
                time: periodTimes[periodNo],
                activityType: "Task",
                status: taskData.status_level,
                subject: "",
                className: "",
                section: "",
                room: "",
                taskName: taskData.task_name,
                taskDescription:
                  taskData.task_description || "",
                statusLevel:
                  taskData.status_level,
              };
            }

            return {
              periodNo,
              time: periodTimes[periodNo],
              activityType: "Free",
              status: "Free",
              subject: "",
              className: "",
              section: "",
              room: "",
              taskName: "",
              taskDescription: "",
              statusLevel: null,
            };
          }
        );

        dailyReports.push({
          date: dateString,
          dayOfWeek,
          periods,
        });
      }

      // --------------------------------------------------
      // Response
      // --------------------------------------------------

      return res.json({
        faculty: {
          id: faculty.id,
          facultyId: faculty.faculty_id,
          name: faculty.name,
          department:
            faculty.departments
              ? `${faculty.departments.department_code} - ${faculty.departments.department_name}`
              : "Not Assigned",
        },

        from,
        to,

        summary: {
          totalTasks,
          l1Count,
          l2Count,
          l3Count,
          completionPercentage,
        },

        dailyReports,

        tasks: taskList,
      });

    } catch (error) {
      console.error(
        "Admin faculty report error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);
// =====================================================
// FACULTY LEAVE + COLLEGE HOLIDAY APIs
// =====================================================


// -----------------------------------------------------
// GET MY LEAVE FOR A DATE
// -----------------------------------------------------

app.get(
  "/api/faculty/leave",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const leaveDate =
        req.query.date;

      if (!leaveDate) {
        return res.status(400).json({
          error: "Date is required",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("faculty_leaves")
        .select(`
          id,
          faculty_user_id,
          leave_date,
          reason,
          created_at,
          updated_at
        `)
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .eq(
          "leave_date",
          leaveDate
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Faculty leave lookup error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch leave",
        });
      }

      return res.json({
        leave: data || null,
      });

    } catch (error) {
      console.error(
        "Faculty leave GET error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// -----------------------------------------------------
// MARK FACULTY LEAVE
// -----------------------------------------------------

app.post(
  "/api/faculty/leave",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const {
        leaveDate,
        reason,
      } = req.body;

      if (!leaveDate) {
        return res.status(400).json({
          error: "Leave date is required",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("faculty_leaves")
        .upsert(
          {
            faculty_user_id:
              req.user.userId,

            leave_date:
              leaveDate,

            reason:
              reason || "",

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "faculty_user_id,leave_date",
          }
        )
        .select(`
          id,
          faculty_user_id,
          leave_date,
          reason,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        console.error(
          "Faculty leave save error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to mark leave",
        });
      }

      return res.json({
        message:
          "Leave marked successfully",
        leave: data,
      });

    } catch (error) {
      console.error(
        "Faculty leave POST error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// -----------------------------------------------------
// CANCEL FACULTY LEAVE
// -----------------------------------------------------

app.delete(
  "/api/faculty/leave/:date",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error: "Faculty access required",
        });
      }

      const leaveDate =
        req.params.date;

      const {
        error,
      } = await supabase
        .from("faculty_leaves")
        .delete()
        .eq(
          "faculty_user_id",
          req.user.userId
        )
        .eq(
          "leave_date",
          leaveDate
        );

      if (error) {
        console.error(
          "Faculty leave delete error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to cancel leave",
        });
      }

      return res.json({
        message:
          "Leave cancelled successfully",
      });

    } catch (error) {
      console.error(
        "Faculty leave DELETE error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// -----------------------------------------------------
// GET COLLEGE HOLIDAY FOR A DATE
// PUBLIC API
// -----------------------------------------------------

app.get(
  "/api/holidays",
  async (req, res) => {
    try {
      const holidayDate =
        req.query.date;

      if (!holidayDate) {
        return res.status(400).json({
          error: "Date is required",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("college_holidays")
        .select(`
          id,
          holiday_date,
          holiday_name,
          description,
          created_at,
          updated_at
        `)
        .eq(
          "holiday_date",
          holidayDate
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Holiday lookup error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to fetch holiday",
        });
      }

      return res.json({
        holiday: data || null,
      });

    } catch (error) {
      console.error(
        "Holiday GET error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// -----------------------------------------------------
// MARK COLLEGE HOLIDAY
// FACULTY AUTHENTICATED
// -----------------------------------------------------

app.post(
  "/api/holidays",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error:
            "Faculty access required",
        });
      }

      const {
        holidayDate,
        holidayName,
        description,
      } = req.body;

      if (
        !holidayDate ||
        !holidayName
      ) {
        return res.status(400).json({
          error:
            "Holiday date and name are required",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("college_holidays")
        .upsert(
          {
            holiday_date:
              holidayDate,

            holiday_name:
              holidayName,

            description:
              description || "",

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "holiday_date",
          }
        )
        .select(`
          id,
          holiday_date,
          holiday_name,
          description,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        console.error(
          "Holiday save error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to mark holiday",
        });
      }

      return res.json({
        message:
          "Holiday marked successfully",
        holiday: data,
      });

    } catch (error) {
      console.error(
        "Holiday POST error:",
        error
      );

      return res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// -----------------------------------------------------
// CANCEL COLLEGE HOLIDAY
// -----------------------------------------------------

app.delete(
  "/api/holidays/:date",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          error:
            "Faculty access required",
        });
      }

      const holidayDate =
        req.params.date;

      const {
        error,
      } = await supabase
        .from("college_holidays")
        .delete()
        .eq(
          "holiday_date",
          holidayDate
        );

      if (error) {
        console.error(
          "Holiday delete error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to cancel holiday",
        });
      }

      return res.json({
        message:
          "Holiday cancelled successfully",
      });

    } catch (error) {
      console.error(
        "Holiday DELETE error:",
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