import cv2
import numpy as np

# Detection colours, matching the UI palette.
PALETTE = ("#FFFFFF", "#E53935", "#CBD5E1", "#94A3B8", "#64748B")
CLASS_OVERRIDES = {"person": "#FFFFFF", "car": "#E53935", "bicycle": "#CBD5E1", "motorcycle": "#94A3B8", "truck": "#64748B"}
DARK_TEXT = "#0B0707"
MASK_OPACITY = 0.35


def class_color(class_id: int, class_name: str) -> str:
    # White is reserved for person; other classes cycle through the remaining colours.
    return CLASS_OVERRIDES.get(class_name, PALETTE[1 + class_id % (len(PALETTE) - 1)])


def _bgr(hex_color: str) -> tuple[int, int, int]:
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return b, g, r  # OpenCV expects BGR


def label_text(det: dict) -> str:
    text = f"{det['class_name']} {det['confidence'] * 100:.0f}%"
    if det.get("track_id") is not None:
        text += f" #TRK-{det['track_id']}"
    return text


def draw(frame: np.ndarray, detections: list[dict], masks: list[np.ndarray] | None = None,
         scale: float = 1.0) -> np.ndarray:
    """Draws onto `frame` in place and returns it. `masks` are polygons aligned with `detections`.
    `scale` maps detection coordinates onto a resized frame (e.g. 0.5 for 4K detections on 1080p)."""
    height, width = frame.shape[:2]
    size = min(height, width) / 720  # line/text sizes tuned on 720p, scaled for other resolutions
    thickness = max(2, round(2 * size))
    font_scale = max(0.45, 0.6 * size)
    font_thickness = max(1, round(1.5 * size))
    pad = max(4, round(6 * size))

    if masks:
        overlay = frame.copy()
        outlines = []
        for det, polygon in zip(detections, masks):
            if len(polygon):
                points = (polygon * scale).astype(np.int32)
                color = _bgr(class_color(det["class_id"], det["class_name"]))
                cv2.fillPoly(overlay, [points], color)
                outlines.append((points, color))
        cv2.addWeighted(overlay, MASK_OPACITY, frame, 1 - MASK_OPACITY, 0, dst=frame)
        for points, color in outlines:  # the fill alone is hard to see on bright footage
            cv2.polylines(frame, [points], True, color, max(1, thickness - 1), cv2.LINE_AA)

    for det in detections:
        hex_color = class_color(det["class_id"], det["class_name"])
        color = _bgr(hex_color)
        box = det["bbox"]
        x1, y1, x2, y2 = (round(box[k] * scale) for k in ("x1", "y1", "x2", "y2"))
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness, cv2.LINE_AA)

        text = label_text(det)
        (text_w, text_h), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness)
        tag_h = text_h + baseline + pad
        tag_w = text_w + 2 * pad
        tag_x = min(x1, max(0, width - tag_w))
        tag_y = y1 - tag_h if y1 - tag_h >= 0 else y1  # no room above: put the label inside the box
        cv2.rectangle(frame, (tag_x, tag_y), (tag_x + tag_w, tag_y + tag_h), color, cv2.FILLED)
        text_color = _bgr("#FFFFFF" if hex_color == "#E53935" else DARK_TEXT)
        cv2.putText(frame, text, (tag_x + pad, tag_y + tag_h - baseline - pad // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_color, font_thickness, cv2.LINE_AA)
    return frame
