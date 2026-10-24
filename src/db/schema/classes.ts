import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const classroom = pgTable(
  "classroom",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Restrict: a teacher who still owns classes can't be hard-deleted by accident.
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    joinCode: varchar("join_code", { length: 8 }).notNull().unique(),
    joinEnabled: boolean("join_enabled").default(true).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("classroom_teacher_id_idx").on(table.teacherId)],
);

export const enrollment = pgTable(
  "enrollment",
  {
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classroom.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.classroomId, table.studentId] }),
    index("enrollment_student_id_idx").on(table.studentId),
  ],
);

export const classroomRelations = relations(classroom, ({ one, many }) => ({
  teacher: one(user, { fields: [classroom.teacherId], references: [user.id] }),
  enrollments: many(enrollment),
}));

export const enrollmentRelations = relations(enrollment, ({ one }) => ({
  classroom: one(classroom, {
    fields: [enrollment.classroomId],
    references: [classroom.id],
  }),
  student: one(user, { fields: [enrollment.studentId], references: [user.id] }),
}));
