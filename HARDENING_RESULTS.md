# Hardening Results — Dokuru Lab

**Target:** `lab1.dokuru.static.ninja` (dokuru-lab)
**Scope:** Only the scenarios exposed by the lab's control deck — A0 command injection, B1 bind marker, B2 SUID trap, B3 setcap trap, PIDs / Memory / CPU pressure, root mapping proof, and the Dump / Encrypt / Restore app-data buttons.
**Last live check:** 2026-05-14 (T4 fully hardened state)

> **Update 2026-05-14 (T4 final):** lab `lab1` sekarang **fully hardened** dengan skor audit Dokuru **100 / 100** (39/39 PASS). Kelima aturan *scope* penelitian (2.10, 4.1, 5.11, 5.12, 5.29) seluruhnya **PASS**. *Before-state* yang disajikan di dokumen ini bersifat historis (T0, 2026-05-11). *After-state* aktual didokumentasikan di `../skripsi/progress-log.md` "Update 2026-05-14 (T4)" dan `../skripsi/bab4-draft.md` §4.6d. Detail *journey* T0 → T4 ada di `../skripsi/bab4-draft.md` §4.6 sampai §4.8.

---

## Where This Document Starts and Stops

This file records the **before / after** shape of the container for the scenarios the lab actually exposes. Anything that is not wired into `ControlDeck.svelte` (SSH key plant, `/etc/shadow` exfiltration, neighbor-Postgres credential theft, cross-container ransomware chain, "infrastructure compromise in 90 seconds") is **not claimed here** and should not be claimed in the defense. The blast radius this lab is designed to demonstrate is the **container-root → host-root file ownership gap** plus **cgroup absence**, not full host takeover.

## Current State on `lab1.dokuru.static.ninja` (2026-05-11)

Live from `POST /api/upload` and `GET /api/ping?host=127.0.0.1;id;cat /proc/self/uid_map`:

```json
{
  "id": "uid=0(root) gid=0(root) groups=0(root)",
  "uid_map": "0          0 4294967295",
  "gid_map": "0          0 4294967295",
  "user_namespace": "user:[4026531837]",
  "cgroup": {
    "pids_max": "2268",
    "memory_max": "max",
    "cpu_weight": "100",
    "cpu_max": "max 100000"
  }
}
```

All five CIS rules in scope are currently **FAIL**. Dokuru hardening has not been applied to this deployment at the time of writing. The numbers below therefore describe what changes when hardening is applied to a container of this shape, based on the rules in the audit registry and the direct observations we have from the `dokuru-lab-baseline` trial run on a separate VPS.

| CIS Rule | Before (lab1 now) | After hardening target |
|---|---|---|
| 2.10 — Userns remap | `uid_map: 0 0 4294967295` (identity) | `uid_map: 0 100000 65536` (remapped) |
| 4.1 — Non-root user | UID 0 | Declared `USER` in image, typically UID 1001 |
| 5.11 — Memory limit | `memory_max: max` | `memory_max: 268435456` (256 MiB example) |
| 5.12 — CPU weight | `cpu_weight: 100`, `cpu_max: max 100000` | `cpu_weight: 59`, `cpu_max` set when a quota is desired |
| 5.29 — PIDs limit | `pids_max: 2268` (host default) | `pids_max: 100` |

## Per-Scenario Expectation (hardening on vs off)

Each row describes the same endpoint called in both states.

### A0 — Command Injection

- **Before:** Output contains `uid=0(root)`. Container is in the init user namespace.
- **After (rule 4.1):** Output contains the non-root UID configured on the image (e.g. `uid=1001`). The app bug is **not fixed** — command injection is still a real RCE, it just runs as an unprivileged user.

### B1 — Bind marker (upload)

- **Before:** `owner: "0:0 -rwxr-xr-x"` on the host. Host root owns the file.
- **After (rule 2.10):** `owner` shows the remapped host UID (e.g. `100000 100000` when `/etc/subuid` maps from 100000). File is unprivileged on the host.

### B2 — SUID trap

- **Before:** `stat: -rwsr-xr-x 4755 0:0 root:root`, `userns_remap_active: false`, `expected_impact: DANGEROUS`. A host-local unprivileged user running the planted binary would gain EUID 0.
- **After (rule 2.10 + 4.1):** `stat` shows the remapped UID owner. `userns_remap_active: true`. The SUID bit on a file owned by an unprivileged remapped UID does not confer host root, so the planted binary is inert from a host-shell escalation perspective.

### B3 — Setcap trap

- **Before:** `setcap_error: null`, capabilities applied (`cap_net_admin,cap_net_raw,cap_net_bind_service=ep`). The container is in `init_user_ns` and has CAP_SETFCAP in that namespace.
- **After (rule 2.10):** `setcap_error` is a non-null kernel error such as `Operation not permitted`. The container's user namespace no longer carries CAP_SETFCAP in `init_user_ns`, so the attribute write is rejected.

### Resource pressure — PIDs / Memory / CPU

- **Before:** `pids_max: 2268`, `memory_max: max`, `cpu_weight: 100`. All three pressure endpoints can consume host-scoped resources until host limits kick in.
- **After (rules 5.11 / 5.12 / 5.29):**
  - `POST /api/pid-bomb` with `count=150` is bounded by `pids_max: 100` (request count can be sent, but the cgroup refuses to create new tasks past the cap).
  - `POST /api/memory-bomb` with `mb=512` is OOM-killed by the cgroup once it crosses the container memory limit. `mb=128` fits.
  - `POST /api/cpu-burn` still spawns miners, but scheduler weight 59 yields CPU time to neighbors instead of monopolising cores.

### Root mapping proof

- **Before:** `cat /proc/self/uid_map` returns `0          0 4294967295`.
- **After (rule 2.10):** `cat /proc/self/uid_map` returns `0     100000      65536`. This is the single most direct piece of evidence that hardening landed.

### App data scope — Dump / Encrypt / Restore

- **Before:** App data (customer JSON, invoices) is readable and writable by the container's root. Encrypt / Restore round-trip works.
- **After:** App data is **still readable and writable by the application user**. Hardening does not fix application-level authorization. This is the "honest boundary" the UI already labels: app-layer impact remains.

## What Hardening Changes vs What It Does Not

Hardening at the Docker layer changes:

- Container filesystem ownership on bind mounts (rule 2.10).
- Privilege the container process carries after an in-container RCE (rule 4.1).
- Whether planted SUID and file-capability primitives survive on the host in a usable form (rules 2.10 + 4.1 combined).
- Whether the container can starve the host for CPU, memory, or PIDs (rules 5.11, 5.12, 5.29).

Hardening at the Docker layer does not change:

- That command injection still exists in the application.
- That a successful RCE can still read and tamper with data the application user owns.
- That `customer-db` is still reachable on the Docker network.

## Current Gap on lab1

At the time of this document, the `lab1.dokuru.static.ninja` deployment has **no hardening applied**. All five rules above are FAIL. If the intent is to demonstrate a before/after on this exact domain, Dokuru still needs to apply:

- `userns-remap=default` in the daemon (rule 2.10) and restart.
- A non-root `USER` in the image or a `user:` entry in Compose (rule 4.1).
- `mem_limit` (rule 5.11).
- `cpu_shares` or a Compose-level CPU shares value (rule 5.12).
- `pids_limit` (rule 5.29).

Once applied, the sections above describe what each scenario's response should look like, and the same endpoints can be re-run against the hardened container to collect after-state evidence without changing the scope of the demo.
