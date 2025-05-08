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
import { Textarea } from "~/components/ui/textarea";

export default function MailSendDialog() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);
  return (
    <Dialog>
      <DialogTrigger className="w-full cursor-pointer rounded-md bg-amber-100 p-2">
        Compose
      </DialogTrigger>
      <DialogContent className="flex h-[75vh] flex-col">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>Send an email</DialogDescription>
        </DialogHeader>
        <TagInput
          placeholder="To"
          tags={tags}
          className="inline"
          setTags={(newTags) => {
            setTags(newTags);
          }}
          activeTagIndex={activeTagIndex}
          setActiveTagIndex={setActiveTagIndex}
        />
        <Textarea placeholder="Compose your email..." className="flex-1" />
        <Button>Send</Button>
      </DialogContent>
    </Dialog>
  );
}
