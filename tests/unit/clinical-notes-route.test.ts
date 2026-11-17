import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), create: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/clinical-notes", () => ({
  createClinicalNote: mocks.create,
  getClinicalNotes: mocks.list,
}));

import { GET, POST } from "@/app/api/encounters/[id]/notes/route";
import { redirect } from "next/navigation";
import { ServiceError } from "@/lib/services/service-error";

const encounterId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: encounterId }) };
const note = {
  id: "note-id",
  encounterId,
  content: "Clinical observation.",
  createdAt: "2026-11-14T10:00:00.000Z",
};

function request(method: "GET" | "POST", body?: unknown, origin?: string) {
  return new Request(`http://localhost/api/encounters/${encounterId}/notes`, {
    method,
    headers: {
      cookie: "test-session",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "doctor-user", role: "doctor" } });
  mocks.create.mockResolvedValue(note);
  mocks.list.mockResolvedValue([note]);
});

describe("clinical note routes", () => {
  it("creates a note with the URL encounter and server-session doctor", async () => {
    const req = request("POST", { content: note.content }, "http://localhost");
    const response = await POST(req, context);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ note });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.create).toHaveBeenCalledWith({
      encounterId,
      note: { content: note.content },
      actor: { userId: "doctor-user", role: "doctor" },
    });
  });

  it("lists notes with the URL encounter and server-session doctor", async () => {
    const req = request("GET");
    const response = await GET(req, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ notes: [note] });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.list).toHaveBeenCalledWith({
      encounterId,
      actor: { userId: "doctor-user", role: "doctor" },
    });
  });

  it.each(["POST", "GET"] as const)(
    "rejects unauthorized %s sessions",
    async (method) => {
      mocks.getSession.mockResolvedValue(null);
      const response =
        method === "POST"
          ? await POST(request(method, { content: note.content }), context)
          : await GET(request(method), context);
      expect(response.status).toBe(401);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.list).not.toHaveBeenCalled();
    }
  );

  it.each(["patient", "receptionist", "nurse", "pharmacist", "admin"])(
    "rejects %s sessions",
    async (role) => {
      mocks.getSession.mockResolvedValue({ user: { id: "other-user", role } });
      expect(
        (await POST(request("POST", { content: note.content }), context)).status
      ).toBe(403);
      expect((await GET(request("GET"), context)).status).toBe(403);
    }
  );

  it("rejects cross-origin writes before authenticating", async () => {
    const response = await POST(
      request("POST", { content: note.content }, "https://other.example"),
      context
    );
    expect(response.status).toBe(403);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it.each([
    "{invalid",
    null,
    {},
    { content: "" },
    { content: "Note", authorId: "forged" },
    { content: "Note", encounterId: "forged" },
  ])("rejects invalid or forged note bodies: %j", async (body) => {
    const response = await POST(request("POST", body), context);
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid encounter IDs for both methods", async () => {
    const invalid = { params: Promise.resolve({ id: "invalid" }) };
    expect((await POST(request("POST", { content: note.content }), invalid)).status).toBe(
      400
    );
    expect((await GET(request("GET"), invalid)).status).toBe(400);
  });

  it.each(["create", "list"] as const)("preserves %s service denials", async (method) => {
    mocks[method].mockRejectedValue(
      new ServiceError("Unavailable visit.", 404, "NOT_FOUND")
    );
    const response =
      method === "create"
        ? await POST(request("POST", { content: note.content }), context)
        : await GET(request("GET"), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Unavailable visit.",
      code: "NOT_FOUND",
    });
  });

  it("does not expose note text in unexpected errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.create.mockRejectedValue(new Error(`Database failed for ${note.content}`));
      const response = await POST(request("POST", { content: note.content }), context);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Unable to save the clinical note. Please try again.",
      });
      expect(log).toHaveBeenCalledWith("Clinical note save failed.");
    } finally {
      log.mockRestore();
    }
  });

  it("rethrows Next.js control-flow errors", async () => {
    let redirectError: unknown;
    try {
      redirect("/login");
    } catch (error) {
      redirectError = error;
    }
    mocks.list.mockRejectedValue(redirectError);
    await expect(GET(request("GET"), context)).rejects.toBe(redirectError);
  });
});
