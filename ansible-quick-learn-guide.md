# Ansible Quick-Learn Guide
### From a senior DevOps engineer's notebook — 10 years in the trenches

Ansible is usually the first "real" automation tool people learn because it has the lowest barrier to entry: no agents to install, YAML instead of a new language, and SSH as the transport. That simplicity is deceptive — it's also what most production infra outages trace back to (someone ran a playbook without `--check` first). This guide gets you fluent fast, then makes you dangerous with four real projects.

---

## 1. What Ansible Actually Solves

- **Configuration management** — make N servers look like the spec, every time, regardless of their current state (idempotency).
- **Application deployment** — push code, restart services, roll out in sequence.
- **Orchestration** — coordinate multi-tier changes (DB migration → app restart → LB drain/re-add).
- **Provisioning** — combined with cloud modules, it can create the infrastructure too (though Terraform is more common for that layer today; Ansible usually configures what Terraform creates).

**Why it stuck over Puppet/Chef/Salt:** no agent daemon running on every node, push-based instead of pull-based, and YAML has a much shorter learning curve than Ruby DSLs.

---

## 2. Core Concepts (know these cold)

| Term | What it means |
|---|---|
| **Control node** | The machine running `ansible`/`ansible-playbook` (needs Python + Ansible installed) |
| **Managed node** | Target servers (only need Python + SSH access, no agent) |
| **Inventory** | List of managed nodes, grouped (static `.ini`/YAML file, or dynamic via a script/plugin) |
| **Module** | A unit of work (`apt`, `copy`, `service`, `template`, `user`, etc.) — idempotent by design |
| **Task** | One module call with parameters, inside a play |
| **Play** | A mapping of a group of hosts to a list of tasks |
| **Playbook** | A YAML file containing one or more plays |
| **Role** | A standardized directory structure for reusable, shareable automation |
| **Variables** | Data injected into tasks/templates — can live in inventory, `group_vars/`, `host_vars/`, playbook, or role defaults |
| **Facts** | Auto-discovered system data (`ansible_facts`) gathered at play start |
| **Handler** | A task that only runs when notified (typically for restarts), and only once even if notified multiple times |
| **Template** | A Jinja2 file (`.j2`) rendered with variables and pushed to the target |
| **Vault** | Encrypts secrets (passwords, keys) so they can live safely in version control |

---

## 3. Install & First Contact

```bash
# Control node (Debian/Ubuntu)
sudo apt update && sudo apt install -y ansible

# or via pip, if you want the latest version
pip install --user ansible

ansible --version
```

Set up passwordless SSH to your targets — this isn't optional, it's how Ansible works:

```bash
ssh-keygen -t ed25519 -C "ansible-control"
ssh-copy-id user@target-host
```

A minimal inventory (`inventory.ini`):

```ini
[web]
web1.example.com
web2.example.com

[db]
db1.example.com

[all:vars]
ansible_user=ubuntu
ansible_python_interpreter=/usr/bin/python3
```

Test connectivity:

```bash
ansible all -i inventory.ini -m ping
```

---

## 4. Anatomy of a Playbook

```yaml
---
- name: Configure web servers
  hosts: web
  become: true                     # sudo
  vars:
    app_port: 3000
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: present
        update_cache: true

    - name: Deploy nginx config from template
      template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/sites-available/default
      notify: Restart nginx          # triggers the handler below

    - name: Ensure nginx is enabled and running
      service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: Restart nginx
      service:
        name: nginx
        state: restarted
```

Run it:

```bash
ansible-playbook -i inventory.ini site.yml --check --diff   # dry run first, always
ansible-playbook -i inventory.ini site.yml
```

---

## 5. Command Cheat Sheet

| Command | Purpose |
|---|---|
| `ansible all -m ping` | Check connectivity to all hosts |
| `ansible web -a "uptime"` | Run an ad-hoc shell command against a group |
| `ansible-playbook site.yml --check --diff` | Dry-run, show what *would* change |
| `ansible-playbook site.yml --limit web1.example.com` | Restrict run to one host |
| `ansible-playbook site.yml --tags deploy` | Run only tasks tagged `deploy` |
| `ansible-playbook site.yml -e "version=1.4.0"` | Pass an extra variable at runtime |
| `ansible-vault encrypt secrets.yml` | Encrypt a file |
| `ansible-vault edit secrets.yml` | Edit an encrypted file in place |
| `ansible-playbook site.yml --ask-vault-pass` | Run a playbook that uses vaulted vars |
| `ansible-galaxy install geerlingguy.nginx` | Pull a community role |
| `ansible-doc -l` | List all available modules |
| `ansible-lint site.yml` | Static analysis / best-practice linting |

---

## 6. Ten Years of Battle-Tested Best Practices

