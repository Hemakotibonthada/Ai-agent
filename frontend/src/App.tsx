import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './hooks/useTheme';
import { useKeyboard } from './hooks/useKeyboard';

/* ------------------------------------------------------------------ */
/*  Lazy-loaded pages                                                  */
/* ------------------------------------------------------------------ */
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const Chat             = lazy(() => import('./pages/Chat'));
const Tasks            = lazy(() => import('./pages/Tasks'));
const Home             = lazy(() => import('./pages/Home'));
const Health           = lazy(() => import('./pages/Health'));
const Finance          = lazy(() => import('./pages/Finance'));
const Reports          = lazy(() => import('./pages/Reports'));
const Settings         = lazy(() => import('./pages/Settings'));
const Voice            = lazy(() => import('./pages/Voice'));
const Vision           = lazy(() => import('./pages/Vision'));
const Network          = lazy(() => import('./pages/Network'));
const Agents           = lazy(() => import('./pages/Agents'));
const AIModels         = lazy(() => import('./pages/AIModels'));
const Analytics        = lazy(() => import('./pages/Analytics'));
const Workflows        = lazy(() => import('./pages/Workflows'));
const Marketplace      = lazy(() => import('./pages/Marketplace'));
const DataPipelines    = lazy(() => import('./pages/DataPipelines'));
const FeatureFlags     = lazy(() => import('./pages/FeatureFlags'));
const CalendarPage     = lazy(() => import('./pages/CalendarPage'));
const TerminalPage     = lazy(() => import('./pages/TerminalPage'));
const KanbanBoard      = lazy(() => import('./pages/KanbanBoard'));
const NotesPage        = lazy(() => import('./pages/NotesPage'));
const FileManager      = lazy(() => import('./pages/FileManager'));
const ApiPlayground    = lazy(() => import('./pages/ApiPlayground'));
const LogViewer        = lazy(() => import('./pages/LogViewer'));
const SystemMonitor    = lazy(() => import('./pages/SystemMonitor'));
const ProfilePage      = lazy(() => import('./pages/ProfilePage'));
const DatabaseBrowser  = lazy(() => import('./pages/DatabaseBrowser'));
const Automations      = lazy(() => import('./pages/Automations'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const ActivityFeed       = lazy(() => import('./pages/ActivityFeed'));
const NotificationsCenter = lazy(() => import('./pages/NotificationsCenter'));
const HelpCenter         = lazy(() => import('./pages/HelpCenter'));
const OnboardingPage     = lazy(() => import('./pages/OnboardingPage'));
const IntegrationSettings = lazy(() => import('./pages/IntegrationSettings'));
const ExperimentTracker  = lazy(() => import('./pages/ExperimentTracker'));
const DeploymentManager  = lazy(() => import('./pages/DeploymentManager'));
const BookmarksPage      = lazy(() => import('./pages/BookmarksPage'));
const TagManager         = lazy(() => import('./pages/TagManager'));
const CronJobManager     = lazy(() => import('./pages/CronJobManager'));
const MLModelManager     = lazy(() => import('./pages/MLModelManager'));
const WeatherWidget      = lazy(() => import('./pages/WeatherWidget'));
const VersionHistory     = lazy(() => import('./pages/VersionHistory'));
const FeedbackPage       = lazy(() => import('./pages/FeedbackPage'));
const AuditLog           = lazy(() => import('./pages/AuditLog'));
const PerformanceProfiler = lazy(() => import('./pages/PerformanceProfiler'));
const MediaGallery       = lazy(() => import('./pages/MediaGallery'));
const ThemeEditor        = lazy(() => import('./pages/ThemeEditor'));
const NetworkTopology    = lazy(() => import('./pages/NetworkTopology'));
const StatusPage         = lazy(() => import('./pages/StatusPage'));
const DiffViewer         = lazy(() => import('./pages/DiffViewer'));
const MapView            = lazy(() => import('./pages/MapView'));
const WidgetDashboard    = lazy(() => import('./pages/WidgetDashboard'));
const SnippetManager     = lazy(() => import('./pages/SnippetManager'));
const UserManagement     = lazy(() => import('./pages/UserManagement'));
const BackupManager      = lazy(() => import('./pages/BackupManager'));
const APIKeyManager      = lazy(() => import('./pages/APIKeyManager'));
const NetworkDevices     = lazy(() => import('./pages/NetworkDevices'));
const DesignSystem       = lazy(() => import('./pages/DesignSystem'));
const WebhookManager     = lazy(() => import('./pages/WebhookManager'));
const SecurityCenter     = lazy(() => import('./pages/SecurityCenter'));
const TeamChat           = lazy(() => import('./pages/TeamChat'));
const DataExplorer       = lazy(() => import('./pages/DataExplorer'));
const CommandCenter      = lazy(() => import('./pages/CommandCenter'));
const UptimeMonitor      = lazy(() => import('./pages/UptimeMonitor'));
const GitManager         = lazy(() => import('./pages/GitManager'));
const ContainerManager   = lazy(() => import('./pages/ContainerManager'));
const SecretsVault       = lazy(() => import('./pages/SecretsVault'));
const RateLimiter        = lazy(() => import('./pages/RateLimiter'));
const QueueMonitor       = lazy(() => import('./pages/QueueMonitor'));
const EnvironmentManager = lazy(() => import('./pages/EnvironmentManager'));
const EmailComposer      = lazy(() => import('./pages/EmailComposer'));
const CodeEditor         = lazy(() => import('./pages/CodeEditor'));
const ResourceMonitor    = lazy(() => import('./pages/ResourceMonitor'));
const ChatbotBuilder     = lazy(() => import('./pages/ChatbotBuilder'));
const FormBuilder        = lazy(() => import('./pages/FormBuilder'));
const APIDocumentation   = lazy(() => import('./pages/APIDocumentation'));
const SSHTerminal        = lazy(() => import('./pages/SSHTerminal'));
const ServiceMesh        = lazy(() => import('./pages/ServiceMesh'));
const CacheManager       = lazy(() => import('./pages/CacheManager'));

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
              <Route path="/"                element={<AnimatedPage><Dashboard /></AnimatedPage>} />
              <Route path="/chat"            element={<AnimatedPage><Chat /></AnimatedPage>} />
              <Route path="/tasks"           element={<AnimatedPage><Tasks /></AnimatedPage>} />
              <Route path="/home"            element={<AnimatedPage><Home /></AnimatedPage>} />
              <Route path="/health"          element={<AnimatedPage><Health /></AnimatedPage>} />
              <Route path="/finance"         element={<AnimatedPage><Finance /></AnimatedPage>} />
              <Route path="/reports"         element={<AnimatedPage><Reports /></AnimatedPage>} />
              <Route path="/settings"        element={<AnimatedPage><Settings /></AnimatedPage>} />
              <Route path="/voice"           element={<AnimatedPage><Voice /></AnimatedPage>} />
              <Route path="/vision"          element={<AnimatedPage><Vision /></AnimatedPage>} />
              <Route path="/network"         element={<AnimatedPage><Network /></AnimatedPage>} />
              <Route path="/agents"          element={<AnimatedPage><Agents /></AnimatedPage>} />
              <Route path="/ai-models"       element={<AnimatedPage><AIModels /></AnimatedPage>} />
              <Route path="/analytics"       element={<AnimatedPage><Analytics /></AnimatedPage>} />
              <Route path="/workflows"       element={<AnimatedPage><Workflows /></AnimatedPage>} />
              <Route path="/marketplace"     element={<AnimatedPage><Marketplace /></AnimatedPage>} />
              <Route path="/data-pipelines"  element={<AnimatedPage><DataPipelines /></AnimatedPage>} />
              <Route path="/feature-flags"   element={<AnimatedPage><FeatureFlags /></AnimatedPage>} />
              <Route path="/calendar"        element={<AnimatedPage><CalendarPage /></AnimatedPage>} />
              <Route path="/terminal"        element={<AnimatedPage><TerminalPage /></AnimatedPage>} />
              <Route path="/kanban"          element={<AnimatedPage><KanbanBoard /></AnimatedPage>} />
              <Route path="/notes"           element={<AnimatedPage><NotesPage /></AnimatedPage>} />
              <Route path="/files"           element={<AnimatedPage><FileManager /></AnimatedPage>} />
              <Route path="/api-playground"  element={<AnimatedPage><ApiPlayground /></AnimatedPage>} />
              <Route path="/logs"            element={<AnimatedPage><LogViewer /></AnimatedPage>} />
              <Route path="/system-monitor"  element={<AnimatedPage><SystemMonitor /></AnimatedPage>} />
              <Route path="/profile"         element={<AnimatedPage><ProfilePage /></AnimatedPage>} />
              <Route path="/database"        element={<AnimatedPage><DatabaseBrowser /></AnimatedPage>} />
              <Route path="/automations"     element={<AnimatedPage><Automations /></AnimatedPage>} />
              <Route path="/security"        element={<AnimatedPage><SecurityDashboard /></AnimatedPage>} />
              <Route path="/activity"        element={<AnimatedPage><ActivityFeed /></AnimatedPage>} />
              <Route path="/notifications"   element={<AnimatedPage><NotificationsCenter /></AnimatedPage>} />
              <Route path="/help"            element={<AnimatedPage><HelpCenter /></AnimatedPage>} />
              <Route path="/onboarding"      element={<AnimatedPage><OnboardingPage /></AnimatedPage>} />
              <Route path="/integrations"    element={<AnimatedPage><IntegrationSettings /></AnimatedPage>} />
              <Route path="/experiments"     element={<AnimatedPage><ExperimentTracker /></AnimatedPage>} />
              <Route path="/deployments"     element={<AnimatedPage><DeploymentManager /></AnimatedPage>} />
              <Route path="/bookmarks"       element={<AnimatedPage><BookmarksPage /></AnimatedPage>} />
              <Route path="/tags"            element={<AnimatedPage><TagManager /></AnimatedPage>} />
              <Route path="/cron-jobs"       element={<AnimatedPage><CronJobManager /></AnimatedPage>} />
              <Route path="/ml-models"       element={<AnimatedPage><MLModelManager /></AnimatedPage>} />
              <Route path="/weather"         element={<AnimatedPage><WeatherWidget /></AnimatedPage>} />
              <Route path="/version-history" element={<AnimatedPage><VersionHistory /></AnimatedPage>} />
              <Route path="/feedback"        element={<AnimatedPage><FeedbackPage /></AnimatedPage>} />
              <Route path="/audit-log"       element={<AnimatedPage><AuditLog /></AnimatedPage>} />
              <Route path="/performance"     element={<AnimatedPage><PerformanceProfiler /></AnimatedPage>} />
              <Route path="/media"           element={<AnimatedPage><MediaGallery /></AnimatedPage>} />
              <Route path="/theme-editor"    element={<AnimatedPage><ThemeEditor /></AnimatedPage>} />
              <Route path="/network-topology" element={<AnimatedPage><NetworkTopology /></AnimatedPage>} />
              <Route path="/status"          element={<AnimatedPage><StatusPage /></AnimatedPage>} />
              <Route path="/diff-viewer"     element={<AnimatedPage><DiffViewer /></AnimatedPage>} />
              <Route path="/map"             element={<AnimatedPage><MapView /></AnimatedPage>} />
              <Route path="/widgets"         element={<AnimatedPage><WidgetDashboard /></AnimatedPage>} />
              <Route path="/snippets"        element={<AnimatedPage><SnippetManager /></AnimatedPage>} />
              <Route path="/users"           element={<AnimatedPage><UserManagement /></AnimatedPage>} />
              <Route path="/backups"         element={<AnimatedPage><BackupManager /></AnimatedPage>} />
              <Route path="/api-keys"        element={<AnimatedPage><APIKeyManager /></AnimatedPage>} />
              <Route path="/network-devices" element={<AnimatedPage><NetworkDevices /></AnimatedPage>} />
              <Route path="/design-system"   element={<AnimatedPage><DesignSystem /></AnimatedPage>} />
              <Route path="/webhooks"        element={<AnimatedPage><WebhookManager /></AnimatedPage>} />
              <Route path="/security-center" element={<AnimatedPage><SecurityCenter /></AnimatedPage>} />
              <Route path="/team-chat"       element={<AnimatedPage><TeamChat /></AnimatedPage>} />
              <Route path="/data-explorer"   element={<AnimatedPage><DataExplorer /></AnimatedPage>} />
              <Route path="/command-center"  element={<AnimatedPage><CommandCenter /></AnimatedPage>} />
              <Route path="/uptime"          element={<AnimatedPage><UptimeMonitor /></AnimatedPage>} />
              <Route path="/git"             element={<AnimatedPage><GitManager /></AnimatedPage>} />
              <Route path="/containers"      element={<AnimatedPage><ContainerManager /></AnimatedPage>} />
              <Route path="/secrets"         element={<AnimatedPage><SecretsVault /></AnimatedPage>} />
              <Route path="/rate-limits"     element={<AnimatedPage><RateLimiter /></AnimatedPage>} />
              <Route path="/queues"          element={<AnimatedPage><QueueMonitor /></AnimatedPage>} />
              <Route path="/environments"    element={<AnimatedPage><EnvironmentManager /></AnimatedPage>} />
              <Route path="/email"           element={<AnimatedPage><EmailComposer /></AnimatedPage>} />
              <Route path="/code-editor"     element={<AnimatedPage><CodeEditor /></AnimatedPage>} />
              <Route path="/resources"       element={<AnimatedPage><ResourceMonitor /></AnimatedPage>} />
              <Route path="/chatbot-builder" element={<AnimatedPage><ChatbotBuilder /></AnimatedPage>} />
              <Route path="/form-builder"    element={<AnimatedPage><FormBuilder /></AnimatedPage>} />
              <Route path="/api-docs"        element={<AnimatedPage><APIDocumentation /></AnimatedPage>} />
              <Route path="/ssh"             element={<AnimatedPage><SSHTerminal /></AnimatedPage>} />
              <Route path="/service-mesh"    element={<AnimatedPage><ServiceMesh /></AnimatedPage>} />
              <Route path="/cache"           element={<AnimatedPage><CacheManager /></AnimatedPage>} />
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
