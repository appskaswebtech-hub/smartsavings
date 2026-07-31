/**
 * Block-based editor for the discount-code email. Shared by the create and edit
 * campaign forms so the two can't drift. Controlled: parent owns the blocks array.
 *
 * Each block is a card with type-specific inputs, a compact style row (color / size /
 * align), and move-up / move-down / remove. Image blocks can paste a URL or upload a
 * file (Shopify Files, via /api/upload-image). Rendering of these blocks to email HTML
 * lives in app/lib/emailTemplate.ts (single source of truth).
 */
import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  BlockStack,
  Box,
  Button,
  DropZone,
  InlineStack,
  Select,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { newBlock, type EmailBlock } from "../lib/emailTemplate";

type Patch = Partial<Record<string, unknown>>;

const TYPE_LABELS: Record<EmailBlock["type"], string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  link: "Link",
  code: "Discount code",
};

// Native color swatch + a Reset that clears back to the template default.
function ColorControl({
  label, value, fallback, onChange, onClear,
}: {
  label: string; value?: string; fallback: string;
  onChange: (v: string) => void; onClear: () => void;
}) {
  return (
    <BlockStack gap="050">
      <Text as="span" variant="bodySm" tone="subdued">{label}</Text>
      <InlineStack gap="100" blockAlign="center">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 28, padding: 0, border: "1px solid #c9cccf", borderRadius: 4, background: "none" }}
          aria-label={label}
        />
        {value ? (
          <Button size="micro" variant="plain" onClick={onClear}>Reset</Button>
        ) : null}
      </InlineStack>
    </BlockStack>
  );
}

function NumberControl({
  label, value, placeholder, suffix, onChange,
}: {
  label: string; value?: number; placeholder: string; suffix: string;
  onChange: (v?: number) => void;
}) {
  return (
    <div style={{ width: 120 }}>
      <TextField
        label={label} type="number" autoComplete="off" suffix={suffix}
        placeholder={placeholder}
        value={value == null ? "" : String(value)}
        onChange={(v) => onChange(v === "" ? undefined : parseInt(v, 10))}
      />
    </div>
  );
}

const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

// The style row, tailored per block type.
function StyleRow({ block, onPatch }: { block: EmailBlock; onPatch: (p: Patch) => void }) {
  const align = (
    <div style={{ width: 130 }}>
      <Select
        label="Align" options={ALIGN_OPTIONS}
        value={block.align || "left"}
        onChange={(v) => onPatch({ align: v })}
      />
    </div>
  );

  if (block.type === "heading" || block.type === "text" || block.type === "link") {
    return (
      <InlineStack gap="300" blockAlign="end" wrap>
        <NumberControl label="Font size" value={block.fontSize} placeholder={block.type === "heading" ? "22" : "15"} suffix="px" onChange={(v) => onPatch({ fontSize: v })} />
        <ColorControl label="Text color" value={block.color} fallback={block.type === "heading" ? "#1a1a1a" : "#555555"} onChange={(v) => onPatch({ color: v })} onClear={() => onPatch({ color: undefined })} />
        {block.type !== "link" && (
          <ColorControl label="Background" value={block.bgColor} fallback="#ffffff" onChange={(v) => onPatch({ bgColor: v })} onClear={() => onPatch({ bgColor: undefined })} />
        )}
        {align}
      </InlineStack>
    );
  }
  if (block.type === "button") {
    return (
      <InlineStack gap="300" blockAlign="end" wrap>
        <ColorControl label="Button color" value={block.bgColor} fallback="#1a1a1a" onChange={(v) => onPatch({ bgColor: v })} onClear={() => onPatch({ bgColor: undefined })} />
        <ColorControl label="Text color" value={block.color} fallback="#ffffff" onChange={(v) => onPatch({ color: v })} onClear={() => onPatch({ color: undefined })} />
        {align}
      </InlineStack>
    );
  }
  if (block.type === "image") {
    return (
      <InlineStack gap="300" blockAlign="end" wrap>
        <NumberControl label="Width" value={block.width} placeholder="100" suffix="%" onChange={(v) => onPatch({ width: v })} />
        {align}
      </InlineStack>
    );
  }
  return null; // code: default styling
}

