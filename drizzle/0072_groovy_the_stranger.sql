CREATE TABLE `booking_cancellation_operations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`operationKey` varchar(191) NOT NULL,
	`requestedByUserId` int NOT NULL,
	`actorRole` enum('customer','provider','admin') NOT NULL,
	`reason` text NOT NULL,
	`bookingStatusAtClaim` varchar(20) NOT NULL,
	`paymentId` int,
	`stripePaymentIntentId` varchar(255),
	`refundAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`refundPercentage` decimal(5,2) NOT NULL DEFAULT '0.00',
	`stripeRefundIdempotencyKey` varchar(255),
	`status` enum('claimed','refund_pending','refunded','no_refund_required','completed','retryable','failed') NOT NULL DEFAULT 'claimed',
	`attemptCount` int NOT NULL DEFAULT 0,
	`leaseToken` varchar(64) NOT NULL DEFAULT '',
	`lastAttemptAt` timestamp,
	`nextRetryAt` timestamp,
	`lastError` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_cancellation_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_cancellation_operations_operationKey_unique` UNIQUE(`operationKey`),
	CONSTRAINT `booking_cancel_operation_booking_unique` UNIQUE(`bookingId`)
);
--> statement-breakpoint
ALTER TABLE `booking_cancellation_operations` ADD CONSTRAINT `booking_cancellation_operations_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `booking_cancellation_operations` ADD CONSTRAINT `booking_cancellation_operations_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `booking_cancellation_operations` ADD CONSTRAINT `booking_cancellation_operations_paymentId_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `booking_cancel_operation_status_retry_idx` ON `booking_cancellation_operations` (`status`,`nextRetryAt`);
--> statement-breakpoint
CREATE INDEX `booking_cancel_operation_lease_idx` ON `booking_cancellation_operations` (`status`,`lastAttemptAt`);
--> statement-breakpoint
CREATE INDEX `booking_cancel_operation_actor_idx` ON `booking_cancellation_operations` (`requestedByUserId`,`createdAt`);
