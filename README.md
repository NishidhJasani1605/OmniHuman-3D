# OmniHuman 3D: Clinical Human Anatomy Atlas & Dual-Sex Comparative Explorer
**Interactive WebGL 3D Human Anatomical Digital Twin with Cinematic Focus & Comparative Analysis**

[![Dataset](https://img.shields.io/badge/NIH%20HRA-Human%20Atlas%20Parity-0284c7?style=for-the-badge)](https://humanatlas.io/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-00e676?style=for-the-badge)]()
[![Platform](https://img.shields.io/badge/Platform-React%2019%20%7C%20Three.js%20%7C%20Vite%20%7C%20Tailwind-8b5cf6?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

---

## 📸 Workstation Interface

![OmniHuman 3D Interface](./ui-preview.png)

---

## 🌟 Overview & Capabilities

**OmniHuman 3D** is a high-performance clinical-grade 3D anatomical explorer and digital twin workstation built with React 19, Three.js, Vite, and Tailwind CSS. It delivers an intuitive, streamlined interface featuring three dedicated exploration modes, subtle 10% X-ray visual ghosting focus, and comprehensive full-body anatomy datasets.

### 🏛️ The Three Core Atlas Modes

1. **👨 Male Atlas (`OmniMan`)**
   - **2,234 modeled anatomical structures** across 15 complete physiological systems (Skeleton, Muscles, Arteries, Veins, Nervous, Heart, Digestive, Respiratory, Urinary, Reproductive, Lymphatic, Endocrine, Sensory Organs, Integumentary, and Ligaments).
   - Contextual toggle for **30 specialized male-unique structures** (Android Pelvis, Erectile Penile Bodies, Testicular & Spermatic Conduits, Prostate Gland, and Gonadal Vasculature).

2. **👩 Female Atlas (`OmniWoman`)**
   - **Full-Body Parity (2,279 structures)** providing comprehensive anatomical coverage matched to high-precision reference datasets.
   - Dedicated **Female-Only Unique Catalog (77 verified structures)**: Gynecoid Pelvis, Clitoral-Vestibular Complex, Uterovaginal Architecture, Multilayer Mammary Glands & Ducts, and Cranial Aesthetics.

3. **↔️ Side-by-Side Comparative Frame (Female & Male)**
   - Displays dimorphic structures side-by-side in the same 3D viewport (77 Female Organs on the left vs 30 Male Organs on the right).
   - Real-time homologous organ mapping (Clitoris ↔ Penis, Labia Majora ↔ Scrotum, Ovaries ↔ Testes).
   - Interactive comparative parts catalog with one-click 3D solo focus.

---

## 🔍 Cinematic Focus & 10% Visual Ghosting

- **Target Radiance**: Clicking any 3D organ or selecting it from search isolates the targeted structure at **100% solid opacity**, vibrantly illuminated with enhanced shader lighting.
- **10% X-Ray Ghosting**: All surrounding organs, muscles, and bones transition fluidly to **10% opacity** (`0.10`) with a cool desaturated X-ray glass tint, preserving anatomical spatial context without visual obstruction.
- **Smooth 0.8s Camera Flights**: Smooth Bezier curve flight path glides and orbits to frame the target structure with zero jarring snapping or teleportation.
- **Universal Restoration**:
  - Floating **`↺ Back to whole body`** pill button smoothly animates the camera back out and restores all body parts to 100% solid opacity.
  - Clicking empty background space in the 3D viewport triggers automatic whole-body restoration.

---

## ⚙️ Additional Features

- **Instant Spotlight Search (`/`)**: Universal modal search across all modeled structures with instant filtering by system and FMA identifiers.
- **Exploded Anatomy (0–100%)**: Smoothly disassemble anatomical layers along physiological vectors for deep internal inspection.
- **Clinical Diagnostic Sheet**: Deep-dive metadata inspection sheet providing FMA IDs, vertex counts, facet counts, and anatomical descriptions.
- **15 Discrete System Toggles**: Independent layer switches and bulk presets (Skeleton, Organs, All).

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm** or **bun**

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/NishidhJasani1605/OmniHuman-3D.git
cd OmniHuman-3D/OmniHuman-3D-main

# Install dependencies
npm install

# Start local development server
npm run dev
```
Open `http://localhost:3016` in your browser.

### Production Build
```bash
# Typecheck code
npm run check

# Compile production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## ⌨️ Controls & Navigation

| Action | Control | Description |
| :--- | :--- | :--- |
| **Orbit** | Left Click + Drag | Rotate around the 3D anatomical subject |
| **Pan** | Right Click + Drag / Two-Finger Drag | Translate viewport horizontally or vertically |
| **Zoom** | Mouse Wheel / Pinch Gesture | Move camera toward or away from target |
| **Focus & Ghost** | Left Click on any part | Focus target at 100% opacity; drop surroundings to 10% |
| **Restore Whole Body** | Click `↺ Back to whole body` / Tap empty space | Smooth return flight restoring all parts to 100% solid opacity |
| **Spotlight Search** | Press `/` or click `Find a structure` | Open search dialog across all named anatomical concepts |
| **Systems Panel** | Left Sidebar | Toggle visibility of any of the 15 physiological systems |
| **Explode View** | Bottom Slider (0% – 100%) | Separate organs and structures outward |

---

## 📜 Attributions & Data Sources

- **NIH Human Reference Atlas (HRA)**: High-resolution anatomical models of human female and male organ systems.
- **BodyParts3D**: Database Center for Life Science (DBCLS), Japan. CC BY-SA 2.1 JP.
- **FMA (Foundational Model of Anatomy)**: Structural Informatics Group, University of Washington.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
