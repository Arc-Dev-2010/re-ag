# Neural Grid MESH — Architecture

## Runtime agents
1. Initiator: task dispatch, specialist lifecycle and normalized 3×3 coordinate mapping.
2. Memory Manager: 1 KB volume allocation, ownership, leases and release.
3. Learning Agent: online 9–16–9 neural preference model plus local frequency profile.
4. Strategy Agent: Minimax + alpha-beta pruning; learned probabilities only break equal-value ties.
5. Code Agent: constrained prompt-to-template generation for personal UI.

## Memory model
- 1 KB `ArrayBuffer` blocks are owned by an agent.
- A task receives a lease; the lease is released in `finally`.
- Agents do not receive raw access to other agents' leases.
- Managed block accounting is not a measurement of total Safari/WebKit RAM.
- Persistent state uses localStorage in this first build. Static app assets use the Cache API service worker.

## Coordinate map
Each cell has `index`, `row`, `col`, and normalized center coordinates `x`, `y` in [0,1]. The game provides its own logical state; no screenshot OCR or pixel recognition is needed.

## Neural model
A small 9 input, 16 hidden tanh, 9 output network is trained online from observed player moves. This is an experimental preference model, not a full language model. The strategy solver remains authoritative for game correctness.

## Code safety
The preview is an iframe with `sandbox="allow-scripts"` and a restrictive CSP (`default-src 'none'`, no network connections). Host page customization is limited to saved theme tokens. Arbitrary custom scripts are never injected into the parent page.

## Framework disclosure
No TensorFlow.js, PyTorch, ONNX Runtime, Transformers.js, or hosted model API. The framework/runtime is written specifically for this site in JavaScript and CSS. WebAssembly is not required in this version.
