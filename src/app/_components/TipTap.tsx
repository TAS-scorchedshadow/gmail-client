"use client";

import Blockquote from "@tiptap/extension-blockquote";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const Tiptap = ({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (content: string) => void;
}) => {
  const editor = useEditor({
    extensions: [StarterKit, Blockquote],
    editorProps: {
      attributes: {
        class:
          "w-full min-w-[45vw] max-w-[45vw] min-h-[40vh] max-h-[40vh] overflow-auto border-1 rounded-sm",
      },
    },
    content: initialContent,
    onUpdate: ({ editor }) => {
      console.log(editor.getHTML());
      onChange(editor.getHTML());
    },
  });

  return <EditorContent editor={editor} />;
};

export default Tiptap;
