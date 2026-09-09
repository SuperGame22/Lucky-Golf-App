import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { Search, ExternalLink, Tag } from 'lucide-react';
import { CATEGORIES, FILTERS } from '@/data/shopCategories';
import { ProductCard } from '@/components/shop/ProductCard';

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
            <ProductCard key={product.id} product={product} index={i} />
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
