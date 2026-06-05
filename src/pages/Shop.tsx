import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { Search, ExternalLink, Tag } from 'lucide-react';

const BASE = 'https://www.luckygolf.com/products';

const PRODUCTS = [
  { id: 'wedge', name: 'V1 Gold Lucky Golf Wedge', price: 99.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/3_15.webp?v=1759072357', cloverReward: 25, badge: 'FEATURED', url: `${BASE}/v1-gold-lucky-golf-wedge` },
  { id: 'driver', name: 'Lucky Gold Driver', price: 299.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639&width=300', cloverReward: 75, badge: 'NEW', url: `${BASE}/lucky-gold-driver-pre-order_` },
  { id: 'putter', name: 'Signature Gold Putter', price: 199.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/PhotoRoom_20230204_160908_7d44cf4e-171c-4270-b983-8ff4006f2ce1.png?v=1697769977&width=300', cloverReward: 50, badge: 'TOP RATED', url: `${BASE}/signature-gold-putters` },
  { id: 'mallet', name: 'Limited Edition Mallet Putter', price: 229.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/PhotoRoom_20230204_160908_7d44cf4e-171c-4270-b983-8ff4006f2ce1.png?v=1697769977&width=300', cloverReward: 57, url: `${BASE}/limited-edition-mallet-putter` },
  { id: 'hybrid', name: 'Lucky Striker Hybrid', price: 189.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639&width=300', cloverReward: 47, badge: 'LIMITED', url: `${BASE}/lucky-striker-hybrid-limited-edition` },
  { id: 'polo-azalea', name: 'Azalea Classic Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=300', cloverReward: 17, badge: 'NEW', url: `${BASE}/azalea-classic-polo` },
  { id: 'polo-blackout', name: 'Blackout Blade Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=300', cloverReward: 17, url: `${BASE}/blackout-blade-polo` },
  { id: 'glove', name: 'Lucky Clover Tour Glove', price: 17.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_000_20220517_095432.png?v=1654540304&width=300', cloverReward: 4, url: `${BASE}/lucky-clover-tour-glove` },
  { id: 'hat', name: 'Green Lucky Hat', price: 24.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=300', cloverReward: 6, url: `${BASE}/green-lucky-hat` },
  { id: 'grip', name: 'Oversized Putter Grip', price: 34.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=300', cloverReward: 9, url: `${BASE}/lucky-golf-oversized-putter-grip` },
  { id: 'tees', name: 'Lucky Golf Tees', price: 9.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=300', cloverReward: 2, url: `${BASE}/lucky-golf-tees` },
];

const CATEGORIES = ['All', 'Clubs', 'Apparel', 'Accessories'];

export default function Shop() {
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const clovers = profile?.clovers ?? 0;

  const filtered = PRODUCTS.filter(p => {
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
          {CATEGORIES.map(cat => (
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
              <div className="relative bg-muted/30 aspect-square overflow-hidden">
                <img src={product.image} alt={product.name} className="w-full h-full object-contain p-3" loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                <div className="absolute top-2 right-2 opacity-50">
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold leading-tight mb-1 line-clamp-2">{product.name}</p>
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">${product.price.toFixed(2)}</span>
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
