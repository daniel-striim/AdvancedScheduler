# AdvancedScheduler

A flexible Striim source adapter that manages when and how many applications run simultaneously to prevent resource spikes and memory heap issues.

## Overview

The AdvancedScheduler is designed to address the challenge of managing multiple Striim applications (particularly IncrementalBatchReader apps) that can spike unpredictably and cause memory problems. It provides:

- **Time-window scheduling** - Run apps only during designated periods
- **Max concurrent limits** - Enforce global and per-group application limits
- **Staggered starts** - Prevent simultaneous resource spikes
- **Cron expressions** - Fine-grained scheduling using standard cron syntax
- **Dependencies** - Ensure apps run in proper order
- **Exclusions** - Prevent conflicting apps from running simultaneously
- **Blackout windows** - Define global periods where no apps should run
- **Priority-based scheduling** - Higher priority apps start first
- **Wildcard patterns** - Use patterns like `prod.IBR*` to match multiple apps

## Installation

1. Build the JAR:
   ```bash
   cd java/OpenProcessors/AdvancedScheduler
   mvn clean package
   ```

2. Deploy to Striim:
   ```bash
   cp target/AdvancedScheduler-*.jar $STRIIM_HOME/lib/
   ```

3. Restart Striim to load the adapter.

## Quick Start

### Simple Time Window

```sql
CREATE OR REPLACE SOURCE SimpleScheduler USING Global.AdvancedScheduler (
    Schedules: '[
        {"app": "prod.IBRCustomers", "windows": [{"start": "02:00", "end": "06:00"}]},
        {"app": "prod.IBROrders", "windows": [{"start": "02:00", "end": "06:00"}]}
    ]',
    TimeZone: 'America/Los_Angeles',
    CheckIntervalSeconds: 60
)
OUTPUT TO SchedulerEvents;
```

### Using External JSON File

```sql
CREATE OR REPLACE SOURCE FileScheduler USING Global.AdvancedScheduler (
    Schedules: '/opt/striim/config/app-schedules.json',
    TimeZone: 'America/Los_Angeles',
    CheckIntervalSeconds: 60
)
OUTPUT TO SchedulerEvents;
```

## Configuration Properties

