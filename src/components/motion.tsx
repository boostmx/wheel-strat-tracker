// src/components/motion.tsx
// Component for animations using Framer Motion
"use client";
import { motion, useReducedMotion } from "framer-motion";

export const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, delay } },
});

export function MotionSection(
  props: React.ComponentProps<typeof motion.div> & { delay?: number },
) {
  const prefersReduced = useReducedMotion();
  const { delay = 0, ...rest } = props;
  return (
    <motion.div
      {...rest}
      initial={prefersReduced ? false : "initial"}
      animate={prefersReduced ? false : "animate"}
      variants={fadeUp(delay)}
    />
  );
}

export function MotionCard(
  props: React.ComponentProps<typeof motion.div> & { delay?: number },
) {
  const prefersReduced = useReducedMotion();
  const { delay = 0, className = "", ...rest } = props;
  return (
    <motion.div
      {...rest}
      className={className}
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={prefersReduced ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      whileHover={prefersReduced ? undefined : { y: -2 }}
    />
  );
}
