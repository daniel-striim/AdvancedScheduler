# AdvancedScheduler: Striim Application Scheduling Adapter

AdvancedScheduler is a Striim Source adapter that provides flexible, JSON-based scheduling for managing when and how many Striim applications run simultaneously.

## What is AdvancedScheduler?

AdvancedScheduler is a scheduling adapter designed to control Striim applications based on time windows, concurrency limits, and advanced scheduling rules. It solves the problem of resource spikes when multiple applications (like IncrementalBatchReader apps) start simultaneously, causing memory heap issues.

### Key Features

- Time-window scheduling (daily, weekly, monthly, custom)
- Max concurrent limits (global and per-group)
- Staggered starts to prevent resource spikes
- Cron expression support
- Application dependencies and exclusions
- Completion-based dependencies (hierarchy support)
- Blackout windows
- Priority-based ordering
- Wildcard pattern matching
- Multi-timezone support
- Configurable end actions (stop, quiesce, undeploy)
- Run-until-complete mode

---

## Installation

### Step 1: Download the JAR file

Get the `AdvancedScheduler.jar` for your appropriate Striim version (Striim 5.2.X needs AdvancedScheduler-5.2.0.jar)

### Step 1.5: Unload existing Open Processor (Optional)

In Striim Console, run `list libraries;` - if you see AdvancedScheduler, unload it first:

```sql
UNLOAD OPEN PROCESSOR 'UploadedFiles/AdvancedScheduler-5.2.0.jar';
```

### Step 2: Upload the Open Processor via the UI

Upload `AdvancedScheduler.jar` to your Files in the UI (Manage Striim → Files).

> **Note:** Do not load it on the Striim server backend, as this may not provide the right file ownership and/or permissions.

### Step 3: Run the LOAD command in console

```sql
LOAD OPEN PROCESSOR 'UploadedFiles/AdvancedScheduler-5.2.0.jar';
```

Verify with `list libraries;` to confirm AdvancedScheduler is loaded.

### Step 4: Create a Scheduler Application

Create a new app with a 'Source' component, selecting AdvancedScheduler as the adapter type.

---

## JSON Configuration Schema

The `Schedules` property accepts EITHER:
- **Inline JSON** - paste JSON directly (auto-detected by starting with `[` or `{`)
- **File Path** - path to `.json` file (auto-detected by ending with `.json`)

### Configuration Structure

The JSON configuration has two levels:

```json
{
  "global": { /* optional global settings */ },
  "schedules": [ /* array of app schedules */ ]
}
```

**Simplified format** - If you don't need global settings, just use an array:

```json
[ /* array of app schedules */ ]
```

### Global Settings

| Property | Type | Description |
|----------|------|-------------|
| `maxConcurrentApps` | integer | Maximum apps running cluster-wide at any time |
| `maxConcurrentPerGroup` | object | Max per group: `{"critical": 5, "normal": 10}` |
| `defaultTimezone` | string | Default timezone for all apps (e.g., 'America/Los_Angeles') |
| `defaultStaggerSeconds` | integer | Seconds between app starts to prevent spikes |
| `blackoutWindows` | array | Time windows where NO apps should run |
| `retryPolicy` | object | Retry on failure: maxRetries, retryDelaySeconds, backoffMultiplier |

### App Schedule Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `app` | string | ✅ | Fully qualified app name: namespace.appName (supports `*` wildcard) |
| `enabled` | boolean | | Enable/disable without removing (default: true) |
| `windows` | array | ✅* | Time windows when app should run |
| `cron` | string | ✅* | Cron expression (alternative to windows) |
| `runDuration` | string | | How long to run after cron trigger: "2h", "30m", "1h30m" |
| `timezone` | string | | Override global timezone for this app |
| `priority` | integer | | Higher = starts first when limited (default: 0) |
| `group` | string | | Group name for per-group concurrency limits |
| `dependsOn` | array | | Apps that must be RUNNING before this app starts |
| `dependsOnCompleted` | array | | Apps that must have COMPLETED before this app starts |
| `exclusiveWith` | array | | Apps that cannot run simultaneously with this app |
| `tags` | array | | Tags for filtering and grouping |
| `runUntilComplete` | boolean | | If true, don't stop at end time - let app complete (default: false) |
| `endAction` | string | | Action at end time: STOP, QUIESCE, UNDEPLOY, STOP_UNDEPLOY (default: STOP) |

