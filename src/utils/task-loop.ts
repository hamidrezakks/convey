export interface TaskLoop {
  start(intervalMs?: number): void;
  stop(): void;
  isRunning(): boolean;
}

export function createTaskLoop(
  taskFn: (batchSize: number) => Promise<number>,
  defaultBatchSize = 500,
  loopName = 'TaskLoop',
): TaskLoop {
  let running = false;

  return {
    start(intervalMs = 500) {
      running = true;
      const loop = async () => {
        while (running) {
          try {
            const count = await taskFn(defaultBatchSize);
            if (count >= defaultBatchSize) {
              continue;
            }
          } catch (err) {
            console.error(`Error in ${loopName}:`, err);
          }
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      };
      loop();
    },
    stop() {
      running = false;
    },
    isRunning() {
      return running;
    },
  };
}
