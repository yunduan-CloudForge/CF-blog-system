import { Request, Response, Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getUserSessions, terminateSession, terminateAllUserSessions } from '../services/sessionService.js';

const router = Router();

/**
 * 获取用户的所有活跃会话
 * GET /api/sessions
 */
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const sessions = await getUserSessions(userId);
    
    // 隐藏敏感信息，只返回必要的会话信息
    const safeSessions = sessions.map(session => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      isCurrent: session.sessionToken === req.cookies.sessionToken
    }));
    
    res.json({
      success: true,
      data: {
        sessions: safeSessions,
        total: safeSessions.length
      }
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取会话列表失败'
    });
  }
});

/**
 * 终止指定会话
 * DELETE /api/sessions/:sessionId
 */
router.delete('/:sessionId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { sessionId } = req.params;
    
    // 首先验证会话是否属于当前用户
    const userSessions = await getUserSessions(userId);
    const targetSession = userSessions.find(session => session.id.toString() === sessionId);
    
    if (!targetSession) {
      res.status(404).json({
        success: false,
        error: '会话不存在或无权限访问'
      });
      return;
    }
    
    // 终止会话
    const success = await terminateSession(targetSession.sessionToken);
    
    if (success) {
      res.json({
        success: true,
        message: '会话已终止'
      });
    } else {
      res.status(500).json({
        success: false,
        error: '终止会话失败'
      });
    }
  } catch (error) {
    console.error('终止会话失败:', error);
    res.status(500).json({
      success: false,
      error: '终止会话失败'
    });
  }
});

/**
 * 终止所有其他会话（保留当前会话）
 * DELETE /api/sessions/others
 */
router.delete('/others/all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const currentSessionToken = req.cookies.sessionToken;
    
    const terminatedCount = await terminateAllUserSessions(userId, currentSessionToken);
    
    res.json({
      success: true,
      message: `已终止 ${terminatedCount} 个其他会话`,
      data: {
        terminatedCount
      }
    });
  } catch (error) {
    console.error('终止其他会话失败:', error);
    res.status(500).json({
      success: false,
      error: '终止其他会话失败'
    });
  }
});

/**
 * 终止所有会话（包括当前会话）
 * DELETE /api/sessions/all
 */
router.delete('/all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    
    const terminatedCount = await terminateAllUserSessions(userId);
    
    // 清除当前会话的cookies
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({
      success: true,
      message: `已终止所有 ${terminatedCount} 个会话，请重新登录`,
      data: {
        terminatedCount
      }
    });
  } catch (error) {
    console.error('终止所有会话失败:', error);
    res.status(500).json({
      success: false,
      error: '终止所有会话失败'
    });
  }
});

export default router;