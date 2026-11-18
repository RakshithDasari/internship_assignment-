const DEVICES = [
  { value: "auto", label: "Auto" },
  { value: "cpu", label: "CPU" },
  { value: "gpu", label: "GPU" },
];

/** Confidence threshold slider and execution-device choice. */
export default function InferenceSettings({ confidence, onConfidence, device, onDevice, gpu, disabled }) {
  return (
    <fieldset disabled={disabled} className="grid grid-cols-1 gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <label htmlFor="confidence" className="font-bold">Confidence Threshold</label>
          <output htmlFor="confidence" className="font-bold text-success-glow">{confidence.toFixed(2)}</output>
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
        <div className="mt-1 flex justify-between text-xs text-white/60">
          <span>0.10 (High Recall)</span>
          <span>0.95 (High Precision)</span>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span id="device-label" className="font-bold">Execution Device</span>
          <span className="font-bold text-success-glow">{gpu.available ? gpu.name : "CPU only"}</span>
        </div>
        <div role="radiogroup" aria-labelledby="device-label" className="grid grid-cols-3 gap-2 text-xs">
          {DEVICES.map(({ value, label }) => {
            const unavailable = value === "gpu" && !gpu.available;
            const checked = device === value;
            return (
              <label
                key={value}
                title={unavailable ? "No GPU detected on the server" : undefined}
                className={`pill flex items-center justify-center py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white/70 ${
                  unavailable ? "cursor-not-allowed opacity-40" : `cursor-pointer ${checked ? "pill-active" : ""}`
                }`}
              >
                <input
                  type="radio"
                  name="device"
                  value={value}
                  checked={checked}
                  disabled={unavailable}
                  onChange={() => onDevice(value)}
                  className="sr-only"
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
