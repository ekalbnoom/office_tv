export const MINUTES_PER_CALL = 3;
export const MINUTES_PER_TEXT = 2;
export const MINUTES_PER_EMAIL = 2;
export const MINUTES_PER_ACTION_ITEM = 3;
export const MINUTES_PER_PROMISE_TO_PAY = 3;
export const MINUTES_PER_PAYMENT_PLAN = 3;
export const MINUTES_PER_PAYMENT_PLAN_FOLLOW_UP = 3;

export type TimeSavedMetrics = {
  action_item_count?: number;
  call_count?: number;
  email_count?: number;
  payment_plan_count?: number;
  payment_plan_minutes?: number;
  promise_to_pay_count?: number;
  text_count?: number;
};

export function computeTotalTimeSavedHours(metrics: TimeSavedMetrics | undefined) {
  if (!metrics) {
    return 0;
  }

  const calls = metrics.call_count ?? 0;
  const texts = metrics.text_count ?? 0;
  const emails = metrics.email_count ?? 0;
  const actionItems = metrics.action_item_count ?? 0;
  const promisesToPay = metrics.promise_to_pay_count ?? 0;
  const paymentPlanMinutes = metrics.payment_plan_minutes ?? 0;

  const callHours = (calls * MINUTES_PER_CALL) / 60;
  const textHours = (texts * MINUTES_PER_TEXT) / 60;
  const emailHours = (emails * MINUTES_PER_EMAIL) / 60;
  const actionHours = (actionItems * MINUTES_PER_ACTION_ITEM) / 60;
  const promiseHours =
    (promisesToPay * MINUTES_PER_PROMISE_TO_PAY) / 60 + paymentPlanMinutes / 60;

  return callHours + textHours + emailHours + actionHours + promiseHours;
}

export function getPaymentPlanTimeSavedMinutes(planCount: number, followUpCount: number) {
  return (
    planCount * MINUTES_PER_PAYMENT_PLAN +
    followUpCount * MINUTES_PER_PAYMENT_PLAN_FOLLOW_UP
  );
}

export function formatTimeSaved(hours: number) {
  if (hours === 0) {
    return "0 min";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60).toLocaleString()} min`;
  }

  return `${Number(hours.toFixed(1)).toLocaleString()} hours`;
}
