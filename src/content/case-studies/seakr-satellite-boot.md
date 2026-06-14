---
title: 'Satellite Memory Boot, Kernel Hardening, and an SDR ML Demo'
org: 'SEAKR Engineering (RTX subsidiary)'
year: 2024
stack: ['C', 'Embedded', 'Linux Kernel', 'PyTorch', 'CNN', 'Software-Defined Radio']
public_code: false
---

**Problem.** Three threads at SEAKR (a satellite electronics shop, RTX subsidiary): future satellite hardware needed reliable boot software for critical memory systems; existing satellite mission software had kernel-level cybersecurity vulnerabilities that needed mitigation work; and a CNN-based machine-learning demo for software-defined radios needed to be brought up to a quality bar that could anchor a potential DARPA RFP.

**Approach.** Wrote low-level boot scripts for the memory subsystems, working against the constraints (radiation, certification, deterministic timing) that distinguish space-grade software from cloud-native code. Investigated the kernel-level vulnerabilities and designed mitigations against them. Debugged and upgraded the mission software applications across the satellite stack. On the ML side, refined the CNN demo on software-defined radios into a presentable artifact for the DARPA RFP context.

**Outcome.** Boot scripts integrated into the target hardware path. Vulnerability mitigations adopted into the mission software. SDR ML demo brought up to RFP-presentation quality and handed off to the team driving the proposal.