| Property | Required | Default | Description |
|----------|----------|---------|-------------|
| `Schedules` | Yes | - | JSON configuration (inline or file path) |
| `TimeZone` | No | `UTC` | Default timezone for schedules (see [Supported Timezones](#supported-timezones)) |
| `CheckIntervalSeconds` | No | `60` | How often to check schedules |
| `StaggerStartSeconds` | No | `30` | Delay between app starts |

### Supported Timezones

Use IANA timezone identifiers for the `TimeZone` property:

| Region | Timezone Identifier | UTC Offset |
|--------|-------------------|------------|
| **UTC** | `UTC` | UTC+0 |
| **US - Pacific** | `America/Los_Angeles` | UTC-8/-7 (PST/PDT) |
| **US - Mountain** | `America/Denver` | UTC-7/-6 (MST/MDT) |
| **US - Central** | `America/Chicago` | UTC-6/-5 (CST/CDT) |
| **US - Eastern** | `America/New_York` | UTC-5/-4 (EST/EDT) |
| **Brazil** | `America/Sao_Paulo` | UTC-3/-2 |
| **UK** | `Europe/London` | UTC+0/+1 (GMT/BST) |
| **France** | `Europe/Paris` | UTC+1/+2 (CET/CEST) |
| **Germany** | `Europe/Berlin` | UTC+1/+2 (CET/CEST) |
| **UAE** | `Asia/Dubai` | UTC+4 |
| **India** | `Asia/Kolkata` | UTC+5:30 (IST) |
| **Singapore** | `Asia/Singapore` | UTC+8 |
| **Japan** | `Asia/Tokyo` | UTC+9 |
| **China** | `Asia/Shanghai` | UTC+8 |
| **Australia** | `Australia/Sydney` | UTC+10/+11 |
| **New Zealand** | `Pacific/Auckland` | UTC+12/+13 |

**Examples:**

```sql
-- UTC (default)
CREATE SOURCE MyScheduler USING Global.AdvancedScheduler (
    Schedules: '[...]',
    TimeZone: 'UTC'
) OUTPUT TO SchedulerEvents;

-- India Standard Time
CREATE SOURCE IndiaScheduler USING Global.AdvancedScheduler (
    Schedules: '[...]',
    TimeZone: 'Asia/Kolkata'
) OUTPUT TO SchedulerEvents;

-- US Eastern Time
CREATE SOURCE EasternScheduler USING Global.AdvancedScheduler (
    Schedules: '[...]',
    TimeZone: 'America/New_York'
) OUTPUT TO SchedulerEvents;
```

**Note:** Use IANA identifiers (e.g., `Asia/Kolkata`) instead of abbreviations (e.g., `IST`) to avoid ambiguity and ensure proper daylight saving time handling.

## JSON Configuration Schema

### Global Settings

```json
{
    "global": {
        "maxConcurrentApps": 10,
        "maxConcurrentPerGroup": {"critical": 3, "normal": 5},
        "defaultStaggerSeconds": 30,
        "defaultTimezone": "America/Los_Angeles",
        "blackoutWindows": [...],
        "retryPolicy": {
            "maxRetries": 3,
            "retryDelaySeconds": 60
        }
    },
    "schedules": [...]
}
```

### App Schedule Properties

| Property | Type | Description |
|----------|------|-------------|
| `app` | String | App name or wildcard pattern (e.g., `prod.IBR*`) |
| `group` | String | Grouping for concurrent limits |
| `priority` | Integer | Higher = starts first (default: 0) |
| `enabled` | Boolean | Whether schedule is active (default: true) |
| `windows` | Array | Time windows when app should run |
| `cron` | String | Cron expression (alternative to windows) |
| `runDuration` | String | Duration for cron-based runs (e.g., `2h`, `30m`) |
| `dependencies` | Array | Apps that must complete first |
| `exclusions` | Array | Apps that cannot run simultaneously |

### Time Window Properties

| Property | Type | Description |
|----------|------|-------------|
| `start` | String | Start time (HH:mm format) |
| `end` | String | End time (HH:mm format) |
| `daysOfWeek` | Array | Days of week (MONDAY, TUESDAY, etc.) |
| `daysOfMonth` | Array | Days of month (1-31) |
| `months` | Array | Months (JANUARY, FEBRUARY, etc.) |
| `dates.from` | String | Date range start (yyyy-MM-dd) |
| `dates.to` | String | Date range end (yyyy-MM-dd) |

## Examples

See `tql/AdvancedScheduler-examples.tql` for comprehensive examples including:
- Simple time window scheduling
- Max concurrent apps with groups
- Cron expression scheduling
- Day-of-week and day-of-month scheduling
- Dependencies between apps
- External JSON configuration

## Cron Expression Format

Uses standard 5-field cron format: `minute hour dayOfMonth month dayOfWeek`

Examples:
- `0 * * * *` - Every hour at :00
- `0 3 * * *` - Daily at 3:00 AM
- `0 2 * * 0` - Sundays at 2:00 AM
- `30 */2 * * *` - Every 2 hours at :30
- `0 0 1 * *` - First day of each month at midnight

## Cluster Coordination

The scheduler uses Hazelcast for cluster coordination, ensuring:
- Only one node starts/stops a given app
- State is shared across cluster nodes
- Proper leader election for scheduling decisions

## Events

The scheduler emits events to the output stream:
- `APP_STARTED` - When an app is started
- `APP_STOPPED` - When an app is stopped
- `SCHEDULE_CHECK` - Periodic schedule evaluation
- `ERROR` - When an error occurs

## Troubleshooting

1. **Apps not starting**: Check timezone settings, time window definitions
2. **Too many concurrent apps**: Verify `maxConcurrentApps` and group limits
3. **Dependencies not working**: Ensure dependent apps are also scheduled
4. **Cron not triggering**: Verify `runDuration` is set for cron schedules

## Web UI

AdvancedScheduler includes a web-based configuration UI: **Schedule Configuration Visualizer and Generator**

### Features

- **Dashboard** - Visual overview with timeline heatmap showing schedule density
- **Schedule Editor** - Form-based schedule creation and editing
- **Auto-Balance** - Automatically distribute schedules to minimize overlap
- **App Discovery** - Browse Striim apps and create schedules

### Quick Deployment

```bash
# Copy UI files to Striim
sudo mkdir -p /opt/striim/webui/scheduler
sudo cp -r scheduler/* /opt/striim/webui/scheduler/
sudo chown -R striim:striim /opt/striim/webui/scheduler

# Access at: http://<striim-server>:9080/scheduler/
```

### GCP Deployment

```bash
# Create tarball and deploy
tar -czf /tmp/scheduler-ui.tar.gz scheduler/

gcloud compute scp /tmp/scheduler-ui.tar.gz <vm>:~/scheduler-ui.tar.gz \
    --zone=<zone> --project=<project> --internal-ip

gcloud compute ssh <vm> --zone=<zone> --project=<project> --internal-ip \
    --command="sudo rm -rf /opt/striim/webui/scheduler && \
               sudo tar -xzf ~/scheduler-ui.tar.gz -C /opt/striim/webui/ && \
               sudo chown -R striim:striim /opt/striim/webui/scheduler"
```

### Auto-Balance Strategies

| Strategy | Description |
|----------|-------------|
| **Even Spread** | Round-robin across time slots |
| **Staggered Start** | Same window, offset start times |
| **Multiple Times Daily** | Run N times/day with max concurrency control |

For detailed Web UI documentation, see `adv-scheduler.md`.

