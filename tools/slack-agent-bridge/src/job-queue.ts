export type QueuedJob<T> = {
  id: string;
  payload: T;
  run: (payload: T) => Promise<void>;
};

/**
 * Serial job queue — one agent run at a time.
 */
export class JobQueue<T> {
  private chain: Promise<void> = Promise.resolve();
  private running = false;
  private pendingCount = 0;
  private activeJob: { id: string; payload: T; startedAt: Date } | null = null;

  enqueue(job: QueuedJob<T>): void {
    this.pendingCount += 1;
    this.chain = this.chain.catch(() => undefined).then(async () => {
      this.pendingCount -= 1;
      this.running = true;
      this.activeJob = {
        id: job.id,
        payload: job.payload,
        startedAt: new Date(),
      };
      try {
        await job.run(job.payload);
      } finally {
        this.running = false;
        this.activeJob = null;
      }
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  isBusy(): boolean {
    return this.running || this.pendingCount > 0;
  }

  getStatus(): {
    activeJob: { id: string; payload: T; startedAt: Date } | null;
    pendingCount: number;
  } {
    return {
      activeJob: this.activeJob,
      pendingCount: this.pendingCount,
    };
  }
}
