import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CenterStatusVisualizer } from "./CenterStatusVisualizer";

describe("CenterStatusVisualizer", () => {
  it("displays the correct active profile and processing status", () => {
    render(
      <CenterStatusVisualizer
        profile="adhd"
        isProcessing={true}
        mode="discovery"
        backendReachability="online"
      />
    );

    expect(screen.getByText("adhd")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    // Now shows indeterminate progress text instead of percentage
    expect(screen.getByText(/Processing neural inference/i)).toBeInTheDocument();
  });

  it("displays ready status when not processing", () => {
    render(
      <CenterStatusVisualizer
        profile="neurotypical"
        isProcessing={false}
        mode="discovery"
        backendReachability="online"
      />
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
