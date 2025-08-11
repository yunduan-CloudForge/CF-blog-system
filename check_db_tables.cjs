const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'blog.db');
const db = new sqlite3.Database(dbPath);

console.log('检查数据库表结构...');

// 获取所有表名
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('获取表列表失败:', err);
    return;
  }
  
  console.log('\n现有表:');
  tables.forEach(table => {
    console.log('- ' + table.name);
  });
  
  // 检查权限相关表
  const requiredTables = ['permissions', 'role_permissions', 'admin_logs', 'system_settings'];
  const missingTables = requiredTables.filter(table => 
    !tables.some(t => t.name === table)
  );
  
  if (missingTables.length > 0) {
    console.log('\n缺失的表:');
    missingTables.forEach(table => {
      console.log('- ' + table);
    });
  } else {
    console.log('\n所有必需的表都存在');
  }
  
  // 检查permissions表的数据
  if (tables.some(t => t.name === 'permissions')) {
    db.all('SELECT COUNT(*) as count FROM permissions', [], (err, result) => {
      if (err) {
        console.error('检查permissions表失败:', err);
      } else {
        console.log(`\npermissions表中有 ${result[0].count} 条记录`);
      }
      
      // 检查role_permissions表的数据
      if (tables.some(t => t.name === 'role_permissions')) {
        db.all('SELECT COUNT(*) as count FROM role_permissions', [], (err, result) => {
          if (err) {
            console.error('检查role_permissions表失败:', err);
          } else {
            console.log(`role_permissions表中有 ${result[0].count} 条记录`);
          }
          db.close();
        });
      } else {
        db.close();
      }
    });
  } else {
    db.close();
  }
});