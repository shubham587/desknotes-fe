import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconRotateClockwise, IconRotate2 } from "@tabler/icons-react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const AUTO_TAGS_KEY = "desknotes_auto_tags";
const getAutoTagsPref = () => localStorage.getItem(AUTO_TAGS_KEY) !== "off"; // default on

const fileToDataURL = (file) =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });

// Rotate a data-URL 90° (dir = 1 clockwise, -1 counter). Returns a new data-URL.
function rotate90(dataURL, dir) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.height;
      c.height = img.width;
      const ctx = c.getContext("2d");
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((dir * 90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      res(c.toDataURL("image/jpeg", 0.92));
    };
    img.src = dataURL;
  });
}

// Produce a cropped JPEG File from the displayed image + completed crop (px).
// No crop selected -> return the full image.
function toCroppedFile(imgEl, crop, name) {
  return new Promise((res) => {
    const c = document.createElement("canvas");
    if (crop && crop.width && crop.height) {
      const sx = imgEl.naturalWidth / imgEl.width;
      const sy = imgEl.naturalHeight / imgEl.height;
      c.width = crop.width * sx;
      c.height = crop.height * sy;
      c.getContext("2d").drawImage(
        imgEl,
        crop.x * sx,
        crop.y * sy,
        crop.width * sx,
        crop.height * sy,
        0,
        0,
        c.width,
        c.height,
      );
    } else {
      c.width = imgEl.naturalWidth;
      c.height = imgEl.naturalHeight;
      c.getContext("2d").drawImage(imgEl, 0, 0);
    }
    c.toBlob((b) => res(new File([b], name, { type: "image/jpeg" })), "image/jpeg", 0.92);
  });
}

export default function CaptureFlow({ files, onCancel, onDone }) {
  const [idx, setIdx] = useState(0);
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completed, setCompleted] = useState();
  const [autoTags, setAutoTags] = useState(getAutoTagsPref);
  const imgRef = useRef(null);
  const collected = useRef([]);
  // full-screen on phones so the crop area + action buttons both fit without
  // scrolling the modal itself to reach Transcribe
  const isMobile = useMediaQuery("(max-width: 48em)");

  // load current file whenever idx changes
  useEffect(() => {
    setCrop(undefined);
    setCompleted(undefined);
    fileToDataURL(files[idx]).then(setSrc);
  }, [idx, files]);

  const rotate = async (dir) => setSrc(await rotate90(src, dir));

  const next = async () => {
    const file = await toCroppedFile(imgRef.current, completed, files[idx].name);
    collected.current.push(file);
    if (idx < files.length - 1) setIdx(idx + 1);
    else {
      localStorage.setItem(AUTO_TAGS_KEY, autoTags ? "on" : "off");
      onDone(collected.current, autoTags);
    }
  };

  const isLast = idx === files.length - 1;

  return (
    <Modal
      opened
      onClose={onCancel}
      size="lg"
      fullScreen={isMobile}
      title={`Crop & rotate — ${idx + 1} of ${files.length}`}
      styles={isMobile ? { body: { display: "flex", flexDirection: "column", height: "calc(100dvh - 60px)" } } : undefined}
    >
      <Stack style={isMobile ? { flex: 1, minHeight: 0 } : undefined}>
        <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
          Rotate upright, then drag to crop (optional). Straighter, tighter crops read better.
        </Text>
        <div
          style={{
            flex: isMobile ? 1 : undefined,
            minHeight: isMobile ? 0 : undefined,
            maxHeight: isMobile ? undefined : 460,
            overflow: "auto",
            textAlign: "center",
          }}
        >
          {src && (
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompleted(c)}>
              <img ref={imgRef} src={src} alt="capture" style={{ maxWidth: "100%" }} />
            </ReactCrop>
          )}
        </div>
        <Checkbox
          style={{ flexShrink: 0 }}
          size="sm"
          label="Auto-generate tags with AI"
          checked={autoTags}
          onChange={(e) => setAutoTags(e.currentTarget.checked)}
        />
        <Group justify="space-between" style={{ flexShrink: 0 }} wrap="wrap">
          <Group gap="xs">
            <Button variant="default" leftSection={<IconRotate2 size={16} />} onClick={() => rotate(-1)}>
              Left
            </Button>
            <Button variant="default" leftSection={<IconRotateClockwise size={16} />} onClick={() => rotate(1)}>
              Right
            </Button>
          </Group>
          <Group gap="xs">
            <Button variant="subtle" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={next}>{isLast ? "Transcribe" : "Next photo"}</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
