import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { Search, ExternalLink, Tag, Circle } from 'lucide-react';

const BASE = 'https://www.luckygolf.com';
const CDN = 'https://cdn.shopify.com/s/files/1/2286/3149';

interface ProductCategory {
  id: string;
  name: string;
  category: 'Clubs' | 'Apparel' | 'Accessories' | 'Gift Cards';
  /** How many distinct colorways/models this category collapses into one card. */
  variantCount: number;
  variantLabel: string; // e.g. "Designs", "Models"
  priceFrom: number;
  image: string | null;
  cloverReward: number;
  badge?: string;
  url: string;
}

// Pulled from luckygolf.com's live catalog (collection + product counts) —
// one card per category; specific colorways/lofts/sizes are picked at
// checkout on luckygolf.com rather than listed individually here.
const CATEGORIES: ProductCategory[] = [
  // Clubs
  { id: 'wedges', name: 'Wedges', category: 'Clubs', variantCount: 3, variantLabel: 'Designs', priceFrom: 99, image: '/products/wedges.png', cloverReward: 25, badge: 'FEATURED', url: `${BASE}/products/v1-gold-lucky-golf-wedge` },
  { id: 'putters', name: 'Putters', category: 'Clubs', variantCount: 2, variantLabel: 'Designs', priceFrom: 199, image: '/products/putters.png', cloverReward: 50, badge: 'TOP RATED', url: `${BASE}/products/signature-gold-putters` },
  { id: 'drivers', name: 'Drivers', category: 'Clubs', variantCount: 1, variantLabel: 'Design', priceFrom: 299, image: '/products/drivers.png', cloverReward: 75, badge: 'PRE-ORDER', url: `${BASE}/products/lucky-gold-driver-pre-order_` },
  { id: 'hybrids', name: 'Hybrids', category: 'Clubs', variantCount: 1, variantLabel: 'Design', priceFrom: 209, image: '/products/hybrids.png', cloverReward: 52, badge: 'LIMITED', url: `${BASE}/products/lucky-striker-hybrid-limited-edition` },
  // Apparel
  { id: 'classic-polos', name: 'Classic Polos', category: 'Apparel', variantCount: 10, variantLabel: 'Designs', priceFrom: 67, image: '/products/classic-polos.png', cloverReward: 17, badge: 'NEW', url: `${BASE}/collections/classic-polos` },
  { id: 'blade-polos', name: 'Blade Polos', category: 'Apparel', variantCount: 3, variantLabel: 'Designs', priceFrom: 67, image: '/products/blade-polos.png', cloverReward: 17, url: `${BASE}/collections/blade-polos` },
  { id: 'hats', name: 'Hats', category: 'Apparel', variantCount: 10, variantLabel: 'Designs', priceFrom: 29, image: '/products/hats.png', cloverReward: 7, url: `${BASE}/collections/hats` },
  // Accessories
  { id: 'gloves', name: 'Gloves', category: 'Accessories', variantCount: 1, variantLabel: 'Design', priceFrom: 17.95, image: '/products/gloves.png', cloverReward: 4, url: `${BASE}/products/lucky-clover-tour-glove` },
  { id: 'head-covers', name: 'Head Covers', category: 'Accessories', variantCount: 3, variantLabel: 'Designs', priceFrom: 29.95, image: '/products/head-covers.png', cloverReward: 7, url: `${BASE}/collections/head-covers` },
  { id: 'tees', name: 'Tees', category: 'Accessories', variantCount: 1, variantLabel: 'Design', priceFrom: 9.95, image: null, cloverReward: 2, url: `${BASE}/products/lucky-golf-tees` },
  { id: 'club-grips', name: 'Club Grips', category: 'Accessories', variantCount: 5, variantLabel: 'Designs', priceFrom: 9.95, image: '/products/club-grips.png', cloverReward: 2, url: `${BASE}/collections/performance-x2` },
  { id: 'putter-grips', name: 'Putter Grips', category: 'Accessories', variantCount: 3, variantLabel: 'Designs', priceFrom: 19.95, image: '/products/putter-grips.png', cloverReward: 5, url: `${BASE}/collections/putter-grips` },
  // Gift Cards
  { id: 'gift-cards', name: 'Gift Cards', category: 'Gift Cards', variantCount: 0, variantLabel: 'Any Amount', priceFrom: 10, image: '/products/gift-cards.png', cloverReward: 2, url: `${BASE}/products/lucky-wedges-gift-card` },
];

const FILTERS = ['All', 'Clubs', 'Apparel', 'Accessories', 'Gift Cards'];

export default function Shop() {
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const clovers = profile?.clovers ?? 0;

  const filtered = CATEGORIES.filter(p => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Shop</h1>
            <p className="text-sm text-muted-foreground">Gear up. Earn clovers.</p>
          </div>
          <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
            <CloverIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{clovers}</span>
          </div>
        </div>

        <div className="glass-card p-3 flex items-center gap-3 bg-primary/5 border-primary/20">
          <CloverIcon className="w-6 h-6 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">Every <span className="text-primary font-bold">$4 spent</span> earns <span className="text-primary font-bold">1 clover</span></p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gear..."
            className="w-full h-11 pl-10 pr-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}>{cat}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product, i) => (
            <motion.a key={product.id} href={product.url} target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass-card overflow-hidden hover:border-primary/50 transition-all active:scale-95 block relative">
              {product.badge && (
                <div className="absolute top-2 left-2 z-10">
                  <span className="text-[9px] font-black uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{product.badge}</span>
                </div>
              )}
              {/* Military-green swatch behind every product image — keeps the
                  grid visually consistent instead of the product photos'
                  own white studio backgrounds showing through. */}
              <div className="relative bg-military-green aspect-square overflow-hidden">
                {product.image ? (
                  // Real cut-out PNGs (transparent background) — sit directly
                  // on the military-green swatch, no white card needed.
                  <img src={product.image} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-4" loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Circle className="w-10 h-10 text-primary/40" />
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-50">
                  <ExternalLink className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold leading-tight mb-0.5">{product.name}</p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  {product.category === 'Gift Cards' ? product.variantLabel : `${product.variantCount} ${product.variantLabel}`}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">
                    {product.category === 'Clubs' || product.category === 'Accessories' || product.category === 'Gift Cards' ? 'From ' : ''}
                    ${product.priceFrom.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded-full">
                    <CloverIcon className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary">+{product.cloverReward}</span>
                  </div>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        <a href="https://www.luckygolf.com/collections/all" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-primary/30 text-primary text-sm font-bold hover:bg-primary/5 transition-colors">
          <Tag className="w-4 h-4" />
          View All on LuckyGolf.com
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </AppLayout>
  );
}
