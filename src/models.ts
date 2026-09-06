/**
 * Models for agent-bridge — task lifecycle and agent roles.
 * Validated with zod for runtime safety.
 */

import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "open",
  "claimed",
  "in_progress",
  "in_review",
  "done",
  "blocked",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const AgentRoleSchema = z.enum(["doom", "kangbot", "unassigned"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const TaskSchema = z.object({
  issueNumber: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().default(""),
  status: TaskStatusSchema.default("open"),
  assignedTo: AgentRoleSchema.default("unassigned"),
  prNumber: z.number().int().positive().nullable().default(null),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Task = z.infer<typeof TaskSchema>;

/** Check if a task is claimed by any agent. */
export function isClaimed(task: Task): boolean {
  return task.assignedTo !== "unassigned";
}

/** Check if a task is done. */
export function isDone(task: Task): boolean {
  return task.status === "done";
}

/** Claim a task for an agent. Throws if already claimed by another. */
export function claim(task: Task, agent: AgentRole): Task {
  if (isClaimed(task) && task.assignedTo !== agent) {
    throw new Error(`Task #${task.issueNumber} already claimed by ${task.assignedTo}`);
  }
  return { ...task, assignedTo: agent, status: "claimed", updatedAt: new Date().toISOString() };
}

/** Move a claimed task to in_progress. */
export function start(task: Task): Task {
  if (task.status !== "claimed") {
    throw new Error(`Cannot start task in ${task.status} state`);
  }
  return { ...task, status: "in_progress", updatedAt: new Date().toISOString() };
}

/** Submit a task for review with a linked PR. */
export function submitForReview(task: Task, prNumber: number): Task {
  return {
    ...task,
    prNumber,
    status: "in_review",
    updatedAt: new Date().toISOString(),
  };
}

/** Mark a task as done. */
export function complete(task: Task): Task {
  return { ...task, status: "done", updatedAt: new Date().toISOString() };
}

/** Derive a TaskStatus from GitHub issue labels. */
export function statusFromLabels(labels: string[]): TaskStatus {
  if (labels.includes("done")) return "done";
  if (labels.includes("in-review")) return "in_review";
  if (labels.includes("claimed")) return "claimed";
  if (labels.includes("blocked")) return "blocked";
  return "open";
}