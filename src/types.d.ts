declare global {
  interface Window {
    /** reveal 脚本初始化成功标志（head 内的兜底逻辑依赖它） */
    __revealOk?: boolean;
  }
}

export {};
