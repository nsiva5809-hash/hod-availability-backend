const fs = require("fs");

const file = "server.js";
let c = fs.readFileSync(file, "utf8");

const startMarker = `      // GET FACULTY STATUS`;
const endMarker = `      // FINAL RESPONSE`;

const start = c.indexOf(startMarker);
const end = c.indexOf(endMarker, start);

if (start === -1) {
  throw new Error("GET FACULTY STATUS marker not found");
}

if (end === -1 || end <= start) {
  throw new Error("FINAL RESPONSE marker not found");
}

const replacement = `      // GET FACULTY CURRENT STATUS FROM TIMETABLE
      // ==================================================

      const facultyIds =
        (faculty || []).map(
          (member) => member.id
        );

      // Current India day and time
      const indiaNow =
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
        indiaNow.find(
          (part) => part.type === "weekday"
        )?.value || "";

      const currentHour = Number(
        indiaNow.find(
          (part) => part.type === "hour"
        )?.value || 0
      );

      const currentMinute = Number(
        indiaNow.find(
          (part) => part.type === "minute"
        )?.value || 0
      );

      const currentMinutes =
        currentHour * 60 +
        currentMinute;

      // College period timings
      const periodTimes = {
        1: [555, 605],
        2: [605, 655],
        3: [655, 705],
        4: [705, 755],
        5: [810, 860],
        6: [860, 910],
        7: [910, 960],
        8: [960, 1010],
      };

      let facultyTimetable = [];

      if (facultyIds.length > 0) {
        const {
          data: timetableData,
          error: timetableError,
        } = await supabase
          .from("faculty_timetable")
          .select(\`
            faculty_user_id,
            day_of_week,
            period_no,
            subject,
            class_name,
            section,
            room
          \`)
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

      // Calculate live status for every faculty member
      const facultyWithStatus =
        (faculty || []).map(
          (member) => {
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
                      Number(item.period_no)
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
                currentClass
                  ? "In Class"
                  : "Available",

              message:
                currentClass
                  ? currentClass.subject ||
                    "Currently in class"
                  : "",

              expectedReturnTime:
                "",

              updatedAt:
                new Date().toISOString(),

              periodNo:
                currentClass
                  ? Number(
                      currentClass.period_no
                    )
                  : null,

              subject:
                currentClass
                  ? currentClass.subject ||
                    ""
                  : null,

              className:
                currentClass
                  ? currentClass.class_name ||
                    ""
                  : null,

              section:
                currentClass
                  ? currentClass.section ||
                    ""
                  : null,

              room:
                currentClass
                  ? currentClass.room ||
                    ""
                  : null,
            };
          }
        );

`;

c =
  c.slice(0, start) +
  replacement +
  c.slice(end);

fs.writeFileSync(
  file,
  c,
  "utf8"
);

console.log(
  "Student faculty timetable status logic updated successfully."
);