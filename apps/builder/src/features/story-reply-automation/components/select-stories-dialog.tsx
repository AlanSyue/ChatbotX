"use client"

import { Badge } from "@chatbotx.io/ui/components/ui/badge"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Input } from "@chatbotx.io/ui/components/ui/input"
import { Skeleton } from "@chatbotx.io/ui/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@chatbotx.io/ui/components/ui/tabs"
import { cn } from "@chatbotx.io/ui/lib/utils"
import { CheckIcon, X } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import type { LiveStory } from "../provider/story-reply-story-store"
import { useStoryReplyStoryStore } from "../provider/story-reply-story-store-context"

const SKELETON_KEYS = ["sk-1", "sk-2", "sk-3", "sk-4"]

function StoryIdTagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  placeholder: string
}) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const id = raw.trim()
    if (!id || value.includes(id)) {
      return
    }
    onChange([...value, id])
    setInputValue("")
  }

  const removeTag = (id: string) => onChange(value.filter((v) => v !== id))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.at(-1) as string)
    }
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5 outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {value.map((id) => (
        <Badge
          className="flex items-center gap-1 pr-1"
          key={id}
          variant="secondary"
        >
          <span className="max-w-50 truncate font-mono text-xs">{id}</span>
          <button
            className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive/20"
            onClick={() => removeTag(id)}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        className="h-7 min-w-30 flex-1 border-0 bg-transparent p-0 font-mono text-sm shadow-none focus-visible:ring-0"
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        ref={inputRef}
        value={inputValue}
      />
    </div>
  )
}

function StoryCard({
  story,
  selected,
  onToggle,
}: {
  story: LiveStory
  selected: boolean
  onToggle: () => void
}) {
  const thumbnail = story.media_url ?? story.thumbnail_url
  return (
    <button
      className={cn(
        "relative w-full cursor-pointer rounded-md border p-2 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted",
      )}
      onClick={onToggle}
      type="button"
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="h-3 w-3" />
        </span>
      )}
      {thumbnail && (
        <Image
          alt=""
          className="mb-2 h-24 w-full rounded object-cover"
          height={96}
          src={thumbnail}
          width={300}
        />
      )}
      <p className="line-clamp-1 truncate font-mono text-muted-foreground text-xs">
        {story.id}
      </p>
    </button>
  )
}

function StoryGrid({
  stories,
  selectedIds,
  onToggle,
  loading,
  emptyText,
}: {
  stories: LiveStory[]
  selectedIds: string[]
  onToggle: (id: string) => void
  loading: boolean
  emptyText: string
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-36 w-full rounded-md" key={key} />
        ))}
      </div>
    )
  }
  if (stories.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        {emptyText}
      </p>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          onToggle={() => onToggle(story.id)}
          selected={selectedIds.includes(story.id)}
          story={story}
        />
      ))}
    </div>
  )
}

export function SelectStoriesDialog({
  open,
  onOpenChange,
  value,
  onChange,
  platform = "messenger",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onChange: (ids: string[]) => void
  platform?: "messenger" | "instagram"
}) {
  const t = useTranslations()
  const loading = useStoryReplyStoryStore((s) => s.loading)
  const instagramStories = useStoryReplyStoryStore((s) => s.instagramStories)
  const facebookStories = useStoryReplyStoryStore((s) => s.facebookStories)
  const liveStories =
    platform === "instagram" ? instagramStories : facebookStories
  const [selectedIds, setSelectedIds] = useState<string[]>(value)

  useEffect(() => {
    if (open) {
      setSelectedIds(value)
    }
  }, [open, value])

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("storyReplyAutomation.selectStories")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="live">
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="live">
              {t("storyReplyAutomation.liveStoriesTab")}
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="storyId">
              {t("storyReplyAutomation.storyIdTab")}
            </TabsTrigger>
          </TabsList>
          <TabsContent className="mt-3" value="live">
            <StoryGrid
              emptyText={t("storyReplyAutomation.noLiveStoriesFound")}
              loading={loading}
              onToggle={toggleId}
              selectedIds={selectedIds}
              stories={liveStories}
            />
          </TabsContent>
          <TabsContent className="mt-3" value="storyId">
            <StoryIdTagInput
              onChange={setSelectedIds}
              placeholder={t("storyReplyAutomation.storyIdPlaceholder")}
              value={selectedIds}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            onClick={() => {
              onChange(selectedIds)
              onOpenChange(false)
            }}
            type="button"
          >
            {t("actions.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
