CREATE TABLE `offline_booking_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`paymentMethod` enum('pay_at_location') NOT NULL DEFAULT 'pay_at_location',
	`status` enum('due','paid','waived') NOT NULL DEFAULT 'due',
	`originalAmountDue` decimal(10,2) NOT NULL,
	`amountReceived` decimal(10,2) NOT NULL DEFAULT '0.00',
	`offlinePaymentMethod` enum('cash','bank_transfer','mobile_money','other'),
	`paidAt` timestamp,
	`confirmedByUserId` int,
	`paymentNote` text,
	`waiverAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`waiverReason` text,
	`waivedByUserId` int,
	`waivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offline_booking_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `offline_booking_payments_bookingId_unique` UNIQUE(`bookingId`)
);
--> statement-breakpoint
CREATE TABLE `provider_pay_at_location_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`serviceId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_pay_at_location_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_pay_location_service_unique` UNIQUE(`providerId`,`serviceId`)
);
--> statement-breakpoint
CREATE TABLE `provider_pay_at_location_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`instructions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_pay_at_location_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_pay_at_location_settings_providerId_unique` UNIQUE(`providerId`)
);
--> statement-breakpoint
ALTER TABLE `offline_booking_payments` ADD CONSTRAINT `offline_booking_payments_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offline_booking_payments` ADD CONSTRAINT `offline_booking_payments_confirmedByUserId_users_id_fk` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offline_booking_payments` ADD CONSTRAINT `offline_booking_payments_waivedByUserId_users_id_fk` FOREIGN KEY (`waivedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_pay_at_location_services` ADD CONSTRAINT `provider_pay_location_services_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_pay_at_location_services` ADD CONSTRAINT `provider_pay_location_services_service_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_pay_at_location_settings` ADD CONSTRAINT `provider_pay_location_settings_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `offline_payment_status_idx` ON `offline_booking_payments` (`status`);--> statement-breakpoint
CREATE INDEX `offline_payment_confirmed_by_idx` ON `offline_booking_payments` (`confirmedByUserId`);--> statement-breakpoint
CREATE INDEX `provider_pay_location_provider_idx` ON `provider_pay_at_location_services` (`providerId`);--> statement-breakpoint
CREATE INDEX `provider_pay_location_service_idx` ON `provider_pay_at_location_services` (`serviceId`);