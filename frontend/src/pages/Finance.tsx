/* ===================================================================
   Nexus AI OS — Finance Page
   Balance overview, transactions, budgets, charts, goals, AI tips
   =================================================================== */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  CreditCard,
  Target,
  Plus,
  Filter,
  Search,
  Download,
  Calendar,
  Tag,
  ShoppingCart,
  Home,
  Car,
  Utensils,
  Sparkles,
  Briefcase,
  Heart,
  Gamepad2,
  Zap,
  ChevronRight,
  Receipt,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Progress from '@/components/ui/Progress';
import { CircularProgress } from '@/components/ui/Progress';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import useStore from '@/lib/store';
import { financeApi } from '@/lib/api';
import type { Transaction, TransactionType } from '@/types';

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */
const categoryIcons: Record<string, { icon: React.ElementType; color: string }> = {
  food: { icon: Utensils, color: '#F59E0B' },
  housing: { icon: Home, color: '#3B82F6' },
  transport: { icon: Car, color: '#8B5CF6' },
  shopping: { icon: ShoppingCart, color: '#EC4899' },
  health: { icon: Heart, color: '#EF4444' },
  entertainment: { icon: Gamepad2, color: '#06B6D4' },
  utilities: { icon: Zap, color: '#F97316' },
  salary: { icon: Briefcase, color: '#10B981' },
  freelance: { icon: CreditCard, color: '#14B8A6' },
  investment: { icon: TrendingUp, color: '#6366F1' },
};

const pieColors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#10B981', '#F97316', '#EF4444'];

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const mockTransactions: Transaction[] = [
  { id: '1', type: 'expense', amount: 42.50, currency: 'USD', category: 'food', description: 'Grocery shopping', date: '2026-02-26', tags: ['groceries'], recurring: false },
  { id: '2', type: 'income', amount: 5200.00, currency: 'USD', category: 'salary', description: 'Monthly salary', date: '2026-02-25', tags: ['work'], recurring: true },
  { id: '3', type: 'expense', amount: 1200.00, currency: 'USD', category: 'housing', description: 'Rent payment', date: '2026-02-24', tags: ['rent'], recurring: true },
  { id: '4', type: 'expense', amount: 85.00, currency: 'USD', category: 'utilities', description: 'Electricity bill', date: '2026-02-23', tags: ['bills'], recurring: true },
  { id: '5', type: 'expense', amount: 55.00, currency: 'USD', category: 'transport', description: 'Gas refill', date: '2026-02-22', tags: [], recurring: false },
  { id: '6', type: 'expense', amount: 120.00, currency: 'USD', category: 'shopping', description: 'New headphones', date: '2026-02-21', tags: ['tech'], recurring: false },
  { id: '7', type: 'income', amount: 800.00, currency: 'USD', category: 'freelance', description: 'Freelance project', date: '2026-02-20', tags: [], recurring: false },
  { id: '8', type: 'expense', amount: 35.00, currency: 'USD', category: 'entertainment', description: 'Movie tickets', date: '2026-02-19', tags: [], recurring: false },
  { id: '9', type: 'expense', amount: 60.00, currency: 'USD', category: 'health', description: 'Gym membership', date: '2026-02-18', tags: ['fitness'], recurring: true },
  { id: '10', type: 'investment', amount: 500.00, currency: 'USD', category: 'investment', description: 'ETF purchase', date: '2026-02-17', tags: ['stocks'], recurring: false },
];

const monthlyTrend = [
  { month: 'Sep', income: 5800, expense: 3200 },
  { month: 'Oct', income: 6100, expense: 3800 },
  { month: 'Nov', income: 5500, expense: 3100 },
  { month: 'Dec', income: 7200, expense: 4500 },
  { month: 'Jan', income: 5900, expense: 3400 },
  { month: 'Feb', income: 6000, expense: 3600 },
];

const expenseBreakdown = [
  { name: 'Housing', value: 1200 },
  { name: 'Food', value: 480 },
  { name: 'Transport', value: 220 },
  { name: 'Shopping', value: 350 },
  { name: 'Utilities', value: 170 },
  { name: 'Entertainment', value: 130 },
  { name: 'Health', value: 120 },
];

