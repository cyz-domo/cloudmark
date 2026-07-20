import {
  useEffect,
  useRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

interface BookmarkletLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Full bookmarklet URL starting with javascript: */
  code: string;
  children: ReactNode;
}

/**
 * React blocks `javascript:` URLs when set via JSX `href`.
 * Bookmarklets need a real href for drag-to-bookmarks-bar, so we assign it
 * with the DOM API after mount.
 *
 * Do NOT preventDefault on click — a click is how users test the bookmarklet
 * and how some browsers activate it after drag-install.
 */
export function BookmarkletLink({
  code,
  children,
  ...rest
}: BookmarkletLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (code) {
      el.setAttribute("href", code);
    } else {
      el.removeAttribute("href");
    }
  }, [code]);

  return (
    // href is set via DOM (React would strip javascript:)
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a ref={ref} draggable {...rest}>
      {children}
    </a>
  );
}
