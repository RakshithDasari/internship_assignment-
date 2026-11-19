import InkIllustration from "@/components/InkIllustration";

/**
 * The intro's red letterbox scene (gradient, line art, vignette) as a fixed background
 * behind the app screens. Static on purpose: the intro's flicker would distract from work.
 */
export default function IntroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#9e1f1f_0%,#6b1e1e_55%,#3b0d0d_100%)]" />
      <InkIllustration className="absolute inset-0 h-full w-full opacity-55 mix-blend-multiply" />
      <div className="backdrop-vignette absolute inset-0" />
    </div>
  );
}
