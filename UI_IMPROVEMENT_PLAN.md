# UI Improvement Plan - Dokuru Lab

**Date:** 2026-05-08  
**Priority:** HIGH (untuk demo sidang)  
**Estimated Effort:** 2-3 hours

---

## Overview

Berdasarkan review UI, ada beberapa masalah yang membuat demo **kurang jelas** untuk penguji:
1. ❌ Host resource info tidak ditampilkan (CPU cores, memory total, usage %)
2. ❌ Istilah membingungkan ("Memory Sandbox", "NO CPU QUOTA")
3. ❌ Impact attack tidak terlihat jelas (active burners always 0)
4. ❌ Namespace Isolation page posisi salah (harusnya di bawah/Evidence)

---

## Changes Required

### ✅ **PRIORITY 1: Monitor Page - Add Host Resource Info**

**File:** `src/routes/monitor/+page.svelte`

**Current State:**
```svelte
<!-- CPU Throttling Card -->
<div class="card">
  <h3>CPU Throttling</h3>
  <p>Quota status: NO CPU QUOTA</p>
  <p>cpu.weight: 59</p>
  <p>cpu.max: max 100000</p>
  <p>Active burners: 0</p>
</div>
```

**Target State:**
```svelte
<!-- CPU Throttling Card -->
<div class="card">
  <h3>CPU Throttling</h3>
  
  <!-- Host Info (NEW) -->
  <div class="host-info">
    <h4>Host Resources</h4>
    <p>Total cores: {hostCpuCores}</p>
    <p>Current usage: {hostCpuUsage}%</p>
  </div>
  
  <!-- Container Limits -->
  <div class="container-limits">
    <h4>Container Limits</h4>
    <p>Quota status: {cpuQuotaStatus}</p> <!-- "UNLIMITED" or "LIMITED" -->
    <p>cpu.weight: {cpuWeight}</p>
    <p>cpu.max: {cpuMax}</p>
    <p>Active burners: {activeBurners}</p> <!-- Real-time count -->
  </div>
</div>
```

**Backend Changes Required:**

**File:** `src/lib/server/lab.ts`

Add function:
```typescript
export function getHostResourceInfo(): {
  cpu_cores: number;
  cpu_usage_percent: number;
  memory_total_gb: number;
  memory_available_gb: number;
} {
  const cpuCores = cpus().length;
  
  // Get CPU usage via /proc/stat or top
  const cpuUsage = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1")
    .toString()
    .trim();
  
  // Get memory info
  const memInfo = execSync("free -g | grep Mem | awk '{print $2,$7}'")
    .toString()
    .trim()
    .split(' ');
  
  return {
    cpu_cores: cpuCores,
    cpu_usage_percent: parseFloat(cpuUsage) || 0,
    memory_total_gb: parseInt(memInfo[0]) || 0,
    memory_available_gb: parseInt(memInfo[1]) || 0
  };
}
```

**File:** `src/routes/api/monitor/host/+server.ts` (NEW)

```typescript
import { json } from '@sveltejs/kit';
import { getHostResourceInfo } from '$lib/server/lab';

export function GET() {
  return json(getHostResourceInfo());
}
```

**Frontend Integration:**

```svelte
<script lang="ts">
  let hostInfo = { cpu_cores: 0, cpu_usage_percent: 0, memory_total_gb: 0, memory_available_gb: 0 };
  
  async function fetchHostInfo() {
    const res = await fetch('/api/monitor/host');
    hostInfo = await res.json();
  }
  
  onMount(() => {
    fetchHostInfo();
    const interval = setInterval(fetchHostInfo, 2000); // Update every 2s
    return () => clearInterval(interval);
  });
</script>
```

---

### ✅ **PRIORITY 2: Fix Terminology**

**Changes:**

| Current | New | Reason |
|---|---|---|
| "Memory Sandbox" | "Memory Limit" | Clearer terminology |
| "NO CPU QUOTA" | "UNLIMITED" | Less confusing |
| "Quota status" | "Limit status" | Consistent with "Memory Limit" |

**Files to Update:**
- `src/routes/monitor/+page.svelte`
- `src/lib/components/organisms/MonitorPanel.svelte` (if exists)

