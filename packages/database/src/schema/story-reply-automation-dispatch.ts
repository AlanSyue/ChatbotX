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
import { storyReplyAutomationModel } from "./story-reply-automation"
import { workspaceModel } from "./workspace"

export const storyReplyAutomationDispatchModel = pgTable(
  "StoryReplyAutomationDispatch",
  {
    ...sharedColumns,
    automationId: bigintAsString()
      .notNull()
      .references(() => storyReplyAutomationModel.id, {
        onDelete: "cascade",
        name: "StoryReplyAutomationDispatch_automationId_fkey",
      }),
    storyReplyMessageId: text().notNull(),
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, { onDelete: "cascade" }),
    scheduledAt: timestamp(timestampConfig),
    privateReplySentAt: timestamp(timestampConfig),
  },
  (table) => [
    uniqueIndex(
      "StoryReplyAutomationDispatch_automationId_storyReplyMessageId_key",
    ).on(table.automationId, table.storyReplyMessageId),
    index("StoryReplyAutomationDispatch_workspaceId_idx").on(table.workspaceId),
  ],
)
