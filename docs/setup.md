# Setup

How to get VisionQuest running, check it's healthy, and fix the usual problems.

## 1. Get the code

Install Docker (Docker Desktop on Windows or macOS, Docker Engine with Compose on Linux), then:

```bash
git clone https://github.com/RakshithDasari/internship_assignment-.git visionquest
cd visionquest
```

Run all the `docker compose` commands below from this folder.

A `.env` file is optional, since every setting has a default. If you want to change something, like
the upload limit, copy `.env.example` to `.env` and edit it. The variables are listed in the
[README](../README.md#configuration).

## 2. Start it

```bash
docker compose up --build -d
```

The first build takes 10 to 15 minutes. It installs ffmpeg and PyTorch, downloads the model weights
into the image, and builds the frontend. Later builds reuse the cache and take seconds. `-d` runs
everything in the background; leave it off if you want to watch the logs.

### With an NVIDIA GPU

Check that Docker can see the GPU first. This should print a table with your card in it:

```bash
docker run --rm --gpus all ubuntu nvidia-smi
```

The `CUDA Version` in the top right needs to be 13.2 or higher; if it isn't, update the driver. Then:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d
```

This build is slower because the CUDA version of PyTorch is a few GB. Docker Desktop on Windows
supports GPUs out of the box; on Linux you need the NVIDIA Container Toolkit.

## 3. Check it's healthy

```bash
docker compose ps
```

After a minute or so, all four services (`redis`, `backend`, `worker`, `frontend`) should say
`healthy`. If one says `health: starting`, give it a few more seconds.

The backend also has a health endpoint:

```bash
curl http://localhost:8000/health
```

```json
{"status":"ok","api":"ok","redis":"ok","worker":"ok","ffmpeg":true,"device":"cpu", ...}
```

`device` shows what jobs will run on: `cpu`, or `cuda:0` with an NVIDIA GPU.

Then open http://localhost:3000. The dot in the top right of the page says "Live" when everything is
running. If something's wrong, `docker compose logs backend` (or `worker`, `frontend`, `redis`) shows
why.

## 4. Model weights

The weights are downloaded during the build and stored in the image, so nothing extra needs to be
done and the first job doesn't wait for a download. That covers all four models plus the CLIP text
encoder YOLO-World needs, about 400 MB.

When running without Docker, weights download automatically the first time a model is used. To get
them all up front, run `python -m app.models.registry` from `backend/`.

## 5. Stopping and cleaning up

```bash
docker compose down                  # stop; jobs and files are kept
docker compose down -v               # stop and delete all jobs and files
docker compose down -v --rmi all     # also delete the images (frees about 4 GB)
```

If you started with the GPU file, include `-f docker-compose.yml -f docker-compose.gpu.yml` here too.
To update to the latest code: `git pull`, then `docker compose up --build -d`.

## 6. Running without Docker

This is handy for development, and it's the only way to use an Intel Arc GPU. You need Python 3.11,
Node 22 and ffmpeg. Redis still runs in Docker:

```bash
docker run -d --name vq-redis -p 6379:6379 redis:7.4-alpine
```

Backend, from `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# PyTorch for your hardware: use .../whl/cpu, .../whl/xpu (Intel Arc) or .../whl/cu132 (NVIDIA)
pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt -r requirements-dev.txt
```

Create a `.env` in the repository root with:

```text
REDIS_URL=redis://localhost:6379/0
DATA_DIR=./data
WEIGHTS_DIR=./weights
CORS_ORIGINS=http://localhost:3000
```

Then run the API and the worker in two terminals, both from `backend/`:

```bash
uvicorn app.main:app --reload --port 8000
celery -A app.workers.celery_app worker --pool=solo --loglevel=INFO
```

(`--pool=solo` is needed on Windows.)

Frontend, from `frontend/`: create a file called `.env.local` containing
`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`, then run `npm ci` and `npm run dev`.

This uses the same ports as the Docker setup, so stop that first.

## 7. Troubleshooting

**Port 3000 or 8000 is already in use.** Something else is using it, often a leftover dev server.
Find it with `netstat -ano | findstr :3000` on Windows or `lsof -i :3000` on macOS/Linux and stop it.
Or change the port in `docker-compose.yml`; if you move the backend, update
`NEXT_PUBLIC_API_BASE_URL` too, and if you move the frontend, update `CORS_ORIGINS`.

**The GPU isn't being used** (`/health` says `cpu`). Check that `nvidia-smi` works on the host, then
run the `docker run --gpus all` test from section 2, and make sure you started with both compose
files. Intel and AMD GPUs can't be used from Docker; the app just runs on CPU.

**The worker keeps restarting or jobs fail on big videos.** Docker is probably running out of memory.
Give it more in Docker Desktop (Settings → Resources, 8 GB is comfortable), or use `yolov8n` and
shorter clips.

**The page says "API offline".** The backend may still be starting, so check `docker compose ps`. If
you're opening the app from a different address or port, set `NEXT_PUBLIC_API_BASE_URL` and
`CORS_ORIGINS` to match in `.env` and rebuild.

**Uploads fail with "Job queue is unavailable".** Redis or the worker is down. `docker compose ps`
will show which one.

**A job is stuck on "processing" after a restart.** Restart the worker
(`docker compose restart worker`). It marks interrupted jobs as failed so you can run them again.
