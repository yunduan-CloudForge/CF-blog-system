import express from 'express';
import { changePassword, resetPassword } from '../services/userService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validatePassword, generateSecurePassword } from '../services/passwordService.js';

const router = express.Router();

/**
 * @route POST /api/password/change
 * @desc 更改密码
 * @access Private
 */
router.post('/change', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请提供当前密码和新密码'
      });
    }
    
    await changePassword(userId, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: '密码更改成功'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '密码更改失败'
    });
  }
});

/**
 * @route POST /api/password/reset
 * @desc 重置用户密码（管理员功能）
 * @access Admin
 */
router.post('/reset', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const adminUserId = req.user!.userId;
    
    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请提供用户ID和新密码'
      });
    }
    
    await resetPassword(userId, newPassword, adminUserId);
    
    res.json({
      success: true,
      message: '密码重置成功'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '密码重置失败'
    });
  }
});

/**
 * @route POST /api/password/validate
 * @desc 验证密码强度
 * @access Public
 */
router.post('/validate', (req, res) => {
  try {
    const { password, userInfo } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: '请提供密码'
      });
    }
    
    const validation = validatePassword(password, userInfo);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Validate password error:', error);
    res.status(500).json({
      success: false,
      message: '密码验证失败'
    });
  }
});

/**
 * @route POST /api/password/generate
 * @desc 生成安全密码
 * @access Private
 */
router.post('/generate', authenticateToken, (req, res) => {
  try {
    const { length = 12 } = req.body;
    
    if (length < 8 || length > 128) {
      return res.status(400).json({
        success: false,
        message: '密码长度必须在8-128之间'
      });
    }
    
    const password = generateSecurePassword(length);
    const validation = validatePassword(password);
    
    res.json({
      success: true,
      data: {
        password,
        strength: validation.strength,
        isValid: validation.isValid
      }
    });
  } catch (error) {
    console.error('Generate password error:', error);
    res.status(500).json({
      success: false,
      message: '密码生成失败'
    });
  }
});

export default router;