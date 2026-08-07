/**
 * SEO URL Helper Utilities for AIRGATE
 * Standardizes clean URLs for GATE PYQs and Practice Questions across the entire application.
 */

const SLUG_MAP = {
  'dbms': 'Database Management Systems',
  'os': 'Operating Systems',
  'cn': 'Computer Networks',
  'dsa': 'Data Structures and Algorithms',
  'toc': 'Theory of Computation',
  'compiler': 'Compiler Design',
  'coa': 'Computer Organization and Architecture',
  'digital': 'Digital Logic',
  'discrete': 'Discrete Mathematics',
  'em': 'Engineering Mathematics',
  'aptitude': 'General Aptitude',
};

const REVERSE_SLUG_MAP = {
  'database management systems': 'dbms',
  'databases': 'dbms',
  'dbms': 'dbms',
  'operating systems': 'os',
  'operating system': 'os',
  'os': 'os',
  'computer networks': 'cn',
  'computer network': 'cn',
  'cn': 'cn',
  'data structures and algorithms': 'dsa',
  'data structures & algorithms': 'dsa',
  'data structures': 'dsa',
  'algorithms': 'dsa',
  'dsa': 'dsa',
  'theory of computation': 'toc',
  'automata': 'toc',
  'toc': 'toc',
  'compiler design': 'compiler',
  'compilers': 'compiler',
  'cd': 'compiler',
  'computer organization and architecture': 'coa',
  'computer organization': 'coa',
  'coa': 'coa',
  'digital logic': 'digital',
  'digital logic design': 'digital',
  'digital systems': 'digital',
  'dl': 'digital',
  'discrete mathematics': 'discrete',
  'discrete maths': 'discrete',
  'dm': 'discrete',
  'engineering mathematics': 'em',
  'maths': 'em',
  'em': 'em',
  'general aptitude': 'aptitude',
  'aptitude': 'aptitude',
  'ga': 'aptitude',
};

/**
 * Returns clean subject slug (e.g., 'dbms', 'os', 'cn', 'dsa')
 */
export function getSubjectSlug(subjectName) {
  if (!subjectName) return 'general';
  const norm = subjectName.trim().toLowerCase();
  if (REVERSE_SLUG_MAP[norm]) {
    return REVERSE_SLUG_MAP[norm];
  }
  return norm.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
}

/**
 * Returns canonical Subject Name from slug
 */
export function getSubjectNameFromSlug(slug) {
  if (!slug) return '';
  const key = slug.trim().toLowerCase();
  return SLUG_MAP[key] || key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Generates clean public SEO URL for a Question object
 */
export function getQuestionUrl(q) {
  if (!q) return '/gate/cse';

  // If backend already attached a pre-computed seoUrl
  if (q.seoUrl) {
    return q.seoUrl;
  }

  const pdfSource = q.pdfSourceName || '';
  const isAiPractice = pdfSource.toLowerCase().includes('ai_nightly') ||
                       pdfSource.toLowerCase().includes('ai_generated') ||
                       pdfSource.toLowerCase().includes('practice');

  const qNum = q.questionNumber || q.id;

  if (isAiPractice) {
    const subSlug = getSubjectSlug(q.subjectName || q.subject);
    return `/practice/${subSlug}/q${qNum}`;
  }

  const branch = (q.branch || 'cse').toLowerCase();
  const year = q.year || 2025;
  const setNum = q.paperSet || 1;

  return `/gate/${branch}/${year}/set-${setNum}/q${qNum}`;
}

/**
 * Parses route params into structured GATE parameters
 */
export function parseGateParams(params = {}) {
  const branch = (params.branch || 'cse').toLowerCase();
  const year = params.year ? parseInt(params.year, 10) : null;
  
  let paperSet = 1;
  if (params.set) {
    const cleaned = params.set.toLowerCase().replace('set-', '').replace('set', '').trim();
    paperSet = parseInt(cleaned, 10) || 1;
  }

  let questionNumber = null;
  if (params.qNum) {
    const cleaned = params.qNum.toLowerCase().replace('q', '').trim();
    questionNumber = parseInt(cleaned, 10) || null;
  }

  return { branch, year, paperSet, questionNumber };
}

/**
 * Parses route params into structured Practice parameters
 */
export function parsePracticeParams(params = {}) {
  const subjectSlug = (params.subjectSlug || 'general').toLowerCase();
  const subjectName = getSubjectNameFromSlug(subjectSlug);

  let questionNumber = null;
  if (params.qNum) {
    const cleaned = params.qNum.toLowerCase().replace('q', '').trim();
    questionNumber = parseInt(cleaned, 10) || null;
  }

  return { subjectSlug, subjectName, questionNumber };
}
