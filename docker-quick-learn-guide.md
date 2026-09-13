# Docker Quick-Learn Guide
### From a senior DevOps engineer's notebook — 10 years in the trenches

Docker is the tool that quietly ended "works on my machine" as an acceptable excuse. If you only learn one thing well from this guide, make it multi-stage builds and layer caching — that's where 90% of real-world Docker pain (huge images, slow CI builds, leaked build-time secrets) actually gets solved.

---

## 1. What Docker Solves

- **Consistency:** the same image runs identically on your laptop, in CI, and in production.
- **Isolation:** each container gets its own filesystem, process space, and network namespace — no more dependency collisions between apps on one host.
- **Density & speed:** containers share the host kernel, so they start in milliseconds and use far less overhead than a full VM.
- **Packaging:** an image is a single portable artifact — code, runtime, dependencies, and config baked into one versioned unit.

---

## 2. Core Concepts (know these cold)

| Term | What it means |
|---|---|
| **Image** | A read-only, layered filesystem snapshot built from a `Dockerfile` |
| **Container** | A running (or stopped) instance of an image, with a writable layer on top |
| **Dockerfile** | The recipe: base image, files to copy, commands to run, what to execute on start |
| **Layer** | Each Dockerfile instruction creates a cached, reusable filesystem layer |
| **Registry** | Where images are stored/pulled from (Docker Hub, ECR, GHCR, private registries) |
| **Volume** | Persistent storage that survives container removal, managed by Docker |
| **Bind mount** | Mapping a host directory directly into a container (common in local dev) |
| **Network** | Virtual networking so containers can talk to each other by name |
| **docker-compose** | A YAML-based tool for defining and running multi-container applications together |
| **Multi-stage build** | Using multiple `FROM` stages in one Dockerfile so build tools don't bloat the final runtime image |
| **.dockerignore** | Excludes files (like `node_modules`, `.git`) from the build context, speeding up builds |

---

## 3. Install & First Contact

Install Docker Desktop (Mac/Windows) or Docker Engine (Linux) from the official docs, then confirm:

```bash
docker --version
docker run hello-world
```

A minimal `Dockerfile` for a Node.js/Express app:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run it:

```bash
docker build -t my-express-app:1.0 .
docker run -d -p 3000:3000 --name express-app my-express-app:1.0
curl http://localhost:3000
```

---

## 4. Command Cheat Sheet

| Command | Purpose |
|---|---|
| `docker build -t name:tag .` | Build an image from the Dockerfile in the current directory |
| `docker run -d -p 8080:80 --name c1 image` | Run a container, detached, with port mapping |
| `docker ps` / `docker ps -a` | List running / all containers |
| `docker logs -f c1` | Stream a container's logs |
| `docker exec -it c1 sh` | Get an interactive shell inside a running container |
| `docker stop c1 && docker rm c1` | Stop and remove a container |
| `docker images` | List local images |
| `docker rmi image:tag` | Remove an image |
| `docker system prune -a` | Clean up unused containers/images/networks (careful in shared environments) |
| `docker volume create data1` | Create a named volume |
| `docker network create mynet` | Create a custom network |
| `docker-compose up -d` | Start all services defined in `docker-compose.yml`, detached |
| `docker-compose down -v` | Stop services and remove volumes |
| `docker-compose logs -f service_name` | Tail logs for one service |

---

## 5. Ten Years of Battle-Tested Best Practices

1. **Use small, official base images.** `node:20-alpine` over `node:20` unless you specifically need glibc — smaller images pull faster and have a smaller attack surface.
2. **Order your Dockerfile for cache efficiency.** Copy `package.json`/`package-lock.json` and run `npm ci` *before* copying the rest of your source — dependency layers stay cached across builds where only app code changed.
3. **Always use a `.dockerignore`.** `node_modules`, `.git`, `.env`, and build artifacts should never enter the build context.
4. **Multi-stage builds for anything compiled or bundled.** Ship the runtime, not the build toolchain.
5. **Don't run as root inside the container.** Create and switch to a non-root user in the Dockerfile.
6. **One primary process per container.** Don't run a database, a web server, and a cron daemon in one container "for convenience" — it breaks logging, restarts, and scaling assumptions.
7. **Pin versions explicitly.** `node:20.11-alpine`, not `node:latest` — "latest" silently changing is a classic source of "it broke overnight and nobody touched anything."
8. **Add a `HEALTHCHECK`.** Orchestrators (Compose, Kubernetes, ECS) can only route around unhealthy containers if they know how to check health.
9. **Never bake secrets into an image.** Anyone with the image can `docker history`/inspect layers and pull secrets out, even from "deleted" layers. Use environment variables at runtime, secret managers, or build-time secret mounts (`--secret` with BuildKit).
10. **Set resource limits in production.** An unbounded container with a memory leak can starve every other container on the same host — `--memory`/`--cpus` (or compose/orchestrator equivalents) are not optional at scale.

