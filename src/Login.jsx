import { useState } from "react";
import { Box, Button, Center, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, setToken } from "./api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await api.login(username, password);
      setToken(token);
      onLogin();
    } catch {
      notifications.show({ color: "red", message: "Invalid credentials" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Center mih="100dvh" p="md">
      <Box className="rise" w="100%" maw={400}>
        {/* brand */}
        <Stack gap={4} align="center" mb="xl">
          <Box
            w={56}
            h={56}
            style={{
              borderRadius: 16,
              background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
              boxShadow: "0 8px 24px rgba(74,71,209,.35)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Stack gap={4} w={24}>
              <Box h={4} w={14} bg="white" style={{ borderRadius: 3 }} />
              <Box h={4} w={24} bg="white" style={{ borderRadius: 3, opacity: 0.9 }} />
              <Box h={4} w={24} bg="white" style={{ borderRadius: 3, opacity: 0.65 }} />
            </Stack>
          </Box>
          <Text className="wordmark" style={{ fontSize: 40 }}>
            DeskNotes
          </Text>
          <Text c="dimmed" size="sm">
            Your desk, digitized.
          </Text>
        </Stack>

        {/* form card */}
        <Box
          p="xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            boxShadow: "var(--mantine-shadow-md)",
          }}
        >
          <form onSubmit={submit}>
            <Stack>
              <TextInput
                label="Username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                size="md"
                radius="md"
                autoFocus
              />
              <PasswordInput
                label="Password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                size="md"
                radius="md"
              />
              <Button type="submit" loading={busy} fullWidth size="md" radius="md" mt="xs">
                Log in
              </Button>
            </Stack>
          </form>
        </Box>
        <Text ta="center" c="dimmed" size="xs" mt="lg">
          Snap a photo of your handwriting — we turn it into searchable notes.
        </Text>
      </Box>
    </Center>
  );
}
