import Image from "next/image";

/**
 * The Antra mark.
 *
 * Two things about the source art are handled here rather than in the file:
 *
 * 1. Dead space. `antra.png` is 2:1 with the ant occupying roughly the middle
 *    53% of the width, so at nav size `object-contain` alone renders the ant
 *    about half the height of the box it sits in. The box is already 2:1, which
 *    matches the art's own aspect, so an `object-contain` fit fills it exactly —
 *    a centred `scale` of CROP then pushes the empty margin outside the box and
 *    `overflow-hidden` clips it. Re-measure and change CROP if the art changes.
 *
 * 2. The white ground. The art is blue on opaque white, so on a dark page it
 *    would paint a white rectangle. `multiply` dissolves white against a light
 *    backdrop; against a dark one, invert turns white black and blue amber,
 *    hue-rotate pulls the amber back toward blue, and `screen` then drops the
 *    black to nothing while the blue lightens the ground.
 *
 * A tightly trimmed, transparent PNG would make both tricks unnecessary — drop
 * CROP, `overflow-hidden`, and every `mix-blend-` class if the asset is
 * replaced with one.
 */
const CROP = 1.8;

export function Logo({ className = "h-6 w-12" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden ${className}`}>
      <Image
        src="/antra.png"
        alt=""
        fill
        sizes="160px"
        style={{ transform: `scale(${CROP})` }}
        className="object-contain mix-blend-multiply dark:invert dark:hue-rotate-180 dark:mix-blend-screen"
      />
    </span>
  );
}
