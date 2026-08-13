import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import {
  bigintAsString,
  sharedColumns,
  timestampConfig,
} from "../partials/shared"
import { fbCommentAutomationModel } from "./fb-comment-automation"
import { workspaceModel } from "./workspace"

export const fbCommentAutomationDispatchModel = pgTable(
  "FBCommentAutomationDispatch",
  {
    ...sharedColumns,
    automationId: bigintAsString()
      .notNull()
      .references(() => fbCommentAutomationModel.id, { onDelete: "cascade" }),
    commentId: text().notNull(),
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, { onDelete: "cascade" }),
    publicMessageId: bigintAsString(),
    publicMessageCreatedAt: timestamp(timestampConfig),
    scheduledAt: timestamp(timestampConfig),
    privateReplySentAt: timestamp(timestampConfig),
  },
  (table) => [
    uniqueIndex("FBCommentAutomationDispatch_automationId_commentId_key").on(
      table.automationId,
      table.commentId,
    ),
    index("FBCommentAutomationDispatch_workspaceId_idx").on(table.workspaceId),
  ],
)
