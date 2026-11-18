/**
 * Video time <-> metadata frame. The backend writes the annotated video at a constant fps and
 * stamps frame i at i * 1000 / fps ms, so frame = floor(time * fps). The tiny epsilon absorbs
 * floating-point error when the browser reports a time that sits exactly on a frame boundary.
 */
export function frameAt(seconds, fps, frameCount) {
  if (!frameCount) return 0;
  const index = Math.floor(seconds * fps + 0.001);
  return Math.min(Math.max(index, 0), frameCount - 1);
}

/** Seek to the middle of a frame so rounding can never land on the previous one. */
export const seekTime = (index, fps) => (index + 0.5) / fps;

/** [{ name, classId, count }], most frequent first. */
export function classCounts(detections) {
  const counts = new Map();
  for (const { class_name: name, class_id: classId } of detections) {
    const entry = counts.get(name) ?? { name, classId, count: 0 };
    entry.count += 1;
    counts.set(name, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/** Index of the highest-confidence detection (the first one on ties), or -1 if there are none. */
export function topDetectionIndex(detections) {
  let best = -1;
  detections.forEach((detection, index) => {
    if (best === -1 || detection.confidence > detections[best].confidence) best = index;
  });
  return best;
}