*Either `windows` or `cron` is required

### Time Window Properties

| Property | Type | Description |
|----------|------|-------------|
| `start` | string | Start time HH:MM (24-hour format) - **required** |
| `end` | string | End time HH:MM (24-hour format) - **optional** (if omitted, app runs indefinitely) |
| `days` | array | Days of week: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] |
| `daysOfMonth` | array | Days of month: [1, 15, "LAST"] |
| `weekOfMonth` | array | Week of month: [1, 2, 3, 4, 5, "LAST"] |
| `months` | array | Months: ["JAN", "FEB", ... "DEC"] |
| `dates` | object | Date range: {"from": "2026-02-01", "to": "2026-02-28"} |

---

## Example Configurations

### Basic Time Windows

**Simple daily window:**

```json
[
  {"app": "prod.IBRCustomers", "windows": [{"start": "02:00", "end": "04:00"}]},
  {"app": "prod.IBROrders", "windows": [{"start": "02:00", "end": "04:00"}]}
]
```

**Weekday/Weekend split:**

```json
[
  {
    "app": "prod.IBRCustomers",
    "windows": [
      {"start": "02:00", "end": "04:00", "days": ["MON", "TUE", "WED", "THU", "FRI"]},
      {"start": "00:00", "end": "06:00", "days": ["SAT", "SUN"]}
    ]
  }
]
```

### Start Without End Time (Run Indefinitely)

When you want an app to start at a specific time and run until it naturally completes or is manually stopped:

```json
[
  {"app": "admin.BatchProcessor", "windows": [{"start": "02:00"}]}
]
```

The app starts at 02:00 and is NOT stopped by the scheduler - it runs until completion.

### Max Concurrent Limits

**Global max with groups and priorities:**

```json
{
  "global": {
    "maxConcurrentApps": 10,
    "maxConcurrentPerGroup": {"critical": 3, "normal": 5, "low": 2},
    "defaultStaggerSeconds": 30
  },
  "schedules": [
    {"app": "prod.IBRCritical1", "group": "critical", "priority": 100, "windows": [{"start": "02:00", "end": "06:00"}]},
    {"app": "prod.IBRNormal1", "group": "normal", "priority": 50, "windows": [{"start": "02:00", "end": "06:00"}]},
    {"app": "prod.IBRLow1", "group": "low", "priority": 10, "windows": [{"start": "02:00", "end": "06:00"}]}
  ]
}
```

### Cron Expressions

Cron format: `minute hour dayOfMonth month dayOfWeek`

```json
[
  {"app": "prod.IBRDaily", "cron": "0 2 * * *", "runDuration": "2h"},
  {"app": "prod.IBRWeekday", "cron": "0 3 * * MON-FRI", "runDuration": "1h30m"},
  {"app": "prod.IBRMonthEnd", "cron": "0 1 L * *", "runDuration": "4h"}
]
```

### Blackout Windows

```json
{
  "global": {
    "blackoutWindows": [
      {"start": "08:00", "end": "18:00", "days": ["MON", "TUE", "WED", "THU", "FRI"]},
      {"start": "00:00", "end": "23:59", "dates": {"from": "2026-12-24", "to": "2026-12-26"}}
    ]
  },
  "schedules": [
    {"app": "prod.IBR1", "windows": [{"start": "00:00", "end": "23:59"}]}
  ]
}
```

### Wildcard Patterns

```json
[
  {"app": "prod.IBR*", "windows": [{"start": "02:00", "end": "06:00"}]},
  {"app": "dev.*", "enabled": false}
]
```

### Completion Dependencies (Hierarchy)

When apps must wait for other apps to reach COMPLETED status before starting:

```json
[
  {"app": "admin.ETLPhase1", "windows": [{"start": "02:00"}]},
  {"app": "admin.ETLPhase2", "dependsOnCompleted": ["admin.ETLPhase1"], "windows": [{"start": "02:00"}]},
  {"app": "admin.ETLPhase3", "dependsOnCompleted": ["admin.ETLPhase2"], "windows": [{"start": "02:00"}]}
]
```

ETLPhase2 will not start until ETLPhase1 reaches COMPLETED status. ETLPhase3 waits for ETLPhase2 to complete.

### Run Until Complete Mode

