import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
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
  });
});
