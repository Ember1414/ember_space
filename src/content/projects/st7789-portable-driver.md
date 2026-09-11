---
name: ST7789 Portable Driver
description: 面向 240×320 RGB565 SPI 彩屏的可移植纯 C 驱动，用少量硬件接口适配不同 MCU。
repo: https://github.com/Ember1414/ST7789-Portable-Driver
tags: [Embedded, C, SPI]
year: 2026
order: 1
lang: zh
featured: true
status: 开源维护中
role: 驱动设计与实现
highlights:
  - 通过 6 个 port 函数隔离 MCU 与 HAL 依赖
  - 支持 DMA 传输、四方向旋转和完整绘图 API
  - 提供 STM32 HAL 参考实现与中英文字库
---

项目将屏幕控制逻辑与 MCU 硬件访问拆开。移植到新平台时，只需实现延时、SPI 发送和 GPIO 控制接口，不需要修改驱动主体。
