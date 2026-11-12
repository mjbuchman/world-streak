// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditState } from "@/lib/adminEdit";

const saveSettingsAction = vi.hoisted(() => vi.fn<(previous: EditState | null, form: FormData) => Promise<EditState>>());
vi.mock("@/app/admin/actions", () => ({ saveSettingsAction }));

import { SettingsForm } from "./SettingsForm";

afterEach(() => {
  cleanup();
  saveSettingsAction.mockReset();
});

const fields = [
  { name: "default_survival_threshold", label: "Survival threshold", hint: "Share of players who must pass." },
  { name: "rotation", label: "Rotation", hint: "Challenges in daily order." },
];
const values = { default_survival_threshold: "0.6", rotation: "stacking, inner-clock" };

describe("SettingsForm", () => {
  it("shows each setting with its value and hint, and sends them all", async () => {
    saveSettingsAction.mockResolvedValue({ ok: true, message: "Settings saved." });
    const user = userEvent.setup();
    render(<SettingsForm fields={fields} values={values} />);
    const threshold = screen.getByRole("textbox", { name: "Survival threshold" });
    expect(threshold).toHaveProperty("value", "0.6");
    expect(screen.getByRole("textbox", { name: "Rotation" }).getAttribute("aria-describedby")).toBe("rotation-hint");
    expect(screen.getByText("Challenges in daily order.").id).toBe("rotation-hint");

    await user.clear(threshold);
    await user.type(threshold, "0.55");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    await vi.waitFor(() => expect(saveSettingsAction).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(saveSettingsAction.mock.calls[0][1])).toEqual({
      default_survival_threshold: "0.55",
      rotation: "stacking, inner-clock",
    });
    expect((await screen.findByRole("status")).textContent).toBe("Settings saved.");
  });

  it("shows the server's refusal", async () => {
    saveSettingsAction.mockResolvedValue({ ok: false, message: "Survival threshold must be from 0 to 1." });
    const user = userEvent.setup();
    render(<SettingsForm fields={fields} values={values} />);
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect((await screen.findByRole("status")).textContent).toBe("Survival threshold must be from 0 to 1.");
  });
});
