# Dokuru Lab

Dokuru Lab is a deliberately vulnerable SvelteKit application for validating Docker namespace isolation and cgroup controls before and after Dokuru hardening.

The application is intentionally unsafe. Run it only on disposable lab infrastructure.

## Stack

- SvelteKit
- TypeScript
- Tailwind CSS v4
- Bun
- Docker Compose

## Local Development

```bash
bun install
bun run dev
```

Open:

```text
http://localhost:8080
```

The hosted lab uses the production server because it includes WebSocket endpoints for the live terminal and monitor:

```bash
bun run build
LAB_DATA_DIR=./data bun run start
```

## Hosted Lab Deployment

The Compose file runs Caddy and the intentionally vulnerable lab app for the hosted lab.

Caddy terminates HTTPS for `lab.dokuru.rifuki.dev` and proxies to `dokuru-lab:8080`. The lab app intentionally starts with unsafe runtime settings:

- `pid: host`
- `ipc: host`
- `uts: host`
- `userns_mode: host`
- no memory limit
- no CPU shares
- no PIDs limit

These settings make Dokuru namespace and cgroup audit findings visible before hardening. Caddy uses normal isolation and resource limits so the audit noise stays focused on `dokuru-lab`.

Lab v2 adds victim services in the same Compose stack so the demo can show cross-container blast radius, not only introspection:

- `victim-checkout`: healthy customer-facing API used by Customer Live View.
- `victim-secrets`: PostgreSQL neighbor with a visible demo password for `/proc/<pid>/environ` theft when `SYS_PTRACE` and `pid: host` are present.
- `customer-traffic`: background curl loop that writes real customer latency to `./data/customer-traffic.log` for the UI.

The attacker lab intentionally includes `cap_add: [SYS_PTRACE]` to model the common debug-capability mistake and make rule 5.3/5.16 impact visible. After Dokuru fixes PID namespace sharing, the same secret-theft command should stop finding the postgres PID.

Point DNS for `lab.dokuru.rifuki.dev` to the VPS, then deploy:

On the VPS, create `.env` from `.env.example` only if you want to override the app runtime values:

```bash
cp .env.example .env
```

Example `.env` values:

```env
HOST=0.0.0.0
PORT=8080
LAB_DATA_DIR=/app/data
```

Deploy:

```bash
docker compose up --build -d
```

## CI/CD

The repository includes GitHub Actions workflows modeled after the Dokuru and rifuki.dev stacks:

- `Quality Gate`: runs Bun install, SvelteKit checks, production build, Compose config validation, and a Docker smoke build.
- `Build Dokuru Lab`: builds and publishes `ghcr.io/rifuki/dokuru-lab:latest`, `ghcr.io/rifuki/dokuru-lab:v<version>`, and `ghcr.io/rifuki/dokuru-lab:sha-<short-commit>` on `main`.
- `Deploy Compose Service`: reusable SSH deploy workflow that pulls the published image on the VPS and runs `docker compose -f docker-compose.yaml up -d --no-build`.

The browser lab uses:

- `wss://lab.dokuru.rifuki.dev/ws/monitor` for live namespace and cgroup metrics.
- `wss://lab.dokuru.rifuki.dev/ws/terminal` for real stdout/stderr from commands and pressure tests.
- `wss://lab.dokuru.rifuki.dev/ws/customer` for real checkout latency samples against `victim-checkout`.

Set these repository variables for automatic deployment from `main`:

```text
DOKURU_LAB_DEPLOY_HOST
DOKURU_LAB_DEPLOY_USER
DOKURU_LAB_DEPLOY_PATH
```

Set this repository secret:

```text
DOKURU_LAB_DEPLOY_SSH_KEY
```

Optional values:

```text
DOKURU_LAB_DEPLOY_PORT
DOKURU_LAB_GHCR_TOKEN
```

The deploy workflow also accepts the Dokuru-compatible fallback names `DOKURU_DEPLOY_*` and `DOKURU_GHCR_TOKEN`.

## API Payloads

User namespace evidence:

```bash
curl -X POST http://localhost:8080/api/exec \
  -H 'content-type: application/json' \
  -d '{"command":"id; cat /proc/self/uid_map; cat /proc/self/gid_map"}'
```

PID namespace evidence:

```bash
curl -X POST http://localhost:8080/api/exec \
  -H 'content-type: application/json' \
  -d '{"command":"ps -eo pid,ppid,user,comm | head -40"}'
```

PIDs cgroup pressure:

```bash
curl -X POST http://localhost:8080/api/pid-bomb \
  -H 'content-type: application/json' \
  -d '{"count":120}'
curl -X POST http://localhost:8080/api/cleanup
```

Memory cgroup pressure:

```bash
curl -X POST http://localhost:8080/api/memory-bomb \
  -H 'content-type: application/json' \
  -d '{"mb":128}'
```

CPU cgroup pressure:

```bash
curl -X POST http://localhost:8080/api/cpu-burn \
  -H 'content-type: application/json' \
  -d '{"seconds":5}'
```

Blast-radius terminal actions are available from the browser UI over `/ws/terminal`:

- `cpu-blast`: spawn 4 short-lived CPU miners and watch Customer Live View latency.
- `memory-bomb` with `mb=1280`: push host memory pressure before rule 5.11 is fixed.
- `steal-secrets`: find postgres neighbor PID and read `/proc/<pid>/environ`.
- `sabotage-proxy`: briefly `SIGSTOP` caddy, with automatic `SIGCONT` recovery.

## Dokuru Validation Flow

1. Deploy the hosted lab with `docker compose up --build -d`.
2. Trigger namespace and cgroup payloads from the browser.
3. Run the Dokuru audit from the VPS agent.
4. Show failing rules for namespace and cgroup controls.
5. Apply Dokuru hardening fixes.
6. Re-run the audit.
7. Trigger the same payloads again.
8. Show that host namespaces are no longer visible and resource pressure is constrained.

## Repository Hygiene

This repo tracks only source, configuration, and documentation. Generated build output, dependencies, local data, and environment files are ignored.
