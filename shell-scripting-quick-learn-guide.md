# Shell Scripting Quick-Learn Guide
### From a senior DevOps engineer's notebook — 10 years in the trenches

Shell scripting is the glue that holds the rest of your DevOps toolchain together — the deploy step Ansible calls, the healthcheck Jenkins runs, the entrypoint a Docker container executes. Most production shell scripts fail not because Bash is exotic, but because of a handful of habits (unquoted variables, ignored exit codes, no error handling) that this guide deliberately drills into you from the start.

---

## 1. What Shell Scripts Are Actually For

- **Gluing tools together** — the small step between "Jenkins says build" and "Docker actually builds."
- **Repeatable operational tasks** — backups, deploys, health checks, cleanup jobs.
- **Fast, dependency-free automation** — no runtime to install; Bash is already on every Linux box you'll touch.

Shell scripting is *not* the right tool for complex logic, data processing at scale, or anything needing real data structures — reach for Python/Node for that. Know where the line is.

---

## 2. Core Concepts (know these cold)

| Concept | Example / Note |
|---|---|
| **Shebang** | `#!/bin/bash` (or `#!/usr/bin/env bash`) — first line, tells the OS which interpreter to use |
| **Variables** | `NAME="value"` (no spaces around `=`), used as `"$NAME"` — always quote |
| **Exit codes** | `0` = success, non-zero = failure; every command sets `$?` after it runs |
| **Conditionals** | `if [[ condition ]]; then ... elif ...; else ...; fi` |
| **Loops** | `for`, `while`, `until` |
| **Functions** | `my_func() { ... }`, called just like a command: `my_func arg1 arg2` |
| **Positional parameters** | `$1`, `$2`, ... `$@` (all args as separate words), `$#` (arg count) |
| **Command substitution** | `` result=$(some_command) `` — capture output into a variable |
| **Arrays** | `arr=("a" "b" "c")`; access with `${arr[0]}`, iterate with `"${arr[@]}"` |
| **String tests** | `[[ -z "$VAR" ]]` (empty), `[[ -n "$VAR" ]]` (non-empty), `[[ "$A" == "$B" ]]` |
| **File tests** | `[[ -f file ]]` (regular file exists), `[[ -d dir ]]` (directory exists), `[[ -x file ]]` (executable) |
| **`set` options** | `set -e` (exit on error), `set -u` (error on unset variable), `set -o pipefail` (catch failures in pipes) |
| **`trap`** | Run cleanup code on exit/error: `trap cleanup EXIT` |
| **Here-doc** | Multi-line string input: `cat <<EOF ... EOF` |

---

## 3. Anatomy of a Solid Script

```bash
#!/usr/bin/env bash
set -euo pipefail   # exit on error, error on unset var, catch pipe failures

# --- Config ---
APP_DIR="/opt/myapp"
LOG_FILE="/var/log/myapp-deploy.log"

# --- Functions ---
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

cleanup() {
    log "Cleaning up temp files..."
    rm -f /tmp/deploy_lock
}
trap cleanup EXIT   # always runs, success or failure

# --- Main ---
log "Starting deploy..."

if [[ ! -d "$APP_DIR" ]]; then
    log "ERROR: $APP_DIR does not exist"
    exit 1
fi

cd "$APP_DIR"
git pull origin main
npm ci
npm test

log "Deploy complete."
```

That header (`set -euo pipefail`) plus `trap cleanup EXIT` is close to a non-negotiable template for any script that touches production.

---

## 4. Syntax Cheat Sheet

| Pattern | Purpose |
|---|---|
| `[[ -z "$VAR" ]] && echo "empty"` | Short-circuit conditional |
| `for f in *.log; do ...; done` | Loop over files matching a glob |
| `while read -r line; do ...; done < file.txt` | Read a file line by line |
| `case "$1" in start) ... ;; stop) ... ;; esac` | Multi-branch matching (great for CLI-style scripts) |
| `getopts ":e:h" opt` | Parse `-e value -h` style flags |
| `"${arr[@]}"` | Expand an array safely (always quote) |
| `command || { echo "failed"; exit 1; }` | Run fallback logic if a command fails |
| `command && echo "succeeded"` | Run only if previous command succeeded |
| `2>&1` | Redirect stderr into stdout |
| `> /dev/null 2>&1` | Silence a command entirely |
| `local var="value"` | Scope a variable to inside a function only |
| `$(basename "$0")` | Get the script's own filename (useful in usage messages) |

