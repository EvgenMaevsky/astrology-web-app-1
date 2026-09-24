/**
 * Turns the plan catalogue into the cards a pricing page shows: Free, and
 * each paid plan once per billing interval it is sold in (Pro monthly,
 * Pro yearly).
 *
 * The discount is computed from the prices, never written into copy, so a
 * price change in the catalogue cannot leave a stale "a month free" behind.
 * Pure on purpose — see offers.test.ts.
 */

export type Interval = "month" | "year";

/** The subset of the API's plan object this needs. */
export interface CatalogPlan {
  id: string;
  name: string;
  price_usd: number;
  price_uah: number;
  price_usd_yearly?: number;
  price_uah_yearly?: number;
  stripe_yearly_available?: boolean;
  features: string[];
}

export interface Offer {
  /** Unique per card: "free", "pro-month", "pro-year". */
  key: string;
  planId: string;
  name: string;
  interval: Interval;
  priceUsd: number;
  priceUah: number;
  features: string[];
  /** Whether card payment (Stripe) can be offered for this card. */
  stripeAvailable: boolean;
  /** Yearly only: the effective monthly price, rounded to cents. */
  perMonthUsd?: number;
  /** Yearly only: what a year of monthly payments would cost more. */
  savingUsd?: number;
  /** Yearly only: whole months the saving buys; 0 if under one month. */
  freeMonths?: number;
}

export function buildOffers(plans: CatalogPlan[]): Offer[] {
  const offers: Offer[] = [];
  for (const plan of plans) {
    offers.push({
      key: plan.price_usd > 0 ? `${plan.id}-month` : plan.id,
      planId: plan.id,
      name: plan.name,
      interval: "month",
      priceUsd: plan.price_usd,
      priceUah: plan.price_uah,
      features: plan.features,
      stripeAvailable: plan.price_usd > 0,
    });

    const yearly = plan.price_usd_yearly;
    if (plan.price_usd > 0 && yearly && yearly > 0) {
      const saving = Math.max(0, plan.price_usd * 12 - yearly);
      offers.push({
        key: `${plan.id}-year`,
        planId: plan.id,
        name: plan.name,
        interval: "year",
        priceUsd: yearly,
        priceUah: plan.price_uah_yearly ?? 0,
        features: plan.features,
        stripeAvailable: Boolean(plan.stripe_yearly_available),
        perMonthUsd: Math.round((yearly / 12) * 100) / 100,
        savingUsd: saving,
        freeMonths: Math.floor(saving / plan.price_usd),
      });
    }
  }
  return offers;
}
