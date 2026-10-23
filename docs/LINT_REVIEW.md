# Existing lint diagnostics

Oxlint runs across the editor, API, film and repository scripts. Errors fail CI. Existing
warnings remain visible; this work does not disable renderer rules globally or rewrite
working hooks to satisfy an automatic fix.

The renderer review distinguishes imperative Three.js state from React state:

- `GraphicsRuntime`, `InspectionCamera`, `PresentationPipeline` and `WalkController`
  own imperative renderer/camera work. React immutability/ref diagnostics alone do not
  justify replacing per-frame mutation with component state updates.
- `EntityInstances`, `LinkedFloors`, `DoorMesh`, `ModelClipGroup` and
  `InstanceVisibility` update GPU resources and shadow invalidation intentionally.
  Lifecycle/ownership changes require rendering evidence, not dependency-array autofixes.
- `GraphicsPreparation` deliberately recreates a readiness object when its renderer or
  preparation inputs change. `LinkedFloors` uses derived geometry keys to avoid unrelated
  floor recapture. Expanding dependencies mechanically can harm navigation performance.
- UI callback/dependency and refresh-export warnings remain follow-up review items.
  Their presence is reported, rather than hidden behind blanket suppressions.

This establishes an active error gate, not a claim of zero warnings. The native WebGPU
tower startup issue remains open; passing lint does not close that graphics gate.
