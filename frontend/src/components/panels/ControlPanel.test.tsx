import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ControlPanel } from "./ControlPanel";

const baseProps = {
  stimulusType: "text" as const,
  setStimulusType: jest.fn(),
  textInput: "",
  setTextInput: jest.fn(),
  mediaFile: null,
  setMediaFile: jest.fn(),
  fileInputRef: { current: null },
  valence: 50,
  setValence: jest.fn(),
  arousal: 50,
  setArousal: jest.fn(),
  modality: "audio" as const,
  setModality: jest.fn(),
  profile: "neurotypical" as const,
  setProfile: jest.fn(),
  cohort: "adult" as const,
  setCohort: jest.fn(),
};

describe("ControlPanel", () => {
  it("renders text stimulus inputs when text is selected in Explore mode", () => {
    render(<ControlPanel {...baseProps} mode="discovery" textInput="test prompt" />);

    expect(screen.getByText("What should we show it?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test prompt")).toBeInTheDocument();
    // Stimulus types are shown in the app's plain-spoken wording.
    expect(screen.getByRole("radio", { name: "Stimulus type: text" })).toBeInTheDocument();
    expect(screen.getByText("a picture")).toBeInTheDocument();
  });

  it("swaps the textarea for a drop zone when a file stimulus is selected", () => {
    render(<ControlPanel {...baseProps} mode="discovery" stimulusType="image" />);

    expect(screen.getByText("Drop your file here, or browse")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("test prompt")).not.toBeInTheDocument();
  });

  it("renders mood and energy sliders in Shape mode", () => {
    render(<ControlPanel {...baseProps} mode="therapeutics" valence={75} arousal={35} />);

    // Label and value are separate elements.
    expect(screen.getByText("Mood")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("Deliver it as")).toBeInTheDocument();
  });

  it("renders profile and age choices in Tune mode", () => {
    render(<ControlPanel {...baseProps} mode="conditioning" profile="adhd" />);

    expect(screen.getByText("Who are we modelling?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /ADHD/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Age cohort: adult" })).toBeInTheDocument();
  });
});
