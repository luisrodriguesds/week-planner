import React, { useEffect, useMemo, useRef, useState, type FC } from "react";
import { Link } from "react-router-dom";
import ClassCard from "../components/ClassCard.js";
import { ApiError, plansApi, scheduleApi } from "../api/client.js";
import type { AuthUser, ScheduleSlot } from "../types.js";

interface WeekPageProps {
  user: AuthUser;
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface DayTab {
  dateNum: number;
  index: number;
  label: string;
}

function dayIndex(dateTime: string): number {
  const date = new Date(dateTime.replace(" ", "T"));
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function parseGoGymLocalDate(dateTime: string): Date {
  return new Date(dateTime.replace(" ", "T"));
}

function buildWeekTabs(slots: ScheduleSlot[]): DayTab[] {
  const anchor = slots[0];
  if (!anchor) {
    return DAY_LABELS.map((label, index) => ({ label, dateNum: 0, index }));
  }

  const anchorDate = parseGoGymLocalDate(anchor.DataHoraAula);
  const monday = new Date(anchorDate);
  monday.setDate(anchorDate.getDate() - dayIndex(anchor.DataHoraAula));

  return DAY_LABELS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, dateNum: date.getDate(), index };
  });
}

function todayTabIndex(tabs: DayTab[], slots: ScheduleSlot[]): number {
  const today = new Date();
  const match = tabs.findIndex((tab) => {
    const slot = slots.find((item) => dayIndex(item.DataHoraAula) === tab.index);
    if (!slot) return false;
    const slotDate = parseGoGymLocalDate(slot.DataHoraAula);
    return (
      slotDate.getFullYear() === today.getFullYear() &&
      slotDate.getMonth() === today.getMonth() &&
      slotDate.getDate() === today.getDate()
    );
  });
  if (match >= 0) return match;

  const monday = tabs[0];
  if (!monday) return 0;
  const mondaySlot = slots.find((item) => dayIndex(item.DataHoraAula) === 0);
  if (!mondaySlot) return 0;
  const weekStart = parseGoGymLocalDate(mondaySlot.DataHoraAula);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  if (today >= weekStart && today <= weekEnd) {
    const jsDay = today.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
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

const DESKTOP_MIN_WIDTH = 901;

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

  const weekTabs = useMemo(() => buildWeekTabs(slots), [slots]);

  const grouped = useMemo(() => {
    const days = Array.from({ length: 7 }, () => [] as ScheduleSlot[]);
    for (const slot of slots) {
      days[dayIndex(slot.DataHoraAula)].push(slot);
    }
    for (const day of days) {
      day.sort((a, b) => a.DataHoraAula.localeCompare(b.DataHoraAula));
    }
    return days;
  }, [slots]);

  useEffect(() => {
    if (dayInitialized.current || slots.length === 0) return;
    setSelectedDay(todayTabIndex(weekTabs, slots));
    dayInitialized.current = true;
  }, [slots, weekTabs]);

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
                key={tab.label}
                onClick={() => setSelectedDay(tab.index)}
                role="tab"
                type="button"
              >
                <span className="day-tab-label">{tab.label}</span>
                {tab.dateNum > 0 && <span className="day-tab-date">{tab.dateNum}</span>}
              </button>
            ))}
          </div>

          <section className="day-list">
            {grouped[selectedDay].length === 0 && <div className="empty-day">Sem aulas neste dia</div>}
            {grouped[selectedDay].map((slot) => (
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
          {grouped.map((daySlots, index) => (
            <section className="day-column" key={DAY_LABELS[index]}>
              <div className="day-header">
                {weekTabs[index]?.label ?? DAY_LABELS[index]}
                {weekTabs[index]?.dateNum ? ` ${weekTabs[index].dateNum}` : ""}
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
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};

export default WeekPage;
