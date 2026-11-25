CREATE TABLE `workspace_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`glass_mode` integer DEFAULT false NOT NULL,
	`regular_k` integer DEFAULT 40 NOT NULL,
	`first_game_k` integer DEFAULT 100 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
