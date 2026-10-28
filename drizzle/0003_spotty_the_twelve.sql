CREATE TABLE `checkin_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`window_id` text NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checkin_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`generation` text NOT NULL,
	`config` text NOT NULL,
	`closes_at` integer NOT NULL,
	`status` text NOT NULL
);
