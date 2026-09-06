/**
 * agent-bridge: multi-agent software collaboration protocol.
 */

export { AgentBridge } from "./core.js";
export type { AgentBridgeOptions } from "./core.js";
export { A2AClient } from "./a2a.js";
export type { A2AClientOptions, A2AMessage } from "./a2a.js";
export { GitHubClient } from "./github.js";
export type { GitHubClientOptions } from "./github.js";
export {
  TaskStatusSchema,
  AgentRoleSchema,
  TaskSchema,
  claim,
  start,
  submitForReview,
  complete,
  isClaimed,
  isDone,
  statusFromLabels,
} from "./models.js";
export type { Task, TaskStatus, AgentRole } from "./models.js";

export const version = "0.1.0";