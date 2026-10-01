"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Video-based seagull guide. Plays /carelink.mp4, gently tilts toward the cursor,
// and shows a guiding tooltip.
// - fillParent: video absolutely fills its parent (parent controls size/aspect).
// - fill:       video covers a fixed-height box (may crop).
// - default:    video is contained within a fixed-height box (never crops).
export function SeagullVideo({
  tip,
  className,
  height = 320,
  fill = false,
  fillParent = false,
}: {
  tip?: string;
  className?: string;
  height?: number;
  fill?: boolean;
  fillParent?: boolean;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [show, setShow] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const wrapperStyle = fillParent
    ? { perspective: 800 }
    : { height, perspective: 800 };
  const wrapperClass = fillParent
    ? `${className ?? ""} absolute inset-0`
    : className;

  const videoClass = fillParent
    ? "h-full w-full object-cover"
    : fill
    ? "h-full w-full object-cover"
    : "h-full w-auto max-w-full rounded-2xl object-contain";

  return (
    <div
      ref={ref}
      className={wrapperClass}
      style={wrapperStyle}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * 2 - 1;
        const py = ((e.clientY - r.top) / r.height) * 2 - 1;
        setTilt({ x: py * 5, y: px * 8 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl">
        <motion.video
          src="/carelink.mp4"
          autoPlay
          loop
          muted
          playsInline
          animate={{ rotateX: tilt.x, rotateY: tilt.y }}
          transition={{ type: "spring", stiffness: 120, damping: 15 }}
          className={videoClass}
          style={{ transformStyle: "preserve-3d" }}
        />

        <AnimatePresence>
          {tip && show && (
            <motion.button
              type="button"
              onClick={() => setShow(false)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ delay: 0.6 }}
              className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full glass px-4 py-1.5 text-sm font-medium text-ink-700 shadow-soft"
              aria-label={tip}
            >
              {tip}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
