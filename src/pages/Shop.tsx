/**
 * EARN / SHOP — Lucky Golf Storefront
 * Products scraped from luckygolf.com
 * High-contrast golf pro aesthetic
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import {
  ShoppingBag,
  Search,
  Star,
  ExternalLink,
  Filter,
  ArrowLeft,
  Tag,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string;
  product_url: string;
  reviews: number;
  rating: number;
  badge?: string;
  description: string;
  clover_reward: number;
}

const PRODUCTS: Product[] = [
  // ── FEATURED: V1 GOLD WEDGE ──
  {
    id: 'lgw01-gold',
    name: 'V1 Gold Lucky Golf Wedge (LGW01)',
    price: 99.00,
    category: 'Clubs',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/3_15.webp?v=1759072357',
    product_url: 'https://www.luckygolf.com/products/v1-gold-lucky-golf-wedge?variant=48740663951637',
    reviews: 539,
    rating: 4.9,
    badge: 'FEATURED',
    description: '50\u00B0\u201360\u00B0 lofts \u00B7 Triple forged 1020 carbon steel \u00B7 CNC-milled grooves \u00B7 Crisp gold finish. Buttery feel, maximum spin.',
    clover_reward: 25,
  },
  // ── CLUBS ──
  {
    id: 'lgd01',
    name: 'Lucky Golf LGD01 Driver',
    price: 299.00,
    category: 'Clubs',
    image_url: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639&width=533',
    product_url: 'https://www.luckygolf.com/products/lucky-gold-driver-pre-order_',
    reviews: 39,
    rating: 4.8,
    badge: 'BEST SELLER',
    description: 'Modern design. Confident at address. Engineered for distance and forgiveness.',
    clover_reward: 75,
  },
  {
    id: 'lgh01',
    name: 'Lucky Golf LGH01 Hybrid',
    price: 209.00,
    category: 'Clubs',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/LuckyStrikerHybridBottom_CB.png?v=1733265396&width=533',
    product_url: 'https://www.luckygolf.com/products/lucky-striker-hybrid-limited-edition',
    reviews: 19,
    rating: 4.7,
    description: 'The long iron you skull twice a round? This replaces it.',
    clover_reward: 52,
  },
  {
    id: 'lgp01',
    name: 'Lucky Golf LGP01 Gold Putter',
    price: 199.00,
    category: 'Clubs',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/PhotoRoom_20230204_160908_7d44cf4e-171c-4270-b983-8ff4006f2ce1.png?v=1697769977&width=533',
    product_url: 'https://www.luckygolf.com/products/signature-gold-putters',
    reviews: 145,
    rating: 4.9,
    badge: 'TOP RATED',
    description: 'Clean lines. Milled face. True roll. Every time.',
    clover_reward: 50,
  },
  {
    id: 'lgp02-gold',
    name: 'LGP02 Gold Mallet Putter (Limited Edition)',
    price: 229.00,
    category: 'Clubs',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/3M6A9964-Photoroom.png?v=1707080291',
    product_url: 'https://www.luckygolf.com/products/limited-edition-mallet-putter',
    reviews: 57,
    rating: 4.8,
    badge: 'LIMITED',
    description: '100% CNC milled mallet \u00B7 Pure roll face \u00B7 Ultra stable feel \u00B7 3.5\u00B0 loft \u00B7 385g \u00B7 Oversized 3.0 gold grip.',
    clover_reward: 57,
  },
  // ── APPAREL ──
  {
    id: 'polo-azalea',
    name: 'Azalea Classic Polo',
    price: 67.00,
    category: 'Apparel',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=533',
    product_url: 'https://www.luckygolf.com/products/azalea-classic-polo',
    reviews: 0,
    rating: 5.0,
    badge: 'NEW',
    description: 'Performance polo with floral pattern. Sizes S–3XL.',
    clover_reward: 17,
  },
  {
    id: 'polo-gold-dust',
    name: 'Gold Dust Classic Polo',
    price: 67.00,
    category: 'Apparel',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/PaintSplatter1.webp?v=1779472856&width=533',
    product_url: 'https://www.luckygolf.com/products/gold-dust-classic-polo',
    reviews: 0,
    rating: 5.0,
    badge: 'NEW',
    description: 'Bold paint-splatter design. Sizes S–3XL.',
    clover_reward: 17,
  },
  {
    id: 'polo-shadow',
    name: 'Shadow Classic Polo',
    price: 67.00,
    category: 'Apparel',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/Graycamofour-leafclover1.webp?v=1779472823&width=533',
    product_url: 'https://www.luckygolf.com/products/shadow-classic-polo',
    reviews: 0,
    rating: 5.0,
    badge: 'NEW',
    description: 'Gray camo four-leaf clover design. Sizes S–3XL.',
    clover_reward: 17,
  },
  {
    id: 'polo-signature-black',
    name: 'Signature Black Classic Polo',
    price: 67.00,
    category: 'Apparel',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/Classicpolowithlogointhecollar1.webp?v=1779472786&width=533',
    product_url: 'https://www.luckygolf.com/products/signature-black-classic-polo',
    reviews: 0,
    rating: 5.0,
    badge: 'NEW',
    description: 'Clean black with collar logo. Sizes S–3XL.',
    clover_reward: 17,
  },
  {
    id: 'polo-contour',
    name: 'Contour Classic Polo',
    price: 67.00,
    category: 'Apparel',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/TopographyStyle1.webp?v=1779472755&width=533',
    product_url: 'https://www.luckygolf.com/products/contour-classic-polo',
    reviews: 0,
    rating: 5.0,
    badge: 'NEW',
    description: 'Topography-inspired pattern. Sizes S–3XL.',
    clover_reward: 17,
  },
  {
    id: 'polo-blackout-blade',
    name: 'Blackout Blade Polo',
    price: 67.00,
    category: 'Apparel',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/StrokePlay1.webp?v=1779472570&width=533',
    product_url: 'https://www.luckygolf.com/products/blackout-blade-polo',
    reviews: 0,
    rating: 5.0,
    badge: 'NEW',
    description: 'Stroke-play inspired blackout design. Sizes S–3XL.',
    clover_reward: 17,
  },
  // ── ACCESSORIES ──
  {
    id: 'glove-tour',
    name: 'Classic Tour Glove',
    price: 17.95,
    category: 'Accessories',
    image_url: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_000_20220517_095432.png?v=1654540304&width=533',
    product_url: 'https://www.luckygolf.com/products/lucky-clover-tour-glove',
    reviews: 50,
    rating: 4.6,
    badge: 'CLEARANCE',
    description: 'Premium cabretta leather. Tour-grade grip and feel.',
    clover_reward: 4,
  },
  {
    id: 'hat-lucky',
    name: 'Green "LUCKY" Hat',
    price: 24.95,
    category: 'Accessories',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=533',
    product_url: 'https://www.luckygolf.com/products/green-lucky-hat',
    reviews: 27,
    rating: 4.7,
    description: 'Structured green cap with LUCKY embroidery.',
    clover_reward: 6,
  },
  {
    id: 'grip-clovers',
    name: 'Clovers Oversized Putter Grip',
    price: 19.95,
    category: 'Accessories',
    image_url: 'https://www.luckygolf.com/cdn/shop/files/Clovers_Oversized_Grip_Lucky_Golf-Photoroom.png?v=1724359224&width=533',
    product_url: 'https://www.luckygolf.com/products/lucky-golf-clovers-oversized-putter-grip',
    reviews: 12,
    rating: 4.5,
    description: 'Oversized putter grip with clover pattern for better feel.',
    clover_reward: 5,
  },
  {
    id: 'headcover-driver',
    name: 'Driver Head Cover',
    price: 40.00,
    category: 'Accessories',
    image_url: 'https://www.luckygolf.com/cdn/shop/products/DriverHeadCover1.png?v=1676592799&width=533',
    product_url: 'https://www.luckygolf.com/products/driver-head-cover',
    reviews: 7,
    rating: 4.8,
    description: 'Premium leather driver headcover with Lucky Golf branding.',
    clover_reward: 10,
  },
];

const CATEGORIES = ['All', 'Clubs', 'Apparel', 'Accessories'];

export default function ShopPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = PRODUCTS.filter(p => {
    const matchCat = category === 'All' || p.category === category;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/earn')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase tracking-wider" data-testid="shop-title">Lucky Golf Shop</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Official gear · Earn clovers</p>
          </div>
          <Button variant="glass" size="icon" data-testid="shop-cart-btn">
            <ShoppingBag className="w-5 h-5" />
          </Button>
        </div>

        {/* Promo Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/30 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Earn As You Shop</span>
          </div>
          <p className="text-xs text-muted-foreground">Every $4 spent = 1 clover earned. Powered by luckygolf.com</p>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search gear..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="shop-search-input"
            className="w-full h-11 pl-11 pr-4 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              data-testid={`shop-cat-${cat.toLowerCase()}`}
              className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                category === cat
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Count */}
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Products */}
        <div className="space-y-4">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              data-testid={`shop-product-${product.id}`}
              className="glass-card overflow-hidden group"
            >
              <div className="flex gap-4 p-4">
                {/* Image */}
                <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-white flex-shrink-0">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                  {product.badge && (
                    <span className={`absolute top-1.5 left-1.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      product.badge === 'FEATURED' ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/30' :
                      product.badge === 'LIMITED' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-lg shadow-purple-500/30' :
                      product.badge === 'BEST SELLER' ? 'bg-yellow-500 text-black' :
                      product.badge === 'TOP RATED' ? 'bg-primary text-primary-foreground' :
                      product.badge === 'NEW' ? 'bg-white text-black' :
                      product.badge === 'CLEARANCE' ? 'bg-red-500 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">{product.category}</span>
                    <h3 className="font-bold text-sm leading-tight mt-0.5 line-clamp-2">{product.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {product.reviews > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-[10px] font-bold">{product.rating}</span>
                        <span className="text-[10px] text-muted-foreground">({product.reviews})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                <div>
                  <span className="text-xl font-black">${product.price.toFixed(2)}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CloverIcon className="w-3 h-3" />
                    <span className="text-[10px] font-bold text-primary">+{product.clover_reward} clovers</span>
                  </div>
                </div>
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`view-on-site-${product.id}`}
                >
                  <Button size="sm" className="font-black uppercase tracking-wider text-xs gap-1.5">
                    View on Site <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No products found</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-2">
          <a href="https://www.luckygolf.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors">
            Powered by luckygolf.com
          </a>
        </div>
      </div>
    </AppLayout>
  );
}