// Image block: paste a URL or upload a file. Own fetcher so uploads are independent.
function ImageBlockField({ block, onPatch }: { block: Extract<EmailBlock, { type: "image" }>; onPatch: (p: Patch) => void }) {
  const fetcher = useFetcher<{ url?: string; error?: string }>();
  const uploading = fetcher.state !== "idle";
  useEffect(() => {
    if (fetcher.data?.url) onPatch({ url: fetcher.data.url });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

  const upload = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fetcher.submit(fd, { method: "post", action: "/api/upload-image", encType: "multipart/form-data" });
  };

  return (
    <BlockStack gap="200">
      <DropZone
        accept="image/*"
        type="image"
        allowMultiple={false}
        onDrop={(_files, accepted) => { if (accepted[0]) upload(accepted[0]); }}
      >
        {uploading ? (
          <Box padding="400"><InlineStack gap="200" align="center" blockAlign="center"><Spinner size="small" /><Text as="span" variant="bodySm">Uploading…</Text></InlineStack></Box>
        ) : (
          <DropZone.FileUpload actionTitle="Upload image" actionHint="or drag and drop (max 5 MB)" />
        )}
      </DropZone>
      {fetcher.data?.error ? (
        <Text as="span" variant="bodySm" tone="critical">{fetcher.data.error}</Text>
      ) : null}
      <TextField
        label="Image URL" autoComplete="off"
        placeholder="https://cdn.shopify.com/..."
        value={block.url ?? ""}
        onChange={(v) => onPatch({ url: v })}
        helpText="Upload above, or paste a hosted image URL."
      />
      <TextField label="Alt text" autoComplete="off" value={block.alt ?? ""} onChange={(v) => onPatch({ alt: v })} />
      <TextField
        label="Link (optional)" autoComplete="off"
        placeholder="https://your-store.com/..."
        value={block.link ?? ""}
        onChange={(v) => onPatch({ link: v })}
        helpText="Make the image clickable."
      />
    </BlockStack>
  );
}

export function EmailBlockEditor({
  blocks,
  onChange,
}: {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}) {
  const [addType, setAddType] = useState<EmailBlock["type"]>("text");

  const patch = (id: string, p: Patch) =>
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...p } as EmailBlock) : b)));
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = () => onChange([...blocks, newBlock(addType)]);

  return (
    <BlockStack gap="300">
      {blocks.map((block, i) => {
        const onPatch = (p: Patch) => patch(block.id, p);
        return (
          <Box key={block.id} padding="300" borderColor="border" borderWidth="025" borderRadius="200">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodySm" fontWeight="medium">{TYPE_LABELS[block.type]}</Text>
                <InlineStack gap="100">
                  <Button size="micro" disabled={i === 0} onClick={() => move(i, -1)} accessibilityLabel="Move up">↑</Button>
                  <Button size="micro" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} accessibilityLabel="Move down">↓</Button>
                  <Button size="micro" tone="critical" onClick={() => remove(block.id)}>Remove</Button>
                </InlineStack>
              </InlineStack>

              {block.type === "heading" && (
                <TextField label="Heading text" labelHidden autoComplete="off" value={block.text ?? ""} onChange={(v) => onPatch({ text: v })} />
              )}
              {block.type === "text" && (
                <TextField label="Text" labelHidden autoComplete="off" multiline={3} value={block.text ?? ""} onChange={(v) => onPatch({ text: v })} />
              )}
              {block.type === "image" && <ImageBlockField block={block} onPatch={onPatch} />}
              {block.type === "button" && (
                <BlockStack gap="200">
                  <TextField label="Button label" autoComplete="off" value={block.label ?? ""} onChange={(v) => onPatch({ label: v })} />
                  <TextField label="Button link" autoComplete="off" placeholder="https://your-store.com/..." value={block.url ?? ""} onChange={(v) => onPatch({ url: v })} helpText="Defaults to your store home page." />
                </BlockStack>
              )}
              {block.type === "link" && (
                <BlockStack gap="200">
                  <TextField label="Link text" autoComplete="off" value={block.text ?? ""} onChange={(v) => onPatch({ text: v })} />
                  <TextField label="Link URL" autoComplete="off" value={block.url ?? ""} onChange={(v) => onPatch({ url: v })} />
                </BlockStack>
              )}
              {block.type === "code" && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Shows the discount code in a dashed box. Keep at least one so shoppers receive their code.
                </Text>
              )}

              <StyleRow block={block} onPatch={onPatch} />
            </BlockStack>
          </Box>
        );
      })}

      <InlineStack gap="200" blockAlign="end">
        <div style={{ width: "200px" }}>
          <Select
            label="Add block" labelHidden
            options={[
              { label: "Heading", value: "heading" },
              { label: "Text", value: "text" },
              { label: "Image", value: "image" },
              { label: "Button", value: "button" },
              { label: "Link", value: "link" },
              { label: "Discount code", value: "code" },
            ]}
            value={addType}
            onChange={(v) => setAddType(v as EmailBlock["type"])}
          />
        </div>
        <Button onClick={add}>Add block</Button>
      </InlineStack>
    </BlockStack>
  );
}
