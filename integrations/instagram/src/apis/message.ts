import type {
  InstagramAuthValue,
  InstagramSendMessageResponse,
} from "../schemas"
import { sendInstagramMessage } from "./page"

export const sendStoryReply = (
  auth: InstagramAuthValue,
  igsid: string,
  message: string,
): Promise<InstagramSendMessageResponse> =>
  sendInstagramMessage(auth, {
    recipient: { id: igsid },
    message: { text: message },
  })
