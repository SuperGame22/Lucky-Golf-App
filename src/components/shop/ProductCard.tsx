import { motion } from 'framer-motion';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { ExternalLink, Circle } from 'lucide-react';
import { ProductCategory } from '@/data/shopCategories';

export function ProductCard({ product, index }: { product: ProductCategory; index: number }) {
  return (
    <motion.a href={product.url} target="_blank" rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="glass-card overflow-hidden hover:border-primary/50 transition-all active:scale-95 block relative">
      {product.badge && (
        <div className="absolute top-2 left-2 z-10">
          <span className="text-[9px] font-black uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{product.badge}</span>
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
  );
}
