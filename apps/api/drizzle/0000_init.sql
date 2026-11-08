CREATE TABLE `daily_goals` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`weekdays` integer DEFAULT 127 NOT NULL,
	`icon` text,
	`position` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`tag_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	PRIMARY KEY(`tag_id`, `entity_type`, `entity_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entity_tags_type_ck" CHECK("entity_tags"."entity_type" IN ('idea','project','finance','reminder','study'))
);
--> statement-breakpoint
CREATE TABLE `finance_activities` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'idea' NOT NULL,
	`kind` text DEFAULT 'business' NOT NULL,
	`expected_monthly_cents` integer,
	`actual_monthly_cents` integer,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`project_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "finance_status_ck" CHECK("finance_activities"."status" IN ('idea','development','active')),
	CONSTRAINT "finance_kind_ck" CHECK("finance_activities"."kind" IN ('job','freelance','business','content','investment','other'))
);
--> statement-breakpoint
CREATE INDEX `idx_finance_col` ON `finance_activities` (`status`,`position`);--> statement-breakpoint
CREATE TABLE `finance_entries` (
	`id` integer PRIMARY KEY NOT NULL,
	`activity_id` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`meta` text,
	`due_at` text,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `finance_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "finance_entries_type_ck" CHECK("finance_entries"."type" IN ('note','edit','status_change','alert'))
);
--> statement-breakpoint
CREATE INDEX `idx_fin_entries_act` ON `finance_entries` (`activity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `goal_checks` (
	`goal_id` integer NOT NULL,
	`date` text NOT NULL,
	`checked_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`goal_id`, `date`),
	FOREIGN KEY (`goal_id`) REFERENCES `daily_goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'organized' NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`promoted_project_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`promoted_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ideas_status_ck" CHECK("ideas"."status" IN ('organized','started','developing','done')),
	CONSTRAINT "ideas_priority_ck" CHECK("ideas"."priority" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE INDEX `idx_ideas_status_pos` ON `ideas` (`status`,`position`);--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`meal_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	PRIMARY KEY(`meal_id`, `date`),
	FOREIGN KEY (`meal_id`) REFERENCES `meal_plan`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "meal_logs_status_ck" CHECK("meal_logs"."status" IN ('done','partial','skipped'))
);
--> statement-breakpoint
CREATE TABLE `meal_plan` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`time` text,
	`description` text,
	`weekdays` integer DEFAULT 127 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'idea' NOT NULL,
	`dev_level` integer,
	`position` real DEFAULT 0 NOT NULL,
	`repo_url` text,
	`deploy_url` text,
	`started_at` text,
	`finished_at` text,
	`deployed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "projects_status_ck" CHECK("projects"."status" IN ('idea','started','development','done','deployed')),
	CONSTRAINT "projects_dev_level_ck" CHECK("projects"."dev_level" IN (1,2,3)),
	CONSTRAINT "projects_dev_level_required_ck" CHECK(("projects"."status" = 'development') = ("projects"."dev_level" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_projects_col` ON `projects` (`status`,`dev_level`,`position`);--> statement-breakpoint
CREATE TABLE `reminder_categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_categories_name_unique` ON `reminder_categories` (`name`);--> statement-breakpoint
CREATE TABLE `reminder_completions` (
	`reminder_id` integer NOT NULL,
	`occurrence_date` text NOT NULL,
	`completed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`reminder_id`, `occurrence_date`),
	FOREIGN KEY (`reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'reminder' NOT NULL,
	`category_id` integer,
	`start_at` text NOT NULL,
	`end_at` text,
	`all_day` integer DEFAULT false NOT NULL,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`recurrence_weekdays` integer,
	`recurrence_until` text,
	`notify_minutes_before` integer,
	`done` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `reminder_categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reminders_kind_ck" CHECK("reminders"."kind" IN ('reminder','appointment','notice')),
	CONSTRAINT "reminders_recurrence_ck" CHECK("reminders"."recurrence" IN ('none','daily','weekly','monthly'))
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_start` ON `reminders` (`start_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_subjects` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6FE3FF' NOT NULL,
	`level` text DEFAULT 'beginner' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`target_hours` real,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "study_level_ck" CHECK("study_subjects"."level" IN ('beginner','intermediate','advanced')),
	CONSTRAINT "study_progress_ck" CHECK("study_subjects"."progress" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6FE3FF' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`ref_id` integer,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "time_module_ck" CHECK("time_entries"."module" IN ('study','idea','project','finance','work','other')),
	CONSTRAINT "time_source_ck" CHECK("time_entries"."source" IN ('manual','focus'))
);
--> statement-breakpoint
CREATE INDEX `idx_time_module_date` ON `time_entries` (`module`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_time_ref` ON `time_entries` (`module`,`ref_id`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`duration_min` integer,
	`intensity` integer,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "workouts_intensity_ck" CHECK("workouts"."intensity" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX `idx_workouts_date` ON `workouts` (`date`);