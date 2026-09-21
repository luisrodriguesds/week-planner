import cron from "node-cron";
import { eq } from "drizzle-orm";
import type { AppDb } from "../db/index.js";
import { plans } from "../db/schema.js";
import type { GoGymClient } from "../gogym/client.js";
import { CLOCK_REFRESH_MS, type ServerClock } from "../gogym/clock.js";
import { parseGoGymDate, windowStatus } from "../server/services/window-status.js";
import { executePlan } from "./execute-plan.js";

export const LEAD_MS = 0;

export interface SchedulerContext {
  db: AppDb;
  gogym: Pick<GoGymClient, "fetchWeekSchedule" | "bookClass" | "getServerTime">;
  clock: ServerClock;
}

export function createScheduler(ctx: SchedulerContext) {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let clockInterval: ReturnType<typeof setInterval> | null = null;
  let reconcileTask: ReturnType<typeof cron.schedule> | null = null;

  const runPlan = (planId: number) => {
    void executePlan(ctx.db, ctx.gogym, ctx.clock, planId);
  };

  const cancelPlanTimer = (planId: number) => {
    const timer = timers.get(planId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(planId);
    }
  };

  const registerPlanTimer = (planId: number) => {
    cancelPlanTimer(planId);
    const plan = ctx.db.select().from(plans).where(eq(plans.id, planId)).get();
    if (!plan || plan.status !== "PLANNED") return;

    const now = ctx.clock.now();
    const window = windowStatus(now, plan.inicioMarcacao, plan.fimMarcacao);
    if (window === "OPEN" || window === "CLOSED") {
      runPlan(planId);
      return;
    }

    const executeAt = parseGoGymDate(plan.inicioMarcacao).getTime() - LEAD_MS;
    const delay = executeAt - now.getTime();
    if (delay <= 0) {
      runPlan(planId);
      return;
    }

    timers.set(planId, setTimeout(() => runPlan(planId), delay));
  };

  const reconcileAllTimers = () => {
    for (const planId of timers.keys()) cancelPlanTimer(planId);
    const planned = ctx.db.select().from(plans).where(eq(plans.status, "PLANNED")).all();
    for (const plan of planned) registerPlanTimer(plan.id);
  };

  const startScheduler = () => {
    reconcileAllTimers();
    void ctx.clock.refresh();
    clockInterval = setInterval(() => {
      void ctx.clock.refresh();
    }, CLOCK_REFRESH_MS);
    reconcileTask = cron.schedule("0 * * * *", reconcileAllTimers);
  };

  const stopScheduler = () => {
    for (const planId of timers.keys()) cancelPlanTimer(planId);
    if (clockInterval) clearInterval(clockInterval);
    reconcileTask?.stop();
  };

  return {
    registerPlanTimer,
    cancelPlanTimer,
    reconcileAllTimers,
    startScheduler,
    stopScheduler,
  };
}

export type Scheduler = ReturnType<typeof createScheduler>;
