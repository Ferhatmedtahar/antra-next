/**
 * Decorative geometry for the marketing page.
 *
 * All four are single-path, `currentColor`, 480×480 — so a caller sets size with
 * `size-*` and colour with a text token, and nothing here needs a variant prop.
 * They are ambient only: every use is `aria-hidden`, `pointer-events-none`, and
 * pushed behind the section's content with `-z-10`, which is why none of them
 * takes a label.
 */

export function AstroriskIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
    >
      <path
        d="M480 210h-89.2l82.4-34.1-23-55.5-82.3 34.2 63-63L388.5 49l-63 63 34-82.4-55.4-23L270 89.3V0h-60v89.2L175.9 6.8l-55.5 23 34.2 82.3-63-63L49 91.5l63 63-82.3-34-23 55.4L89.2 210H0v60h89.2L6.8 304.1l23 55.5 82.3-34.2-63 63L91.5 431l63-63-34 82.4 55.4 23 34.1-82.5V480h60v-89.2l34.1 82.4 55.5-23-34.2-82.3 63 63 42.5-42.4-63-63 82.4 34 23-55.4-82.5-34.1H480v-60Zm-240 90a60 60 0 1 1 0-120 60 60 0 0 1 0 120Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CircleFlowerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
    >
      <path
        d="M70.9 69.7 69.7 71a85.2 85.2 0 0 0 43.6 143.8L240 240l-25.4-126.7A85.2 85.2 0 0 0 71 69.7ZM69.7 409.1l1.2 1.2a85.2 85.2 0 0 0 143.8-43.6L240 240l-126.7 25.3a85.2 85.2 0 0 0-43.6 143.8ZM410.3 70.9l-1.2-1.2a85.2 85.2 0 0 0-143.8 43.6L240 240l126.7-25.4A85.2 85.2 0 0 0 410.3 71ZM366.7 265.4 240 240l25.4 126.7A85.2 85.2 0 0 0 409 410.3l1.2-1.2a85.2 85.2 0 0 0-43.6-143.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FlowerCircleMirrorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
    >
      <path
        d="M398.7 240c30.3-26.7 53.8-61 67.6-99.8a60 60 0 0 0-47-79.5 60 60 0 0 0-79.5-47A240.4 240.4 0 0 0 240 81.3a240.3 240.3 0 0 0-99.8-67.6 60 60 0 0 0-79.5 47 60 60 0 0 0-47 79.5C27.5 179 51 213.2 81.3 240a240.3 240.3 0 0 0-67.6 99.8 60 60 0 0 0 47 79.5 60 60 0 0 0 79.5 47c38.8-13.8 73-37.3 99.8-67.6 26.7 30.3 61 53.8 99.8 67.6a60 60 0 0 0 79.5-47 60 60 0 0 0 47-79.5 240.4 240.4 0 0 0-67.6-99.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CircleHalfIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
    >
      <path
        d="M360 240a120 120 0 1 0-120-120 120 120 0 1 0-120 120 120 120 0 1 0 120 120 120 120 0 1 0 120-120Zm-120 60a60 60 0 1 1 0-120 60 60 0 0 1 0 120Z"
        fill="currentColor"
      />
    </svg>
  );
}
