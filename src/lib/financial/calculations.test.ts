import test from "node:test";
import assert from "node:assert/strict";
import type { FinancialClubPaymentRate } from "../../types";
import {
  billingHeadcount,
  buildJobFinancialSnapshot,
  computeGuestlistRevenue,
  computeJobLedgerAmountGbp,
  computeNetSpendFromGross,
  computeNightlife,
  computeService,
  computeTableConciergeCut,
  computeTicketEconomics,
  evaluateSexRatioRule,
  parseSexRatioRule,
  resolveClubRateForJob,
} from "./calculations";
import { normalizeClubFinancialRuleSheetExtension } from "./club-financial-sheet-template";

function mayfairRate(overrides?: Partial<FinancialClubPaymentRate>): FinancialClubPaymentRate {
  const sheet = normalizeClubFinancialRuleSheetExtension({
    guestlist: {
      paymentModel: "per_guest",
      standardRatePerGuest: 10,
      maleFemaleRequiredRatio: "2:1 F:M",
    },
    guestlistBonuses: {
      requiredNumber: 20,
      bonusType: "flat",
      bonusFlatRate: 75,
    },
    eventsOverrides: {
      byDate: {
        "2025-12-25": {
          guestlist: { standardRatePerGuest: 15 },
          baseRate: 15,
        },
      },
    },
  });
  return {
    id: "rate-mayfair",
    department: "nightlife",
    clubSlug: "mayfair-club",
    venueOrServiceName: "Guestlist",
    maleRate: 0,
    femaleRate: 10,
    baseRate: 10,
    logicType: "flat_fee",
    bonusType: "flat",
    bonusGoal: 20,
    bonusAmount: 75,
    isActive: true,
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    sheetExtension: sheet,
    ...overrides,
  };
}

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

