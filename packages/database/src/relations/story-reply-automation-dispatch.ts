import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema relations are defined against the exported schema namespace
import * as schema from "../schema"

export const storyReplyAutomationDispatchRelations = defineRelationsPart(
  schema,
  (r) => ({
    storyReplyAutomationDispatchModel: {
      automation: r.one.storyReplyAutomationModel({
        from: r.storyReplyAutomationDispatchModel.automationId,
        to: r.storyReplyAutomationModel.id,
        optional: false,
      }),
      workspace: r.one.workspaceModel({
        from: r.storyReplyAutomationDispatchModel.workspaceId,
        to: r.workspaceModel.id,
        optional: false,
      }),
    },
  }),
)
