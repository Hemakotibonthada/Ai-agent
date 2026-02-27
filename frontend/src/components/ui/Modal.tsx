import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Size map                                                           */
/* ------------------------------------------------------------------ */
const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
};

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -12, scale: 0.97, filter: 'blur(4px)' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay with glass blur */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            {/* Content */}
            <Dialog.Content asChild onEscapeKeyDown={() => onOpenChange(false)}>
              <motion.div
                className={`
                  fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2
                  ${sizeStyles[size]}
                  glass-heavy rounded-2xl border border-nexus-border p-6 shadow-2xl
                  focus:outline-none
                `}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {/* Header */}
                {(title || description) && (
                  <div className="mb-5">
                    {title && (
                      <Dialog.Title className="text-lg font-semibold text-nexus-text">
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description className="mt-1 text-sm text-nexus-muted">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                )}

                {/* Body */}
                <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">{children}</div>

                {/* Footer */}
                {footer && (
                  <div className="mt-5 flex items-center justify-end gap-3 border-t border-nexus-border/50 pt-4">
                    {footer}
                  </div>
                )}

                {/* Close button */}
                <Dialog.Close asChild>
                  <button
                    className="absolute right-4 top-4 rounded-lg p-1 text-nexus-muted transition hover:bg-white/10 hover:text-nexus-text focus-ring"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
