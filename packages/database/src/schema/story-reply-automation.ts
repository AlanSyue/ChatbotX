import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import {
  type StoryReplyAutomationIncludeKeywords,
  type StoryReplyAutomationReply,
  type StoryReplyAutomationReplyAfter,
  type StoryReplyAutomationStoryTarget,
  storyReplyAutomationTypes,
} from "../partials/story-reply-automation"
import { folderModel } from "./folder"
import { workspaceModel } from "./workspace"

export const storyReplyAutomationType = pgEnum(
  "storyReplyAutomationType",
  storyReplyAutomationTypes.options as [string, ...string[]],
)

export const storyReplyAutomationModel = pgTable(
  "StoryReplyAutomation",
  {
    ...sharedColumns,
    name: text().notNull(),
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    folderId: bigintAsString().references(() => folderModel.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    type: storyReplyAutomationType().notNull().default("messenger"),
    isActive: boolean().notNull().default(true),
    startTime: text(),
    endTime: text(),
    repliesCount: integer().notNull().default(0),
    storyTarget: jsonb()
      .$type<StoryReplyAutomationStoryTarget>()
      .notNull()
      .default(sql`'{"type":"all","value":[]}'`),
    includeKeywords: jsonb()
      .$type<StoryReplyAutomationIncludeKeywords>()
      .notNull()
      .default(sql`'{"type":"all","value":[]}'`),
    excludeKeywords: text().array().notNull().default(sql`ARRAY[]::text[]`),
    reply: jsonb()
      .$type<StoryReplyAutomationReply>()
      .notNull()
      .default(sql`'{"type":"text","value":""}'`),
    replyAfter: jsonb()
      .$type<StoryReplyAutomationReplyAfter>()
      .notNull()
      .default(sql`'{"type":"immediately","value":0}'`),
  },
  (table) => [
    index("StoryReplyAutomation_workspaceId_idx").using(
      "btree",
      table.workspaceId.asc().nullsLast(),
    ),
    index("StoryReplyAutomation_folderId_idx").using(
      "btree",
      table.folderId.asc().nullsLast(),
    ),
  ],
)
