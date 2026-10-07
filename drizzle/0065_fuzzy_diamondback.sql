ALTER TABLE `social_posts` ADD `media_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `social_posts` ADD `media_alt` varchar(255);--> statement-breakpoint
ALTER TABLE `social_posts` ADD `target_url` varchar(512);--> statement-breakpoint
ALTER TABLE `social_posts` ADD `schedule_cron_task_uid` varchar(65);--> statement-breakpoint
ALTER TABLE `social_posts` ADD `weekly_key` varchar(32);--> statement-breakpoint
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_schedule_cron_task_uid_unique` UNIQUE(`schedule_cron_task_uid`);--> statement-breakpoint
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_weekly_key_unique` UNIQUE(`weekly_key`);