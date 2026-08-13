import { notFoundException } from "@chatbotx.io/business/errors"
import { zodBigintAsString } from "@chatbotx.io/utils"
import z from "zod"
import {
  possibleErrorsOnCreatingResource,
  possibleErrorsOnDeletingResource,
  possibleErrorsOnFindingResource,
  possibleErrorsOnListingResource,
  possibleErrorsOnUpdatingResource,
} from "@/lib/orpc/orpc-error-helper"
import { basePaginationRequest } from "@/lib/pagination"
import { workspaceTokenAuthAPI } from "@/orpc"
import { createStoryReplyAutomation } from "../actions/create-story-reply-automation.action"
import { deleteStoryReplyAutomation } from "../actions/delete-story-reply-automation.action"
import { updateStoryReplyAutomation } from "../actions/update-story-reply-automation.action"
import {
  findStoryReplyAutomationForWorkspace,
  listStoryReplyAutomationsForWorkspace,
} from "../queries"
import { listFacebookAutomationStories } from "../queries/facebook-stories"
import { listInstagramAutomationStories } from "../queries/instagram-stories"
import {
  createStoryReplyAutomationRequest,
  listStoryReplyAutomationsResponse,
  updateStoryReplyAutomationRequest,
} from "../schema/action"
import { storyReplyAutomationResource } from "../schema/resource"

const listStoryReplyAutomationsWorkspaceTokenRequest =
  basePaginationRequest.and(
    z.object({
      name: z.string().nullish(),
      folderId: zodBigintAsString().nullish(),
      isActive: z.boolean().nullish(),
    }),
  )

const storiesResponse = z.object({
  stories: z.array(
    z.object({
      id: z.string(),
      media_url: z.string().optional(),
      thumbnail_url: z.string().optional(),
      timestamp: z.string().optional(),
      permalink: z.string().optional(),
      created_time: z.string().optional(),
      permalink_url: z.string().optional(),
    }),
  ),
})

const storyReplyAutomationWorkspaceTokenAPIs = {
  listStoryReplyAutomationsWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "GET",
      path: "/v1/story-reply-automation",
      summary: "List story reply automations",
      tags: ["Story Reply Automation"],
    })
    .input(listStoryReplyAutomationsWorkspaceTokenRequest)
    .output(listStoryReplyAutomationsResponse)
    .errors(possibleErrorsOnListingResource)
    .handler(
      async ({ context, input }) =>
        await listStoryReplyAutomationsForWorkspace({
          ...input,
          workspaceId: context.workspace.id,
        }),
    ),

  getStoryReplyAutomationWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "GET",
      path: "/v1/story-reply-automation/{id}",
      summary: "Get a story reply automation by id",
      tags: ["Story Reply Automation"],
    })
    .input(z.object({ id: zodBigintAsString() }))
    .output(storyReplyAutomationResource)
    .errors(possibleErrorsOnFindingResource)
    .handler(async ({ context, input }) => {
      const record = await findStoryReplyAutomationForWorkspace(
        context.workspace.id,
        input.id,
      )
      if (!record) {
        throw notFoundException("Story Reply Automation not found")
      }
      return record
    }),

  createStoryReplyAutomationWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "POST",
      path: "/v1/story-reply-automation",
      summary: "Create a story reply automation",
      successStatus: 201,
      tags: ["Story Reply Automation"],
    })
    .input(createStoryReplyAutomationRequest)
    .output(storyReplyAutomationResource)
    .errors(possibleErrorsOnCreatingResource)
    .handler(async ({ context, input }) => {
      const { workspaceId: _workspaceId, ...rest } = input as typeof input & {
        workspaceId?: string
      }
      return await createStoryReplyAutomation(context.workspace.id, rest)
    }),

  updateStoryReplyAutomationWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "PUT",
      path: "/v1/story-reply-automation/{id}",
      summary: "Update a story reply automation",
      tags: ["Story Reply Automation"],
    })
    .input(
      updateStoryReplyAutomationRequest.and(
        z.object({ id: zodBigintAsString() }),
      ),
    )
    .output(storyReplyAutomationResource)
    .errors(possibleErrorsOnUpdatingResource)
    .handler(async ({ context, input }) => {
      const {
        id,
        workspaceId: _workspaceId,
        ...rest
      } = input as typeof input & {
        workspaceId?: string
      }
      return await updateStoryReplyAutomation(
        { workspaceId: context.workspace.id, id },
        rest,
      )
    }),

  deleteStoryReplyAutomationWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "DELETE",
      path: "/v1/story-reply-automation/{id}",
      summary: "Delete a story reply automation",
      successStatus: 204,
      tags: ["Story Reply Automation"],
    })
    .input(z.object({ id: zodBigintAsString() }))
    .errors(possibleErrorsOnDeletingResource)
    .handler(async ({ context, input }) => {
      await deleteStoryReplyAutomation({
        workspaceId: context.workspace.id,
        id: input.id,
      })
    }),

  listInstagramStoriesWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "GET",
      path: "/v1/story-reply-automation/instagram-stories",
      summary: "List currently-live Instagram stories",
      tags: ["Story Reply Automation"],
    })
    .output(storiesResponse)
    .errors(possibleErrorsOnListingResource)
    .handler(
      async ({ context }) =>
        await listInstagramAutomationStories(context.workspace.id),
    ),

  listFacebookStoriesWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "GET",
      path: "/v1/story-reply-automation/facebook-stories",
      summary: "List currently-live Facebook Page stories",
      tags: ["Story Reply Automation"],
    })
    .output(storiesResponse)
    .errors(possibleErrorsOnListingResource)
    .handler(
      async ({ context }) =>
        await listFacebookAutomationStories(context.workspace.id),
    ),
}

export default storyReplyAutomationWorkspaceTokenAPIs
