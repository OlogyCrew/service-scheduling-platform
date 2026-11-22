CREATE TABLE `booking_cancellation_notification_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operationId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`eventName` varchar(64) NOT NULL,
	`idempotencyKey` varchar(191) NOT NULL,
	`notificationType` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`actionUrl` varchar(500),
	`bookingId` int NOT NULL,
	`status` enum('pending','sending','sent','retryable','failed') NOT NULL DEFAULT 'pending',
	`attemptCount` int NOT NULL DEFAULT 0,
	`leaseToken` varchar(64) NOT NULL DEFAULT '',
	`lastAttemptAt` timestamp,
	`nextRetryAt` timestamp,
	`lastError` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_cancellation_notification_outbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_cancellation_notification_outbox_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `booking_cancellation_notification_outbox` ADD CONSTRAINT `booking_cancellation_notification_outbox_operationId_booking_cancellation_operations_id_fk` FOREIGN KEY (`operationId`) REFERENCES `booking_cancellation_operations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_cancellation_notification_outbox` ADD CONSTRAINT `booking_cancellation_notification_outbox_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_cancellation_notification_outbox` ADD CONSTRAINT `booking_cancellation_notification_outbox_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cancel_notification_outbox_claim_idx` ON `booking_cancellation_notification_outbox` (`status`,`nextRetryAt`,`lastAttemptAt`);--> statement-breakpoint
CREATE INDEX `cancel_notification_outbox_operation_idx` ON `booking_cancellation_notification_outbox` (`operationId`);--> statement-breakpoint
CREATE INDEX `cancel_notification_outbox_recipient_idx` ON `booking_cancellation_notification_outbox` (`recipientUserId`,`createdAt`);