---

## 6. Hands-On Projects

### Project 1 (Beginner) — Dockerize a Node/Express app
**Goal:** Get a real app running in a container with a properly cached Dockerfile.

Steps:
1. Use (or create) a simple Express app with a `/health` route returning `200 OK`.
2. Write a `Dockerfile` as shown in Section 3, plus a `.dockerignore` excluding `node_modules` and `.git`.
3. Build the image, run the container, and confirm `curl localhost:3000/health` works.
4. Change only a line of app code (not `package.json`) and rebuild — confirm the `npm ci` layer is reused from cache (look for "CACHED" in the build output).

**Try-it-yourself challenge:** Intentionally reorder the Dockerfile so `COPY . .` happens *before* `COPY package*.json ./` and `npm ci`. Rebuild after an app-code-only change and observe what breaks in caching. Explain why.

---

### Project 2 (Intermediate) — Multi-container app with docker-compose
**Goal:** Run your Express app alongside MongoDB and Redis, wired together with Compose.

Steps:
1. Write a `docker-compose.yml` with three services: `app` (build from your Dockerfile), `mongo` (official `mongo` image with a named volume for data), and `redis` (official `redis` image).
2. Use Compose's built-in DNS — your app should connect to Mongo via hostname `mongo`, not `localhost` or a hardcoded IP.
3. Put `mongo` and `redis` on a custom network, and only expose the `app` service's port to the host.
4. `docker-compose up -d`, confirm the app can read/write to Mongo and cache a value in Redis.

**Try-it-yourself challenge:** Add a `depends_on` with a `condition: service_healthy` so the app container doesn't start until Mongo's `HEALTHCHECK` passes, instead of just starting in an arbitrary order.

---

### Project 3 (Intermediate-Advanced) — Multi-stage build for production
**Goal:** Shrink your image and remove build tooling from the shipped artifact, using a TypeScript-based Express app as the example (build stage compiles TS → JS; runtime stage only ships the compiled output).

Steps:
1. Add a `build` stage: `FROM node:20-alpine AS build`, install *all* dependencies (including dev deps), run `npm run build` (e.g., `tsc`).
2. Add a `runtime` stage: fresh `FROM node:20-alpine`, copy only `package*.json`, run `npm ci --omit=dev`, then `COPY --from=build /app/dist ./dist`.
3. Create a non-root user in the runtime stage and switch to it before `CMD`.
4. Add a `HEALTHCHECK` instruction pointing at your `/health` route.
5. Compare `docker images` size for the single-stage vs. multi-stage version.

**Try-it-yourself challenge:** Confirm that `docker history` on the final image shows no trace of TypeScript, `tsc`, or dev dependencies — only the compiled JS and production `node_modules`.

---

### Project 4 (Advanced) — Custom networking, persistent volumes, and resource limits
**Goal:** Harden the Project 2 setup for something closer to production reality.

Steps:
1. Replace the default Compose network with an explicitly defined custom bridge network.
2. Confirm the Mongo data volume survives `docker-compose down` (but not `docker-compose down -v`) by writing data, tearing down, bringing back up, and checking it's still there.
3. Add `mem_limit`/`cpus` (Compose) or `deploy.resources.limits` constraints to the `app` service.
4. Write a simple backup command using `docker exec` + `mongodump` that dumps the database to a bind-mounted host directory, and a matching restore command with `mongorestore`.

**Try-it-yourself challenge:** Simulate a container running out of memory (a small script that leaks memory) with a low `mem_limit` set, and observe Docker OOM-killing just that container — confirm the rest of your stack (Mongo, Redis) keeps running unaffected.

---

## 7. Knowledge Check

