import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { activeHref } from "@/components/layout/AppShell";
import { Button, Menu, MenuItem, Modal, Skeleton, SkeletonList } from "@/components/ui";

function MenuFixture({ onPick = vi.fn() }) {
  return (
    <Menu label="Azioni" trigger={(props) => <button {...props}>Apri</button>}>
      {(close) => (
        <>
          <MenuItem
            onSelect={() => {
              onPick("a");
              close();
            }}
          >
            Prima
          </MenuItem>
          <MenuItem onSelect={() => onPick("b")}>Seconda</MenuItem>
        </>
      )}
    </Menu>
  );
}

describe("Menu", () => {
  it("opens with data-state, supports arrows and closes with Escape after the exit animation", async () => {
    vi.useFakeTimers();
    render(<MenuFixture />);
    const trigger = screen.getByRole("button", { name: "Apri" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await act(async () => vi.advanceTimersByTime(20));
    const menu = screen.getByRole("menu", { name: "Azioni" });
    expect(menu).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("menuitem", { name: "Prima" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Seconda" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => vi.advanceTimersByTime(20));
    expect(menu).toHaveAttribute("data-state", "closed"); // still mounted while it fades out
    await act(async () => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("runs the item action", async () => {
    const onPick = vi.fn();
    render(<MenuFixture onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: "Apri" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Prima" }));
    expect(onPick).toHaveBeenCalledWith("a");
  });
});

describe("Button loading", () => {
  it("keeps the label in the flow (no width change) and adds a spinner", () => {
    const { container } = render(<Button loading>Salva</Button>);
    const label = screen.getByText("Salva");
    expect(label).toHaveAttribute("data-hidden", "true");
    expect(container.querySelectorAll("[aria-hidden=true]").length).toBe(1);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("Skeleton", () => {
  it("is decorative alone and announced as a list", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    render(<SkeletonList rows={2} />);
    expect(screen.getByRole("status", { name: "Caricamento…" })).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("renders the desktop variant with an animated state", async () => {
    render(
      <Modal open title="Conferma" onClose={() => undefined}>
        Testo
      </Modal>,
    );
    expect(screen.getByText("Testo")).toBeInTheDocument();
    expect(document.querySelector("dialog")).toHaveAttribute("data-state");
  });
});

describe("activeHref", () => {
  const nav = [
    { href: "/app/c/1", label: "QR", icon: "qr" as const },
    { href: "/app/c/1/qr/new", label: "Nuovo", icon: "new" as const },
    { href: "/app/c/1/stats", label: "Stat", icon: "stats" as const },
  ];

  it("picks the longest matching prefix", () => {
    expect(activeHref("/app/c/1", nav)).toBe("/app/c/1");
    expect(activeHref("/app/c/1/qr/42", nav)).toBe("/app/c/1");
    expect(activeHref("/app/c/1/qr/new", nav)).toBe("/app/c/1/qr/new");
    expect(activeHref("/app/c/12", nav)).toBeUndefined();
  });
});
