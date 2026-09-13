# Jenkins Quick-Learn Guide
### From a senior DevOps engineer's notebook — 10 years in the trenches

Jenkins is the tool almost every org has *somewhere*, even after trying three "modern" alternatives. It's not glamorous, but understanding it well — especially pipeline-as-code — transfers almost directly to GitLab CI, GitHub Actions, and CircleCI. Learn the concepts here, not just the UI clicks.

---

## 1. What Jenkins Solves

- **Continuous Integration (CI):** automatically build and test every commit, catching breakage early.
- **Continuous Delivery/Deployment (CD):** automatically push validated builds toward staging/production.
- **Orchestration hub:** Jenkins is often the "glue" that calls Docker builds, Ansible playbooks, Terraform applies, and notification systems in one coherent flow.

---

## 2. Core Concepts (know these cold)

| Term | What it means |
|---|---|
| **Controller (master)** | The Jenkins server that schedules jobs and serves the UI |
| **Agent (node)** | A machine (or container) that actually executes build steps |
| **Executor** | A slot on an agent that can run one build at a time |
| **Job** | A configured unit of work — Freestyle (UI-configured) or Pipeline (code-configured) |
| **Pipeline** | A job defined as code, either **Declarative** (structured, easier) or **Scripted** (Groovy, more flexible) |
| **Jenkinsfile** | The pipeline definition, checked into the repo alongside the app |
| **Stage / Step** | A named phase of a pipeline (`Build`, `Test`, `Deploy`), made up of individual steps |
| **Plugin** | Extends Jenkins — Git, Docker, Slack notifications, credentials binding, etc. |
| **Credentials store** | Encrypted storage for secrets (tokens, SSH keys, passwords) referenced by ID in pipelines |
| **Webhook** | A push notification from GitHub/GitLab that triggers a build immediately on commit/PR, instead of polling |
| **Multibranch pipeline** | Automatically discovers branches/PRs in a repo and creates a pipeline run for each |
| **Shared library** | Reusable Groovy code across multiple Jenkinsfiles (your org's common CI logic, written once) |

---

## 3. Install & First Contact

Fastest way to get a real Jenkins running locally is Docker:

```bash
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts

# Get the initial admin password:
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open `http://localhost:8080`, unlock with that password, install "suggested plugins," and create your first admin user.

---

## 4. Anatomy of a Declarative Pipeline

```groovy
pipeline {
    agent any

    environment {
        NODE_ENV = 'test'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }
        stage('Lint & Test') {
            steps {
                sh 'npm run lint'
                sh 'npm test'
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
    }

    post {
        always {
            junit 'test-results/*.xml'
        }
        failure {
            echo 'Build failed — notify the team here (Slack/email step).'
        }
    }
}
```

Key structural rules:
- `pipeline {}` is the top-level block — everything lives inside it.
- `agent` says *where* it runs (`any`, a specific `label`, or `docker { image '...' }`).
- `stages { stage(...) { steps {...} } }` — this nesting is mandatory in Declarative syntax.
- `post {}` runs cleanup/notification logic regardless of (or based on) build outcome.

---

## 5. Pipeline Syntax Cheat Sheet

| Block | Purpose |
|---|---|
| `agent { docker { image 'node:20' } }` | Run this stage/pipeline inside a container |
| `environment { VAR = 'value' }` | Set environment variables for the pipeline/stage |
| `parameters { string(name: 'VERSION', defaultValue: '') }` | Make the build accept input at trigger time |
| `when { branch 'main' }` | Conditionally run a stage |
| `withCredentials([usernamePassword(...)]) { }` | Safely inject a secret into a step's scope only |
| `parallel { }` | Run multiple stages/branches concurrently |
| `timeout(time: 10, unit: 'MINUTES') { }` | Fail a step/stage if it hangs |
| `retry(3) { }` | Retry a flaky step |
| `post { success {} failure {} always {} }` | Outcome-based hooks |
| `input message: 'Deploy to prod?'` | Manual approval gate |

---

## 6. Ten Years of Battle-Tested Best Practices

1. **Pipeline as code, always.** If your CI config only exists by clicking around the UI, it's not reviewable, versioned, or reproducible. Jenkinsfile lives in the repo.
2. **Prefer Declarative over Scripted** unless you have a genuine need for Groovy's full flexibility — Declarative is far easier for the next engineer to read.
3. **Never hardcode secrets in a Jenkinsfile.** Use the Credentials Manager and `withCredentials`; a leaked Jenkinsfile should never leak a password.
4. **Isolate builds with containers.** `agent { docker {...} }` per stage avoids "works on this one agent because someone manually installed X" drift.
5. **Fail fast, and fail loud.** Add `timeout()` to every long-running stage — a hung deploy step blocking the queue for 6 hours is a rite of passage everyone should skip.
6. **Clean the workspace.** `cleanWs()` in `post { always {} }` — disk-full agents are a classic 3 a.m. page.
7. **Parameterize instead of duplicating jobs.** One pipeline with a `deploy_env` parameter beats three nearly-identical Jenkinsfiles for dev/stage/prod.
8. **Use shared libraries once you have 3+ repos with similar CI logic.** Copy-pasted Jenkinsfile blocks rot independently and drift.
9. **Webhooks over polling.** SCM polling adds delay and unnecessary load; a webhook triggers instantly and scales better.
10. **Treat `main`/`prod` deploy stages as gated, not automatic**, unless you have strong automated test coverage and rollback tooling — an `input` approval step is cheap insurance.

---

## 7. Hands-On Projects

### Project 1 (Beginner) — Freestyle job for a Node.js app
**Goal:** Get comfortable with the UI and the build lifecycle before touching code-based pipelines.

Steps:
1. Push a simple Node/Express app (with a `package.json` and at least one test) to a Git repo.
2. Create a new **Freestyle project** in Jenkins.
3. Under *Source Code Management*, point it at your repo.
4. Under *Build Triggers*, enable "Poll SCM" with schedule `* * * * *` (every minute, for learning purposes only).
5. Under *Build Steps*, add an "Execute shell" step: `npm ci && npm test`.
6. Push a commit and watch Jenkins pick it up and run.

**Try-it-yourself challenge:** Make the build go red on purpose (break a test), confirm Jenkins reports failure clearly, then fix it and confirm it goes green again. What exit code does `npm test` need to return for Jenkins to mark the build failed?

---

### Project 2 (Intermediate) — Declarative pipeline for the same app
**Goal:** Replace the Freestyle job with a proper `Jenkinsfile`: checkout → install → lint → test → build → archive artifact.

Steps:
1. Add a `Jenkinsfile` to the repo root using the structure from Section 4.
2. Add an `archiveArtifacts` step in a `Build` stage to save the build output (e.g., a `dist/` folder or a zipped bundle).
3. Create a new Jenkins job of type **Pipeline**, and point "Pipeline script from SCM" at your repo/Jenkinsfile instead of pasting the script into the UI.
4. Run it, then open the artifact from the build's page to confirm it's downloadable.

**Try-it-yourself challenge:** Add a `post { failure { ... } }` block that prints a clear, actionable failure summary (which stage failed and why) instead of Jenkins' default noisy console output.

---

### Project 3 (Intermediate-Advanced) — Webhook-triggered multibranch pipeline
**Goal:** Move from polling to instant, PR-aware builds.

Steps:
1. Create a **Multibranch Pipeline** job pointing at your GitHub repo.
2. In GitHub, add a webhook to your Jenkins URL (`http://<jenkins-host>/github-webhook/`) for push and pull-request events (use a tunneling tool like `ngrok` if Jenkins is only running locally).
3. Open a pull request against `main` and confirm Jenkins automatically discovers the branch and runs the pipeline against it.
4. Add a `when { branch 'main' }` conditional stage that only runs a deploy step on the main branch, never on feature branches.

**Try-it-yourself challenge:** Add a `when { changeRequest() }` block so PR builds run tests only (fast feedback), while direct pushes to `main` run the full build+deploy pipeline.

---

### Project 4 (Advanced) — Full CI/CD: build → Docker image → push → deploy via Ansible
**Goal:** Tie this guide together with the Docker and Ansible guides — a Jenkinsfile that builds a Docker image, pushes it to a registry, and triggers an Ansible playbook to roll it out.

Steps:
1. Add a `Dockerfile` to your app (see the Docker guide, Project 1, for a Node.js example).
2. In the Jenkinsfile, add a `Build Image` stage: `docker build -t yourname/app:${env.BUILD_NUMBER} .`
3. Add a `Push Image` stage using `withCredentials` to inject registry credentials, then `docker push`.
4. Add a `Deploy` stage, gated behind `when { branch 'main' }` and an `input` approval step, that runs:
   `ansible-playbook -i inventory.ini deploy.yml -e "app_version=${env.BUILD_NUMBER}"`
5. Confirm the whole chain runs end-to-end from a single commit to `main`.

**Try-it-yourself challenge:** Add a rollback stage triggered manually (a separate parameterized pipeline) that re-runs the Ansible deploy with a previous `BUILD_NUMBER` tag — how would you make sure old images aren't garbage-collected before you might need them for rollback?

---

## 8. Knowledge Check

1. What's the practical difference between a controller and an agent?
2. Why is Declarative pipeline generally preferred over Scripted for most teams?
3. Where should a database password used in a pipeline be stored, and how is it referenced safely in a Jenkinsfile?
4. What does a Multibranch Pipeline job do that a regular Pipeline job doesn't?
5. What's the purpose of the `post {}` block, and name two of its condition types.
6. Why prefer webhooks over "Poll SCM"?
7. What does `agent { docker { image 'node:20' } }` buy you over just running `agent any` on a bare-metal Jenkins agent?
8. What is a shared library for, and when should you introduce one?
9. What does `timeout()` protect against?
10. Why gate a production deploy stage behind `input`, even with good test coverage?

---

## 9. Answers & Solutions

### Quiz Answers
1. The controller schedules work and serves the web UI; the agent is where the actual build/test/deploy commands execute. Separating them lets you scale build capacity horizontally and isolate build environments from the controller itself.
2. Declarative has a fixed, validated structure that's easier to read, lint, and onboard new engineers onto; Scripted (raw Groovy) is more powerful but harder to review and more error-prone at scale.
3. In Jenkins' Credentials Manager, referenced by ID via `withCredentials([usernamePassword(credentialsId: 'db-cred', usernameVariable: 'DB_USER', passwordVariable: 'DB_PASS')])` — the value is masked in logs and scoped only to that block.
4. It automatically scans the repository for branches and pull requests and creates/removes pipeline jobs for each one, rather than you manually managing one job per branch.
5. It runs cleanup/notification logic after the pipeline completes, regardless of stage outcomes. Common conditions: `always`, `success`, `failure`, `unstable`, `changed`.
6. Webhooks trigger builds instantly on the actual event and don't waste resources or add latency repeatedly asking "did anything change yet?" like polling does.
7. It guarantees a clean, reproducible, versioned build environment every run — no dependency drift from whatever happens to be installed on a shared bare-metal agent.
8. A shared library centralizes reusable Groovy pipeline logic (e.g., a standard "build and notify Slack" function) so multiple Jenkinsfiles can call one shared, tested implementation instead of duplicating logic. Introduce one once you have several repos with near-identical pipeline code.
9. A step or stage that hangs indefinitely (network call that never returns, a stuck process) — without a timeout it can block an executor and the whole queue behind it forever.
10. Even solid test suites don't catch everything (infra issues, bad config, unexpected production data shape) — a human approval gate is a cheap final check before an irreversible or hard-to-reverse action.

### Project Solutions

**Project 1 — exit code behavior:**
Jenkins marks a shell build step failed whenever the underlying command returns a non-zero exit code. `npm test` (via most test runners like Jest/Mocha) already returns non-zero automatically when any test fails — no extra config needed. If you ever wrap tests in a script that swallows the exit code (e.g., piping to `tee` without `set -o pipefail`), Jenkins will falsely report success, so always verify the real exit code propagates.

**Project 2 — clear failure summary:**
```groovy
post {
    failure {
        script {
            echo "❌ Pipeline failed at stage: ${env.STAGE_NAME}"
            echo "Check console output above for the first red 'ERROR' line — that's almost always the real cause."
        }
    }
}
```
For more precision, wrap each stage's steps in a `try/catch` inside a `script {}` block and store the failing stage name in an environment variable, then reference it in `post`.

**Project 3 — PR-only fast path:**
```groovy
stage('Test (PR)') {
    when { changeRequest() }
    steps { sh 'npm test' }
}
stage('Build & Deploy (main)') {
    when { branch 'main' }
    steps {
        sh 'npm run build'
        sh 'ansible-playbook -i inventory.ini deploy.yml'
    }
}
```
`changeRequest()` is true only for pull-request builds, letting you skip the expensive build/deploy stages entirely on PRs.

**Project 4 — safe rollback:**
```groovy
parameters {
    string(name: 'ROLLBACK_VERSION', defaultValue: '', description: 'Previous BUILD_NUMBER to redeploy')
}
stage('Rollback') {
    when { expression { params.ROLLBACK_VERSION != '' } }
    steps {
        sh "ansible-playbook -i inventory.ini deploy.yml -e \"app_version=${params.ROLLBACK_VERSION}\""
    }
}
```
To make sure old images survive long enough to roll back to, set an explicit retention policy on your registry (e.g., "keep last 10 tags" or "keep tags for 30 days") rather than relying on default garbage collection, which is often more aggressive than teams expect.
