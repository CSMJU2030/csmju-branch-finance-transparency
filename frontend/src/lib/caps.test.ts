import { describe, expect, it } from "vitest";
import type { Me, Offices } from "./api";
import { capsOf, roleSummary } from "./caps";

const me = (subsystemRole: Me["subsystemRole"]): Me => ({
  id: "u1",
  email: "",
  coreRole: subsystemRole.toLowerCase(),
  subsystemRole,
  session: { expiresAt: null },
});
const offices = (over: Partial<Offices> = {}): Offices => ({
  isBranchHead: false,
  treasurerYearAccountIds: [],
  assignments: [],
  ...over,
});

describe("capsOf: what the UI shows (the backend enforces the same rules)", () => {
  it("a plain student can only read", () => {
    expect(capsOf(me("STUDENT"), offices())).toMatchObject({ canFile: false, canDecide: false, canManageOffices: false });
  });

  it("a student holding the treasurer office files, but never decides", () => {
    const caps = capsOf(me("STUDENT"), offices({ treasurerYearAccountIds: ["y1"] }));
    expect(caps).toMatchObject({ canFile: true, canDecide: false, canManageOffices: false });
    expect(caps.treasurerYearAccountIds).toEqual(["y1"]);
  });

  it("a student holding the branch-head office decides and appoints treasurers, but never files", () => {
    expect(capsOf(me("STUDENT"), offices({ isBranchHead: true }))).toMatchObject({
      canFile: false,
      canDecide: true,
      canManageOffices: true,
      isAdmin: false,
    });
  });

  it("an admin decides and manages offices without holding one, but never files", () => {
    expect(capsOf(me("ADMIN"), null)).toMatchObject({ canFile: false, canDecide: true, canManageOffices: true, isAdmin: true });
  });

  it("a lecturer can only read, even if offices were somehow supplied", () => {
    expect(capsOf(me("LECTURER"), null)).toMatchObject({ canFile: false, canDecide: false, canManageOffices: false });
  });

  it("if the offices cannot be loaded, nobody is shown as holding one", () => {
    expect(capsOf(me("STUDENT"), null)).toMatchObject({ canFile: false, canDecide: false });
  });
});

describe("roleSummary", () => {
  it("names the office next to the student role", () => {
    expect(roleSummary(me("STUDENT"), capsOf(me("STUDENT"), offices({ treasurerYearAccountIds: ["y"] })))).toContain("เหรัญญิก");
    expect(roleSummary(me("STUDENT"), capsOf(me("STUDENT"), offices({ isBranchHead: true })))).toContain("หัวหน้าสาขา");
    expect(roleSummary(me("STUDENT"), capsOf(me("STUDENT"), offices()))).toBe("");
  });
});
