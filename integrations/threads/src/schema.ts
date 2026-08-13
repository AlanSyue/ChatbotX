import type { Context, Handler, Oauth2Config } from "@chatbotx.io/sdk"
import { customAuthSchema } from "@chatbotx.io/sdk"
import { z } from "zod"

export type ThreadsConfig = Oauth2Config & {
  version: string
  stateParams: {
    workspaceId?: string
    referer?: string
  }
}

export const threadsAuthSchema = customAuthSchema.extend({
  tokens: z.object({
    accessToken: z.string().trim().min(1),
    expiresAt: z.string().trim().optional(),
  }),
  metadata: z.object({
    threadsUserId: z.string().trim().min(1),
    username: z.string().trim().min(1),
    version: z.string().trim().min(1),
  }),
})
export type ThreadsAuthValue = z.infer<typeof threadsAuthSchema>

export type ThreadsProfile = {
  id: string
  username: string
  name: string
  threads_profile_picture_url?: string
}

export type ThreadsActions<IAuth extends ThreadsAuthValue = ThreadsAuthValue> =
  {
    getProfile: Handler<{ ctx: Context<IAuth> }, ThreadsProfile>
  }
