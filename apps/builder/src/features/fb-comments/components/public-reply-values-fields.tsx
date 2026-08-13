"use client"

import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@chatbotx.io/ui/components/ui/form"
import { Input } from "@chatbotx.io/ui/components/ui/input"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"

type PublicReplyValuesFieldsProps<TFormValues extends Record<string, unknown>> =
  {
    addButtonLabel: string
    addButtonAriaLabel: string
    description: string
    form: UseFormReturn<TFormValues>
    getItemLabel: (index: number) => string
    removeButtonAriaLabel: (index: number) => string
    values: string[]
  }

export function PublicReplyValuesFields<
  TFormValues extends Record<string, unknown>,
>({
  addButtonAriaLabel,
  addButtonLabel,
  description,
  form,
  getItemLabel,
  removeButtonAriaLabel,
  values,
}: PublicReplyValuesFieldsProps<TFormValues>) {
  const nextIdRef = useRef(0)
  const [itemIds, setItemIds] = useState<number[]>(() =>
    values.map(() => nextIdRef.current++),
  )

  useEffect(() => {
    setItemIds((currentIds) => {
      if (currentIds.length === values.length) {
        return currentIds
      }

      if (currentIds.length < values.length) {
        return [
          ...currentIds,
          ...Array.from(
            { length: values.length - currentIds.length },
            () => nextIdRef.current++,
          ),
        ]
      }

      return currentIds.slice(0, values.length)
    })
  }, [values.length])

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">{description}</p>

      {values.map((_, index) => (
        <div className="flex items-start gap-2" key={itemIds[index] ?? index}>
          <FormField
            control={form.control}
            name={`publicReply.values.${index}` as never}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{getItemLabel(index)}</FormLabel>
                <FormControl>
                  <Input {...field} required={index === 0} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {values.length > 1 ? (
            <Button
              aria-label={removeButtonAriaLabel(index)}
              className="mt-8 shrink-0"
              onClick={() => {
                const nextValues = values.filter(
                  (_, currentIndex) => currentIndex !== index,
                )
                setItemIds((currentIds) =>
                  currentIds.filter(
                    (_, currentIndex) => currentIndex !== index,
                  ),
                )
                form.setValue(
                  "publicReply.values" as never,
                  nextValues as never,
                  {
                    shouldValidate: true,
                  },
                )
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2Icon className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}

      {values.length < 10 ? (
        <Button
          aria-label={addButtonAriaLabel}
          onClick={() => {
            setItemIds((currentIds) => [...currentIds, nextIdRef.current++])
            form.setValue(
              "publicReply.values" as never,
              [...values, ""] as never,
              {
                shouldValidate: true,
              },
            )
          }}
          type="button"
          variant="outline"
        >
          <PlusIcon className="size-4" />
          {addButtonLabel}
        </Button>
      ) : null}
    </div>
  )
}
