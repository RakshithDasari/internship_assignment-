# Setup guide

How to get VisionQuest running, check that it's healthy, and fix common problems. For an overview of
the project, see the [README](../README.md).

- [1. Clone and configure](#1-clone-and-configure)
- [2. Build and start](#2-build-and-start)
- [3. Check that every service is healthy](#3-check-that-every-service-is-healthy)
- [4. Model weights](#4-model-weights)
- [5. Stop, update, clean up](#5-stop-update-clean-up)
- [6. Running without Docker](#6-running-without-docker)
- [7. Troubleshooting](#7-troubleshooting)

## 1. Clone and configure

Install Docker first: Docker Desktop on Windows or macOS, Docker Engine with the Compose plugin on
Linux. Check it works:

```bash
docker --version
docker compose version
```

Clone the repository and go into it. All `docker compose` commands below run from this folder,
because that is where `docker-compose.yml` lives.

```bash
git clone https://github.com/RakshithDasari/internship_assignment-.git visionquest
cd visionquest
```

Configuration is optional. Every setting has a working default, so you can skip straight to step 2.
To change something (for example the upload limit), copy the template and edit it:

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

All variables are described in the [README](../README.md#configuration).

## 2. Build and start

**CPU (works everywhere):**

```bash
docker compose up --build -d
```

**NVIDIA GPU:** first check that Docker can see the GPU. This should print a table with your card:

```bash
docker run --rm --gpus all ubuntu nvidia-smi
```

The top right of that table shows `CUDA Version`; it must be **13.2 or higher**. If it's lower, update
the NVIDIA driver. Then start with the GPU override:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d
```

Docker Desktop on Windows supports GPUs through its WSL 2 backend out of the box. On Linux, install
the NVIDIA Container Toolkit first.

**What the first build does** (about 10–15 minutes on CPU, longer with the GPU override):

| Step | Image | Notes |
|---|---|---|
| Install ffmpeg and system libraries | backend | ffmpeg produces browser-playable H.264 video |
| Install PyTorch | backend | CPU build by default; CUDA build with the override (3–4 GB) |
| Install Python dependencies | backend | Pinned in `backend/requirements.txt` |
| Download model weights | backend | All four models plus CLIP, baked into the image |
| `npm ci` and `next build` | frontend | Multi-stage; the final image holds only the built server |

`-d` runs the stack in the background. Leave it off to watch all logs in the terminal (Ctrl+C then
stops everything).

## 3. Check that every service is healthy

Every service has a health check, and Compose starts them in order: `redis`, then `backend` and
`worker`, then `frontend`. Within about a minute of starting:

```bash
docker compose ps
```

```text
NAME                     SERVICE    STATUS
visionquest-backend-1    backend    Up 2 minutes (healthy)
visionquest-frontend-1   frontend   Up 2 minutes (healthy)
visionquest-redis-1      redis      Up 2 minutes (healthy)
visionquest-worker-1     worker     Up 2 minutes (healthy)
```

`(health: starting)` means it is still checking; run the command again after a few seconds.

The backend's health endpoint reports on every part of the pipeline:

```bash
curl http://localhost:8000/health
```

```json
{"status":"ok","api":"ok","redis":"ok","worker":"ok","ffmpeg":true,"device":"cpu",
 "max_file_size_mb":500,"allowed_extensions":["avi","jpeg","jpg","mov","mp4","png"]}
```

- `status` is `ok` when Redis, the worker and ffmpeg are all available, and `degraded` otherwise.
- `device` is the device jobs will use: `cpu`, `cuda:0` (NVIDIA) or `xpu:0` (Intel, native runs).

Then open http://localhost:3000. The nav bar's status dot reads **Live** when everything is up; hover
it for details.

**Checking services one by one:**

```bash
docker compose exec redis redis-cli ping                                    # PONG
docker compose exec worker celery -A app.workers.celery_app inspect ping    # pong from the worker
docker compose logs backend          # or worker, frontend, redis
docker compose logs -f worker        # follow the worker while a job runs
```

## 4. Model weights

**They are bundled.** The backend Dockerfile runs `python -m app.models.registry` at build time,
which downloads all four models (`yolov8n`, `yolov8s`, `yolov8s-worldv2`, `yolov8n-seg`) and the CLIP
text encoder that YOLO-World needs into `/weights` inside the image. Containers therefore start
without network access to model hosts, and the first job doesn't wait on downloads.

The weights are downloaded again only when the image is rebuilt from that step onward (for example
after changing `requirements.txt`).

When running natively, weights go to `WEIGHTS_DIR` and download automatically on first use. To fetch
them all up front, run this from `backend/`:

```bash
python -m app.models.registry
```

## 5. Stop, update, clean up

```bash
docker compose down                # stop and remove containers; jobs and files are kept
docker compose up -d               # start again (no rebuild)
git pull && docker compose up --build -d    # update to the latest code

docker compose down -v             # also delete all jobs, uploads and results
docker compose down -v --rmi all   # also delete the built images (frees ~4 GB)
docker builder prune -f            # clear Docker's build cache
```

If you started with the GPU override, add `-f docker-compose.yml -f docker-compose.gpu.yml` to these
commands.

## 6. Running without Docker

Useful for development, or to use an Intel Arc GPU, which Docker Desktop can't pass into containers.
You need Python 3.11, Node.js 22, ffmpeg on `PATH`, and Docker only for Redis.

**Redis:**

```bash
docker run -d --name vq-redis -p 6379:6379 redis:7.4-alpine
```

**Backend and worker** (from `backend/`):

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# PyTorch for your hardware (pick one):
pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu     # CPU
pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/xpu     # Intel Arc
pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cu132   # NVIDIA

pip install -r requirements.txt -r requirements-dev.txt
```

Create a `.env` in the repository root (the backend finds it by searching upward):

```bash
REDIS_URL=redis://localhost:6379/0
DATA_DIR=./data
WEIGHTS_DIR=./weights
CORS_ORIGINS=http://localhost:3000
```

Then start the API and the worker in two terminals, both from `backend/`:

```bash
uvicorn app.main:app --reload --port 8000
celery -A app.workers.celery_app worker --pool=solo --loglevel=INFO
```

`--pool=solo` is required on Windows; on Linux and macOS you can leave it out.

**Frontend** (from `frontend/`):

Create `frontend/.env.local` containing this one line (with an editor; on Windows PowerShell 5.1,
`echo ... >` saves the file in UTF-16, which Next.js can't read):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Then:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Ports 3000 and 8000 are the same as the Docker stack's, so stop that first
(`docker compose down`).

## 7. Troubleshooting

**A port is already in use** (`ports are not available` or `bind: address already in use`)

Another program (often a dev server) holds port 3000 or 8000. Find and stop it:

```bash
netstat -ano | findstr :3000     # Windows; the last column is the process ID
lsof -i :3000                    # macOS / Linux
```

Or publish the app on other ports by editing `ports` in `docker-compose.yml` (for example
`"3001:3000"`). If you change the backend's port, set `NEXT_PUBLIC_API_BASE_URL` to match and rebuild;
if you change the frontend's, add the new address to `CORS_ORIGINS`.

**The GPU isn't detected** (`/health` shows `"device":"cpu"`, and the upload page says "CPU only")

- Run `nvidia-smi` on the host. If it fails, install or repair the NVIDIA driver.
- Run `docker run --rm --gpus all ubuntu nvidia-smi`. If that fails, Docker has no GPU access: on
  Windows, make sure Docker Desktop uses the WSL 2 backend; on Linux, install the NVIDIA Container
  Toolkit.
- Check that `CUDA Version` in `nvidia-smi` is 13.2 or higher; update the driver if not.
- Make sure you started with both files: `-f docker-compose.yml -f docker-compose.gpu.yml`.
- Intel and AMD GPUs are not available inside Docker. The app falls back to CPU automatically. For
  Intel Arc, run natively (section 6).

**Out of memory** (the worker restarts, `docker compose ps` shows `Exited (137)`, or jobs fail)

- Give Docker more memory: Docker Desktop → Settings → Resources, 8 GB recommended.
- Use `yolov8n`, the smallest model, and shorter or lower-resolution clips.
- The worker already processes one job at a time and caps output video at 1080p.

**The page loads but says "API offline" or "Can't reach the server"**

- The backend may still be starting; wait until `docker compose ps` shows it `healthy`.
- If you open the app from another address (another machine, or a changed port), set
  `NEXT_PUBLIC_API_BASE_URL` and `CORS_ORIGINS` in `.env` to match, then
  `docker compose up --build -d`.

**Uploads fail with "Job queue is unavailable"**

Redis or the worker is down. Check `docker compose ps` and `docker compose logs worker`.

**A job stays "processing" after a crash or restart**

When the worker starts, it marks interrupted jobs as failed ("Processing was interrupted. Please
re-run."). Restart it with `docker compose restart worker`, then upload again.

**The build fails while installing PyTorch**

Usually a network problem; run the command again. If you changed the PyTorch version, make sure the
index URL in `docker-compose.gpu.yml` (`cu132`) offers that version: each CUDA version has its own
package index.

**Processing is slow**

CPU inference takes about 5 frames per second for 4K video with `yolov8n` on a laptop. Use the NVIDIA
override if you have a GPU, pick `yolov8n`, or upload shorter clips.
