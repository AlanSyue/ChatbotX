import { zodBigintAsString } from "@chatbotx.io/utils"
import z from "zod"
import { withWorkspaceIdSchema } from "@/features/workspaces/schema/resource"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { createStoryReplyAutomation } from "../actions/create-story-reply-automation.action"
import { deleteStoryReplyAutomation } from "../actions/delete-story-reply-automation.action"
import { updateStoryReplyAutomation } from "../actions/update-story-reply-automation.action"
import { listStoryReplyAutomations } from "../queries"
import { listFacebookAutomationStories } from "../queries/facebook-stories"
import { listInstagramAutomationStories } from "../queries/instagram-stories"
import {
  createStoryReplyAutomationRequest,
  listStoryReplyAutomationsRequest,
  listStoryReplyAutomationsResponse,
  updateStoryReplyAutomationRequest,
} from "../schema/action"
import { storyReplyAutomationResource } from "../schema/resource"

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

export const storyReplyAutomationPrivateAPI = {
  listStoryReplyAutomationsAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/story-reply-automation",
      summary: "List Story Reply Automations",
      tags: ["Story Reply Automation"],
    })
    .input(listStoryReplyAutomationsRequest)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(listStoryReplyAutomationsResponse)
    .handler(async ({ input }) => await listStoryReplyAutomations(input)),

  createStoryReplyAutomationAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/story-reply-automation",
      summary: "Create Story Reply Automation",
      tags: ["Story Reply Automation"],
    })
    .input(createStoryReplyAutomationRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(storyReplyAutomationResource)
    .handler(async ({ input }) => {
      const { workspaceId, ...rest } = input
      return await createStoryReplyAutomation(workspaceId, rest)
    }),

  updateStoryReplyAutomationAPI: authorizedAPI
    .route({
      method: "PUT",
      path: "/workspaces/{workspaceId}/story-reply-automation/{id}",
      summary: "Update Story Reply Automation",
      tags: ["Story Reply Automation"],
    })
    .input(
      updateStoryReplyAutomationRequest
        .and(withWorkspaceIdSchema)
        .and(z.object({ id: zodBigintAsString() })),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(storyReplyAutomationResource)
    .handler(async ({ input }) => {
      const { workspaceId, id, ...rest } = input
      return await updateStoryReplyAutomation({ workspaceId, id }, rest)
    }),

  deleteStoryReplyAutomationAPI: authorizedAPI
    .route({
      method: "DELETE",
      path: "/workspaces/{workspaceId}/story-reply-automation/{id}",
      summary: "Delete Story Reply Automation",
      tags: ["Story Reply Automation"],
    })
    .input(withWorkspaceIdSchema.and(z.object({ id: zodBigintAsString() })))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.void())
    .handler(async ({ input }) => {
      await deleteStoryReplyAutomation({
        workspaceId: input.workspaceId,
        id: input.id,
      })
    }),

  instagramStoriesAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/story-reply-automation/instagram-stories",
      summary: "List currently-live Instagram stories for the story picker",
      tags: ["Story Reply Automation"],
    })
    .input(withWorkspaceIdSchema)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(storiesResponse)
    .handler(
      async ({ input }) =>
        await listInstagramAutomationStories(input.workspaceId),
    ),

  facebookStoriesAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/story-reply-automation/facebook-stories",
      summary: "List currently-live Facebook Page stories for the story picker",
      tags: ["Story Reply Automation"],
    })
    .input(withWorkspaceIdSchema)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(storiesResponse)
    .handler(
      async ({ input }) =>
        await listFacebookAutomationStories(input.workspaceId),
    ),
}
