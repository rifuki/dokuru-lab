# Dokuru Lab

Dokuru Lab is a deliberately vulnerable SvelteKit application for demonstrating Docker namespace isolation and cgroup controls before and after Dokuru hardening.

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

## Docker Lab Mode

```bash
docker compose up --build
```

The default Compose file intentionally starts the app with unsafe runtime settings:

- `pid: host`
- `ipc: host`
- `uts: host`
- `userns_mode: host`
- no memory limit
- no CPU shares
- no PIDs limit

These settings make Dokuru namespace and cgroup audit findings visible before hardening.

## Network Namespace Demo

Use the network-host Compose file only for the SSRF demo:

```bash
docker compose -f docker-compose.network-host.yml up --build
```

Start a host-only HTTP service:

```bash
python3 -m http.server 9999 --bind 127.0.0.1
```

Then trigger the browser SSRF control or call the API directly:

```bash
curl -X POST http://localhost:8080/api/fetch-url \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9999/"}'
```

Before rule `5.10` is fixed, the request succeeds. After network namespace isolation is restored, the same request fails.

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

## Dokuru Demo Flow

1. Run the app with the default insecure Compose file.
2. Trigger namespace and cgroup payloads from the browser.
3. Run the Dokuru audit from the VPS agent.
4. Show failing rules for namespace and cgroup controls.
5. Apply Dokuru hardening fixes.
6. Re-run the audit.
7. Trigger the same payloads again.
8. Show that host namespaces are no longer visible and resource abuse is constrained.

## Repository Hygiene

This repo tracks only source, configuration, and documentation. Generated build output, dependencies, local data, and environment files are ignored.