1. **Idempotency is not optional.** If running a playbook twice changes anything the second time, it's broken. Test this deliberately.
2. **Always `--check --diff` before touching anything you'd miss at 2 a.m.** It costs 30 seconds and has saved me from more than one bad Friday deploy.
3. **Roles over one giant playbook.** The moment you copy-paste a task block into a second playbook, it should be a role.
4. **Secrets go in Vault. Full stop.** Not in a "private" git branch, not in an `.env` committed "temporarily."
5. **Handlers for restarts, tasks for everything else.** Handlers batch and dedupe — you don't want nginx restarting five times in one run.
6. **`--limit` is your blast-radius control.** Never run untested changes against `all` in production.
7. **Pin your dependencies** (`requirements.yml` for Galaxy roles/collections) — "latest" breaks builds on someone else's Tuesday.
8. **Use `serial:` for rolling updates.** Updating all 12 app servers at once because you forgot `serial: 2` is how you cause an outage, not fix one.
9. **Facts are expensive at scale.** If you have 500+ hosts, `gather_facts: false` and pull only what you need with `setup:` + `filter` speeds runs up dramatically.
10. **Version control everything**, including inventory. "Which server did we run this against last month" should never require guessing.

---

## 7. Hands-On Projects

### Project 1 (Beginner) — Provision a single web server
**Goal:** Write an inventory + playbook that installs nginx on one Ubuntu host and serves a custom `index.html`.

Steps:
1. Spin up one VM (a local VirtualBox/Multipass box, a free-tier cloud VM, or even WSL2 works for testing).
2. Write `inventory.ini` with that single host under a `[web]` group.
3. Write a playbook that: updates apt cache, installs `nginx`, copies a custom `index.html` to `/var/www/html/index.html`, ensures the service is running and enabled.
4. Run with `--check` first, then for real. Confirm in a browser or with `curl`.

**Try-it-yourself challenge:** Run the playbook a second time. Nothing should report as "changed" except possibly the service state. If `apt install` shows "changed" every time, what's wrong, and how do you fix it? (Answer at the end of this document.)

---

### Project 2 (Intermediate) — Multi-tier deployment with roles
**Goal:** Deploy a Node.js/Express app behind an nginx reverse proxy, across 2 app servers and 1 load balancer, using roles instead of a flat playbook.

Steps:
1. Scaffold roles: `ansible-galaxy init roles/common`, `roles/nodejs_app`, `roles/nginx_proxy`.
2. `common` role: create a deploy user, set timezone, install baseline packages.
3. `nodejs_app` role: install Node.js (via NodeSource repo or `nvm`), copy your app code (or `git clone` a repo), install dependencies with `npm ci`, and manage the process with a systemd unit template (`.service.j2`) — avoid `nohup`/`screen` hacks.
4. `nginx_proxy` role: template an nginx config that proxies `/` to your two app servers (`upstream` block), deployed only to the LB host group.
5. Use `group_vars/app.yml` and `group_vars/lb.yml` for group-specific variables (app port, upstream server list).
6. Site playbook ties it together: `hosts: app` → `roles: [common, nodejs_app]`; `hosts: lb` → `roles: [common, nginx_proxy]`.

**Try-it-yourself challenge:** Use a Jinja2 `{% for %}` loop inside the nginx upstream template to generate the server list automatically from the `app` group's `ansible_play_hosts`, so adding a third app server requires zero template changes.

---

### Project 3 (Intermediate-Advanced) — Secrets management with Ansible Vault
**Goal:** Store a database password and API key encrypted, and inject them into your app's environment file at deploy time.

Steps:
1. Create `group_vars/app/vault.yml` containing `db_password` and `api_key`.
2. Encrypt it: `ansible-vault encrypt group_vars/app/vault.yml`.
3. Reference the vaulted variables in a `.env.j2` template deployed to the app server.
4. Run the playbook with `--ask-vault-pass` (or a `--vault-password-file` for CI use).
5. Confirm the plaintext file on disk contains the real values, but the version-controlled vault file is unreadable ciphertext.

**Try-it-yourself challenge:** Rotate the vault password (`ansible-vault rekey group_vars/app/vault.yml`) without ever having the old or new password appear in shell history or logs.

---

### Project 4 (Advanced) — Dynamic inventory + zero-downtime rolling deploy
**Goal:** Use AWS EC2 dynamic inventory instead of a static file, and roll out a new app version to 4 servers without downtime.

Steps:
1. Install the `amazon.aws` collection and configure `aws_ec2.yml` as your inventory plugin source, filtering on a tag (e.g., `Environment: staging`).
2. Confirm `ansible-inventory -i aws_ec2.yml --graph` shows your real EC2 fleet grouped by tags.
3. Write a deploy playbook with `serial: 1` (or `serial: "25%"`) so only one server updates at a time.
4. Before updating each server: remove it from the load balancer (module for your LB, or an nginx upstream `down` flag). After updating: health-check the app, then re-add it.
5. Use `max_fail_percentage` so the whole rollout halts if a server fails its health check, instead of degrading the entire fleet.

