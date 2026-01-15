# WebGPU Quasicrystal Explorer

An interactive, high-performance renderer for n-fold symmetry quasicrystals using WebGPU. This project visualizes infinite, non-periodic patterns based on high-dimensional projection theory.

**[Live Demo](https://txyyss.github.io/math-art/quasicrystal/)**

## Key Features

* **Infinite & Non-periodic**: Explore the mathematically infinite landscape of quasicrystals.
* **High Performance**: Powered by WebGPU (WGSL) for smooth rendering at high resolutions.
* **Intuitive Interactions**:
    * **Pan**: Drag to move around the infinite plane.
    * **Zoom**: Pinch or use the slider to explore micro/macro structures.
    * **Rotate**: Rotate the view angle with correct coordinate transformations.
* **Robust Engineering**:
    * **Precision Handling**: Implements time-modulo arithmetic `t % 2π` to prevent floating-point precision loss over long running times.
    * **True Coordinate System**: Interaction logic (pan/drag) is mathematically corrected to align with the rotated coordinate system, ensuring perfect hand-eye coordination.

## Controls

| Action | Trackpad / Touch | Mouse |
| :--- | :--- | :--- |
| **Pan** | Two-finger slide | Left-click drag |
| **Zoom** | Pinch in/out | Slider control |
| **Rotate** | Two-finger rotate | Slider control |

## Technical Details

* **Shader Language**: WGSL (WebGPU Shading Language)
* **Pattern Generation**: Summation of plane waves with 5-fold rotational symmetry vectors.
* **Color Mapping**: Dynamic hue mapping based on wave intensity reconstruction.

## Usage

This project requires a browser with **WebGPU** support (e.g., Chrome 113+, Edge, or Safari).

1.  Open the [Live Demo](https://txyyss.github.io/math-art/quasicrystal/).
2.  Enjoy the exploration of the aperiodic structure!

---

*Created by AI*
