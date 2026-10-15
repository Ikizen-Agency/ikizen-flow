-- Completed orders created before payments were tracked (0004) get one payment equal to their total,
-- dated at paid_at (or the issue date). Idempotent: orders that already have any payment are skipped.
INSERT INTO `payments` (`workspace_id`, `order_id`, `amount_cents`, `method`, `paid_at`, `reference`, `note`, `recorded_by_id`, `created_at`)
SELECT o.`workspace_id`, o.`id`, o.`amount_cents`, 'other', COALESCE(o.`paid_at`, o.`issue_date`), o.`invoice_number`, 'Backfilled: completed before payments were tracked', NULL, unixepoch() * 1000
FROM `orders` o
WHERE o.`status` = 'completed'
  AND o.`amount_cents` > 0
  AND NOT EXISTS (SELECT 1 FROM `payments` p WHERE p.`order_id` = o.`id`);
