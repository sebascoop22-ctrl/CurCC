import test from "node:test";
import assert from "node:assert/strict";
import {
  jobTypeToService,
  parsePromoterJobType,
  serviceToJobType,
} from "./job-type";

test("serviceToJobType maps legacy services", () => {
  assert.equal(serviceToJobType("guestlist"), "guestlist");
  assert.equal(serviceToJobType("table_sale"), "table");
  assert.equal(serviceToJobType("private_table"), "table");
  assert.equal(serviceToJobType("tickets"), "ticket");
  assert.equal(serviceToJobType("venue_access"), "venue_hire");
  assert.equal(serviceToJobType("other"), "venue_hire");
});

test("jobTypeToService maps to legacy service column", () => {
  assert.equal(jobTypeToService("guestlist"), "guestlist");
  assert.equal(jobTypeToService("table"), "table_sale");
  assert.equal(jobTypeToService("ticket"), "tickets");
  assert.equal(jobTypeToService("venue_hire"), "other");
});

test("parsePromoterJobType prefers job_type column", () => {
  assert.equal(parsePromoterJobType("ticket"), "ticket");
  assert.equal(parsePromoterJobType("table_sale"), "table");
});
