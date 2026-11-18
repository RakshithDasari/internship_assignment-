/** Inline error message. Shows the API's message as plain text. */
export default function ErrorBanner({ title, detail, onRetry, onDismiss }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-scarlet/40 bg-scarlet/15 p-3 text-xs">
      <p className="flex flex-wrap items-center gap-2">
        <span className="icon text-[18px] text-scarlet" aria-hidden="true">error</span>
        <span className="font-bold text-white">{title}</span>
        {detail && <span className="text-white/70">{detail}</span>}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1 rounded-full bg-scarlet px-3 py-1 font-bold text-white hover:bg-scarlet-dark"
        >
          <span className="icon text-[14px]" aria-hidden="true">refresh</span>
          Retry
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="icon-btn h-7 w-7">
          <span className="icon text-[16px]" aria-hidden="true">close</span>
        </button>
      )}
    </div>
  );
}
