---
name: MPU6050 DMP Portable
description: 基于 InvenSense DMP 固件的可移植姿态传感器驱动，直接输出 Pitch、Roll 与 Yaw。
repo: https://github.com/Ember1414/MPU6050-DMP-Portable
tags: [Embedded, C, I2C]
year: 2026
order: 2
lang: zh
featured: true
status: 开源维护中
role: 驱动封装与移植
highlights:
  - 通过 4 个 port 函数隔离平台差异
  - 使用 DMP 完成姿态解算并输出欧拉角
  - 包含自动校准与 STM32 HAL 参考实现
---

驱动把 DMP 初始化、FIFO 读取和姿态解算封装为紧凑的公共 API，并保留安装方向和采样参数的配置入口。
