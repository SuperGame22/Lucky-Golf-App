/**
 * EARN — Lucky Golf Shop + Rewards
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, ExternalLink, Sparkles, Trophy, Gift, Coins, ArrowRight } from 'lucide-react';
import { useState } from 'react';

const CATEGORIES = ['All', 'Clubs', 'Apparel', 'Accessories'];

const PRODUCTS = [
  { id: 'lgw01', name: 'V1 Gold Lucky Golf Wedge', price: 99.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/3_15.webp?v=1759072357', cloverReward: 25, badge: 'FEATURED', url: 'https://www.luckygolf.com/products/v1-gold-lucky-golf-wedge' },
  { id: 'lgw02', name: 'V2 Signature Gold Wedge', price: 109.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/Photoroom_20250106_180935.png?v=1741366122', cloverReward: 27, badge: 'NEW', url: 'https://www.luckygolf.com/products/v2-signature-gold-wedge-1' },
  { id: 'lgd01', name: 'Lucky Gold Driver', price: 299.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639', cloverReward: 75, badge: 'BEST SELLER', url: 'https://www.luckygolf.com/products/lucky-gold-driver-pre-order_' },
  { id: 'lgp01', name: 'Signature Gold Putter', price: 199.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/PhotoRoom_20230204_160908_7d44cf4e-171c-4270-b983-8ff4006f2ce1.png?v=1697769977&width=400', cloverReward: 50, badge: 'TOP RATED', url: 'https://www.luckygolf.com/products/signature-gold-putters' },
  { id: 'lgp02', name: 'Limited Edition Mallet Putter', price: 229.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9951-Photoroom.png?v=1707080292', cloverReward: 57, url: 'https://www.luckygolf.com/products/limited-edition-mallet-putter' },
  { id: 'hybrid', name: 'Lucky Striker Hybrid', price: 189.00, category: 'Clubs', image: 'https://www.luckygolf.com/cdn/shop/files/LuckyStrikerHybridBottom_CB.png?v=1733265396', cloverReward: 47, badge: 'LIMITED', url: 'https://www.luckygolf.com/products/lucky-striker-hybrid-limited-edition' },
  { id: 'polo-azalea', name: 'Azalea Classic Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=400', cloverReward: 17, badge: 'NEW', url: 'https://www.luckygolf.com/products/azalea-classic-polo' },
  { id: 'polo-blackout', name: 'Blackout Blade Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/StrokePlay1.webp?v=1779472570', cloverReward: 17, url: 'https://www.luckygolf.com/products/blackout-blade-polo' },
  { id: 'polo-contour', name: 'Contour Classic Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/TopographyStyle1.webp?v=1779472755', cloverReward: 17, url: 'https://www.luckygolf.com/products/contour-classic-polo' },
  { id: 'polo-frost', name: 'Frost Classic Polo', price: 67.00, category: 'Apparel', image: 'https://www.luckygolf.com/cdn/shop/files/Whitecome1.webp?v=1779472662', cloverReward: 17, url: 'https://www.luckygolf.com/products/frost-classic-polo' },
  { id: 'glove', name: 'Lucky Clover Tour Glove', price: 17.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_000_20220517_095432.png?v=1654540304&width=400', cloverReward: 4, url: 'https://www.luckygolf.com/products/lucky-clover-tour-glove' },
  { id: 'hat', name: 'Green Lucky Hat', price: 24.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=400', cloverReward: 6, url: 'https://www.luckygolf.com/products/green-lucky-hat' },
  { id: 'grip1', name: 'Lucky Golf Oversized Putter Grip', price: 34.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/Green_Oversized_Grip_Lucky_Golf-Photoroom.png?v=1724359296', cloverReward: 9, url: 'https://www.luckygolf.com/products/lucky-golf-oversized-putter-grip' },
  { id: 'grip2', name: 'Clovers Oversized Putter Grip', price: 39.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/Clovers_Oversized_Grip_Lucky_Golf-Photoroom.png?v=1724359224', cloverReward: 10, url: 'https://www.luckygolf.com/products/lucky-golf-clovers-oversized-putter-grip' },
  { id: 'headcover', name: 'Driver Head Cover', price: 29.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/products/DriverHeadCover1.png?v=1676592799', cloverReward: 7, url: 'https://www.luckygolf.com/products/driver-head-cover' },
  { id: 'tees', name: 'Lucky Golf Tees', price: 9.95, category: 'Accessories', image: 'https://www.luckygolf.com/cdn/shop/files/FFF_LUCKYGOLF_LO_02_SocialMedia.png?v=1724448051', cloverReward: 2, url: 'https://www.luckygolf.com/products/lucky-golf-tees' },
];

export default function EarnScreen() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const filtered = activeCategory === 'All' ? PRODUCTS : PRODUCTS.filter(p => p.category === activeCategory);

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
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:border-primary/50'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card overflow-hidden cursor-pointer group"
              onClick={() => window.open(p.url, '_blank')}>
              <div className="aspect-square bg-muted relative overflow-hidden">
                <img src={p.image} alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                {p.badge && (
                  <span className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded bg-primary text-primary-foreground uppercase tracking-widest">
                    {p.badge}
                  </span>
                )}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
                  <CloverIcon className="w-3 h-3 text-primary" />
                  <span className="text-[9px] font-bold text-primary">+{p.cloverReward}</span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-bold line-clamp-2 leading-tight mb-1">{p.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-primary">${p.price.toFixed(2)}</p>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