1. What's the practical difference between an image and a container?
2. Why does instruction order in a Dockerfile matter for build speed?
3. What problem does `.dockerignore` solve?
4. Why is a multi-stage build usually better than a single `FROM` with cleanup commands at the end?
5. Why shouldn't you run a container process as root?
6. What's the difference between a named volume and a bind mount, and when would you use each?
7. How do containers on the same Compose network find each other?
8. Why avoid baking secrets directly into an image layer, even if you delete the file in a later `RUN` step?
9. What does a `HEALTHCHECK` actually enable an orchestrator to do?
10. Why set explicit memory/CPU limits on containers in production?

---

## 8. Answers & Solutions

### Quiz Answers
1. An image is the immutable, read-only template (layers + metadata); a container is a running (or stopped) instance of that image with its own writable layer, process, and network namespace on top.
2. Docker caches each layer and only re-runs an instruction (and everything after it) if that instruction or its inputs changed. Putting rarely-changing steps (installing dependencies) before frequently-changing steps (copying app code) means most builds reuse cached layers and finish much faster.
3. It keeps unnecessary or sensitive files (`node_modules`, `.git`, `.env`, local build artifacts) out of the build context sent to the Docker daemon, which speeds up builds and prevents accidentally baking secrets or bloat into the image.
4. A single-stage image with a cleanup `RUN rm -rf ...` still has those files in an earlier layer — deleting them in a later layer doesn't remove them from the image's total size or history, since layers are immutable and additive. A multi-stage build only copies the final needed artifacts into a clean final stage, so the build tools genuinely never exist in the shipped image.
5. If an attacker compromises the app process, running as root inside the container gives them root within that container's namespace, which increases the potential impact of container breakout vulnerabilities and violates least-privilege practice.
6. A named volume is managed entirely by Docker (stored in Docker's own storage area, portable across host reinstalls) — best for persistent app/database data. A bind mount maps a specific host path directly into the container — best for local development (live-reloading source code) where you need direct host filesystem access.
7. Compose automatically creates a network per project and registers each service's name as a DNS hostname on that network — services reach each other using the service name (e.g., `mongo`, `redis`) as the hostname.
8. Docker images are made of layers, and layers are immutable and cumulative — anyone with access to the image can inspect earlier layers directly (`docker history`, extracting layer tarballs) even if a later layer deletes the file, so the secret is still recoverable.
9. It lets the orchestrator (Compose, Kubernetes, ECS, Swarm) know whether a container is actually ready/healthy versus just "running," so it can avoid routing traffic to (or restart) containers that are up but non-functional.
10. Without limits, a single misbehaving container (memory leak, runaway CPU loop) can exhaust host resources and degrade or crash every other container sharing that host — limits contain the blast radius to just that one container.

### Project Solutions

**Project 1 — why reordering breaks caching:**
If `COPY . .` happens before `COPY package*.json ./` + `npm ci`, then *any* change to app source code invalidates the layer cache starting at `COPY . .` — which now sits before the dependency install step. That forces `npm ci` to re-run on every single build, even when `package.json` didn't change, making builds far slower. Correct order: copy only the dependency manifests first, install, *then* copy the rest of the source.

**Project 2 — health-gated startup (`docker-compose.yml` excerpt):**
```yaml
services:
  mongo:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 3s
      retries: 5
    volumes:
      - mongo_data:/data/db
    networks:
      - backend

  app:
    build: .
    depends_on:
      mongo:
        condition: service_healthy
    ports:
      - "3000:3000"
    networks:
      - backend

networks:
  backend:

volumes:
  mongo_data:
```

**Project 3 — multi-stage Dockerfile:**
```dockerfile
# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```
`docker history <image>` on this final image will show only the runtime-stage layers — TypeScript and dev dependencies were left behind in the discarded `build` stage.

**Project 4 — backup/restore commands:**
```bash
# Backup
docker exec mongo mongodump --out /tmp/backup
docker cp mongo:/tmp/backup ./host-backup

# Restore
docker cp ./host-backup mongo:/tmp/backup
docker exec mongo mongorestore /tmp/backup
```
For the OOM test, set `mem_limit: 50m` on a throwaway test service running a small script that keeps allocating memory in a loop — `docker inspect <container>` afterward will show `OOMKilled: true` on that container specifically, while `docker ps` confirms Mongo/Redis were entirely unaffected.