Override the end time and let an app run to natural completion:

```json
[
  {
    "app": "admin.BatchJob",
    "runUntilComplete": true,
    "windows": [{"start": "02:00", "end": "04:00"}]
  }
]
```

The app starts at 02:00 but is NOT stopped at 04:00 - it continues running until it naturally completes.

### End Actions

Control what happens when a time window ends:

| End Action | Behavior |
|------------|----------|
| `STOP` | Quiesce then stop (default) |
| `QUIESCE` | Only quiesce, don't stop |
| `UNDEPLOY` | Stop then undeploy |
| `STOP_UNDEPLOY` | Quiesce, stop, then undeploy |

**Example - Undeploy at end of window:**

```json
[
  {
    "app": "admin.TempProcessor",
    "endAction": "UNDEPLOY",
    "windows": [{"start": "02:00", "end": "06:00"}]
  }
]
```

**Example - Full cleanup (stop and undeploy):**

```json
[
  {
    "app": "admin.TempProcessor",
    "endAction": "STOP_UNDEPLOY",
    "windows": [{"start": "02:00", "end": "06:00"}]
  }
]
```

---

## TQL Usage Examples

### Basic Setup with Inline JSON

```sql
CREATE APPLICATION SchedulerApp;

CREATE TYPE SchedulerEventType (
    eventType java.lang.String,
    appName java.lang.String,
    message java.lang.String,
    timestamp java.lang.Long,
    groupName java.lang.String,
    priority java.lang.Integer
);

CREATE STREAM SchedulerEvents OF SchedulerEventType;

CREATE SOURCE AppScheduler USING Global.AdvancedScheduler VERSION '1.0.0' (
    Schedules: '[
        {"app": "admin.testcq", "windows": [{"start": "10:00", "end": "18:00"}]}
    ]',
    TimeZone: 'America/Los_Angeles',
    CheckIntervalSeconds: 15
)
OUTPUT TO SchedulerEvents;

END APPLICATION SchedulerApp;
```

### Using External JSON File

```sql
CREATE SOURCE AppScheduler USING Global.AdvancedScheduler VERSION '1.0.0' (
    Schedules: '/opt/striim/schedules/app-schedules.json',
    TimeZone: 'America/Los_Angeles',
    CheckIntervalSeconds: 30,
    StaggerStartSeconds: 60
)
OUTPUT TO SchedulerEvents;
```

### Advanced Example with New Features

```sql
CREATE SOURCE AppScheduler USING Global.AdvancedScheduler VERSION '1.0.0' (
    Schedules: '[
        {"app": "admin.ETLPhase1", "windows": [{"start": "02:00"}]},
        {"app": "admin.ETLPhase2", "dependsOnCompleted": ["admin.ETLPhase1"], "windows": [{"start": "02:00"}]},
        {"app": "admin.TempJob", "endAction": "UNDEPLOY", "windows": [{"start": "03:00", "end": "05:00"}]},
        {"app": "admin.BatchProcess", "runUntilComplete": true, "windows": [{"start": "04:00", "end": "06:00"}]}
    ]',
    TimeZone: 'America/Los_Angeles',
    CheckIntervalSeconds: 15
)
OUTPUT TO SchedulerEvents;
```

---

## Source Adapter Properties

| Property | Default | Description |
|----------|---------|-------------|
| `Schedules` | *(required)* | Inline JSON or path to .json file with schedule configuration |
| `TimeZone` | America/Los_Angeles | Default timezone for schedule evaluation |
| `CheckIntervalSeconds` | 30 | How often to evaluate schedules and start/stop apps |
| `StaggerStartSeconds` | 0 | Delay between starting multiple apps (overridden by JSON global setting) |

---

## Application State Handling

The scheduler intelligently handles various application states:

### Supported States

| State | Start Behavior | Stop Behavior |
|-------|----------------|---------------|
| CREATED | Deploy then start | N/A |
| DEPLOYED | Start | N/A |
| STOPPED | Start | N/A |
| QUIESCED | Start (not Resume) | N/A |
| RUNNING | No action (already running) | Quiesce then stop |
| COMPLETED | No action | No action |

### Transient States

The scheduler detects and waits for transient states before taking action:

- DEPLOYING
- STARTING
- VERIFYING_STARTING
- STARTING_SOURCES
- RECOVERING_SOURCES
- STOPPING
- QUIESCING
- APPROVING_QUIESCE
- FLUSHING

