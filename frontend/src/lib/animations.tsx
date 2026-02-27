/**
 * Animation System - Reusable motion variants, transitions, and animated components
 * Features: Page transitions, staggered lists, spring configs, parallax, morphing
 */
import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue, Variants, Transition } from 'framer-motion';

/* ── Spring Configs ─────────────────────────────────────────────────── */
export const springs = {
  gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
  wobbly: { type: 'spring' as const, stiffness: 180, damping: 12 },
  stiff: { type: 'spring' as const, stiffness: 300, damping: 30 },
  slow: { type: 'spring' as const, stiffness: 80, damping: 20 },
  bounce: { type: 'spring' as const, stiffness: 400, damping: 10, mass: 0.8 },
  snap: { type: 'spring' as const, stiffness: 500, damping: 25, mass: 0.5 },
  smooth: { type: 'tween' as const, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
  elastic: { type: 'spring' as const, stiffness: 200, damping: 8, mass: 0.5 },
};

/* ── Page Transition Variants ───────────────────────────────────────── */
export const pageTransitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
  slideRight: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 30 },
    transition: { duration: 0.35 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
    transition: { duration: 0.3 },
  },
  morphIn: {
    initial: { opacity: 0, scale: 0.9, borderRadius: '50%' },
    animate: { opacity: 1, scale: 1, borderRadius: '0%' },
    exit: { opacity: 0, scale: 0.9, borderRadius: '50%' },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
  rotateIn: {
    initial: { opacity: 0, rotateY: 90 },
    animate: { opacity: 1, rotateY: 0 },
    exit: { opacity: 0, rotateY: -90 },
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/* ── Stagger Container Variants ─────────────────────────────────────── */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

/* ── Stagger Item Variants ──────────────────────────────────────────── */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: springs.gentle },
  exit: { opacity: 0, scale: 0.8 },
};

export const staggerItemSlide: Variants = {
  hidden: { opacity: 0, x: -30 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, x: 30 },
};

/* ── Card Animation Variants ────────────────────────────────────────── */
export const cardHover: Variants = {
  rest: {
    scale: 1,
    boxShadow: '0 0 0 rgba(0, 200, 255, 0)',
    transition: { duration: 0.3 },
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 10px 40px rgba(0, 200, 255, 0.1)',
    transition: springs.gentle,
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

export const glowHover: Variants = {
  rest: {
    filter: 'brightness(1)',
    transition: { duration: 0.3 },
  },
  hover: {
    filter: 'brightness(1.1)',
    transition: { duration: 0.3 },
  },
};

/* ── Notification Variants ──────────────────────────────────────────── */
export const notificationVariants: Variants = {
  initial: { opacity: 0, y: -50, scale: 0.3 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springs.bounce },
  exit: { opacity: 0, scale: 0.5, x: 100, transition: { duration: 0.3 } },
};

/* ── Modal Variants ─────────────────────────────────────────────────── */
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.85, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springs.gentle },
  exit: { opacity: 0, scale: 0.85, y: 30, transition: { duration: 0.2 } },
};

export const modalSlideUp: Variants = {
  hidden: { opacity: 0, y: '100%' },
  visible: { opacity: 1, y: 0, transition: springs.stiff },
  exit: { opacity: 0, y: '100%', transition: { duration: 0.3 } },
};

/* ── List Item Variants ─────────────────────────────────────────────── */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    marginBottom: 8,
    transition: { type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.2 } },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: { duration: 0.2 },
  },
};

/* ── Count Up Variant ───────────────────────────────────────────────── */
export const countUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/* ── Pulse Animation ────────────────────────────────────────────────── */
export const pulse: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const pulseGlow = {
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(0, 200, 255, 0)',
      '0 0 20px 10px rgba(0, 200, 255, 0.15)',
      '0 0 0 0 rgba(0, 200, 255, 0)',
    ],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

/* ── Typing / Cursor ────────────────────────────────────────────────── */
export const blinkCursor = {
  animate: {
    opacity: [1, 0, 1],
    transition: { duration: 1, repeat: Infinity },
  },
};

