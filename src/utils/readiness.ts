import { ProviderRegistry } from '../modules/providers/core/provider-registry';

export enum ComponentStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export enum PartitionStatus {
  READY = 'ready',
  PENDING = 'pending',
  ERROR = 'error',
}

export enum WorkerState {
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
}

export interface ReadinessStatus {
  ready: boolean;
  db: ComponentStatus;
  redis: ComponentStatus;
  partitions: PartitionStatus;
  configuredProvidersCount: number;
  configuredProvidersByChannel: Record<string, string[]>;
  activeWorkers: Record<string, WorkerState>;
  bootstrappedAt?: string;
}

class ReadinessStateTracker {
  private ready = false;
  private dbStatus: ComponentStatus = ComponentStatus.DISCONNECTED;
  private redisStatus: ComponentStatus = ComponentStatus.DISCONNECTED;
  private partitionsStatus: PartitionStatus = PartitionStatus.PENDING;
  private configuredProvidersCount = 0;
  private configuredProvidersByChannel: Record<string, string[]> = {};
  private activeWorkers: Record<string, WorkerState> = {};
  private bootstrappedAt?: string;

  setReady(isReady: boolean): void {
    this.ready = isReady;
    if (isReady && !this.bootstrappedAt) {
      this.bootstrappedAt = new Date().toISOString();
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  setDbStatus(status: ComponentStatus): void {
    this.dbStatus = status;
  }

  setRedisStatus(status: ComponentStatus): void {
    this.redisStatus = status;
  }

  setPartitionsStatus(status: PartitionStatus): void {
    this.partitionsStatus = status;
  }

  setConfiguredProviders(count: number, byChannel: Record<string, string[]>): void {
    this.configuredProvidersCount = count;
    this.configuredProvidersByChannel = byChannel;
  }

  setActiveWorker(workerName: string, status: WorkerState): void {
    this.activeWorkers[workerName] = status;
  }

  getStatus(): ReadinessStatus & { providerTelemetry: ReturnType<typeof ProviderRegistry.getTelemetryMetrics> } {
    return {
      ready: this.ready,
      db: this.dbStatus,
      redis: this.redisStatus,
      partitions: this.partitionsStatus,
      configuredProvidersCount: this.configuredProvidersCount,
      configuredProvidersByChannel: this.configuredProvidersByChannel,
      activeWorkers: { ...this.activeWorkers },
      providerTelemetry: ProviderRegistry.getTelemetryMetrics(),
      bootstrappedAt: this.bootstrappedAt,
    };
  }
}

export const appReadiness = new ReadinessStateTracker();
