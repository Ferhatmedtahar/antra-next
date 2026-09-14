/**
 * The nearer boundary for `/`, so a navigation from inside the group does not
 * have to reach the root one. Points at `app/loading.tsx` rather than repeating
 * the landing skeleton, because the two must stay identical: whichever of them
 * the router picks, the same thing has to be on screen.
 */
export { default } from "../loading";
