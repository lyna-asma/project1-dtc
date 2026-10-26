CREATE TABLE "payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"merchant_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_requests_code_unique" UNIQUE("code"),
	CONSTRAINT "payment_request_amount_positive" CHECK ("payment_requests"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;