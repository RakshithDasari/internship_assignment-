import Header from "@/components/Header";

/** The frosted "window" every screen except the intro sits in. */
export default function AppShell({ chip, className = "", children }) {
  return (
    <div className={`flex min-h-screen flex-col p-3 md:p-5 ${className}`}>
      <div className="dark-glass-window flex flex-1 flex-col overflow-hidden rounded-[26px] shadow-2xl">
        <Header chip={chip} />
        {children}
      </div>
    </div>
  );
}
