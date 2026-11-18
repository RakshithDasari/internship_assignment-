# Build from the repo root: docker build -f backend/Dockerfile .
# One image, two roles: the API (default command) and the Celery worker (command set in compose).
FROM python:3.11-slim-bookworm

# ffmpeg: browser-playable H.264 output. git: CLIP is installed from GitHub.
# libgl1 + libglib2.0-0: runtime libraries opencv-python needs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DATA_DIR=/data \
    WEIGHTS_DIR=/weights

WORKDIR /app

# CPU build by default; docker-compose.gpu.yml swaps in the CUDA index.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
RUN pip install torch==2.15.0 torchvision==0.29.2 --index-url ${TORCH_INDEX_URL}

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/app ./app

RUN useradd --create-home --uid 1000 app \
    && mkdir -p /data /weights \
    && chown app:app /data /weights
USER app

# Download every model into the image so the first job doesn't wait on the network.
# Config requires these two variables; nothing connects to them during the download.
RUN REDIS_URL=redis://unused CORS_ORIGINS=http://unused python -m app.models.registry

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
