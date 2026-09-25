const express = require("express); const cors = require("cors); const
jwt = require("jsonwebtoken); const bcrypt = require("bcryptjs); const
{ createClient } = require("@supabase/supabase-js);
require("dotenv).config();

const app = express();

const PORT = process.env.PORT || 5000;

// ================================================== // MIDDLEWARE //
==================================================

app.use(cors()); app.use(express.json());

// ================================================== // SUPABASE //
==================================================

const supabase = createClient( process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY );

// ================================================== // JWT SECRET //
==================================================

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) { console.error( "ERROR: JWT_SECRET environment
variable is missing. );

process.exit(1); }

// ================================================== // TEST ROUTE //
==================================================

app.get("/, (req, res) => { res.json({ message: "HOD Availability
System Backend is running, }); });

// ================================================== // ADMIN LOGIN //
==================================================

app.post("/api/auth/admin-login, async (req, res) => { try { const {
adminId, password } = req.body;

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

} catch (error) { console.error("Admin login error:, error);

    return res.status(500).json({
      error: "Server error",
    });

} });

// ================================================== // HOD LOGIN //
==================================================

app.post("/api/auth/login, async (req, res) => { try { const { hodId,
password } = req.body;

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

} catch (error) { console.error("HOD login error:, error);

    return res.status(500).json({
      error: "Server error",
    });

} });

// ================================================== // FACULTY LOGIN
// ==================================================

app.post("/api/auth/faculty-login, async (req, res) => { try { const {
facultyId, password } = req.body;

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

} catch (error) { console.error( "Faculty login error:, error );

    return res.status(500).json({
      error: "Server error",
    });

} });

// ================================================== // AUTHENTICATION
MIDDLEWARE // ==================================================

