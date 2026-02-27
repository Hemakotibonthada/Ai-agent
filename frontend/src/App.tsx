import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './hooks/useTheme';
import { useKeyboard } from './hooks/useKeyboard';

/* ------------------------------------------------------------------ */
/*  Lazy-loaded pages                                                  */
/* ------------------------------------------------------------------ */
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Chat       = lazy(() => import('./pages/Chat'));
const Tasks      = lazy(() => import('./pages/Tasks'));
const Home       = lazy(() => import('./pages/Home'));
const Health     = lazy(() => import('./pages/Health'));
const Finance    = lazy(() => import('./pages/Finance'));
const Reports    = lazy(() => import('./pages/Reports'));
const Settings   = lazy(() => import('./pages/Settings'));
const Voice      = lazy(() => import('./pages/Voice'));
const Vision     = lazy(() => import('./pages/Vision'));
const Network    = lazy(() => import('./pages/Network'));
const Agents     = lazy(() => import('./pages/Agents'));
const AIModels   = lazy(() => import('./pages/AIModels'));

/* ------------------------------------------------------------------ */
/*  Loading fallback                                                   */
/* ------------------------------------------------------------------ */
function NexusLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-nexus-bg">
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-nexus-primary/30 animate-spin-slow" />
          <div className="absolute inset-1 rounded-full border-t-2 border-nexus-accent animate-spin" />
          <div className="absolute inset-3 rounded-full bg-nexus-primary/20 animate-pulse" />
        </div>
        <p className="gradient-text text-lg font-semibold tracking-widest uppercase">
          Loading Nexus…
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layout wrapper                                                     */
/* ------------------------------------------------------------------ */
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-nexus-bg text-nexus-text">
      {/* Particle / ambient background */}
      <div className="particle-bg pointer-events-none fixed inset-0 z-0" />

      {/* Main content area */}
      <main className="relative z-10 flex flex-1 flex-col overflow-y-auto scrollbar-thin">
        {children}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated route wrapper                                             */
/* ------------------------------------------------------------------ */
const pageVariants = {
  initial:  { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate:  { opacity: 1, y: 0,  filter: 'blur(0px)' },
  exit:     { opacity: 0, y: -8, filter: 'blur(4px)' },
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex-1"
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */
export default function App() {
  const location = useLocation();
  const { theme } = useTheme();
  useKeyboard();

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Layout>
        <Suspense fallback={<NexusLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/"         element={<AnimatedPage><Dashboard /></AnimatedPage>} />
              <Route path="/chat"     element={<AnimatedPage><Chat /></AnimatedPage>} />
              <Route path="/tasks"    element={<AnimatedPage><Tasks /></AnimatedPage>} />
              <Route path="/home"     element={<AnimatedPage><Home /></AnimatedPage>} />
              <Route path="/health"   element={<AnimatedPage><Health /></AnimatedPage>} />
              <Route path="/finance"  element={<AnimatedPage><Finance /></AnimatedPage>} />
              <Route path="/reports"  element={<AnimatedPage><Reports /></AnimatedPage>} />
              <Route path="/settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
              <Route path="/voice"    element={<AnimatedPage><Voice /></AnimatedPage>} />
              <Route path="/vision"   element={<AnimatedPage><Vision /></AnimatedPage>} />
              <Route path="/network"  element={<AnimatedPage><Network /></AnimatedPage>} />
              <Route path="/agents"   element={<AnimatedPage><Agents /></AnimatedPage>} />
              <Route path="/ai-models" element={<AnimatedPage><AIModels /></AnimatedPage>} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </Layout>

      {/* Global toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'glass !bg-nexus-card !text-nexus-text !border !border-nexus-border',
          duration: 4000,
          style: {
            background: '#252538',
            color: '#E2E8F0',
            border: '1px solid #2E2E45',
          },
        }}
      />
    </div>
  );
}
