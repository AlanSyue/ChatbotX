import { ChannelError, ChannelErrorCategory } from "@chatbotx.io/sdk"
import { sendComment } from "./outgoing-comment"

const unsupportedCommentAction = (action: string) => () => {
  throw new ChannelError(
    `Threads does not support comment ${action} through this integration.`,
    ChannelErrorCategory.PERMISSION_DENIED,
    {
      code: "threads_comment_action_unsupported",
    },
  )
}

export const commentHandlers = {
  sendComment,
  deleteComment: unsupportedCommentAction("delete"),
  editComment: unsupportedCommentAction("edit"),
  likeComment: unsupportedCommentAction("like"),
  hideComment: unsupportedCommentAction("hide"),
}
