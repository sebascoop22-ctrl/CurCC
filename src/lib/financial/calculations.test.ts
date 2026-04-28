import test from "node:test";
import assert from "node:assert/strict";
import { computeNightlife, computeService } from "./calculations";

test("nightlife flat bonus is applied at goal", () => {
  const out = computeNightlife({
    maleGuests: 4,
    femaleGuests: 6,
    baseRate: 24,
    logicType: "headcount_pay",
    maleRate: 30,
    femaleRate: 20,
    otherCosts: 50,
    bonusType: "flat",
    bonusGoal: 10,
    bonusAmount: 40,
    paymentStatus: "paid_final",
  });
  assert.equal(out.totalGuests, 10);
  assert.equal(out.totalRevenue, 240);
  assert.equal(out.bonus, 40);
  assert.equal(out.projectedAgencyProfit, 230);
  assert.equal(out.realizedAgencyProfit, 230);
});

test("nightlife stacking bonus uses female blocks", () => {
  const out = computeNightlife({
    maleGuests: 2,
    femaleGuests: 13,
    baseRate: 10,
    logicType: "headcount_pay",
    maleRate: 25,
    femaleRate: 15,
    otherCosts: 20,
    bonusType: "stacking",
    bonusGoal: 5,
    bonusAmount: 10,
    paymentStatus: "attended",
  });
  assert.equal(out.bonus, 20);
  assert.equal(out.realizedAgencyProfit, 0);
});

test("nightlife near miss flag trips within 2 guests", () => {
  const out = computeNightlife({
    maleGuests: 4,
    femaleGuests: 4,
    baseRate: 10,
    logicType: "headcount_pay",
    maleRate: 10,
    femaleRate: 10,
    otherCosts: 0,
    bonusType: "flat",
    bonusGoal: 10,
    bonusAmount: 15,
    paymentStatus: "expected",
  });
  assert.equal(out.nearMissBonusGoal, true);
});

test("nightlife flat_fee uses base rate per guest", () => {
  const out = computeNightlife({
    maleGuests: 0,
    femaleGuests: 2,
    baseRate: 10,
    logicType: "flat_fee",
    maleRate: 0,
    femaleRate: 0,
    otherCosts: 0,
    bonusType: "flat",
    bonusGoal: 10,
    bonusAmount: 75,
    paymentStatus: "expected",
  });
  assert.equal(out.totalRevenue, 20);
  assert.equal(out.projectedAgencyProfit, 20);
});

test("service commission applies only to paid_final realized", () => {
  const projected = computeService({
    totalSpend: 1000,
    commissionPercentage: 12.5,
    paymentStatus: "expected",
  });
  const realized = computeService({
    totalSpend: 1000,
    commissionPercentage: 12.5,
    paymentStatus: "paid_final",
  });
  assert.equal(projected.projectedAgencyProfit, 125);
  assert.equal(projected.realizedAgencyProfit, 0);
  assert.equal(realized.realizedAgencyProfit, 125);
});
