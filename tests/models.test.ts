import { describe, it, expect } from "vitest";
import {
  type Task,
  claim,
  start,
  submitForReview,
  complete,
  isClaimed,
  isDone,
  statusFromLabels,
} from "../src/index.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    issueNumber: 1,
    title: "Test task",
    body: "",
    status: "open",
    assignedTo: "unassigned",
    prNumber: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Task models", () => {
  it("new task is open and unclaimed", () => {
    const t = makeTask();
    expect(t.status).toBe("open");
    expect(isClaimed(t)).toBe(false);
    expect(isDone(t)).toBe(false);
  });

  it("claim assigns to agent and sets status", () => {
    const t = claim(makeTask(), "doom");
    expect(t.assignedTo).toBe("doom");
    expect(t.status).toBe("claimed");
    expect(isClaimed(t)).toBe(true);
  });

  it("claim by same agent is idempotent", () => {
    const t = claim(makeTask(), "doom");
    const t2 = claim(t, "doom");
    expect(t2.assignedTo).toBe("doom");
  });

  it("claim by different agent throws", () => {
    const t = claim(makeTask(), "doom");
    expect(() => claim(t, "kangbot")).toThrow("already claimed");
  });

  it("start without claim throws", () => {
    expect(() => start(makeTask())).toThrow("Cannot start");
  });

  it("full lifecycle: claim → start → review → done", () => {
    let t = makeTask();
    t = claim(t, "doom");
    t = start(t);
    expect(t.status).toBe("in_progress");
    t = submitForReview(t, 5);
    expect(t.status).toBe("in_review");
    expect(t.prNumber).toBe(5);
    t = complete(t);
    expect(t.status).toBe("done");
    expect(isDone(t)).toBe(true);
  });

  it("statusFromLabels maps correctly", () => {
    expect(statusFromLabels(["done"])).toBe("done");
    expect(statusFromLabels(["in-review"])).toBe("in_review");
    expect(statusFromLabels(["claimed"])).toBe("claimed");
    expect(statusFromLabels(["blocked"])).toBe("blocked");
    expect(statusFromLabels([])).toBe("open");
  });

  it("updatedAt changes on transitions", () => {
    const t = makeTask({ updatedAt: "2020-01-01T00:00:00.000Z" });
    const claimed = claim(t, "doom");
    expect(claimed.updatedAt > t.updatedAt).toBe(true);
  });
});