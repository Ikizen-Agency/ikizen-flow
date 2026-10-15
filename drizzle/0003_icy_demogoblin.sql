ALTER TABLE `customers` ADD `archived_at` integer;--> statement-breakpoint
UPDATE `customers` SET `archived_at` = `updated_at`, `status` = 'inactive' WHERE `status` = 'archived';
