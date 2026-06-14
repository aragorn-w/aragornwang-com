---
company: 'Ricoh USA'
role: 'Deep Learning Research Intern'
location: 'Boulder, CO'
start: 2025-05-01
end: 2025-06-30
order: 4
tags:
  - 'NVIDIA Cosmos'
  - 'Isaac Sim'
  - 'OpenUSD'
  - 'YOLOv11'
  - 'PyTorch'
  - 'Synthetic Data'
  - 'Industrial Robotics'
---

Five-week summer field session, end-to-end build on a synthetic-data pipeline for industrial robotic arms (CSCI 370 capstone, four-person team). Ricoh's robotics group needed labeled training data at scale for paper-stack detection on a Universal Robots Cobot arm in a print-shop assembly cell, and physical capture wouldn't get there. The work was end-to-end: photorealistic scene simulation, diffusion-based scene generation, and a YOLOv11 detector trained on the synthetic output and demonstrated on the target inference hardware.

- Architected and developed a synthetic dataset generation pipeline from scratch for deployment on robotic arms
- Developed simulations of a physical warehouse assembly environment for seeding diffusion foundation models
- Trained a modified YOLOv11 object detector for a Universal Robots 20 6-DOF industrial robotic arm
- Administered Google Cloud VMs with NVIDIA H100 GPUs to generate +10K auto-labeled synthetic images
- Special tools: NVIDIA Cosmos, Omniverse Kit, Isaac Sim, OpenUSD, YOLO, PyTorch, OpenCV, Docker, Git
