import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne, execute } from '../database/database.js';
import { User, CreateUserData, LoginData, UserResponse } from '../models/User.js';
import { createSession, getDeviceFingerprint } from './sessionService.js';
import { 
  validatePassword, 
  hashPasswordWithSalt, 
  verifyPasswordWithSalt, 
  needsRehash 
} from './passwordService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // 短期access token
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // 长期refresh token

// 生成JWT令牌对
export const generateTokens = (userId: string): { accessToken: string; refreshToken: string } => {
  const accessToken = jwt.sign(
    { userId, type: 'access' }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' }, 
    JWT_REFRESH_SECRET, 
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
  
  return { accessToken, refreshToken };
};

// 生成JWT令牌（向后兼容）
export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

// 验证Access Token
export const verifyAccessToken = (token: string): { userId: string; type: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (decoded.type && decoded.type !== 'access') {
      return null; // 确保是access token
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

// 验证Refresh Token
export const verifyRefreshToken = (token: string): { userId: string; type: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string; type: string };
    if (decoded.type !== 'refresh') {
      return null; // 确保是refresh token
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

// 验证JWT令牌（向后兼容）
export const verifyToken = (token: string): { userId: string; type: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type?: string };
    return {
      userId: decoded.userId,
      type: decoded.type || 'access' // 默认为access类型以保持兼容性
    };
  } catch (error) {
    return null;
  }
};

// 哈希密码
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// 验证密码
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// 创建用户
export const createUser = async (userData: CreateUserData): Promise<UserResponse> => {
  const { email, password, name, role = 'reader' } = userData;
  
  // 检查邮箱是否已存在
  const existingUser = await queryOne<User>(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  
  if (existingUser) {
    throw new Error('邮箱已被注册');
  }
  
  // 验证密码复杂度
  const passwordValidation = validatePassword(password, { email, name });
  if (!passwordValidation.isValid) {
    throw new Error(`密码不符合安全要求: ${passwordValidation.errors.join(', ')}`);
  }
  
  // 使用增强的盐值加密密码
  const { hash: passwordHash, salt } = await hashPasswordWithSalt(password);
  
  // 插入用户
  const result = await execute(
    `INSERT INTO users (email, password_hash, salt, name, role, password_updated_at) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [email, passwordHash, salt, name, role]
  );
  
  // 获取创建的用户信息
  const newUser = await queryOne<User>(
    'SELECT * FROM users WHERE rowid = ?',
    [result.lastID]
  );
  
  if (!newUser) {
    throw new Error('用户创建失败');
  }
  
  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    avatar_url: newUser.avatar_url,
    bio: newUser.bio,
    role: newUser.role,
    created_at: newUser.created_at
  };
};

// 用户登录
export const loginUser = async (loginData: LoginData, deviceInfo?: { userAgent: string; ip: string }): Promise<{ user: UserResponse; accessToken: string; refreshToken: string; sessionToken: string }> => {
  const { email, password } = loginData;
  
  // 查找用户
  const user = await queryOne<User>(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  
  if (!user) {
    throw new Error('邮箱或密码错误');
  }
  
  // 验证密码
  let isValidPassword = false;
  
  if (user.salt) {
    // 使用新的盐值验证方法
    isValidPassword = await verifyPasswordWithSalt(password, user.password_hash, user.salt);
    
    // 检查是否需要重新哈希密码（升级安全性）
    if (isValidPassword && needsRehash(user.password_hash)) {
      const { hash: newPasswordHash, salt: newSalt } = await hashPasswordWithSalt(password);
      await execute(
        'UPDATE users SET password_hash = ?, salt = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, newSalt, user.id]
      );
      console.log(`用户 ${user.email} 的密码已升级到更高安全级别`);
    }
  } else {
    // 兼容旧的密码验证方法
    isValidPassword = await verifyPassword(password, user.password_hash);
    
    // 如果验证成功，升级到新的盐值加密方法
    if (isValidPassword) {
      const { hash: newPasswordHash, salt: newSalt } = await hashPasswordWithSalt(password);
      await execute(
        'UPDATE users SET password_hash = ?, salt = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, newSalt, user.id]
      );
      console.log(`用户 ${user.email} 的密码已升级到盐值加密`);
    }
  }
  
  if (!isValidPassword) {
    throw new Error('邮箱或密码错误');
  }
  
  // 生成JWT令牌对
  const { accessToken, refreshToken } = generateTokens(user.id);
  
  // 创建会话记录
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天
  const deviceFingerprint = deviceInfo ? getDeviceFingerprint(deviceInfo.userAgent, deviceInfo.ip) : undefined;
  
  const sessionToken = await createSession({
    userId: user.id,
    deviceInfo: deviceFingerprint,
    ipAddress: deviceInfo?.ip,
    userAgent: deviceInfo?.userAgent,
    expiresAt: sessionExpiresAt
  });
  
  // 记录登录信息
  if (deviceInfo) {
    console.log(`用户 ${user.email} 登录成功`, {
      userId: user.id,
      sessionToken: sessionToken.substring(0, 8) + '...',
      deviceFingerprint,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      timestamp: new Date().toISOString()
    });
  }
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      role: user.role,
      created_at: user.created_at
    },
    accessToken,
    refreshToken,
    sessionToken
  };
};

// 刷新令牌
export const refreshAccessToken = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> => {
  const decoded = verifyRefreshToken(refreshToken);
  
  if (!decoded) {
    return null;
  }
  
  // 验证用户是否仍然存在
  const user = await getUserById(decoded.userId);
  if (!user) {
    return null;
  }
  
  // 生成新的令牌对
  const tokens = generateTokens(decoded.userId);
  
  return tokens;
};

// 根据ID获取用户
export const getUserById = async (userId: string): Promise<UserResponse | null> => {
  const user = await queryOne<User>(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    return null;
  }
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    role: user.role,
    created_at: user.created_at
  };
};

// 更新用户信息
export const updateUser = async (userId: string, updateData: Partial<Pick<User, 'name' | 'avatar_url' | 'bio'>>): Promise<UserResponse> => {
  const { name, avatar_url, bio } = updateData;
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  
  if (avatar_url !== undefined) {
    updates.push('avatar_url = ?');
    values.push(avatar_url);
  }
  
  if (bio !== undefined) {
    updates.push('bio = ?');
    values.push(bio);
  }
  
  if (updates.length === 0) {
    throw new Error('没有提供更新数据');
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);
  
  await execute(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const updatedUser = await getUserById(userId);
  
  if (!updatedUser) {
    throw new Error('用户更新失败');
  }
  
  return updatedUser;
};

// 更改密码
export const changePassword = async (
  userId: string, 
  currentPassword: string, 
  newPassword: string
): Promise<void> => {
  // 获取用户信息
  const user = await queryOne<User>(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  // 验证当前密码
  let isCurrentPasswordValid = false;
  
  if (user.salt) {
    isCurrentPasswordValid = await verifyPasswordWithSalt(currentPassword, user.password_hash, user.salt);
  } else {
    isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash);
  }
  
  if (!isCurrentPasswordValid) {
    throw new Error('当前密码错误');
  }
  
  // 验证新密码复杂度
  const passwordValidation = validatePassword(newPassword, { 
    email: user.email, 
    name: user.name 
  });
  
  if (!passwordValidation.isValid) {
    throw new Error(`新密码不符合安全要求: ${passwordValidation.errors.join(', ')}`);
  }
  
  // 检查新密码是否与当前密码相同
  if (user.salt) {
    const isSamePassword = await verifyPasswordWithSalt(newPassword, user.password_hash, user.salt);
    if (isSamePassword) {
      throw new Error('新密码不能与当前密码相同');
    }
  } else {
    const isSamePassword = await verifyPassword(newPassword, user.password_hash);
    if (isSamePassword) {
      throw new Error('新密码不能与当前密码相同');
    }
  }
  
  // 使用增强的盐值加密新密码
  const { hash: newPasswordHash, salt: newSalt } = await hashPasswordWithSalt(newPassword);
  
  // 更新密码
  await execute(
    'UPDATE users SET password_hash = ?, salt = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPasswordHash, newSalt, userId]
  );
  
  console.log(`用户 ${user.email} 已成功更改密码`);
};

// 重置密码（管理员功能）
export const resetPassword = async (
  userId: string, 
  newPassword: string,
  adminUserId: string
): Promise<void> => {
  // 验证管理员权限
  const admin = await queryOne<User>(
    'SELECT role FROM users WHERE id = ?',
    [adminUserId]
  );
  
  if (!admin || admin.role !== 'admin') {
    throw new Error('权限不足');
  }
  
  // 获取目标用户信息
  const user = await queryOne<User>(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  // 验证新密码复杂度
  const passwordValidation = validatePassword(newPassword, { 
    email: user.email, 
    name: user.name 
  });
  
  if (!passwordValidation.isValid) {
    throw new Error(`新密码不符合安全要求: ${passwordValidation.errors.join(', ')}`);
  }
  
  // 使用增强的盐值加密新密码
  const { hash: newPasswordHash, salt: newSalt } = await hashPasswordWithSalt(newPassword);
  
  // 更新密码
  await execute(
    'UPDATE users SET password_hash = ?, salt = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPasswordHash, newSalt, userId]
  );
  
  console.log(`管理员 ${adminUserId} 已重置用户 ${user.email} 的密码`);
};