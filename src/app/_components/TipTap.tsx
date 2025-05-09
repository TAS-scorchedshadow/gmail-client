"use client";

import Blockquote from "@tiptap/extension-blockquote";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const Tiptap = ({
  initialContent,
  onHTMLChange,
  onTextChange,
}: {
  initialContent: string;
  onHTMLChange: (content: string) => void;
  onTextChange: (content: string) => void;
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
      onHTMLChange(editor.getHTML());
      onTextChange(editor.getText());
    },
  });

  return <EditorContent editor={editor} />;
};

export default Tiptap;
