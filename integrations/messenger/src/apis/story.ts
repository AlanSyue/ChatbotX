import { DEFAULT_API_VERSION } from "../constants"
import { rescue } from "../exception"
import { facebookGraphClient } from "../lib/http-client"
import type { MessengerAuthValue } from "../schema"

export type FacebookStoryListItem = {
  id: string
  media_type?: string
  media_url?: string
  picture?: string
  created_time?: string
  permalink_url?: string
}

type FacebookPaginatedResponse<T> = {
  data: T[]
}

export const listFacebookPageStories = (props: {
  auth: MessengerAuthValue
  pageId: string
}): Promise<FacebookStoryListItem[]> => {
  const { auth, pageId } = props
  const version = auth.version ?? DEFAULT_API_VERSION
  const endpoint = `${version}/${pageId}/stories`

  return rescue(endpoint, async () => {
    const res = await facebookGraphClient.get<
      FacebookPaginatedResponse<FacebookStoryListItem>
    >(endpoint, {
      headers: { Authorization: `Bearer ${auth.tokens.accessToken}` },
      searchParams: {
        fields: "id,media_type,media_url,picture,created_time,permalink_url",
        limit: "100",
      },
    })
    return res.data
  })
}
