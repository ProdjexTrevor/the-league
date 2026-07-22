import { describe, expect, it } from "vitest";
import { JobQueue } from "./job-queue.js";

describe("JobQueue", () => {
  it("exposes the active job and queued count", async () => {
    const queue = new JobQueue<{ task: string }>();
    let releaseFirst: (() => void) | undefined;
    const firstDone = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    queue.enqueue({
      id: "first",
      payload: { task: "first task" },
      run: () => firstDone,
    });
    queue.enqueue({
      id: "second",
      payload: { task: "second task" },
      run: async () => undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queue.isBusy()).toBe(true);
    expect(queue.getStatus().activeJob?.payload.task).toBe("first task");
    expect(queue.getStatus().pendingCount).toBe(1);

    releaseFirst?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queue.isBusy()).toBe(false);
    expect(queue.getStatus()).toEqual({ activeJob: null, pendingCount: 0 });
  });
});
