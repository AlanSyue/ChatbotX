import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema relations are defined against the exported schema namespace
import * as schema from "../schema"

export const storyReplyAutomationRelations = defineRelationsPart(
  schema,
  (r) => ({
    storyReplyAutomationModel: {
      workspace: r.one.workspaceModel({
        from: r.storyReplyAutomationModel.workspaceId,
        to: r.workspaceModel.id,
        optional: false,
      }),
      folder: r.one.folderModel({
        from: r.storyReplyAutomationModel.folderId,
        to: r.folderModel.id,
      }),
    },
  }),
)