When an app is in a transient state, the scheduler logs a message and waits until the transition completes.

---

## Debugging

**Enable Debugging:**

```sql
set loglevel = {com.striim.scheduler.AdvancedScheduler: debug};
```

**Disable Debugging:**

```sql
set loglevel = {com.striim.scheduler.AdvancedScheduler: info};
```

**View Scheduler Logs:**

```bash
grep -i 'AdvancedScheduler' /opt/striim/logs/striim.server.log | tail -50
```

---

## Verified Features

All features have been tested and verified:

| Feature | Status | Notes |
|---------|--------|-------|
| Time window scheduling | ✅ | Apps start/stop based on time windows |
| Multi-app scheduling | ✅ | Multiple apps managed correctly |
| Staggered starts | ✅ | Configurable delay between app starts |
| Max concurrent limits | ✅ | Global and per-group limits enforced |
| Cron expressions | ✅ | Apps trigger at specific times with runDuration |
| Blackout windows | ✅ | No starts during blackout periods |
| Wildcard patterns | ✅ | `admin.*` matches multiple apps |
| Priority ordering | ✅ | Higher priority apps start first when limited |
| Start without end time | ✅ | Apps with no `end` time run indefinitely |
| Enhanced state checking | ✅ | Transient states detected, QUIESCED apps handled correctly |
| Completion dependencies | ✅ | `dependsOnCompleted` blocks start until deps complete |
| End actions | ✅ | `endAction` controls behavior at window end |
| RunUntilComplete | ✅ | `runUntilComplete: true` prevents stop at end time |

---

## Troubleshooting

### Application Not Starting

**Possible Causes:**
1. App is in a transient state - check logs for "transient state" messages
2. Dependencies not met - check `dependsOn` and `dependsOnCompleted` requirements
3. Max concurrent limit reached - check global and group limits
4. Outside time window - verify current time is within `start`/`end` window
5. Blackout window active - check global blackout configuration

### Application Not Stopping

**Possible Causes:**
1. `runUntilComplete: true` is set - app will run until natural completion
2. No `end` time specified - app runs indefinitely
3. App is already stopped or in transient state

### QUIESCED Apps Not Resuming

The scheduler uses START (not RESUME) for QUIESCED apps because Striim does not support RESUME from QUIESCED state.

---

## Web UI: Schedule Configuration Visualizer and Generator

AdvancedScheduler includes a web-based UI for visually managing schedule configurations. The UI provides:

- **Dashboard** - Overview of all schedules with timeline heatmap visualization
- **Schedule Editor** - Add/edit individual app schedules with form-based input
- **Global Settings** - Configure global limits, blackout windows, retry policies
- **App Discovery** - Browse and select apps from the Striim API
- **Auto-Balance** - Automatically generate balanced schedules across time windows

### Web UI Installation

#### Prerequisites

- Striim 5.x or later with Jetty web server enabled
- Access to the Striim server filesystem
- AdvancedScheduler JAR installed (see Installation section above)

#### Deployment Steps

1. **Copy the scheduler UI files to Striim's webui directory:**

   ```bash
   # Create the scheduler directory in Striim's webui folder
   sudo mkdir -p /opt/striim/webui/scheduler

   # Copy all UI files
   sudo cp -r scheduler/* /opt/striim/webui/scheduler/

   # Set proper ownership
   sudo chown -R striim:striim /opt/striim/webui/scheduler
   ```

2. **Verify the file structure:**

   ```bash
   ls -la /opt/striim/webui/scheduler/
   # Should show:
   # index.html
   # index.js
   # styles.css
   # schedule-editor.html
   # schedule-editor.js
   # global-settings.html
   # global-settings.js
   # app-discovery.html
   # app-discovery.js
   # utils/
   #   api.js
   #   config.js
   #   validation.js
   ```

3. **Access the UI:**

   Open your browser and navigate to:
   ```
   http://<striim-server>:9080/scheduler/
   ```

   For example: `http://10.138.0.38:9080/scheduler/`

#### GCP Deployment (Using gcloud)

For deploying to GCP VMs running Striim:

