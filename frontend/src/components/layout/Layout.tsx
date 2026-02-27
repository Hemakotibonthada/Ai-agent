import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import ParticleBackground from '../shared/ParticleBackground';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface LayoutProps {
  children: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Page transition variants                                           */
/* ------------------------------------------------------------------ */
const contentVariants = {
  initial:  { opacity: 0, y: 10, filter: 'blur(4px)' },
  animate:  { opacity: 1, y: 0,  filter: 'blur(0px)' },
  exit:     { opacity: 0, y: -6, filter: 'blur(4px)' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-nexus-bg text-nexus-text">
      {/* Particle canvas behind everything */}
      <ParticleBackground particleCount={50} speed={0.2} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main column */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <Header onNavigate={navigate} />

        {/* Page content with animated transitions */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={typeof window !== 'undefined' ? window.location.pathname : ''}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="mx-auto w-full max-w-7xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
