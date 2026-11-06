CREATE TABLE `provider_survey_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`status` enum('draft','sending','sent','closed') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	`closedAt` timestamp,
	CONSTRAINT `provider_survey_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_survey_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`providerId` int NOT NULL,
	`userId` int NOT NULL,
	`emailSnapshot` varchar(320) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`status` enum('invited','sent','responded','failed') NOT NULL DEFAULT 'invited',
	`sentAt` timestamp,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_survey_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_survey_recipients_tokenHash_unique` UNIQUE(`tokenHash`),
	CONSTRAINT `provider_survey_campaign_provider_unique` UNIQUE(`campaignId`,`providerId`)
);
--> statement-breakpoint
CREATE TABLE `provider_survey_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`recipientId` int NOT NULL,
	`providerId` int NOT NULL,
	`answers` json NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_survey_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_survey_responses_recipientId_unique` UNIQUE(`recipientId`)
);
--> statement-breakpoint
ALTER TABLE `provider_survey_campaigns` ADD CONSTRAINT `provider_survey_campaigns_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_survey_recipients` ADD CONSTRAINT `psr_campaign_fk` FOREIGN KEY (`campaignId`) REFERENCES `provider_survey_campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_survey_recipients` ADD CONSTRAINT `psr_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_survey_recipients` ADD CONSTRAINT `psr_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_survey_responses` ADD CONSTRAINT `psresp_campaign_fk` FOREIGN KEY (`campaignId`) REFERENCES `provider_survey_campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_survey_responses` ADD CONSTRAINT `psresp_recipient_fk` FOREIGN KEY (`recipientId`) REFERENCES `provider_survey_recipients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_survey_responses` ADD CONSTRAINT `psresp_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `provider_survey_campaign_status_idx` ON `provider_survey_campaigns` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `provider_survey_recipient_status_idx` ON `provider_survey_recipients` (`campaignId`,`status`);--> statement-breakpoint
CREATE INDEX `provider_survey_recipient_provider_idx` ON `provider_survey_recipients` (`providerId`);--> statement-breakpoint
CREATE INDEX `provider_survey_response_campaign_idx` ON `provider_survey_responses` (`campaignId`,`submittedAt`);--> statement-breakpoint
CREATE INDEX `provider_survey_response_provider_idx` ON `provider_survey_responses` (`providerId`);
