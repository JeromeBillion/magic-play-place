import { describe, expect, it } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MagicPlayPlace from "./MagicPlayPlace";

describe("MagicPlayPlace", () => {
  it("renders and allows switching into therapeutics mode", async () => {
    render(<MagicPlayPlace />);

    expect(screen.getByText("Magic Play Place")).toBeInTheDocument();
    const therapeuticsTab = screen.getByRole("tab", {
      name: /therapeutics/i,
    });

    await userEvent.click(therapeuticsTab);

    expect(therapeuticsTab).toHaveAttribute("aria-selected", "true");
    // The tab keeps its wire name for assistive tech but reads as "Shape".
    expect(therapeuticsTab).toHaveTextContent("Shape");
    expect(screen.getByText("Mood")).toBeInTheDocument();
  });

  it("starts with nothing found and the trust labels explained", () => {
    render(<MagicPlayPlace />);

    expect(
      screen.getByText("Nothing yet — run something and results will light up here.")
    ).toBeInTheDocument();
    expect(screen.getByText("measured")).toBeInTheDocument();
    expect(screen.getByText("take lightly")).toBeInTheDocument();
  });

  it("blames the missing input, not the backend, when nothing was typed", async () => {
    render(<MagicPlayPlace />);

    await userEvent.click(screen.getByRole("button", { name: /Run it/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Add a few words first, then run it.")
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/couldn’t reach the model/i)).not.toBeInTheDocument();
  });
});
