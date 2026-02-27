/* ===================================================================
   Nexus AI OS — Login Page
   Authenticate with the backend or sign in as demo user
   =================================================================== */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Brain,
  Eye,
  EyeOff,
  LogIn,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores';

export default function LoginPage() {
  const { login, isLoading, error, setError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    try {
      await login(username.trim(), password);
    } catch {
      // error is set in store
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    try {
      await login('demo', 'demo1234');
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs — use theme-aware accent colors */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-nexus-secondary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-nexus-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nexus-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md z-10"
      >
        {/* Card */}
        <div className="rounded-2xl border border-nexus-border/40 bg-nexus-card/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-nexus-secondary to-nexus-primary flex items-center justify-center mb-4 shadow-lg shadow-nexus-primary/25"
            >
              <Brain className="text-white" size={32} />
            </motion.div>
            <h1 className="text-2xl font-bold gradient-text">Nexus AI</h1>
            <p className="text-sm text-nexus-muted mt-1">Sign in to your AI Operating System</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 flex items-center gap-2 rounded-lg bg-nexus-error/10 border border-nexus-error/20 px-4 py-3 text-sm text-nexus-error"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nexus-text/80 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-xl bg-nexus-surface/60 border border-nexus-border/60 text-nexus-text placeholder-nexus-muted/50 focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 focus:border-nexus-primary/50 transition-all"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nexus-text/80 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl bg-nexus-surface/60 border border-nexus-border/60 text-nexus-text placeholder-nexus-muted/50 focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 focus:border-nexus-primary/50 transition-all pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-nexus-secondary to-nexus-primary text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-nexus-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
              {isLoading ? 'Signing in…' : 'Sign In'}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-nexus-border/50" />
            <span className="text-xs text-nexus-muted uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-nexus-border/50" />
          </div>

          {/* Demo Login */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border border-nexus-primary/30 text-nexus-primary font-medium flex items-center justify-center gap-2 hover:bg-nexus-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={18} />
            Try Demo Account
          </motion.button>
          <p className="text-center text-xs text-nexus-muted mt-3">
            Demo account comes with sample data to explore all features
          </p>

          {/* Create account */}
          <p className="text-center text-sm text-nexus-muted mt-5">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-nexus-primary hover:text-nexus-primary/80 font-medium transition-colors"
            >
              Create one
            </Link>
          </p>

          {/* Admin hint */}
          <div className="mt-4 pt-4 border-t border-nexus-border/20">
            <p className="text-xs text-nexus-muted/60 text-center">
              Admin: <span className="text-nexus-muted/80">admin</span> / <span className="text-nexus-muted/80">Admin@2024!</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
