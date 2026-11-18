const DEVICES = [
  { value: "auto", label: "Auto" },
  { value: "cpu", label: "CPU" },
  { value: "gpu", label: "GPU" },
];

/** Confidence threshold slider and execution-device choice. */
export default function InferenceSettings({ confidence, onConfidence, device, onDevice, gpu, disabled }) {
  return (
    <fieldset disabled={disabled} className="dark-glass-card grid grid-cols-1 gap-4 rounded-2xl p-4 md:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <label htmlFor="confidence" className="font-bold">Confidence Threshold</label>
          <output htmlFor="confidence" className="font-mono font-bold text-success-glow">{confidence.toFixed(2)}</output>
        </div>
        <input
          id="confidence"
          type="range"
          min="0.1"
          max="0.95"
          step="0.05"
          value={confidence}
          onChange={(event) => onConfidence(Number(event.target.value))}
          className="h-1.5 w-full cursor-pointer accent-success-glow"
        />
        <div className="mt-1 flex justify-between font-mono text-xs text-white/60">
          <span>0.10 (High Recall)</span>
          <span>0.95 (High Precision)</span>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span id="device-label" className="font-bold">Execution Device</span>
          <span className="font-mono font-bold text-success-glow">{gpu.available ? gpu.name : "CPU only"}</span>
        </div>
        <div role="radiogroup" aria-labelledby="device-label" className="grid grid-cols-3 gap-2 text-xs">
          {DEVICES.map(({ value, label }) => {
            const unavailable = value === "gpu" && !gpu.available;
            const checked = device === value;
            return (
              <label
                key={value}
                title={unavailable ? "No GPU detected on the server" : undefined}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 ${
                  unavailable
                    ? "cursor-not-allowed border-white/5 bg-black/40 opacity-40"
                    : checked
                      ? "cursor-pointer border-success-glow bg-white/10 font-bold"
                      : "cursor-pointer border-white/10 bg-white/5 text-white/80"
                }`}
              >
                <input
                  type="radio"
                  name="device"
                  value={value}
                  checked={checked}
                  disabled={unavailable}
                  onChange={() => onDevice(value)}
                  className="accent-success-glow"
                />
                <span className={unavailable ? "line-through" : ""}>{unavailable ? "GPU (N/A)" : label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
