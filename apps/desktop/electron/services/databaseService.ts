import { app } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import databaseSchema from '../database/schema.sql?raw'
import { createLogger, formatPathForLog } from '../utils/logger'

const logger = createLogger('art-pilot:database-service')

export class DatabaseService {
  private database: Database.Database | null = null

  getConnection() {
    if (!this.database) {
      // Electron 的 userData 目录会随应用名变化；数据库路径统一从运行时 app.getPath 计算。
      const databasePath = path.join(app.getPath('userData'), 'art-pilot.sqlite')
      mkdirSync(path.dirname(databasePath), { recursive: true })
      this.database = new Database(databasePath)
      // WAL 提升桌面应用读写并发稳定性；foreign_keys 确保图片记录始终归属任务。
      this.database.pragma('journal_mode = WAL')
      this.database.pragma('foreign_keys = ON')
      this.runMigrations(this.database)
      logger.info('opened database: path=%s', formatPathForLog(databasePath))
    }

    return this.database
  }

  transaction<T>(operation: () => T) {
    return this.getConnection().transaction(operation)()
  }

  close() {
    if (!this.database) {
      return
    }

    this.database.close()
    this.database = null
    logger.info('closed database')
  }

  private runMigrations(database: Database.Database) {
    // v1 采用幂等建表：开发环境和用户升级时重复启动不会破坏已有数据。
    database.exec(databaseSchema)
    this.ensureColumn(database, 'generation_tasks', 'references_json', 'TEXT')
    this.ensureColumn(database, 'generation_tasks', 'aspect_ratio', 'TEXT')
    this.ensureColumn(database, 'generation_tasks', 'generation_params', 'TEXT')
    this.ensureColumn(database, 'generated_images', 'favorite', 'INTEGER NOT NULL DEFAULT 0')
    logger.info('database schema ensured')
  }

  private ensureColumn(database: Database.Database, tableName: string, columnName: string, columnDefinition: string) {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>

    if (columns.some((column) => column.name === columnName)) {
      return
    }

    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`)
    logger.info('added database column: table=%s column=%s', tableName, columnName)
  }
}
