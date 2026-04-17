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

Two-month focused build on a synthetic-data pipeline for industrial robotic arms. Ricoh's robotics team needed labeled training data at scale for object detection on a Universal Robots arm, and physical capture wouldn't get there. The work was end-to-end: photorealistic warehouse simulation, diffusion-based scene generation, and a YOLOv11 detector trained on the synthetic output and deployable on the actual hardware.

- Architected and developed a synthetic dataset generation pipeline from scratch for deployment on robotic arms
- Developed simulations of a physical warehouse assembly environment for seeding diffusion foundation models
- Trained a modified YOLOv11 object detector for a Universal Robots 20 6-DOF industrial robotic arm
- Administered Google Cloud VMs with NVIDIA H100 GPUs to generate +10K auto-labeled synthetic images
- Special tools: NVIDIA Cosmos, Omniverse Kit, Isaac Sim, OpenUSD, YOLO, PyTorch, OpenCV, Docker, Git
