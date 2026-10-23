CREATE TABLE "appointment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"visit_reason_id" uuid,
	"appointment_date" date NOT NULL,
	"appointment_no" integer NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"source" text DEFAULT 'online' NOT NULL,
	"booked_by" text,
	"fee_amount" numeric(10, 2),
	"payment_status" text DEFAULT 'unpaid',
	"paid_at" timestamp,
	"received_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_doctor_date_no_unique" UNIQUE("doctor_id","appointment_date","appointment_no")
);
--> statement-breakpoint
CREATE TABLE "doctor_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"max_patients" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "doctor_availability_doctor_day_unique" UNIQUE("doctor_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "doctor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"specialty_id" uuid,
	"reg_no" text,
	"consultation_fee" numeric(10, 2),
	"bio" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "doctor_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "specialty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "specialty_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "patient" DROP CONSTRAINT "patient_nic_unique";--> statement-breakpoint
ALTER TABLE "patient" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient" ALTER COLUMN "date_of_birth" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient" ALTER COLUMN "gender" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_booked_by_user_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_received_by_user_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor" ADD CONSTRAINT "doctor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor" ADD CONSTRAINT "doctor_specialty_id_specialty_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialty"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_full_name_idx" ON "patient" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "patient_phone_idx" ON "patient" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "patient_patient_no_idx" ON "patient" USING btree ("patient_no");--> statement-breakpoint
ALTER TABLE "patient" DROP COLUMN "nic";--> statement-breakpoint
INSERT INTO "specialty" ("id", "name")
VALUES
  (gen_random_uuid(), 'General Medicine'),
  (gen_random_uuid(), 'Cardiology'),
  (gen_random_uuid(), 'Pediatrics'),
  (gen_random_uuid(), 'Dermatology'),
  (gen_random_uuid(), 'Orthopedics')
ON CONFLICT ("name") DO NOTHING;
