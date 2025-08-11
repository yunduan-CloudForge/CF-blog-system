import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ArticleList from "@/pages/ArticleList";
import ArticleDetail from "@/pages/ArticleDetail";
import ArticleEditor from "@/pages/ArticleEditor";
import ProtectedRoute, { GuestRoute } from "@/components/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        
        {/* 文章相关路由 */}
        <Route path="/articles" element={<ArticleList />} />
        <Route path="/articles/:id" element={<ArticleDetail />} />
        <Route path="/articles/new" element={<ProtectedRoute><ArticleEditor /></ProtectedRoute>} />
        <Route path="/articles/:id/edit" element={<ProtectedRoute><ArticleEditor /></ProtectedRoute>} />
        
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}
