import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyClubFinancialRuleSheetExtension,
  emptyPromoterFinancialSheetExtension,
  normalizeClubFinancialRuleSheetExtension,
  normalizePromoterFinancialSheetExtension,
} from "./club-financial-sheet-template";

test("emptyClubFinancialRuleSheetExtension includes V4 venue master keys", () => {
  const ext = emptyClubFinancialRuleSheetExtension();
  assert.ok(ext.regionalTickets && typeof ext.regionalTickets === "object");
  const guestlist = ext.guestlist as Record<string, unknown>;
  assert.equal(guestlist.paymentModel, null);
  assert.equal(ext.venueType, null);
  assert.equal(ext.bonusEligibility, null);
});

test("normalizeClubFinancialRuleSheetExtension merges and coerces enums", () => {
  const out = normalizeClubFinancialRuleSheetExtension({
    guestlist: { paymentModel: "per_guest", maleFemaleRequiredRatio: "2:1" },
    regionalTickets: { fixedCommissionPerTicket: 2 },
    bonusEligibility: "girls_only",
    venueType: "high_end",
  });
  const guestlist = out.guestlist as Record<string, unknown>;
  assert.equal(guestlist.paymentModel, "per_guest");
  assert.equal(guestlist.maleFemaleRequiredRatio, "2:1");
  const tickets = out.regionalTickets as Record<string, unknown>;
  assert.equal(tickets.fixedCommissionPerTicket, 2);
  assert.equal(out.bonusEligibility, "girls_only");
  assert.equal(out.venueType, "high_end");
  assert.ok(out.eventsOverrides);
});

test("normalizeClubFinancialRuleSheetExtension rejects invalid paymentModel", () => {
  const out = normalizeClubFinancialRuleSheetExtension({
    guestlist: { paymentModel: "invalid" },
  });
  assert.equal((out.guestlist as Record<string, unknown>).paymentModel, null);
});

test("normalizePromoterFinancialSheetExtension coerces payment schedule and bank block", () => {
  const out = normalizePromoterFinancialSheetExtension({
    paymentSchedule: "weekly",
    bank: { name: "  Acme  ", sortCode: "12-34-56", accountNumber: "12345678" },
    tax: { countryCode: "gb", isVatRegistered: "true", vatNumber: "GB123" },
  });
  assert.equal(out.paymentSchedule, "weekly");
  const bank = out.bank as Record<string, unknown>;
  assert.equal(bank.name, "Acme");
  assert.equal(bank.sortCode, "12-34-56");
  const tax = out.tax as Record<string, unknown>;
  assert.equal(tax.countryCode, "GB");
  assert.equal(tax.isVatRegistered, true);
  assert.equal(tax.vatNumber, "GB123");
});

test("emptyPromoterFinancialSheetExtension includes V4 payment schedule default", () => {
  const ext = emptyPromoterFinancialSheetExtension();
  assert.equal(ext.paymentSchedule, null);
  assert.ok(ext.bank && typeof ext.bank === "object");
  assert.ok(ext.tax && typeof ext.tax === "object");
});