function authenticateToken(req, res, next) { const authHeader =
req.headers.authorization;

if (!authHeader) { return res.status(401).json({ error: "Authentication
required, }); }

const parts = authHeader.split( ");

if ( parts.length !== 2 || parts[0] !== "Bearer ) { return
res.status(401).json({ error: "Invalid authorization format, }); }

const token = parts[1];

if (!token) { return res.status(401).json({ error: "Authentication token
missing, }); }

try { const user = jwt.verify( token, JWT_SECRET );

    req.user = user;

    next();

} catch (error) { console.error( "JWT verification error:, error );

    return res.status(401).json({
      error:
        "Invalid or expired token",
    });

} }

// ================================================== // GET HOD STATUS
// HOD TOKEN OR PUBLIC hodId QUERY //
==================================================

app.get( "/api/status, async (req, res) => { try { let hodUserId =
null;

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

} );

// ================================================== // UPDATE HOD
STATUS // HOD ONLY // ==================================================

app.post( "/api/status, authenticateToken, async (req, res) => { try {
if (req.user.role !== "hod) { return res.status(403).json({ error:
"Only HOD users can update HOD status, }); }

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

} );

// ================================================== // DEPARTMENT
MANAGEMENT // ADMIN ONLY //
==================================================

// """"""""""""""""" // GET ALL DEPARTMENTS // """""""""""""""""

app.get( "/api/admin/departments, authenticateToken, async (req, res)
=> { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} );

// """"""""""""""""" // CREATE DEPARTMENT // """""""""""""""""

app.post( "/api/admin/departments, authenticateToken, async (req, res)
=> { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} );

// """"""""""""""""" // UPDATE DEPARTMENT // """""""""""""""""

app.put( "/api/admin/departments/:id, authenticateToken, async (req,
res) => { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} ); // ================================================== // HOD
MANAGEMENT // ADMIN ONLY //
==================================================

// """"""""""""""""" // GET ALL HOD USERS // """""""""""""""""

app.get( "/api/admin/hods, authenticateToken, async (req, res) => { try
{ if (req.user.role !== "admin) { return res.status(403).json({ error:
"Admin access required, }); }

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

} );

// """"""""""""""""" // CREATE HOD // """""""""""""""""

app.post( "/api/admin/hods, authenticateToken, async (req, res) => {
try { if (req.user.role !== "admin) { return res.status(403).json({
error: "Admin access required, }); }

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

} );

// """"""""""""""""" // UPDATE HOD // """""""""""""""""

app.put( "/api/admin/hods/:id, authenticateToken, async (req, res) => {
try { if (req.user.role !== "admin) { return res.status(403).json({
error: "Admin access required, }); }

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

} );

// ================================================== // FACULTY
MANAGEMENT // ADMIN ONLY //
==================================================

// """"""""""""""""" // GET ALL FACULTY // """""""""""""""""

app.get( "/api/admin/faculty, authenticateToken, async (req, res) => {
try { if (req.user.role !== "admin) { return res.status(403).json({
error: "Admin access required, }); }

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

} );

// """"""""""""""""" // CREATE FACULTY // """""""""""""""""

app.post( "/api/admin/faculty, authenticateToken, async (req, res) => {
try { if (req.user.role !== "admin) { return res.status(403).json({
error: "Admin access required, }); }

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

} );

// """"""""""""""""" // UPDATE FACULTY // """""""""""""""""

app.put( "/api/admin/faculty/:id, authenticateToken, async (req, res)
=> { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} );

// ================================================== // ADMIN - DELETE
/ DEACTIVATE FACULTY //
==================================================

app.delete( "/api/admin/faculty/:id, authenticateToken, async (req,
res) => { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} ); // ===================================================== // GET
CURRENT FACULTY STATUS FROM TIMETABLE //
===================================================== app.get(
"/api/faculty/current-status, authenticateToken, async (req, res) => {
try { // Only faculty can access this API if (req.user.role !==
"faculty) { return res.status(403).json({ error: "Faculty access
required, }); }

      // Current time in India
      const now = new Date();

      const formatter = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(now);

      const values = {};

      parts.forEach((part) => {
        if (part.type !== "literal") {
          values[part.type] = part.value;
        }
      });

      const dayOfWeek = values.weekday;

      const currentHour = Number(values.hour);
      const currentMinute = Number(values.minute);

      const currentMinutes =
        currentHour * 60 + currentMinute;

      // Exact college period timings
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

      // Get today's classes for this faculty
      const { data, error } = await supabase
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
        .eq("faculty_user_id", req.user.userId)
        .eq("day_of_week", dayOfWeek)
        .order("period_no", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Faculty current status database error:",
          error
        );

        return res.status(500).json({
          error: "Unable to calculate faculty status",
        });
      }

      // Find whether the faculty is currently teaching
      let currentClass = null;

      for (const timetableEntry of data || []) {
        const period =
          periodTimes[timetableEntry.period_no];

        if (!period) {
          continue;
        }

        if (
          currentMinutes >= period.start &&
          currentMinutes < period.end
        ) {
          currentClass = timetableEntry;
          break;
        }
      }

      // Faculty is currently teaching
      if (currentClass) {
        return res.json({
          status: "In Class",
          dayOfWeek: dayOfWeek,
          periodNo: currentClass.period_no,
          subject: currentClass.subject,
          className: currentClass.class_name,
          section: currentClass.section,
          room: currentClass.room,
        });
      }

      // No class at the current time
      return res.json({
        status: "Available",
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

} ); // ================================================== // ADMIN -
DELETE / DEACTIVATE HOD //
==================================================

app.delete( "/api/admin/hods/:id, authenticateToken, async (req, res)
=> { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} );

// ================================================== // ADMIN - RESET
FACULTY PASSWORD // ==================================================

app.post( "/api/admin/faculty/:id/reset-password, authenticateToken,
async (req, res) => { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} );

// ================================================== // ADMIN - RESET
HOD PASSWORD // ==================================================

app.post( "/api/admin/hods/:id/reset-password, authenticateToken, async
(req, res) => { try { if (req.user.role !== "admin) { return
res.status(403).json({ error: "Admin access required, }); }

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

} );

// ================================================== // ADMIN DASHBOARD
SUMMARY // ==================================================

app.get( "/api/admin/dashboard, authenticateToken, async (req, res) =>
{ try { if (req.user.role !== "admin) { return res.status(403).json({
error: "Admin access required, }); }

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

} ); // ================================================== // FACULTY
AVAILABILITY // ==================================================

// GET CURRENT FACULTY STATUS app.get( "/api/faculty/status,
authenticateToken, async (req, res) => { try { if (req.user.role !==
"faculty) { return res.status(403).json({ error: "Faculty access
required, }); }

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

} );

// """"""""""""""""" // UPDATE FACULTY STATUS // """""""""""""""""

app.post( "/api/faculty/status, authenticateToken, async (req, res) =>
{ try { if (req.user.role !== "faculty) { return res.status(403).json({
error: "Faculty access required, }); }

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

} );

// ================================================== // STUDENT PORTAL
// PUBLIC APIs // NO LOGIN REQUIRED //
==================================================

// """"""""""""""""" // GET ACTIVE DEPARTMENTS // """""""""""""""""

app.get( "/api/student/departments, async (req, res) => { try { const {
data, error } = await supabase .from("departments)
.select(id,             department_code,             department_name)
.eq("active, true) .order( "department_name, { ascending: true, } );

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

} );

// """"""""""""""""" // GET DEPARTMENT AVAILABILITY // HOD + FACULTY //
"""""""""""""""""

app.get( "/api/student/department/:departmentId, async (req, res) => {
try { const departmentId = Number( req.params.departmentId );

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
          error:
            "Unable to fetch department",
        });
      }

      if (!department) {
        return res.status(404).json({
          error:
            "Department not found",
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
        .eq(
          "department_id",
          departmentId
        )
        .eq("active", true)
        .maybeSingle();

      if (hodError) {
        console.error(
          "Student HOD lookup error:",
          hodError
        );

        return res.status(500).json({
          error:
            "Unable to fetch HOD",
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
            hodStatusData
              .expected_return_time ||
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
          "Student faculty lookup error:",
          facultyError
        );

        return res.status(500).json({
          error:
            "Unable to fetch faculty",
        });
      }

      // ==================================================
      // GET FACULTY STATUS
      // ==================================================

      const facultyIds =
        (faculty || []).map(
          (member) => member.id
        );

      let facultyStatuses = [];

      if (facultyIds.length > 0) {
        const {
          data: statusData,
          error: statusError,
        } = await supabase
          .from("faculty_status")
          .select("*")
          .in(
            "faculty_user_id",
            facultyIds
          );

        if (statusError) {
          console.error(
            "Faculty status lookup error:",
            statusError
          );

          return res.status(500).json({
            error:
              "Unable to fetch faculty availability",
          });
        }

        facultyStatuses =
          statusData || [];
      }

      // ==================================================
      // COMBINE FACULTY + STATUS
      // ==================================================

      const facultyWithStatus =
        (faculty || []).map(
          (member) => {
            const status =
              facultyStatuses.find(
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
              id: hod.id,

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
                hodStatus
                  .expectedReturnTime,
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

} );

// ================================================== // STUDENT - GET
HOD AVAILABILITY ONLY // OPTIONAL PUBLIC API //
==================================================

app.get( "/api/student/hod/:departmentId, async (req, res) => { try {
const departmentId = Number( req.params.departmentId );

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

} );

// ================================================== // STUDENT - GET
FACULTY AVAILABILITY ONLY // OPTIONAL PUBLIC API //
==================================================

app.get( "/api/student/faculty/:departmentId, async (req, res) => { try
{ const departmentId = Number( req.params.departmentId );

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

} ); // ================================================== // FACULTY
TIMETABLE // ==================================================

// GET FACULTY TIMETABLE app.get( "/api/faculty/timetable,
authenticateToken, async (req, res) => { try { if (req.user.role !==
"faculty) { return res.status(403).json({ error: "Faculty access
required, }); }

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

} );

// ADD / UPDATE FACULTY TIMETABLE ENTRY app.post(
"/api/faculty/timetable, authenticateToken, async (req, res) => { try {

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

} );

// DELETE FACULTY TIMETABLE ENTRY app.delete(
"/api/faculty/timetable/:id, authenticateToken, async (req, res) => {

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

} );

// ================================================== // FACULTY
AUTOMATIC CURRENT STATUS // Timetable-based availability. Faculty cannot
// manually change this status. //
==================================================

app.get( "/api/faculty/current-status, authenticateToken, async (req,
res) => { try { if (req.user.role !== "faculty) { return
res.status(403).json({ error: "Faculty access required, }); }

      // Fixed academic period timings (Asia/Kolkata)
      const periodTimes = {
        1: ["09:15", "10:05"],
        2: ["10:05", "10:55"],
        3: ["10:55", "11:45"],
        4: ["11:45", "12:35"],
        5: ["13:30", "14:20"],
        6: ["14:20", "15:10"],
        7: ["15:10", "16:00"],
        8: ["16:00", "16:50"],
      };

      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const now = new Date();

      const indiaDateParts = new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          weekday: "long",
        }
      ).formatToParts(now);

      const getPart = (type) =>
        indiaDateParts.find(
          (part) => part.type === type
        )?.value || "";

      const currentDay = getPart("weekday");

      const indiaTime = new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      ).format(now);

      const currentMinutes =
        Number(indiaTime.slice(0, 2)) * 60 +
        Number(indiaTime.slice(3, 5));

      // Sunday or outside college hours
      if (
        currentDay === "Sunday" ||
        currentMinutes < 9 * 60 + 15 ||
        currentMinutes >= 16 * 60 + 50
      ) {
        return res.json({
          status: "Available",
          dayOfWeek: currentDay,
          currentTime: indiaTime,
          periodNo: null,
          subject: "",
          className: "",
          section: "",
          room: "",
          message: "Outside scheduled class hours",
        });
      }

      // Lunch break: 12:35 PM - 1:30 PM
      if (
        currentMinutes >= 12 * 60 + 35 &&
        currentMinutes < 13 * 60 + 30
      ) {
        return res.json({
          status: "Available",
          dayOfWeek: currentDay,
          currentTime: indiaTime,
          periodNo: null,
          subject: "",
          className: "",
          section: "",
          room: "",
          message: "Lunch Break",
        });
      }

      let currentPeriod = null;

      for (const [periodNo, times] of Object.entries(
        periodTimes
      )) {
        const [start, end] = times;

        const [startHour, startMinute] =
          start.split(":").map(Number);

        const [endHour, endMinute] =
          end.split(":").map(Number);

        const startMinutes =
          startHour * 60 + startMinute;

        const endMinutes =
          endHour * 60 + endMinute;

        if (
          currentMinutes >= startMinutes &&
          currentMinutes < endMinutes
        ) {
          currentPeriod = Number(periodNo);
          break;
        }
      }

      // Gap/outside defined periods
      if (!currentPeriod) {
        return res.json({
          status: "Available",
          dayOfWeek: currentDay,
          currentTime: indiaTime,
          periodNo: null,
          subject: "",
          className: "",
          section: "",
          room: "",
          message: "Free Period",
        });
      }

      const { data: timetableEntry, error } =
        await supabase
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
            currentDay
          )
          .eq(
            "period_no",
            currentPeriod
          )
          .maybeSingle();

      if (error) {
        console.error(
          "Faculty current timetable lookup error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to determine current faculty status",
        });
      }

      if (timetableEntry) {
        return res.json({
          status: "In Class",
          dayOfWeek: currentDay,
          currentTime: indiaTime,
          periodNo: currentPeriod,
          subject:
            timetableEntry.subject || "",
          className:
            timetableEntry.class_name || "",
          section:
            timetableEntry.section || "",
          room:
            timetableEntry.room || "",
          message: "Faculty is currently in class",
        });
      }

      return res.json({
        status: "Available",
        dayOfWeek: currentDay,
        currentTime: indiaTime,
        periodNo: currentPeriod,
        subject: "",
        className: "",
        section: "",
        room: "",
        message: "Free Period",
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

} );

// ================================================== // START SERVER //
==================================================

app.listen(PORT, () => { console.log(
HOD Availability System Backend running on port ${PORT} ); });

