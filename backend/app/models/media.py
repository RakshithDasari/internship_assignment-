import logging
import shutil
import subprocess
import tempfile
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

DEFAULT_FPS = 30.0
MAX_FPS = 240.0
# Top-level MP4/QuickTime atoms that can appear at byte offset 4.
QUICKTIME_ATOMS = {b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip", b"pnot"}

log = logging.getLogger(__name__)


class MediaError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def find_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def detect_media_type(path: Path) -> str | None:
    """'image', 'video' or None, judged by file content rather than extension."""
    with open(path, "rb") as f:
        head = f.read(12)
    if head[4:8] in QUICKTIME_ATOMS:
        return "video"
    if head[:4] == b"RIFF" and head[8:12] == b"AVI ":
        return "video"
    try:
        with Image.open(path) as img:
            img.verify()
        return "image"
    except Image.DecompressionBombError:
        return "image"  # a real image, just too big; read_image reports IMAGE_TOO_LARGE
    except (UnidentifiedImageError, OSError, SyntaxError):
        return None


def read_image(path: Path) -> np.ndarray:
    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)  # honour phone camera rotation
            rgb = np.asarray(img.convert("RGB"))
    except Image.DecompressionBombError:
        raise MediaError("IMAGE_TOO_LARGE", "Image is too large to process.") from None
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise MediaError("DECODE_FAILED", "Couldn't decode this image.") from None
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def write_image(path: Path, frame: np.ndarray, quality: int = 90) -> None:
    if not cv2.imwrite(str(path), frame, [cv2.IMWRITE_JPEG_QUALITY, quality]):
        raise MediaError("WRITE_FAILED", "Couldn't write the output image.")


def save_thumbnail(path: Path, frame: np.ndarray, width: int = 320) -> None:
    height = max(1, round(frame.shape[0] * width / frame.shape[1]))
    write_image(path, cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA), quality=80)


def transcode_to_h264(src: Path, dst: Path) -> None:
    ffmpeg = find_ffmpeg()
    if ffmpeg is None:
        raise MediaError("FFMPEG_MISSING", "Server is missing ffmpeg.")
    result = subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-map", "0:v:0",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", str(dst)],
        capture_output=True,
    )
    if result.returncode != 0:
        log.warning("ffmpeg transcode failed: %s", result.stderr.decode(errors="replace")[-500:])
        raise MediaError("DECODE_FAILED", "Couldn't decode this video.")


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: float
    frame_count: int  # container's estimate; can be wrong for phone/VFR video
    fps_assumed: bool


class VideoReader:
    """Iterates frames one at a time. Falls back to an ffmpeg H.264 transcode when
    OpenCV can't decode the source codec."""

    def __init__(self, path: Path, scratch_dir: Path):
        self.path = Path(path)
        self.scratch_dir = Path(scratch_dir)
        self.resized_frames = 0
        self._cap = None
        self._first = None

    def __enter__(self) -> "VideoReader":
        self._cap, self._first = self._open(self.path)
        if self._first is None:
            self._cap.release()
            self.scratch_dir.mkdir(parents=True, exist_ok=True)
            fallback = self.scratch_dir / "transcoded.mp4"
            transcode_to_h264(self.path, fallback)
            self._cap, self._first = self._open(fallback)
            if self._first is None:
                raise MediaError("NO_FRAMES", "No readable video frames.")

        fps = self._cap.get(cv2.CAP_PROP_FPS)
        fps_assumed = not 0 < fps <= MAX_FPS
        height, width = self._first.shape[:2]  # after rotation, unlike CAP_PROP_FRAME_WIDTH
        self.info = VideoInfo(
            width=width,
            height=height,
            fps=DEFAULT_FPS if fps_assumed else fps,
            frame_count=max(0, int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))),
            fps_assumed=fps_assumed,
        )
        return self

    def __exit__(self, *exc) -> None:
        if self._cap is not None:
            self._cap.release()

    @staticmethod
    def _open(path: Path):
        cap = cv2.VideoCapture(str(path))
        ok, frame = cap.read() if cap.isOpened() else (False, None)
        return cap, (frame if ok else None)

    def __iter__(self):
        size = (self.info.width, self.info.height)
        frame, self._first = self._first, None
        while frame is not None:
            if (frame.shape[1], frame.shape[0]) != size:  # the encoder needs a fixed frame size
                frame = cv2.resize(frame, size)
                self.resized_frames += 1
            yield frame
            ok, frame = self._cap.read()
            if not ok:
                frame = None


class VideoWriter:
    """Pipes raw frames into ffmpeg to produce a browser-playable MP4
    (H.264, yuv420p, index at the front so playback starts before the download ends)."""

    def __init__(self, path: Path, width: int, height: int, fps: float):
        self.path = Path(path)
        self.width, self.height, self.fps = width, height, fps
        self._proc = None
        self._log = None

    def __enter__(self) -> "VideoWriter":
        ffmpeg = find_ffmpeg()
        if ffmpeg is None:
            raise MediaError("FFMPEG_MISSING", "Server is missing ffmpeg.")
        self._log = tempfile.TemporaryFile()  # a file, not a pipe: a full stderr pipe could deadlock ffmpeg
        self._proc = subprocess.Popen(
            [ffmpeg, "-y", "-loglevel", "error",
             "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{self.width}x{self.height}", "-r", f"{self.fps}",
             "-i", "-",
             "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",  # yuv420p requires even dimensions
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", "-an", str(self.path)],
            stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=self._log,
        )
        return self

    def write(self, frame: np.ndarray) -> None:
        try:
            self._proc.stdin.write(frame.tobytes())
        except (BrokenPipeError, OSError):
            raise MediaError("TRANSCODE_FAILED", "Video encoding failed.") from None

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if exc_type is not None:
                self._proc.kill()
            with suppress(OSError):  # already broken if ffmpeg died; the return code says why
                self._proc.stdin.close()
            returncode = self._proc.wait()
            if returncode != 0 and exc_type is None:
                self._log.seek(0)
                log.warning("ffmpeg encode failed: %s", self._log.read().decode(errors="replace")[-500:])
        finally:
            self._log.close()
        if exc_type is not None or returncode != 0:
            self.path.unlink(missing_ok=True)
        if exc_type is None and returncode != 0:
            raise MediaError("TRANSCODE_FAILED", "Video encoding failed.")
