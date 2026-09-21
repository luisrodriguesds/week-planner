import React, { type FC } from "react";
import type { ScheduleSlot } from "../types.js";

interface ClassCardProps {
  compact?: boolean;
  disabled: boolean;
  onCreatePlan: (idgrelha: number) => void;
  slot: ScheduleSlot;
}

const statusLabel: Record<ScheduleSlot["windowStatus"], string> = {
  OPEN: "Aberta",
  FUTURE: "Em breve",
  CLOSED: "Fechada",
};

const ClassCard: FC<ClassCardProps> = ({ compact = false, disabled, onCreatePlan, slot }) => {
  const hasPlan = slot.userPlanId != null;
  const time = slot.DataHoraAula.split(" ")[1]?.slice(0, 5) ?? slot.DataHoraAula;
  const soldOut = slot.availableSpots <= 0;
  const canReserve = !disabled && !hasPlan && slot.windowStatus !== "CLOSED" && !soldOut;

  return (
    <article className={`card class-card${compact ? " class-card-compact" : ""}`}>
      {compact && <div className="class-card-time">{time}</div>}
      <div className="class-card-body">
        <div className="class-card-header">
          <h3>{slot.NomeAula}</h3>
          <span className={`badge ${slot.windowStatus.toLowerCase()}`}>{statusLabel[slot.windowStatus]}</span>
        </div>
        {!compact && <div className="meta">{time} · {slot.NomeProfessor} · {slot.NomeLocal}</div>}
        {compact && (
          <div className="meta">
            {slot.NomeLocal} · {slot.NomeProfessor}
          </div>
        )}
        <div className="meta">Vagas: {slot.availableSpots}/{slot.LotacaoReservaWeb}</div>
        {hasPlan && (
          <div className="meta">
            Plano: <span className={`badge ${(slot.userPlanStatus ?? "").toLowerCase()}`}>{slot.userPlanStatus}</span>
          </div>
        )}
        {slot.userHasReservation && <div className="meta reservation-confirmed">Reserva confirmada na GoGym</div>}
        {compact ? (
          <div className="class-card-actions">
            {soldOut && !hasPlan && !slot.userHasReservation && (
              <span className="class-card-status sold-out">Esgotado</span>
            )}
            {canReserve && (
              <button
                className="btn btn-sm"
                onClick={() => onCreatePlan(slot.IDgrelha)}
                type="button"
              >
                +Agendar
              </button>
            )}
          </div>
        ) : (
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button
              className="btn"
              disabled={disabled || hasPlan || slot.windowStatus === "CLOSED" || soldOut}
              onClick={() => onCreatePlan(slot.IDgrelha)}
              type="button"
            >
              +Agendar
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default ClassCard;
