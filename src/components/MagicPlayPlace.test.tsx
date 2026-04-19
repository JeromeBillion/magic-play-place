import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MagicPlayPlace from "./MagicPlayPlace";

describe("MagicPlayPlace", () => {
  it("renders and allows switching into therapeutics mode", async () => {
    render(<MagicPlayPlace />);

    expect(screen.getByText("Magic Play Place")).toBeInTheDocument();
    const therapeuticsButton = screen.getByRole("button", {
      name: /therapeutics/i,
    });

    await userEvent.click(therapeuticsButton);

    expect(therapeuticsButton).toHaveClass("text-emerald-500");
  });
});