**Try-it-yourself challenge:** Add a pre-task that hits `/health` on the server and fails the play (`assert` module) before removing it from rotation if the app is already unhealthy — don't make a bad situation worse by touching a server that's already down for another reason.

---

## 8. Knowledge Check

1. What makes a task "idempotent," and why does it matter operationally?
2. What's the difference between a *play* and a *playbook*?
3. Where would you put a variable that should apply to every host in the `db` group, but nowhere else?
4. What does `--check --diff` do, and why run it before a real apply?
5. Why do handlers only fire once per play run even if notified multiple times?
6. Name two ways to keep secrets out of plaintext in your repo.
7. What's the purpose of `serial:` in a playbook?
8. What's the difference between static and dynamic inventory, and when would you choose dynamic?
9. You need the same nginx role for a client with a different config each time — where do the differences live: in the role's tasks, or elsewhere?
10. What command would you run to see exactly which modules exist for interacting with Docker inside Ansible?

---

## 9. Answers & Solutions

### Quiz Answers
1. Idempotent means running the task repeatedly produces the same end state without side effects on repeat runs. It matters because playbooks get re-run constantly (scheduled config-drift checks, re-provisioning after a crash) — non-idempotent tasks cause duplicate installs, restarts, or corrupted state.
2. A *play* maps one group of hosts to a list of tasks/roles; a *playbook* is the YAML file that can contain one or more plays.
3. `group_vars/db.yml` (or `group_vars/db/` directory for multiple files).
4. `--check` simulates the run without making changes; `--diff` shows the before/after of any file changes. Run both before applying to anything you can't easily roll back, especially production.
5. Because handlers are collected and deduplicated, then run once at the end of the play (or at explicit `meta: flush_handlers` points) — this avoids, e.g., restarting a service 5 times because 5 config files changed in one run.
6. Ansible Vault for encrypting variable files, and/or an external secrets manager (HashiCorp Vault, AWS Secrets Manager, SSM Parameter Store) referenced via a lookup plugin at runtime.
7. It controls how many hosts are acted on in each "batch" of a rolling update, limiting blast radius if something goes wrong mid-rollout.
8. Static inventory is a fixed file you maintain by hand; dynamic inventory is generated at runtime from a live source (cloud API, CMDB). Choose dynamic when your fleet changes often (autoscaling, ephemeral instances) — a static file would go stale immediately.
9. In variables (`defaults/main.yml` in the role, overridden per-client in `group_vars`/`host_vars` or `-e`), not in the tasks themselves. Tasks should stay generic; only data should vary.
10. `ansible-doc -l | grep docker` (or browse the `community.docker` collection docs).

### Project Solutions

**Project 1 — why "changed" shows every run:**
This almost always means `state: present` was used with `update_cache: true` on every run (cache update always reports changed) or the module used was `command`/`shell` running `apt-get install nginx` directly instead of the `apt` module. Fix: use the `apt` module (idempotent by design) and only set `update_cache: true` combined with `cache_valid_time: 3600` so it doesn't force a cache refresh every run:
```yaml
- name: Install nginx
  apt:
    name: nginx
    state: present
    update_cache: true
    cache_valid_time: 3600
```

**Project 2 — dynamic upstream template (`templates/nginx.conf.j2`):**
```jinja2
upstream app_backend {
{% for host in groups['app'] %}
    server {{ hostvars[host]['ansible_host'] | default(host) }}:{{ app_port }};
{% endfor %}
}

server {
    listen 80;
    location / {
        proxy_pass http://app_backend;
    }
}
```
This reads live from the `app` inventory group, so adding a server to the inventory (or to your dynamic inventory tags) is the only change needed — no template edits.

**Project 3 — rekeying safely:**
```bash
ansible-vault rekey group_vars/app/vault.yml \
  --vault-password-file .old_vault_pass \
  --new-vault-password-file .new_vault_pass
```
Store the password files outside version control (add to `.gitignore`), with restrictive permissions (`chmod 600`), and delete them immediately after rotation. In CI, source them from your CI system's secret store, not from disk.

**Project 4 — pre-flight health assertion:**
```yaml
- name: Confirm server is currently healthy before touching it
  uri:
    url: "http://{{ inventory_hostname }}:{{ app_port }}/health"
    status_code: 200
  register: health_check
  failed_when: false

- name: Abort this host's update if it was already unhealthy
  assert:
    that: health_check.status == 200
    fail_msg: "Skipping {{ inventory_hostname }} — already unhealthy before deploy started."
```
Combined with `serial: 1` and `max_fail_percentage: 20`, this keeps one bad server from ever compounding into a full outage.
