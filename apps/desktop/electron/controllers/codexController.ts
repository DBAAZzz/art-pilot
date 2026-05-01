import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { Controller } from './baseController'
import type { CodexService } from '../services/codexService'

export class CodexController implements Controller {
  constructor(private readonly codexService: CodexService) {}

  register() {
    // Codex 环境检测属于只读系统信息查询，不启动任何 Codex 任务。
    ipcMain.handle(IPC_CHANNELS.codex.detectEnvironment, () => {
      return this.codexService.detectEnvironment()
    })
    // 读取本地 Codex session/usage 统计，用于设置页展示额度和用量。
    ipcMain.handle(IPC_CHANNELS.codex.readUsage, () => {
      return this.codexService.readUsage()
    })
  }
}
