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
import validateEmail from "~/app/utils/emailValidator";

export default function MailSendDialog() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);
  return (
    <Dialog>
      <DialogTrigger className="w-full cursor-pointer rounded-md bg-amber-100 p-2">
        Compose
      </DialogTrigger>
      <DialogContent className="flex h-[75vh] min-w-[50vw] flex-col">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>Send an email</DialogDescription>
        </DialogHeader>
        <TagInput
          placeholder="To"
          tags={tags}
          setTags={(newTags) => {
            setTags(newTags);
          }}
          activeTagIndex={activeTagIndex}
          setActiveTagIndex={setActiveTagIndex}
          validateTag={(str) => validateEmail(str)}
        />
        <Textarea placeholder="Compose your email..." className="flex-1" />
        <Button>Send</Button>
      </DialogContent>
    </Dialog>
  );
}
