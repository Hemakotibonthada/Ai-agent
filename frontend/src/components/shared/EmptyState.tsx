/* ===================================================================
   Empty State Component
   Shown when a page has no data (non-demo accounts without real data)
   =================================================================== */

import React from 'react';
import { motion } from 'framer-motion';
import { Database, Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  title = 'No data yet',
  description = 'Connect your services or add data to get started.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-1 items-center justify-center p-12"
    >
      <div className="text-center max-w-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
          {icon || <Database className="text-gray-500" size={28} />}
        </div>
        <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-purple-600/20 border border-purple-500/30 px-4 py-2 text-sm text-purple-300 hover:bg-purple-600/30 transition-colors"
          >
            <Plus size={16} />
            {action.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}
