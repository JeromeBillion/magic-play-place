import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ControlPanel } from "./ControlPanel";

describe("ControlPanel", () => {
  it("renders text stimulus inputs when text is selected in discovery mode", () => {
    const mockSetStimulusType = jest.fn();
    const mockSetTextInput = jest.fn();

    render(
      <ControlPanel
        mode="discovery"
        stimulusType="text"
        setStimulusType={mockSetStimulusType}
        textInput="test prompt"
        setTextInput={mockSetTextInput}
        mediaFile={null}
        setMediaFile={jest.fn()}
        openFilePicker={jest.fn()}
        fileInputRef={{ current: null }}
        valence={50}
        setValence={jest.fn()}
        arousal={50}
        setArousal={jest.fn()}
        modality="audio"
        setModality={jest.fn()}
        profile="neurotypical"
        setProfile={jest.fn()}
        cohort="adult"
        setCohort={jest.fn()}
      />
    );

    expect(screen.getByText("Stimulus Type")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test prompt")).toBeInTheDocument();
  });

  it("renders valence and arousal sliders in therapeutics mode", () => {
    render(
      <ControlPanel
        mode="therapeutics"
        stimulusType="text"
        setStimulusType={jest.fn()}
        textInput=""
        setTextInput={jest.fn()}
        mediaFile={null}
        setMediaFile={jest.fn()}
        openFilePicker={jest.fn()}
        fileInputRef={{ current: null }}
        valence={75}
        setValence={jest.fn()}
        arousal={35}
        setArousal={jest.fn()}
        modality="audio"
        setModality={jest.fn()}
        profile="neurotypical"
        setProfile={jest.fn()}
        cohort="adult"
        setCohort={jest.fn()}
      />
    );

    expect(screen.getByText(/Valence: 75/i)).toBeInTheDocument();
    expect(screen.getByText(/Arousal: 35/i)).toBeInTheDocument();
  });
});
