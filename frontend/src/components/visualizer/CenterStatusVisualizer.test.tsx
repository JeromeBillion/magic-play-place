import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CenterStatusVisualizer } from "./CenterStatusVisualizer";

describe("CenterStatusVisualizer", () => {
  it("displays the correct active profile and processing status", () => {
    render(
      <CenterStatusVisualizer profile="adhd" isProcessing={true} progress={42} />
    );

    expect(screen.getByText("adhd")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("42% COMPLETE")).toBeInTheDocument();
  });

  it("displays ready status when not processing", () => {
    render(
      <CenterStatusVisualizer profile="neurotypical" isProcessing={false} progress={0} />
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