```bash
# 1. Create a tarball of the scheduler UI
cd java/OpenProcessors/AdvancedScheduler
tar -czf /tmp/scheduler-ui.tar.gz scheduler/

# 2. Copy to the GCP VM
gcloud compute scp /tmp/scheduler-ui.tar.gz <vm-name>:~/scheduler-ui.tar.gz \
    --zone=<zone> --project=<project> --internal-ip

# 3. SSH and deploy
gcloud compute ssh <vm-name> --zone=<zone> --project=<project> --internal-ip \
    --command="cd ~ && sudo rm -rf /opt/striim/webui/scheduler && \
               sudo tar -xzf scheduler-ui.tar.gz -C /opt/striim/webui/ && \
               sudo chown -R striim:striim /opt/striim/webui/scheduler && \
               echo 'Deployed successfully'"
```

**Example for striimfieldproject:**

```bash
# Deploy to fe-node-1-ubuntu
gcloud compute scp /tmp/scheduler-ui.tar.gz fe-node-1-ubuntu:~/scheduler-ui.tar.gz \
    --zone=us-west1-a --project=striimfieldproject --internal-ip

gcloud compute ssh fe-node-1-ubuntu --zone=us-west1-a --project=striimfieldproject --internal-ip \
    --command="cd ~ && sudo rm -rf /opt/striim/webui/scheduler && \
               sudo tar -xzf scheduler-ui.tar.gz -C /opt/striim/webui/ && \
               sudo chown -R striim:striim /opt/striim/webui/scheduler"
```

### Web UI Features

#### Dashboard

- **Stats Cards** - Total schedules, enabled/disabled counts, groups
- **Schedule Table** - Sortable list of all configured schedules
- **Timeline Heatmap** - Visual representation of schedule density throughout the day
  - Green = single app (no contention)
  - Yellow = moderate overlap
  - Red = high overlap (many concurrent apps)
- **Filters** - Filter by group, enabled status, or search by app name

#### Auto-Balance Strategies

The Auto-Balance feature provides three strategies for automatically distributing schedules:

| Strategy | Description |
|----------|-------------|
| **Even Spread** | Round-robin distribution across the time window |
| **Staggered Start** | All apps in same window but offset by configurable interval |
| **Multiple Times Daily** | Apps run N times per day with staggered starts and max concurrency control |

**Multiple Times Daily Parameters:**

| Parameter | Description |
|-----------|-------------|
| Times Per Day | 2, 3, 4, 6, 8, 12, or 24 times per day |
| Max Concurrent | Maximum apps running simultaneously (1-5) |
| First Start Time | When the first app starts each cycle |
| Stagger Interval | Auto-calculated or manual (15min, 30min, 1hr, 2hr) |

#### Schedule Editor

Form-based editor for individual schedules with:
- Application selection (dropdown or wildcard input)
- Time window configuration with visual day-of-week selector
- Cron expression input with validation
- Priority, group, and tag assignment
- Dependency configuration
- End action selection

#### App Discovery

- Connects to Striim API to list available applications
- Filter by namespace, status, or search
- One-click to create schedule for any app

### Web UI Authentication

The UI uses Striim's existing authentication:

1. **Cookie-based** - If you're logged into Striim, the UI uses your session
2. **Manual token** - Enter your API token via the login modal if needed

To get an API token:
```bash
curl -X POST "http://<striim>:9080/api/v2/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "your-password"}'
```

### Web UI Troubleshooting

#### Content Security Policy (CSP) Errors

**Symptom:** JavaScript not executing, console shows CSP errors.

**Cause:** Striim enforces `script-src 'self' 'unsafe-eval'` which blocks inline scripts.

**Solution:** All JavaScript must be in external `.js` files, not inline in HTML.

#### UI Not Loading

**Possible Causes:**
1. Files not in correct location - verify `/opt/striim/webui/scheduler/` exists
2. Wrong permissions - run `sudo chown -R striim:striim /opt/striim/webui/scheduler`
3. Striim not serving static files - check Jetty configuration

#### Authentication Issues

**Symptom:** API calls fail with 401 Unauthorized.

**Solution:**
1. Log into Striim main UI first to establish session
2. Or use the login modal to enter credentials manually
3. Check that cookies are enabled in your browser

#### Changes Not Appearing

**Solution:** Hard refresh the browser (`Cmd+Shift+R` on Mac, `Ctrl+Shift+R` on Windows/Linux) to clear cached files.

