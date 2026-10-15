CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `workspace_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`member_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_workspace_user_unique` ON `workspace_memberships` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `workspace_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);--> statement-breakpoint
DROP INDEX `activity_created_idx`;--> statement-breakpoint
ALTER TABLE `activity_events` ADD `workspace_id` integer NOT NULL REFERENCES workspaces(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `activity_workspace_created_idx` ON `activity_events` (`workspace_id`,`created_at`);--> statement-breakpoint
DROP INDEX `customers_company_unique`;--> statement-breakpoint
ALTER TABLE `customers` ADD `workspace_id` integer NOT NULL REFERENCES workspaces(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `customers_workspace_idx` ON `customers` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_workspace_company_unique` ON `customers` (`workspace_id`,`company`);--> statement-breakpoint
DROP INDEX `members_email_unique`;--> statement-breakpoint
ALTER TABLE `members` ADD `workspace_id` integer NOT NULL REFERENCES workspaces(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `members` ADD `user_id` text REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
CREATE UNIQUE INDEX `members_workspace_email_unique` ON `members` (`workspace_id`,`email`);--> statement-breakpoint
CREATE INDEX `members_user_idx` ON `members` (`user_id`);--> statement-breakpoint
DROP INDEX `orders_reference_unique`;--> statement-breakpoint
DROP INDEX `orders_invoice_number_unique`;--> statement-breakpoint
ALTER TABLE `orders` ADD `workspace_id` integer NOT NULL REFERENCES workspaces(id) ON DELETE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_workspace_reference_unique` ON `orders` (`workspace_id`,`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_workspace_invoice_unique` ON `orders` (`workspace_id`,`invoice_number`);--> statement-breakpoint
DROP INDEX `tasks_code_unique`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `workspace_id` integer NOT NULL REFERENCES workspaces(id) ON DELETE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_workspace_code_unique` ON `tasks` (`workspace_id`,`code`);