**Find & Replace:**
```bash
# In dokuru-lab/src/
sed -i 's/Memory Sandbox/Memory Limit/g' **/*.svelte
sed -i 's/NO CPU QUOTA/UNLIMITED/g' **/*.svelte
sed -i 's/Quota status/Limit status/g' **/*.svelte
```

---

### ✅ **PRIORITY 3: Show Active Burners Count**

**Current Issue:** `Active burners: 0` always, even during attack

**Root Cause:** Backend tidak track active CPU burner processes

**Fix:**

**File:** `src/lib/server/lab.ts`

Update `cgroupEvidence()`:
```typescript
export function cgroupEvidence(): CgroupEvidence {
  // ... existing code ...
  
  // Count active CPU burners (NEW)
  const activeBurners = execSync("ps aux | grep 'dokuru_cpu_burn' | grep -v grep | wc -l")
    .toString()
    .trim();
  
  return {
    pids_current,
    pids_max,
    memory_current,
    memory_max,
    cpu_weight,
    cpu_max,
    cpu_shares_v1,
    active_cpu_burners: parseInt(activeBurners) || 0 // NEW
  };
}
```

**File:** `src/lib/types/lab.ts`

Update type:
```typescript
export interface CgroupEvidence {
  pids_current: string;
  pids_max: string;
  memory_current: string;
  memory_max: string;
  cpu_weight: string;
  cpu_max: string;
  cpu_shares_v1: string;
  active_cpu_burners: number; // NEW
}
```

**Frontend:** Use `cgroup.active_cpu_burners` instead of hardcoded 0

---

### ✅ **PRIORITY 4: Memory Card - Add Host Total**

**File:** `src/routes/monitor/+page.svelte`

**Current:**
```svelte
<div class="memory-card">
  <h3>Memory Sandbox</h3>
  <p>Current: 126 MiB</p>
  <p>Memory limit: 256 MiB</p>
</div>
```

**Target:**
```svelte
<div class="memory-card">
  <h3>Memory Limit</h3>
  
  <!-- Host Info (NEW) -->
  <div class="host-info">
    <h4>Host Memory</h4>
    <p>Total: {hostInfo.memory_total_gb} GB</p>
    <p>Available: {hostInfo.memory_available_gb} GB</p>
  </div>
  
  <!-- Container Usage -->
  <div class="container-usage">
    <h4>Container Usage</h4>
    <p>Current: {formatBytes(memoryCurrent)}</p>
    <p>Limit: {formatBytes(memoryMax)}</p>
    <p>Usage: {Math.round(memoryCurrent / memoryMax * 100)}%</p>
  </div>
</div>
```

---

### ✅ **PRIORITY 5: Move Namespace Isolation Page**

**Current:** Namespace page di tengah-tengah flow demo

**Target:** Pindah ke bawah atau jadikan collapsible

**Option A: Move to Bottom**

**File:** `src/routes/namespace/+page.svelte`

Add banner at top:
```svelte
<div class="info-banner">
  ℹ️ This page shows technical evidence for namespace isolation.
  For demo scenarios, go to <a href="/scenarios">Scenarios</a> tab.
</div>
```

**Option B: Make Collapsible in Monitor Page**

**File:** `src/routes/monitor/+page.svelte`

```svelte
<details class="technical-evidence">
  <summary>🔍 Show Technical Evidence (Namespace Isolation)</summary>
  
  <div class="namespace-proof">
    <!-- Move namespace content here -->
  </div>
</details>
```

**Recommendation:** Use **Option B** (collapsible) untuk demo flow yang lebih smooth.

---

### ✅ **PRIORITY 6: Add Visual Status Indicators**

**File:** `src/lib/components/atoms/StatusBadge.svelte` (NEW)

```svelte
<script lang="ts">
  export let status: 'healthy' | 'warning' | 'critical';
  
  const colors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500'
  };
  
  const icons = {
    healthy: '🟢',
    warning: '⚠️',
    critical: '🔴'
  };
</script>

<span class="status-badge {colors[status]}">
  {icons[status]} {status.toUpperCase()}
</span>
```

**Usage in Monitor Page:**

```svelte
<StatusBadge status={cpuUsage > 80 ? 'critical' : cpuUsage > 50 ? 'warning' : 'healthy'} />
```

---

## Implementation Checklist

### Phase 1: Backend (30 min)
- [ ] Add `getHostResourceInfo()` to `src/lib/server/lab.ts`
- [ ] Create `/api/monitor/host/+server.ts` endpoint
- [ ] Update `cgroupEvidence()` to count active burners
- [ ] Update `CgroupEvidence` type definition