---

## 5. Ten Years of Battle-Tested Best Practices

1. **`set -euo pipefail` at the top of every script.** Without it, a failed command mid-script is silently ignored and the script barrel-rolls into the next step with a false sense of success.
2. **Quote every variable expansion**: `"$VAR"`, not `$VAR`. Unquoted variables break on spaces, glob-expand unexpectedly, and are a classic source of "works on my machine."
3. **Use `[[ ]]` over `[ ]`** in Bash — safer word-splitting behavior and more features (regex matching, logical operators without escaping).
4. **Check exit codes explicitly for anything critical** (`if ! command; then ...`), don't assume happy path.
5. **Never parse `ls` output.** Use globs (`for f in *.txt`) or `find` — `ls` output format isn't guaranteed and breaks on filenames with spaces/newlines.
6. **Use `trap ... EXIT`** for cleanup (temp files, lock files, connections) so it runs whether the script succeeds, fails, or is interrupted.
7. **Run `shellcheck` on every script.** It catches quoting bugs, unreachable code, and common mistakes before they hit production — non-negotiable in any serious pipeline.
8. **Make scripts idempotent where possible.** A deploy script re-run twice shouldn't leave things in a worse state than running it once.
9. **Log with timestamps, and log both success and failure paths** — a script that only logs when something goes wrong gives you no baseline for "was this actually running normally before?"
10. **Fail loudly with clear messages.** `exit 1` with no context wastes the next engineer's time (possibly future-you at 2 a.m.); print *why* it failed and what to check.

---

## 6. Hands-On Projects

### Project 1 (Beginner) — Backup script with retention
**Goal:** Write a script that archives a directory with a timestamp and deletes backups older than N days.

Steps:
1. Write `backup.sh` that takes a source directory as `$1` and a backup destination as `$2`.
2. Create a compressed archive named with the current date (`backup-$(date +%Y%m%d-%H%M%S).tar.gz`).
3. Add `set -euo pipefail` and validate both arguments exist before proceeding (fail with a clear message if not).
4. Add a retention step: delete any file in the backup destination older than 7 days.
5. Test it, then test it again immediately after — confirm it doesn't error just because a backup for "today" already exists (unique timestamps handle this, but confirm).

**Try-it-yourself challenge:** Add a `--dry-run` flag (via `getopts` or a simple `if [[ "$1" == "--dry-run" ]]`) that prints exactly what *would* be deleted by the retention step without actually deleting anything.

---

### Project 2 (Intermediate) — Deployment script with health-check rollback
**Goal:** A script that deploys a Node.js app, verifies it's healthy, and automatically rolls back if not.

Steps:
1. Write `deploy.sh` that: records the currently running Git commit hash (for rollback), pulls the latest code, runs `npm ci`, restarts the systemd service (see the Linux guide, Project 2).
2. After restart, poll `curl -sf http://localhost:3000/health` in a retry loop (e.g., 5 attempts, 2-second gaps) instead of checking just once — services take a moment to come up.
3. If the health check never succeeds, `git reset --hard <previous_commit>`, reinstall dependencies, and restart the service again with the old code.
4. Log every step with timestamps to a deploy log file.

**Try-it-yourself challenge:** What race condition exists if two people (or two Jenkins builds) run `deploy.sh` at the same time, and how would you use a lock file (with `trap` to clean it up) to prevent it?

---

### Project 3 (Intermediate-Advanced) — Log monitoring script
**Goal:** Tail an application log, detect error patterns, and raise an alert without spamming.

