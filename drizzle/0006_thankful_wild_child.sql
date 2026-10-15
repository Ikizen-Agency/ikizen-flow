CREATE TABLE `task_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`uploaded_by_id` integer,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_attachments_task_idx` ON `task_attachments` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_attachments_storage_key_unique` ON `task_attachments` (`storage_key`);--> statement-breakpoint
CREATE TABLE `task_time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`member_id` integer,
	`minutes` integer NOT NULL,
	`note` text,
	`logged_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_time_entries_task_idx` ON `task_time_entries` (`task_id`,`logged_at`);--> statement-breakpoint
-- Data migration: keep previously tracked hours as one entry per task (assignee, last update time).
INSERT INTO `task_time_entries` (`task_id`, `member_id`, `minutes`, `note`, `logged_at`)
SELECT `id`, `assignee_id`, `tracked_hours` * 60, 'Tracked before time entries', `updated_at` FROM `tasks` WHERE `tracked_hours` > 0;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `tracked_hours`;