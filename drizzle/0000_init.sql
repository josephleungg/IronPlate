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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`username` text,
	`display_username` text,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `body_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`measured_at` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `body_measurements_user_type_idx` ON `body_measurements` (`user_id`,`type`,`measured_at`);--> statement-breakpoint
CREATE TABLE `nutrition_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`calories` integer NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real,
	`water_ml` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nutrition_goals_user_from_idx` ON `nutrition_goals` (`user_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`avatar_media_id` text,
	`is_private` integer DEFAULT false NOT NULL,
	`followers_count` integer DEFAULT 0 NOT NULL,
	`following_count` integer DEFAULT 0 NOT NULL,
	`workouts_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`sex` text DEFAULT 'unspecified' NOT NULL,
	`birth_date` text,
	`height_cm` real,
	`activity_level` text DEFAULT 'light' NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`distance_unit` text DEFAULT 'km' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`week_start` integer DEFAULT 1 NOT NULL,
	`diary_visibility` text DEFAULT 'private' NOT NULL,
	`default_workout_visibility` text DEFAULT 'followers' NOT NULL,
	`onboarding_completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weight_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_type` text NOT NULL,
	`start_weight_kg` real NOT NULL,
	`target_weight_kg` real NOT NULL,
	`weekly_rate_kg` real DEFAULT 0.5 NOT NULL,
	`start_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `diary_days` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`meal_slot_id` text NOT NULL,
	`food_id` text,
	`serving_id` text,
	`servings` real DEFAULT 1 NOT NULL,
	`amount` real,
	`name` text NOT NULL,
	`brand` text,
	`kcal` real NOT NULL,
	`protein_g` real DEFAULT 0 NOT NULL,
	`carbs_g` real DEFAULT 0 NOT NULL,
	`fat_g` real DEFAULT 0 NOT NULL,
	`fiber_g` real,
	`sugar_g` real,
	`sodium_mg` real,
	`source` text DEFAULT 'search' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_slot_id`) REFERENCES `meal_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `diary_entries_user_date_idx` ON `diary_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `diary_entries_user_food_idx` ON `diary_entries` (`user_id`,`food_id`,`logged_at`);--> statement-breakpoint
CREATE TABLE `food_barcodes` (
	`barcode` text PRIMARY KEY NOT NULL,
	`food_id` text NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `food_servings` (
	`id` text PRIMARY KEY NOT NULL,
	`food_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` real NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `food_servings_food_idx` ON `food_servings` (`food_id`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_ref` text,
	`owner_id` text,
	`name` text NOT NULL,
	`brand` text,
	`base_unit` text DEFAULT 'g' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`kcal_100` real NOT NULL,
	`protein_100` real DEFAULT 0 NOT NULL,
	`carbs_100` real DEFAULT 0 NOT NULL,
	`fat_100` real DEFAULT 0 NOT NULL,
	`fiber_100` real,
	`sugar_100` real,
	`sat_fat_100` real,
	`sodium_mg_100` real,
	`popularity` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
CREATE INDEX `foods_owner_idx` ON `foods` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `foods_source_ref_idx` ON `foods` (`source`,`source_ref`);--> statement-breakpoint
CREATE TABLE `meal_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_slots_user_idx` ON `meal_slots` (`user_id`);--> statement-breakpoint
CREATE TABLE `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`amount_ml` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `water_logs_user_date_idx` ON `water_logs` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `exercise_muscles` (
	`exercise_id` text NOT NULL,
	`muscle_group_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`exercise_id`, `muscle_group_id`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercise_muscles_muscle_idx` ON `exercise_muscles` (`muscle_group_id`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`slug` text,
	`exercise_type` text DEFAULT 'weight_reps' NOT NULL,
	`equipment` text DEFAULT 'none' NOT NULL,
	`is_unilateral` integer DEFAULT false NOT NULL,
	`instructions` text,
	`met` real,
	`aliases` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercises_name_idx` ON `exercises` (`name`);--> statement-breakpoint
CREATE INDEX `exercises_owner_idx` ON `exercises` (`owner_id`);--> statement-breakpoint
CREATE TABLE `muscle_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muscle_groups_slug_unique` ON `muscle_groups` (`slug`);--> statement-breakpoint
CREATE TABLE `personal_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`record_type` text NOT NULL,
	`value` real NOT NULL,
	`workout_id` text NOT NULL,
	`is_baseline` integer DEFAULT false NOT NULL,
	`achieved_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `personal_records_lookup_idx` ON `personal_records` (`user_id`,`exercise_id`,`record_type`);--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`superset_group` integer,
	`rest_seconds` integer,
	`notes` text,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `routine_exercises_routine_idx` ON `routine_exercises` (`routine_id`,`position`);--> statement-breakpoint
CREATE TABLE `routine_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `routine_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`set_type` text DEFAULT 'normal' NOT NULL,
	`target_weight_kg` real,
	`target_reps_min` integer,
	`target_reps_max` integer,
	`target_duration_s` integer,
	`target_distance_m` real,
	`target_rpe` real,
	FOREIGN KEY (`routine_exercise_id`) REFERENCES `routine_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routine_sets_exercise_idx` ON `routine_sets` (`routine_exercise_id`,`position`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`name` text NOT NULL,
	`notes` text,
	`position` integer DEFAULT 0 NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`share_slug` text,
	`source_routine_id` text,
	`copy_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `routine_folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routines_share_slug_unique` ON `routines` (`share_slug`);--> statement-breakpoint
CREATE INDEX `routines_user_idx` ON `routines` (`user_id`);--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`superset_group` integer,
	`rest_seconds` integer,
	`notes` text,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workout_exercises_workout_idx` ON `workout_exercises` (`workout_id`,`position`);--> statement-breakpoint
CREATE INDEX `workout_exercises_exercise_idx` ON `workout_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`set_type` text DEFAULT 'normal' NOT NULL,
	`weight_kg` real,
	`reps` integer,
	`duration_s` integer,
	`distance_m` real,
	`rpe` real,
	`completed_at` integer,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_sets_exercise_idx` ON `workout_sets` (`workout_exercise_id`,`position`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`routine_id` text,
	`title` text NOT NULL,
	`description` text,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_s` integer NOT NULL,
	`visibility` text DEFAULT 'followers' NOT NULL,
	`total_volume_kg` real DEFAULT 0 NOT NULL,
	`total_sets` integer DEFAULT 0 NOT NULL,
	`total_reps` integer DEFAULT 0 NOT NULL,
	`pr_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `workouts_user_started_idx` ON `workouts` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `blocks` (
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`blocker_id`, `blocked_id`),
	FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_post_idx` ON `comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	PRIMARY KEY(`follower_id`, `followee_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follows_followee_idx` ON `follows` (`followee_id`,`status`);--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `likes_post_idx` ON `likes` (`post_id`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_r2_key_unique` ON `media_assets` (`r2_key`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text,
	`type` text NOT NULL,
	`post_id` text,
	`data` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_created_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `post_media` (
	`post_id` text NOT NULL,
	`media_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`post_id`, `media_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`workout_id` text,
	`diary_date` text,
	`body` text,
	`visibility` text DEFAULT 'followers' NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_workout_id_unique` ON `posts` (`workout_id`);--> statement-breakpoint
CREATE INDEX `posts_user_created_idx` ON `posts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_created_idx` ON `posts` (`created_at`);