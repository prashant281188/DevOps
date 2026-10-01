# Production-Ready 3-Tier Web Application

A resilient, scalable 3-tier monorepo architecture built with Next.js (Presentation Tier), Express + TypeScript (Application Tier), and PostgreSQL + Drizzle ORM (Data Tier). Designed specifically for learning, testing, and implementing production DevOps patterns (Dockerization, CI/CD pipelines, health probes, Prometheus metrics, and graceful shutdowns).

---

## Architecture Overview

```text
+--------------------------------------------------------------+
|                Presentation Tier (apps/web)                  |
|                 Next.js 14+ (Port 3000)                      |
+------------------------------+-------------------------------+
                               | HTTP / SSR / REST
+------------------------------v-------------------------------+
|                 Application Tier (apps/api)                  |
|             Express + TypeScript (Port 5000)                 |
|       [Health Probes | Prometheus Metrics | Drizzle]         |
+------------------------------+-------------------------------+
                               | PostgreSQL Protocol (Port 5432)
+------------------------------v-------------------------------+
|                    Data Tier (Database)                      |
|                   PostgreSQL 15+ / 16+                       |
+--------------------------------------------------------------+
```

---

## Prerequisites

Ensure you have the following installed on your host machine:

- **Node.js**: `v20.x` or higher (LTS recommended)
- **npm**: `v10.x` or higher
- **PostgreSQL**: Running locally or inside a Docker container (default port: `5432`)

---

## 1. Local Setup & Configuration

### Clone and Install Dependencies

From the root directory of the monorepo, install dependencies for all workspaces:

```bash
npm install
```

### Configure Environment Variables

Create `.env` files for the root/services.

1. **Root `.env` (used for shared environments or container references):**
   ```bash
   cp .env.example .env
   ```

2. **API Tier `.env` (`apps/api/.env`):**
   ```env
   NODE_ENV=development
   PORT=5000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/production_db
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **Web Tier `.env.local` (`apps/web/.env.local`):**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

---

## 2. Database Provisioning & Migrations

### Step 1: Ensure PostgreSQL is Running

If running PostgreSQL via Docker CLI:

```bash
docker run --name postgres-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=production_db \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### Step 2: Generate Drizzle Migration Files

Generate the SQL schema files into the `apps/api/drizzle` directory:

```bash
npm run db:generate
```

### Step 3: Apply Migrations

Run pending migrations against the PostgreSQL instance:

```bash
npm run db:migrate
```

---

## 3. Running the Application Locally

You can run both tiers concurrently in separate terminals or run them targeted via workspace commands.

### Terminal 1: Application Tier (API)

```bash
npm run dev:api
```
The API server will boot with live-reload on **`http://localhost:5000`**.

### Terminal 2: Presentation Tier (Web)

```bash
npm run dev:web
```
The Next.js client will start on **`http://localhost:3000`**.

Visit [http://localhost:3000](http://localhost:3000) to test adding and listing records.

---

## 4. Production Build Verification

To test production compilation locally:

```bash
# Build API TypeScript to dist/
npm run build:api

# Build Next.js standalone package
npm run build:web

# Run compiled API
npm --workspace=@app/api run start

# Run compiled Web
npm --workspace=@app/web run start
```

---

## 5. DevOps Endpoints & Readiness Checks

The API tier is instrumented with standard endpoints designed for load balancers, Kubernetes probes, and monitoring servers:

| Endpoint | Purpose | Target Use Case |
| :--- | :--- | :--- |
| `GET /health/live` | **Liveness Probe** | Checks if the Node.js process is active. |
| `GET /health/ready` | **Readiness Probe** | Executes `SELECT 1` on the DB pool to confirm readiness before routing traffic. |
| `GET /metrics` | **Prometheus Metrics** | Exposes default process runtime metrics and HTTP response duration histograms. |
| `GET /api/v1/items` | **Application Data** | Fetches records from PostgreSQL via Drizzle. |
| `POST /api/v1/items` | **Application Data** | Inserts records into PostgreSQL via Drizzle. |

---

## 6. Useful Commands Summary

| Command | Action |
| :--- | :--- |
| `npm run dev:api` | Start API in development mode (with `tsx watch`) |
| `npm run dev:web` | Start Next.js frontend in development mode |
| `npm run build:api` | Transpile Express TypeScript to JavaScript |
| `npm run build:web` | Build production Next.js standalone application |
| `npm run db:generate` | Scan `schema.ts` and create SQL migrations |
| `npm run db:migrate` | Execute pending SQL migrations against the database |
