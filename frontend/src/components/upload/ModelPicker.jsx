const ICONS = {
  "yolov8n": "detector",
  "yolov8s": "verified",
  "yolov8s-worldv2": "travel_explore",
  "yolov8n-seg": "shape_line",
};

/** The model cards, plus the YOLO-World prompt field when that model is selected. */
export default function ModelPicker({ models, defaultModel, selected, onSelect, prompt, onPrompt, promptError, disabled }) {
  const needsPrompt = models.find((model) => model.id === selected)?.needs_prompt;

  return (
    <fieldset className="flex flex-col gap-2.5" disabled={disabled}>
      <legend className="mb-2.5 text-xs font-semibold text-white/70">Model</legend>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {models.map((model) => {
          const active = model.id === selected;
          const isDefault = model.id === defaultModel;
          return (
            <button
              key={model.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(model.id)}
              className={`lift flex flex-col justify-between rounded-2xl p-3.5 text-left ${active ? "model-card-active" : "dark-glass-card"}`}
            >
              <span
                className={`self-end rounded-full px-2 py-0.5 text-[10px] ${
                  isDefault ? "bg-success-glow font-bold" : "bg-white/15 text-white/80"
                }`}
              >
                {isDefault ? "DEFAULT" : model.tag}
              </span>
              <span className="mt-1 flex items-center gap-1.5">
                <span className={`icon text-[20px] ${active ? "text-success-glow" : "text-white/70"}`} aria-hidden="true">
                  {ICONS[model.id] ?? "deployed_code"}
                </span>
                <span className="text-sm font-bold">{model.id}</span>
              </span>
              <span className="mt-1 text-xs font-medium text-white/70">{model.description}</span>
              <span className="mt-2.5 w-full border-t border-white/10 pt-1.5 text-xs text-white/60">{model.output}</span>
            </button>
          );
        })}
      </div>

      {needsPrompt && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/50 p-3.5">
          <label htmlFor="prompt" className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <span className="icon text-[17px]" aria-hidden="true">edit_note</span>
              Detection prompts
            </span>
            <span className="font-normal text-white/60">Comma-separated text prompts</span>
          </label>
          <input
            id="prompt"
            value={prompt}
            onChange={(event) => onPrompt(event.target.value)}
            placeholder="e.g. forklift, safety helmet, pallet"
            aria-invalid={Boolean(promptError)}
            aria-describedby={promptError ? "prompt-error" : undefined}
            className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs shadow-inner placeholder:text-white/40 focus:border-scarlet"
          />
          {promptError && (
            <span id="prompt-error" className="text-[11px] font-medium text-scarlet">{promptError}</span>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-white/60">
        <span className="icon text-[16px] text-success-glow" aria-hidden="true">alt_route</span>
        Object tracking (ByteTrack) is on for every video model.
      </p>
    </fieldset>
  );
}
