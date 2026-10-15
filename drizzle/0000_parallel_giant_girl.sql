CREATE TABLE `activity_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`message` text NOT NULL,
	`category` text NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activity_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company` text NOT NULL,
	`tier` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`industry` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`billing_email` text,
	`payment_terms` text DEFAULT 'net_30' NOT NULL,
	`last_activity_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_status_idx` ON `customers` (`status`);--> statement-breakpoint
CREATE INDEX `customers_tier_idx` ON `customers` (`tier`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_company_unique` ON `customers` (`company`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'unit' NOT NULL,
	`unit_rate_cents` integer NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`customer_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payment_terms` text DEFAULT 'net_30' NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`invoice_number` text,
	`issue_date` integer NOT NULL,
	`due_date` integer NOT NULL,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_reference_unique` ON `orders` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_invoice_number_unique` ON `orders` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_issue_date_idx` ON `orders` (`issue_date`);--> statement-breakpoint
CREATE TABLE `task_subtasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_subtasks_task_idx` ON `task_subtasks` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`customer_id` integer,
	`assignee_id` integer,
	`due_at` integer,
	`estimate_hours` integer,
	`tracked_hours` integer DEFAULT 0 NOT NULL,
	`blocked_reason` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assignee_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_code_unique` ON `tasks` (`code`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `tasks_customer_idx` ON `tasks` (`customer_id`);