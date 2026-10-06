import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Eye, FileText, Layers3, Loader, Trash2, X } from 'lucide-react';
import { API_URL } from '../config';
import './SlideDeckCard.css';

// A deck unfolds into a readable presentation stage. One bounded perspective
// reveal connects the cover to the slides; navigation stays immediate.
const SlideDeckCard = ({ slide, token, title, addedDate, analyzing, deletingId, onOpen, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [previewBounds, setPreviewBounds] = useState(null);
  const floatingRef = useRef(null);
  const [visited, setVisited] = useState(false);
  const [page, setPage] = useState(1);
  const [previousPage, setPreviousPage] = useState(null);
  const [direction, setDirection] = useState(1);
  const [imageStatus, setImageStatus] = useState('loading');
  const [coverFailed, setCoverFailed] = useState(false);
  const cardRef = useRef(null);
  const previewButtonRef = useRef(null);
  const hoverTimer = useRef(null);
  const hoverCooldown = useRef(0);
  const pointerInside = useRef(false);
  const pinned = useRef(false);
  const pageCount = Math.max(1, Number(slide.page_count) || 1);
  const previewId = `deck-preview-${slide.id}`;
  const busy = analyzing || deletingId === slide.id;
  const imageUrl = (number) => `${API_URL}/slide_image/${slide.id}/${number}?token=${encodeURIComponent(token)}`;

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Keep the last readable slide on screen until its replacement has loaded.
  // Cleanup also runs with reduced motion, where animationend never fires.
  useEffect(() => {
    if (imageStatus !== 'ready' || previousPage === null) return undefined;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timeout = setTimeout(() => setPreviousPage(null), reducedMotion ? 0 : 460);
    return () => clearTimeout(timeout);
  }, [imageStatus, previousPage, page]);

  const updatePreviewBounds = () => {
    const workspace = cardRef.current?.closest('.se-workspace');
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
    const viewportRight = viewportLeft + (viewport?.width || window.innerWidth);
    const gutter = window.innerWidth <= 500 ? 8 : 16;
    const left = Math.max(viewportLeft, rect.left) + gutter;
    const top = Math.max(viewportTop, rect.top) + gutter;
    const width = Math.max(0, Math.min(viewportRight, rect.right) - left - gutter);
    const height = Math.max(0, Math.min(viewportBottom, rect.bottom) - top - gutter);
    setPreviewBounds({ left, top, width, height });
  };

  useLayoutEffect(() => {
    if (!expanded) return undefined;
    updatePreviewBounds();
    const workspace = cardRef.current?.closest('.se-workspace');
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updatePreviewBounds) : null;
    if (workspace) observer?.observe(workspace);
    window.addEventListener('resize', updatePreviewBounds);
    window.visualViewport?.addEventListener('resize', updatePreviewBounds);
    window.visualViewport?.addEventListener('scroll', updatePreviewBounds);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePreviewBounds);
      window.visualViewport?.removeEventListener('resize', updatePreviewBounds);
      window.visualViewport?.removeEventListener('scroll', updatePreviewBounds);
    };
  }, [expanded]);

  const containsFocus = (target) => cardRef.current?.contains(target) || floatingRef.current?.contains(target);

  const openDeck = () => {
    if (!busy) onOpen();
  };

  const reveal = () => {
    clearTimeout(hoverTimer.current);
    updatePreviewBounds();
    setVisited(true);
    setExpanded(true);
  };

  const close = () => {
    clearTimeout(hoverTimer.current);
    pinned.current = false;
    hoverCooldown.current = Date.now() + 600;
    setExpanded(false);
  };

  const togglePreview = () => {
    if (expanded) close();
    else {
      pinned.current = true;
      reveal();
    }
  };

  const changePage = (nextPage) => {
    if (nextPage < 1 || nextPage > pageCount || nextPage === page) return;
    pinned.current = true;
    if (imageStatus === 'ready') setPreviousPage(page);
    setDirection(nextPage > page ? 1 : -1);
    setImageStatus('loading');
    setPage(nextPage);
  };

  const handleEnter = () => {
    if (Date.now() < hoverCooldown.current || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    pointerInside.current = true;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(reveal, 140);
  };

  const handleLeave = () => {
    pointerInside.current = false;
    clearTimeout(hoverTimer.current);
    if (!pinned.current && !containsFocus(document.activeElement)) {
      hoverTimer.current = setTimeout(close, 180);
    }
  };

  const preview = (
      <div
        ref={floatingRef}
        className={`se-deck-reveal se-floating-preview${expanded ? ' is-previewing' : ''}`}
        id={previewId}
        aria-hidden={!expanded}
        inert={!expanded ? '' : undefined}
        style={previewBounds ? { left: previewBounds.left, top: previewBounds.top, width: previewBounds.width, height: previewBounds.height, '--se-preview-height': `${previewBounds.height}px` } : undefined}
        onMouseEnter={() => { pointerInside.current = true; clearTimeout(hoverTimer.current); }}
        onMouseLeave={handleLeave}
      >
        <div className="se-deck-reveal-clip">
          <section className="se-preview-stage" aria-label={`Slide preview: ${title}`} onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                changePage(page + (event.key === 'ArrowRight' ? 1 : -1));
              }
            }}>
              <div className="se-preview-stage-header">
                <span title={title}><Layers3 size={14} /><strong>{title}</strong></span>
                <div className="se-preview-header-actions">
                  <button className="se-preview-study" type="button" onClick={openDeck} disabled={busy} tabIndex={expanded ? 0 : -1} aria-label={`Study ${title}`}>Study deck<ArrowUpRight size={14} /></button>
                  <button type="button" onClick={() => { close(); previewButtonRef.current?.focus(); }} aria-label={`Close preview: ${title}`} tabIndex={expanded ? 0 : -1}><X size={16} /></button>
                </div>
              </div>
              <div className="se-preview-paper-stack">
                <div className={`se-preview-screen${imageStatus === 'loading' ? ' is-loading' : ''}`} style={{ '--se-page-direction': direction }}>
                  {previousPage !== null && <img className={`se-preview-previous${imageStatus === 'ready' ? ' is-leaving' : ''}`} src={imageUrl(previousPage)} alt="" aria-hidden="true" />}
                  {imageStatus === 'loading' && previousPage === null && <div className="se-preview-status" role="status"><Loader size={24} className="se-spinner" /><span>Loading slide…</span></div>}
                  {imageStatus === 'error' ? (
                    <div className="se-preview-status"><FileText size={32} /><strong>Preview unavailable</strong><span>You can still open this deck to study.</span></div>
                  ) : visited ? (
                    <img key={page} src={imageUrl(page)} alt={`Slide ${page} of ${title}`} className={`se-preview-current${imageStatus === 'ready' ? ' is-ready' : ''}`} onLoad={() => setImageStatus('ready')} onError={() => { setImageStatus('error'); setPreviousPage(null); }} />
                  ) : null}
                </div>
              </div>
              <div className="se-preview-stage-footer">
                <span className="se-preview-page" aria-live="polite"><strong>{String(page).padStart(2, '0')}</strong><span>/ {String(pageCount).padStart(2, '0')}</span></span>
                <div className="se-preview-pager">
                  <button type="button" aria-label="Previous preview slide" onClick={() => changePage(page - 1)} disabled={page === 1} tabIndex={expanded ? 0 : -1}><ChevronLeft size={18} /></button>
                  <button type="button" aria-label="Next preview slide" onClick={() => changePage(page + 1)} disabled={page === pageCount} tabIndex={expanded ? 0 : -1}><ChevronRight size={18} /></button>
                </div>
              </div>
          </section>
        </div>
      </div>
  );


  return (
    <article
      ref={cardRef}
      className={`plx-card se-library-card se-deck-stage-card${expanded ? ' is-previewing' : ''}`}
      aria-label={title}
      onClick={(event) => {
        if (!event.target.closest('button, a, input, select, textarea, [role="button"]')) openDeck();
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onBlur={(event) => {
        if (!containsFocus(event.relatedTarget) && !pointerInside.current && !pinned.current) close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded) {
          event.preventDefault();
          close();
          previewButtonRef.current?.focus();
        }
      }}
    >
      <div className="plx-card-top">
        <button
          className="se-library-preview"
          type="button"
          aria-label={`Open presentation: ${title}`}
          disabled={busy}
          onClick={openDeck}
        >
          {coverFailed ? <FileText size={28} /> : <img src={imageUrl(1)} alt="" loading="lazy" onError={() => setCoverFailed(true)} />}
          <span className="se-cover-cue"><ArrowUpRight size={13} />Open deck</span>
        </button>
        <div className="plx-card-main">
          <div className="plx-card-badges"><span>{slide.filename?.split('.').pop()?.toUpperCase() || 'Presentation'}</span><span>Presentation</span></div>
          <h2><button className="se-deck-title" type="button" onClick={openDeck} disabled={busy}>{title}</button></h2>
          <p>{slide.filename}</p>
          <div className="se-preview-options">
            <span className="se-preview-hint">Hover to look inside · click to study</span>
            <button ref={previewButtonRef} className="se-preview-toggle" type="button" aria-label={`${expanded ? 'Hide' : 'Preview'} slides: ${title}`} aria-expanded={expanded} aria-controls={previewId} onClick={togglePreview}><Eye size={13} />{expanded ? 'Hide preview' : 'Preview'}</button>
          </div>
        </div>
        <ArrowUpRight className="plx-open-cue" size={17} aria-hidden="true" />
      </div>

      {visited && createPortal(preview, cardRef.current?.closest('.se-page') || document.body)}

      <div className="plx-card-data">
        <div><Layers3 size={13} /><strong>{slide.page_count || 0}</strong><span>slides</span></div>
        <div><BookOpen size={13} /><span>Slide-by-slide study</span></div>
      </div>
      <footer className="plx-card-footer">
        <div className="plx-creator"><div><small>Added</small><strong>{addedDate}</strong></div></div>
        <div className="plx-card-controls" aria-label={`Actions for ${title}`}>
          <button className="se-open-deck" type="button" onClick={openDeck} disabled={busy} aria-label={`Open deck: ${title}`}>Open deck<ArrowUpRight size={14} /></button>
          <button className="danger" type="button" title="Delete presentation" aria-label={`Delete ${title}`} onClick={onDelete} disabled={Boolean(deletingId) || analyzing}>
            {deletingId === slide.id ? <Loader className="se-spinner" size={14} /> : <Trash2 size={14} />}
          </button>
        </div>
      </footer>
    </article>
  );
};

export default SlideDeckCard;
