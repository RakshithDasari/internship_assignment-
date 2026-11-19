# Testing

Two parts: a [manual test plan](#manual-test-plan) that checks the app end to end in the browser, and
the [automated backend tests](#automated-backend-tests).

## Manual test plan

### Before you start

Start the stack and wait until all services are healthy ([setup guide](setup.md#3-check-that-every-service-is-healthy)),
then open http://localhost:3000. You'll need a few files:

| File | Where to get one |
|---|---|
| A JPEG with people or vehicles | Any photo, or Ultralytics' sample: https://ultralytics.com/images/bus.jpg |
| A short MP4 (5–30 s) with moving people or cars | A phone recording, or free stock footage (Pexels, Pixabay) |
| A ~200 MB video | A 4K stock clip of about one minute |
| An AVI or MOV file | Any; MOV is what iPhones record |
| An unsupported file | Anything else, such as a `.txt` or `.pdf` |

In the steps below, **Upload** means: on the Upload page, drag the file onto the drop area (or click
**Select file**), choose a model card, and click **Run inference** (or press Enter).

### Core cases (from the brief)

| # | Test case | Steps | Expected result |
|---|---|---|---|
| 1 | Upload a JPEG image | Upload the JPEG with **yolov8n**. When the job finishes, click **Open dashboard** | The upload progress reaches 100%, the status moves through Queued → Processing → Completed, and the image dashboard shows the photo with boxes and labels. The sidebar lists each object with its class and confidence, the most confident one is marked **Top**, and a bar shows objects per class |
| 2 | Upload an MP4 video | Upload the MP4 with **yolov8n**, open the dashboard and press **Play** | While processing, the upload page shows live annotated preview frames and a progress percentage. On the dashboard the annotated video plays, the frame counter and timestamp advance, and the sidebar (marked **Synced**) changes with the video: object count, classes, confidences and inference time |
| 3 | Metadata sync | On the video dashboard, drag the seek bar until the counter reads **Frame 50** (fine-tune with ← and →) | The sidebar shows frame 50's detections. To confirm, compare its object count and confidences with `curl http://localhost:8000/jobs/<job_id>/metadata/50` |
| 4 | Model switching | Upload the same video twice: once with **yolov8n**, once with **yolov8n-seg**. Open **Jobs** | Both jobs are listed with their own model, and both are marked **same file**. **Inspect** opens each dashboard with that model's results (the seg version shows masks) |
| 5 | Error handling | Drag the unsupported file onto the drop area and run it | A clear message appears: "Unsupported file format. Please upload AVI, JPEG, JPG, MOV, MP4, PNG." No job is created, and the page stays usable |
| 6 | Large file | Upload the ~200 MB video with **yolov8n** | The upload bar fills steadily, the job processes to completion (several minutes on CPU), and the dashboard plays the result. The containers stay up (`docker compose ps` shows no restarts) |

### Further cases

| # | Test case | Steps | Expected result |
|---|---|---|---|
| 7 | Open-vocabulary prompt | Choose **yolov8s-worldv2** and run without a prompt; then type `person, car` and run | Without a prompt: "Please enter at least one prompt for YOLO-World detection." With it: only `person` and `car` are detected |
| 8 | Segmentation | Upload the JPEG with **yolov8n-seg** | Coloured masks are drawn on each object; in the metadata, detections have `"mask_present": true` |
| 9 | AVI / MOV playback | Upload the AVI or MOV file | It processes and plays in the dashboard (converted to H.264 MP4) |
| 10 | Tracking | On a video dashboard, step through a few frames with → | The same object keeps the same ID (`#TRK-n`) in the video labels and the sidebar |
| 11 | Keyframes | On a video dashboard, click a thumbnail under **Keyframes** | The video jumps to that frame; the thumbnail is marked **Active** and the sidebar shows that frame |
| 12 | Cancel a queued job | Start a long video, then immediately upload a second file. In **Jobs**, cancel the second one while it's queued | Its status becomes **Cancelled**; the first job finishes normally |
| 13 | Delete a job | In **Jobs**, delete a finished job | It disappears from the list; its result URL now returns 404 |
| 14 | Worker outage | Run `docker compose stop worker` | Within a few seconds the nav status changes from **Live** to **Worker offline**. Uploads still queue; after `docker compose start worker`, the queued job runs |
| 15 | GPU fallback | On a machine without an NVIDIA GPU (or without the GPU override) | The upload page shows **CPU only** and the GPU option is disabled; `/health` reports `"device":"cpu"`, and jobs run on CPU |
| 16 | Keyboard and themes | On the dashboard, use Space (play/pause) and ← / → (frame step); Tab through the upload page; switch the theme with the sun/moon button and reload | Every control can be reached and used from the keyboard with a visible focus ring; the chosen theme is kept after reloading |

## Automated backend tests

27 tests cover the API, the inference pipeline and the job lifecycle, with **85% line coverage** of
`backend/app`.

### Setup

The tests run natively, without Docker or Redis. You need Python 3.11 and ffmpeg on `PATH`. From
`backend/`:

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt -r requirements-dev.txt
```

(Already set up for local development? Skip this; see [setup.md](setup.md#6-running-without-docker).)

### Run

```bash
python -m pytest                   # all tests
python -m pytest --cov=app         # with a coverage report
```

The first run downloads the model weights into `backend/weights` (about 400 MB, most of it the CLIP
text encoder that YOLO-World uses); later runs take under a minute.

### What they cover

| Area | Tests |
|---|---|
| Upload validation | Wrong file type, empty file, a fake video, over the size limit, no file, unknown model, invalid confidence, invalid device, missing or too many YOLO-World prompts, queue unavailable |
| Full pipeline | Image, segmentation, open-vocabulary and video jobs, each checked against the required metadata schema (`frame_index`, `timestamp_ms`, `model`, `detections[]` with `class_id`, `class_name`, `confidence`, `bbox`, `mask_present`, then `total_objects`, `inference_time_ms`) |
| Video features | Consistent tracking IDs, HTTP range requests (seeking), keyframe thumbnails, live preview events |
| Job lifecycle | Cancel, cancelling twice, delete, no delete while processing, result not ready yet, a corrupt input failing cleanly, recovery of interrupted jobs |
| Read endpoints | `/health` reporting a missing Redis, `/models`, unknown jobs and out-of-range frames |
| WebSocket | Rejecting a foreign origin and an unknown job |

### How they work

- **Configuration before import.** Settings are read when the app is imported, so `tests/conftest.py`
  sets the environment first: a temporary data folder, the weights folder, and a Redis URL that
  points at a closed port (no broker is needed, and `/health` must report it as down).
- **Jobs run inline.** The upload's Celery call is swapped for a direct call to the worker task, so
  each upload runs the real pipeline (decode, inference, tracking, drawing, encoding, metadata)
  inside the test.
- **Real models on real images.** The tests use Ultralytics' bundled `bus.jpg` and generate a short
  video from it with OpenCV at test time, so no media files are committed and the assertions are
  about genuine detections (for example, that a person and a bus are found).

### Coverage by module

| Module | Coverage |
|---|---|
| `app/main.py`, `app/models/annotate.py` | 100% |
| `app/db.py` | 99% |
| `app/models/inference.py` | 90% |
| `app/config.py` | 86% |
| `app/models/registry.py` | 85% |
| `app/api/routes.py` | 81% |
| `app/models/media.py` | 80% |
| `app/workers/tasks.py` | 74% |
| `app/workers/celery_app.py` | 71% |
| **Total** | **85%** |

The frontend has no unit tests; `npm run lint` (ESLint with the Next.js rules) runs clean, and the
manual plan above covers the UI.
