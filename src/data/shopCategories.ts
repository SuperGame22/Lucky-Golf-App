export const BASE = 'https://www.luckygolf.com';
const CDN = 'https://cdn.shopify.com/s/files/1/2286/3149';

export interface ProductCategory {
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

// Single source of truth for the shop catalog — used by both the Shop page
// (/earn/shop) and the Earn hub (/earn) so they never drift apart again.
// One card per category; specific colorways/lofts/sizes are picked at
// checkout on luckygolf.com rather than listed individually here.
export const CATEGORIES: ProductCategory[] = [
  // Clubs
  { id: 'wedges', name: 'Signature Gold Wedge', category: 'Clubs', variantCount: 2, variantLabel: 'Designs', priceFrom: 99, image: '/products/wedges.png', cloverReward: 25, badge: 'FEATURED', url: `${BASE}/products/lucky-golf-lgw02-gold` },
  { id: 'putters', name: 'Putters', category: 'Clubs', variantCount: 2, variantLabel: 'Designs', priceFrom: 199, image: '/products/putters.png', cloverReward: 50, badge: 'TOP RATED', url: `${BASE}/products/signature-gold-putters` },
  { id: 'drivers', name: 'Drivers', category: 'Clubs', variantCount: 1, variantLabel: 'Design', priceFrom: 299, image: '/products/drivers.png', cloverReward: 75, badge: 'PRE-ORDER', url: `${BASE}/products/lucky-gold-driver-pre-order_` },
  { id: 'hybrids', name: 'Hybrids', category: 'Clubs', variantCount: 1, variantLabel: 'Design', priceFrom: 209, image: '/products/hybrids.png', cloverReward: 52, badge: 'LIMITED', url: `${BASE}/products/lucky-striker-hybrid-limited-edition` },
  // Apparel
  { id: 'classic-polos', name: 'Classic Collar Polos', category: 'Apparel', variantCount: 10, variantLabel: 'Designs', priceFrom: 67, image: '/products/classic-polos.png', cloverReward: 17, badge: 'NEW', url: `${BASE}/collections/classic-polos` },
  { id: 'blade-polos', name: 'Blade Collar Polos', category: 'Apparel', variantCount: 3, variantLabel: 'Designs', priceFrom: 67, image: '/products/blade-polos.png', cloverReward: 17, url: `${BASE}/collections/blade-polos` },
  { id: 'hats', name: 'Hats', category: 'Apparel', variantCount: 10, variantLabel: 'Designs', priceFrom: 29, image: '/products/hats.png', cloverReward: 7, url: `${BASE}/collections/hats` },
  // Accessories
  { id: 'gloves', name: 'Gloves', category: 'Accessories', variantCount: 1, variantLabel: 'Design', priceFrom: 17.95, image: '/products/gloves.png', cloverReward: 4, url: `${BASE}/products/lucky-clover-tour-glove` },
  { id: 'head-covers', name: 'Head Covers', category: 'Accessories', variantCount: 3, variantLabel: 'Designs', priceFrom: 29.95, image: '/products/head-covers.png', cloverReward: 7, url: `${BASE}/collections/head-covers` },
  { id: 'tees', name: 'Tees', category: 'Accessories', variantCount: 1, variantLabel: 'Design', priceFrom: 9.95, image: '/products/tees.png', cloverReward: 2, url: `${BASE}/products/lucky-golf-tees` },
  { id: 'club-grips', name: 'Club Grips', category: 'Accessories', variantCount: 5, variantLabel: 'Designs', priceFrom: 9.95, image: '/products/club-grips.png', cloverReward: 2, url: `${BASE}/collections/performance-x2` },
  { id: 'putter-grips', name: 'Putter Grips', category: 'Accessories', variantCount: 3, variantLabel: 'Designs', priceFrom: 19.95, image: '/products/putter-grips.png', cloverReward: 5, url: `${BASE}/collections/putter-grips` },
  // Gift Cards
  { id: 'gift-cards', name: 'Gift Cards', category: 'Gift Cards', variantCount: 0, variantLabel: 'Any Amount', priceFrom: 10, image: '/products/gift-cards.png', cloverReward: 2, url: `${BASE}/products/lucky-wedges-gift-card` },
];

export const FILTERS = ['All', 'Clubs', 'Apparel', 'Accessories', 'Gift Cards'];
