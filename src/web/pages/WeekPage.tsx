import React, { useEffect, useMemo, useRef, useState, type FC } from "react";
import { Link } from "react-router-dom";
import ClassCard from "../components/ClassCard.js";
import { ApiError, plansApi, scheduleApi } from "../api/client.js";
import type { AuthUser, ScheduleSlot } from "../types.js";

interface WeekPageProps {
  user: AuthUser;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ROLLING_WINDOW_DAYS = 7;
const DESKTOP_MIN_WIDTH = 901;

interface DayTab {
  dateKey: string;
  dateNum: number;
  index: number;
  label: string;
}

function startOfLocalDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseGoGymLocalDate(dateTime: string): Date {
  const trimmed = (dateTime.split(".")[0] ?? dateTime).replace(" ", "T");
  return new Date(trimmed);
}

function slotDateKey(dateTime: string): string {
  return toDateKey(parseGoGymLocalDate(dateTime));
}

/** 7-day window starting today — matches GoGym's rolling schedule, not calendar Mon–Sun. */
function buildWeekTabs(now = new Date()): DayTab[] {
  const start = startOfLocalDay(now);
  return Array.from({ length: ROLLING_WINDOW_DAYS }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      index,
      label: WEEKDAY_LABELS[date.getDay()] ?? "?",
      dateNum: date.getDate(),
      dateKey: toDateKey(date),
    };
  });
}

function groupSlotsByDay(tabs: DayTab[], slots: ScheduleSlot[]): ScheduleSlot[][] {
  const byKey = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const key = slotDateKey(slot.DataHoraAula);
    const list = byKey.get(key) ?? [];
    list.push(slot);
    byKey.set(key, list);
  }

  return tabs.map((tab) => {
    const daySlots = byKey.get(tab.dateKey) ?? [];
    return daySlots.sort((a, b) => a.DataHoraAula.localeCompare(b.DataHoraAula));
  });
}

/** Prefer today; if today has only closed/empty classes, pick the next day with open/upcoming slots. */
function todayTabIndex(tabs: DayTab[], grouped: ScheduleSlot[][]): number {
  for (const tab of tabs) {
    const daySlots = grouped[tab.index] ?? [];
    if (daySlots.some((slot) => slot.windowStatus !== "CLOSED")) {
      return tab.index;
    }
  }
  return 0;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

const WeekPage: FC<WeekPageProps> = ({ user }) => {
  const isDesktop = useIsDesktop();
  const [filter, setFilter] = useState(user.settings?.defaultClassFilter ?? "");
  const debouncedFilter = useDebouncedValue(filter, 300);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const dayInitialized = useRef(false);

  useEffect(() => {
    setLoading(true);
    dayInitialized.current = false;
    scheduleApi.week(debouncedFilter)
      .then(setSlots)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar horário"))
      .finally(() => setLoading(false));
  }, [debouncedFilter]);

  const weekTabs = useMemo(() => buildWeekTabs(), []);
  const grouped = useMemo(() => groupSlotsByDay(weekTabs, slots), [weekTabs, slots]);

  useEffect(() => {
    if (dayInitialized.current || slots.length === 0) return;
    setSelectedDay(todayTabIndex(weekTabs, grouped));
    dayInitialized.current = true;
  }, [slots, weekTabs, grouped]);

  const createPlan = async (idgrelha: number) => {
    setError("");
    try {
      await plansApi.create(idgrelha);
      setToast("Aula agendada com sucesso");
      const refreshed = await scheduleApi.week(debouncedFilter);
      setSlots(refreshed);
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao agendar aula");
    }
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Semana</h1>
        <label className="field">
          Filtrar aulas
          <input onChange={(e) => setFilter(e.target.value)} placeholder="Ex: Go Cross" value={filter} />
        </label>
      </div>

      {!user.gogymLinked && (
        <div className="banner">
          Configura o teu <strong>idcliente GoGym</strong> em <Link to="/conta">Conta</Link> antes de agendar aulas.
        </div>
      )}

      {loading && <p>A carregar horário...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !isDesktop && (
        <>
          <div className="day-tabs" role="tablist">
            {weekTabs.map((tab) => (
              <button
                aria-selected={selectedDay === tab.index}
                className={`day-tab${selectedDay === tab.index ? " active" : ""}`}
                key={tab.dateKey}
                onClick={() => setSelectedDay(tab.index)}
                role="tab"
                type="button"
              >
                <span className="day-tab-label">{tab.label}</span>
                <span className="day-tab-date">{tab.dateNum}</span>
              </button>
            ))}
          </div>

          <section className="day-list">
            {(grouped[selectedDay] ?? []).length === 0 && <div className="empty-day">Sem aulas neste dia</div>}
            {(grouped[selectedDay] ?? []).map((slot) => (
              <ClassCard
                compact
                disabled={!user.gogymLinked}
                key={`${slot.IDgrelha}-${slot.DataHoraAula}`}
                onCreatePlan={createPlan}
                slot={slot}
              />
            ))}
          </section>
        </>
      )}

      {!loading && isDesktop && (
        <div className="week-grid">
          {weekTabs.map((tab) => {
            const daySlots = grouped[tab.index] ?? [];
            return (
              <section className="day-column" key={tab.dateKey}>
                <div className="day-header">
                  {tab.label} {tab.dateNum}
                </div>
                {daySlots.length === 0 && <div className="meta">Sem aulas</div>}
                {daySlots.map((slot) => (
                  <ClassCard
                    disabled={!user.gogymLinked}
                    key={`${slot.IDgrelha}-${slot.DataHoraAula}`}
                    onCreatePlan={createPlan}
                    slot={slot}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};

export default WeekPage;