test("nightlife bonus suppressed when bonusValid is false", () => {
  const out = computeNightlife({
    maleGuests: 10,
    femaleGuests: 10,
    baseRate: 10,
    logicType: "flat_fee",
    maleRate: 0,
    femaleRate: 0,
    otherCosts: 0,
    bonusType: "flat",
    bonusGoal: 20,
    bonusAmount: 75,
    paymentStatus: "expected",
    bonusValid: false,
  });
  assert.equal(out.bonus, 0);
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

test("Mayfair default £10/head, 20 guests, flat bonus at 20", () => {
  const rate = mayfairRate();
  const resolved = resolveClubRateForJob("mayfair-club", "2025-06-01", "guestlist", [rate])!;
  const snap = buildJobFinancialSnapshot(
    {
      jobType: "guestlist",
      jobDate: "2025-06-01",
      clubSlug: "mayfair-club",
      maleCount: 6,
      femaleCount: 14,
      guestsCount: 20,
      guestsJoined: 20,
      guestsEntered: 20,
      ticketsSold: 0,
      grossSpendGbp: 0,
      shiftFee: 0,
      guestlistFee: 0,
    },
    resolved,
  );
  assert.equal(snap.guestlistRevenueGbp, 200);
  assert.equal(snap.bonusGbp, 75);
  assert.equal(snap.conciergeCutGbp, 275);
  assert.equal(snap.bonusValid, true);
});

test("ratio fail: 8M / 2F with 2:1 F:M requirement blocks bonus", () => {
  const ev = evaluateSexRatioRule(8, 2, "2:1 F:M");
  assert.equal(ev.valid, false);
  const rate = mayfairRate();
  const resolved = resolveClubRateForJob("mayfair-club", "2025-06-01", "guestlist", [rate])!;
  const snap = buildJobFinancialSnapshot(
    {
      jobType: "guestlist",
      jobDate: "2025-06-01",
      clubSlug: "mayfair-club",
      maleCount: 8,
      femaleCount: 2,
      guestsCount: 10,
      guestsJoined: 10,
      guestsEntered: 10,
      ticketsSold: 0,
      grossSpendGbp: 0,
      shiftFee: 0,
      guestlistFee: 0,
    },
    resolved,
  );
  assert.equal(snap.bonusValid, false);
  assert.equal(snap.bonusGbp, 0);
  assert.equal(snap.conciergeCutGbp, 100);
});

test("table: gross £12,000 → net £10,000 → 10% = £1,000", () => {
  assert.equal(computeNetSpendFromGross(12000), 10000);
  assert.equal(computeTableConciergeCut(10000), 1000);
  const rate = mayfairRate();
  const resolved = resolveClubRateForJob("mayfair-club", "2025-06-01", "table", [rate])!;
  const snap = buildJobFinancialSnapshot(
    {
      jobType: "table",
      jobDate: "2025-06-01",
      clubSlug: "mayfair-club",
      maleCount: 0,
      femaleCount: 0,
      guestsCount: 0,
      guestsJoined: 0,
      guestsEntered: 0,
      ticketsSold: 0,
      grossSpendGbp: 12000,
      shiftFee: 0,
      guestlistFee: 0,
    },
    resolved,
  );
  assert.equal(snap.netSpendGbp, 10000);
  assert.equal(snap.conciergeCutGbp, 1000);
});

test("date override: Christmas rate replaces standard for one night", () => {
  const rate = mayfairRate();
  const resolved = resolveClubRateForJob("mayfair-club", "2025-12-25", "guestlist", [rate])!;
  assert.equal(resolved.hasDateOverride, true);
  const gl = computeGuestlistRevenue({
    paymentModel: "per_guest",
    headcount: 10,
    maleCount: 5,
    femaleCount: 5,
    standardRatePerGuest: 15,
    maleRate: 0,
    femaleRate: 10,
    flatRatePerNight: 0,
  });
  assert.equal(gl.revenue, 150);
  const snap = buildJobFinancialSnapshot(
    {
      jobType: "guestlist",
      jobDate: "2025-12-25",
      clubSlug: "mayfair-club",
      maleCount: 5,
      femaleCount: 5,
      guestsCount: 10,
      guestsJoined: 10,
      guestsEntered: 10,
      ticketsSold: 0,
      grossSpendGbp: 0,
      shiftFee: 0,
      guestlistFee: 0,
    },
    resolved,
  );
  assert.equal(snap.guestlistRevenueGbp, 150);
});

test("regional: 100 tickets × £2 commission", () => {
  const sheet = normalizeClubFinancialRuleSheetExtension({
    regionalTickets: {
      ticketPrice: 20,
      fixedCommissionPerTicket: 2,
    },
  });
  const rate: FinancialClubPaymentRate = {
    id: "rate-regional",
    department: "nightlife",
    clubSlug: "oxford-venue",
    venueOrServiceName: "Tickets",
    maleRate: 0,
    femaleRate: 0,
    baseRate: 0,
    logicType: "flat_fee",
    bonusType: "none",
    bonusGoal: 0,
    bonusAmount: 0,
    isActive: true,
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    sheetExtension: sheet,
  };
  const econ = computeTicketEconomics({
    ticketsSold: 100,
    ticketPrice: 20,
    commissionPerTicket: 2,
  });
  assert.equal(econ.conciergeCut, 200);
  assert.equal(econ.totalRevenue, 2000);
  const resolved = resolveClubRateForJob("oxford-venue", "2025-07-04", "ticket", [rate])!;
  const snap = buildJobFinancialSnapshot(
    {
      jobType: "ticket",
      jobDate: "2025-07-04",
      clubSlug: "oxford-venue",
      maleCount: 0,
      femaleCount: 0,
      guestsCount: 0,
      guestsJoined: 0,
      guestsEntered: 0,
      ticketsSold: 100,
      grossSpendGbp: 0,
      shiftFee: 0,
      guestlistFee: 0,
    },
    resolved,
  );
  assert.equal(snap.conciergeCutGbp, 200);
});

test("computeJobLedgerAmountGbp matches Phase 3 SQL formula", () => {
  const amount = computeJobLedgerAmountGbp({
    shiftFee: 50,
    guestlistFee: 5,
    guestsEntered: 12,
    guestsCount: 10,
    maleCount: 4,
    femaleCount: 6,
  });
  assert.equal(amount, 110);
  assert.equal(billingHeadcount({ guestsEntered: 12, guestsCount: 10, maleCount: 4, femaleCount: 6 }), 12);
});

test("parseSexRatioRule supports F:M and M:F", () => {
  assert.deepEqual(parseSexRatioRule("2:1 F:M"), { female: 2, male: 1 });
  assert.deepEqual(parseSexRatioRule("1:2 M:F"), { female: 2, male: 1 });
});

test("sex_ratio guestlist model uses male/female rates", () => {
  const out = computeGuestlistRevenue({
    paymentModel: "sex_ratio",
    headcount: 10,
    maleCount: 3,
    femaleCount: 7,
    standardRatePerGuest: 10,
    maleRate: 5,
    femaleRate: 12,
    flatRatePerNight: 0,
  });
  assert.equal(out.revenue, 99);
});
