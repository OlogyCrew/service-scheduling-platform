CREATE TABLE `stripe_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stripeEventId` varchar(255) NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`accountId` varchar(255),
	`livemode` boolean NOT NULL,
	`apiVersion` varchar(50),
	`paymentIntentId` varchar(255),
	`checkoutSessionId` varchar(255),
	`chargeId` varchar(255),
	`invoiceId` varchar(255),
	`subscriptionId` varchar(255),
	`bookingId` int,
	`status` enum('received','processing','processed','failed') NOT NULL DEFAULT 'received',
	`attemptCount` int NOT NULL DEFAULT 0,
	`firstReceivedAt` timestamp NOT NULL DEFAULT (now()),
	`lastAttemptAt` timestamp,
	`processedAt` timestamp,
	`nextRetryAt` timestamp,
	`lastError` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_webhook_events_stripeEventId_unique` UNIQUE(`stripeEventId`)
);
--> statement-breakpoint
CREATE INDEX `stripe_webhook_event_type_idx` ON `stripe_webhook_events` (`eventType`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_account_idx` ON `stripe_webhook_events` (`accountId`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_payment_intent_idx` ON `stripe_webhook_events` (`paymentIntentId`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_checkout_idx` ON `stripe_webhook_events` (`checkoutSessionId`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_charge_idx` ON `stripe_webhook_events` (`chargeId`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_invoice_idx` ON `stripe_webhook_events` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_subscription_idx` ON `stripe_webhook_events` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_booking_idx` ON `stripe_webhook_events` (`bookingId`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_status_retry_idx` ON `stripe_webhook_events` (`status`,`nextRetryAt`);