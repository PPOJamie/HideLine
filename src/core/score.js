import { number } from "./format.js";

function sum(values = [], field = "seconds") {
  return values.reduce((total, item) => total + number(typeof item === "number" ? item : item?.[field]), 0);
}

export function calculateScore(score = {}) {
  const hidingSeconds = Math.max(0, number(score.hidingSeconds));
  const trapSeconds = sum(score.timeTraps);
  const percentagePoints = sum(score.percentageBonuses, "percent");
  const timeBonusSeconds = sum(score.timeBonuses);
  const curseExtraSeconds = sum(score.curseExtraTime);
  const curseCureSeconds = sum(score.curseCures);
  const otherAdjustmentSeconds = sum(score.otherAdjustments);
  const beforePercentage = hidingSeconds + trapSeconds;
  const percentageMultiplier = 1 + percentagePoints / 100;
  const afterPercentage = beforePercentage * percentageMultiplier;
  const totalHidingSeconds = Math.max(0, Math.round(afterPercentage + timeBonusSeconds + curseExtraSeconds + curseCureSeconds + otherAdjustmentSeconds));
  const hidingPeriodSeconds = Math.max(0, number(score.hidingPeriodSeconds, 45 * 60));
  const totalRoundSeconds = totalHidingSeconds + hidingPeriodSeconds;
  return {
    hidingSeconds,
    trapSeconds,
    percentagePoints,
    percentageMultiplier,
    beforePercentage,
    afterPercentage: Math.round(afterPercentage),
    timeBonusSeconds,
    curseExtraSeconds,
    curseCureSeconds,
    otherAdjustmentSeconds,
    totalHidingSeconds,
    hidingPeriodSeconds,
    totalRoundSeconds
  };
}

export function emptyScore() {
  return {
    hidingSeconds: 0,
    hidingPeriodSeconds: 45 * 60,
    timeTraps: [],
    percentageBonuses: [],
    timeBonuses: [],
    curseExtraTime: [],
    curseCures: [],
    otherAdjustments: []
  };
}

export function adjustmentTarget(kind) {
  const mapping = {
    trap: "timeTraps",
    percentage: "percentageBonuses",
    time: "timeBonuses",
    curse: "curseExtraTime",
    cure: "curseCures",
    other: "otherAdjustments"
  };
  return mapping[kind] || "otherAdjustments";
}
