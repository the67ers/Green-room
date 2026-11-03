CREATE TABLE `account_ratings` (
	`account_id` text PRIMARY KEY NOT NULL,
	`elo` integer DEFAULT 400 NOT NULL
);
