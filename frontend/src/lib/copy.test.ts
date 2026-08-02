import { describe, expect, it } from "@jest/globals";
import { evidenceLabel, MODE_LABELS, MODES } from "./copy";

describe("evidenceLabel", () => {
  it("translates backend evidence tags into the app's plain wording", () => {
    expect(evidenceLabel("observed")).toEqual({
      label: "measured",
      tone: "tag-accent-2",
    });
    expect(evidenceLabel("inferred").label).toBe("reasoned");
    expect(evidenceLabel("hypothesis").label).toBe("a hunch");
    expect(evidenceLabel("low_confidence").label).toBe("take lightly");
  });

  it("passes an unknown tag through rather than swallowing it", () => {
    // A tag the backend adds later must still reach the user.
    expect(evidenceLabel("needs_review").label).toBe("needs review");
    expect(evidenceLabel("needs_review").tone).toBe("tag-neutral");
  });
});

describe("mode labels", () => {
  it("keeps the wire values while renaming what the user sees", () => {
    expect(MODES).toEqual(["discovery", "therapeutics", "conditioning"]);
    expect(MODE_LABELS.discovery).toBe("Explore");
    expect(MODE_LABELS.therapeutics).toBe("Shape");
    expect(MODE_LABELS.conditioning).toBe("Tune");
  });
});
