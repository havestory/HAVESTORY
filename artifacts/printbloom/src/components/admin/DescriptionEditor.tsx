import { useEffect, useMemo } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  looksLikeHtml,
  normalizeForEditor,
  parseDescriptionLines,
} from "@/lib/description-utils";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikeIcon,
  List as BulletIcon,
  ListOrdered as OrderedIcon,
  Heading1 as H1Icon,
  Heading2 as H2Icon,
  Heading3 as H3Icon,
  Link as LinkIcon,
  Link2Off as UnlinkIcon,
  Quote as QuoteIcon,
  Undo2 as UndoIcon,
  Redo2 as RedoIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eraser,
} from "lucide-react";

/**
 * Rich-text WYSIWYG description editor used by admin Products and Services
 * pages.
 *
 * Storage format: HTML string in the existing `description` text column. No
 * schema/migration changes — existing plain-text descriptions are migrated
 * lazily on first edit. The storefront renders the HTML via the
 * `DescriptionDisplay` component, which sanitises with DOMPurify.
 */
export function DescriptionEditor({
  value,
  onChange,
  placeholder,
  minHeight = 140,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const initialContent = useMemo(() => normalizeForEditor(value), [
    // Only re-run when the *external* value swaps to something fundamentally
    // different (e.g. opening a different product). Otherwise the editor owns
    // its content and re-applying value on every keystroke would reset the
    // caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    syntheticKey(value),
  ]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Heading levels limited to keep the toolbar tight; can be expanded
        // later if needed.
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-pink-600 underline underline-offset-2 hover:text-pink-700",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-4 py-3 focus:outline-none min-h-[var(--rte-min-h)]",
        // CSS variable so callers can tweak min height without rebuilding.
        style: `--rte-min-h: ${minHeight}px`,
        "data-placeholder": placeholder ?? "Describe this item…",
      },
    },
    onUpdate: ({ editor }) => {
      const next = editor.isEmpty ? "" : editor.getHTML();
      onChange(next);
    },
  });

  // If the parent swaps the value (e.g. opens edit on a different row), update
  // the editor content. We deliberately compare on the synthetic key so that
  // round-tripping our own onChange output doesn't loop.
  useEffect(() => {
    if (!editor) return;
    const nextHtml = normalizeForEditor(value);
    if (nextHtml !== editor.getHTML()) {
      editor.commands.setContent(nextHtml, false, { preserveWhitespace: "full" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, syntheticKey(value)]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-pink-200 focus-within:border-pink-300 bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror:focus { outline: none; }
        .ProseMirror ul { list-style: disc; padding-left: 1.25rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.25rem; }
        .ProseMirror h1 { font-size: 1.25rem; font-weight: 700; margin: 0.5em 0; }
        .ProseMirror h2 { font-size: 1.1rem; font-weight: 700; margin: 0.5em 0; }
        .ProseMirror h3 { font-size: 1rem; font-weight: 700; margin: 0.5em 0; }
        .ProseMirror blockquote { border-left: 3px solid #f9a8d4; padding-left: 0.75rem; color: #6b7280; margin: 0.5em 0; }
        .ProseMirror p { margin: 0.25em 0; }
      `}</style>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
        Loading…
      </div>
    );
  }

  const setLink = () => {
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Link URL (leave blank to remove):", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
      <Btn
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon size={14} />
      </Btn>
      <Btn
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon size={14} />
      </Btn>
      <Btn
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={14} />
      </Btn>
      <Btn
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikeIcon size={14} />
      </Btn>

      <Sep />

      <Btn
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <H1Icon size={14} />
      </Btn>
      <Btn
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <H2Icon size={14} />
      </Btn>
      <Btn
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <H3Icon size={14} />
      </Btn>

      <Sep />

      <Btn
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <BulletIcon size={14} />
      </Btn>
      <Btn
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <OrderedIcon size={14} />
      </Btn>
      <Btn
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon size={14} />
      </Btn>

      <Sep />

      <Btn
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft size={14} />
      </Btn>
      <Btn
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter size={14} />
      </Btn>
      <Btn
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight size={14} />
      </Btn>

      <Sep />

      <Btn
        title="Add / edit link"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <LinkIcon size={14} />
      </Btn>
      <Btn
        title="Remove link"
        disabled={!editor.isActive("link")}
        onClick={() =>
          editor.chain().focus().extendMarkRange("link").unsetLink().run()
        }
      >
        <UnlinkIcon size={14} />
      </Btn>

      <Sep />

      <Btn
        title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <Eraser size={14} />
      </Btn>

      <span className="ml-auto flex items-center gap-0.5">
        <Btn
          title="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <UndoIcon size={14} />
        </Btn>
        <Btn
          title="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <RedoIcon size={14} />
        </Btn>
      </span>
    </div>
  );
}

function Btn({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md text-gray-600 hover:bg-pink-50 hover:text-pink-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 ${
        active ? "bg-pink-100 text-pink-600" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px self-stretch bg-gray-200 mx-1" />;
}

/**
 * Generate a synthetic key from the description value so the useEffect that
 * syncs external value -> editor content runs only when the *source*
 * description changes (e.g. opening a different product), not when the user is
 * typing and our own onChange callback updates the parent state.
 */
function syntheticKey(value: string | null | undefined): string {
  if (!value) return "";
  const v = String(value);
  return `${v.length}:${v.slice(0, 8)}…${v.slice(-8)}`;
}

// Re-export for backward compatibility with existing import sites that
// pulled these helpers from this module before they were extracted to
// `lib/description-utils.ts`.
export { looksLikeHtml, normalizeForEditor, parseDescriptionLines };
