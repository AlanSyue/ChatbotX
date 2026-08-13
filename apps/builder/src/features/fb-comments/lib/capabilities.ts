import type {
  FBCommentHideComments,
  FBCommentIncludeKeywords,
  FBCommentPost,
  FBCommentPublicReply,
  FBCommentReply,
  FBCommentReplyAfter,
} from "@chatbotx.io/database/partials"

export const FB_COMMENT_CAPABILITY_ERRORS = {
  threadsPostType: "fb_comment_threads_post_type_unsupported",
  threadsPrivateReply: "fb_comment_threads_private_reply_unsupported",
  threadsPublicReply: "fb_comment_threads_public_reply_unsupported",
  threadsLike: "fb_comment_threads_like_unsupported",
  threadsHide: "fb_comment_threads_hide_unsupported",
} as const

export type FbCommentCapabilityErrorCode =
  (typeof FB_COMMENT_CAPABILITY_ERRORS)[keyof typeof FB_COMMENT_CAPABILITY_ERRORS]

export type FbCommentCapabilityInput = {
  name: string
  type: "messenger" | "threads"
  folderId?: string | null | undefined
  post: FBCommentPost
  privateReply: FBCommentReply
  publicReply: FBCommentPublicReply
  includeKeywords: FBCommentIncludeKeywords
  excludeKeywords: string[]
  options: {
    replyToNewContactsOnly: boolean
    replyOncePerUserPerPost: boolean
    likeUserComment: boolean
    replyToUsersWhoCommentedOnOtherPosts: boolean
    ignoreCommentReplies: boolean
    trackUserTags: boolean
  }
  hideComments: FBCommentHideComments
  replyAfter: FBCommentReplyAfter
}

export function validateThreadsCapabilities(
  value: FbCommentCapabilityInput,
  addIssue: (
    path: (string | number)[],
    code: FbCommentCapabilityErrorCode,
  ) => void,
): void {
  if (value.type !== "threads") {
    return
  }

  if (!["all", "postIds"].includes(value.post.type)) {
    addIssue(["post", "type"], FB_COMMENT_CAPABILITY_ERRORS.threadsPostType)
  }

  if (value.privateReply.type !== "none") {
    addIssue(
      ["privateReply", "type"],
      FB_COMMENT_CAPABILITY_ERRORS.threadsPrivateReply,
    )
  }

  if (!["text", "none"].includes(value.publicReply.type)) {
    addIssue(
      ["publicReply", "type"],
      FB_COMMENT_CAPABILITY_ERRORS.threadsPublicReply,
    )
  }

  if (value.options.likeUserComment) {
    addIssue(
      ["options", "likeUserComment"],
      FB_COMMENT_CAPABILITY_ERRORS.threadsLike,
    )
  }

  if (
    value.hideComments.all ||
    value.hideComments.hasPhoneNumber ||
    value.hideComments.hasImage ||
    value.hideComments.hasVideo ||
    value.hideComments.hasLink ||
    value.hideComments.hasKeywords ||
    value.hideComments.keywords.length > 0 ||
    value.hideComments.showCommentsAfter !== "none"
  ) {
    addIssue(["hideComments"], FB_COMMENT_CAPABILITY_ERRORS.threadsHide)
  }
}
