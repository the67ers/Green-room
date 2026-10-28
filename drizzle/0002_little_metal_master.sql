CREATE TABLE `tournament_history` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`archived_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `display_username` text;