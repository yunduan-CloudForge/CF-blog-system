import { Link } from 'react-router-dom';
import { Shield, Home, ArrowLeft } from 'lucide-react';

export default function Forbidden() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* 403 Icon */}
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-red-100 mb-6">
            <Shield className="h-12 w-12 text-red-600" />
          </div>
          
          {/* Error Code */}
          <div className="text-6xl font-bold text-gray-300 mb-4">
            403
          </div>
          
          {/* Error Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            访问被拒绝
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            抱歉，您没有权限访问此页面。请联系管理员获取相应权限。
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Home className="h-5 w-5 mr-2" />
              返回首页
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              返回上页
            </button>
          </div>
          
          {/* Additional Information */}
          <div className="mt-12 text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Shield className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    权限说明
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      此页面需要特定的用户权限才能访问。如果您认为这是一个错误，
                      请联系系统管理员或尝试以下操作：
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>确认您已登录正确的账户</li>
                      <li>检查您的账户权限级别</li>
                      <li>联系管理员申请相应权限</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-sm text-gray-500">
              <p>
                需要帮助？请联系我们：
                <a href="mailto:admin@example.com" className="text-blue-600 hover:text-blue-800 ml-1">
                  admin@example.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}