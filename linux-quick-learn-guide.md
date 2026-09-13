# Linux Quick-Learn Guide
### From a senior DevOps engineer's notebook — 10 years in the trenches

Everything else in this series — Ansible, Jenkins, Docker — ultimately runs on top of Linux, and when something breaks at 2 a.m. it's Linux fundamentals that get you out of trouble, not the automation layer on top. This guide focuses on the 20% of Linux knowledge that explains 80% of real production incidents: permissions, processes, systemd, and "why can't this service reach that port."

---

## 1. What You Actually Need Linux For, Day to Day

- **Running and supervising services** — systemd units, restarts, logs.
- **Diagnosing "it's slow" / "it's down"** — CPU, memory, disk, network, all from the command line.
- **Access control** — users, groups, permissions, SSH.
- **Automation substrate** — cron, systemd timers, and shell scripts (next guide) all assume this foundation.

---

## 2. Core Concepts (know these cold)

| Term | What it means |
|---|---|
| **Filesystem Hierarchy** | `/etc` (config), `/var` (variable data, logs), `/home` (user dirs), `/tmp` (ephemeral), `/usr` (installed software), `/opt` (third-party apps) |
| **User / Group** | Every process and file has an owning user and group; `/etc/passwd`, `/etc/group` |
| **Permissions** | Read/Write/Execute for Owner/Group/Others, shown as `rwxr-xr--` or octal `754` |
| **Process** | A running program, with a PID, owner, and resource usage; parent/child relationships |
| **Signal** | A message sent to a process (`SIGTERM` = please stop, `SIGKILL` = force stop, `SIGHUP` = reload config) |
| **systemd / unit** | The modern init system; a "unit" (`.service`, `.timer`, `.socket`) is a managed, supervisable process definition |
| **Package manager** | `apt`/`dpkg` (Debian/Ubuntu), `yum`/`dnf`/`rpm` (RHEL/CentOS/Fedora) |
| **Mount point** | Where a filesystem/device is attached into the directory tree (`df -h` shows these) |
| **Standard streams** | `stdin` (0), `stdout` (1), `stderr` (2) — redirection (`>`, `>>`, `2>&1`) builds on these |
| **Cron** | Time-based job scheduler; `crontab -e` edits a user's schedule |

---

## 3. Command Cheat Sheet

### Navigation & files
| Command | Purpose |
|---|---|
| `ls -lah` | List files, long format, human-readable sizes, including hidden |
| `find /var/log -name "*.log" -mtime +7` | Find files matching criteria (here: log files older than 7 days) |
| `du -sh */` | Disk usage per directory, human-readable |
| `df -h` | Disk space per mounted filesystem |
| `tar -czvf archive.tar.gz dir/` / `tar -xzvf archive.tar.gz` | Create / extract a compressed archive |

### Permissions & ownership
| Command | Purpose |
|---|---|
| `chmod 750 script.sh` | Set permissions explicitly (owner rwx, group r-x, others none) |
| `chown deploy:deploy /app` | Change file/directory owner and group |
| `chmod +x script.sh` | Make a file executable |
| `sudo -u appuser command` | Run a command as another user |

### Processes & resources
| Command | Purpose |
|---|---|
| `ps aux \| grep node` | List processes, filter for a name |
| `top` / `htop` | Live resource usage (CPU, memory) per process |
| `kill -15 <pid>` / `kill -9 <pid>` | Ask a process to stop gracefully / force-kill it |
| `free -h` | Memory usage summary |
| `nice -n 10 command` | Run a command with lower CPU priority |

### Services (systemd)
| Command | Purpose |
|---|---|
| `systemctl status myapp` | Check a service's current state |
| `systemctl start\|stop\|restart myapp` | Control a service |
| `systemctl enable myapp` | Start automatically on boot |
| `journalctl -u myapp -f` | Follow live logs for a service |
| `journalctl -u myapp --since "1 hour ago"` | Filter logs by time |

### Networking
| Command | Purpose |
|---|---|
| `ss -tulpn` | Show listening ports and the process owning each |
| `curl -I http://localhost:3000` | Quick HTTP check (headers only) |
| `ping -c 4 host` | Basic reachability check |
| `dig`/`nslookup domain` | DNS resolution check |
| `ufw status` / `iptables -L` | Firewall rule inspection |

---

## 4. Ten Years of Battle-Tested Best Practices

