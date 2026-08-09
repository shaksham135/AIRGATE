import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import { formatMathText, formatMathTextToHtml, renderQuestionText, getAssetUrl } from '../utils/mathRenderer';
import { getQuestionUrl } from '../utils/urlUtils';
import API_CONFIG from '../config/api';
import LoginGate from '../components/LoginGate';
import PremiumGateModal from '../components/PremiumGateModal';
import { 
  FiBookmark, FiCheckCircle, FiXCircle, FiFolder, FiActivity, 
  FiTrash, FiTrendingUp, FiCheck, FiX, FiClock 
} from 'react-icons/fi';

const GATE_KNOWLEDGE_BASE = {
  "Database Management Systems": {
    "normalization": {
      study: "Revise candidate keys identification algorithms. Read 3NF and BCNF definitions. Remember: BCNF requires LHS of every non-trivial FD to be a super key. 3NF allows RHS to be a prime attribute.",
      focus: "Lossless-join decomposition and Dependency Preservation tests. Trace attribute closures (X+).",
      solve: "Solve 5 NAT-style normalization problems. Practice identifying candidate keys under 90 seconds."
    },
    "transactions": {
      study: "Study conflict serializability using precedence graphs (cycles imply not conflict serializable). Review conflict equivalents, view serializability, and 2-Phase Locking (2PL) vs Strict 2PL.",
      focus: "Precedence graph construction, cascading aborts, deadlock detection, and strict 2PL properties.",
      solve: "Solve 6 conflict serializability schedule tracing questions. Trace lock releases."
    },
    "indexing": {
      study: "Learn B and B+ tree node structures. B+ trees store all data pointers at leaf nodes. Calculate the maximum number of keys/pointers in a node of size B bytes.",
      focus: "Tree height bounds, node split/merge rules, and block access counts.",
      solve: "Practice numerical problems on B-tree / B+ tree search times and index node sizes."
    },
    "sql": {
      study: "Focus on nested subqueries, GROUP BY, HAVING, and JOIN types. Understand relational algebra operators (projection, selection, join, division).",
      focus: "Relational algebra division queries, tuple relational calculus, and SQL aggregation queries.",
      solve: "Attempt 5 SQL query output prediction questions. Focus on queries with NULL handling."
    },
    "general": {
      study: "Review ER-model mappings to tables (1:1, 1:N, N:M relationship cardinality and participation constraints).",
      focus: "Minimal key attributes for relationship tables, referential integrity constraints.",
      solve: "Practice 4 schema mapping exercises on the Explorer page."
    }
  },
  "Computer Networks": {
    "flow control": {
      study: "Understand Sliding Window Protocol efficiency formulas: U = N / (1 + 2a) where a = Propagation Delay (Tp) / Transmission Delay (Tt). Recall Tp = distance / speed, Tt = packet size / bandwidth.",
      focus: "Go-Back-N (GBN) sequence numbers (needs N+1 sequence numbers, receiver window = 1) and Selective Repeat (SR) sequence numbers (receiver window = sender window = 2^k / 2).",
      solve: "Solve 8 efficiency calculation problems. Focus on finding maximum utilization and minimum bits for sequence numbers."
    },
    "ip addressing": {
      study: "Master Classless Inter-Domain Routing (CIDR) subnet masking, network prefix length, and host address ranges. Remember first address is Network ID and last is Directed Broadcast Address.",
      focus: "Subnet aggregation, supernetting, and IP fragmentation calculations (Offset is represented in 8-byte units, Identification fields).",
      solve: "Solve 6 subnet division and routing table lookup problems. Practice NAT (Network Address Translation)."
    },
    "routing": {
      study: "Contrast Distance Vector Routing (Bellman-Ford, Count-to-Infinity problem, split horizon) and Link State Routing (Dijkstra's shortest path, LSP flood).",
      focus: "Routing table convergence updates and Dijkstra iteration steps.",
      solve: "Solve 4 Dijkstra shortest path questions on graph representations."
    },
    "tcp/udp": {
      study: "Compare TCP (congestion control, congestion window phases) and UDP. Congestion phases: Slow Start, Congestion Avoidance, Fast Retransmit, Fast Recovery.",
      focus: "TCP segment headers, congestion window calculation after timeouts vs triple-ACKs.",
      solve: "Solve 5 congestion window sizing questions. Note the difference between timeout (drops to 1 MSS) and 3 duplicate ACKs (halves cwnd)."
    },
    "general": {
      study: "Review OSI reference model layers, Ethernet CSMA/CD backoff algorithm and slot time, and wireless CSMA/CA.",
      focus: "CSMA/CD minimum frame size formula: L >= 2 * Tp * Bandwidth.",
      solve: "Solve 4 ethernet collision and transmission time problems."
    }
  },
  "Operating Systems": {
    "scheduling": {
      study: "Study preemptive and non-preemptive CPU scheduling policies: FCFS, SJF, SRTF (Shortest Remaining Time First), Round Robin, and Priority Scheduling.",
      focus: "Gantt chart construction, calculating average waiting time, turnaround time, and response time.",
      solve: "Practice 6 gantt-chart tracking problems. Focus on SRTF when multiple processes arrive at different time units."
    },
    "synchronization": {
      study: "Understand the requirements for Critical Section solutions: Mutual Exclusion, Progress, and Bounded Waiting. Study semaphores (Wait/P: decrement, Signal/V: increment) and Mutex locks.",
      focus: "Counting semaphore range value checks, Peterson's solution proofs, and classical IPC problems (Producer-Consumer, Dining Philosophers).",
      solve: "Solve 6 semaphore execution trace questions. Determine if a code block guarantees mutual exclusion or deadlocks."
    },
    "deadlock": {
      study: "Study the four necessary conditions for deadlock. Review Banker's Algorithm for deadlock avoidance (Safe vs Unsafe states).",
      focus: "Resource allocation graphs, Max/Allocation/Need matrix calculations, and finding safe sequences.",
      solve: "Solve 5 Banker's algorithm matrix calculation problems."
    },
    "memory management": {
      study: "Understand Logical vs Physical addresses, Paging, Segmentation, and TLB. Study Page Replacement Algorithms: FIFO, Optimal, LRU, and Belady's Anomaly.",
      focus: "Effective Access Time (EAT) formulas, page table size calculations, and virtual to physical translations.",
      solve: "Attempt 8 virtual memory address translation and TLB/Page table size calculations. Practice page fault count problems."
    },
    "general": {
      study: "Review user mode vs kernel mode, system calls, fork() process creation trees, disk scheduling (SSTF, SCAN, C-SCAN).",
      focus: "Calculating the number of processes created by nested fork() calls: 2^N.",
      solve: "Practice fork() tracing and disk seek-time questions."
    }
  },
  "Theory of Computation": {
    "finite automata": {
      study: "Study Deterministic Finite Automata (DFA), NFA, Epsilon-NFA, Regular Expressions, and Min-DFA construction using equivalence partition.",
      focus: "Designing DFA with minimum states for languages (e.g. substring match, modulo arithmetic).",
      solve: "Practice 6 DFA state minimization questions. Find the minimum states for a specified regular language."
    },
    "context-free grammars": {
      study: "Review Context-Free Grammars (CFG), Pushdown Automata (PDA) models, Context-Free Languages (CFL) vs deterministic CFLs, and parse tree ambiguity.",
      focus: "Equivalence of CFG and PDA. Language recognition patterns (e.g., matching parentheses, equal counts).",
      solve: "Solve 5 grammar parsing and language containment questions."
    },
    "turing machines": {
      study: "Understand Turing Machine variations, RE languages (recognized by TM), Recursive languages (decided by TM), Halting Problem of Turing Machine, and Diagonalization.",
      focus: "Rice's Theorem applications. Membership, emptiness, finiteness decidability properties.",
      solve: "Study closure tables and solve 8 decidability/undecidability questions. Trace reduction proofs."
    },
    "general": {
      study: "Understand regular grammar classifications and Chomsky hierarchy structures.",
      focus: "Language closure properties under union, intersection, complement, concatenation, and Kleene star.",
      solve: "Solve 6 language closure property mapping questions."
    }
  },
  "Compiler Design": {
    "parsing": {
      study: "Understand LL(1) parsing rules (First & Follow sets, parse table collisions). Master LR parsers: LR(0), SLR(1), LALR(1), CLR(1).",
      focus: "Calculating First and Follow sets, identifying conflicts (Shift-Reduce, Reduce-Reduce) in parsing tables.",
      solve: "Solve 6 First/Follow set and LL(1)/SLR(1) state generation questions. LALR vs CLR states count."
    },
    "syntax-directed translation": {
      study: "Focus on Synthesized attributes (bottom-up, S-attributed definitions) and Inherited attributes (top-down, L-attributed definitions). Evaluate expressions using dependency graphs.",
      focus: "S-attributed and L-attributed evaluation order, syntax tree annotations.",
      solve: "Solve 4 compiler semantic evaluation questions."
    },
    "optimization": {
      study: "Review Basic Blocks and Flow Graphs (DAGs). Read loop optimization methods, common subexpression elimination, constant folding, and dead code elimination.",
      focus: "Register allocation algorithms and calculating minimum registers needed for a DAG representation.",
      solve: "Solve 5 optimization and three-address code structure problems."
    },
    "general": {
      study: "Review Lexical analysis, tokens, patterns, lexemes, lexer buffer schemes, and regular expression mapping.",
      focus: "Finding the number of tokens in a C code snippet.",
      solve: "Attempt 3 token count questions."
    }
  },
  "Digital Logic": {
    "minimization": {
      study: "Review Boolean Algebra laws, Duality, SOP and POS representations, Karnaugh Maps (K-maps), prime implicants, and essential prime implicants.",
      focus: "Grouping rules in 3/4-variable K-maps, finding minimum logic gate realizations.",
      solve: "Solve 6 algebraic simplification and K-map optimization problems."
    },
    "combinational": {
      study: "Study standard modules: Multiplexers, Decoders, Encoders, Demultiplexers, Half/Full Adders, and Carry Lookahead Adders.",
      focus: "Implementing boolean functions using MUX, decoder logical equivalents.",
      solve: "Solve 5 combinational logic designs."
    },
    "sequential": {
      study: "Trace latch/flip-flop actions (SR, JK, D, T, Setup & Hold times). Study counters (synchronous vs asynchronous, mod-N counters) and shift registers.",
      focus: "State diagrams, transition tables, finding sequence patterns of synchronous counters, and maximum frequency limits.",
      solve: "Solve 6 synchronous counter sequence analysis problems."
    },
    "general": {
      study: "Understand fixed-point number systems (unsigned, signed magnitude, 2's complement) and overflow conditions.",
      focus: "2's complement arithmetic and range representations.",
      solve: "Practice 4 signed arithmetic conversion questions."
    }
  },
  "Computer Organization and Architecture": {
    "pipeline": {
      study: "Understand pipeline execution stages, Clock cycle time, throughput, speedup factors, and Pipeline Hazards: Structural, Data (RAW, WAR, WAW), Control (branches).",
      focus: "Speedup, throughput, and efficiency formulas. Pipelining execution cycle calculations with stall cycles.",
      solve: "Solve 6 pipeline speedup calculations under control or data hazards."
    },
    "memory": {
      study: "Master cache organizations: Direct Mapping, Fully Associative Mapping, Set-Associative Mapping. Review Cache block size, tags, index, word offsets, and Cache Replacement Policies (LRU).",
      focus: "Cache tag memory size calculation, hit ratio, average memory access time (AMAT) formula.",
      solve: "Solve 8 cache layout mapping and AMAT numerical problems."
    },
    "general": {
      study: "Understand machine instructions, addressing modes, hardwired and microprogrammed control units, horizontal/vertical microinstructions, DMA.",
      focus: "IEEE-754 single-precision floating point conversion steps and range calculations.",
      solve: "Solve 4 DMA cycle-stealing calculations and 4 instruction layout planning problems."
    }
  },
  "Algorithms": {
    "analysis": {
      study: "Master asymptotic notation (Big-O, Omega, Theta). Solve recurrences using Master Theorem, recursion trees, or substitution.",
      focus: "Solving recurrences with irregular branches, comparing functions growth rates.",
      solve: "Solve 6 recurrence relation and runtime comparison questions."
    },
    "sorting": {
      study: "Analyze sorting algorithms: Bubble, Insertion, Selection, Merge, Quick (randomized pivot), Heap (heapify, build-heap runtime).",
      focus: "Sorting space complexities, stability, in-place features, and comparison lower bounds (N log N).",
      solve: "Solve 5 sorting execution trace and comparison count problems."
    },
    "dynamic programming": {
      study: "Review dynamic programming foundations: Optimal Substructure, Overlapping Subproblems. Trace LCS, Matrix Chain Multiplication, 0/1 Knapsack, and Subset Sum.",
      focus: "DP state equations, time/space complexity, and traceback step tables.",
      solve: "Solve 4 DP formulation and optimal value calculations."
    },
    "graph": {
      study: "Review BFS, DFS, Topological Sort. Shortest Paths: Dijkstra, Bellman-Ford, Floyd-Warshall. MST: Prim's, Kruskal's.",
      focus: "Relaxation inequality, edge weights constraints, topological ordering uniqueness, and DFS parenthetical structure.",
      solve: "Solve 8 graph traversal, MST edge selection, and shortest-path trace questions."
    },
    "general": {
      study: "Review Greedy algorithms, Divide & Conquer. Understand NP-completeness definition and basic reductions.",
      focus: "Greedy choice property validation, Clique vs Vertex Cover reductions.",
      solve: "Attempt 4 vertex cover and complexity classification questions."
    }
  },
  "Programming and Data Structures": {
    "trees": {
      study: "Study Binary Trees (preorder, inorder, postorder, level order), BSTs (insertion, deletion, search, inorder successor), AVL Trees, Binary Heaps.",
      focus: "Constructing trees from traversals, AVL height/node bounds, Heap index properties.",
      solve: "Solve 8 tree height, traversals, and heap array manipulation questions."
    },
    "stacks": {
      study: "Understand Stack operations, Queue operations, Circular Queues, Infix to Postfix conversion, and Postfix expression evaluation.",
      focus: "Implementing Stacks using Queues and vice-versa, matching parentheses using stack, and recursion-stack sizing.",
      solve: "Solve 6 postfix evaluation and stack size limit calculations."
    },
    "hashing": {
      study: "Calculate multi-dimensional array address offsets (row-major vs column-major). Understand hash functions and collision resolution: Chaining, Open Addressing.",
      focus: "Effective probe counts for successful/unsuccessful search in hashing, row-major offset calculations.",
      solve: "Solve 5 address offsets and collision hashing trace problems."
    },
    "general": {
      study: "Review Singly, Doubly, and Circular Linked Lists operations and runtimes. Focus on pointer update ordering.",
      focus: "Pointers update ordering to prevent node list leaks.",
      solve: "Solve 4 pointer tracing questions."
    }
  },
  "Engineering Mathematics": {
    "linear algebra": {
      study: "Review Matrix Arithmetic, Systems of Linear Equations (Gaussian elimination, rank, consistency), Determinants, Eigenvalues and Eigenvectors, Cayley-Hamilton Theorem.",
      focus: "Eigenvalues properties (sum equals trace, product equals determinant). Rank-nullity theorem.",
      solve: "Solve 6 system consistency and eigenvalue/eigenvector problems."
    },
    "probability": {
      study: "Master Conditional Probability, Bayes Theorem, Random Variables, Expectation, Variance, Discrete/Continuous Distributions.",
      focus: "Bayes theorem applications, expectation linearity, variance formulas.",
      solve: "Solve 8 conditional probability and random variable calculations."
    },
    "general": {
      study: "Review Calculus: limits, continuity, differentiability, Mean Value Theorems, Integration, Maxima and Minima.",
      focus: "Evaluating limits using L'Hopital's rule, finding local and global extrema.",
      solve: "Solve 4 calculus limit evaluation exercises."
    }
  },
  "Discrete Mathematics": {
    "logic": {
      study: "Review Propositional Logic (connectives, truth tables, tautologies), First-order Predicate Logic (quantifiers, negation rules).",
      focus: "Translating English sentences to Predicate Logic, verifying valid inferences.",
      solve: "Solve 6 logic equivalence and quantifier conversion questions."
    },
    "graphs": {
      study: "Study connectivity, paths, cycles, Eulerian graphs, Hamiltonian graphs, bipartite graphs, planarity (Euler's formula: V - E + F = 2, E <= 3V - 6), graph coloring.",
      focus: "Chromatic number bounds, planar graph edge limit, and tree properties.",
      solve: "Solve 8 planarity, coloring, and vertex-edge connectivity proofs."
    },
    "general": {
      study: "Review sets, relations (equivalence, partial order), lattices, functions. Combinatorics: Permutations, combinations, Pigeonhole Principle, Inclusion-Exclusion.",
      focus: "Pigeonhole distribution scenarios, solving linear homogeneous recurrences, Hasse diagrams.",
      solve: "Solve 6 combinatorial selection and recurrence relation setups."
    }
  },
  "General Aptitude": {
    "general": {
      study: "Revise quantitative aptitude: percentages, ratios, time-speed-distance, work-pipes, permutations. Verbal ability: basic grammar, critical reasoning. Spatial aptitude: shape rotation.",
      focus: "Critical reasoning arguments, verbal analogies, and percentage mixtures.",
      solve: "Solve 8 general aptitude puzzles and speed-distance quantitative questions."
    }
  }
};

