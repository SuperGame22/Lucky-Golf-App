/**
 * EARN Domain - Shopping-Focused + Rewards
 * Storefront first, rewards secondary
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShoppingBag,
  Search,
  Star,
  Tag,
  Sparkles,
  Trophy,
  Gift,
  Coins,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useState } from 'react';

const CATEGORIES = ['All', 'Clubs', 'Apparel', 'Accessories'];

const FEATURED_PRODUCTS = [
  { id: 'lgw01', name: 'V1 Gold Lucky Golf Wedge', price: 99.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/3_15.webp?v=1759072357', rating: 4.9, cloverReward: 25, badge: 'FEATURED', url: 'https://www.luckygolf.com/products/v1-gold-lucky-golf-wedge' },
  { id: 'lgw02', name: 'V2 Signature Gold Wedge', price: 109.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/3_15.webp?v=1759072357', rating: 4.9, cloverReward: 27, badge: 'NEW', url: 'https://www.luckygolf.com/products/v2-signature-gold-wedge-1' },
  { id: 'lgd01', name: 'Lucky Gold Driver', price: 299.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639&width=400', rating: 4.8, cloverReward: 75, badge: 'BEST SELLER', url: 'https://www.luckygolf.com/products/lucky-gold-driver-pre-order_' },
  { id: 'lgp01', name: 'Signature Gold Putter', price: 199.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/PhotoRoom_20230204_160908_7d44cf4e-171c-4270-b983-8ff4006f2ce1.png?v=1697769977&width=400', rating: 4.9, cloverReward: 50, badge: 'TOP RATED', url: 'https://www.luckygolf.com/products/signature-gold-putters' },
  { id: 'lgp02', name: 'Limited Edition Mallet Putter', price: 229.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/PhotoRoom_20230204_160908_7d44cf4e-171c-4270-b983-8ff4006f2ce1.png?v=1697769977&width=400', rating: 4.9, cloverReward: 57, url: 'https://www.luckygolf.com/products/limited-edition-mallet-putter' },
  { id: 'hybrid', name: 'Lucky Striker Hybrid', price: 189.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639&width=400', rating: 4.7, cloverReward: 47, badge: 'LIMITED', url: 'https://www.luckygolf.com/products/lucky-striker-hybrid-limited-edition' },
  { id: 'headcover', name: 'Driver Head Cover', price: 29.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639&width=400', rating: 4.6, cloverReward: 7, url: 'https://www.luckygolf.com/products/driver-head-cover' },
  { id: 'polo-azalea', name: 'Azalea Classic Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=400', rating: 5.0, cloverReward: 17, badge: 'NEW', url: 'https://www.luckygolf.com/products/azalea-classic-polo' },
  { id: 'polo-blackout', name: 'Blackout Blade Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=400', rating: 4.8, cloverReward: 17, url: 'https://www.luckygolf.com/products/blackout-blade-polo' },
  { id: 'polo-contour', name: 'Contour Classic Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=400', rating: 4.8, cloverReward: 17, url: 'https://www.luckygolf.com/products/contour-classic-polo' },
  { id: 'polo-frost', name: 'Frost Classic Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=400', rating: 4.8, cloverReward: 17, url: 'https://www.luckygolf.com/products/frost-classic-polo' },
  { id: 'glove', name: 'Lucky Clover Tour Glove', price: 17.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_000_20220517_095432.png?v=1654540304&width=400', rating: 4.6, cloverReward: 4, url: 'https://www.luckygolf.com/products/lucky-clover-tour-glove' },
  { id: 'hat', name: 'Green Lucky Hat', price: 24.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=400', rating: 4.7, cloverReward: 6, url: 'https://www.luckygolf.com/products/green-lucky-hat' },
  { id: 'grip1', name: 'Lucky Golf Oversized Putter Grip', price: 34.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=400', rating: 4.7, cloverReward: 9, url: 'https://www.luckygolf.com/products/lucky-golf-oversized-putter-grip' },
  { id: 'grip2', name: 'Clovers Oversized Putter Grip', price: 39.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=400', rating: 4.8, cloverReward: 10, url: 'https://www.luckygolf.com/products/lucky-golf-clovers-oversized-putter-grip' },
  { id: 'tees', name: 'Lucky Golf Tees', price: 9.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=400', rating: 4.5, cloverReward: 2, url: 'https://www.luckygolf.com/products/lucky-golf-tees' },
];

export default function EarnScreen() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const cloverBalance = profile?.clovers ?? 0;

  const filtered = FEATURED_PRODUCTS.filter((p) => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-display font-bold">Shop & Earn</h1>
            <p className="text-muted-foreground text-sm">Every $4 spent = 1 clover earned</p>
          </div>
          <Button variant="glass" size="icon" data-testid="cart-btn">
            <ShoppingBag className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Clover Credit Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <CloverIcon className="w-10 h-10" />
            <div>
              <p className="text-xs text-muted-foreground">Clover Credit</p>
              <p className="text-xl font-bold text-primary">${(cloverBalance * 0.25).toFixed(2)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{cloverBalance}</p>
            <p className="text-[10px] text-muted-foreground">clovers</p>
          </div>
        </motion.div>

        {/* Flash Sale Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-accent/20 to-primary/20 border border-accent/30 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-accent">2x Clover Weekend</span>
          </div>
          <p className="text-xs text-muted-foreground">Double clover rewards on all purchases through Sunday</p>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search gear..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="shop-search"
            className="w-full h-11 pl-11 pr-10 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              data-testid={`cat-${cat.toLowerCase()}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              data-testid={`product-${product.id}`}
              className="glass-card overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => window.open((product as any).url || 'https://www.luckygolf.com/collections/all', '_blank')}
            >
              <div className="relative aspect-square bg-white flex items-center justify-center overflow-hidden">
                <img src={product.image} alt={product.name} className="w-full h-full object-contain p-2" loading="lazy" />
                {product.badge && (
                  <span className={`absolute top-2 left-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    product.badge === 'FEATURED' ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/30' :
                    product.badge === 'BEST SELLER' ? 'bg-yellow-500 text-black' :
                    product.badge === 'TOP RATED' ? 'bg-primary text-primary-foreground' :
                    product.badge === 'NEW' ? 'bg-white text-black border border-border' :
                    product.badge === 'CLEARANCE' ? 'bg-red-500 text-white' :
                    'bg-accent text-accent-foreground'
                  }`}>
                    {product.badge}
                  </span>
                )}
              </div>
              <div className="p-3">
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  {product.category}
                </span>
                <h3 className="font-medium text-sm line-clamp-1 mt-1.5">{product.name}</h3>
                <div className="flex items-center gap-1 my-1">
                  <Star className="w-3 h-3 text-accent fill-accent" />
                  <span className="text-[10px] text-muted-foreground">{product.rating}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">${product.price.toFixed(2)}</p>
                  <div className="flex items-center gap-0.5 text-primary text-[10px] font-semibold">
                    <CloverIcon className="w-3 h-3" />
                    <span>+{product.cloverReward}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No products found</p>
          </div>
        )}

        {/* Rewards Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">Rewards & Games</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'spin', title: 'Lucky Spin', icon: Sparkles, path: '/earn/spin', color: 'from-purple-500/20 to-pink-500/20' },
              { id: 'gold', title: 'Gold Machine', icon: Trophy, path: '/earn/gold-machine', color: 'from-yellow-500/20 to-orange-500/20' },
              { id: 'raffle', title: 'Raffle', icon: Gift, path: '/earn/raffle', color: 'from-blue-500/20 to-cyan-500/20' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  data-testid={`reward-${item.id}`}
                  className={`glass-card p-3 bg-gradient-to-br ${item.color} flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-all`}
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="w-6 h-6 text-primary" />
                  <span className="text-[10px] font-semibold text-center">{item.title}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Buy Clovers CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Coins className="w-8 h-8 text-primary" />
            <div>
              <p className="font-semibold text-sm">Need more clovers?</p>
              <p className="text-xs text-muted-foreground">Buy packs starting at $4.99</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate('/earn/packs')}>
            Buy <ArrowRight className="w-3 h-3" />
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
