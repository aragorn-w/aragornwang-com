---
company: 'Google'
role: 'Software Engineering Intern'
location: 'Mountain View, CA'
start: 2026-05-26
end: 2026-08-21
order: 1
tags:
  - 'YouTube'
  - 'Video'
  - 'Efficient NN Architectures'
  - 'Custom Accelerators'
---

Worked on YouTube's AI team, researching and engineering efficient model architectures for video processing infrastructure.

- Exceeded the 4x compression milestone for custom video accelerator silicon with restoration and super-resolution CNNs at 5.9x parameter and compute reduction (~83% less gate area) that hold the ≥80% perceptual quality target.
- Accelerated model pretraining 12.3x and data ingestion 35.8x, nearly doubling Cloud TPU utilization from ~44% to ~81%, by building an offline dataset pre-generation pipeline and multi-threaded data loaders.
- Swept and evaluated 265+ compressed CNN architectures across automated Bayesian optimization studies (Vizier, XManager) over channel dimensions, separable convolutions, 1x1 kernels, and residual block depths, with a multi-metric evaluation harness (LPIPS, PSNR, SSIM) to map Pareto frontiers.
- Implemented channel-wise structural reparameterization and multi-scale UNet architectures in JAX/Flax that fold learned scales into convolution kernels and biases at checkpoint time for zero-latency inference: +0.75 dB PSNR, +0.014 perceptual quality.
- Authored 20+ production code changes across a production JAX/Flax codebase: built compiler-level hardware profilers (XLA cost analysis), multi-host distributed data sharding pipelines, declarative configuration schemas, and modular test suites with 100% pass rates.
- Presented detailed research findings to the YouTube video infrastructure ML and algorithms teams.
- Authored and handed off formal technical internal proposal documents based on research conducted.
- Featured by @googlestudents on Instagram: [instagram.com/p/DccOMdpjStx](https://www.instagram.com/p/DccOMdpjStx)
