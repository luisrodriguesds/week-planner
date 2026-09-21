CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_execution_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`attempt_at` text NOT NULL,
	`success` integer NOT NULL,
	`http_status` integer,
	`response_body` text,
	`error_message` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`status` text NOT NULL,
	`idgrelha` integer NOT NULL,
	`idaula` integer NOT NULL,
	`nome_aula` text NOT NULL,
	`nome_professor` text,
	`nome_local` text,
	`data_hora_aula` text NOT NULL,
	`inicio_marcacao` text NOT NULL,
	`fim_marcacao` text NOT NULL,
	`centro_local` integer NOT NULL,
	`lotacao_reserva_web` integer NOT NULL,
	`fuso_horario` text NOT NULL,
	`valor_a` text NOT NULL,
	`valor_b` text NOT NULL,
	`valor_c` text NOT NULL,
	`valor_b_num_alunos` integer NOT NULL,
	`valor_c_num_alunos` integer NOT NULL,
	`id_marcacao` integer,
	`failure_reason` text,
	`scheduled_execute_at` text NOT NULL,
	`executed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plans_user_status_idx` ON `plans` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `plans_status_execute_idx` ON `plans` (`status`,`scheduled_execute_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `plans_user_slot_unique` ON `plans` (`user_id`,`idgrelha`,`data_hora_aula`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`digest_enabled` integer DEFAULT 1 NOT NULL,
	`digest_day` integer DEFAULT 0 NOT NULL,
	`digest_hour` integer DEFAULT 20 NOT NULL,
	`digest_minute` integer DEFAULT 0 NOT NULL,
	`default_class_filter` text,
	`center_id` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`gogym_numcliente` text,
	`gogym_idcliente` text,
	`gogym_display_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);