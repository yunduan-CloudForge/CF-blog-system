import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建数据库连接
const DB_PATH = path.join(__dirname, '..', 'data', 'blog.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// 读取并执行SQL迁移文件
const applyMigration = async (migrationFile) => {
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    // 分割SQL语句（以分号分隔）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`开始执行迁移: ${migrationFile}`);
    console.log(`共 ${statements.length} 条SQL语句`);
    
    // 执行每条SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await new Promise((resolve, reject) => {
            db.run(statement, (err) => {
              if (err) {
                console.error(`执行第 ${i + 1} 条语句时出错:`, err.message);
                console.error('语句内容:', statement.substring(0, 100) + '...');
                reject(err);
              } else {
                console.log(`✓ 第 ${i + 1} 条语句执行成功`);
                resolve();
              }
            });
          });
        } catch (error) {
          console.error(`语句执行失败: ${error.message}`);
          // 继续执行其他语句
        }
      }
    }
    
    console.log(`迁移 ${migrationFile} 执行完成!`);
    
  } catch (error) {
    console.error('迁移执行失败:', error.message);
    throw error;
  }
};

// 执行索引优化迁移
const main = async () => {
  try {
    await applyMigration('database_index_optimization.sql');
    
    // 验证索引创建情况
    console.log('\n验证索引创建情况:');
    
    const indexes = await new Promise((resolve, reject) => {
      db.all(`
        SELECT name, tbl_name, sql 
        FROM sqlite_master 
        WHERE type = 'index' 
        AND name LIKE 'idx_%'
        ORDER BY tbl_name, name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('\n已创建的索引:');
    indexes.forEach(index => {
      console.log(`- ${index.name} (表: ${index.tbl_name})`);
    });
    
    // 验证视图创建情况
    const views = await new Promise((resolve, reject) => {
      db.all(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type = 'view'
        ORDER BY name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('\n已创建的视图:');
    views.forEach(view => {
      console.log(`- ${view.name}`);
    });
    
    console.log('\n数据库索引优化完成!');
    
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    db.close((err) => {
      if (err) {
        console.error('关闭数据库连接失败:', err.message);
      } else {
        console.log('数据库连接已关闭');
      }
      process.exit(0);
    });
  }
};

main();