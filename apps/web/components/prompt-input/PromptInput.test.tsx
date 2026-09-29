// @vitest-environment jsdom
/**
 * Composer palette: typing @ at the start of the field lists bots plus the
 * user's registered @entity refs under a References group, and Tab/Enter
 * completes the first match from either group.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/lib/testing/jsdom";
import { PromptInput } from "./PromptInput";

const props = () => ({
  value: "@a",
  onChange: vi.fn(),
  onSend: vi.fn(),
  tier: "balanced",
  onTierChange: vi.fn(),
  botNames: ["air"],
  entityRefs: ["acme-logo"],
});

afterEach(cleanup);

describe("@entity refs palette", () => {
  it("lists refs under a References group alongside bots", () => {
    render(<PromptInput {...props()} />);
    expect(screen.getByText("Bots")).toBeTruthy();
    expect(screen.getByText("@air")).toBeTruthy();
    expect(screen.getByText("References")).toBeTruthy();
    expect(screen.getByText("@acme-logo")).toBeTruthy();
  });

  it("completes a ref with Tab when it is the only match", () => {
    const onChange = vi.fn();
    render(
      <PromptInput {...props()} value="@ac" botNames={[]} onChange={onChange} />
    );
    const field = screen.getByRole("textbox");
    fireEvent.keyDown(field, { key: "Tab" });
    expect(onChange).toHaveBeenCalledWith("@acme-logo ");
  });
});
