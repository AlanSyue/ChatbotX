import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const fbCommentAutomationDispatchRelations = defineRelationsPart(
  schema,
  (r) => ({
    fbCommentAutomationDispatchModel: {
      automation: r.one.fbCommentAutomationModel({
        from: r.fbCommentAutomationDispatchModel.automationId,
        to: r.fbCommentAutomationModel.id,
        optional: false,
      }),
      workspace: r.one.workspaceModel({
        from: r.fbCommentAutomationDispatchModel.workspaceId,
        to: r.workspaceModel.id,
        optional: false,
      }),
    },
  }),
)
