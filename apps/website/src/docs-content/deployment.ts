import type { DocSection } from './quickstart';

export const deploymentDoc: DocSection = {
  id: 'deployment',
  title: 'Production Deployment & DevOps',
  description:
    'Self-hosting runbooks for Docker, Kubernetes, Helm, horizontal pod autoscaling (HPA), zero-data-loss graceful shutdown, and Prometheus observability.',
  headings: [
    { id: 'docker-deployment', title: 'Docker Compose Deployment', level: 2 },
    { id: 'kubernetes-manifests', title: 'Kubernetes Production Manifests', level: 2 },
    { id: 'graceful-shutdown', title: 'Zero-Data-Loss Graceful Shutdown', level: 2 },
    { id: 'health-probes', title: 'Kubernetes Liveness & Readiness Probes', level: 2 },
    { id: 'prometheus-grafana', title: 'Prometheus & Grafana Observability', level: 2 },
  ],
  content: `
## Docker Compose Deployment

Convey provides production-ready Docker Compose configurations.

### Option A: Modular Dual Compose (Recommended)
Isolate stateful data infrastructure (Postgres 16 + Redis 7) from stateless compute:

\`\`\`bash
# 1. Start stateful database and cache
docker compose -f docker-compose.resources.yml up -d

# 2. Start Convey core engine and Mission Control UI (runs Drizzle migrations automatically)
docker compose -f docker-compose.service.yml up -d
\`\`\`

### Option B: Unified Single-Command Stack
\`\`\`bash
docker compose up -d
\`\`\`

---

## Kubernetes Production Manifests

### 1. Convey Core Deployment (\`convey-deployment.yaml\`)
\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: convey-core
  namespace: convey
  labels:
    app.kubernetes.io/name: convey-core
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app.kubernetes.io/name: convey-core
  template:
    metadata:
      labels:
        app.kubernetes.io/name: convey-core
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: convey
          image: convey/convey:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: convey-config
            - secretRef:
                name: convey-secrets
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2048Mi"
          readinessProbe:
            httpGet:
              path: /health/readiness
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/liveness
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]
\`\`\`

### 2. Horizontal Pod Autoscaler (HPA)
\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: convey-core-hpa
  namespace: convey
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: convey-core
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
\`\`\`

---

## Zero-Data-Loss Graceful Shutdown

Convey includes a staff-level **\`GracefulShutdownOrchestrator\`** handling \`SIGTERM\` and \`SIGINT\` signals:

\`\`\`text
1. SIGTERM Received ──► Readiness Probe returns 503 (Traffic drained by Ingress)
2. Outbox Polling Loop Paused (No new jobs pulled from Postgres)
3. In-Flight BullMQ Worker Jobs Drained & Completed (Up to 30s timeout)
4. Telemetry Metrics Flushed to Database (ReportingService.flush())
5. PostgreSQL & Redis Connection Pools Closed Cleanly
\`\`\`

This guarantees **zero message drops** during Kubernetes rolling updates.

---

## Kubernetes Liveness & Readiness Probes

Convey exposes dedicated endpoints for container orchestration:

- **\`GET /health/readiness\`**: Verifies PostgreSQL pool health, Redis cluster connectivity, and partition manager status. Returns \`200 OK\` when ready for ingress traffic.
- **\`GET /health/liveness\`**: Verifies Elysia event-loop responsiveness.
- **\`GET /health\`**: Returns comprehensive JSON telemetry including process uptime, V8 heap memory usage, active BullMQ workers, and Redis latency.

---

## Prometheus & Grafana Observability

Convey exposes standard Prometheus metrics at \`GET /metrics\`:

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| **\`convey_messages_ingested_total\`** | Counter | Ingested messages partitioned by channel and priority |
| **\`convey_http_request_duration_seconds\`**| Histogram | API ingestion latency distribution |
| **\`convey_outbox_queue_depth\`** | Gauge | Number of pending rows in the outbox ledger |
| **\`convey_provider_latency_seconds\`** | Histogram | Upstream provider wire execution duration |
| **\`convey_circuit_breaker_state\`** | Gauge | Circuit state (\`0=CLOSED\`, \`1=HALF_OPEN\`, \`2=OPEN\`) |
| **\`convey_v8_heap_used_bytes\`** | Gauge | Node/Bun V8 heap memory consumption |
`,
};
