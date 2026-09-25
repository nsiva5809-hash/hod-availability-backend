const fs = require("fs");

const file = "server.js";
let c = fs.readFileSync(file, "utf8");

const oldCode = `              status:
                currentClass
                  ? "In Class"
                  : "Available",`;

const newCode = `              status:
                facultyTimetable.some(
                  (item) =>
                    item.faculty_user_id ===
                    member.id
                )
                  ? (
                      currentClass
                        ? "In Class"
                        : "Available"
                    )
                  : "Not Configured",`;

if (!c.includes(oldCode)) {
  throw new Error(
    "Target faculty status code not found"
  );
}

c = c.replace(
  oldCode,
  newCode
);

fs.writeFileSync(
  file,
  c,
  "utf8"
);

console.log(
  "Not Configured faculty status logic updated successfully."
);