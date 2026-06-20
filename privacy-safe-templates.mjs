/**
 * Reusable idea:
 * A template should preserve reusable shape, not yesterday's private content.
 * Extract ordered duration/category/action hints, then instantiate fresh records
 * with blank context and new IDs.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const DEFAULT_ACTION = {
  focus: "Work on",
  chore: "Tidy",
  commute: "Move to",
  leisure: "Practice",
  recovery: "Rest"
};

function normalizeText(value, maxLength = 60) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function extractTemplate(plan, name, now = new Date()) {
  const cleanName = normalizeText(name);
  if (!cleanName) throw new Error("Template name is required");
  if (plan.steps.length < 1 || plan.steps.length > 14) throw new Error("Invalid step count");

  return {
    id: randomUUID(),
    name: cleanName,
    slots: plan.steps.map(step => {
      if (!Number.isFinite(step.minutes) || step.minutes < 5 || step.minutes > 480) {
        throw new Error("Every slot needs a duration between 5 and 480 minutes");
      }
      return {
        category: step.category,
        minutes: step.minutes,
        actionHint: normalizeText(step.actionHint, 40) || DEFAULT_ACTION[step.category] || "Do"
      };
    }),
    createdAt: now.toISOString()
  };
}

export function instantiateTemplate(template, date = new Date()) {
  return {
    id: randomUUID(),
    date: date.toISOString().slice(0, 10),
    status: "draft",
    steps: template.slots.map((slot, index) => ({
      id: randomUUID(),
      ...slot,
      context: "",
      title: "",
      status: index === 0 ? "active" : "pending",
      elapsedMs: 0
    }))
  };
}

function demo() {
  const source = {
    steps: [
      { category: "focus", minutes: 50, actionHint: "Draft", context: "the secret acquisition memo" },
      { category: "recovery", minutes: 15, actionHint: "Stretch", context: "after the board call" }
    ]
  };

  const template = extractTemplate(source, "  Launch   day  ", new Date("2026-06-19T12:00:00Z"));
  const serialized = JSON.stringify(template);
  assert.equal(template.name, "Launch day");
  assert.equal(serialized.includes("secret acquisition"), false);
  assert.equal(serialized.includes("board call"), false);

  const firstUse = instantiateTemplate(template, new Date("2026-06-20T12:00:00Z"));
  const secondUse = instantiateTemplate(template, new Date("2026-06-21T12:00:00Z"));
  assert.deepEqual(firstUse.steps.map(step => step.context), ["", ""]);
  assert.notEqual(firstUse.id, secondUse.id);
  assert.notEqual(firstUse.steps[0].id, secondUse.steps[0].id);
  console.log("Privacy-safe template:", template);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) demo();