Steps:
1. Write `log-monitor.sh` that reads a log file path as an argument and searches for lines matching `ERROR` or `FATAL` using `grep`.
2. Track how many matches occurred in the last check interval (e.g., store a "last checked line number" in a state file so you don't re-scan the whole file every run).
3. If the error count in that interval exceeds a threshold (e.g., 5), write an alert entry to a separate `alerts.log` file (simulating what would otherwise be a Slack/email call).
4. Run it via cron every 5 minutes, or in a `while true; do ...; sleep 300; done` loop for testing.

**Try-it-yourself challenge:** Make the script resilient to log rotation — if the log file's inode changes (i.e., it was rotated by `logrotate`) mid-run, detect that and reset your "last line" tracking instead of silently reading garbage or missing lines.

---

### Project 4 (Advanced) — A "poor man's CI" orchestration script
**Goal:** Chain lint → test → build → Docker build with real argument parsing, proper error handling at each stage, and a summary at the end — the kind of script Jenkins itself might call as a single step.

Steps:
1. Write `ci.sh` using `getopts` to accept flags: `-e <environment>` (dev/staging/prod), `-s` (skip tests, for quick iteration), `-h` (help/usage).
2. Structure the script with one function per stage (`run_lint`, `run_tests`, `run_build`, `build_image`), each returning a proper exit code and logging its own start/end.
3. Use `trap` to catch any failure and print a clear summary: which stage failed, and the exit code.
4. On full success, print a summary of everything that ran and how long each stage took (`SECONDS` built-in variable, or `date +%s` before/after).
5. Make it safe to interrupt (Ctrl+C) mid-run without leaving partial Docker build artifacts or lock files behind.

**Try-it-yourself challenge:** Add a `--dry-run` mode to the entire script (not just one stage) that prints the full sequence of stages and commands it *would* run, without executing anything — useful for reviewing what a script does before trusting it against production.

---

## 7. Knowledge Check

1. What does `set -euo pipefail` actually do, broken into its three parts?
2. Why is `[[ -z "$VAR" ]]` safer than `[ -z $VAR ]`?
3. What's the difference between `$@` and `$*` when used inside `"..."` quotes?
4. Why shouldn't you parse the output of `ls` in a script?
5. What does `trap cleanup EXIT` guarantee that just calling `cleanup` at the end of the script doesn't?
6. What's the difference between `command1 && command2` and `command1; command2`?
7. Why is it dangerous to write `rm -rf $DIR/*` without quoting `$DIR`?
8. What does `getopts` give you that manually checking `$1`, `$2`, etc. doesn't?
9. Why is retrying a health check (with delay) usually better than a single check right after restarting a service?
10. What tool should you run on every script before trusting it in production, and what class of bugs does it catch?

---

## 8. Answers & Solutions

### Quiz Answers
1. `-e` exits the script immediately if any command returns non-zero; `-u` treats using an undefined variable as an error instead of silently substituting an empty string; `-o pipefail` makes a pipeline (`cmd1 | cmd2`) fail if *any* command in it fails, not just the last one.
2. Without quotes, if `$VAR` is empty or contains spaces, `[ -z $VAR ]` can expand into a syntax error or a test with the wrong number of arguments. `[[ -z "$VAR" ]]` handles empty/unset/spaced values safely because `[[ ]]` doesn't word-split its arguments the same way.
3. Inside quotes, `"$@"` expands to each positional parameter as a **separate** quoted word (preserving arguments with spaces); `"$*"` expands to **all** parameters joined into a **single** word separated by the first character of `IFS`. For passing arguments through to another command, `"$@"` is almost always what you want.
4. `ls` output formatting isn't guaranteed to be script-stable, and it breaks on filenames containing spaces, newlines, or special characters. Globs (`for f in *.txt`) or `find` are the reliable, portable alternative.
5. `trap cleanup EXIT` runs the cleanup function no matter *how* the script ends — normal completion, an error triggering `set -e`, or an interrupt signal (Ctrl+C). A cleanup call only at the bottom of the script never runs if the script exits early due to an error or is killed.
6. `command1 && command2` only runs `command2` if `command1` succeeded (exit code 0). `command1; command2` runs `command2` regardless of whether `command1` succeeded or failed — the `;` has no conditional logic at all.
7. If `$DIR` is empty or unset, `rm -rf $DIR/*` silently becomes `rm -rf /*` (or similar), attempting to delete from the filesystem root. Quoting alone (`"$DIR"`) doesn't fully protect against an *empty* variable — combine `set -u` with an explicit check that `$DIR` is non-empty before any destructive operation.
8. `getopts` gives you standard, well-tested parsing for flags (`-e value`, combined short flags, `--` to end options), proper error messages for invalid options, and doesn't require you to manually track which positional argument means what — this matters a lot once a script accepts more than one or two arguments.
9. A service can take a moment to fully initialize after a restart (loading config, connecting to a database, warming up). A single immediate check can produce a false negative and trigger an unnecessary rollback; a short retry loop gives the service a realistic startup window before deciding it's actually unhealthy.
10. `shellcheck` — it statically analyzes scripts for unquoted variables, unreachable code, incorrect test syntax, common quoting pitfalls, and dozens of other well-known classes of shell scripting bugs, before they ever run against a real system.

### Project Solutions

**Project 1 — dry-run retention:**
```bash
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    shift
fi

find "$BACKUP_DEST" -name "backup-*.tar.gz" -mtime +7 -print | while read -r old_file; do
    if [[ "$DRY_RUN" == true ]]; then
        echo "[DRY RUN] Would delete: $old_file"
    else
        rm -f "$old_file"
        echo "Deleted: $old_file"
    fi
done
```

**Project 2 — preventing concurrent deploys with a lock file:**
```bash
LOCK_FILE="/tmp/deploy.lock"

if [[ -f "$LOCK_FILE" ]]; then
    echo "ERROR: Deploy already in progress (lock file exists at $LOCK_FILE)."
    exit 1
fi

touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ... rest of deploy logic ...
```
The race condition: without a lock, two simultaneous deploys could both record "previous commit," both pull new code, and interleave their `npm ci`/restart steps — potentially leaving the service restarted mid-way through a half-finished deploy from the other run, or corrupting the "commit to roll back to" value. The lock file plus `trap` ensures only one deploy runs at a time and the lock is always released, even on failure.

**Project 3 — handling log rotation (inode change detection):**
```bash
STATE_FILE="/tmp/log_monitor_state"
CURRENT_INODE=$(stat -c %i "$LOG_FILE")

if [[ -f "$STATE_FILE" ]]; then
    read -r LAST_LINE LAST_INODE < "$STATE_FILE"
else
    LAST_LINE=0
    LAST_INODE="$CURRENT_INODE"
fi

if [[ "$CURRENT_INODE" != "$LAST_INODE" ]]; then
    echo "Log rotation detected — resetting line tracking."
    LAST_LINE=0
fi

# ... scan from LAST_LINE onward using tail -n +$LAST_LINE ...

NEW_LINE=$(wc -l < "$LOG_FILE")
echo "$NEW_LINE $CURRENT_INODE" > "$STATE_FILE"
```
Comparing the file's inode (`stat -c %i`) between runs is the reliable way to detect that `logrotate` swapped the file out from under you, even though the filename stayed the same.

**Project 4 — global dry-run mode:**
```bash
DRY_RUN=false
while getopts ":e:sdh" opt; do
    case $opt in
        e) ENVIRONMENT="$OPTARG" ;;
        s) SKIP_TESTS=true ;;
        d) DRY_RUN=true ;;
        h) usage; exit 0 ;;
        *) usage; exit 1 ;;
    esac
done

run_stage() {
    local stage_name="$1"
    shift
    if [[ "$DRY_RUN" == true ]]; then
        echo "[DRY RUN] Would run stage '$stage_name': $*"
    else
        echo "Running stage: $stage_name"
        "$@"
    fi
}

run_stage "lint" npm run lint
run_stage "test" npm test
run_stage "build" npm run build
run_stage "docker_build" docker build -t myapp:latest .
```
Wrapping every real command in `run_stage` gives you one central place that decides between "print what would happen" and "actually do it," so dry-run coverage is automatic for every stage you add later, instead of needing an `if` check duplicated in each one.