const mockBudgets = [
  { category: 'Food', spent: 420, budget: 500 },
  { category: 'Transport', spent: 180, budget: 250 },
  { category: 'Shopping', spent: 350, budget: 300 },
  { category: 'Entertainment', spent: 90, budget: 200 },
  { category: 'Utilities', spent: 170, budget: 200 },
];

const mockGoals = [
  { name: 'Emergency Fund', current: 8500, target: 15000, color: '#3B82F6' },
  { name: 'Vacation', current: 2200, target: 5000, color: '#8B5CF6' },
  { name: 'New Laptop', current: 950, target: 1500, color: '#06B6D4' },
];

/* ------------------------------------------------------------------ */
/*  Add Transaction Modal                                              */
/* ------------------------------------------------------------------ */
function AddTransactionModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Transaction>) => void;
}) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!amount || !description) return;
    onSubmit({
      type,
      amount: parseFloat(amount),
      currency: 'USD',
      category,
      description,
      date: new Date().toISOString().split('T')[0],
      tags: [],
      recurring: false,
    });
    setAmount('');
    setDescription('');
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Add Transaction" size="md">
      <div className="space-y-4">
        {/* Type selector */}
        <div className="flex gap-2">
          {(['income', 'expense', 'investment'] as TransactionType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-all ${
                type === t
                  ? t === 'income'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : t === 'expense'
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-nexus-border bg-nexus-card/40 text-nexus-muted hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <Input
          label="Amount"
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          prefixIcon={DollarSign}
        />

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring"
          >
            {Object.keys(categoryIcons).map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>

        <Input
          label="Description"
          placeholder="What was this for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!amount || !description}>
            Add Transaction
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Finance() {
  const {
    transactions: storeTxns,
    selectedPeriod,
    setTransactions,
    addTransaction,
    setSelectedPeriod,
    setCurrentPage,
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const transactions = storeTxns.length > 0 ? storeTxns : mockTransactions;

  useEffect(() => {
    setCurrentPage('/finance');
    financeApi.summary().catch(() => {});
  }, [setCurrentPage]);

  /* Stats */
  const stats = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const investments = transactions.filter((t) => t.type === 'investment').reduce((a, t) => a + t.amount, 0);
    return {
      balance: income - expenses - investments,
      income,
      expenses,
      savings: income - expenses,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [transactions, searchQuery]);

  const handleAddTransaction = useCallback(
    (data: Partial<Transaction>) => {
      const txn: Transaction = {
        id: crypto.randomUUID(),
        ...data,
      } as Transaction;
      addTransaction(txn);
    },
    [addTransaction],
  );

  const financialHealthScore = 72;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* ── Header ── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
            <Wallet size={24} className="text-emerald-400" />
            Finance
          </h1>
          <p className="text-sm text-nexus-muted mt-0.5">Track income, expenses, and savings goals</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-xs text-nexus-text focus-ring"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Transaction
          </Button>
        </div>
      </motion.div>

      {/* ── Balance Overview Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Balance', value: stats.balance, icon: Wallet, color: '#3B82F6', prefix: '$' },
          { label: 'Income', value: stats.income, icon: ArrowUpRight, color: '#10B981', prefix: '$' },
          { label: 'Expenses', value: stats.expenses, icon: ArrowDownRight, color: '#EF4444', prefix: '$' },
          { label: 'Savings', value: stats.savings, icon: PiggyBank, color: '#8B5CF6', prefix: '$' },
        ].map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card hoverable size="sm">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: `${s.color}20`, color: s.color }}
                >
                  <s.icon size={20} />
                </span>
                <div>
                  <p className="text-[11px] text-nexus-muted uppercase tracking-wider">{s.label}</p>
                  <p className="text-xl font-bold text-nexus-text">
                    <AnimatedNumber value={s.value} format="currency" />
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Bar */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-nexus-primary" />
                <span>Income vs Expenses</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1E1E2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Expense Breakdown Donut */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-nexus-secondary" />
                <span>Expense Breakdown</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1E1E2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`$${value}`, '']}
                />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span className="text-xs text-nexus-muted">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* ── Transactions + Budgets + Health Score ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction List */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card
            header={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-nexus-primary" />
                  <span>Recent Transactions</span>
                </div>
                <Input
                  variant="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40"
                />
              </div>
            }
          >
            <div className="space-y-1 max-h-[360px] overflow-y-auto scrollbar-thin">
              {filtered.map((txn, i) => {
                const cat = categoryIcons[txn.category] ?? { icon: Tag, color: '#6B7280' };
                const isIncome = txn.type === 'income';
                return (
                  <motion.div
                    key={txn.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/5 transition-colors"
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <cat.icon size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nexus-text truncate">{txn.description}</p>
                      <p className="text-[10px] text-nexus-muted capitalize">{txn.category} · {txn.date}</p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        isIncome ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isIncome ? '+' : '-'}${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Budget + Financial Health + Goals */}
        <motion.div variants={item} className="space-y-4">
          {/* Budget Progress */}
          <Card
            header={
              <div className="flex items-center gap-2">
                <Target size={16} className="text-nexus-accent" />
                <span>Budgets</span>
              </div>
            }
          >
            <div className="space-y-3">
              {mockBudgets.map((b) => {
                const pct = Math.round((b.spent / b.budget) * 100);
                const over = pct > 100;
                return (
                  <div key={b.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-nexus-text font-medium">{b.category}</span>
                      <span className={over ? 'text-red-400' : 'text-nexus-muted'}>
                        ${b.spent} / ${b.budget}
                      </span>
                    </div>
                    <Progress value={Math.min(pct, 100)} size="sm" />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Financial Health Score */}
          <Card variant="glow" size="sm">
            <div className="flex items-center gap-4">
              <CircularProgress value={financialHealthScore} size={64} strokeWidth={5} />
              <div>
                <p className="text-xs text-nexus-muted uppercase tracking-wider">Financial Health</p>
                <p className="text-lg font-bold text-nexus-text">{financialHealthScore}/100</p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                  <TrendingUp size={10} /> +4 from last month
                </p>
              </div>
            </div>
          </Card>

          {/* Savings Goals */}
          <Card
            header={
              <div className="flex items-center gap-2">
                <PiggyBank size={16} className="text-violet-400" />
                <span>Savings Goals</span>
              </div>
            }
          >
            <div className="space-y-3">
              {mockGoals.map((g) => {
                const pct = Math.round((g.current / g.target) * 100);
                return (
                  <div key={g.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-nexus-text font-medium">{g.name}</span>
                      <span className="text-nexus-muted">{pct}%</span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-nexus-border/50 overflow-hidden">
                      <motion.div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{ backgroundColor: g.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <p className="text-[10px] text-nexus-muted mt-0.5">
                      ${g.current.toLocaleString()} of ${g.target.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── AI Financial Recommendations ── */}
      <motion.div variants={item}>
        <Card
          variant="gradient"
          header={
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-nexus-accent" />
              <span>AI Financial Insights</span>
            </div>
          }
        >
          <div className="space-y-3">
            {[
              { text: 'Your shopping budget is 17% over limit. Consider reducing discretionary spending this week.', color: '#EF4444' },
              { text: 'You\'re on track to save $2,400 this month — 8% above your target. Great job!', color: '#10B981' },
              { text: 'Recurring expenses make up 68% of your spending. Review subscriptions for potential savings.', color: '#F59E0B' },
              { text: 'Your emergency fund is 57% funded. At this rate, you\'ll reach your goal by August 2026.', color: '#3B82F6' },
            ].map((tip, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 rounded-lg p-2 hover:bg-white/5 transition-colors"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: tip.color }}
                />
                <p className="text-sm text-nexus-text/90 leading-relaxed">{tip.text}</p>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* ── Modal ── */}
      <AddTransactionModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddTransaction}
      />
    </motion.div>
  );
}
