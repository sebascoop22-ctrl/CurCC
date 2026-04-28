import type {
  FinancialBonusType,
  FinancialLogicType,
  FinancialPaymentStatus,
} from "../../types";

export interface NightlifeCalculationInput {
  maleGuests: number;
  femaleGuests: number;
  baseRate: number;
  logicType: FinancialLogicType;
  maleRate: number;
  femaleRate: number;
  otherCosts: number;
  bonusType: FinancialBonusType;
  bonusGoal: number;
  bonusAmount: number;
  paymentStatus: FinancialPaymentStatus;
}

export interface ServiceCalculationInput {
  totalSpend: number;
  commissionPercentage: number;
  paymentStatus: FinancialPaymentStatus;
}

export interface NightlifeCalculationResult {
  totalGuests: number;
  totalRevenue: number;
  bonus: number;
  projectedAgencyProfit: number;
  realizedAgencyProfit: number;
  nearMissBonusGoal: boolean;
}

export interface ServiceCalculationResult {
  projectedAgencyProfit: number;
  realizedAgencyProfit: number;
}

function asMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function asInt(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export function computeNightlife(
  input: NightlifeCalculationInput,
): NightlifeCalculationResult {
  const maleGuests = asInt(input.maleGuests);
  const femaleGuests = asInt(input.femaleGuests);
  const totalGuests = maleGuests + femaleGuests;
  const baseRate = asMoney(input.baseRate);
  const totalRevenue = asMoney(totalGuests * baseRate);
  const bonusGoal = asInt(input.bonusGoal);
  const bonusAmount = asMoney(input.bonusAmount);
  let bonus = 0;
  if (input.bonusType === "flat" && bonusGoal > 0 && totalGuests >= bonusGoal) {
    bonus = bonusAmount;
  } else if (input.bonusType === "stacking" && bonusGoal > 0) {
    bonus = asMoney(bonusAmount * Math.floor(femaleGuests / bonusGoal));
  }
  const otherCosts = asMoney(input.otherCosts);
  const projectedAgencyProfit = asMoney(totalRevenue + bonus - otherCosts);
  const paid = input.paymentStatus === "paid_final";
  const realizedAgencyProfit = paid ? projectedAgencyProfit : 0;
  const nearMissBonusGoal =
    bonusGoal > 0 && totalGuests < bonusGoal && bonusGoal - totalGuests <= 2;

  return {
    totalGuests,
    totalRevenue,
    bonus,
    projectedAgencyProfit,
    realizedAgencyProfit,
    nearMissBonusGoal,
  };
}

export function computeService(
  input: ServiceCalculationInput,
): ServiceCalculationResult {
  const spend = asMoney(input.totalSpend);
  const commissionPercentage = Math.max(
    0,
    Math.min(100, Number.isFinite(input.commissionPercentage) ? input.commissionPercentage : 0),
  );
  const projectedAgencyProfit = asMoney(spend * (commissionPercentage / 100));
  return {
    projectedAgencyProfit,
    realizedAgencyProfit: input.paymentStatus === "paid_final" ? projectedAgencyProfit : 0,
  };
}
