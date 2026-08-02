import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CenterStatusVisualizer } from "./CenterStatusVisualizer";

describe("CenterStatusVisualizer", () => {
  it("shows who is being modelled and that the model is thinking", () => {
    render(
      <CenterStatusVisualizer
        profile="adhd"
        cohort="adult"
        status="loading"
        backendReachability="online"
      />
    );

    expect(screen.getByText("ADHD · adult")).toBeInTheDocument();
    expect(screen.getByText("thinking…")).toBeInTheDocument();
    expect(screen.getByText("Listening to the model…")).toBeInTheDocument();
    // A progress bar stands in for the old percentage readout.
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("displays ready status when idle, with no progress bar", () => {
    render(
      <CenterStatusVisualizer
        profile="neurotypical"
        cohort="adult"
        status="idle"
        backendReachability="online"
      />
    );

    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("reports the model as unreachable when the backend is offline", () => {
    render(
      <CenterStatusVisualizer
        profile="neurotypical"
        cohort="youth"
        status="error"
        errorKind="backend"
        backendReachability="offline"
      />
    );

    expect(screen.getByText(/unreachable/)).toBeInTheDocument();
    expect(screen.getByText("Neurotypical · young")).toBeInTheDocument();
    expect(screen.getByText(/couldn’t reach the model/)).toBeInTheDocument();
  });

  it("does not claim the model is offline when the input is just missing", () => {
    render(
      <CenterStatusVisualizer
        profile="neurotypical"
        cohort="adult"
        status="error"
        errorKind="validation"
        backendReachability="online"
      />
    );

    expect(screen.getByText("needs input")).toBeInTheDocument();
    expect(screen.getByText(/Nothing to run yet/)).toBeInTheDocument();
    expect(screen.queryByText(/couldn’t reach the model/)).not.toBeInTheDocument();
  });
});
