"use client";
import { useState } from "react";

export default function BackfillButton() {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cron/backfill?days=${days}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error ?? res.status}`);
      } else {
        setResult(
          `Done. ${data.days} days processed · ${data.picksInserted} picks inserted · ${data.picksGraded} graded.`
        );
        // Refresh page after 2s
        setTimeout(() => location.reload(), 2500);
      }
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="chip chip-muted hover:brightness-125 cursor-pointer"
      >
        ▸ Run backtest
      </button>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="font-mono text-xs text-red-400 tracking-[0.2em] uppercase">
        Run historical backtest
      </div>
      <p className="text-xs text-paper-300">
        Runs the model on past dates (uses honest date-bounded pitcher logs; current-season team stats have mild leakage). Synthetic -110 odds are used since historical real odds aren't available on the free tier. Takes 3-10 minutes depending on days.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          placeholder="CRON_SECRET"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="font-mono text-sm bg-bg-800 border border-bg-700 rounded px-3 py-2 text-paper-100 placeholder:text-bg-500 flex-1 min-w-[200px]"
        />
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="font-mono text-sm bg-bg-800 border border-bg-700 rounded px-3 py-2 text-paper-100"
        >
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="21">21 days</option>
          <option value="30">30 days</option>
        </select>
        <button
          onClick={run}
          disabled={busy || !secret}
          className="chip chip-red disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Running..." : "Start"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="chip chip-muted"
        >
          Cancel
        </button>
      </div>
      {result && (
        <div className={`text-sm font-mono ${result.startsWith("Error") ? "text-red-400" : "text-good-400"}`}>
          {result}
        </div>
      )}
    </div>
  );
}
