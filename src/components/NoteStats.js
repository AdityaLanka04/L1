import { FileText, Clock, Hash, Eye } from 'lucide-react';
import './NoteStats.css';

const NoteStats = ({ blocks }) => {
  const getWordCount = () => {
    return blocks.reduce((count, block) => {
      const text = block.content?.replace(/<[^>]*>/g, '') || '';
      return count + text.split(/\s+/).filter(w => w.length > 0).length;
    }, 0);
  };
  
  const getReadingTime = () => {
    const words = getWordCount();
    const minutes = Math.ceil(words / 200);
    return minutes || 1;
  };
  
  const getCharCount = () => {
    return blocks.reduce((count, block) => {
      const text = block.content?.replace(/<[^>]*>/g, '') || '';
      return count + text.length;
    }, 0);
  };

  return (
    <div className="note-stats-bar">
      <div className="stat-item">
        <FileText size={14} />
        <span>{blocks.length} blocks</span>
      </div>
      <div className="stat-item">
        <Hash size={14} />
        <span>{getWordCount()} words</span>
      </div>
      <div className="stat-item">
        <Eye size={14} />
        <span>{getCharCount()} characters</span>
      </div>
      <div className="stat-item">
        <Clock size={14} />
        <span>{getReadingTime()} min read</span>
      </div>
    </div>
  );
};

export default NoteStats;
