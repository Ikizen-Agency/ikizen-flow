CREATE TABLE `email_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`text_body` text NOT NULL,
	`html_body` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`related_entity_type` text,
	`related_entity_id` integer,
	`created_by_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `email_outbox_workspace_created_idx` ON `email_outbox` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_outbox_status_idx` ON `email_outbox` (`status`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`recipient_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`href` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_idx` ON `notifications` (`workspace_id`,`recipient_id`,`read_at`,`created_at`);