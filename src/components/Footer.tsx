export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 网站信息 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">博客系统</h3>
            <p className="text-gray-300 text-sm">
              一个现代化的博客平台，支持文章发布、分类管理、用户评论等功能。
            </p>
          </div>
          
          {/* 快速链接 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="text-gray-300 hover:text-white transition-colors">
                  首页
                </a>
              </li>
              <li>
                <a href="/about" className="text-gray-300 hover:text-white transition-colors">
                  关于我们
                </a>
              </li>
              <li>
                <a href="/contact" className="text-gray-300 hover:text-white transition-colors">
                  联系我们
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-gray-300 hover:text-white transition-colors">
                  隐私政策
                </a>
              </li>
            </ul>
          </div>
          
          {/* 联系信息 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">联系我们</h3>
            <div className="text-sm text-gray-300 space-y-2">
              <p>邮箱: contact@blog.com</p>
              <p>电话: +86 123 4567 8900</p>
              <p>地址: 北京市朝阳区某某街道123号</p>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-sm text-gray-300">
            &copy; {new Date().getFullYear()} 博客系统. 保留所有权利.
          </p>
        </div>
      </div>
    </footer>
  );
}