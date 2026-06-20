/**
 * Reusable idea:
 * Persist timer truth as accumulated elapsed time plus an optional ISO start
 * timestamp. The UI may repaint every second, but elapsed time is derived from
 * timestamps, so tab suspension, refreshes, and slow intervals do not lose time.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export function elapsedMs(timer, nowMs = Date.now()) {
  if (!timer.startedAt) return timer.accumulatedMs;
  const startedAtMs = Date.parse(timer.startedAt);
  if (!Number.isFinite(startedAtMs)) return timer.accumulatedMs;
  return timer.accumulatedMs + Math.max(0, nowMs - startedAtMs);
}

export function startTimer(timer, now = new Date()) {
  return timer.startedAt ? timer : { ...timer, startedAt: now.toISOString() };
}

export function stopTimer(timer, now = new Date()) {
  return {
    accumulatedMs: elapsedMs(timer, now.getTime()),
    startedAt: undefined
  };
}

export function resetTimer() {
  return { accumulatedMs: 0, startedAt: undefined };
}

export function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const parts = [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60
  ];
  return parts.map(part => String(part).padStart(2, "0")).join(":");
}

function demo() {
  const saved = { accumulatedMs: 4_000, startedAt: "2026-06-19T12:00:00.000Z" };
  assert.equal(elapsedMs(saved, Date.parse("2026-06-19T12:00:06.500Z")), 10_500);

  const frozen = stopTimer(saved, new Date("2026-06-19T12:00:06.500Z"));
  assert.deepEqual(frozen, { accumulatedMs: 10_500, startedAt: undefined });
  assert.equal(formatElapsed(3_723_999), "01:02:03");

  // This serialized value can be restored after a browser refresh.
  const restored = JSON.parse(JSON.stringify(frozen));
  assert.equal(elapsedMs(restored), 10_500);
  console.log("Persistent timer:", restored, formatElapsed(restored.accumulatedMs));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) demo();

