// A tiny stand-in for the fictional "Lattice" library the demo documents.
// Twoslash resolves `import ... from "lattice"` to this file, so hover types in the docs are real.

export type Priority = "low" | "normal" | "high";

export interface JobOptions {
  /** How many times a failed job is retried. @default 3 */
  retries?: number;
  /** Milliseconds to wait before the job becomes available. */
  delay?: number;
  priority?: Priority;
}

export interface Job<Data> {
  readonly id: string;
  readonly data: Data;
  /** How many times processing has been attempted. */
  readonly attempts: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  failed: number;
}

export interface Queue<Data> {
  readonly name: string;
  /** Adds a job. Resolves once the job is stored. */
  add(data: Data, options?: JobOptions): Promise<Job<Data>>;
  stats(): Promise<QueueStats>;
}

export interface WorkerOptions {
  /** Jobs processed at the same time. @default 1 */
  concurrency?: number;
}

export interface Worker {
  /** Stops taking new jobs and waits for active ones. */
  close(): Promise<void>;
}

export class LatticeError extends Error {
  constructor(
    message: string,
    readonly code: "QUEUE_CLOSED" | "JOB_TIMEOUT" | "BACKEND_UNAVAILABLE",
  ) {
    super(message);
  }
}

/** Creates a typed queue. The type argument is the shape of the job data. */
export function createQueue<Data>(name: string): Queue<Data> {
  return {
    name,
    async add(data) {
      return { id: crypto.randomUUID(), data, attempts: 0 };
    },
    async stats() {
      return { waiting: 0, active: 0, failed: 0 };
    },
  };
}

/** Starts a worker that runs `handler` for every job of `queue`. */
export function createWorker<Data>(
  queue: Queue<Data>,
  handler: (job: Job<Data>) => Promise<void>,
  options?: WorkerOptions,
): Worker {
  void queue;
  void handler;
  void options;
  return { async close() {} };
}
