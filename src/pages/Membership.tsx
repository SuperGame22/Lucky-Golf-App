import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { Check, Crown, Sparkles, Zap } from "lucide-react";

const tiers = [
  {
    name: "Free",
    price: 0,
    period: "",
    description: "Get started with core features",
    features: [
      "GPS Rangefinder",
      "Digital Scorecard",
      "Basic AR Clover Hunting",
      "1 clover per $4 spent",
    ],
    cta: "Current Plan",
    popular: false,
    icon: CloverIcon,
    gradient: "from-muted to-muted/50",
  },
  {
    name: "Clover Club",
    price: 7,
    period: "/mo",
    description: "For the dedicated golfer",
    features: [
      "Everything in Free",
      "2x Clover Multiplier",
      "Priority Lucky Tees access",
      "Exclusive member discounts",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
    icon: Sparkles,
    gradient: "from-primary to-lucky-emerald",
  },
  {
    name: "Gold Club",
    price: 20,
    period: "/mo",
    description: "Maximum rewards & perks",
    features: [
      "Everything in Clover Club",
      "3x Clover Multiplier",
      "Premium AR features",
      "Gold Machine upgrades",
      "VIP event access",
      "Personal concierge",
    ],
    cta: "Go Gold",
    popular: false,
    icon: Crown,
    gradient: "from-accent to-amber-600",
  },
];

const Membership = () => {
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-display font-bold mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground">Unlock more rewards and exclusive perks</p>
        </motion.div>

        <div className="space-y-4">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative overflow-hidden rounded-2xl ${
                  tier.popular
                    ? "bg-gradient-to-r from-primary to-lucky-emerald p-[2px]"
                    : ""
                }`}
              >
                {tier.popular && (
                  <div className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded-full z-10">
                    Most Popular
                  </div>
                )}
                <div
                  className={`glass-card p-6 h-full ${
                    tier.popular ? "border-0" : ""
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center`}
                    >
                      <Icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-display font-bold">{tier.name}</h3>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-4xl font-display font-bold">
                      ${tier.price}
                    </span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={tier.popular ? "gold" : tier.price === 0 ? "outline" : "lucky"}
                    className="w-full"
                    disabled={tier.price === 0}
                  >
                    {tier.price === 0 && <Check className="w-4 h-4" />}
                    {tier.cta}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-muted/50 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="font-display font-semibold">Multiplier Comparison</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-card rounded-xl">
              <p className="text-2xl font-bold">1x</p>
              <p className="text-xs text-muted-foreground">Free</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/30">
              <p className="text-2xl font-bold text-primary">2x</p>
              <p className="text-xs text-primary">Clover</p>
            </div>
            <div className="p-3 bg-accent/10 rounded-xl border border-accent/30">
              <p className="text-2xl font-bold text-accent">3x</p>
              <p className="text-xs text-accent">Gold</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Membership;
