# Jam Session Interface with MusicVAE and Tone.js

## Project Overview
This project is a **real-time interactive jam session interface** built using **Tone.js** for audio synthesis and **Magenta.js** (MusicVAE and MusicRNN models) for AI-driven music generation.

The system enables a human performer to play musical sequences in real-time. It captures the MIDI input, validates and interprets it, then collaborates with AI to generate musical responses. The project focuses on generating immediate musical continuity and variation based on user input.

---

## Architecture Overview

### 1. Real-Time MIDI Capture (Tone.js)
- The system listens for live MIDI input from a keyboard or virtual instrument.
- Immediate audio feedback is provided through Tone.js synthesis engines (e.g., PolySynth).
- Timing and velocity data from note events are captured for analysis.

### 2. Validation Layer (Note Validator)
- The `note-validator.js` module ensures that only clean, musically meaningful sequences are processed.
- Checks include:
  - Note range validation
  - Timing gap measurement
  - Filtering out noise and unintended events

### 3. Timing Interpretation
- Timing gaps between notes are measured and can influence AI response generation.
- Absence and silence are treated with structural consideration to inform phrase shaping.

### 4. AI Model Interaction (Magenta.js)
- **MusicRNN**: Used for melodic prediction and immediate next-step generation.
- **MusicVAE**: Used for latent space embedding, interpolation, and musical blending of sequences.
- The appropriate model is chosen based on sequence length and context.

### 5. Latent Space Mapping (MusicVAE)
- For MusicVAE, the user’s musical sequence is compressed into a latent vector representation.
- Latent traversal enables musical transformations of the input sequence.

### 6. Output Playback (Tone.js)
- AI-generated sequences are parsed and played back using Tone.js synth engines.
- Playback preserves dynamics, timing nuance, and incorporates slight randomness to maintain an organic feel.

---

## Key Features
- **Real-Time Human-AI Collaboration:** Immediate musical feedback and conversational-style jamming.
- **Validation Layer:** Intelligent filtering of user input before AI interaction.
- **Timing Sensitivity:** Gaps and silences are structurally significant and influence generation.
- **Model Flexibility:** Supports both predictive (MusicRNN) and blending (MusicVAE) modes.
- **Visual and Auditory Feedback:** Synthesized audio and real-time visualizations enhance interaction.

---

## Technical Summary
- **Frontend Libraries:** Tone.js, Magenta.js, p5.js (optional for visualizations)
- **Primary AI Models:** MusicRNN and MusicVAE (Magenta pretrained)
- **Custom Layers:** Note Validation, Timing Interpretation, Synth Engine Manager
- **Architecture Flow:**

```plaintext
[User MIDI Input]
  → [Tone.js Immediate Playback]
  → [Validation Layer]
  → [Magenta.js AI Model (MusicVAE / MusicRNN)]
  → [Latent Space Traversal (if VAE)]
  → [Generated Continuation / Expansion]
  → [Tone.js Synth Playback]
```

---

## Project Goals
This project explores real-time co-creation between human performers and AI systems, emphasizing musical dialogue and seamless continuation rather than simple predictive output.

---

## Limitations
- **Model Constraints:** MusicVAE and MusicRNN were not explicitly trained for nuanced timing or silence interpretation; current system measures gaps manually.
- **Latency Issues:** Real-time performance may introduce slight delays depending on network speed and device processing power.
- **Fixed Instrumentation:** Current setup uses a basic Tone.js synth; no dynamic orchestration or timbral adaptation.
- **Simplified Timing Interpretation:** Initial timing influence is heuristic; no deep neural learning applied yet.

---

## Future Developments
- **Extended Model Training:** Develop new VAE/RNN models conditioned on timing and phrasing sensitivity.
- **Expanded Instrumentation:** Dynamic synthesis engine selection based on play style.
- **Visual Enhancements:** Real-time visualization of timing structures alongside sound generation.
- **User Study Trials:** Testing musical interaction models with human participants for evaluation.

---

## Developed by
**Bekkie (h.eund)**  
[Instagram](https://www.instagram.com/h.eund/) | [Website](https://www.heund.net/) | hello@heund.net  
Digital Ritualist | Systems Whisperer

---

## Acknowledgments
Based on open-source libraries developed by the Magenta Project (Google Brain) and Tone.js.

