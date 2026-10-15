CREATE TABLE `task_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`author_id` integer,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`edited_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_comments_task_idx` ON `task_comments` (`task_id`,`created_at`);--> statement-breakpoint
-- Data migration: comments used to be activity events ("commented: <body>") plus a counter column.
INSERT INTO `task_comments` (`task_id`, `author_id`, `body`, `created_at`)
SELECT `entity_id`, `actor_id`, substr(`message`, 12), `created_at` FROM `activity_events`
WHERE `entity_type` = 'task' AND `message` LIKE 'commented: %' AND `entity_id` IN (SELECT `id` FROM `tasks`);--> statement-breakpoint
UPDATE `activity_events` SET `message` = 'commented on ' || coalesce((SELECT `title` FROM `tasks` WHERE `tasks`.`id` = `activity_events`.`entity_id`), 'a task')
WHERE `entity_type` = 'task' AND `message` LIKE 'commented: %';--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `comment_count`;