/* ── Floating Animation ─────────────────────────────────────────────── */
export const floating = {
  animate: {
    y: [0, -10, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const floatingRotate = {
  animate: {
    y: [0, -8, 0],
    rotate: [0, 2, -2, 0],
    transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
  },
};

/* ── Gradient Shift ─────────────────────────────────────────────────── */
export const gradientShift = {
  animate: {
    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
    transition: { duration: 5, repeat: Infinity, ease: 'linear' },
  },
};

/* ──────────────────────────────────────────────────────────────────── */
/* ── ANIMATED COMPONENTS ──────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * FadeIn - Fades content in when it enters the viewport
 */
export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}> = ({ children, delay = 0, direction = 'up', distance = 30, duration = 0.5, className, once = true }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });

  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * ScaleIn - Scales content in when visible
 */
export const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ ...springs.bounce, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * SlideIn - Slides content from specified direction
 */
export const SlideIn: React.FC<{
  children: React.ReactNode;
  from?: 'left' | 'right' | 'top' | 'bottom';
  delay?: number;
  className?: string;
}> = ({ children, from = 'left', delay = 0, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const fromMap = {
    left: { x: -100, y: 0 },
    right: { x: 100, y: 0 },
    top: { x: 0, y: -100 },
    bottom: { x: 0, y: 100 },
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...fromMap[from] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ ...springs.gentle, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * StaggerList - Staggered animation for lists
 */
export const StaggerList: React.FC<{
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}> = ({ children, staggerDelay = 0.05, className }) => {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      exit="exit"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: staggerDelay, delayChildren: 0.1 },
        },
        exit: {
          opacity: 0,
          transition: { staggerChildren: 0.02, staggerDirection: -1 },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div variants={staggerItem} className={className}>
    {children}
  </motion.div>
);

/**
 * ParallaxScroll - Parallax scrolling effect
 */
export const ParallaxScroll: React.FC<{
  children: React.ReactNode;
  speed?: number;
  className?: string;
}> = ({ children, speed = 0.5, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100]);
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <motion.div ref={ref} style={{ y: smoothY }} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * Reveal - Clip-path reveal animation
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  delay?: number;
  className?: string;
}> = ({ children, direction = 'left', delay = 0, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const clipPaths = {
    left: { hidden: 'inset(0 100% 0 0)', visible: 'inset(0 0 0 0)' },
    right: { hidden: 'inset(0 0 0 100%)', visible: 'inset(0 0 0 0)' },
    top: { hidden: 'inset(0 0 100% 0)', visible: 'inset(0 0 0 0)' },
    bottom: { hidden: 'inset(100% 0 0 0)', visible: 'inset(0 0 0 0)' },
  };

  return (
    <motion.div
      ref={ref}
      initial={{ clipPath: clipPaths[direction].hidden, opacity: 0 }}
      animate={isInView ? { clipPath: clipPaths[direction].visible, opacity: 1 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * RotateIn - Rotates content in
 */
export const RotateIn: React.FC<{
  children: React.ReactNode;
  degrees?: number;
  delay?: number;
  className?: string;
}> = ({ children, degrees = 180, delay = 0, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, rotate: degrees }}
      animate={isInView ? { opacity: 1, rotate: 0 } : {}}
      transition={{ ...springs.gentle, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * GlitchText - Glitch text effect
 */
export const GlitchText: React.FC<{
  text: string;
  className?: string;
}> = ({ text, className }) => {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{text}</span>
      <motion.span
        className="absolute top-0 left-0 text-cyan-400 opacity-70"
        animate={{
          x: [0, -2, 2, 0],
          y: [0, 1, -1, 0],
        }}
        transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3 }}
        aria-hidden
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute top-0 left-0 text-red-400 opacity-70"
        animate={{
          x: [0, 2, -2, 0],
          y: [0, -1, 1, 0],
        }}
        transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3, delay: 0.05 }}
        aria-hidden
      >
        {text}
      </motion.span>
    </span>
  );
};

/**
 * TypeWriter - Typewriter text effect
 */
export const TypeWriter: React.FC<{
  text: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
  className?: string;
  onComplete?: () => void;
}> = ({ text, speed = 50, delay = 0, cursor = true, className, onComplete }) => {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) {
      onComplete?.();
      return;
    }
    const timeout = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(timeout);
  }, [displayed, text, speed, started, onComplete]);

  return (
    <span className={className}>
      {displayed}
      {cursor && displayed.length < text.length && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle"
        />
      )}
    </span>
  );
};

/**
 * MorphingNumber - Smooth number transitions
 */
export const MorphingNumber: React.FC<{
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, duration = 1000, decimals = 0, prefix = '', suffix = '', className }) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const startVal = prevRef.current;
    const diff = value - startVal;
    if (diff === 0) return;

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startVal + diff * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevRef.current = value;
      }
    };

    requestAnimationFrame(animate);
    return () => { prevRef.current = value; };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
};

/**
 * AnimatedGradientBorder - Animated gradient border effect
 */
export const AnimatedGradientBorder: React.FC<{
  children: React.ReactNode;
  className?: string;
  borderWidth?: number;
  colors?: string[];
}> = ({ children, className, borderWidth = 2, colors = ['#00d4ff', '#7c3aed', '#f472b6', '#00d4ff'] }) => {
  return (
    <div className={`relative rounded-xl ${className}`}>
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{
          padding: borderWidth,
          background: `linear-gradient(var(--angle, 0deg), ${colors.join(', ')})`,
          maskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'xor',
          WebkitMaskComposite: 'xor',
        }}
        animate={{
          '--angle': ['0deg', '360deg'],
        } as any}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

/**
 * BlurIn - Blurs content in
 */
export const BlurIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={isInView ? { opacity: 1, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.6, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Wobble - Attention-getting wobble animation
 */
export const Wobble: React.FC<{
  children: React.ReactNode;
  trigger?: boolean;
  className?: string;
}> = ({ children, trigger, className }) => {
  return (
    <motion.div
      animate={trigger ? {
        rotate: [0, -5, 5, -3, 3, 0],
        transition: { duration: 0.5 },
      } : {}}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * ShimmerButton - Button with shimmer effect
 */
export const ShimmerButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, className, disabled }) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium shadow-lg shadow-cyan-500/25 disabled:opacity-50 ${className}`}
    >
      <span className="relative z-10">{children}</span>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: 'linear' }}
      />
    </motion.button>
  );
};

export default {
  springs,
  pageTransitions,
  staggerContainer,
  staggerItem,
  cardHover,
  FadeIn,
  ScaleIn,
  SlideIn,
  StaggerList,
  StaggerItem,
  ParallaxScroll,
  Reveal,
  TypeWriter,
  GlitchText,
  MorphingNumber,
  AnimatedGradientBorder,
  BlurIn,
  ShimmerButton,
};
