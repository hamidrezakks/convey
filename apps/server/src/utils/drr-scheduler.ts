export type SLATier = 'enterprise' | 'pro' | 'free';

export interface DRRTask<T> {
  id: string;
  tenantId: string;
  tier: SLATier;
  payload: T;
  weight?: number;
}

export interface TenantQueueStats {
  tenantId: string;
  tier: SLATier;
  pendingCount: number;
  deficitCredit: number;
}

export class DeficitWeightedRoundRobinScheduler<T> {
  private queues = new Map<string, { tier: SLATier; tasks: DRRTask<T>[]; head: number }>();
  private deficitMap = new Map<string, number>();
  private activeTenants: string[] = [];

  // Default quantum allocations per SLA tier
  private quantumMap: Record<SLATier, number> = {
    enterprise: 100,
    pro: 25,
    free: 5,
  };

  constructor(customQuantums?: Partial<Record<SLATier, number>>) {
    if (customQuantums) {
      this.quantumMap = { ...this.quantumMap, ...customQuantums };
    }
  }

  /**
   * Enqueues a task into a tenant's virtual queue.
   */
  enqueue(task: DRRTask<T>): void {
    let tenantQueue = this.queues.get(task.tenantId);
    if (!tenantQueue) {
      tenantQueue = { tier: task.tier, tasks: [], head: 0 };
      this.queues.set(task.tenantId, tenantQueue);
      this.activeTenants.push(task.tenantId);
      this.deficitMap.set(task.tenantId, 0);
    }
    tenantQueue.tasks.push(task);
  }

  /**
   * Dequeues a batch of tasks across tenants using DRR quantum deficit scheduling.
   * Guarantees fair-share concurrency proportional to tenant SLA tier weights.
   */
  dequeueBatch(maxBatchSize: number): DRRTask<T>[] {
    const dequeued: DRRTask<T>[] = [];
    if (this.activeTenants.length === 0 || maxBatchSize <= 0) {
      return dequeued;
    }

    let iterations = 0;
    const maxIterations = this.activeTenants.length * 2;

    while (dequeued.length < maxBatchSize && this.activeTenants.length > 0 && iterations < maxIterations) {
      iterations++;
      const activeCopy = [...this.activeTenants];

      for (let t = 0; t < activeCopy.length; t++) {
        const tenantId = activeCopy[t];
        if (dequeued.length >= maxBatchSize) break;

        const queueInfo = this.queues.get(tenantId);
        if (!queueInfo || queueInfo.head >= queueInfo.tasks.length) {
          // Remove empty queue
          this.queues.delete(tenantId);
          this.deficitMap.delete(tenantId);
          this.activeTenants = this.activeTenants.filter((id) => id !== tenantId);
          continue;
        }

        const quantum = this.quantumMap[queueInfo.tier] || 5;
        const currentDeficit = (this.deficitMap.get(tenantId) || 0) + quantum;
        let remainingDeficit = currentDeficit;

        while (queueInfo.head < queueInfo.tasks.length && remainingDeficit > 0 && dequeued.length < maxBatchSize) {
          const nextTask = queueInfo.tasks[queueInfo.head];
          const taskWeight = nextTask.weight || 1;

          if (remainingDeficit >= taskWeight) {
            remainingDeficit -= taskWeight;
            dequeued.push(queueInfo.tasks[queueInfo.head++]);
          } else {
            break;
          }
        }

        if (queueInfo.head >= queueInfo.tasks.length) {
          this.deficitMap.set(tenantId, 0);
          this.queues.delete(tenantId);
          this.activeTenants = this.activeTenants.filter((id) => id !== tenantId);
        } else {
          this.deficitMap.set(tenantId, remainingDeficit);
          if (queueInfo.head > 64) {
            queueInfo.tasks.splice(0, queueInfo.head);
            queueInfo.head = 0;
          }
        }
      }
    }

    return dequeued;
  }

  /**
   * Returns current statistics across all tenant virtual queues.
   */
  getStats(): TenantQueueStats[] {
    const stats: TenantQueueStats[] = [];
    for (const [tenantId, queueInfo] of this.queues.entries()) {
      const pendingCount = queueInfo.tasks.length - queueInfo.head;
      if (pendingCount > 0) {
        stats.push({
          tenantId,
          tier: queueInfo.tier,
          pendingCount,
          deficitCredit: this.deficitMap.get(tenantId) || 0,
        });
      }
    }
    return stats;
  }

  /**
   * Clears all queues and resets scheduler state.
   */
  clear(): void {
    this.queues.clear();
    this.deficitMap.clear();
    this.activeTenants = [];
  }
}

export const drrScheduler = new DeficitWeightedRoundRobinScheduler<unknown>();
