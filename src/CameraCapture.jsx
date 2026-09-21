import { useEffect, useRef, useState } from "react";
import { ActionIcon, Alert, Button, Group, Image, Modal, Stack, Text } from "@mantine/core";
import { IconCamera, IconX } from "@tabler/icons-react";

// Real in-app camera (getUserMedia) — works on desktop webcams AND mobile rear
// cameras. Snap multiple shots, then hand them all to the transcribe pipeline.
export default function CameraCapture({ onCancel, onDone }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [shots, setShots] = useState([]); // { url, file }
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((e) => setError(e?.message || "Camera unavailable"));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // release preview object URLs when the modal closes (avoid a memory leak)
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const snap = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        const file = new File([b], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        setShots((prev) => [...prev, { url: URL.createObjectURL(b), file }]);
      },
      "image/jpeg",
      0.92,
    );
  };

  const stop = () => streamRef.current?.getTracks().forEach((t) => t.stop());
  const finish = () => {
    stop();
    onDone(shots.map((s) => s.file));
  };

  return (
    <Modal opened onClose={onCancel} size="lg" title="Take photos" centered>
      <Stack>
        {error ? (
          <Alert color="orange" title="Camera unavailable">
            {error}. Use “Upload or drop” instead, or allow camera access and retry.
          </Alert>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "4/3", objectFit: "cover" }}
          />
        )}

        <Group>
          <Button leftSection={<IconCamera size={18} />} onClick={snap} disabled={!!error}>
            Capture
          </Button>
          <Text size="sm" c="dimmed">
            {shots.length} photo{shots.length === 1 ? "" : "s"} — snap as many as you like
          </Text>
        </Group>

        {shots.length > 0 && (
          <Group gap="xs">
            {shots.map((s, i) => (
              <div key={i} style={{ position: "relative" }}>
                <Image src={s.url} w={64} h={64} radius="sm" fit="cover" />
                <ActionIcon
                  size="xs"
                  color="red"
                  variant="filled"
                  style={{ position: "absolute", top: -6, right: -6 }}
                  onClick={() => {
                    URL.revokeObjectURL(s.url);
                    setShots((p) => p.filter((_, j) => j !== i));
                  }}
                  aria-label="Remove photo"
                >
                  <IconX size={12} />
                </ActionIcon>
              </div>
            ))}
          </Group>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={finish} disabled={shots.length === 0}>
            Transcribe {shots.length || ""} →
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