1. **Never run production apps as root.** Create a dedicated system user (`useradd -r -s /usr/sbin/nologin appuser`) for every service.
2. **Let systemd supervise your processes**, not `nohup`/`screen`/`tmux`. You want automatic restarts, boot-time startup, and centralized logs — systemd gives you all three for free.
3. **`journalctl` before you go hunting for log files.** If a service is systemd-managed, its logs are already centralized and searchable — no need to `tail -f` across five different files.
4. **Understand the difference between `SIGTERM` and `SIGKILL`.** Always try graceful shutdown (`SIGTERM`, what `systemctl stop` and plain `kill` send by default) before force-killing — a killed-mid-write process can corrupt data.
5. **Watch disk space proactively**, not reactively. A full `/var` (usually from unrotated logs) is one of the most common, most preventable outages in the industry. Set up `logrotate` and disk alerts on day one.
6. **Least privilege on file permissions.** `chmod 777` is never the right answer — figure out the actual owner/group that needs access instead of disabling permission checks entirely.
7. **SSH key auth only, disable password auth** on any server you care about (`PasswordAuthentication no` in `sshd_config`). Also disable root SSH login (`PermitRootLogin no`).
8. **Read `/etc/os-release` before assuming package manager syntax** — Debian/Ubuntu vs. RHEL-family commands differ, and guessing wrong on a live box wastes time.
9. **`ss` over `netstat`** — netstat is deprecated on modern distros; `ss` is faster and actively maintained.
10. **Automate with cron/systemd timers for anything recurring**, but log every run's outcome somewhere durable — a cron job that silently fails for three weeks is worse than no automation at all.

---

## 5. Hands-On Projects

### Project 1 (Beginner) — Users, permissions, and SSH hardening
**Goal:** Set up a proper deploy user with least-privilege access instead of doing everything as root.

Steps:
1. On a test VM, create a dedicated user: `sudo useradd -m -s /bin/bash deploy`.
2. Set up SSH key auth for that user (copy your public key into `~deploy/.ssh/authorized_keys`, correct ownership and `700`/`600` permissions).
3. Create an app directory `/opt/myapp` owned by `deploy:deploy` with `750` permissions.
4. Edit `/etc/ssh/sshd_config` to set `PermitRootLogin no` and `PasswordAuthentication no`, then restart `sshd`.
5. Confirm you can SSH in as `deploy` with your key, and that password login and root login both now fail.

**Try-it-yourself challenge:** Set `/opt/myapp` to `750` owned by `deploy:deploy`, then try accessing it as a *different* non-root user. Explain exactly which permission bit is blocking access and why.

---

### Project 2 (Intermediate) — Run a Node.js app as a systemd service
**Goal:** Stop running your app with `node server.js &` in a terminal and manage it properly.

Steps:
1. Write a unit file at `/etc/systemd/system/myapp.service` defining `ExecStart`, `WorkingDirectory`, `User`, `Restart=on-failure`, and an `EnvironmentFile` pointing at `/opt/myapp/.env`.
2. `sudo systemctl daemon-reload`, then `sudo systemctl enable --now myapp`.
3. Confirm it's running with `systemctl status myapp` and that logs appear via `journalctl -u myapp -f`.
4. Kill the Node process directly (`kill -9 <pid>`) and confirm systemd automatically restarts it.

**Try-it-yourself challenge:** Reboot the test VM (or simulate with `systemctl stop` then check `is-enabled`) and confirm the service comes back up on its own without manual intervention.

---

### Project 3 (Intermediate-Advanced) — Resource monitoring and log rotation
**Goal:** Build the basic observability habits that catch problems before they become outages.

Steps:
1. Use `top`/`htop` to identify the top 3 memory-consuming processes on your test VM.
2. Write a `logrotate` config at `/etc/logrotate.d/myapp` that rotates your app's log file daily, keeps 7 days of history, and compresses old logs.
3. Set up a cron job (`crontab -e`) that runs every 15 minutes, checks `df -h` for the root filesystem, and appends a warning line to a monitoring log file if usage exceeds 80%.
4. Manually trigger the logrotate config (`logrotate -f /etc/logrotate.d/myapp`) and confirm old logs are compressed as expected.

**Try-it-yourself challenge:** Modify the disk-check cron job so it only logs a warning *once* per threshold breach instead of every 15 minutes while the condition persists (avoid alert spam) — how would you track "already warned" state between runs?

---

### Project 4 (Advanced) — Networking diagnostics
**Goal:** Practice the actual troubleshooting flow for "the app isn't reachable."

Steps:
1. Start your Node app on port 3000, but deliberately misconfigure the firewall (`ufw deny 3000` or an equivalent `iptables` rule) so it's unreachable externally.
2. Use `ss -tulpn` to confirm the app *is* listening locally, isolating the problem to network access rather than the app itself.
3. Use `curl -I http://localhost:3000` (works) vs. `curl -I http://<vm-ip>:3000` from another machine (fails) to prove the distinction.
4. Fix the firewall rule, re-test, and confirm external access now works.
5. Repeat the exercise, but this time make the app itself the problem (bind it to `127.0.0.1` instead of `0.0.0.0`) and diagnose that distinctly different failure mode.

**Try-it-yourself challenge:** Without looking at the app's source code, using only `ss`, `curl`, and firewall commands, write out the exact diagnostic sequence you'd follow to distinguish "app isn't running," "app is bound to the wrong interface," and "firewall is blocking the port" from each other.

---

## 6. Knowledge Check

