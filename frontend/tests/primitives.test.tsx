import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  Table,
  ToastProvider,
  useToast,
} from "@/components/ui";

describe("Button", () => {
  it("renders variants and disables itself while loading", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Salva</Button>);
    const button = screen.getByRole("button", { name: "Salva" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("primary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    rerender(
      <Button variant="danger" loading onClick={onClick}>
        Salva
      </Button>,
    );
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.className).toContain("danger");
  });
});

describe("IconButton", () => {
  it("requires an accessible label", () => {
    render(<IconButton label="Elimina">x</IconButton>);
    expect(screen.getByRole("button", { name: "Elimina" })).toHaveAttribute("title", "Elimina");
  });
});

describe("Field primitives", () => {
  it("links label, hint and error to the input", () => {
    const { rerender } = render(<Input label="Email" hint="Usa l'email di lavoro" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("Usa l'email di lavoro");
    rerender(<Input label="Email" hint="Usa l'email di lavoro" error="Email non valida" />);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Email non valida");
    expect(screen.getByRole("alert")).toHaveTextContent("Email non valida");
  });

  it("renders a labelled select", () => {
    render(
      <Select label="Tipo" defaultValue="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    expect(screen.getByLabelText("Tipo")).toHaveValue("b");
  });
});

describe("Card, Badge and EmptyState", () => {
  it("render titles, actions and content", () => {
    render(
      <Card title="Piano" description="Utilizzo" actions={<Badge tone="success">Attivo</Badge>}>
        <EmptyState title="Nessun QR" description="Crea il primo" action={<button>Nuovo</button>} />
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Piano" })).toBeInTheDocument();
    expect(screen.getByText("Attivo").className).toContain("success");
    expect(screen.getByRole("heading", { name: "Nessun QR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuovo" })).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("shows content only when open and closes from the button", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={false} title="Conferma" onClose={onClose}>
        Testo
      </Modal>,
    );
    expect(screen.queryByText("Testo")).not.toBeInTheDocument();
    rerender(
      <Modal open title="Conferma" onClose={onClose} actions={<button>OK</button>}>
        Testo
      </Modal>,
    );
    expect(screen.getByText("Testo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Chiudi", hidden: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Table", () => {
  const columns = [
    { key: "name", header: "Nome", render: (row: { id: number; name: string }) => row.name },
    { key: "id", header: "ID", align: "end" as const, render: (row: { id: number }) => row.id },
  ];

  it("renders headers, rows and mobile labels", () => {
    render(
      <Table
        caption="QR"
        columns={columns}
        rows={[{ id: 1, name: "Menu" }]}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Nome" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Menu" })).toHaveAttribute("data-label", "Nome");
  });

  it("renders the empty state when there are no rows", () => {
    render(
      <Table caption="QR" columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>Vuoto</p>} />,
    );
    expect(screen.getByText("Vuoto")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return <button onClick={() => toast.show("Salvato.")}>Mostra</button>;
  }

  it("announces messages and dismisses them automatically", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mostra" }));
    expect(screen.getByRole("status")).toHaveTextContent("Salvato.");
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    vi.useRealTimers();
  });

  it("throws outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow("useToast richiede ToastProvider");
  });
});
