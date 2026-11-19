/** The frosted "window" every screen except the intro sits in. The nav and backdrop live in the root layout. */
export default function AppShell({ className = "", children }) {
  return (
    <div className={`flex flex-1 flex-col px-3 pb-3 md:px-5 md:pb-5 ${className}`}>
      <div className="window-in dark-glass-window flex flex-1 flex-col overflow-hidden rounded-[26px] shadow-2xl">{children}</div>
    </div>
  );
}
