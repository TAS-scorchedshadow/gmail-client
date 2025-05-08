import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { type Tag, TagInput } from "emblor";
import { useState } from "react";
import validateEmail from "~/app/utils/emailHelper";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { useFormContext } from "react-hook-form";
import { type z } from "zod";
import { type emailZodType } from "~/server/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { SendIcon } from "lucide-react";
import { useSafeContext } from "~/app/providers/useSafeContext";
import { SendModalContext } from "~/app/providers/SendContext";
import Tiptap from "../../TipTap";

export default function MailSendDialog() {
  const { open, setOpen } = useSafeContext(SendModalContext);
  const form = useFormContext<z.infer<typeof emailZodType>>();

  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);

  const { setValue } = form;
  function onSubmit(data: z.infer<typeof emailZodType>) {
    console.log(data);
    emailMutation.mutate(data);
  }

  console.log(form.getValues());

  const emailMutation = api.email.sendEmail.useMutation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-full cursor-pointer rounded-md bg-amber-100 p-2">
        Compose
      </DialogTrigger>
      <DialogContent className="flex h-[75vh] min-w-[50vw] flex-col">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>Send an email</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex h-full flex-col gap-2"
          >
            <FormField
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex flex-col items-start">
                  <FormLabel className="text-left">To</FormLabel>
                  <FormControl>
                    <TagInput
                      {...field}
                      placeholder="To"
                      tags={tags}
                      setTags={(newTags) => {
                        const nTags = newTags as Tag[];
                        setTags(newTags);
                        setValue(
                          "to",
                          nTags.map((t) => t.text),
                        );
                      }}
                      activeTagIndex={activeTagIndex}
                      setActiveTagIndex={setActiveTagIndex}
                      validateTag={(str) => validateEmail(str)}
                      addTagsOnBlur={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              name={"to"}
            ></FormField>
            <FormField
              name={"subject"}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left">Subject</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            ></FormField>
            <FormField
              name={"text"}
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex flex-1 flex-col items-start">
                  <FormLabel className="text-left">Text</FormLabel>
                  <FormControl>
                    <Tiptap
                      onChange={field.onChange}
                      initialContent={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            ></FormField>
            <Button role="submit">
              <span>Send</span>
              <SendIcon className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
