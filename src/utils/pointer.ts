/**
 * Whether this device has a pointer that can actually hover.
 *
 * Phones and tablets synthesise mouseenter on a tap, so a hover-only panel will open on touch and then
 * never close — there is no mouseleave until something else is tapped, and the panel does not take
 * pointer events itself. Anything that only makes sense under a real cursor should ask first.
 */
export const supportsHover = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
};
