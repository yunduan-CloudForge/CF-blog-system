# 博客系统API接口文档

## 1. 接口概述

### 1.1 基本信息
- **API版本**: v1.0
- **基础URL**: `http://localhost:3000/api`
- **数据格式**: JSON
- **字符编码**: UTF-8
- **请求方法**: GET, POST, PUT, DELETE

### 1.2 通用响应格式
```json
{
  "success": true,
  "message": "操作成功",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 1.3 错误响应格式
```json
{
  "success": false,
  "message": "错误描述",
  "error": {
    "code": "ERROR_CODE",
    "details": "详细错误信息"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 2. 鉴权说明

### 2.1 JWT认证
- 登录成功后，服务器返回JWT令牌
- 后续请求需在请求头中携带令牌：`Authorization: Bearer <token>`
- 令牌有效期：24小时
- 令牌过期后需重新登录

### 2.2 权限等级
| 权限等级 | 说明 | 可访问接口 |
|---------|------|----------|
| 游客 | 未登录用户 | 公开接口（文章列表、文章详情等） |
| 用户 | 注册用户 | 评论、点赞等基础功能 |
| 作者 | 博主 | 文章管理、评论管理等 |
| 管理员 | 系统管理员 | 所有接口 |

## 3. 错误码定义

### 3.1 通用错误码
| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| SUCCESS | 200 | 请求成功 |
| INVALID_PARAMS | 400 | 参数错误 |
| UNAUTHORIZED | 401 | 未授权 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

### 3.2 业务错误码
| 错误码 | 说明 |
|-------|------|
| USER_NOT_FOUND | 用户不存在 |
| EMAIL_EXISTS | 邮箱已存在 |
| INVALID_PASSWORD | 密码错误 |
| TOKEN_EXPIRED | 令牌已过期 |
| ARTICLE_NOT_FOUND | 文章不存在 |
| COMMENT_NOT_FOUND | 评论不存在 |
| PERMISSION_DENIED | 权限不足 |

## 4. 用户认证接口

### 4.1 用户注册

**接口地址**: `POST /api/auth/register`

**请求参数**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "用户名"
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| email | string | 是 | 邮箱地址，需符合邮箱格式 |
| password | string | 是 | 密码，至少8位，包含字母和数字 |
| username | string | 是 | 用户名，2-20个字符 |

**响应示例**:
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": "用户名",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "邮箱已存在",
  "error": {
    "code": "EMAIL_EXISTS",
    "details": "该邮箱已被注册"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4.2 用户登录

**接口地址**: `POST /api/auth/login`

**请求参数**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| email | string | 是 | 邮箱地址 |
| password | string | 是 | 密码 |

**响应示例**:
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": "用户名",
      "role": "user",
      "avatar": "http://example.com/avatar.jpg"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4.3 获取当前用户信息

**接口地址**: `GET /api/auth/me`

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "用户名",
    "role": "user",
    "avatar": "http://example.com/avatar.jpg",
    "bio": "个人简介",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4.4 更新用户信息

**接口地址**: `PUT /api/auth/profile`

**请求头**:
```
Authorization: Bearer <token>
```

**请求参数**:
```json
{
  "username": "新用户名",
  "bio": "新的个人简介",
  "avatar": "http://example.com/new-avatar.jpg"
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| username | string | 否 | 用户名，2-20个字符 |
| bio | string | 否 | 个人简介，最多200字符 |
| avatar | string | 否 | 头像URL |

**响应示例**:
```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "新用户名",
    "bio": "新的个人简介",
    "avatar": "http://example.com/new-avatar.jpg"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4.5 修改密码

**接口地址**: `PUT /api/auth/password`

**请求头**:
```
Authorization: Bearer <token>
```

**请求参数**:
```json
{
  "oldPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| oldPassword | string | 是 | 原密码 |
| newPassword | string | 是 | 新密码，至少8位，包含字母和数字 |

**响应示例**:
```json
{
  "success": true,
  "message": "密码修改成功",
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 5. 文章管理接口

### 5.1 获取文章列表

**接口地址**: `GET /api/articles`

**查询参数**:
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|------|-------|------|
| page | number | 否 | 1 | 页码 |
| limit | number | 否 | 10 | 每页数量，最大50 |
| category | string | 否 | - | 分类筛选 |
| tag | string | 否 | - | 标签筛选 |
| status | string | 否 | published | 状态筛选(draft/published/archived) |
| author | number | 否 | - | 作者ID筛选 |
| keyword | string | 否 | - | 关键词搜索 |
| sort | string | 否 | created_at | 排序字段(created_at/views/likes) |
| order | string | 否 | desc | 排序方向(asc/desc) |

**请求示例**:
```
GET /api/articles?page=1&limit=10&category=技术&sort=views&order=desc
```

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "articles": [
      {
        "id": 1,
        "title": "文章标题",
        "summary": "文章摘要",
        "author": {
          "id": 1,
          "username": "作者名",
          "avatar": "http://example.com/avatar.jpg"
        },
        "category": {
          "id": 1,
          "name": "技术"
        },
        "tags": [
          {
            "id": 1,
            "name": "JavaScript",
            "color": "#F7DF1E"
          }
        ],
        "status": "published",
        "views": 100,
        "likes": 5,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5.2 获取文章详情

**接口地址**: `GET /api/articles/:id`

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 文章ID |

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "id": 1,
    "title": "文章标题",
    "content": "# 文章内容\n\n这是文章的Markdown内容...",
    "summary": "文章摘要",
    "author": {
      "id": 1,
      "username": "作者名",
      "avatar": "http://example.com/avatar.jpg",
      "bio": "作者简介"
    },
    "category": {
      "id": 1,
      "name": "技术",
      "description": "技术相关文章"
    },
    "tags": [
      {
        "id": 1,
        "name": "JavaScript",
        "color": "#F7DF1E"
      }
    ],
    "status": "published",
    "views": 100,
    "likes": 5,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5.3 创建文章

**接口地址**: `POST /api/articles`

**请求头**:
```
Authorization: Bearer <token>
```

**请求参数**:
```json
{
  "title": "文章标题",
  "content": "# 文章内容\n\n这是文章的Markdown内容...",
  "summary": "文章摘要",
  "categoryId": 1,
  "tagIds": [1, 2, 3],
  "status": "draft"
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| title | string | 是 | 文章标题，1-100个字符 |
| content | string | 是 | 文章内容，Markdown格式 |
| summary | string | 否 | 文章摘要，最多200字符 |
| categoryId | number | 否 | 分类ID |
| tagIds | array | 否 | 标签ID数组 |
| status | string | 否 | 状态(draft/published)，默认draft |

**响应示例**:
```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 1,
    "title": "文章标题",
    "content": "# 文章内容\n\n这是文章的Markdown内容...",
    "summary": "文章摘要",
    "authorId": 1,
    "categoryId": 1,
    "status": "draft",
    "views": 0,
    "likes": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5.4 更新文章

**接口地址**: `PUT /api/articles/:id`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 文章ID |

**请求参数**:
```json
{
  "title": "更新的文章标题",
  "content": "# 更新的文章内容\n\n...",
  "summary": "更新的文章摘要",
  "categoryId": 2,
  "tagIds": [2, 3, 4],
  "status": "published"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "id": 1,
    "title": "更新的文章标题",
    "content": "# 更新的文章内容\n\n...",
    "summary": "更新的文章摘要",
    "authorId": 1,
    "categoryId": 2,
    "status": "published",
    "views": 100,
    "likes": 5,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 5.5 删除文章

**接口地址**: `DELETE /api/articles/:id`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 文章ID |

**响应示例**:
```json
{
  "success": true,
  "message": "删除成功",
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5.6 文章点赞

**接口地址**: `POST /api/articles/:id/like`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 文章ID |

**响应示例**:
```json
{
  "success": true,
  "message": "点赞成功",
  "data": {
    "liked": true,
    "likes": 6
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5.7 取消文章点赞

**接口地址**: `DELETE /api/articles/:id/like`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 文章ID |

**响应示例**:
```json
{
  "success": true,
  "message": "取消点赞成功",
  "data": {
    "liked": false,
    "likes": 5
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 6. 评论管理接口

### 6.1 获取文章评论

**接口地址**: `GET /api/articles/:id/comments`

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 文章ID |

**查询参数**:
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|------|-------|------|
| page | number | 否 | 1 | 页码 |
| limit | number | 否 | 20 | 每页数量 |
| sort | string | 否 | created_at | 排序字段(created_at/likes) |
| order | string | 否 | desc | 排序方向(asc/desc) |

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "comments": [
      {
        "id": 1,
        "content": "这是一条评论",
        "user": {
          "id": 1,
          "username": "用户名",
          "avatar": "http://example.com/avatar.jpg"
        },
        "parentId": null,
        "likes": 3,
        "replies": [
          {
            "id": 2,
            "content": "这是一条回复",
            "user": {
              "id": 2,
              "username": "回复者",
              "avatar": "http://example.com/avatar2.jpg"
            },
            "parentId": 1,
            "likes": 1,
            "replies": [],
            "createdAt": "2024-01-01T01:00:00.000Z",
            "updatedAt": "2024-01-01T01:00:00.000Z"
          }
        ],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6.2 发表评论

**接口地址**: `POST /api/articles/:id/comments`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 文章ID |

**请求参数**:
```json
{
  "content": "这是一条评论内容",
  "parentId": null
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| content | string | 是 | 评论内容，1-500个字符 |
| parentId | number | 否 | 父评论ID，用于回复 |

**响应示例**:
```json
{
  "success": true,
  "message": "评论成功",
  "data": {
    "id": 1,
    "content": "这是一条评论内容",
    "userId": 1,
    "articleId": 1,
    "parentId": null,
    "likes": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6.3 删除评论

**接口地址**: `DELETE /api/comments/:id`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 评论ID |

**响应示例**:
```json
{
  "success": true,
  "message": "删除成功",
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6.4 评论点赞

**接口地址**: `POST /api/comments/:id/like`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 评论ID |

**响应示例**:
```json
{
  "success": true,
  "message": "点赞成功",
  "data": {
    "liked": true,
    "likes": 4
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6.5 取消评论点赞

**接口地址**: `DELETE /api/comments/:id/like`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 评论ID |

**响应示例**:
```json
{
  "success": true,
  "message": "取消点赞成功",
  "data": {
    "liked": false,
    "likes": 3
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 7. 分类标签接口

### 7.1 获取分类列表

**接口地址**: `GET /api/categories`

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "技术",
      "description": "技术相关文章",
      "articleCount": 10,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "生活",
      "description": "生活感悟和日常",
      "articleCount": 5,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7.2 获取标签列表

**接口地址**: `GET /api/tags`

**查询参数**:
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|------|-------|------|
| popular | boolean | 否 | false | 是否只返回热门标签 |
| limit | number | 否 | 50 | 返回数量限制 |

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "JavaScript",
      "color": "#F7DF1E",
      "articleCount": 15,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "React",
      "color": "#61DAFB",
      "articleCount": 8,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7.3 创建分类

**接口地址**: `POST /api/categories`

**请求头**:
```
Authorization: Bearer <token>
```

**权限要求**: 管理员

**请求参数**:
```json
{
  "name": "新分类",
  "description": "分类描述"
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| name | string | 是 | 分类名称，1-50个字符，唯一 |
| description | string | 否 | 分类描述，最多200字符 |

**响应示例**:
```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 3,
    "name": "新分类",
    "description": "分类描述",
    "articleCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7.4 创建标签

**接口地址**: `POST /api/tags`

**请求头**:
```
Authorization: Bearer <token>
```

**权限要求**: 作者或管理员

**请求参数**:
```json
{
  "name": "新标签",
  "color": "#FF5733"
}
```

**参数说明**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| name | string | 是 | 标签名称，1-20个字符，唯一 |
| color | string | 否 | 标签颜色，十六进制格式，默认#3B82F6 |

**响应示例**:
```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 13,
    "name": "新标签",
    "color": "#FF5733",
    "articleCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 8. 文件上传接口

### 8.1 上传图片

**接口地址**: `POST /api/upload/image`

**请求头**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求参数**:
- **file**: 图片文件（form-data格式）

**文件限制**:
- 支持格式：jpg, jpeg, png, gif, webp
- 文件大小：最大5MB
- 图片尺寸：最大4096x4096像素

**响应示例**:
```json
{
  "success": true,
  "message": "上传成功",
  "data": {
    "url": "http://localhost:3000/uploads/images/1704067200000-abc123.jpg",
    "filename": "1704067200000-abc123.jpg",
    "originalName": "my-image.jpg",
    "size": 1024000,
    "mimeType": "image/jpeg"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 8.2 上传头像

**接口地址**: `POST /api/upload/avatar`

**请求头**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求参数**:
- **file**: 头像文件（form-data格式）

**文件限制**:
- 支持格式：jpg, jpeg, png
- 文件大小：最大2MB
- 图片尺寸：建议正方形，最大1024x1024像素

**响应示例**:
```json
{
  "success": true,
  "message": "头像上传成功",
  "data": {
    "url": "http://localhost:3000/uploads/avatars/1704067200000-user1.jpg",
    "filename": "1704067200000-user1.jpg",
    "originalName": "avatar.jpg",
    "size": 512000,
    "mimeType": "image/jpeg"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 9. 搜索接口

### 9.1 全文搜索

**接口地址**: `GET /api/search`

**查询参数**:
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|------|-------|------|
| q | string | 是 | - | 搜索关键词 |
| page | number | 否 | 1 | 页码 |
| limit | number | 否 | 10 | 每页数量 |
| type | string | 否 | all | 搜索类型(all/articles/users) |
| category | string | 否 | - | 分类筛选 |
| tag | string | 否 | - | 标签筛选 |

**请求示例**:
```
GET /api/search?q=JavaScript&type=articles&page=1&limit=10
```

**响应示例**:
```json
{
  "success": true,
  "message": "搜索成功",
  "data": {
    "results": [
      {
        "type": "article",
        "id": 1,
        "title": "JavaScript基础教程",
        "summary": "这是一篇关于JavaScript基础的文章...",
        "author": {
          "id": 1,
          "username": "作者名",
          "avatar": "http://example.com/avatar.jpg"
        },
        "category": {
          "id": 1,
          "name": "技术"
        },
        "tags": [
          {
            "id": 1,
            "name": "JavaScript",
            "color": "#F7DF1E"
          }
        ],
        "views": 100,
        "likes": 5,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "highlight": {
          "title": "<mark>JavaScript</mark>基础教程",
          "content": "这是一篇关于<mark>JavaScript</mark>基础的文章..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "searchTime": 0.05
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 10. 统计接口

### 10.1 获取网站统计

**接口地址**: `GET /api/stats/site`

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "totalArticles": 50,
    "totalUsers": 100,
    "totalComments": 200,
    "totalViews": 10000,
    "todayViews": 150,
    "todayArticles": 2,
    "todayUsers": 5
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 10.2 获取用户统计

**接口地址**: `GET /api/stats/user/:id`

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| id | number | 是 | 用户ID |

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "totalArticles": 10,
    "totalViews": 1000,
    "totalLikes": 50,
    "totalComments": 30,
    "publishedArticles": 8,
    "draftArticles": 2,
    "recentViews": [
      {
        "date": "2024-01-01",
        "views": 100
      },
      {
        "date": "2024-01-02",
        "views": 120
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 11. 接口测试用例

### 11.1 用户注册测试

**测试场景1：正常注册**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "username": "测试用户"
  }'
```

**预期结果**: 返回200状态码，包含用户信息和JWT令牌

**测试场景2：邮箱已存在**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@blog.com",
    "password": "password123",
    "username": "测试用户"
  }'
```

**预期结果**: 返回400状态码，错误码EMAIL_EXISTS

**测试场景3：密码格式错误**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "123",
    "username": "测试用户"
  }'
```

**预期结果**: 返回400状态码，参数验证错误

### 11.2 用户登录测试

**测试场景1：正常登录**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@blog.com",
    "password": "admin123"
  }'
```

**预期结果**: 返回200状态码，包含用户信息和JWT令牌

**测试场景2：密码错误**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@blog.com",
    "password": "wrongpassword"
  }'
```

**预期结果**: 返回401状态码，错误码INVALID_PASSWORD

### 11.3 文章创建测试

**测试场景1：正常创建文章**
```bash
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "测试文章",
    "content": "# 测试文章\n\n这是一篇测试文章的内容。",
    "summary": "测试文章摘要",
    "categoryId": 1,
    "tagIds": [1, 2],
    "status": "published"
  }'
```

**预期结果**: 返回201状态码，包含创建的文章信息

**测试场景2：未授权创建**
```bash
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试文章",
    "content": "# 测试文章\n\n这是一篇测试文章的内容。"
  }'
```

**预期结果**: 返回401状态码，错误码UNAUTHORIZED

### 11.4 评论发表测试

**测试场景1：正常发表评论**
```bash
curl -X POST http://localhost:3000/api/articles/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "content": "这是一条测试评论"
  }'
```

**预期结果**: 返回201状态码，包含创建的评论信息

**测试场景2：回复评论**
```bash
curl -X POST http://localhost:3000/api/articles/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "content": "这是一条回复",
    "parentId": 1
  }'
```

**预期结果**: 返回201状态码，包含回复的评论信息

### 11.5 文件上传测试

**测试场景1：正常上传图片**
```bash
curl -X POST http://localhost:3000/api/upload/image \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/image.jpg"
```

**预期结果**: 返回200状态码，包含上传的文件信息

**测试场景2：文件格式错误**
```bash
curl -X POST http://localhost:3000/api/upload/image \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf"
```

**预期结果**: 返回400状态码，文件格式不支持错误

## 12. 接口调用示例

### 12.1 JavaScript/TypeScript示例

```typescript
// API客户端封装
class BlogAPI {
  private baseURL = 'http://localhost:3000/api';
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }

    return data;
  }

  // 用户认证
  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.data.token);
    return data;
  }

  async register(email: string, password: string, username: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    });
  }

  // 文章管理
  async getArticles(params: {
    page?: number;
    limit?: number;
    category?: string;
    tag?: string;
  } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/articles?${query}`);
  }

  async getArticle(id: number) {
    return this.request(`/articles/${id}`);
  }

  async createArticle(article: {
    title: string;
    content: string;
    summary?: string;
    categoryId?: number;
    tagIds?: number[];
    status?: string;
  }) {
    return this.request('/articles', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  }

  // 评论管理
  async getComments(articleId: number, page = 1, limit = 20) {
    return this.request(`/articles/${articleId}/comments?page=${page}&limit=${limit}`);
  }

  async createComment(articleId: number, content: string, parentId?: number) {
    return this.request(`/articles/${articleId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    });
  }

  // 文件上传
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/upload/image', {
      method: 'POST',
      headers: {
        // 不设置Content-Type，让浏览器自动设置
      },
      body: formData,
    });
  }
}

// 使用示例
const api = new BlogAPI();

// 登录
try {
  const loginResult = await api.login('admin@blog.com', 'admin123');
  console.log('登录成功:', loginResult.data.user);
} catch (error) {
  console.error('登录失败:', error.message);
}

// 获取文章列表
try {
  const articles = await api.getArticles({ page: 1, limit: 10 });
  console.log('文章列表:', articles.data.articles);
} catch (error) {
  console.error('获取文章失败:', error.message);
}

// 创建文章
try {
  const newArticle = await api.createArticle({
    title: '我的第一篇文章',
    content: '# 标题\n\n这是文章内容...',
    summary: '文章摘要',
    categoryId: 1,
    tagIds: [1, 2],
    status: 'published'
  });
  console.log('文章创建成功:', newArticle.data);
} catch (error) {
  console.error('创建文章失败:', error.message);
}
```

### 12.2 Python示例

```python
import requests
import json
from typing import Optional, Dict, Any

class BlogAPI:
    def __init__(self, base_url: str = 'http://localhost:3000/api'):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.session = requests.Session()
    
    def set_token(self, token: str):
        self.token = token
        self.session.headers.update({'Authorization': f'Bearer {token}'})
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[Any, Any]:
        url = f'{self.base_url}{endpoint}'
        response = self.session.request(method, url, **kwargs)
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            raise Exception('响应格式错误')
        
        if not response.ok:
            raise Exception(data.get('message', '请求失败'))
        
        return data
    
    # 用户认证
    def login(self, email: str, password: str) -> Dict[Any, Any]:
        data = self._request('POST', '/auth/login', json={
            'email': email,
            'password': password
        })
        self.set_token(data['data']['token'])
        return data
    
    def register(self, email: str, password: str, username: str) -> Dict[Any, Any]:
        return self._request('POST', '/auth/register', json={
            'email': email,
            'password': password,
            'username': username
        })
    
    # 文章管理
    def get_articles(self, **params) -> Dict[Any, Any]:
        return self._request('GET', '/articles', params=params)
    
    def get_article(self, article_id: int) -> Dict[Any, Any]:
        return self._request('GET', f'/articles/{article_id}')
    
    def create_article(self, **article_data) -> Dict[Any, Any]:
        return self._request('POST', '/articles', json=article_data)
    
    # 评论管理
    def get_comments(self, article_id: int, page: int = 1, limit: int = 20) -> Dict[Any, Any]:
        return self._request('GET', f'/articles/{article_id}/comments', params={
            'page': page,
            'limit': limit
        })
    
    def create_comment(self, article_id: int, content: str, parent_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._request('POST', f'/articles/{article_id}/comments', json={
            'content': content,
            'parentId': parent_id
        })

# 使用示例
api = BlogAPI()

# 登录
try:
    login_result = api.login('admin@blog.com', 'admin123')
    print('登录成功:', login_result['data']['user'])
except Exception as e:
    print('登录失败:', str(e))

# 获取文章列表
try:
    articles = api.get_articles(page=1, limit=10)
    print('文章列表:', articles['data']['articles'])
except Exception as e:
    print('获取文章失败:', str(e))

# 创建文章
try:
    new_article = api.create_article(
        title='我的第一篇文章',
        content='# 标题\n\n这是文章内容...',
        summary='文章摘要',
        categoryId=1,
        tagIds=[1, 2],
        status='published'
    )
    print('文章创建成功:', new_article['data'])
except Exception as e:
    print('创建文章失败:', str(e))
```

## 13. 接口变更日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 实现用户认证、文章管理、评论系统基础功能
- 支持文件上传和搜索功能
- 提供完整的API文档和测试用例

### 后续版本规划
- v1.1.0: 增加文章收藏功能
- v1.2.0: 增加用户关注功能
- v1.3.0: 增加消息通知功能
- v2.0.0: 支持多媒体内容和富文本编辑

---

**文档维护**: 本文档将随着API的更新而持续维护，请关注版本变更日志。
**技术支持**: 如有疑问，请联系开发团队或查看项目GitHub仓库。