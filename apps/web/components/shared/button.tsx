import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  external?: boolean;
};

/**
 * The shape and type of every button on the site. `inline-flex` rather than
 * `block` so a button is exactly as tall as its padding and text say, whatever
 * its label runs to — which is what keeps a one-word control (the theme
 * toggle) the same height as a two-word one (Docs).
 */
const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 py-3 text-sm font-heading font-semibold";

const VARIANT = {
  primary: "bg-accent-500 text-white hover:bg-accent-600",
  secondary:
    "border border-[var(--color-divider)] hover:bg-[var(--color-surface)]",
} as const;

export type ButtonVariant = keyof typeof VARIANT;

/**
 * The class list a button of this variant wears.
 *
 * Exported because Button renders links — anything that has to render a real
 * `<button>` (the theme toggle, a form submit) borrows this rather than
 * restating the padding, which is how the toggle drifted a size smaller than
 * the buttons beside it in the nav.
 */
export function buttonClass(variant: ButtonVariant = "secondary"): string {
  return `${BASE} ${VARIANT[variant]}`;
}

export function Button({
  href,
  children,
  variant = "secondary",
  external = false,
}: ButtonProps) {
  const className = buttonClass(variant);

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
