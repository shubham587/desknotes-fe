import { useState } from "react";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";

// Confirm modal (replaces window.confirm) — red confirm for destructive actions.
export function confirmDelete({ title, message, confirmLabel = "Delete", onConfirm }) {
  modals.openConfirmModal({
    title,
    centered: true,
    children: <Text size="sm">{message}</Text>,
    labels: { confirm: confirmLabel, cancel: "Cancel" },
    confirmProps: { color: "red" },
    onConfirm,
  });
}

function PromptBody({ id, label, placeholder, submitLabel, onSubmit }) {
  const [v, setV] = useState("");
  const go = () => {
    const val = v.trim();
    if (!val) return;
    modals.close(id);
    onSubmit(val);
  };
  return (
    <Stack>
      <TextInput
        label={label}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.currentTarget.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        data-autofocus
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={() => modals.close(id)}>
          Cancel
        </Button>
        <Button onClick={go}>{submitLabel}</Button>
      </Group>
    </Stack>
  );
}

// Text-input modal (replaces window.prompt).
export function promptText({ title, label, placeholder, submitLabel = "Create", onSubmit }) {
  const id = `prompt-${Date.now()}`;
  modals.open({
    modalId: id,
    title,
    centered: true,
    children: (
      <PromptBody id={id} label={label} placeholder={placeholder} submitLabel={submitLabel} onSubmit={onSubmit} />
    ),
  });
}
