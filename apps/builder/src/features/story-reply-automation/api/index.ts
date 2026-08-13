import { storyReplyAutomationPrivateAPI } from "./authenticated"
import storyReplyAutomationWorkspaceTokenAPIs from "./workspace-token"

export const storyReplyAutomationAPI = {
  ...storyReplyAutomationWorkspaceTokenAPIs,
  ...storyReplyAutomationPrivateAPI,
}