export default function Bookmarks() {
  return (
    <LoginGate featureName="Prep Analyst" featureIcon="📊">
      <BookmarksContent />
    </LoginGate>
  );
}

function BookmarksContent() {
  const [stats, setStats] = useState({
    totalSolved: 0,
    correctCount: 0,
    incorrectCount: 0,
    bookmarkedCount: 0,
    accuracy: 0
  });
  const [bookmarks, setBookmarks] = useState([]);
  const [solvedHistory, setSolvedHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('readiness'); // 'readiness' | 'bookmarks' | 'solved'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfCompiling, setPdfCompiling] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({ includeAnswer: true, includeExplanation: false });

  const currentUser = AuthService.getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = AuthService.getAuthHeader();
      // 🚀 Parallel Request Pipeline (3x Speedup)
      const [statsRes, bookmarksRes, solvedRes] = await Promise.all([
        axios.get(`${API_CONFIG.BASE_URL}/api/questions/solve/stats`, { headers }),
        axios.get(`${API_CONFIG.BASE_URL}/api/bookmarks`, { headers }),
        axios.get(`${API_CONFIG.BASE_URL}/api/questions/solved`, { headers })
      ]);
      setStats(statsRes.data);
      setBookmarks(Array.isArray(bookmarksRes.data) ? bookmarksRes.data : []);
      setSolvedHistory(Array.isArray(solvedRes.data) ? solvedRes.data : []);

    } catch (e) {
      console.error('Failed to load user dashboard data', e);
      setError('Failed to retrieve user statistics and bookmarks.');
    } finally {
      setLoading(false);
    }
  };

  // Strip markdown artifacts from AI-generated text
  const cleanMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/#{1,6}\s+/g, '')          // Remove headings (#, ##, etc)
      .replace(/\*\*(.+?)\*\*/g, '$1')    // Bold
      .replace(/\*(.+?)\*/g, '$1')        // Italic
      .replace(/`{1,3}(.+?)`{1,3}/gs, '$1') // Code
      .replace(/^[-*+]\s+/gm, '• ')       // Bullets
      .replace(/^\d+\.\s+/gm, (m) => m)   // Keep numbered lists
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links -> just text
      .replace(/_{1,2}(.+?)_{1,2}/g, '$1') // Underline/italic
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleCompilePDF = () => {
    const isPremium = AuthService.isPremium();
    const hasUsedTrial = AuthService.hasUsedPdfTrial();

    if (bookmarks.length === 0) {
      alert('You have no bookmarked questions to compile. Bookmark some questions first!');
      return;
    }

    if (!isPremium && hasUsedTrial) {
      setShowPremiumModal(true);
      return;
    }

    setShowPdfModal(true);
  };

  const generatePDF = () => {
    setShowPdfModal(false);
    setPdfCompiling(true);

    const isPremium = AuthService.isPremium();
    const hasUsedTrial = AuthService.hasUsedPdfTrial();

    if (!isPremium && hasUsedTrial) {
      setPdfCompiling(false);
      setShowPremiumModal(true);
      return;
    }

    const isFreeTrial = !isPremium;

    // Free trial users get max 10 questions:
    const questionsToCompile = isFreeTrial ? bookmarks.slice(0, 10) : bookmarks;

    try {
      let printFrame = document.getElementById('airgate-pdf-print-iframe');
      if (printFrame) {
        printFrame.remove();
      }
      printFrame = document.createElement('iframe');
      printFrame.id = 'airgate-pdf-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const formattedDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
      
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>AIRGATE Revision Compilation PDF - ${formattedDate}</title>
          <meta charset="utf-8" />
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
            
            @page {
              size: A4;
              margin: 12mm 15mm 15mm 15mm;
            }
            
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              background: #ffffff;
              color: #0f172a;
              line-height: 1.6;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* KaTeX Custom Typography for Print */
            .katex { font-size: 1.05em !important; }
            .katex .mathnormal { color: #0284c7 !important; font-weight: 600; }
            .katex .mord, .katex .mbin, .katex .mrel, .katex .mop { color: #0f172a !important; }
            .katex .mtable { color: #4f46e5 !important; }
            .katex-display { margin: 0.75rem 0 !important; padding: 8px 12px !important; background: #f8fafc !important; border: 1px solid #cbd5e1 !important; border-radius: 6px !important; }
            
            /* Cover Page Header */
            .cover-header {
              background: linear-gradient(135deg, #0b0f19 0%, #1e1b4b 50%, #4f46e5 100%);
              color: #ffffff;
              padding: 32px 28px;
              border-radius: 12px;
              margin-bottom: 28px;
              page-break-after: avoid;
            }
            .cover-title {
              font-size: 28px;
              font-weight: 800;
              letter-spacing: -0.02em;
              color: #38bdf8;
              margin: 0 0 6px 0;
            }
            .cover-subtitle {
              font-size: 16px;
              font-weight: 600;
              color: #cbd5e1;
              margin: 0 0 16px 0;
            }
            .cover-meta {
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
              font-size: 12px;
              font-weight: 600;
            }
            .meta-badge {
              background: rgba(255, 255, 255, 0.12);
              border: 1px solid rgba(255, 255, 255, 0.2);
              padding: 4px 10px;
              border-radius: 20px;
              color: #f1f5f9;
            }
            .trial-badge {
              background: rgba(245, 158, 11, 0.25) !important;
              border-color: #f59e0b !important;
              color: #fbbf24 !important;
            }
            
            /* Question Cards */
            .q-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 20px;
              page-break-inside: avoid;
              background: #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.03);
            }
            .q-badge-row {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 12px;
            }
            .q-num-badge {
              background: #4f46e5;
              color: #ffffff;
              font-size: 12px;
              font-weight: 700;
              padding: 3px 10px;
              border-radius: 6px;
            }
            .tag-pill {
              font-size: 11px;
              font-weight: 600;
              color: #475569;
              background: #f1f5f9;
              padding: 2px 8px;
              border-radius: 4px;
            }
            .q-stem {
              font-size: 14px;
              font-weight: 500;
              color: #1e293b;
              margin-bottom: 14px;
            }
            .options-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 14px;
            }
            .option-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px 12px;
              font-size: 13px;
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            .option-lbl {
              font-weight: 700;
              color: #4f46e5;
              background: #e0e7ff;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              font-size: 11px;
            }
            
            /* Solutions & Answers */
            .ans-box {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 6px;
              padding: 10px 14px;
              font-size: 13px;
              color: #15803d;
              font-weight: 600;
              margin-top: 10px;
            }
            .exp-box {
              background: #faf5ff;
              border: 1px solid #e9d5ff;
              border-radius: 6px;
              padding: 12px 14px;
              font-size: 13px;
              color: #4c1d95;
              margin-top: 10px;
            }
            .exp-title {
              font-weight: 700;
              color: #6b21a8;
              margin-bottom: 6px;
              display: flex;
              align-items: center;
              gap: 6px;
            }

            .page-footer {
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              margin-top: 30px;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="cover-header">
            <h1 class="cover-title">AIRGATE</h1>
            <div class="cover-subtitle">GATE CSE Revision Compilation</div>
            <div class="cover-meta">
              ${isFreeTrial 
                ? `<span class="meta-badge trial-badge">🎁 1-Time Free Trial (${questionsToCompile.length} Questions) — Upgrade to Aspirant Pro for Unlimited PDFs</span>`
                : `<span class="meta-badge">📚 ${questionsToCompile.length} Premium Revision Questions</span>`
              }
              <span class="meta-badge">📅 ${formattedDate}</span>
              <span class="meta-badge">⚡ Full KaTeX Typeset</span>
            </div>
          </div>
      `;

      questionsToCompile.forEach((q, idx) => {
        const questionHtml = formatMathTextToHtml(q.text || '');

        let optionsList = [];
        if (q.options && Array.isArray(q.options) && q.options.length > 0) {
          optionsList = q.options.map(o => ({
            label: o.optionLabel ? o.optionLabel.toUpperCase() : '•',
            html: formatMathTextToHtml(o.optionText || '')
          }));
        }

        htmlContent += `
          <div class="q-card">
            <div class="q-badge-row">
              <span class="q-num-badge">Q${idx + 1}</span>
              ${q.year ? `<span class="tag-pill">GATE ${q.year}</span>` : ''}
              ${q.subjectName ? `<span class="tag-pill">${q.subjectName}</span>` : ''}
              ${q.topicName ? `<span class="tag-pill">${q.topicName}</span>` : ''}
              ${q.marks ? `<span class="tag-pill">${q.marks} Mark${q.marks > 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="q-stem">${questionHtml}</div>
        `;

        if (optionsList.length > 0) {
          htmlContent += `<div class="options-grid">`;
          optionsList.forEach(opt => {
            htmlContent += `
              <div class="option-box">
                <span class="option-lbl">${opt.label}</span>
                <div>${opt.html}</div>
              </div>
            `;
          });
          htmlContent += `</div>`;
        }

        const ansText = q.aiSuggestedAnswer || q.correctAnswer || q.answer || '';
        const answerHtml = ansText ? formatMathTextToHtml(ansText) : 'Not available';
        const expText = q.aiSuggestedExplanation || q.explanation || q.solution || '';

        if (pdfOptions.includeAnswer) {
          htmlContent += `
            <div class="ans-box">
              ✔️ Correct Answer: ${answerHtml}
            </div>
          `;
        }

        if (pdfOptions.includeExplanation && expText) {
          const explanationHtml = formatMathTextToHtml(expText);
          htmlContent += `
            <div class="exp-box">
              <div class="exp-title">💡 Step-by-Step KaTeX Explanation:</div>
              <div>${explanationHtml}</div>
            </div>
          `;
        }

        htmlContent += `</div>`;
      });

      htmlContent += `
          <div class="page-footer">
            AIRGATE — Gateway to All India Rank | Printed on ${formattedDate}
          </div>
        </body>
        </html>
      `;

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (e) {
          console.error("Frame print failed:", e);
        }
        setPdfCompiling(false);
      }, 600);

      // Securely log PDF compilation & lock trial in PostgreSQL DB
      try {
        axios.post(`${API_CONFIG.BASE_URL}/api/analytics/pdf-download`, {
          email: currentUser?.email || 'aspirant@airgate.in'
        }, { headers: AuthService.getAuthHeader() })
        .then(res => {
          if (res.data && res.data.hasUsedPdfTrial) {
            AuthService.updatePdfTrialStatus(true);
          }
        })
        .catch(err => {
          if (err.response && err.response.status === 403) {
            AuthService.updatePdfTrialStatus(true);
          }
        });
      } catch (ignored) {}
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setPdfCompiling(false);
    }
  };

  const handleRemoveBookmark = async (e, qId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/${qId}/bookmark`, {
        headers: AuthService.getAuthHeader()
      });
      setBookmarks(bookmarks.filter(b => b.id !== qId));
      // Update stats count
      setStats(prev => ({
        ...prev,
        bookmarkedCount: prev.bookmarkedCount - 1
      }));
    } catch (err) {
      console.error('Failed to remove bookmark', err);
    }
  };

  const getReadinessAnalysis = () => {
    if (!solvedHistory || solvedHistory.length === 0) {
      return null;
    }

    const topicStats = {};
    const subjectStats = {};
    let totalSolvingTime = 0;
    let timedAttempts = 0;
    let wastedMarks = 0;
    let totalRetryAttempts = 0;
    let successfulRetryRecovery = 0;
    let questionsRetriedCount = 0;

    let pyqCount = 0;
    let practiceCount = 0;
    
    solvedHistory.forEach(item => {
      const q = item.question;
      if (!q) return;

      const pdfSource = (q.pdfSourceName || '').toUpperCase();
      const isPractice = pdfSource === 'AI_NIGHTLY_GENERATOR' || pdfSource === 'AI_GENERATED';
      if (isPractice) {
        practiceCount += 1;
      } else {
        pyqCount += 1;
      }

      const subj = q.subjectName || 'General';
      const topic = q.topicName || 'General';
      const isCorrect = item.isCorrect;
      const timeSec = item.solvingTimeSeconds != null ? Number(item.solvingTimeSeconds) : null;
      const retryCount = item.retryCount || (item.attemptsCount && item.attemptsCount > 1 ? item.attemptsCount - 1 : 0);

      if (retryCount > 0) {
        totalRetryAttempts += retryCount;
        questionsRetriedCount += 1;
        if (isCorrect) successfulRetryRecovery += 1;
      }

      if (!isCorrect && q.questionType === 'MCQ') {
        wastedMarks += q.marks === 1 ? 0.33 : 0.66;
      }

      if (timeSec != null && timeSec > 0) {
        totalSolvingTime += timeSec;
        timedAttempts += 1;
      }

      if (!topicStats[topic]) {
        topicStats[topic] = {
          topic,
          subject: subj,
          attempts: 0,
          correct: 0,
          accuracy: 0,
          totalTime: 0,
          timedCount: 0,
          avgTime: 0,
          retries: 0
        };
      }
      topicStats[topic].attempts += 1;
      topicStats[topic].retries += retryCount;
      if (isCorrect) topicStats[topic].correct += 1;
      if (timeSec != null && timeSec > 0) {
        topicStats[topic].totalTime += timeSec;
        topicStats[topic].timedCount += 1;
      }

      if (!subjectStats[subj]) {
        subjectStats[subj] = {
          subject: subj,
          attempts: 0,
          correct: 0,
          accuracy: 0,
          totalTime: 0,
          timedCount: 0,
          avgTime: 0,
          retries: 0
        };
      }
      subjectStats[subj].attempts += 1;
      subjectStats[subj].retries += retryCount;
      if (isCorrect) subjectStats[subj].correct += 1;
      if (timeSec != null && timeSec > 0) {
        subjectStats[subj].totalTime += timeSec;
        subjectStats[subj].timedCount += 1;
      }
    });

    Object.keys(topicStats).forEach(key => {
      const t = topicStats[key];
      t.accuracy = Math.round((t.correct / t.attempts) * 100);
      t.avgTime = t.timedCount > 0 ? Math.round(t.totalTime / t.timedCount) : 0;
    });

    Object.keys(subjectStats).forEach(key => {
      const s = subjectStats[key];
      s.accuracy = Math.round((s.correct / s.attempts) * 100);
      s.avgTime = s.timedCount > 0 ? Math.round(s.totalTime / s.timedCount) : 0;
    });

    const topicsArray = Object.values(topicStats);
    const subjectsArray = Object.values(subjectStats);

    const strongestTopics = topicsArray
      .filter(t => t.accuracy >= 75)
      .sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts);

    const weakestTopics = topicsArray
      .filter(t => t.accuracy < 50)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

    const needsReviewTopics = topicsArray
      .filter(t => t.accuracy >= 50 && t.accuracy < 75)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

    const recommendations = [];

    // 0. Retry Behavior Analysis (NEW)
    if (questionsRetriedCount > 0) {
      const recoveryRate = Math.round((successfulRetryRecovery / questionsRetriedCount) * 100);
      if (recoveryRate >= 70) {
        recommendations.push({
          type: 'success',
          title: '🔄 Excellent Perseverance & Self-Correction',
          text: `You retried ${questionsRetriedCount} questions and successfully converted ${recoveryRate}% of them into correct answers! This demonstrates high analytical adaptability and active learning.`
        });
      } else {
        recommendations.push({
          type: 'warning',
          title: '⚠️ Retry Guessing Risk',
          text: `You have used ${totalRetryAttempts} total retry resets across ${questionsRetriedCount} questions, but only achieved a ${recoveryRate}% recovery rate on retries. Be careful not to use retries as trial-and-error guesses. Always re-derive the mathematical steps on paper before submitting your second attempt.`
        });
      }
    }

    // 1. Deficit warning (Accuracy < 50%)
    if (weakestTopics.length > 0) {
      const w = weakestTopics[0];
      recommendations.push({
        type: 'critical',
        title: '⚠️ Accuracy Deficit Warning',
        text: `You have an accuracy of ${w.accuracy}% in "${w.topic}" (${w.subject}). For GATE, incorrect answers carry a 1/3 (1-mark) or 2/3 (2-mark) negative penalty. A low accuracy indicates conceptual loopholes or random guessing. Recommend stopping practice runs immediately to focus on core textbooks.`
      });
    }

    // 2. Stagnation Warning (Multiple attempts with poor accuracy)
    const stagnating = topicsArray.find(t => t.attempts >= 3 && t.accuracy < 60);
    if (stagnating) {
      recommendations.push({
        type: 'warning',
        title: '🔄 Concept Stagnation Detected',
        text: `In "${stagnating.topic}", you have solved ${stagnating.attempts} questions but only achieved ${stagnating.accuracy}% accuracy. This indicates systematically misunderstanding a core assumption. Review solved explanations step-by-step.`
      });
    }

    // 3. Timing / Solving Speed Warning (High accuracy but slow solving speed)
    const slowButAccurate = topicsArray.find(t => t.avgTime > 180 && t.accuracy >= 70);
    if (slowButAccurate) {
      recommendations.push({
        type: 'info',
        title: '⏱️ Solving Speed Bottleneck',
        text: `Your accuracy in "${slowButAccurate.topic}" is excellent (${slowButAccurate.accuracy}%), but your average solving time is ${slowButAccurate.avgTime} seconds. In the actual GATE exam, this speed will create severe time pressure. Practice timer-based runs to build fluency.`
      });
    }

    // 4. Impulsive Solving Warning (Fast but wrong)
    const impulsive = topicsArray.find(t => t.attempts >= 2 && t.avgTime < 45 && t.accuracy < 50);
    if (impulsive) {
      recommendations.push({
        type: 'warning',
        title: '⚡ Impulsive Solving Risk',
        text: `You are answering questions in "${impulsive.topic}" very fast (avg ${impulsive.avgTime}s) but with low accuracy (${impulsive.accuracy}%). This suggests you are either rushing through text, misreading constraints, or guessing. Force yourself to outline variables on paper before checking options.`
      });
    }

    // 5. Negative Marking Penalty Leak
    if (wastedMarks > 0) {
      recommendations.push({
        type: 'critical',
        title: '📉 Negative Marking Leakage',
        text: `You have lost approximately ${wastedMarks.toFixed(2)} marks in simulated negative penalties due to wrong MCQ responses. In GATE, avoiding negative marks is as important as scoring. Skip questions if you are unsure of the logic.`
      });
    }

    // 6. Subject Coverage Alert
    if (subjectsArray.length < 4 && solvedHistory.length >= 8) {
      recommendations.push({
        type: 'strategy',
        title: '🗺️ Syllabus Breadth Opportunity',
        text: `You have solved ${solvedHistory.length} questions but only across ${subjectsArray.length} subjects. GATE CSE tests across 11 technical subjects. Broaden your scope and attempt foundational questions in other subjects to ensure uniform coverage.`
      });
    }

    // 7. Success Reinforcement
    if (strongestTopics.length > 0) {
      const s = strongestTopics[0];
      recommendations.push({
        type: 'success',
        title: '⚡ Stronghold Validated',
        text: `Excellent performance in "${s.topic}" with ${s.accuracy}% accuracy! Maintain this mastery by solving 1-2 advanced questions weekly while redirecting your main preparation focus to weaker areas.`
      });
    }

    // Determine highest ROI area
    let highestRoiArea = 'N/A';
    let studyFocus = 'General study';
    let solveSuggestion = 'Solve more problems';
    let focusFormula = 'N/A';

    let selectedTopicKey = '';
    let selectedSubjectKey = '';

    if (weakestTopics.length > 0) {
      const topWeak = weakestTopics[0];
      highestRoiArea = `Focus on "${topWeak.topic}" (${topWeak.subject})`;
      selectedTopicKey = topWeak.topic.toLowerCase();
      selectedSubjectKey = topWeak.subject;
    } else if (needsReviewTopics.length > 0) {
      const topReview = needsReviewTopics[0];
      highestRoiArea = `Refine "${topReview.topic}" (${topReview.subject})`;
      selectedTopicKey = topReview.topic.toLowerCase();
      selectedSubjectKey = topReview.subject;
    } else if (topicsArray.length > 0) {
      const topTopic = topicsArray[0];
      highestRoiArea = `Syllabus expansion beyond "${topTopic.topic}"`;
      selectedTopicKey = topTopic.topic.toLowerCase();
      selectedSubjectKey = topTopic.subject;
    }

    // Pull from GATE_KNOWLEDGE_BASE
    if (selectedSubjectKey && GATE_KNOWLEDGE_BASE[selectedSubjectKey]) {
      const subjectData = GATE_KNOWLEDGE_BASE[selectedSubjectKey];
      // Try to find matching topic key or general fallback
      let topicData = subjectData["general"];
      Object.keys(subjectData).forEach(k => {
        if (selectedTopicKey.includes(k) || k.includes(selectedTopicKey)) {
          topicData = subjectData[k];
        }
      });

      if (topicData) {
        studyFocus = topicData.study;
        focusFormula = topicData.focus;
        solveSuggestion = topicData.solve;
      }
    }

    const sortedSolves = [...solvedHistory].sort((a, b) => new Date(a.solvedAt) - new Date(b.solvedAt));
    const totalCount = sortedSolves.length;
    let trendStatus = 'Stagnating';
    let trendColor = 'var(--color-warning)';
    
    if (totalCount >= 4) {
      const half = Math.floor(totalCount / 2);
      const earlyAttempts = sortedSolves.slice(0, half);
      const lateAttempts = sortedSolves.slice(half);

      const earlyCorrect = earlyAttempts.filter(x => x.isCorrect).length;
      const lateCorrect = lateAttempts.filter(x => x.isCorrect).length;

      const earlyAcc = earlyCorrect / earlyAttempts.length;
      const lateAcc = lateCorrect / lateAttempts.length;

      if (lateAcc > earlyAcc + 0.05) {
        trendStatus = 'Improving';
        trendColor = 'var(--color-success)';
      } else if (lateAcc < earlyAcc - 0.05) {
        trendStatus = 'Declining';
        trendColor = 'var(--color-error)';
      }
    }

    return {
      topicStats: topicsArray,
      subjectStats: subjectsArray,
      strongestTopics,
      weakestTopics,
      needsReviewTopics,
      recommendations,
      trendStatus,
      trendColor,
      highestRoiArea,
      studyFocus,
      focusFormula,
      solveSuggestion,
      wastedMarks,
      pyqCount,
      practiceCount,
      avgTime: timedAttempts > 0 ? Math.round(totalSolvingTime / timedAttempts) : 0,
      totalRetryAttempts,
      questionsRetriedCount,
      retryRecoveryRate: questionsRetriedCount > 0 ? Math.round((successfulRetryRecovery / questionsRetriedCount) * 100) : 0
    };
  };

  const analysis = getReadinessAnalysis();


  return (
    <div style={{ padding: '32px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Page Header */}
      <div style={{ marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FiFolder style={{ color: 'var(--color-primary)' }} /> Prep Analyst
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track your preparation progress, solved questions, accuracy, and saved items.</p>
        </div>
        <button 
          onClick={handleCompilePDF}
          disabled={pdfCompiling}
          className="btn btn-outline"
          style={{ padding: '10px 20px', fontSize: '0.85rem', color: 'var(--color-warning)', borderColor: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
        >
          {pdfCompiling ? '⏳ Compiling Bookmarks...' : (AuthService.isPremium() ? '⚡ Compile Revision PDF' : '🔒 Compile Revision PDF (Premium)')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Stats Cards Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        
        {/* Total Solved Card */}
        <div style={statsCardStyle('var(--shadow-cyan)')}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--color-secondary)', opacity: 0.15 }}>
            <FiActivity size={48} />
          </div>
          <h3 style={statsCardTitleStyle}>Total Solved</h3>
          <p style={statsCardNumberStyle('var(--color-secondary)')}>
            {loading ? '...' : stats.totalSolved}
          </p>
          <div style={statsCardSubtitleStyle}>Questions solved in practice runs</div>
        </div>

        {/* Accuracy Card */}
        <div style={statsCardStyle('var(--shadow-neon)')}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--color-primary)', opacity: 0.15 }}>
            <FiTrendingUp size={48} />
          </div>
          <h3 style={statsCardTitleStyle}>Accuracy</h3>
          <p style={statsCardNumberStyle('var(--color-primary)')}>
            {loading ? '...' : `${stats.accuracy}%`}
          </p>
          <div style={statsCardSubtitleStyle}>
            {stats.correctCount} Correct / {stats.incorrectCount} Incorrect
          </div>
        </div>

        {/* Bookmarks Card */}
        <div style={statsCardStyle('0 0 15px rgba(245, 158, 11, 0.15)')}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--color-warning)', opacity: 0.15 }}>
            <FiBookmark size={48} />
          </div>
          <h3 style={statsCardTitleStyle}>Bookmarked</h3>
          <p style={statsCardNumberStyle('var(--color-warning)')}>
            {loading ? '...' : stats.bookmarkedCount}
          </p>
          <div style={statsCardSubtitleStyle}>Saved items for revision</div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '28px', gap: '8px' }}>
        <button
          onClick={() => setActiveTab('readiness')}
          style={{
            ...tabButtonStyle,
            borderBottom: activeTab === 'readiness' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'readiness' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'readiness' ? '600' : '500'
          }}
        >
          📈 Prep Analyst
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          style={{
            ...tabButtonStyle,
            borderBottom: activeTab === 'bookmarks' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'bookmarks' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'bookmarks' ? '600' : '500'
          }}
        >
          🔖 Bookmarked Questions ({bookmarks.length})
        </button>
        <button
          onClick={() => setActiveTab('solved')}
          style={{
            ...tabButtonStyle,
            borderBottom: activeTab === 'solved' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'solved' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'solved' ? '600' : '500'
          }}
        >
          ✅ Solved History ({solvedHistory.length})
        </button>
      </div>

      {/* Main Content Render */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading history...</div>
      ) : activeTab === 'bookmarks' ? (
        bookmarks.length === 0 ? (
          <div style={emptyStateStyle}>
            <FiBookmark size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3>No Bookmarks Yet</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Bookmark questions on the Explorer to save them here for revision.</p>
          </div>
        ) : (
          <div>
            {bookmarks.map(q => (
              <div key={q.id} className="question-card" style={{ cursor: 'pointer' }} onClick={() => navigate(getQuestionUrl(q))}>
                <div className="question-meta">
                  <span className="badge badge-info">GATE CSE {q.year}</span>
                  <span className="badge badge-dark">{q.questionType}</span>
                  <span className="badge badge-dark">{q.subjectName}</span>
                  <span className="badge badge-dark">{q.topicName}</span>
                  <button
                    onClick={(e) => handleRemoveBookmark(e, q.id)}
                    className="btn btn-outline"
                    style={{ marginLeft: 'auto', padding: '6px 12px', color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.2)' }}
                    title="Remove Bookmark"
                  >
                    <FiTrash size={14} style={{ marginRight: '4px' }} /> Remove
                  </button>
                </div>
                <div className="question-text" style={{ pointerEvents: 'none' }}>
                  {renderQuestionText(q.text)}
                </div>
                
                {q.options && q.options.length > 0 && (
                  <div className="options-grid" style={{ pointerEvents: 'none', marginTop: '16px' }}>
                    {q.options.map(opt => {
                      const isImageOption = opt.optionText && (opt.optionText.startsWith('/uploads/') || opt.optionText.startsWith('http://') || opt.optionText.startsWith('https://'));
                      return (
                        <div key={opt.id} className="option-btn" style={{ cursor: 'default' }}>
                          <span className="option-label">{opt.optionLabel}</span>
                          {isImageOption ? (
                            <img 
                              src={getAssetUrl(opt.optionText)} 
                              alt={`Option ${opt.optionLabel}`} 
                              style={{ maxHeight: '60px', objectFit: 'contain', backgroundColor: '#fff', padding: '2px', borderRadius: '4px' }}
                            />
                          ) : (
                            formatMathText(opt.optionText)
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'solved' ? (
        solvedHistory.length === 0 ? (
          <div style={emptyStateStyle}>
            <FiActivity size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3>No Solved History</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Start practicing on the Explorer to track your answers here.</p>
          </div>
        ) : (
          <div>
            {solvedHistory.map(item => {
              const q = item.question;
              return (
                <div 
                  key={item.id} 
                  className="question-card" 
                  style={{ 
                    borderLeft: item.isCorrect ? '4px solid var(--color-success)' : '4px solid var(--color-error)',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(getQuestionUrl(q))}
                >
                  <div className="question-meta">
                    <span className="badge badge-info">GATE CSE {q.year}</span>
                    <span className="badge badge-dark">{q.subjectName}</span>
                    <span className="badge badge-dark">{q.topicName}</span>
                    
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiClock size={12} /> {new Date(item.solvedAt).toLocaleDateString()}
                      </span>
                      {item.isCorrect ? (
                        <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          <FiCheckCircle /> Correct (Selected {item.selectedOption})
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          <FiXCircle /> Incorrect (Selected {item.selectedOption})
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="question-text" style={{ pointerEvents: 'none' }}>
                    {renderQuestionText(q.text)}
                  </div>

                  {q.options && q.options.length > 0 && (
                    <div className="options-grid" style={{ marginTop: '16px', pointerEvents: 'none' }}>
                      {q.options.map(opt => {
                        let styleOverride = {};
                        if (opt.optionLabel === item.selectedOption) {
                          styleOverride = item.isCorrect 
                            ? { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'var(--color-success)', color: 'var(--text-primary)' }
                            : { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'var(--color-error)', color: 'var(--text-primary)' };
                        } else if (q.aiSuggestedAnswer && opt.optionLabel === q.aiSuggestedAnswer.trim().toUpperCase()) {
                          // Highlight the correct answer if they got it wrong
                          styleOverride = { backgroundColor: 'rgba(16, 185, 129, 0.04)', borderColor: 'var(--color-success)', opacity: 0.8 };
                        }
                        
                        return (
                          <div key={opt.id} className="option-btn" style={{ ...styleOverride, cursor: 'default' }}>
                            <span className="option-label" style={
                              opt.optionLabel === item.selectedOption 
                                ? (item.isCorrect ? { color: 'var(--color-success)', backgroundColor: 'rgba(16, 185, 129, 0.12)' } : { color: 'var(--color-error)', backgroundColor: 'rgba(239, 68, 68, 0.12)' })
                                : {}
                            }>{opt.optionLabel}</span>
                            {opt.optionText && (opt.optionText.startsWith('/uploads/') || opt.optionText.startsWith('http://') || opt.optionText.startsWith('https://')) ? (
                              <img 
                                src={getAssetUrl(opt.optionText)} 
                                alt={`Option ${opt.optionLabel}`} 
                                style={{ maxHeight: '60px', objectFit: 'contain', backgroundColor: '#fff', padding: '2px', borderRadius: '4px' }}
                              />
                            ) : (
                              formatMathText(opt.optionText)
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        !analysis ? (
          <div style={emptyStateStyle}>
            <FiActivity size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3>Data Deficit: Cannot Analyze</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Practice and answer at least 1 question to activate the preparation analyst.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* 360-DEGREE TELEMETRY SOURCE BADGE */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '14px',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>🌐</span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#fff', margin: 0, fontWeight: 800 }}>
                    360-Degree Unified Telemetry Active
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Aggregating performance insights across all solved questions
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: '#c4b5fd', fontWeight: 700 }}>
                  📜 {analysis.pyqCount} PYQ Solves
                </span>
                <span style={{ padding: '4px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>
                  ⚡ {analysis.practiceCount} Practice Solves
                </span>
              </div>
            </div>

            {/* TOP SPOTLIGHT: Strengths vs Weaknesses & Retry Insights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              
              {/* Strongest Mastery Focus */}
              <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '14px', padding: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#10b981', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.05em' }}>
                  💪 TOP STRENGTH (MASTERED)
                </h4>
                {analysis.strongestTopics.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                      {analysis.strongestTopics[0].topic}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {analysis.strongestTopics[0].subject} • <strong style={{ color: '#10b981' }}>{analysis.strongestTopics[0].accuracy}% Accuracy</strong> ({analysis.strongestTopics[0].attempts} Qs)
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Solve 5+ questions with &gt;75% accuracy to reveal your top strength.</div>
                )}
              </div>

              {/* Top Weakness / Vulnerability */}
              <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '14px', padding: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.05em' }}>
                  🎯 CRITICAL VULNERABILITY (WEAKEST)
                </h4>
                {analysis.weakestTopics.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                      {analysis.weakestTopics[0].topic}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {analysis.weakestTopics[0].subject} • <strong style={{ color: '#ef4444' }}>{analysis.weakestTopics[0].accuracy}% Accuracy</strong> ({analysis.weakestTopics[0].attempts} Qs)
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>✓ No weak topics below 50% accuracy detected!</div>
                )}
              </div>

              {/* Retry & Recovery Mastery Metric */}
              <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '14px', padding: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#c4b5fd', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.05em' }}>
                  🔄 RETRY & RECOVERY ANALYTICS
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#8b5cf6' }}>
                    {analysis.retryRecoveryRate}%
                  </span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <div>Total Reset Retries: <strong>{analysis.totalRetryAttempts}</strong></div>
                    <div>Questions Converted: <strong>{analysis.questionsRetriedCount}</strong></div>
                  </div>
                </div>
              </div>

            </div>

            {/* Header Cards: Trajectory & Focus & Solving Time */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
              {/* Performance Trajectory */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Performance Trajectory</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: analysis.trendColor }}>{analysis.trendStatus}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Based on solving history trends)</span>
                </div>
              </div>
              
              {/* Highest-ROI Priority Area */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Highest-ROI Priority Area</h4>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-secondary)' }}>
                  🎯 {analysis.highestRoiArea}
                </div>
              </div>

              {/* Average Solving Time */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Average Solving Time</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {analysis.avgTime > 0 ? `${analysis.avgTime}s` : 'N/A'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Target: &lt; 150s per question)</span>
                </div>
              </div>
            </div>

            {/* Dynamic Action Plan / Study Guidance */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)', 
              border: '1px solid rgba(139, 92, 246, 0.2)', 
              borderRadius: '12px', 
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h4 style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧠 Personalized Study & Practice Hub
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <h5 style={{ color: 'var(--color-secondary)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0' }}>
                    📚 Study & Focus Area
                  </h5>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {analysis.studyFocus}
                  </p>
                </div>

                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <h5 style={{ color: 'var(--color-warning)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0' }}>
                    📐 Core Focus Formulas / Concepts
                  </h5>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {analysis.focusFormula}
                  </p>
                </div>
                
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <h5 style={{ color: 'var(--color-primary)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0' }}>
                    ✏️ Solving & Practice Target
                  </h5>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {analysis.solveSuggestion}
                  </p>
                </div>
              </div>
            </div>

            {/* Recommendations & Risk Warnings */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
              <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <FiCheckCircle style={{ color: 'var(--color-primary)' }} /> Preparation Risk Assessment & Opportunities
              </h4>
              {analysis.recommendations.length === 0 ? (
                <p style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>✓ No critical preparation risks flagged. Practice depth is uniform.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {analysis.recommendations.map((rec, i) => {
                    let borderCol = 'var(--color-primary)';
                    let bgCol = 'rgba(139, 92, 246, 0.02)';
                    if (rec.type === 'critical') {
                      borderCol = 'var(--color-error)';
                      bgCol = 'rgba(239, 68, 68, 0.03)';
                    } else if (rec.type === 'warning') {
                      borderCol = 'var(--color-warning)';
                      bgCol = 'rgba(245, 158, 11, 0.03)';
                    } else if (rec.type === 'success') {
                      borderCol = 'var(--color-success)';
                      bgCol = 'rgba(16, 185, 129, 0.03)';
                    } else if (rec.type === 'info') {
                      borderCol = 'var(--color-secondary)';
                      bgCol = 'rgba(6, 182, 212, 0.03)';
                    } else if (rec.type === 'strategy') {
                      borderCol = 'var(--color-primary)';
                      bgCol = 'rgba(139, 92, 246, 0.03)';
                    }
                    
                    return (
                      <div key={i} style={{ borderLeft: `4px solid ${borderCol}`, backgroundColor: bgCol, padding: '16px', borderRadius: '6px', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                        <h5 style={{ color: borderCol, fontSize: '0.9rem', fontWeight: 700, margin: '0 0 6px 0' }}>{rec.title}</h5>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{rec.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Performance Grid by Topic */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
              <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <FiActivity style={{ color: 'var(--color-secondary)' }} /> Syllabus Performance Breakdown
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px' }}>Topic</th>
                      <th style={{ padding: '12px 16px' }}>Subject</th>
                      <th style={{ padding: '12px 16px' }}>Attempt Count</th>
                      <th style={{ padding: '12px 16px' }}>Accuracy Rate</th>
                      <th style={{ padding: '12px 16px' }}>Avg Speed</th>
                      <th style={{ padding: '12px 16px' }}>Diagnostic Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.topicStats.map((stat, i) => {
                      let statusBadge = <span className="badge badge-success">Mastered</span>;
                      if (stat.accuracy < 50) {
                        statusBadge = <span className="badge badge-error">Deficit</span>;
                      } else if (stat.accuracy < 75) {
                        statusBadge = <span className="badge badge-warning">Needs Review</span>;
                      }
                      
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>{stat.topic}</td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{stat.subject}</td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>{stat.attempts}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: stat.accuracy >= 75 ? 'var(--color-success)' : stat.accuracy < 50 ? 'var(--color-error)' : 'var(--color-warning)' }}>
                            {stat.accuracy}%
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>
                            {stat.avgTime > 0 ? `${stat.avgTime}s` : 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )
      }

      <PremiumGateModal 
        isOpen={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)} 
        onUpgradeSuccess={() => window.location.reload()} 
      />

      {/* ── PDF OPTIONS MODAL ──────────────────────────────────────────── */}
      {showPdfModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(5, 5, 15, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #0f0f1e 0%, #141428 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '20px',
            padding: '36px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 0 60px rgba(99, 102, 241, 0.15), 0 24px 48px rgba(0,0,0,0.5)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem'
              }}>📄</div>
              <div>
                <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Build Revision PDF</h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', margin: 0 }}>{bookmarks.length} bookmarked questions</p>
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'rgba(99,102,241,0.2)', margin: '20px 0' }} />

            {!AuthService.isPremium() && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '1.3rem' }}>🎁</span>
                <div style={{ fontSize: '0.8rem', color: '#fef3c7', lineHeight: 1.4 }}>
                  <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '2px' }}>1-Time Free Trial Active!</strong>
                  You get 1 free trial export of your first 10 revision questions. Upgrade to <strong>Aspirant Pro</strong> for unlimited PDFs & full question sets.
                </div>
              </div>
            )}

            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Select what to include in your PDF. Questions and options are always included.
            </p>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              
              {/* Questions & Options — LOCKED */}
              {[{ label: 'Questions', desc: 'All question stems' }, { label: 'Options (A/B/C/D)', desc: 'All answer choices' }].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: '12px', padding: '14px 18px'
                }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '6px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>✓</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e0e0ff', fontWeight: 700, fontSize: '0.95rem' }}>{item.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>{item.desc}</div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(99,102,241,0.8)', background: 'rgba(99,102,241,0.15)', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>Always included</span>
                </div>
              ))}

              {/* Answer — toggleable */}
              <div
                onClick={() => setPdfOptions(o => ({ ...o, includeAnswer: !o.includeAnswer }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: pdfOptions.includeAnswer ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${pdfOptions.includeAnswer ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '12px', padding: '14px 18px', cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px',
                  background: pdfOptions.includeAnswer ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
                  border: pdfOptions.includeAnswer ? 'none' : '2px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s ease'
                }}>
                  {pdfOptions.includeAnswer && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: pdfOptions.includeAnswer ? '#a7f3d0' : '#a0a0c0', fontWeight: 700, fontSize: '0.95rem', transition: 'color 0.2s' }}>Correct Answer</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>AI-recommended answer for each question</div>
                </div>
              </div>

              {/* Explanation — toggleable */}
              <div
                onClick={() => setPdfOptions(o => ({ ...o, includeExplanation: !o.includeExplanation }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: pdfOptions.includeExplanation ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${pdfOptions.includeExplanation ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '12px', padding: '14px 18px', cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px',
                  background: pdfOptions.includeExplanation ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'rgba(255,255,255,0.08)',
                  border: pdfOptions.includeExplanation ? 'none' : '2px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s ease'
                }}>
                  {pdfOptions.includeExplanation && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: pdfOptions.includeExplanation ? '#c4b5fd' : '#a0a0c0', fontWeight: 700, fontSize: '0.95rem', transition: 'color 0.2s' }}>Detailed Explanation</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>Full AI-generated step-by-step solution</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPdfModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={generatePDF}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', color: '#fff', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.95rem',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                ⚡ Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles
const statsCardStyle = (glowShadow) => ({
  background: 'var(--bg-card)', 
  border: '1px solid var(--border-color)', 
  borderRadius: '16px', 
  padding: '24px', 
  boxShadow: glowShadow || 'var(--shadow-sm)',
  backdropFilter: 'blur(10px)',
  position: 'relative',
  overflow: 'hidden'
});

const statsCardTitleStyle = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  textTransform: 'uppercase',
  marginBottom: '8px',
  letterSpacing: '0.05em'
};

const statsCardNumberStyle = (color) => ({
  fontSize: '2.5rem',
  fontWeight: 800,
  color: color,
  fontFamily: 'var(--font-title)',
  marginBottom: '4px'
});

const statsCardSubtitleStyle = {
  fontSize: '0.8rem',
  color: 'var(--text-muted)'
};

const tabButtonStyle = {
  background: 'none',
  border: 'none',
  padding: '12px 16px',
  fontSize: '1rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  outline: 'none',
  fontFamily: 'var(--font-title)'
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '60px 20px',
  border: '1px dashed var(--border-color)',
  borderRadius: '16px',
  backgroundColor: 'rgba(255, 255, 255, 0.01)'
};
