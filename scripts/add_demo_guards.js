/**
 * Script to add demo data guards to all frontend pages.
 * Adds `useIsDemoAccount` import and wraps mock data behind isDemo check.
 */
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'frontend', 'src', 'pages');

// Pages and their primary mock data variables (useState-initialized)
const useStatePages = {
  'APIKeyManager.tsx':   { vars: ['sampleKeys'], exportFn: 'APIKeyManager' },
  'AuditLog.tsx':        { vars: ['sampleAuditLog'], exportFn: 'AuditLog' },
  'BackupManager.tsx':   { vars: ['sampleBackups'], exportFn: 'BackupManager' },
  'BookmarksPage.tsx':   { vars: ['sampleBookmarks'], exportFn: 'BookmarksPage' },
  'CalendarPage.tsx':    { vars: ['generateEvents'], exportFn: null },  // exported as CalendarPage; 
  'CronJobManager.tsx':  { vars: ['sampleJobs'], exportFn: 'CronJobManager' },
  'DiffViewer.tsx':      { vars: ['sampleFiles'], exportFn: 'DiffViewer' },
  'FeatureFlags.tsx':    { vars: ['flagsData'], exportFn: null },
  'FeedbackPage.tsx':    { vars: ['sampleFeedback'], exportFn: 'FeedbackPage' },
  'KanbanBoard.tsx':     { vars: ['initialColumns'], exportFn: null },
  'LogViewer.tsx':       { vars: ['generateLogs'], exportFn: null },
  'MapView.tsx':         { vars: ['sampleMarkers'], exportFn: 'MapView' },
  'Marketplace.tsx':     { vars: ['pluginsData'], exportFn: null },
  'MediaGallery.tsx':    { vars: ['sampleMedia'], exportFn: 'MediaGallery' },
  'MLModelManager.tsx':  { vars: ['sampleModels'], exportFn: 'MLModelManager' },
  'NetworkTopology.tsx': { vars: ['sampleNodes'], exportFn: 'NetworkTopology' },
  'NotesPage.tsx':       { vars: ['notesData'], exportFn: null },
  'SnippetManager.tsx':  { vars: ['sampleSnippets'], exportFn: 'SnippetManager' },
  'StatusPage.tsx':      { vars: ['sampleServices', 'sampleIncidents'], exportFn: 'StatusPage' },
  'UserManagement.tsx':  { vars: ['sampleUsers'], exportFn: 'UserManagement' },
  'VersionHistory.tsx':  { vars: ['sampleVersions'], exportFn: 'VersionHistory' },
  'Voice.tsx':           { vars: ['mockHistory'], exportFn: 'Voice' },
  'WebhookManager.tsx':  { vars: ['sampleWebhooks'], exportFn: 'WebhookManager' },
  'WidgetDashboard.tsx': { vars: ['initialWidgets'], exportFn: 'WidgetDashboard' },
  'TeamChat.tsx':        { vars: ['sampleMessages'], exportFn: 'TeamChat' },
};

// Pages that use module-level data directly (no useState for main data)
const directUsePages = [
  'AIModels.tsx', 'DatabaseBrowser.tsx', 'DataPipelines.tsx', 'Network.tsx',
  'NetworkDevices.tsx', 'SecurityCenter.tsx', 'SecurityDashboard.tsx', 
  'UptimeMonitor.tsx', 'Vision.tsx', 'WeatherWidget.tsx', 'Workflows.tsx',
];

// Pages with API fallback patterns  
const apiFallbackPages = ['Agents.tsx', 'Finance.tsx', 'Home.tsx', 'Reports.tsx', 'Tasks.tsx'];

// Pages with useEffect setTimeout init
const useEffectPages = ['CacheManager.tsx', 'FormBuilder.tsx', 'QueueMonitor.tsx', 'RateLimiter.tsx', 'ServiceMesh.tsx'];

// Pages with special patterns
const specialPages = ['Dashboard.tsx', 'Health.tsx', 'Analytics.tsx', 'ActivityFeed.tsx',
  'ExperimentTracker.tsx', 'DeploymentManager.tsx', 'PerformanceProfiler.tsx',
  'DataExplorer.tsx', 'DesignSystem.tsx', 'ApiPlayground.tsx', 'SystemMonitor.tsx'];

const demoImport = "import { useIsDemoAccount } from '@/hooks/useDemoData';";

function addImport(content) {
  if (content.includes('useIsDemoAccount') || content.includes('useDemoData')) {
    return content;
  }
  // Find the last import statement and add after it
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || (line.startsWith('} from ') && !line.includes('export'))) {
      lastImportIdx = i;
    }
    // Also check for multi-line imports
    if (line.startsWith('from ') && line.includes("'")) {
      lastImportIdx = i;
    }
  }
  
  // Handle multi-line imports - find the actual end
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("} from '") || lines[i].includes("} from \"")) {
      lastImportIdx = Math.max(lastImportIdx, i);
    }
  }
  
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, demoImport);
    return lines.join('\n');
  }
  return demoImport + '\n' + content;
}

