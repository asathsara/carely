// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatientProfileSettings } from "@/components/patient/patient-profile-settings";
import { AppShell } from "@/components/workspace/app-shell";
import type { PatientProfile } from "@/lib/schemas/patient-update";

const fetchMock = vi.hoisted(() => {
  // The real Better Auth client captures fetch when it is created.
  const mockFetch = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  return mockFetch;
});

vi.mock("next/navigation", () => ({ usePathname: () => "/patient/profile" }));
vi.mock("@/lib/services/settings", () => ({
  getHospitalContact: async () => ({ name: "Test Hospital" }),
}));

const profile: PatientProfile = {
  id: "patient-1",
  patientNo: "PT-1",
  fullName: "Test Patient",
  dateOfBirth: null,
  gender: null,
  email: "patient@example.test",
  emailVerified: true,
  phone: null,
  address: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
};

let container: HTMLDivElement;
let root: Root;
const replaceLocation = vi.fn();

beforeEach(async () => {
  fetchMock.mockReset();
  replaceLocation.mockReset();
  vi.spyOn(window.location, "replace").mockImplementation(replaceLocation);

  container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  const shell = await AppShell({
    role: "patient",
    user: { name: profile.fullName, detail: "Patient" },
    children: <PatientProfileSettings initialProfile={profile} />,
  });
  await act(() => root.render(shell));
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function getButton(area: ParentNode, label: string) {
  const button = Array.from(area.querySelectorAll("button")).find(
    (element) =>
      (element.getAttribute("aria-label") ?? element.textContent?.trim()) === label
  );
  if (!button) throw new Error(`No button labeled "${label}"`);
  return button;
}

describe("Patient workspace logout", () => {
  it("shows Profile without a duplicate logout action", () => {
    const main = container.querySelector("main");
    expect(main?.textContent).toContain("Profile & settings");
    expect(main?.textContent).not.toMatch(/\blog out\b/i);
    expect(main?.querySelector('a[href="/login"]')).toBeNull();
  });

  it.each(["desktop sidebar", "mobile drawer"])(
    "signs out from the %s before redirecting",
    async (navigation) => {
      if (navigation === "mobile drawer") {
        await act(() => getButton(container, "Open navigation").click());
      }
      const area = container.querySelector(
        navigation === "mobile drawer"
          ? '[role="dialog"][aria-label="Mobile navigation"]'
          : "aside"
      );
      if (!area) throw new Error(`Could not find the ${navigation}`);

      const button = getButton(area, "Log out");
      expect(button.type).toBe("button");
      expect(button.tabIndex).toBe(0);
      expect(button.className).toMatch(/\bfocus-visible:(?:ring|outline)-2\b/);
      button.focus();
      expect(document.activeElement).toBe(button);

      const response = Promise.withResolvers<Response>();
      fetchMock.mockReturnValueOnce(response.promise);
      await act(() => button.click());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [[url, request]] = fetchMock.mock.calls;
      expect(String(url)).toBe("http://localhost:3000/api/auth/sign-out");
      expect(request).toMatchObject({ method: "POST", credentials: "include" });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(document.activeElement).toBe(button);
      expect(replaceLocation).not.toHaveBeenCalled();

      await act(async () => {
        response.resolve(Response.json({ success: true }));
        await vi.waitFor(() =>
          expect(replaceLocation).toHaveBeenCalledExactlyOnceWith("/login")
        );
      });
    }
  );

  it("stays on the current page and allows retry after a failed sign-out", async () => {
    const button = getButton(container, "Log out");
    fetchMock.mockResolvedValueOnce(
      Response.json({ message: "Unavailable" }, { status: 500 })
    );

    await act(async () => button.click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(replaceLocation).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Please try again"
    );
    expect(getButton(container, "Log out")).toBe(button);
    expect(button.getAttribute("aria-disabled")).not.toBe("true");

    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await act(async () => button.click());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(replaceLocation).toHaveBeenCalledExactlyOnceWith("/login");
  });
});
