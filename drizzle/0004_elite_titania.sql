ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_key_unique";--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD COLUMN "endpoint" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD COLUMN "request_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "endpoint" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "request_hash" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_endpoint_key_unique" UNIQUE("user_id","endpoint","key");