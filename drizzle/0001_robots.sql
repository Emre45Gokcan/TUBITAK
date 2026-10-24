CREATE TYPE "public"."robot_emotion" AS ENUM('happy', 'neutral', 'angry');--> statement-breakpoint
CREATE TYPE "public"."robot_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "robot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(32) NOT NULL,
	"name" varchar(80) NOT NULL,
	"token_hash" text NOT NULL,
	"token_hint" varchar(16) NOT NULL,
	"token_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text DEFAULT 'claude-opus-5-5' NOT NULL,
	"personality" text DEFAULT 'Sen arkadaş canlısı ve meraklı bir yardımcı robotsun. Doğal konuş, sohbet havasında kal ve gereksiz uzun cevaplar verme.' NOT NULL,
	"voice" text DEFAULT 'nova' NOT NULL,
	"memory_enabled" boolean DEFAULT true NOT NULL,
	"enabled_emotions" "robot_emotion"[] DEFAULT '{happy,neutral,angry}'::robot_emotion[] NOT NULL,
	"last_seen_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "robot_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "robot_audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"robot_id" uuid NOT NULL,
	"data" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robot_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"robot_id" uuid NOT NULL,
	"role" "robot_message_role" NOT NULL,
	"content" text NOT NULL,
	"emotion" "robot_emotion",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "robot" ADD CONSTRAINT "robot_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_audio" ADD CONSTRAINT "robot_audio_robot_id_robot_id_fk" FOREIGN KEY ("robot_id") REFERENCES "public"."robot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_message" ADD CONSTRAINT "robot_message_robot_id_robot_id_fk" FOREIGN KEY ("robot_id") REFERENCES "public"."robot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "robot_audio_expires_idx" ON "robot_audio" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "robot_message_robot_created_idx" ON "robot_message" USING btree ("robot_id","created_at");