1. What's the difference between `chmod 750` and `chmod 755` on a directory?
2. Why should production services run under a dedicated non-root user rather than root?
3. What's the practical difference between `SIGTERM` and `SIGKILL`?
4. Why prefer systemd over `nohup`/`screen` for running a long-lived service?
5. What does `journalctl -u myapp -f` do, and why is it usually better than tailing a raw log file?
6. What's the single most common preventable cause of "server ran out of disk"?
7. What does `ss -tulpn` show you that helps diagnose "can't connect to my app"?
8. Why does binding a service to `127.0.0.1` instead of `0.0.0.0` make it unreachable from other machines, even with the firewall wide open?
9. What's the purpose of `PermitRootLogin no` and `PasswordAuthentication no` in `sshd_config`?
10. Why is `chmod 777` almost always the wrong fix for a permissions problem?

---

## 7. Answers & Solutions

### Quiz Answers
1. `750` = owner rwx, group r-x, others no access at all. `755` = owner rwx, group r-x, others r-x (readable/executable by everyone). The difference is whether users outside the owning group can access it at all.
2. If the process is compromised, an attacker only gains the privileges of that limited user, not full control of the system — this is the core of least-privilege defense.
3. `SIGTERM` politely asks a process to shut down, giving it a chance to clean up (close DB connections, flush buffers). `SIGKILL` terminates it immediately with no chance to clean up, risking data corruption or orphaned resources.
4. systemd provides automatic restart on crash, startup on boot, centralized logging via the journal, and resource control (cgroups) — a terminal session running `nohup` dies with the terminal/session and gives you none of that supervision.
5. It streams (and can filter/search) the systemd journal for that specific unit, which already aggregates stdout/stderr and metadata in one structured, queryable place — no need to know which log file(s) the app happens to write to, or to grep across several files by hand.
6. Unrotated or unbounded log files silently filling up `/var` (or wherever logs are written) over time until the disk is full.
7. It shows which processes are listening on which ports and interfaces — confirming whether the app is actually running and bound where you expect, which isolates "app problem" from "network/firewall problem."
8. `127.0.0.1` is the loopback interface — only reachable from the machine itself. Binding there means no external network interface ever receives the traffic, regardless of firewall rules, because the app never listens on any externally-reachable address.
9. They close two of the most common SSH attack vectors: brute-forcing a password, and gaining root access directly via SSH — forcing a key-based login as a non-root user first, with `sudo` for anything privileged.
10. It removes all permission boundaries (world-writable, world-executable) instead of fixing the actual owner/group mismatch — it "solves" the symptom while creating a much larger security exposure than the original problem.

### Project Solutions

**Project 1 — permission bit blocking access:**
With `750` on `/opt/myapp` owned by `deploy:deploy`, a different non-root user (not in the `deploy` group and not `deploy` themselves) falls into the "others" category, which has **no permission bits at all** (`---`). Even if a file inside is world-readable, the user can't traverse into the directory to reach it because the directory itself denies "others" the execute (traverse) permission. Fix: add the user to the `deploy` group, or adjust the directory's group ownership/permissions as appropriate for your access model.

**Project 2 — sample unit file (`/etc/systemd/system/myapp.service`):**
```ini
[Unit]
Description=My Node.js App
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/myapp
EnvironmentFile=/opt/myapp/.env
ExecStart=/usr/bin/node /opt/myapp/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```
`Restart=on-failure` plus `systemctl enable` together deliver both auto-restart on crash and auto-start on boot.

**Project 3 — avoiding alert spam (state tracking):**
```bash
#!/bin/bash
THRESHOLD=80
STATE_FILE="/tmp/disk_alert_state"
USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')

if [ "$USAGE" -ge "$THRESHOLD" ]; then
    if [ ! -f "$STATE_FILE" ]; then
        echo "$(date): WARNING - disk usage at ${USAGE}%" >> /var/log/disk-monitor.log
        touch "$STATE_FILE"
    fi
else
    rm -f "$STATE_FILE"   # reset once usage drops back below threshold
fi
```
The state file acts as a simple flag: a warning is only logged once when the threshold is first crossed, and the flag clears itself once usage recovers, allowing future breaches to alert again.

**Project 4 — diagnostic sequence:**
1. `ss -tulpn | grep 3000` — if nothing is listed, the app isn't running or isn't listening at all (app problem, not network).
2. If something *is* listed, check the local address shown: `127.0.0.1:3000` means the app is only bound to loopback (won't be reachable externally regardless of firewall); `0.0.0.0:3000` or the actual host IP means it's bound correctly.
3. If bound correctly, `curl -I http://localhost:3000` from the server itself should succeed — if it does, the app is fine and the problem is external, pointing at the firewall.
4. Check `ufw status` / `iptables -L` for a rule blocking that port, and test again from another machine after fixing it.
This ordered sequence — listening state, then bind address, then local reachability, then firewall — isolates each layer before touching the next.
