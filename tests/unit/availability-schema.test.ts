import { describe, expect, it } from "vitest";
import {
  availabilitySessionSchema,
  saveAvailabilitySchema,
} from "@/lib/schemas/availability";

const session = {
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "12:00",
  maxPatients: 10,
  isActive: true,
};

describe("Weekly clinic availability validation", () => {
  it("accepts one session for each weekday, including disabled days", () => {
    expect(
      saveAvailabilitySchema.safeParse({
        sessions: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          ...session,
          dayOfWeek,
          isActive: dayOfWeek !== 0,
        })),
      }).success
    ).toBe(true);
  });

  it.each([-1, 7, 1.5])("rejects invalid weekday %s", (dayOfWeek) => {
    expect(availabilitySessionSchema.safeParse({ ...session, dayOfWeek }).success).toBe(
      false
    );
  });

  it.each(["24:00", "09:60", "9:00", "09:00:00", "", "tomorrow"])(
    "rejects invalid clinic time %s",
    (startTime) => {
      expect(availabilitySessionSchema.safeParse({ ...session, startTime }).success).toBe(
        false
      );
    }
  );

  it.each(["09:00", "08:59", "00:00"])(
    "rejects an end time at or before the start: %s",
    (endTime) => {
      const result = availabilitySessionSchema.safeParse({ ...session, endTime });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes("endTime"))).toBe(
          true
        );
      }
    }
  );

  it.each([0, -1, 1.5, 32768, NaN, "10"])(
    "rejects invalid capacity %s",
    (maxPatients) => {
      expect(
        availabilitySessionSchema.safeParse({ ...session, maxPatients }).success
      ).toBe(false);
    }
  );

  it.each([1, 32767])("accepts capacity boundary %s", (maxPatients) => {
    expect(availabilitySessionSchema.safeParse({ ...session, maxPatients }).success).toBe(
      true
    );
  });

  it("rejects two sessions on the same weekday", () => {
    expect(
      saveAvailabilitySchema.safeParse({
        sessions: [session, { ...session, startTime: "14:00", endTime: "17:00" }],
      }).success
    ).toBe(false);
  });

  it("rejects an empty week and more than seven sessions", () => {
    expect(saveAvailabilitySchema.safeParse({ sessions: [] }).success).toBe(false);
    expect(
      saveAvailabilitySchema.safeParse({ sessions: Array(8).fill(session) }).success
    ).toBe(false);
  });

  it("rejects attempts to supply another doctor's identity", () => {
    expect(
      saveAvailabilitySchema.safeParse({
        sessions: [session],
        doctorId: "another-doctor",
      }).success
    ).toBe(false);
    expect(
      saveAvailabilitySchema.safeParse({
        sessions: [{ ...session, doctorId: "another-doctor" }],
      }).success
    ).toBe(false);
  });
});
