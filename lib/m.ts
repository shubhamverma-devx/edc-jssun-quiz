/**
 * Single import point for framer-motion. Every client component imports
 * motion primitives from here (never from "framer-motion" directly) so the
 * bundler resolves the library through one module and emits ONE shared
 * chunk instead of duplicating ~44KB gz per chunk group.
 */
export { AnimatePresence, motion, useReducedMotion } from "framer-motion";
export type { Variants } from "framer-motion";
