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

## Hosted Baseline Deployment

The Compose file runs Caddy and the intentionally vulnerable baseline app on a dedicated VPS.

Caddy terminates HTTPS for `lab.dokuru.rifuki.dev` and proxies to `dokuru-lab:8080`.
The app intentionally uses Docker's default isolation posture:

- no `pid: host`, `ipc: host`, `uts: host`, or `userns_mode: host`
- no extra Linux capabilities
- no `security_opt`
- no memory, CPU, or PIDs limits on the vulnerable app
- bind mounts for `./uploads`, `./logs`, and read-only `./config`

This setup demonstrates two default Docker gaps: container root writes bind-mounted files as host root when user namespace remap is disabled, and an unconstrained container can still consume host resources without cgroup limits. Caddy and neighbor services keep normal resource limits so the audit noise stays focused on `dokuru-lab`.

The baseline lab adds neighbor services in the same Compose stack so the demo can show cross-container blast radius, not only introspection:

- `checkout-api`: healthy customer-facing API used by Customer Live View.
- `customer-db`: PostgreSQL neighbor with demo customer records for post-compromise host-side proof.
- `latency-probe`: background curl loop that writes real customer latency to `./data/latency-probe.log` for the UI.

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
LAB_UPLOAD_DIR=/app/uploads
LAB_LOG_DIR=/app/logs
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
- `wss://lab.dokuru.rifuki.dev/ws/terminal` for real stdout/stderr from commands and pressure tests. The terminal also forwards stdin to the active interactive `exec` command, so a browser operator can answer prompts without leaving the lab page.
- `wss://lab.dokuru.rifuki.dev/ws/customer` for real checkout latency samples against `checkout-api`.

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

## API Payloads

Repeatable demo setup:

```bash
curl -X POST http://localhost:8080/api/demo/seed
curl -X POST http://localhost:8080/api/demo/reset
```

Command injection RCE:

```bash
curl 'http://localhost:8080/api/ping?host=127.0.0.1;id;cat%20/proc/self/uid_map'
```

File upload userns gap:

```bash
printf 'ownership proof\n' > /tmp/ownership-proof.txt
curl -X POST http://localhost:8080/api/upload \
  -F 'file=@/tmp/ownership-proof.txt'
```

App data dump:

```bash
curl -X POST http://localhost:8080/api/demo/dump
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

Unified cgroup stress endpoint:

```bash
curl -X POST 'http://localhost:8080/api/stress?type=fork&duration=15'
curl -X POST 'http://localhost:8080/api/stress?type=memory&duration=15'
curl -X POST 'http://localhost:8080/api/stress?type=cpu&duration=15'
```

Controlled ransomware/reset demo:

```bash
curl -X POST http://localhost:8080/api/exploit/ransomware
curl -X POST http://localhost:8080/api/demo/reset
```

Blast-radius terminal actions are available from the browser UI over `/ws/terminal`:

- `cpu-blast`: spawn 4 short-lived CPU miners and watch Customer Live View latency.
- `memory-bomb` with `mb=3072`: push host memory pressure before rule 5.11 is fixed.

Browser helper buttons write their structured JSON result into the card that triggered the action and also append the request/result to the global terminal timeline. The global terminal is the source of truth for stdout/stderr/stdin during a demo; card output is kept as a compact per-scenario summary.

The main browser flow intentionally avoids host-shell claims. The command injection endpoint represents a CVE-backed vulnerability class; the Docker baseline evidence is the UID map, host-root bind-mounted file ownership, app data compromise, and unconstrained cgroup pressure.

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
