# Testing

## Manual test plan

Start the app (see [setup](setup.md)) and open http://localhost:3000. You'll need a photo with people
or cars in it, a short video, a large video of around 200 MB, and some file the app doesn't accept,
like a `.txt`. Free stock footage sites such as Pexels work well for the videos.

"Upload" below means: drop the file on the Upload page, pick a model, and click **Run inference**.

| # | Test | Steps | Expected result |
|---|---|---|---|
| 1 | Upload a JPEG | Upload a photo with `yolov8n`, then click **Open dashboard** | The image shows boxes and labels, and the sidebar lists each object with its confidence. The most confident one is marked Top |
| 2 | Upload an MP4 | Upload a video with any model, open the dashboard and press Play | Live preview frames appear while it processes. On the dashboard the annotated video plays and the sidebar changes as it goes |
| 3 | Metadata sync | Drag the seek bar to frame 50 (the arrow keys move one frame at a time) | The sidebar shows frame 50's detections, matching `curl http://localhost:8000/jobs/<id>/metadata/50` |
| 4 | Model switching | Upload the same video with `yolov8n`, then with `yolov8n-seg` | Both jobs appear in Jobs history, each with its own model, and each opens its own dashboard |
| 5 | Error handling | Upload the `.txt` file | A message says the format isn't supported and lists the allowed ones. No job is created |
| 6 | Large file | Upload the 200 MB video | It uploads and processes without errors (this takes a few minutes on CPU), and the containers keep running |
| 7 | YOLO-World | Pick `yolov8s-worldv2`, type `person, car`, upload a street video | Only people and cars are detected. Leaving the prompt empty shows an error asking for one |
| 8 | Tracking and keyframes | On a video dashboard, step through frames, then click a keyframe thumbnail | Objects keep the same `#TRK` number from frame to frame, and the keyframe jumps the video to that moment |
| 9 | Cancel and delete | Start a long video and upload a second file. Cancel the second one in Jobs, then delete a finished job | The queued job shows Cancelled, and the deleted job disappears |
| 10 | Worker down | Run `docker compose stop worker`, upload something, then `docker compose start worker` | The status dot changes to "Worker offline". The upload waits in the queue and runs once the worker is back |

## Automated backend tests

There are 27 tests, covering 85% of the backend code. They don't need Docker or Redis.

### Setup

You need Python 3.11 and ffmpeg. From `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt -r requirements-dev.txt
```

### Run

```bash
python -m pytest --cov=app
```

The first run downloads the model weights (about 400 MB); after that the suite takes under a minute.

### What's covered

- Every kind of rejected upload: wrong type, empty, fake video, too large, unknown model, bad
  confidence or device, missing YOLO-World prompt, queue down.
- Full image, segmentation, YOLO-World and video jobs, checked against the required metadata fields.
- Tracking IDs, video seeking, keyframe thumbnails and the live preview events.
- Cancelling and deleting jobs, corrupt input, and recovering jobs interrupted by a crash.
- The health check, and the WebSocket turning away unknown jobs and other websites.

### How it works

The tests set up a temporary data folder before the app loads, and point Redis at an address where
nothing is listening, so no broker is needed. Uploads run the worker's task directly instead of
queueing it, so each test goes through the real pipeline. They use the sample photo that ships with
Ultralytics (a bus with people) and build a short test video from it, so no media files are stored
in the repo.
