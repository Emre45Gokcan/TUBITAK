import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
// Relative imports: drizzle-kit loads schema files without the "@/" path alias.
import { DEFAULT_PERSONALITY, DEFAULT_ROBOT_MODEL, DEFAULT_ROBOT_VOICE, ROBOT_EMOTIONS } from "../../lib/robot-config";
import { user } from "./auth";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const robotEmotion = pgEnum("robot_emotion", ROBOT_EMOTIONS);
export const robotMessageRole = pgEnum("robot_message_role", ["user", "assistant"]);

export const robot = pgTable(
  "robot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Public identifier the device sends in `X-Robot-Id`, e.g. "robot_k3m9x2pq". */
    deviceId: varchar("device_id", { length: 32 }).notNull().unique(),
    name: varchar("name", { length: 80 }).notNull(),
    /** SHA-256 of the device token. The token itself is shown once and never stored. */
    tokenHash: text("token_hash").notNull(),
    /** First characters of the token, so admins can tell tokens apart. */
    tokenHint: varchar("token_hint", { length: 16 }).notNull(),
    tokenCreatedAt: timestamp("token_created_at", { withTimezone: true }).defaultNow().notNull(),
    model: text("model").default(DEFAULT_ROBOT_MODEL).notNull(),
    personality: text("personality").default(DEFAULT_PERSONALITY).notNull(),
    voice: text("voice").default(DEFAULT_ROBOT_VOICE).notNull(),
    memoryEnabled: boolean("memory_enabled").default(true).notNull(),
    enabledEmotions: robotEmotion("enabled_emotions")
      .array()
      .default(sql`'{happy,neutral,angry}'::robot_emotion[]`)
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
);

/** Conversation history (only written when the robot's memory is enabled). */
export const robotMessage = pgTable(
  "robot_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    robotId: uuid("robot_id")
      .notNull()
      .references(() => robot.id, { onDelete: "cascade" }),
    role: robotMessageRole("role").notNull(),
    content: text("content").notNull(),
    emotion: robotEmotion("emotion"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("robot_message_robot_created_idx").on(table.robotId, table.createdAt)],
);

/** Short-lived generated speech, downloaded by the robot via /api/robot/audio/[id]. */
export const robotAudio = pgTable(
  "robot_audio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    robotId: uuid("robot_id")
      .notNull()
      .references(() => robot.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    contentType: text("content_type").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("robot_audio_expires_idx").on(table.expiresAt)],
);

export const robotRelations = relations(robot, ({ many, one }) => ({
  messages: many(robotMessage),
  createdBy: one(user, { fields: [robot.createdById], references: [user.id] }),
}));

export const robotMessageRelations = relations(robotMessage, ({ one }) => ({
  robot: one(robot, { fields: [robotMessage.robotId], references: [robot.id] }),
}));
