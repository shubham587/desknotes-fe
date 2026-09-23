import { useState } from "react";
import { Box, Button, Group, Modal, Radio, Stack, Text, TextInput } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

// Shown on save when task lines are detected. Choose to add them as separate
// todos or grouped into one named checklist.
export default function AddTasksModal({ tasks, defaultName, onSeparate, onChecklist, onClose }) {
  const [mode, setMode] = useState("checklist");
  const [name, setName] = useState(defaultName || "");
  // top-anchored (not vertically centered) on phones — a centered modal with a
  // focused text input ends up rendered behind the on-screen keyboard
  const isMobile = useMediaQuery("(max-width: 48em)");

  const submit = () => {
    if (mode === "checklist") onChecklist(name.trim() || defaultName || "Checklist", tasks);
    else onSeparate(tasks);
    onClose();
  };

  return (
    <Modal
      opened
      onClose={onClose}
      centered={!isMobile}
      title={`Found ${tasks.length} task${tasks.length > 1 ? "s" : ""}`}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          How do you want to add {tasks.length > 1 ? "these" : "this"} to your Todos?
        </Text>
        <Radio.Group value={mode} onChange={setMode}>
          <Stack gap="xs">
            <Radio value="checklist" label="As one checklist — grouped, with a progress ring" />
            <Radio value="separate" label="As separate todos" />
          </Stack>
        </Radio.Group>
        {mode === "checklist" && (
          <TextInput
            label="Checklist name"
            placeholder={defaultName || "Checklist"}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        )}
        <Box
          style={{
            maxHeight: 180,
            overflowY: "auto",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 10,
            background: "var(--surface-2)",
          }}
        >
          <Stack gap={3}>
            {tasks.map((t, i) => (
              <Text key={i} size="xs" c="dimmed">
                • {t}
              </Text>
            ))}
          </Stack>
        </Box>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Skip
          </Button>
          <Button onClick={submit}>
            {mode === "checklist" ? "Add checklist" : `Add ${tasks.length} todo${tasks.length > 1 ? "s" : ""}`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
