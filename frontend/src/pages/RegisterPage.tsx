/* ===================================================================
   Nexus AI OS — Create Account Page
   Register a new user account
   =================================================================== */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Brain,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  Loader2,
  Check,
  X,
  ArrowLeft,
  Mail,
  User,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores';

/* ------------------------------------------------------------------ */
/*  Password strength helper                                           */
/* ------------------------------------------------------------------ */
interface PasswordCheck {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_CHECKS: PasswordCheck[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Contains uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Contains lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Contains a number', test: (pw) => /\d/.test(pw) },
  { label: 'Contains special character', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

function getStrength(pw: string): number {
  return PASSWORD_CHECKS.filter((c) => c.test(pw)).length;
}

function strengthColor(strength: number): string {
  if (strength <= 1) return 'bg-red-500';
  if (strength <= 2) return 'bg-orange-500';
  if (strength <= 3) return 'bg-yellow-500';
  if (strength <= 4) return 'bg-blue-500';
  return 'bg-green-500';
}

function strengthLabel(strength: number): string {
  if (strength <= 1) return 'Very Weak';
  if (strength <= 2) return 'Weak';
  if (strength <= 3) return 'Fair';
  if (strength <= 4) return 'Strong';
  return 'Very Strong';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function RegisterPage() {
  const { register, isLoading, error, setError } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = getStrength(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) return setError('Username is required');
    if (username.trim().length < 3) return setError('Username must be at least 3 characters');
    if (!email.trim()) return setError('Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Please enter a valid email');
    if (strength < 3) return setError('Please choose a stronger password');
    if (password !== confirmPassword) return setError('Passwords do not match');

    try {
      await register(username.trim(), email.trim(), password, displayName.trim() || undefined);
    } catch {
      // error set in store
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-nexus-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-nexus-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nexus-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-2xl border border-nexus-border/40 bg-nexus-card/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* Back to Login */}
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-nexus-muted hover:text-nexus-text transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nexus-accent to-nexus-primary flex items-center justify-center mb-3 shadow-lg shadow-nexus-primary/25"
            >
              <Brain className="text-white" size={28} />
            </motion.div>
            <h1 className="text-2xl font-bold gradient-text">Create Account</h1>
            <p className="text-sm text-nexus-muted mt-1">Join the Nexus AI Operating System</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 flex items-center gap-2 rounded-lg bg-nexus-error/10 border border-nexus-error/20 px-4 py-3 text-sm text-nexus-error"
            >
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-nexus-text/80 mb-1">Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-nexus-surface/60 border border-nexus-border/60 text-nexus-text placeholder-nexus-muted/50 focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 focus:border-nexus-primary/50 transition-all text-sm"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-nexus-text/80 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-nexus-surface/60 border border-nexus-border/60 text-nexus-text placeholder-nexus-muted/50 focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 focus:border-nexus-primary/50 transition-all text-sm"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Display Name (optional) */}
            <div>
              <label className="block text-sm font-medium text-nexus-text/80 mb-1">
                Display Name <span className="text-nexus-muted/60">(optional)</span>
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-nexus-surface/60 border border-nexus-border/60 text-nexus-text placeholder-nexus-muted/50 focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 focus:border-nexus-primary/50 transition-all text-sm"
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-nexus-text/80 mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full pl-10 pr-12 py-2.5 rounded-xl bg-nexus-surface/60 border border-nexus-border/60 text-nexus-text placeholder-nexus-muted/50 focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 focus:border-nexus-primary/50 transition-all text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength meter */}
              {password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-nexus-border/40 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${strengthColor(strength)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(strength / 5) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className="text-[11px] text-nexus-muted w-20 text-right">{strengthLabel(strength)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    {PASSWORD_CHECKS.map((check) => {
                      const passed = check.test(password);
                      return (
                        <div key={check.label} className="flex items-center gap-1.5 text-[11px]">
                          {passed ? (
                            <Check size={12} className="text-green-400" />
                          ) : (
                            <X size={12} className="text-nexus-muted/40" />
                          )}
                          <span className={passed ? 'text-green-400' : 'text-nexus-muted/60'}>{check.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-nexus-text/80 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className={`w-full pl-10 pr-12 py-2.5 rounded-xl bg-nexus-surface/60 border text-nexus-text placeholder-nexus-muted/50 focus:outline-none focus:ring-2 transition-all text-sm ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-green-500/30 focus:ring-green-500/50 focus:border-green-500/50'
                        : 'border-nexus-error/30 focus:ring-nexus-error/50 focus:border-nexus-error/50'
                      : 'border-nexus-border/60 focus:ring-nexus-primary/50 focus:border-nexus-primary/50'
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-nexus-error mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-nexus-accent to-nexus-primary text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-nexus-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-5"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <UserPlus size={18} />
              )}
              {isLoading ? 'Creating account…' : 'Create Account'}
            </motion.button>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-nexus-muted mt-6">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-nexus-primary hover:text-nexus-primary/80 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
