import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOffers, type CatalogPlan } from "./offers.ts";

const FREE: CatalogPlan = { id: "free", name: "Free", price_usd: 0, price_uah: 0, features: ["a"] };
const PRO: CatalogPlan = {
  id: "pro",
  name: "Pro",
  price_usd: 9,
  price_uah: 350,
  price_usd_yearly: 99,
  price_uah_yearly: 3850,
  stripe_yearly_available: false,
  features: ["b"],
};

test("free, pro monthly and pro yearly, in that order", () => {
  assert.deepEqual(
    buildOffers([FREE, PRO]).map((o) => o.key),
    ["free", "pro-month", "pro-year"]
  );
});

test("the yearly card carries the yearly prices", () => {
  const year = buildOffers([PRO]).find((o) => o.interval === "year")!;
  assert.equal(year.priceUsd, 99);
  assert.equal(year.priceUah, 3850);
  assert.equal(year.planId, "pro");
});

test("$99 a year against $9 a month is $9 saved — one month free", () => {
  const year = buildOffers([PRO]).find((o) => o.interval === "year")!;
  assert.equal(year.savingUsd, 9);
  assert.equal(year.freeMonths, 1);
  assert.equal(year.perMonthUsd, 8.25);
});

test("a saving under one month's price is not rounded up to a free month", () => {
  const year = buildOffers([{ ...PRO, price_usd_yearly: 104 }]).find((o) => o.interval === "year")!;
  assert.equal(year.savingUsd, 4);
  assert.equal(year.freeMonths, 0);
});

test("stripe availability follows the catalogue for yearly, always on for monthly paid", () => {
  const offers = buildOffers([FREE, PRO]);
  assert.equal(offers.find((o) => o.key === "free")!.stripeAvailable, false);
  assert.equal(offers.find((o) => o.key === "pro-month")!.stripeAvailable, true);
  assert.equal(offers.find((o) => o.key === "pro-year")!.stripeAvailable, false);
  const configured = buildOffers([{ ...PRO, stripe_yearly_available: true }]);
  assert.equal(configured.find((o) => o.key === "pro-year")!.stripeAvailable, true);
});

test("a plan without a yearly price gets no yearly card", () => {
  const { price_usd_yearly: _drop, ...monthlyOnly } = PRO;
  assert.deepEqual(buildOffers([monthlyOnly]).map((o) => o.key), ["pro-month"]);
});
