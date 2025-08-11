const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'blog.db');
const db = new sqlite3.Database(dbPath);

console.log('修复admin_logs表结构...');

// 检查admin_logs表结构
db.all("PRAGMA table_info(admin_logs)", [], (err, columns) => {
  if (err) {
    console.error('获取表结构失败:', err);
    return;
  }
  
  console.log('当前admin_logs表结构:');
  columns.forEach(col => {
    console.log(`- ${col.name}: ${col.type}`);
  });
  
  // 检查是否有level列
  const hasLevelColumn = columns.some(col => col.name === 'level');
  
  if (!hasLevelColumn) {
    console.log('\n添加level列...');
    db.run("ALTER TABLE admin_logs ADD COLUMN level VARCHAR(20) DEFAULT 'info'", (err) => {
      if (err) {
        console.error('添加level列失败:', err);
      } else {
        console.log('level列添加成功');
      }
      
      // 检查是否有days列（如果日志查询需要）
      const hasDaysColumn = columns.some(col => col.name === 'days');
      if (!hasDaysColumn) {
        console.log('\n注意: 如果需要days列，请手动添加');
      }
      
      db.close();
    });
  } else {
    console.log('\nlevel列已存在');
    db.close();
  }
});