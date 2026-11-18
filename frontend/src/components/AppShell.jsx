import Header from "@/components/Header";
import IntroBackdrop from "@/components/IntroBackdrop";

/** Floating nav pill above the frosted "window" every screen except the intro sits in. */
export default function AppShell({ className = "", children }) {
  return (
    <div className={`fade-in flex min-h-screen flex-col gap-3 p-3 md:gap-4 md:p-5 ${className}`}>
      <IntroBackdrop />
      <Header />
      <div className="dark-glass-window flex flex-1 flex-col overflow-hidden rounded-[26px] shadow-2xl">{children}</div>
    </div>
  );
}
