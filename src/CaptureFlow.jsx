import { useEffect, useRef, useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconRotateClockwise, IconRotate2 } from "@tabler/icons-react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

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
  const imgRef = useRef(null);
  const collected = useRef([]);

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
    else onDone(collected.current);
  };

  const isLast = idx === files.length - 1;

  return (
    <Modal opened onClose={onCancel} size="lg" title={`Crop & rotate — ${idx + 1} of ${files.length}`}>
      <Stack>
        <Text size="sm" c="dimmed">
          Rotate upright, then drag to crop (optional). Straighter, tighter crops read better.
        </Text>
        <div style={{ maxHeight: 460, overflow: "auto", textAlign: "center" }}>
          {src && (
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompleted(c)}>
              <img ref={imgRef} src={src} alt="capture" style={{ maxWidth: "100%" }} />
            </ReactCrop>
          )}
        </div>
        <Group justify="space-between">
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
