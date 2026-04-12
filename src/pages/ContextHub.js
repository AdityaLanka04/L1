import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, Globe, Plus, ChevronRight, ChevronLeft, FileText, Upload,
  Lock, Unlock, Trash2, Search, Star, Users, GraduationCap,
  X, AlertCircle, Loader2, Home, CheckCircle, Shield, TrendingUp,
  BookMarked, RefreshCw, Grid, List as ListIcon, Info, Layers,
  BookCopy, Sparkles, Library, FolderOpen, Calculator, PenLine,
  Dna, FlaskConical, Zap, Microscope, Landmark, Code2, BarChart2,
  Palette, Wrench, Dumbbell, Music, Tv, Brain, Scale, Hash,
  Triangle, Heart, Film, Leaf, Mic2, Languages, Building2, Sun,
  MessageCircle, Globe2, Sigma, Clock, Menu, Send,
  Tag, ArrowRight
} from 'lucide-react';
import contextService from '../services/contextService';
import './ContextHub.css';

// ─── FLAG SVG COMPONENTS ──────────────────────────────────────────────────────

const FlagUK = ({ size = 28 }) => (
  <svg
    width={size}
    height={Math.round(size * 0.6)}
    viewBox="0 0 60 40"
    xmlns="http://www.w3.org/2000/svg"
    style={{ borderRadius: 3, flexShrink: 0, display: 'block' }}
  >
    <rect width="60" height="40" fill="#012169" />
    <path d="M0,0 L60,40 M60,0 L0,40" stroke="white" strokeWidth="8" />
    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="5" />
    <rect x="24" y="0" width="12" height="40" fill="white" />
    <rect x="0" y="14" width="60" height="12" fill="white" />
    <rect x="26" y="0" width="8" height="40" fill="#C8102E" />
    <rect x="0" y="16" width="60" height="8" fill="#C8102E" />
  </svg>
);

