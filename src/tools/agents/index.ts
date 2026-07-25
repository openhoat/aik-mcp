export { CLAUDE_CODE_CONFIG } from './claude-code.js'
export { CLINE_CONFIG } from './cline.js'
export { type AgentDetection, detectAgent, findAgentConfig } from './detection.js'
export {
  getAgentConfig,
  getAllAgents,
  getGlobalBaseDir,
  getGlobalSupportedCategories,
  getInstallSpec,
  getInstallSpecForScope,
  getInstructionsCategories,
  validateGlobalSupported,
} from './factory.js'
export { OPENCODE_CONFIG } from './opencode.js'
export type {
  Agent,
  AgentConfig,
  AgentSpec,
  Category,
  ConfigUpdate,
  InstallFormat,
  InstallSpec,
  Scope,
} from './types.js'
