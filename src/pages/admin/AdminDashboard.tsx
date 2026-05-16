import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Calendar, Loader2, LogOut, Newspaper } from 'lucide-react';
import { toast } from 'sonner';
import Masthead from '@/components/Masthead';
import { Document, Page } from 'react-pdf';

export default function AdminDashboard() {
  const [newspapers, setNewspapers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { logout, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchNewspapers();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
    toast.success('Logged out');
  };

  const fetchNewspapers = async () => {
    try {
      const res = await fetch('/api/admin/newspapers', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        navigate('/admin/login');
        throw new Error(data.error || 'Session expired. Please login again');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load newspapers');
      if (!Array.isArray(data)) throw new Error('Invalid newspapers response');
      setNewspapers(data);
    } catch (error) {
      toast.error('Failed to load newspapers');
      setNewspapers([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <Masthead />
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col items-center mb-6 md:mb-12 border-b border-zinc-200 pb-6 md:pb-8">
          <div className="mt-2 md:mt-4 text-xs md:text-sm text-zinc-500 font-medium uppercase tracking-widest text-center">ನಿರ್ವಾಹಕ ನಿಯಂತ್ರಣ ಫಲಕ</div>
        </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-6 text-center sm:text-left">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-zinc-900 truncate">ನಿರ್ವಾಹಕ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್</h1>
          <p className="text-sm md:text-base text-zinc-500 mt-1">ನಿಮ್ಮ ಪ್ರಕಟಣೆಗಳನ್ನು ನಿರ್ವಹಿಸಿ</p>
        </div>
        <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
          <button 
            onClick={handleLogout}
            className="flex-1 sm:flex-none bg-white border border-zinc-200 text-zinc-600 px-3 md:px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors text-sm md:text-base font-medium"
          >
            <LogOut size={18} className="md:w-5 md:h-5" />
            <span>ಲಾಗ್ ಔಟ್</span>
          </button>
          <Link 
            to="/admin/upload" 
            className="flex-1 sm:flex-none bg-zinc-900 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors text-sm md:text-base font-medium"
          >
            <Plus size={18} className="md:w-5 md:h-5" />
            <span>ಹೊಸ ಪ್ರಕಟಣೆ</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-zinc-400" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {newspapers.map((paper) => (
            <div key={paper.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-[16/10] bg-zinc-100 flex items-center justify-center border-b border-zinc-100 relative overflow-hidden">
                <Document
                  file={paper.pdf_path}
                  loading={
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
                      <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
                    </div>
                  }
                  error={
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-400">
                      <Newspaper size={32} strokeWidth={1} />
                    </div>
                  }
                >
                  <Page
                    pageNumber={1}
                    width={300}
                    scale={1}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="w-full grayscale hover:grayscale-0 transition-all duration-500"
                  />
                </Document>
                <div className="absolute top-2 right-2 z-10">
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                    paper.status === 'published' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  }`}>
                    {paper.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="font-serif font-bold text-base mb-0.5 truncate">{paper.title}</h3>
                <div className="flex items-center text-zinc-500 text-[10px] mb-2">
                  <Calendar size={12} className="mr-1" />
                  {new Date(paper.publication_date).toLocaleDateString('en-IN')}
                </div>
                <Link 
                  to={`/admin/map/${paper.id}`}
                  className="block w-full bg-zinc-900 text-white text-center py-1.5 rounded-lg text-[10px] font-medium hover:bg-zinc-800 transition-colors"
                >
                  Edit / Map
                </Link>
              </div>
            </div>
          ))}
          
          {newspapers.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-zinc-300">
              <p className="text-zinc-500 mb-4">ಯಾವುದೇ ಪತ್ರಿಕೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ</p>
              <Link 
                to="/admin/upload" 
                className="text-zinc-900 font-medium hover:underline"
              >
                ನಿಮ್ಮ ಮೊದಲ ಪತ್ರಿಕೆಯನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
}
