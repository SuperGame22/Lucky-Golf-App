/**
 * EARN — Lucky Golf Shop + Rewards
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Trophy, Gift } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, FILTERS } from '@/data/shopCategories';
import { ProductCard } from '@/components/shop/ProductCard';

export default function EarnScreen() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const filtered = activeCategory === 'All' ? CATEGORIES : CATEGORIES.filter(p => p.category === activeCategory);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-black uppercase tracking-wider">Shop & Earn</h1>
          <p className="text-sm text-muted-foreground">Buy gear, earn clovers</p>
        </motion.div>

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Lucky Spin', icon: Sparkles, path: '/earn/spin' },
            { label: 'Raffle', icon: Trophy, path: '/earn/raffle' },
            { label: 'Clover Packs', icon: Gift, path: '/earn/packs' },
          ].map(item => (
            <motion.div key={item.path} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(item.path)}>
              <item.icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xs font-bold">{item.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:border-primary/50'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid — same catalog/cards as the Shop page (/earn/shop) */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