function addIsDemoHook(content) {
  // Find the main component function and add isDemo hook right after opening brace
  // Patterns: 
  //   export default function Name() {
  //   function Name() {     (before export default Name;)
  //   const Name = ... => {
  
  // Look for "export default function" pattern
  const patterns = [
    /^(export default function \w+\([^)]*\)\s*\{)/m,
    /^(function \w+\([^)]*\)\s*\{)/m,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const idx = content.indexOf(match[0]);
      const insertPos = idx + match[0].length;
      // Check if isDemo already exists
      const nextChunk = content.slice(insertPos, insertPos + 200);
      if (nextChunk.includes('useIsDemoAccount')) return content;
      
      content = content.slice(0, insertPos) + 
        '\n  const isDemo = useIsDemoAccount();' +
        content.slice(insertPos);
      return content;
    }
  }
  
  // For arrow function components or wrapped exports
  // Try to find the main component via common patterns
  const arrowMatch = content.match(/^(const \w+ = (?:React\.)?memo\(\(\) => \{|function \w+\(\) \{)/m);
  if (arrowMatch) {
    const idx = content.indexOf(arrowMatch[0]);
    const insertPos = idx + arrowMatch[0].length;
    const nextChunk = content.slice(insertPos, insertPos + 200);
    if (!nextChunk.includes('useIsDemoAccount')) {
      content = content.slice(0, insertPos) + 
        '\n  const isDemo = useIsDemoAccount();' +
        content.slice(insertPos);
    }
  }
  
  return content;
}

function wrapUseStateInit(content, varName) {
  // Pattern: useState(varName) or useState<Type>(varName) or useState<Type[]>(varName)
  // Replace with: useState(isDemo ? varName : []) or appropriate empty value
  
  // Handle function calls like generateEvents() or generateLogs(100)
  const funcCallRegex = new RegExp(`useState\\(${varName}\\(([^)]*)\\)\\)`, 'g');
  content = content.replace(funcCallRegex, `useState(isDemo ? ${varName}($1) : [])`);
  
  // Handle typed: useState<Type[]>(varName)
  const typedRegex = new RegExp(`useState<([^>]+)>\\(${varName}\\)`, 'g');
  content = content.replace(typedRegex, `useState<$1>(isDemo ? ${varName} : [])`);
  
  // Handle simple: useState(varName)
  const simpleRegex = new RegExp(`useState\\(${varName}\\)(?!\\s*\\?)`, 'g');
  content = content.replace(simpleRegex, `useState(isDemo ? ${varName} : [])`);
  
  // Handle: useState(varName[0]) for selectedItem patterns
  const indexRegex = new RegExp(`useState\\(${varName}\\[(\\d+)\\]\\)`, 'g');
  content = content.replace(indexRegex, `useState(isDemo ? ${varName}[$1] : null)`);
  
  return content;
}

function wrapApiCallbackFallback(content, mockVar) {
  // Pattern: storeTasks.length > 0 ? storeTasks : mockTasks
  // Replace with: storeTasks.length > 0 ? storeTasks : (isDemo ? mockTasks : [])
  const regex = new RegExp(`(\\w+\\.length\\s*>\\s*0\\s*\\?\\s*\\w+\\s*:\\s*)${mockVar}`, 'g');
  content = content.replace(regex, `$1(isDemo ? ${mockVar} : [])`);
  return content;
}

let processed = 0;
let modified = 0;

// Process all page files
const allFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));
const skipFiles = ['LoginPage.tsx', 'Settings.tsx', 'ProfilePage.tsx', 'HelpCenter.tsx', 
  'OnboardingPage.tsx', 'IntegrationSettings.tsx', 'NotificationsCenter.tsx',
  'TerminalPage.tsx', 'FileManager.tsx', 'Automations.tsx', 'CommandCenter.tsx',
  'ThemeEditor.tsx', 'TagManager.tsx', 'Chat.tsx',
  'EmailComposer.tsx', 'CodeEditor.tsx', 'ResourceMonitor.tsx', 'ChatbotBuilder.tsx',
  'SSHTerminal.tsx'];

for (const file of allFiles) {
  if (skipFiles.includes(file)) continue;
  
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Step 1: Add import
  content = addImport(content);
  
  // Step 2: Add isDemo hook inside component
  content = addIsDemoHook(content);
  
  // Step 3: Wrap mock data based on page type
  if (useStatePages[file]) {
    for (const v of useStatePages[file].vars) {
      content = wrapUseStateInit(content, v);
    }
  }
  
  if (apiFallbackPages.includes(file)) {
    // These have patterns like: storeTasks.length > 0 ? storeTasks : mockTasks
    const fallbackVars = {
      'Agents.tsx': 'MOCK_AGENTS',
      'Finance.tsx': 'mockTransactions',
      'Home.tsx': 'mockRooms',
      'Reports.tsx': 'mockReportHistory',
      'Tasks.tsx': 'mockTasks',
    };
    if (fallbackVars[file]) {
      content = wrapApiCallbackFallback(content, fallbackVars[file]);
    }
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    modified++;
    console.log(`✓ Modified: ${file}`);
  } else {
    console.log(`- Skipped: ${file} (no changes needed)`);
  }
  processed++;
}

console.log(`\nDone. Processed ${processed} files, modified ${modified}.`);
