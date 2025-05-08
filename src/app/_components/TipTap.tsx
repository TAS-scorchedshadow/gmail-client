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
        class: "w-full max-w-[45vw] max-h-[40vh] overflow-auto",
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