const FlagUS = ({ size = 28 }) => {
  const h = Math.round(size * 0.6);
  const sw = size;
  const sh = h;
  const stripeH = sh / 13;
  return (
    <svg
      width={sw}
      height={sh}
      viewBox={`0 0 ${sw} ${sh}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: 3, flexShrink: 0, display: 'block' }}
    >
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x="0" y={i * stripeH} width={sw} height={stripeH}
          fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'} />
      ))}
      <rect x="0" y="0" width={sw * 0.4} height={stripeH * 7} fill="#3C3B6E" />
    </svg>
  );
};

// ─── DATA ────────────────────────────────────────────────────────────────────

const UK_GCSE_SUBJECTS = [
  { id: 'maths',           name: 'Mathematics',       Icon: Calculator,  category: 'STEM',          desc: 'Number, algebra, geometry, statistics & probability' },
  { id: 'english_lang',    name: 'English Language',  Icon: PenLine,     category: 'Humanities',    desc: 'Reading, writing, speaking & listening skills' },
  { id: 'english_lit',     name: 'English Literature',Icon: BookOpen,    category: 'Humanities',    desc: 'Poetry, prose, drama & critical analysis' },
  { id: 'biology',         name: 'Biology',           Icon: Dna,         category: 'STEM',          desc: 'Cell biology, genetics, ecology & physiology' },
  { id: 'chemistry',       name: 'Chemistry',         Icon: FlaskConical,category: 'STEM',          desc: 'Atomic structure, bonding, reactions & organic chemistry' },
  { id: 'physics',         name: 'Physics',           Icon: Zap,         category: 'STEM',          desc: 'Forces, energy, waves, electricity & particle physics' },
  { id: 'combined_science',name: 'Combined Science',  Icon: Microscope,  category: 'STEM',          desc: 'Biology, chemistry & physics combined award' },
  { id: 'history',         name: 'History',           Icon: Landmark,    category: 'Humanities',    desc: 'Modern, medieval & ancient world history' },
  { id: 'geography',       name: 'Geography',         Icon: Globe,       category: 'Humanities',    desc: 'Physical & human geography, fieldwork & analysis' },
  { id: 'computer_science',name: 'Computer Science',  Icon: Code2,       category: 'STEM',          desc: 'Programming, algorithms, data & networks' },
  { id: 'business',        name: 'Business Studies',  Icon: BarChart2,   category: 'Social Sciences',desc: 'Enterprise, marketing, finance & operations' },
  { id: 'art',             name: 'Art & Design',      Icon: Palette,     category: 'Arts',          desc: 'Drawing, painting, sculpture & digital art' },
  { id: 'dt',              name: 'Design & Technology',Icon: Wrench,     category: 'STEM',          desc: 'Product design, materials & manufacturing processes' },
  { id: 'pe',              name: 'Physical Education',Icon: Dumbbell,    category: 'Arts',          desc: 'Sports science, performance & health & fitness' },
  { id: 'rs',              name: 'Religious Studies', Icon: Sun,         category: 'Humanities',    desc: 'Philosophy, ethics & world religions' },
  { id: 'french',          name: 'French',            Icon: Languages,   category: 'Languages',     desc: 'Reading, writing, listening & speaking in French' },
  { id: 'spanish',         name: 'Spanish',           Icon: Languages,   category: 'Languages',     desc: 'Reading, writing, listening & speaking in Spanish' },
  { id: 'german',          name: 'German',            Icon: Languages,   category: 'Languages',     desc: 'Reading, writing, listening & speaking in German' },
  { id: 'music',           name: 'Music',             Icon: Music,       category: 'Arts',          desc: 'Performance, composition & music theory' },
  { id: 'drama',           name: 'Drama',             Icon: Mic2,        category: 'Arts',          desc: 'Performance, devising & theatre studies' },
  { id: 'media',           name: 'Media Studies',     Icon: Tv,          category: 'Arts',          desc: 'Media analysis, production & industry' },
  { id: 'sociology',       name: 'Sociology',         Icon: Users,       category: 'Social Sciences',desc: 'Society, culture, identity & social structures' },
  { id: 'psychology',      name: 'Psychology',        Icon: Brain,       category: 'Social Sciences',desc: 'Human behaviour, cognition & research methods' },
  { id: 'economics',       name: 'Economics',         Icon: TrendingUp,  category: 'Social Sciences',desc: 'Markets, supply & demand, national & global economy' },
];

const UK_ALEVEL_SUBJECTS = [
  { id: 'maths',           name: 'Mathematics',       Icon: Calculator,  category: 'STEM',          desc: 'Pure maths, mechanics & statistics at advanced level' },
  { id: 'further_maths',   name: 'Further Mathematics',Icon: Hash,       category: 'STEM',          desc: 'Advanced pure, additional mechanics & decision maths' },
  { id: 'english_lit',     name: 'English Literature',Icon: BookOpen,    category: 'Humanities',    desc: 'Advanced textual analysis, comparative study & unseen' },
  { id: 'biology',         name: 'Biology',           Icon: Dna,         category: 'STEM',          desc: 'Biochemistry, genetics, ecology & physiology' },
  { id: 'chemistry',       name: 'Chemistry',         Icon: FlaskConical,category: 'STEM',          desc: 'Physical, organic & inorganic chemistry' },
  { id: 'physics',         name: 'Physics',           Icon: Zap,         category: 'STEM',          desc: 'Mechanics, electricity, quantum & nuclear physics' },
  { id: 'history',         name: 'History',           Icon: Landmark,    category: 'Humanities',    desc: 'Depth & breadth studies, historical skills & essay writing' },
  { id: 'geography',       name: 'Geography',         Icon: Globe,       category: 'Humanities',    desc: 'Physical systems, human geography & independent investigation' },
  { id: 'computer_science',name: 'Computer Science',  Icon: Code2,       category: 'STEM',          desc: 'Programming, computational thinking & theory of computation' },
  { id: 'economics',       name: 'Economics',         Icon: TrendingUp,  category: 'Social Sciences',desc: 'Microeconomics, macroeconomics & quantitative methods' },
  { id: 'psychology',      name: 'Psychology',        Icon: Brain,       category: 'Social Sciences',desc: 'Social, cognitive, biological & developmental psychology' },
  { id: 'sociology',       name: 'Sociology',         Icon: Users,       category: 'Social Sciences',desc: 'Education, crime, families & beliefs in society' },
  { id: 'business',        name: 'Business Studies',  Icon: BarChart2,   category: 'Social Sciences',desc: 'Strategic management, finance & business environment' },
  { id: 'art',             name: 'Art & Design',      Icon: Palette,     category: 'Arts',          desc: 'Portfolio development, critical & contextual studies' },
  { id: 'rs',              name: 'Religious Studies', Icon: Sun,         category: 'Humanities',    desc: 'Philosophy of religion, ethics & Christianity or Islam' },
  { id: 'french',          name: 'French',            Icon: Languages,   category: 'Languages',     desc: 'Advanced language skills, literature & film studies' },
  { id: 'spanish',         name: 'Spanish',           Icon: Languages,   category: 'Languages',     desc: 'Advanced language skills, literature & film studies' },
  { id: 'german',          name: 'German',            Icon: Languages,   category: 'Languages',     desc: 'Advanced language skills, literature & film studies' },
  { id: 'music',           name: 'Music',             Icon: Music,       category: 'Arts',          desc: 'Performance, composition & historical & analytical studies' },
  { id: 'drama',           name: 'Drama & Theatre',   Icon: Mic2,        category: 'Arts',          desc: 'Performance, devising & study of two plays' },
  { id: 'media',           name: 'Media Studies',     Icon: Tv,          category: 'Arts',          desc: 'Media language, representation & industries' },
  { id: 'politics',        name: 'Politics',          Icon: Building2,   category: 'Social Sciences',desc: 'UK politics, global politics & political ideas' },
  { id: 'law',             name: 'Law',               Icon: Scale,       category: 'Social Sciences',desc: 'Criminal law, tort, contract & the legal system' },
  { id: 'philosophy',      name: 'Philosophy',        Icon: MessageCircle,category: 'Humanities',  desc: 'Epistemology, ethics, philosophy of mind & political philosophy' },
  { id: 'pe',              name: 'Physical Education',Icon: Dumbbell,    category: 'Arts',          desc: 'Sports science, physiology & performance analysis' },
];

const US_SUBJECTS = {
  9: [
    { id: 'english9',       name: 'English 9',              Icon: PenLine,     category: 'Language Arts', desc: 'Composition, literature & language arts fundamentals' },
    { id: 'algebra1',       name: 'Algebra I',              Icon: Calculator,  category: 'Mathematics',   desc: 'Linear equations, inequalities, functions & data analysis' },
    { id: 'geometry',       name: 'Geometry',               Icon: Triangle,    category: 'Mathematics',   desc: 'Euclidean geometry, proofs, transformations & measurement' },
    { id: 'biology',        name: 'Biology',                Icon: Dna,         category: 'Sciences',      desc: 'Cell biology, genetics, ecology & evolution' },
    { id: 'earth_science',  name: 'Earth Science',          Icon: Globe,       category: 'Sciences',      desc: 'Geology, meteorology, oceanography & astronomy' },
    { id: 'world_history',  name: 'World History',          Icon: Globe2,      category: 'Social Studies',desc: 'Ancient civilizations through modern world events' },
    { id: 'pe',             name: 'Physical Education',     Icon: Dumbbell,    category: 'Electives',     desc: 'Fitness, team sports & health education' },
    { id: 'health',         name: 'Health',                 Icon: Heart,       category: 'Electives',     desc: 'Personal health, nutrition & wellness' },
    { id: 'computer_science',name: 'Intro to Computer Science',Icon: Code2,   category: 'Sciences',      desc: 'Programming basics, digital literacy & problem solving' },
    { id: 'art',            name: 'Visual Arts',            Icon: Palette,     category: 'Electives',     desc: 'Drawing, painting, sculpture & art history' },
    { id: 'music',          name: 'Music',                  Icon: Music,       category: 'Electives',     desc: 'Music theory, performance & appreciation' },
    { id: 'spanish1',       name: 'Spanish I',              Icon: Languages,   category: 'Languages',     desc: 'Introductory Spanish language & culture' },
    { id: 'french1',        name: 'French I',               Icon: Languages,   category: 'Languages',     desc: 'Introductory French language & culture' },
    { id: 'drama',          name: 'Drama / Theater',        Icon: Mic2,        category: 'Electives',     desc: 'Acting, stagecraft & theater production' },
  ],
  10: [
    { id: 'english10',      name: 'English 10',             Icon: PenLine,     category: 'Language Arts', desc: 'World literature, composition & critical thinking' },
    { id: 'algebra2',       name: 'Algebra II',             Icon: Calculator,  category: 'Mathematics',   desc: 'Polynomial functions, exponentials & logarithms' },
    { id: 'geometry',       name: 'Geometry',               Icon: Triangle,    category: 'Mathematics',   desc: 'Proofs, coordinate geometry & trigonometry intro' },
    { id: 'chemistry',      name: 'Chemistry',              Icon: FlaskConical,category: 'Sciences',      desc: 'Atomic theory, chemical bonding & reactions' },
    { id: 'biology',        name: 'Biology',                Icon: Dna,         category: 'Sciences',      desc: 'Advanced cell biology, genetics & physiology' },
    { id: 'world_history2', name: 'World History II',       Icon: Globe2,      category: 'Social Studies',desc: 'Modern world history from 1500 to present' },
    { id: 'us_history',     name: 'US History',             Icon: Landmark,    category: 'Social Studies',desc: 'American history from founding to the modern era' },
    { id: 'computer_science',name: 'Computer Science',      Icon: Code2,       category: 'Sciences',      desc: 'Programming, data structures & algorithms' },
    { id: 'spanish2',       name: 'Spanish II',             Icon: Languages,   category: 'Languages',     desc: 'Intermediate Spanish language & literature' },
    { id: 'french2',        name: 'French II',              Icon: Languages,   category: 'Languages',     desc: 'Intermediate French language & culture' },
    { id: 'psychology',     name: 'Psychology',             Icon: Brain,       category: 'Social Studies',desc: 'Introduction to human behavior & mental processes' },
    { id: 'art',            name: 'Visual Arts',            Icon: Palette,     category: 'Electives',     desc: 'Advanced drawing, painting & digital media' },
    { id: 'pe',             name: 'Physical Education',     Icon: Dumbbell,    category: 'Electives',     desc: 'Advanced fitness & sports specialization' },
  ],
  11: [
    { id: 'english11',      name: 'American Literature',    Icon: BookOpen,    category: 'Language Arts', desc: 'American literary history, analysis & writing' },
    { id: 'ap_english_lang',name: 'AP English Language',    Icon: PenLine,     category: 'Language Arts', desc: 'Rhetorical analysis, argumentation & synthesis essays' },
    { id: 'precalc',        name: 'Pre-Calculus',           Icon: Calculator,  category: 'Mathematics',   desc: 'Trigonometry, analytic geometry & limits intro' },
    { id: 'ap_calc_ab',     name: 'AP Calculus AB',         Icon: Sigma,       category: 'Mathematics',   desc: 'Differential & integral calculus' },
    { id: 'ap_stats',       name: 'AP Statistics',          Icon: BarChart2,   category: 'Mathematics',   desc: 'Exploratory analysis, probability & inference' },
    { id: 'physics',        name: 'Physics',                Icon: Zap,         category: 'Sciences',      desc: 'Mechanics, electricity, magnetism & waves' },
    { id: 'ap_bio',         name: 'AP Biology',             Icon: Dna,         category: 'Sciences',      desc: 'Advanced cellular biology, genetics & ecology' },
    { id: 'ap_chem',        name: 'AP Chemistry',           Icon: FlaskConical,category: 'Sciences',      desc: 'Advanced chemical reactions, thermodynamics & kinetics' },
    { id: 'ap_cs_a',        name: 'AP Computer Science A',  Icon: Code2,       category: 'Sciences',      desc: 'Object-oriented programming in Java' },
    { id: 'us_history',     name: 'US History',             Icon: Landmark,    category: 'Social Studies',desc: 'In-depth American history & document analysis' },
    { id: 'ap_us_history',  name: 'AP US History',          Icon: Landmark,    category: 'Social Studies',desc: 'Comprehensive US history with DBQs & essays' },
    { id: 'economics',      name: 'Economics',              Icon: TrendingUp,  category: 'Social Studies',desc: 'Micro & macroeconomics fundamentals' },
    { id: 'ap_psych',       name: 'AP Psychology',          Icon: Brain,       category: 'Social Studies',desc: 'Human behavior, cognition & research methods' },
    { id: 'spanish3',       name: 'Spanish III',            Icon: Languages,   category: 'Languages',     desc: 'Advanced Spanish conversation & literature' },
    { id: 'ap_spanish',     name: 'AP Spanish Language',    Icon: Languages,   category: 'Languages',     desc: 'AP-level Spanish language & culture' },
  ],
  12: [
    { id: 'english12',      name: 'English 12',             Icon: PenLine,     category: 'Language Arts', desc: 'British literature, composition & college essay writing' },
    { id: 'ap_english_lit', name: 'AP English Literature',  Icon: BookOpen,    category: 'Language Arts', desc: 'Advanced literary analysis, poetry & prose' },
    { id: 'ap_calc_bc',     name: 'AP Calculus BC',         Icon: Sigma,       category: 'Mathematics',   desc: 'Advanced calculus including series & parametric equations' },
    { id: 'ap_stats',       name: 'AP Statistics',          Icon: BarChart2,   category: 'Mathematics',   desc: 'Statistical inference, regression & experimental design' },
    { id: 'ap_physics_1',   name: 'AP Physics 1',           Icon: Zap,         category: 'Sciences',      desc: 'Algebra-based mechanics & waves' },
    { id: 'ap_physics_c',   name: 'AP Physics C',           Icon: Zap,         category: 'Sciences',      desc: 'Calculus-based mechanics & electromagnetism' },
    { id: 'ap_bio',         name: 'AP Biology',             Icon: Dna,         category: 'Sciences',      desc: 'Advanced biology with free-response mastery' },
    { id: 'ap_environ',     name: 'AP Environmental Science',Icon: Leaf,       category: 'Sciences',      desc: 'Earth systems, pollution, biodiversity & sustainability' },
    { id: 'ap_gov',         name: 'AP Government & Politics',Icon: Building2,  category: 'Social Studies',desc: 'US political institutions, systems & policy analysis' },
    { id: 'ap_econ_micro',  name: 'AP Microeconomics',      Icon: TrendingUp,  category: 'Social Studies',desc: 'Consumer & producer theory, market structures' },
    { id: 'ap_econ_macro',  name: 'AP Macroeconomics',      Icon: BarChart2,   category: 'Social Studies',desc: 'National income, money & international economics' },
    { id: 'sociology',      name: 'Sociology',              Icon: Users,       category: 'Social Studies',desc: 'Social institutions, culture & inequality' },
    { id: 'ap_cs_principles',name: 'AP CS Principles',      Icon: Code2,       category: 'Sciences',      desc: 'Computing impacts, big data & creative development' },
    { id: 'philosophy',     name: 'Philosophy',             Icon: MessageCircle,category: 'Electives',   desc: 'Ethics, logic, epistemology & political philosophy' },
    { id: 'ap_spanish',     name: 'AP Spanish Language',    Icon: Languages,   category: 'Languages',     desc: 'Near-native Spanish communication & analysis' },
    { id: 'ap_french',      name: 'AP French Language',     Icon: Languages,   category: 'Languages',     desc: 'Near-native French communication & analysis' },
    { id: 'film',           name: 'Film Studies',           Icon: Film,        category: 'Electives',     desc: 'Film history, analysis & production' },
  ],
};

const CURRICULA = {
  uk: {
    id: 'uk',
    name: 'UK High School',
    shortName: 'UK HS',
    Flag: FlagUK,
    subtitle: 'AQA · Edexcel · OCR · WJEC',
    description: 'GCSE & A-Level curriculum aligned resources covering all major exam boards in England, Wales & Scotland',
    grades: {
      9:  { label: 'Year 10', subtitle: 'GCSE — Year 1',       examBoard: 'AQA / Edexcel / OCR', subjects: UK_GCSE_SUBJECTS   },
      10: { label: 'Year 11', subtitle: 'GCSE — Exam Year',    examBoard: 'AQA / Edexcel / OCR', subjects: UK_GCSE_SUBJECTS   },
      11: { label: 'Year 12', subtitle: 'A-Level — AS Year',   examBoard: 'AQA / Edexcel / OCR', subjects: UK_ALEVEL_SUBJECTS },
      12: { label: 'Year 13', subtitle: 'A-Level — Exam Year', examBoard: 'AQA / Edexcel / OCR', subjects: UK_ALEVEL_SUBJECTS },
    },
  },
  us: {
    id: 'us',
    name: 'American High School',
    shortName: 'US HS',
    Flag: FlagUS,
    subtitle: 'Common Core · AP · SAT Prep',
    description: 'College-prep curriculum resources aligned to Common Core standards for American high school students in grades 9–12',
    grades: {
      9:  { label: 'Grade 9',  subtitle: 'Freshman Year',   examBoard: 'Common Core',       subjects: US_SUBJECTS[9]  },
      10: { label: 'Grade 10', subtitle: 'Sophomore Year',  examBoard: 'Common Core',       subjects: US_SUBJECTS[10] },
      11: { label: 'Grade 11', subtitle: 'Junior Year',     examBoard: 'Common Core + AP',  subjects: US_SUBJECTS[11] },
      12: { label: 'Grade 12', subtitle: 'Senior Year',     examBoard: 'AP + College Prep', subjects: US_SUBJECTS[12] },
    },
  },
};

const GRADE_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316'];
const EXCLUDED_CATEGORIES = new Set(['Arts', 'Languages', 'Language Arts', 'Electives']);

const CATEGORY_COLOR = {
  'STEM':           '#22c55e',
  'Humanities':     '#3b82f6',
  'Languages':      '#a855f7',
  'Arts':           '#ec4899',
  'Social Sciences':'#f97316',
  'Mathematics':    '#22c55e',
  'Language Arts':  '#3b82f6',
  'Sciences':       '#06b6d4',
  'Social Studies': '#f97316',
  'Electives':      '#84736e',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function fmtBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function Breadcrumb({ curriculum, grade, subject, onLanding, onCurriculum, onGrade }) {
  const curr = curriculum ? CURRICULA[curriculum] : null;
  const gradeInfo = curr && grade ? curr.grades[grade] : null;
  return (
    <nav className="ch-breadcrumb" aria-label="breadcrumb">
      <button className="ch-bc-item ch-bc-link" onClick={onLanding}>
        <Home size={13} />
        <span>Context Hub</span>
      </button>
      {curr && (
        <>
          <ChevronRight size={12} className="ch-bc-sep" />
          <button className="ch-bc-item ch-bc-link" onClick={onCurriculum}>
            <curr.Flag size={16} />
            <span>{curr.shortName}</span>
          </button>
        </>
      )}
      {gradeInfo && (
        <>
          <ChevronRight size={12} className="ch-bc-sep" />
          <button className="ch-bc-item ch-bc-link" onClick={onGrade}>{gradeInfo.label}</button>
        </>
      )}
      {subject && (
        <>
          <ChevronRight size={12} className="ch-bc-sep" />
          <span className="ch-bc-item ch-bc-current">
            <subject.Icon size={12} />
            {subject.name}
          </span>
        </>
      )}
    </nav>
  );
}

function DocCard({ doc, viewMode, onDelete, isOwn }) {
  const IconComp = FileText;
  const isPublic = doc.scope === 'public' || doc.scope === 'community';
  if (viewMode === 'list') {
    return (
      <div className={`ch-doc-row ${isOwn ? 'ch-doc-row--mine' : ''}`}>
        <IconComp size={18} className="ch-doc-row-icon" />
        <div className="ch-doc-row-info">
          <span className="ch-doc-row-title">{doc.title || doc.filename || 'Untitled'}</span>
          <span className="ch-doc-row-meta">
            {isPublic ? <><Unlock size={10} /> Community</> : <><Lock size={10} /> Private</>}
            {doc.created_at && <> · {fmtDate(doc.created_at)}</>}
            {doc.file_size && <> · {fmtBytes(doc.file_size)}</>}
          </span>
        </div>
        <div className="ch-doc-row-actions">
          {isOwn && (
            <button className="ch-doc-action ch-doc-action--delete" onClick={() => onDelete(doc.id)} title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={`ch-doc-card ${isOwn ? 'ch-doc-card--mine' : ''}`}>
      <div className="ch-doc-card-top">
        <IconComp size={28} className="ch-doc-card-icon" />
        <div className="ch-doc-card-badges">
          {isPublic
            ? <span className="ch-badge ch-badge--community"><Users size={9} />Community</span>
            : <span className="ch-badge ch-badge--private"><Lock size={9} />Private</span>}
          {isOwn && <span className="ch-badge ch-badge--mine"><Star size={9} />Mine</span>}
        </div>
      </div>
      <div className="ch-doc-card-body">
        <h4 className="ch-doc-card-title">{doc.title || doc.filename || 'Untitled'}</h4>
        {doc.subject && <p className="ch-doc-card-subject">{doc.subject}</p>}
        {doc.ai_summary && <p className="ch-doc-card-summary">{doc.ai_summary}</p>}
        {doc.topic_tags && doc.topic_tags.length > 0 && (
          <div className="ch-doc-card-tags">
            {doc.topic_tags.slice(0, 4).map(tag => (
              <span key={tag} className="ch-doc-tag"><Tag size={9} />{tag}</span>
            ))}
          </div>
        )}
        <p className="ch-doc-card-meta">
          {doc.created_at && fmtDate(doc.created_at)}
          {doc.chunk_count ? <> · {doc.chunk_count} chunks</> : null}
        </p>
      </div>
      {isOwn && (
        <div className="ch-doc-card-footer">
          <button className="ch-doc-action ch-doc-action--delete" onClick={() => onDelete(doc.id)}>
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function UploadModal({ isOpen, onClose, curriculum, grade, subject, onUploaded }) {
  const [file, setFile]       = useState(null);
  const [scope, setScope]     = useState('private');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const curr      = curriculum ? CURRICULA[curriculum] : null;
  const gradeInfo = curr && grade ? curr.grades[grade] : null;

  useEffect(() => {
    if (isOpen) { setFile(null); setError(''); setSuccess(false); setScope('private'); }
  }, [isOpen]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleSubmit = async () => {
    if (!file) { setError('Please select a file.'); return; }
    setLoading(true);
    setError('');
    try {
      await contextService.uploadDocument(
        file,
        subject?.id || '',
        grade ? String(grade) : '',
        scope,
        { sourceName: curr?.shortName || '' }
      );
      setSuccess(true);
      if (onUploaded) onUploaded();
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="ch-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ch-modal">
        <div className="ch-modal-header">
          <div className="ch-modal-header-info">
            <h3 className="ch-modal-title">Upload Document</h3>
            <p className="ch-modal-subtitle">
              {curr ? curr.name : 'Custom Context'}
              {gradeInfo ? ` · ${gradeInfo.label}` : ''}
              {subject ? ` · ${subject.name}` : ''}
            </p>
          </div>
          <button className="ch-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ch-modal-body">
          {success ? (
            <div className="ch-modal-success">
              <CheckCircle size={40} />
              <p>Document uploaded successfully!</p>
            </div>
          ) : (
            <>
              <div
                className={`ch-drop-zone ${dragOver ? 'ch-drop-zone--active' : ''} ${file ? 'ch-drop-zone--has-file' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  style={{ display: 'none' }}
                  onChange={e => setFile(e.target.files[0])}
                />
                {file ? (
                  <div className="ch-drop-file">
                    <FileText size={26} className="ch-drop-file-icon-svg" />
                    <div>
                      <p className="ch-drop-file-name">{file.name}</p>
                      <p className="ch-drop-file-size">{fmtBytes(file.size)}</p>
                    </div>
                    <button className="ch-drop-file-remove" onClick={e => { e.stopPropagation(); setFile(null); }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="ch-drop-icon" />
                    <p className="ch-drop-label">Drop file here or <span>browse</span></p>
                    <p className="ch-drop-hint">Supports PDF, TXT, MD · Max 50 MB</p>
                  </>
                )}
              </div>

              <div className="ch-modal-scope">
                <p className="ch-modal-scope-label">Visibility</p>
                <div className="ch-scope-options">
                  <button
                    className={`ch-scope-btn ${scope === 'private' ? 'ch-scope-btn--active' : ''}`}
                    onClick={() => setScope('private')}
                  >
                    <Lock size={14} />
                    <div>
                      <span className="ch-scope-btn-title">Private</span>
                      <span className="ch-scope-btn-desc">Only you can see this</span>
                    </div>
                  </button>
                  <button
                    className={`ch-scope-btn ${scope === 'public' ? 'ch-scope-btn--active' : ''}`}
                    onClick={() => setScope('public')}
                  >
                    <Users size={14} />
                    <div>
                      <span className="ch-scope-btn-title">Contribute to Community</span>
                      <span className="ch-scope-btn-desc">Share with all Cerbyl students</span>
                    </div>
                  </button>
                </div>
              </div>

              {error && (
                <div className="ch-modal-error">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div className="ch-modal-actions">
                <button className="ch-btn ch-btn--ghost" onClick={onClose}>Cancel</button>
                <button className="ch-btn ch-btn--primary" onClick={handleSubmit} disabled={loading || !file}>
                  {loading ? <Loader2 size={14} className="ch-spinner" /> : <Upload size={14} />}
                  {loading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ContextHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-driven navigation state ────────────────────────────────────────────
  const urlC = searchParams.get('c');
  const urlG = searchParams.get('g') ? Number(searchParams.get('g')) : null;
  const urlS = searchParams.get('s');
  const urlViewParam = searchParams.get('view');

  const selectedCurriculum = urlC && CURRICULA[urlC] ? urlC : null;
  const curr               = selectedCurriculum ? CURRICULA[selectedCurriculum] : null;
  const selectedGrade      = curr && urlG && curr.grades[urlG] ? urlG : null;
  const gradeInfo          = curr && selectedGrade ? curr.grades[selectedGrade] : null;
  const selectedSubject    = gradeInfo && urlS ? (gradeInfo.subjects.find(s => s.id === urlS) || null) : null;
  const view               = urlViewParam === 'ask'    ? 'ask'
    : urlViewParam === 'custom' ? 'custom'
    : selectedSubject    ? 'subject'
    : selectedGrade      ? 'grade'
    : selectedCurriculum ? 'curriculum'
    : 'landing';

  const [myDocs, setMyDocs]               = useState([]);
  const [communityDocs, setCommunityDocs] = useState([]);
  const [docsLoading, setDocsLoading]     = useState(false);
  const [docsError, setDocsError]         = useState('');
  const [docTab, setDocTab]               = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [viewMode, setViewMode]           = useState('grid');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [activeContext, setActiveContext] = useState(() => {
    try { return JSON.parse(localStorage.getItem('active_context') || 'null'); } catch { return null; }
  });
  const [hsMode, setHsMode] = useState(() => localStorage.getItem('hs_mode_enabled') === 'true');

  const [recentContexts, setRecentContexts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('context_history') || '[]'); } catch { return []; }
  });

  const [uploadOpen, setUploadOpen]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats]             = useState({ myDocs: 0, communityDocs: 0 });

  // ── Ask Your Notes state ───────────────────────────────────────────────────
  const [askHistory, setAskHistory]   = useState([]);
  const [askInput, setAskInput]       = useState('');
  const [askLoading, setAskLoading]   = useState(false);
  const [askUseHs, setAskUseHs]       = useState(true);
  const askEndRef                      = useRef(null);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    setDocsError('');
    try {
      const all  = await contextService.listDocuments();
      const docs = Array.isArray(all) ? all : (all.user_docs || all.documents || []);
      const community = docs.filter(d => d.scope === 'public' || d.scope === 'hs_shared');
      setMyDocs(docs);
      setCommunityDocs(community);
      setStats(s => ({ ...s, myDocs: docs.length, communityDocs: community.length }));
    } catch (e) {
      setDocsError(e.message || 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const loadCommunityDocs = useCallback(async (curriculumId, gradeNum, subjectId) => {
    try {
      const data = await contextService.listCommunityDocuments({ curriculum: curriculumId, grade: gradeNum, subject: subjectId });
      setCommunityDocs(Array.isArray(data) ? data : (data.documents || []));
    } catch { /* silenced */ }
  }, []);

  useEffect(() => {
    if (view === 'subject' && selectedSubject) {
      loadDocs();
      loadCommunityDocs(selectedCurriculum, selectedGrade, selectedSubject?.id);
    }
    if (view === 'ask' || view === 'custom') {
      loadDocs();
    }
  }, [urlC, urlG, urlS, urlViewParam, loadDocs, loadCommunityDocs]); // eslint-disable-line

  // ── Active Context ─────────────────────────────────────────────────────────
  const addToRecent = useCallback((curriculum, grade, subject) => {
    if (!curriculum || !grade || !subject) return;
    const entry = { curriculum, grade, subject: subject.id, name: subject.name };
    setRecentContexts(prev => {
      const filtered = prev.filter(r => !(r.curriculum === curriculum && r.grade === grade && r.subject === subject.id));
      const next = [entry, ...filtered].slice(0, 4);
      localStorage.setItem('context_history', JSON.stringify(next));
      return next;
    });
  }, []);

  const setAsActiveContext = useCallback(() => {
    const ctx = { curriculum: selectedCurriculum, grade: selectedGrade, subject: selectedSubject?.id };
    localStorage.setItem('active_context', JSON.stringify(ctx));
    localStorage.setItem('hs_mode_enabled', 'true');
    setActiveContext(ctx);
    setHsMode(true);
    addToRecent(selectedCurriculum, selectedGrade, selectedSubject);
  }, [selectedCurriculum, selectedGrade, selectedSubject, addToRecent]);

  const clearActiveContext = useCallback(() => {
    localStorage.removeItem('active_context');
    localStorage.setItem('hs_mode_enabled', 'false');
    setActiveContext(null);
    setHsMode(false);
  }, []);

  const isCurrentActive = activeContext &&
    activeContext.curriculum === selectedCurriculum &&
    activeContext.grade === selectedGrade &&
    activeContext.subject === selectedSubject?.id;

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goLanding = () => { setSearchParams({}); setCategoryFilter('all'); setSearchQuery(''); };
  const goCurriculum = (id) => { setSearchParams({ c: id }); setCategoryFilter('all'); };
  const goGrade = (g) => { setSearchParams({ c: selectedCurriculum, g: String(g) }); setCategoryFilter('all'); setSearchQuery(''); };
  const goSubject = (s) => { setSearchParams({ c: selectedCurriculum, g: String(selectedGrade), s: s.id }); setDocTab('all'); setSearchQuery(''); };
  const goBack = () => {
    if (view === 'subject')         setSearchParams({ c: urlC, g: String(urlG) });
    else if (view === 'grade')      setSearchParams({ c: urlC });
    else if (view === 'curriculum') setSearchParams({});
    else if (view === 'custom')     setSearchParams({});
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await contextService.deleteDocument(docId);
      setMyDocs(prev => prev.filter(d => d.id !== docId));
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredSubjects = gradeInfo
    ? gradeInfo.subjects.filter(s => {
        if (EXCLUDED_CATEGORIES.has(s.category)) return false;
        const matchCat    = categoryFilter === 'all' || s.category === categoryFilter;
        const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
      })
    : [];

  const filteredDocs = (() => {
    let base = docTab === 'community' ? communityDocs
      : docTab === 'mine' ? myDocs
      : [...communityDocs, ...myDocs];
    if (searchQuery) base = base.filter(d =>
      (d.title || d.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return base;
  })();

  const activeCtxCurr  = activeContext?.curriculum ? CURRICULA[activeContext.curriculum] : null;
  const activeCtxGrade = activeCtxCurr && activeContext?.grade ? activeCtxCurr.grades[activeContext.grade] : null;

  // ── Ask Your Notes ─────────────────────────────────────────────────────────
  const handleAsk = useCallback(async () => {
    const q = askInput.trim();
    if (!q || askLoading) return;
    setAskInput('');
    const entry = { question: q, answer: null, sources: [], loading: true, error: null };
    setAskHistory(prev => [...prev, entry]);
    setAskLoading(true);
    try {
      const res = await contextService.askKnowledgeBase(q, { useHs: askUseHs, topK: 6 });
      setAskHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { question: q, answer: res.answer, sources: res.sources || [], loading: false, error: null };
        return next;
      });
    } catch (e) {
      setAskHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { question: q, answer: null, sources: [], loading: false, error: e.message || 'Request failed' };
        return next;
      });
    } finally {
      setAskLoading(false);
    }
  }, [askInput, askLoading, askUseHs]);

  useEffect(() => {
    if (askEndRef.current) askEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [askHistory]);

  // ─── SIDEBAR ──────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className={`ch-sidebar ${sidebarOpen ? '' : 'ch-sidebar--collapsed'}`}>
      <div className="ch-sidebar-inner">
        {activeContext && activeCtxCurr ? (
          <div className="ch-sidebar-active-ctx">
            <div className="ch-sac-header">
              <div className="ch-sac-dot" />
              <span className="ch-sac-label">Active Context</span>
              <span className="ch-sac-hs">HS ON</span>
            </div>
            <div className="ch-sac-body">
              <activeCtxCurr.Flag size={22} />
              <div className="ch-sac-info">
                <span className="ch-sac-curriculum">{activeCtxCurr.shortName}</span>
                {activeCtxGrade && <span className="ch-sac-grade">{activeCtxGrade.label}</span>}
                {activeContext.subject && (
                  <span className="ch-sac-subject">
                    {activeCtxGrade?.subjects.find(s => s.id === activeContext.subject)?.name || activeContext.subject}
                  </span>
                )}
              </div>
            </div>
            <button className="ch-sac-clear" onClick={clearActiveContext}>
              <X size={12} /> Clear
            </button>
          </div>
        ) : (
          <div className="ch-sidebar-no-ctx">
            <Sparkles size={14} />
            <p>No active context. Browse a subject below to set one.</p>
          </div>
        )}

        {recentContexts.length > 0 && (
          <div className="ch-sidebar-section">
            <p className="ch-sidebar-section-title">Recent</p>
            <nav className="ch-sidebar-nav">
              {recentContexts.map((r, i) => {
                const rCurr = CURRICULA[r.curriculum];
                const rGrade = rCurr?.grades[r.grade];
                if (!rCurr || !rGrade) return null;
                const isActive = urlC === r.curriculum && urlG === r.grade && urlS === r.subject;
                return (
                  <button
                    key={i}
                    className={`ch-sidebar-nav-item ch-sidebar-nav-item--recent ${isActive ? 'ch-sidebar-nav-item--active' : ''}`}
                    onClick={() => setSearchParams({ c: r.curriculum, g: String(r.grade), s: r.subject })}
                  >
                    <Clock size={13} className="ch-sidebar-recent-icon" />
                    <span className="ch-sidebar-recent-text">
                      <span className="ch-sidebar-recent-name">{r.name}</span>
                      <span className="ch-sidebar-recent-sub">{rCurr.shortName} · {rGrade.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        <div className="ch-sidebar-section">
          <p className="ch-sidebar-section-title">Navigation</p>
          <nav className="ch-sidebar-nav">
            <button
              className={`ch-sidebar-nav-item ${view === 'landing' ? 'ch-sidebar-nav-item--active' : ''}`}
              onClick={goLanding}
            >
              <Home size={14} /><span>Home</span>
            </button>

            <button
              className={`ch-sidebar-nav-item ${selectedCurriculum === 'uk' ? 'ch-sidebar-nav-item--active' : ''}`}
              onClick={() => goCurriculum('uk')}
            >
              <FlagUK size={18} /><span>UK High School</span>
            </button>
            {selectedCurriculum === 'uk' && (
              <div className="ch-sidebar-nav-children">
                {Object.entries(CURRICULA.uk.grades).map(([g, info], idx) => (
                  <button
                    key={g}
                    className={`ch-sidebar-nav-item ch-sidebar-nav-item--child ${selectedGrade === Number(g) ? 'ch-sidebar-nav-item--active' : ''}`}
                    onClick={() => goGrade(Number(g))}
                  >
                    <span className="ch-sidebar-nav-grade-dot" style={{ background: GRADE_COLORS[idx] }} />
                    <span>{info.label}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              className={`ch-sidebar-nav-item ${selectedCurriculum === 'us' ? 'ch-sidebar-nav-item--active' : ''}`}
              onClick={() => goCurriculum('us')}
            >
              <FlagUS size={18} /><span>American High School</span>
            </button>
            {selectedCurriculum === 'us' && (
              <div className="ch-sidebar-nav-children">
                {Object.entries(CURRICULA.us.grades).map(([g, info], idx) => (
                  <button
                    key={g}
                    className={`ch-sidebar-nav-item ch-sidebar-nav-item--child ${selectedGrade === Number(g) ? 'ch-sidebar-nav-item--active' : ''}`}
                    onClick={() => goGrade(Number(g))}
                  >
                    <span className="ch-sidebar-nav-grade-dot" style={{ background: GRADE_COLORS[idx] }} />
                    <span>{info.label}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              className={`ch-sidebar-nav-item ${view === 'custom' ? 'ch-sidebar-nav-item--active' : ''}`}
              onClick={() => setSearchParams({ view: 'custom' })}
            >
              <Plus size={14} /><span>Add Your Own</span>
            </button>

            <button
              className={`ch-sidebar-nav-item ch-sidebar-nav-item--ask ${urlViewParam === 'ask' ? 'ch-sidebar-nav-item--active' : ''}`}
              onClick={() => setSearchParams({ view: 'ask' })}
            >
              <MessageCircle size={14} /><span>Ask Your Notes</span>
            </button>
          </nav>
        </div>

        <div className="ch-sidebar-section ch-sidebar-stats">
          <p className="ch-sidebar-section-title">Library Stats</p>
          <div className="ch-stat-row">
            <FileText size={13} />
            <span className="ch-stat-label">My Documents</span>
            <span className="ch-stat-val">{stats.myDocs}</span>
          </div>
          <div className="ch-stat-row">
            <Users size={13} />
            <span className="ch-stat-label">Community Docs</span>
            <span className="ch-stat-val">{stats.communityDocs}</span>
          </div>
        </div>

        <div className="ch-sidebar-footer">
          <button className="ch-sidebar-footer-btn" onClick={() => navigate('/dashboard')}>
            <Home size={14} /><span>Dashboard</span>
          </button>
        </div>
      </div>
    </aside>
  );

  // ─── LANDING ──────────────────────────────────────────────────────────────
  const LandingView = () => (
    <div className="ch-landing">
      <div className="ch-landing-header">
        <h1 className="ch-landing-title">
          <BookCopy size={28} />
          Curriculum Library
        </h1>
        <p className="ch-landing-desc">
          Select a curriculum to browse subjects, access community-uploaded study resources,
          and set context for your AI tutor.
        </p>
      </div>

      <div className="ch-bento">
        <button className="ch-bento-card ch-bento-card--uk" onClick={() => goCurriculum('uk')}>
          <div className="ch-bento-card-bg" />
          <div className="ch-bento-card-inner">
            <div className="ch-bento-card-flag-wrap"><FlagUK size={56} /></div>
            <div className="ch-bento-card-text">
              <h2 className="ch-bento-card-title">UK High School</h2>
              <p className="ch-bento-card-subtitle">AQA · Edexcel · OCR · WJEC</p>
              <p className="ch-bento-card-desc">
                GCSE (Years 10–11) and A-Level (Years 12–13) resources covering all major exam boards.
              </p>
            </div>
            <div className="ch-bento-card-meta">
              <span className="ch-bento-meta-pill"><GraduationCap size={11} />GCSE + A-Level</span>
              <span className="ch-bento-meta-pill"><BookMarked size={11} />4 year groups</span>
              <span className="ch-bento-meta-pill"><Layers size={11} />{UK_ALEVEL_SUBJECTS.length}+ subjects</span>
            </div>
            <div className="ch-bento-card-cta">Explore <ChevronRight size={14} /></div>
          </div>
        </button>

        <button className="ch-bento-card ch-bento-card--us" onClick={() => goCurriculum('us')}>
          <div className="ch-bento-card-bg" />
          <div className="ch-bento-card-inner">
            <div className="ch-bento-card-flag-wrap"><FlagUS size={56} /></div>
            <div className="ch-bento-card-text">
              <h2 className="ch-bento-card-title">American High School</h2>
              <p className="ch-bento-card-subtitle">Common Core · AP · SAT Prep</p>
              <p className="ch-bento-card-desc">
                Grades 9–12 college-prep curriculum with AP courses and standardized test preparation.
              </p>
            </div>
            <div className="ch-bento-card-meta">
              <span className="ch-bento-meta-pill"><GraduationCap size={11} />Grades 9–12</span>
              <span className="ch-bento-meta-pill"><Star size={11} />AP Courses</span>
              <span className="ch-bento-meta-pill"><Layers size={11} />Common Core</span>
            </div>
            <div className="ch-bento-card-cta">Explore <ChevronRight size={14} /></div>
          </div>
        </button>

        <button className="ch-bento-card ch-bento-card--custom" onClick={() => setUploadOpen(true)}>
          <div className="ch-bento-card-inner">
            <div className="ch-bento-card-plus-icon"><Plus size={32} /></div>
            <div className="ch-bento-card-text">
              <h2 className="ch-bento-card-title">Add Your Own Context</h2>
              <p className="ch-bento-card-desc">
                Upload your own syllabi, textbooks, notes or any study material. Keep it private or contribute to the community.
              </p>
            </div>
            <div className="ch-bento-card-meta">
              <span className="ch-bento-meta-pill"><Upload size={11} />PDF / TXT / MD</span>
              <span className="ch-bento-meta-pill"><Lock size={11} />Private or Public</span>
            </div>
          </div>
        </button>

        <div className="ch-bento-card ch-bento-card--stats ch-bento-card--no-hover">
          <div className="ch-bento-card-inner">
            <h3 className="ch-bento-stats-title"><TrendingUp size={16} />Community Library</h3>
            <div className="ch-bento-stats-grid">
              <div className="ch-bento-stat">
                <span className="ch-bento-stat-num">{UK_GCSE_SUBJECTS.length + UK_ALEVEL_SUBJECTS.length}</span>
                <span className="ch-bento-stat-label">UK Subjects</span>
              </div>
              <div className="ch-bento-stat">
                <span className="ch-bento-stat-num">{Object.values(US_SUBJECTS).flat().length}</span>
                <span className="ch-bento-stat-label">US Subjects</span>
              </div>
              <div className="ch-bento-stat">
                <span className="ch-bento-stat-num">{stats.communityDocs}</span>
                <span className="ch-bento-stat-label">Community Docs</span>
              </div>
              <div className="ch-bento-stat">
                <span className="ch-bento-stat-num">{stats.myDocs}</span>
                <span className="ch-bento-stat-label">My Docs</span>
              </div>
            </div>
            <p className="ch-bento-stats-hint">
              <Info size={11} />Upload public documents to help fellow students
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── CURRICULUM VIEW ──────────────────────────────────────────────────────
  const CurriculumView = () => {
    if (!curr) return null;
    const CurrFlag = curr.Flag;
    return (
      <div className="ch-curriculum-view">
        <div className="ch-view-header">
          <button className="ch-back-btn" onClick={goBack}><ChevronLeft size={20} /></button>
          <div className="ch-view-header-info">
            <CurrFlag size={32} />
            <div>
              <h2 className="ch-view-title">{curr.name}</h2>
            </div>
          </div>
        </div>
        <p className="ch-view-description">{curr.description}</p>

        <div className="ch-grade-grid">
          {Object.entries(curr.grades).map(([g, info], idx) => (
            <button
              key={g}
              className="ch-grade-card"
              style={{ '--grade-color': GRADE_COLORS[idx] }}
              onClick={() => goGrade(Number(g))}
            >
              <div className="ch-grade-card-accent" />
              <div className="ch-grade-card-inner">
                <div className="ch-grade-card-number">
                  <span className="ch-grade-num">{info.label}</span>
                  <span className="ch-grade-sub">{info.subtitle}</span>
                </div>
                <div className="ch-grade-card-info">
                  <p className="ch-grade-exam-board"><BookOpen size={11} />{info.examBoard}</p>
                  <p className="ch-grade-subject-count"><Layers size={11} />{info.subjects.length} subjects</p>
                </div>
                <div className="ch-grade-card-arrow"><ChevronRight size={16} /></div>
              </div>
            </button>
          ))}
        </div>

        <div className="ch-curriculum-feature-row">
          <div className="ch-curriculum-feature">
            <BookMarked size={16} />
            <div>
              <p className="ch-curriculum-feature-title">Community Resources</p>
              <p className="ch-curriculum-feature-desc">PDFs & notes uploaded by students and teachers</p>
            </div>
          </div>
          <div className="ch-curriculum-feature">
            <Shield size={16} />
            <div>
              <p className="ch-curriculum-feature-title">Private Uploads</p>
              <p className="ch-curriculum-feature-desc">Keep your own notes private or share with the community</p>
            </div>
          </div>
          <div className="ch-curriculum-feature">
            <Sparkles size={16} />
            <div>
              <p className="ch-curriculum-feature-title">AI Context Injection</p>
              <p className="ch-curriculum-feature-desc">Set any subject as your active AI tutor context</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── GRADE VIEW ───────────────────────────────────────────────────────────
  const GradeView = () => {
    if (!curr || !gradeInfo) return null;
    const cats = ['all', ...new Set(gradeInfo.subjects.filter(s => !EXCLUDED_CATEGORIES.has(s.category)).map(s => s.category))];
    const CurrFlag = curr.Flag;
    return (
      <div className="ch-grade-view">
        <div className="ch-view-header">
          <button className="ch-back-btn" onClick={goBack}><ChevronLeft size={20} /></button>
          <div className="ch-view-header-info">
            <CurrFlag size={26} />
            <div>
              <h2 className="ch-view-title">{gradeInfo.label}</h2>
            </div>
          </div>
          <div className="ch-view-header-actions">
            <div className="ch-search-bar">
              <Search size={14} />
              <input type="text" placeholder="Search subjects…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} className="ch-search-input" />
              {searchQuery && <button className="ch-search-clear" onClick={() => setSearchQuery('')}><X size={12} /></button>}
            </div>
          </div>
        </div>

        <div className="ch-category-pills">
          {cats.map(cat => (
            <button
              key={cat}
              className={`ch-category-pill ${categoryFilter === cat ? 'ch-category-pill--active' : ''}`}
              style={cat !== 'all' ? { '--cat-color': CATEGORY_COLOR[cat] || '#888' } : {}}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? 'All Subjects' : cat}
              <span className="ch-category-pill-count">
                {cat === 'all' ? gradeInfo.subjects.length : gradeInfo.subjects.filter(s => s.category === cat).length}
              </span>
            </button>
          ))}
        </div>

        <div className="ch-subject-grid">
          {filteredSubjects.length === 0 ? (
            <div className="ch-empty-state">
              <Search size={32} />
              <p>No subjects match "{searchQuery}"</p>
              <button className="ch-btn ch-btn--ghost" onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}>
                Clear filters
              </button>
            </div>
          ) : (
            filteredSubjects.map(subject => {
              const SubjectIcon = subject.Icon;
              return (
                <button
                  key={subject.id}
                  className="ch-subject-card"
                  style={{ '--cat-color': CATEGORY_COLOR[subject.category] || '#888' }}
                  onClick={() => goSubject(subject)}
                >
                  <div className="ch-subject-card-accent" />
                  <div className="ch-subject-card-inner">
                    <div className="ch-subject-icon-wrap">
                      <SubjectIcon size={20} />
                    </div>
                    <div className="ch-subject-info">
                      <h3 className="ch-subject-name">{subject.name}</h3>
                      <p className="ch-subject-desc">{subject.desc}</p>
                    </div>
                    <span
                      className="ch-subject-category"
                      style={{
                        background: `color-mix(in srgb, ${CATEGORY_COLOR[subject.category] || '#888'} 15%, transparent)`,
                        color: CATEGORY_COLOR[subject.category] || '#888'
                      }}
                    >
                      {subject.category}
                    </span>
                  </div>
                  <div className="ch-subject-card-hover-indicator"><ChevronRight size={14} /></div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ─── SUBJECT VIEW ─────────────────────────────────────────────────────────
  const SubjectView = () => {
    if (!selectedSubject || !curr || !gradeInfo) return null;
    return (
      <div className="ch-subject-view">
        <div className="ch-view-header">
          <button className="ch-back-btn" onClick={goBack}><ChevronLeft size={20} /></button>
          <div className="ch-view-header-info">
            <div>
              <h2 className="ch-view-title">{selectedSubject.name}</h2>
              <p className="ch-view-subtitle">{selectedSubject.desc}</p>
            </div>
          </div>
          <div className="ch-view-header-actions">
            {isCurrentActive ? (
              <div className="ch-active-badge"><CheckCircle size={13} />Active Context</div>
            ) : (
              <button className="ch-btn ch-btn--set-active" onClick={setAsActiveContext}>
                <Sparkles size={13} />Set as Active Context
              </button>
            )}
            <button className="ch-btn ch-btn--primary" onClick={() => setUploadOpen(true)}>
              <Upload size={14} />Upload
            </button>
          </div>
        </div>

        <div className="ch-docs-controls">
          <div className="ch-doc-tabs">
            {[
              { key: 'all',       label: 'All Resources', icon: FolderOpen },
              { key: 'community', label: 'Community',     icon: Users      },
              { key: 'mine',      label: 'My Documents',  icon: Lock       },
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button key={tab.key} className={`ch-doc-tab ${docTab === tab.key ? 'ch-doc-tab--active' : ''}`}
                  onClick={() => setDocTab(tab.key)}>
                  <TabIcon size={13} />
                  {tab.label}
                  <span className="ch-doc-tab-count">
                    {tab.key === 'all' ? filteredDocs.length
                      : tab.key === 'community' ? communityDocs.length : myDocs.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ch-docs-controls-right">
            <div className="ch-search-bar">
              <Search size={14} />
              <input type="text" placeholder="Search documents…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} className="ch-search-input" />
              {searchQuery && <button className="ch-search-clear" onClick={() => setSearchQuery('')}><X size={12} /></button>}
            </div>
            <div className="ch-view-toggle">
              <button className={`ch-view-toggle-btn ${viewMode === 'grid' ? 'ch-view-toggle-btn--active' : ''}`}
                onClick={() => setViewMode('grid')}><Grid size={14} /></button>
              <button className={`ch-view-toggle-btn ${viewMode === 'list' ? 'ch-view-toggle-btn--active' : ''}`}
                onClick={() => setViewMode('list')}><ListIcon size={14} /></button>
            </div>
            <button className="ch-icon-btn" onClick={loadDocs} title="Refresh"><RefreshCw size={14} /></button>
          </div>
        </div>

        {docsLoading ? (
          <div className="ch-docs-loading"><Loader2 size={24} className="ch-spinner" /><p>Loading documents…</p></div>
        ) : docsError ? (
          <div className="ch-docs-error"><AlertCircle size={20} /><p>{docsError}</p>
            <button className="ch-btn ch-btn--ghost" onClick={loadDocs}>Retry</button>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="ch-docs-empty">
            <div className="ch-docs-empty-illustration"><FileText size={48} /></div>
            <h3>No documents yet</h3>
            <p>{docTab === 'community' ? 'No community resources uploaded yet. Be the first!'
              : docTab === 'mine' ? "You haven't uploaded any documents for this subject yet."
              : 'No documents available. Upload one to get started!'}</p>
            <button className="ch-btn ch-btn--primary" onClick={() => setUploadOpen(true)}>
              <Upload size={14} />Upload First Document
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'ch-docs-grid' : 'ch-docs-list'}>
            {filteredDocs.map(doc => (
              <DocCard key={doc.id} doc={doc} viewMode={viewMode}
                onDelete={handleDelete} isOwn={doc.owner_is_me !== false} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── CUSTOM VIEW ──────────────────────────────────────────────────────────
  const CustomView = () => (
    <div className="ch-custom-view">
      <div className="ch-view-header">
        <button className="ch-back-btn" onClick={goBack}><ChevronLeft size={20} /></button>
        <div className="ch-view-header-info">
          <Plus size={20} />
          <div>
            <h2 className="ch-view-title">Add Your Own Context</h2>
            <p className="ch-view-subtitle">Upload your own study materials for AI context</p>
          </div>
        </div>
      </div>

      <div className="ch-custom-grid">
        <div className="ch-custom-card">
          <Upload size={24} />
          <h3>Upload Documents</h3>
          <p>Upload PDFs, text files, or markdown notes. The AI will use these as additional context when you chat.</p>
          <button className="ch-btn ch-btn--primary" onClick={() => setUploadOpen(true)}>
            <Upload size={14} />Choose File
          </button>
        </div>
        <div className="ch-custom-card">
          <Globe size={24} />
          <h3>Import from URL</h3>
          <p>Paste a direct link to a PDF or text file hosted online. Works with direct download links.</p>
          <button className="ch-btn ch-btn--ghost" disabled><Globe size={14} />Coming Soon</button>
        </div>
        <div className="ch-custom-card ch-custom-card--info">
          <Shield size={24} />
          <h3>Privacy Controls</h3>
          <p>Every document you upload can be kept <strong>private</strong> (only you) or shared as <strong>community</strong> resources to help other students.</p>
        </div>
        <div className="ch-custom-card ch-custom-card--info">
          <Sparkles size={24} />
          <h3>How Context Works</h3>
          <p>When HS Mode is on, the AI tutor, flashcard generator, quiz maker, and notes all receive relevant excerpts from your selected documents — making answers more curriculum-specific.</p>
        </div>
      </div>

      <div className="ch-custom-my-docs">
        <div className="ch-custom-my-docs-header">
          <h3><FileText size={16} />My Documents</h3>
          <button className="ch-icon-btn" onClick={loadDocs} title="Refresh"><RefreshCw size={14} /></button>
        </div>
        {docsLoading ? (
          <div className="ch-docs-loading"><Loader2 size={20} className="ch-spinner" /><p>Loading…</p></div>
        ) : myDocs.length === 0 ? (
          <div className="ch-docs-empty-inline"><FileText size={24} /><p>No documents uploaded yet.</p></div>
        ) : (
          <div className="ch-docs-list">
            {myDocs.map(doc => (
              <DocCard key={doc.id} doc={doc} viewMode="list" onDelete={handleDelete} isOwn />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── ASK YOUR NOTES ───────────────────────────────────────────────────────
  const AskView = () => (
    <div className="ch-ask-view">
      <div className="ch-ask-header">
        <div className="ch-ask-header-info">
          <MessageCircle size={22} className="ch-ask-header-icon" />
          <div>
            <h2 className="ch-ask-title">Ask Your Notes</h2>
            <p className="ch-ask-subtitle">
              Ask any question — the AI will answer using your uploaded documents and the HS curriculum.
            </p>
          </div>
        </div>
        <label className="ch-ask-hs-toggle">
          <input
            type="checkbox"
            checked={askUseHs}
            onChange={e => setAskUseHs(e.target.checked)}
          />
          <span className="ch-ask-hs-label">Include curriculum</span>
        </label>
      </div>

      {askHistory.length === 0 ? (
        <div className="ch-ask-empty">
          <div className="ch-ask-empty-icon"><MessageCircle size={48} /></div>
          <h3>Ask anything about your documents</h3>
          <p>Upload notes, textbooks, or any study material — then ask questions and get cited answers.</p>
          <div className="ch-ask-suggestions">
            {[
              'What are the key concepts in this subject?',
              'Summarise the main topics covered',
              'Explain the most important formulas',
              'What should I focus on for the exam?',
            ].map(s => (
              <button
                key={s}
                className="ch-ask-suggestion-chip"
                onClick={() => { setAskInput(s); }}
              >
                <ArrowRight size={12} />{s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ch-ask-history">
          {askHistory.map((item, idx) => (
            <div key={idx} className="ch-ask-turn">
              <div className="ch-ask-question">
                <div className="ch-ask-q-bubble">{item.question}</div>
              </div>

              {item.loading ? (
                <div className="ch-ask-answer ch-ask-answer--loading">
                  <Loader2 size={18} className="ch-spinner" />
                  <span>Searching your knowledge base…</span>
                </div>
              ) : item.error ? (
                <div className="ch-ask-answer ch-ask-answer--error">
                  <AlertCircle size={16} />
                  <span>{item.error}</span>
                </div>
              ) : (
                <div className="ch-ask-answer">
                  <div className="ch-ask-a-bubble">
                    {item.answer}
                  </div>
                  {item.sources && item.sources.length > 0 && (
                    <div className="ch-ask-sources">
                      <p className="ch-ask-sources-label">
                        <BookOpen size={12} />Sources used
                      </p>
                      <div className="ch-ask-source-chips">
                        {item.sources.map((src, si) => (
                          <div key={si} className={`ch-ask-source-chip ch-ask-source-chip--${src.source}`}>
                            <FileText size={11} />
                            <span className="ch-ask-source-name">
                              [{si + 1}] {src.filename}
                              {src.page && <em> p.{src.page}</em>}
                            </span>
                            {src.subject && (
                              <span className="ch-ask-source-subject">
                                <Tag size={9} />{src.subject}
                              </span>
                            )}
                            {src.source === 'hs' && (
                              <span className="ch-ask-source-hs-badge">Curriculum</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={askEndRef} />
        </div>
      )}

      <div className="ch-ask-input-area">
        <div className="ch-ask-input-wrap">
          <textarea
            className="ch-ask-textarea"
            placeholder="Ask a question about your notes…"
            value={askInput}
            onChange={e => setAskInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); }
            }}
            rows={2}
            disabled={askLoading}
          />
          <button
            className="ch-ask-send-btn"
            onClick={handleAsk}
            disabled={askLoading || !askInput.trim()}
            title="Send"
          >
            {askLoading ? <Loader2 size={16} className="ch-spinner" /> : <Send size={16} />}
          </button>
        </div>
        <p className="ch-ask-hint">
          {myDocs.length === 0
            ? <>No documents uploaded yet. <button className="ch-ask-hint-link" onClick={() => setUploadOpen(true)}>Upload one</button> to get started.</>
            : <>Searching across {myDocs.length} document{myDocs.length !== 1 ? 's' : ''}{askUseHs ? ' + curriculum' : ''}. Press Enter to send.</>
          }
        </p>
      </div>
    </div>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const renderView = () => {
    if (view === 'landing')    return <LandingView />;
    if (view === 'curriculum') return <CurriculumView />;
    if (view === 'grade')      return <GradeView />;
    if (view === 'subject')    return <SubjectView />;
    if (view === 'custom')     return <CustomView />;
    if (view === 'ask')        return <AskView />;
    return <LandingView />;
  };

  return (
    <div className="ch-page" data-view={view}>
      <header className="hub-header">
        <div className="hub-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="hub-logo" onClick={() => navigate('/search-hub')}>
            <div className="hub-logo-img" />
            cerbyl
          </h1>
          <div className="hub-header-divider"></div>
          <p className="hub-header-subtitle">CONTEXT HUB</p>
        </div>
      </header>

      <div className="ch-layout">
        <Sidebar />
        <main className="ch-main">
          <button className="ch-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? <X size={16} /> : <Library size={16} />}
          </button>

          {view !== 'landing' && (
            <Breadcrumb
              curriculum={selectedCurriculum}
              grade={selectedGrade}
              subject={selectedSubject}
              onLanding={goLanding}
              onCurriculum={() => setSearchParams({ c: urlC })}
              onGrade={() => setSearchParams({ c: urlC, g: String(urlG) })}
            />
          )}

          <div className="ch-main-content">{renderView()}</div>
        </main>
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        curriculum={selectedCurriculum}
        grade={selectedGrade}
        subject={selectedSubject}
        onUploaded={loadDocs}
      />
    </div>
  );
}
