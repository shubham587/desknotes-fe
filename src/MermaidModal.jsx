import { useEffect, useState } from "react";
import { Button, Code, Group, Image, Loader, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconReplace } from "@tabler/icons-react";
import mermaid from "mermaid";
import { api } from "./api";

mermaid.initialize({ startOnLoad: false });

// Converts a diagram photo to Mermaid. `sourcePath` is what we send to the model
// (the full original photo, so nothing is clipped). `onReplace` swaps the note's
// diagram image for the rendered Mermaid.
export default function MermaidModal({ sourcePath, onReplace, onClose }) {
  const [code, setCode] = useState("");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .mermaid(sourcePath)
      .then(async ({ mermaid: c }) => {
        if (!alive) return;
        setCode(c);
        try {
          const { svg: out } = await mermaid.render("m" + Date.now(), c);
          if (alive) setSvg(out);
        } catch {
          if (alive) setError("Mermaid couldn't render this — the code may need a manual tweak.");
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sourcePath]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    notifications.show({ message: "Mermaid code copied", color: "green" });
  };

  // Rasterize the Mermaid SVG to a PNG. BlockNote reliably sizes raster images
  // (it renders SVGs at 0 width), and a PNG carries a white background so it's
  // visible in dark mode. Returns a Blob.
  const svgToPng = (raw, targetW = 900) =>
    new Promise((resolve, reject) => {
      const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
      const el = doc.documentElement;
      const vb = (el.getAttribute("viewBox") || "").split(/\s+/).map(Number);
      const w = vb[2] || targetW;
      const h = vb[3] || 600;
      el.setAttribute("width", w);
      el.setAttribute("height", h);
      const data = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(el))));
      // NOTE: `Image` here is Mantine's component (imported below) — use the DOM element
      const img = document.createElement("img");
      img.onload = () => {
        const scale = Math.max(1, targetW / w) * 2; // crisp
        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png");
      };
      img.onerror = () => reject(new Error("could not rasterize diagram"));
      img.src = data;
    });

  // upload the rendered PNG and ask the note to swap the diagram image for it
  const replace = async () => {
    setReplacing(true);
    try {
      const png = await svgToPng(svg);
      const file = new File([png], "diagram.png", { type: "image/png" });
      const { url } = await api.upload(file);
      await onReplace(`${location.origin}${url}`);
      notifications.show({ message: "Diagram replaced with Mermaid", color: "green" });
      onClose();
    } catch (e) {
      notifications.show({ message: `Replace failed: ${e.message}`, color: "red" });
    } finally {
      setReplacing(false);
    }
  };

  return (
    <Modal opened onClose={onClose} size="xl" title="Diagram → Mermaid" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Converted from the original photo. Review it, then replace the photo or just copy the code.
        </Text>
        <Group align="flex-start" grow>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase">Original</Text>
            <Image src={sourcePath} fit="contain" mah={300} />
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase">Mermaid</Text>
            {loading ? (
              <Group><Loader size="sm" /><Text size="sm">Converting…</Text></Group>
            ) : error ? (
              <Text size="sm" c="red">{error}</Text>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </Stack>
        </Group>
        {code && (
          <>
            <Code block>{code}</Code>
            <Group justify="flex-end">
              <Button variant="default" onClick={copy}>Copy code</Button>
              {onReplace && (
                <Button leftSection={<IconReplace size={16} />} onClick={replace} loading={replacing} disabled={!svg}>
                  Replace photo with Mermaid
                </Button>
              )}
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
