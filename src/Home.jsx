import { useRef } from "react";
import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconCamera,
  IconChecklist,
  IconFileImport,
  IconNote,
  IconPencilPlus,
  IconPhoto,
} from "@tabler/icons-react";
import { mdToPlain, relTime } from "./util.js";

function ActionCard({ icon, label, hint, onClick, accent }) {
  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: accent ? "linear-gradient(155deg, var(--accent), var(--accent-strong))" : "var(--surface)",
        border: accent ? "none" : undefined,
        color: accent ? "#fff" : undefined,
        transition: "transform .12s ease, box-shadow .12s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
    >
      <Group gap="sm" wrap="nowrap">
        {icon}
        <div>
          <Text fw={600}>{label}</Text>
          <Text size="xs" c={accent ? undefined : "dimmed"} style={accent ? { opacity: 0.85 } : undefined}>
            {hint}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

export default function Home({ notes, openTodos, onCapture, onNewNote, onImportMd, onOpenTodos, onOpenNote }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const recent = (notes || []).slice(0, 6);
  const mdInput = useRef(null);

  return (
    <Stack maw={960} mx="auto" mt="lg" gap="xl" className="rise">
      <div>
        <Title order={2}>{greeting} 👋</Title>
        <Text c="dimmed">Snap your desk, and it becomes searchable notes.</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <ActionCard
          accent
          icon={<IconCamera size={28} />}
          label="New capture"
          hint="Photograph handwriting"
          onClick={onCapture}
        />
        <ActionCard
          icon={<IconPencilPlus size={28} />}
          label="New note"
          hint="Start typing"
          onClick={onNewNote}
        />
        <ActionCard
          icon={<IconFileImport size={28} />}
          label="Import .md"
          hint="Markdown → pretty note"
          onClick={() => mdInput.current?.click()}
        />
        <ActionCard
          icon={<IconChecklist size={28} />}
          label="Todos"
          hint={openTodos ? `${openTodos} open` : "All clear"}
          onClick={onOpenTodos}
        />
      </SimpleGrid>
      <input
        ref={mdInput}
        type="file"
        accept=".md,.markdown,text/markdown"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) f.text().then((t) => onImportMd(f.name, t));
          e.target.value = "";
        }}
      />

      <div>
        <Group justify="space-between" mb="sm">
          <Text size="sm" fw={600} c="dimmed" tt="uppercase">
            Recent notes
          </Text>
          <Badge variant="light" size="sm">
            {(notes || []).length} total
          </Badge>
        </Group>
        {recent.length === 0 ? (
          <Card withBorder radius="md" padding="xl">
            <Stack align="center" gap="xs" c="dimmed">
              <IconPhoto size={32} opacity={0.5} />
              <Text size="sm">No notes yet — capture or type your first one.</Text>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {recent.map((n) => (
              <Card
                key={n.id}
                withBorder
                radius="md"
                padding="md"
                onClick={() => onOpenNote(n.id)}
                style={{ cursor: "pointer", background: "var(--surface)" }}
              >
                <Group gap="xs" wrap="nowrap" mb={6}>
                  <IconNote size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <Text fw={600} size="sm" lineClamp={1}>
                    {n.title}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 32 }}>
                  {n.preview ? mdToPlain(n.preview) : "No content yet"}
                </Text>
                <Text size="xs" c="dimmed" mt={8}>
                  {relTime(n.updated_at)}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </div>
    </Stack>
  );
}
