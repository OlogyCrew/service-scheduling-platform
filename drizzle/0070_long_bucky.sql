CREATE TABLE `payment_velocity_counters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dimension` enum('account','email','stripe_customer','provider','booking','ip') NOT NULL,
	`subjectKey` varchar(320) NOT NULL,
	`bucketStart` timestamp NOT NULL,
	`attemptCount` int NOT NULL DEFAULT 0,
	`blockedUntil` timestamp,
	`lastAttemptAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_velocity_counters_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_velocity_bucket_unique` UNIQUE(`dimension`,`subjectKey`,`bucketStart`)
);
--> statement-breakpoint
CREATE INDEX `payment_velocity_subject_idx` ON `payment_velocity_counters` (`dimension`,`subjectKey`);--> statement-breakpoint
CREATE INDEX `payment_velocity_blocked_idx` ON `payment_velocity_counters` (`blockedUntil`);