### Phase 2: Frontend - Monitor Page (45 min)
- [ ] Add host resource info cards (CPU + Memory)
- [ ] Fix terminology (Memory Sandbox → Memory Limit, etc.)
- [ ] Show active burners count (real-time)
- [ ] Add percentage usage indicators
- [ ] Add visual status badges

### Phase 3: Namespace Page (15 min)
- [ ] Make namespace isolation collapsible in Monitor page
- [ ] OR add info banner if keeping separate page

### Phase 4: Testing (30 min)
- [ ] Test host resource info updates every 2s
- [ ] Test active burners count during cryptominer attack
- [ ] Test memory usage percentage calculation
- [ ] Test visual indicators change during attack
- [ ] Test on VPS with real resource pressure

### Phase 5: Deploy (15 min)
- [ ] Commit changes
- [ ] Push to GitHub (auto-deploy via CI/CD)
- [ ] Verify on `https://lab.dokuru.rifuki.dev`
- [ ] Test full demo flow

**Total Estimated Time:** ~2.5 hours

---

## Testing Scenarios

### Test 1: Host Resource Info
```bash
# Before attack
curl https://lab.dokuru.rifuki.dev/api/monitor/host
# Expected: { cpu_cores: 2, cpu_usage_percent: 15, memory_total_gb: 4, memory_available_gb: 3 }

# During cryptominer attack
curl -X POST https://lab.dokuru.rifuki.dev/api/cpu-burn -d '{"seconds":30}'
curl https://lab.dokuru.rifuki.dev/api/monitor/host
# Expected: { cpu_cores: 2, cpu_usage_percent: 95, ... }
```

### Test 2: Active Burners Count
```bash
# Before attack
# Monitor page shows: Active burners: 0

# During attack
curl -X POST https://lab.dokuru.rifuki.dev/api/cpu-burn -d '{"seconds":30}'
# Monitor page shows: Active burners: 4

# After cleanup
curl -X POST https://lab.dokuru.rifuki.dev/api/cleanup
# Monitor page shows: Active burners: 0
```

### Test 3: Memory Usage Percentage
```bash
# Before memory bomb
# Monitor shows: 126 MB / 256 MB (49%)

# During memory bomb
curl -X POST https://lab.dokuru.rifuki.dev/api/memory-bomb -d '{"mb":200}'
# Monitor shows: 200 MB / 256 MB (78%)
```

---

## Visual Mockup

### Before (Current):
```
┌─────────────────────────────────┐
│ CPU Throttling                  │
│ Quota status: NO CPU QUOTA      │
│ cpu.weight: 59                  │
│ Active burners: 0               │
└─────────────────────────────────┘
```

### After (Target):
```
┌─────────────────────────────────┐
│ CPU Throttling            🟢 OK │
│                                 │
│ Host Resources:                 │
│ • Total cores: 2                │
│ • Current usage: 15%            │
│                                 │
│ Container Limits:               │
│ • Status: UNLIMITED             │
│ • cpu.weight: 59                │
│ • Active burners: 0 → 4         │
└─────────────────────────────────┘
```

---

## Notes for AI Implementer

### Important:
1. **Don't break existing functionality** - add new features incrementally
2. **Test on VPS** - local dev might not show real CPU/memory pressure
3. **Keep WebSocket updates** - host info should update every 2s via `/ws/monitor`
4. **Handle errors gracefully** - if `top` or `free` command fails, show "N/A"

### Optional Enhancements (if time permits):
- [ ] Add sparkline charts for CPU/memory history
- [ ] Add "Before/After Hardening" comparison toggle
- [ ] Add export evidence button (screenshot/PDF)

---

## Success Criteria

Demo dianggap **READY** jika:
- ✅ Host CPU cores & usage % visible
- ✅ Host memory total & available visible
- ✅ Active burners count updates during attack
- ✅ Terminology clear (no "Memory Sandbox", "NO CPU QUOTA")
- ✅ Visual indicators show attack status
- ✅ Namespace page tidak menghalangi demo flow

---

**Status:** 🟡 **READY TO IMPLEMENT**

**Assigned to:** AI Implementer (next session)

**Deadline:** Before sidang (ASAP)
