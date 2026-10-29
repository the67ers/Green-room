CREATE TABLE `match_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`match_key` text NOT NULL,
	`reporter` text NOT NULL,
	`opponent` text NOT NULL,
	`choice` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
