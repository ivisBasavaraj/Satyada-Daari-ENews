import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Calendar, ArrowRight, Newspaper, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import Masthead from '@/components/Masthead';
import { Document, Page } from 'react-pdf';
import { listPublishedNewspapers, type NewspaperSummary } from '@/lib/staticArchive';

export default function UserDashboard() {
  const [newspapers, setNewspapers] = useState<NewspaperSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNewspapers();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
    toast.success('Logged out');
  };

  const fetchNewspapers = async () => {
    try {
      const data = await listPublishedNewspapers();
      setNewspapers(data);
    } catch (error) {
      console.error('Error fetching newspapers:', error);
      toast.error('Failed to load newspapers');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <Masthead />
      <header className="bg-white border-b border-zinc-200 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <div className="text-sm text-zinc-500 font-medium mt-2 uppercase tracking-widest">ಡಿಜಿಟಲ್ ಆರ್ಕೈವ್</div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-zinc-500 hover:text-zinc-900 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <LogOut size={18} />
            ಸೈನ್ ಔಟ್
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-serif font-bold mb-8 flex items-center gap-2">
          <Calendar className="text-zinc-400" />
          ಇತ್ತೀಚಿನ ಆವೃತ್ತಿಗಳು
        </h2>

        {isLoading ? (
          <div className="text-center py-12 text-zinc-400">ಆರ್ಕೈವ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {newspapers.map((paper) => (
              <Link 
                key={paper.id} 
                to={`/read/${paper.id}`}
                className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-zinc-100 block"
              >
                <div className="aspect-[3/4] bg-zinc-100 relative overflow-hidden">
                  <Document
                    file={paper.pdf_path}
                    loading={
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 text-zinc-400">
                        <Newspaper size={64} strokeWidth={1} />
                      </div>
                    }
                    error={
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 text-zinc-400">
                        <Newspaper size={64} strokeWidth={1} />
                      </div>
                    }
                    noData={
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 text-zinc-400">
                        <Newspaper size={64} strokeWidth={1} />
                      </div>
                    }
                  >
                    <Page
                      pageNumber={1}
                      width={420}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="w-full"
                    />
                  </Document>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                </div>
                
                <div className="p-6">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    {new Date(paper.publication_date).toLocaleDateString('kn-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <h3 className="font-serif font-bold text-2xl mb-3 group-hover:text-zinc-700 transition-colors">
                    {paper.title}
                  </h3>
                  <div className="flex items-center text-zinc-900 font-medium text-sm mt-4 group-hover:translate-x-1 transition-transform">
                    ಆವೃತ್ತಿಯನ್ನು ಓದಿ <ArrowRight size={16} className="ml-2" />
                  </div>
                </div>
              </Link>
            ))}
            
            {newspapers.length === 0 && (
              <div className="col-span-full text-center py-20">
                <p className="text-zinc-500 text-lg">ಇನ್ನೂ ಯಾವುದೇ ಆವೃತ್ತಿಗಳನ್ನು ಪ್ರಕಟಿಸಲಾಗಿಲ್ಲ.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
