// Local stand-ins for the couple of @hatch/space-sdk/client helpers the
// artifact client used. On the standalone site there is no hosting chrome,
// so the safe-area scrim is just a fixed strip painted in the page
// background color across the top safe-area inset (a no-op on devices
// without a notch, where the inset is 0).

export function SafeAreaTopScrim({
  backgroundColor,
}: {
  backgroundColor?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "env(safe-area-inset-top, 0px)",
        backgroundColor,
        zIndex: 50,
        pointerEvents: "none",
      }}
    />
  );
}
