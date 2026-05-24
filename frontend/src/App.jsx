import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Search,
  ChevronDown,
  Zap,
  Users,
  CheckCircle,
  CheckCircle2,
  TrendingUp,
  Inbox,
  AlertCircle,
  RefreshCw,
  Clock,
  MapPin,
  DollarSign,
  Building,
  ExternalLink,
  Bookmark,
  MoreHorizontal,
  Settings,
  Sliders,
  Save,
  RotateCcw,
  ChevronRight,
  ArrowLeft,
  Square,
  Calendar,
  Activity,
  Trash2,
  LogOut,
  Layers,
  BarChart3,
  Copy,
  Mail,
  Phone,
  UserPlus,
  FileUp,
  X,
  FileSearch,
  Check,
  Globe,
  History,
  Database,
  Monitor,
  Edit,
  AlertTriangle,
  HelpCircle,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download
} from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';
import { renderAsync } from 'docx-preview';

/**
 * DocxViewer: A high-fidelity, paginated viewer for Microsoft Word documents.
 * Supports both local rendering (privacy-first) and Office Online (fidelity-first).
 */
const DocxViewer = ({ blob, filename = 'Document.docx' }) => {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [error, setError] = useState(null);
  const [rendering, setRendering] = useState(true);
  const [zoom, setZoom] = useState(0.6);

  const fitToWidth = () => {
    if (containerRef.current) {
      const available = containerRef.current.clientWidth - 32; // 16px padding each side
      const docWidth = 816; // standard A4 px width docx-preview uses
      setZoom(Math.max(0.3, Math.min(available / docWidth, 2.0)));
    }
  };

  useEffect(() => {
    if (!blob || !wrapperRef.current) return;
    setError(null);
    setRendering(true);
    wrapperRef.current.innerHTML = '';
    renderAsync(blob, wrapperRef.current, null, {
      className: 'docx-page',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      useBase64URL: true,
      debug: false,
    }).then(() => {
      setRendering(false);
    }).catch(err => {
      console.error('docx-preview error:', err);
      setError('Could not render this document.');
      setRendering(false);
    });
  }, [blob]);

  const handleDownload = () => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(u);
  };

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#f8fafc', color: 'var(--text-secondary)' }}>
        <AlertTriangle size={36} color="#f97316" />
        <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
        <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
          <Download size={16} /> Download File
        </button>
      </div>
    );
  }

  const iconBtnStyle = { background: 'rgba(255,255,255,0.08)', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', transition: 'background 0.15s' };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#2b2d30', borderBottom: '1px solid #1e1f22', flexShrink: 0, gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ background: '#2b579a', padding: '5px 7px', borderRadius: '5px', display: 'flex', flexShrink: 0 }}>
            <FileText size={14} color="white" />
          </div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f1f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.4))} style={iconBtnStyle} title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#f1f1f1', width: '38px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(z + 0.1, 2.5))} style={iconBtnStyle} title="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button onClick={fitToWidth} style={{ ...iconBtnStyle, marginLeft: '4px', padding: '5px 10px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.02em' }} title="Fit to width">
            FIT
          </button>
        </div>

        <button
          onClick={handleDownload}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#2b579a', color: 'white', border: 'none', borderRadius: '7px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
        >
          <Download size={14} /> Download
        </button>
      </div>

      {/* Document area */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', padding: '24px 16px', background: '#606368', boxSizing: 'border-box' }}>
        {rendering && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '600', paddingTop: '60px' }}>
            <RefreshCw size={18} className="animate-spin" /> Rendering document...
          </div>
        )}
        <div ref={wrapperRef} className="docx-viewer-content" />
      </div>

      <style>{`
        .docx-viewer-content {
          zoom: ${zoom};
        }
        .docx-viewer-content .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 20px !important;
        }
        .docx-viewer-content .docx-wrapper > section.docx {
          background: white !important;
          color: black !important;
          color-scheme: light !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.35) !important;
          box-sizing: border-box !important;
          display: block !important;
        }
        .docx-viewer-content .docx-wrapper > section.docx * {
          color-scheme: light !important;
        }
        .docx-viewer-content img { max-width: 100% !important; }
      `}</style>
    </div>
  );
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const DATE_OPTIONS = [
  { label: 'Last 24 Hours', value: '24h', desc: 'Ideal for rapid, daily updates' },
  { label: 'Last 3 Days', value: '3d', desc: 'Captures missed weekend postings' },
  { label: 'Last 7 Days', value: '7d', desc: 'Weekly deep-sync of all sources' },
  { label: 'Last 14 Days', value: '14d', desc: 'Extended bi-weekly collection' }
];

const suggestedPages = {
  '24h': 30,
  '3d': 60,
  '7d': 100,
  '14d': 150
};

const APP_COUNTRY_CODES = [
  { code: '+1', name: 'United States', short: 'US', len: 10 },
  { code: '+91', name: 'India', short: 'IN', len: 10 },
  { code: '+44', name: 'United Kingdom', short: 'GB', len: 10 },
  { code: '+61', name: 'Australia', short: 'AU', len: 9 },
  { code: '+1', name: 'Canada', short: 'CA', len: 10 },
  { code: '+49', name: 'Germany', short: 'DE', len: 11 },
  { code: '+33', name: 'France', short: 'FR', len: 9 },
  { code: '+81', name: 'Japan', short: 'JP', len: 10 },
  { code: '+86', name: 'China', short: 'CN', len: 11 },
  { code: '+971', name: 'United Arab Emirates', short: 'AE', len: 9 },
  { code: '+65', name: 'Singapore', short: 'SG', len: 8 },
  { code: '+353', name: 'Ireland', short: 'IE', len: 9 },
  { code: '+31', name: 'Netherlands', short: 'NL', len: 9 },
  { code: '+41', name: 'Switzerland', short: 'CH', len: 9 },
  { code: '+46', name: 'Sweden', short: 'SE', len: 9 },
  { code: '+34', name: 'Spain', short: 'ES', len: 9 },
  { code: '+39', name: 'Italy', short: 'IT', len: 10 },
  { code: '+55', name: 'Brazil', short: 'BR', len: 11 },
  { code: '+52', name: 'Mexico', short: 'MX', len: 10 },
  { code: '+27', name: 'South Africa', short: 'ZA', len: 9 },
  { code: '+7', name: 'Russia', short: 'RU', len: 10 },
  { code: '+82', name: 'South Korea', short: 'KR', len: 10 },
  { code: '+64', name: 'New Zealand', short: 'NZ', len: 9 },
  { code: '+60', name: 'Malaysia', short: 'MY', len: 10 },
  { code: '+63', name: 'Philippines', short: 'PH', len: 10 },
  { code: '+66', name: 'Thailand', short: 'TH', len: 10 },
  { code: '+84', name: 'Vietnam', short: 'VN', len: 10 },
  { code: '+90', name: 'Turkey', short: 'TR', len: 10 },
  { code: '+966', name: 'Saudi Arabia', short: 'SA', len: 9 },
  { code: '+20', name: 'Egypt', short: 'EG', len: 10 },
  { code: '+54', name: 'Argentina', short: 'AR', len: 10 },
  { code: '+62', name: 'Indonesia', short: 'ID', len: 11 },
  { code: '+32', name: 'Belgium', short: 'BE', len: 9 },
  { code: '+43', name: 'Austria', short: 'AT', len: 10 },
  { code: '+45', name: 'Denmark', short: 'DK', len: 8 },
  { code: '+358', name: 'Finland', short: 'FI', len: 10 },
  { code: '+47', name: 'Norway', short: 'NO', len: 8 },
  { code: '+48', name: 'Poland', short: 'PL', len: 9 },
  { code: '+351', name: 'Portugal', short: 'PT', len: 9 },
  { code: '+30', name: 'Greece', short: 'GR', len: 10 },
  { code: '+420', name: 'Czech Republic', short: 'CZ', len: 9 },
  { code: '+36', name: 'Hungary', short: 'HU', len: 9 },
  { code: '+40', name: 'Romania', short: 'RO', len: 10 },
  { code: '+380', name: 'Ukraine', short: 'UA', len: 9 },
  { code: '+92', name: 'Pakistan', short: 'PK', len: 10 },
  { code: '+880', name: 'Bangladesh', short: 'BD', len: 10 },
  { code: '+94', name: 'Sri Lanka', short: 'LK', len: 9 },
  { code: '+234', name: 'Nigeria', short: 'NG', len: 10 },
  { code: '+254', name: 'Kenya', short: 'KE', len: 10 },
  { code: '+212', name: 'Morocco', short: 'MA', len: 9 }
].sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT_PHONE_COUNTRY = APP_COUNTRY_CODES.find(country => country.short === 'IN') || APP_COUNTRY_CODES[0];
const PHONE_DIAL_CODES = [...new Set(APP_COUNTRY_CODES.map(country => country.code))].sort((a, b) => b.length - a.length);

const VISA_STATUS_OPTIONS = ['US Citizen', 'Green Card', 'H1B', 'OPT', 'CPT', 'L2', 'EAD', 'Other'];
const RELOCATION_OPTIONS = ['Yes', 'No'];
const EMPLOYMENT_TYPE_OPTIONS = ['Existing', 'New'];

const showToast = (msg) => {
  const el = document.createElement('div');
  el.className = 'share-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('share-toast--visible'));
  setTimeout(() => {
    el.classList.remove('share-toast--visible');
    setTimeout(() => el.remove(), 300);
  }, 2200);
};

const getCountryByShortCode = (shortCode) =>
  APP_COUNTRY_CODES.find(country => country.short === shortCode) || DEFAULT_PHONE_COUNTRY;

const getCountryByDialCode = (dialCode) => {
  const matches = APP_COUNTRY_CODES.filter(country => country.code === dialCode);
  if (matches.length === 0) return DEFAULT_PHONE_COUNTRY;
  if (dialCode === '+1') {
    return matches.find(country => country.short === 'US') || matches[0];
  }
  return matches[0];
};

const formatContactValue = (country, number) => {
  const trimmedNumber = (number || '').trim();
  if (!trimmedNumber) return '';
  return `${country.code} ${trimmedNumber}`.trim();
};

const parseContactValue = (value = '') => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { country: DEFAULT_PHONE_COUNTRY, number: '' };
  }

  const matchedDialCode = PHONE_DIAL_CODES.find(code => trimmedValue.startsWith(code));
  if (!matchedDialCode) {
    return { country: DEFAULT_PHONE_COUNTRY, number: trimmedValue };
  }

  return {
    country: getCountryByDialCode(matchedDialCode),
    number: trimmedValue.slice(matchedDialCode.length).trim()
  };
};

const getDocumentExtensionFromUrl = (url = '') => {
  if (!url) return 'bin';

  try {
    const urlObj = new URL(url.startsWith('http') ? url : `http://localhost/${url.startsWith('/') ? url.slice(1) : url}`);
    
    // 1. Try explicit file_ext hint (MANDATORY for SAS URLs)
    const fileExt = urlObj.searchParams.get('file_ext');
    if (fileExt) return fileExt.toLowerCase();

    // 2. Try pathname extension
    const pathname = urlObj.pathname;
    const parts = pathname.split('.');
    if (parts.length > 1) {
      const ext = parts.pop().toLowerCase();
      if (ext.length <= 5) return ext;
    }
  } catch (e) {
    // Fallback for malformed URLs
  }

  // Final fallback: simple string split
  const sanitizedUrl = url.split('?')[0].split('#')[0];
  const parts = sanitizedUrl.split('.');
  if (parts.length > 1) {
    const ext = parts.pop().toLowerCase();
    if (ext.length <= 5) return ext;
  }

  return 'bin';
};


const getDocumentPreviewKind = (url = '') => {
  const extension = getDocumentExtensionFromUrl(url);

  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) return 'image';
  if (extension === 'docx') return 'docx';
  if (['doc', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) return 'office';
  if (['txt', 'json', 'xml', 'md', 'csv'].includes(extension)) return 'text';
  return 'binary';
};


const getDocumentFileNameFromUrl = (url = '', fallback = 'document') => {
  const sanitizedUrl = url.split('?')[0].split('#')[0];
  const fileName = sanitizedUrl.split('/').pop();
  return fileName ? decodeURIComponent(fileName) : fallback;
};

const getFirstMissingArrayIndex = (missingPaths = [], fieldName) => {
  const pattern = new RegExp(`^${fieldName}\\[(\\d+)\\]`);
  const matchingPath = missingPaths.find(path => pattern.test(path));
  if (!matchingPath) return 0;

  const match = matchingPath.match(pattern);
  return match ? Number.parseInt(match[1], 10) || 0 : 0;
};

const getResumeProcessingBucket = (candidate = {}) => {
  const status = candidate.formatted_resume_status || 'not_started';
  if (status === 'completed') return 'resolved';
  if (status === 'processing') return 'review';
  return 'pending'; // includes not_started, needs_input, failed
};

const buildResumeProcessingForm = (candidate = {}) => {
  const content = candidate.formatted_resume_content || {};
  const missingPaths = (candidate.formatted_resume_missing_field_details || []).flatMap(
    detail => detail.missing_paths || []
  );
  const academicIndex = getFirstMissingArrayIndex(missingPaths, 'Academics');
  const experienceIndex = getFirstMissingArrayIndex(
    missingPaths,
    'Professional_Experience'
  );
  const existingAcademics = Array.isArray(content.Academics) ? content.Academics : [];
  const existingProfessionalExperience = Array.isArray(content.Professional_Experience)
    ? content.Professional_Experience
    : [];
  const targetedAcademic = existingAcademics[academicIndex] || {};
  const targetedExperience = existingProfessionalExperience[experienceIndex] || {};
  const technicalSkills = Object.entries(content.Technical_Skills || {})
    .map(([category, skills]) => `${category}: ${(skills || []).join(', ')}`)
    .join('\n');

  return {
    Name: content.Name || '',
    Phone: content.Phone || '',
    Email: content.Email || '',
    Summary: content.Summary || '',
    AcademicIndex: academicIndex,
    ExistingAcademics: existingAcademics,
    AcademicDegree: targetedAcademic.Degree || '',
    AcademicMajor: targetedAcademic.Major || '',
    AcademicUniversity: targetedAcademic.University || '',
    TechnicalSkills: technicalSkills,
    ExperienceIndex: experienceIndex,
    ExistingProfessionalExperience: existingProfessionalExperience,
    ExperienceCompany: targetedExperience.Company || '',
    ExperienceLocation: targetedExperience.location || '',
    ExperienceTitle: targetedExperience.title || '',
    ExperienceDates: targetedExperience.dates_of_employment || '',
    ExperienceDescription: targetedExperience.project_description || '',
    ExperienceResponsibilities: (targetedExperience.Responsibilities || []).join('\n'),
    ExperienceEnvironment: (targetedExperience.Environment || []).join(', '),
  };
};

const parseTechnicalSkillsInput = (value = '') => {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) return acc;
      const category = line.slice(0, separatorIndex).trim();
      const skills = line
        .slice(separatorIndex + 1)
        .split(',')
        .map(skill => skill.trim())
        .filter(Boolean);
      if (category && skills.length) {
        acc[category] = skills;
      }
      return acc;
    }, {});
};

const buildResumeCompletionPayload = (form = {}) => {
  const payload = {};
  const technicalSkills = parseTechnicalSkillsInput(form.TechnicalSkills || '');
  const responsibilities = (form.ExperienceResponsibilities || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
  const environment = (form.ExperienceEnvironment || '')
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean);

  ['Name', 'Phone', 'Email', 'Summary'].forEach((field) => {
    if ((form[field] || '').trim()) {
      payload[field] = form[field].trim();
    }
  });

  if (
    form.AcademicDegree?.trim() ||
    form.AcademicMajor?.trim() ||
    form.AcademicUniversity?.trim()
  ) {
    const academics = Array.isArray(form.ExistingAcademics)
      ? form.ExistingAcademics.map(entry => ({ ...entry }))
      : [];
    const academicIndex = Number.isInteger(form.AcademicIndex) ? form.AcademicIndex : 0;

    while (academics.length <= academicIndex) {
      academics.push({ Degree: '', Major: '', University: '' });
    }

    academics[academicIndex] = {
      ...(academics[academicIndex] || {}),
      Degree: form.AcademicDegree?.trim() || '',
      Major: form.AcademicMajor?.trim() || '',
      University: form.AcademicUniversity?.trim() || '',
    };
    payload.Academics = academics;
  }

  if (Object.keys(technicalSkills).length) {
    payload.Technical_Skills = technicalSkills;
  }

  if (
    form.ExperienceCompany?.trim() ||
    form.ExperienceLocation?.trim() ||
    form.ExperienceTitle?.trim() ||
    form.ExperienceDates?.trim() ||
    form.ExperienceDescription?.trim() ||
    responsibilities.length ||
    environment.length
  ) {
    const professionalExperience = Array.isArray(form.ExistingProfessionalExperience)
      ? form.ExistingProfessionalExperience.map(entry => ({ ...entry }))
      : [];
    const experienceIndex = Number.isInteger(form.ExperienceIndex) ? form.ExperienceIndex : 0;

    while (professionalExperience.length <= experienceIndex) {
      professionalExperience.push({
        Company: '',
        location: '',
        title: '',
        dates_of_employment: '',
        project_description: '',
        Responsibilities: [],
        Environment: [],
      });
    }

    professionalExperience[experienceIndex] = {
      ...(professionalExperience[experienceIndex] || {}),
      Company: form.ExperienceCompany?.trim() || '',
      location: form.ExperienceLocation?.trim() || '',
      title: form.ExperienceTitle?.trim() || '',
      dates_of_employment: form.ExperienceDates?.trim() || '',
      project_description: form.ExperienceDescription?.trim() || '',
      Responsibilities: responsibilities,
      Environment: environment,
    };
    payload.Professional_Experience = professionalExperience;
  }

  return payload;
};


// ─── CustomTimePicker ────────────────────────────────────────────────────────
const CustomTimePicker = ({ value, onChange, onClose }) => {
  const [tempTime, setTempTime] = useState(value || '09:00');
  const [hour, min] = tempTime.split(':');
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <div className="time-picker-overlay" onClick={onClose}>
      <div className="time-picker-card" onClick={e => e.stopPropagation()}>
        <div className="time-picker-header">
          <Clock size={20} color="var(--accent-color)" />
          <h3>Select Run Time</h3>
        </div>
        <div className="time-picker-body">
          <div className="time-column">
            <label>Hour</label>
            <div className="time-grid">
              {hours.map(h => (
                <button
                  key={h}
                  className={`time-btn ${hour === h ? 'active' : ''}`}
                  onClick={() => {
                    const newTime = `${h}:${min}`;
                    setTempTime(newTime);
                    onChange(newTime);
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="time-column">
            <label>Minute</label>
            <div className="time-grid">
              {minutes.map(m => (
                <button
                  key={m}
                  className={`time-btn ${min === m ? 'active' : ''}`}
                  onClick={() => {
                    const newTime = `${hour}:${m}`;
                    setTempTime(newTime);
                    onChange(newTime);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="time-picker-footer">
          <button className="time-picker-done" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

// ─── JobDetailsDrawer ─────────────────────────────────────────────────────────

// Defined OUTSIDE App so React never remounts it on parent re-renders.
const JobDetailsDrawer = React.memo(({ job, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  // Animate out, then fire the real onClose after the animation completes
  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280); // matches CSS transition duration
  };

  if (!job) return null;

  const getWorkplaceBadgeClass = (wt) => {
    if (!wt) return 'drawer-badge';
    const v = wt.toLowerCase();
    if (v === 'remote') return 'drawer-badge badge-remote';
    if (v === 'hybrid') return 'drawer-badge badge-hybrid';
    return 'drawer-badge';
  };



  const containsHtml = (str) => str && /<[a-zA-Z][^>]*>/.test(str);


  const handleShare = async (e) => {
    e.stopPropagation();
    const shareData = {
      title: job.title || 'Job Opportunity',
      text: `${job.title} at ${job.company}${job.location ? ' — ' + job.location : ''}`,
      url: job.url,
    };
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(job.url);
        showToast('✓ Job link copied to clipboard');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(job.url);
        showToast('✓ Job link copied to clipboard');
      } catch {
        showToast('Could not copy link — open the console for the URL');
        console.log('Job URL:', job.url);
      }
    }
  };

  const empBadges = job.job_type
    ? job.job_type.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  return (
    <div
      className={`drawer-overlay${isClosing ? ' drawer-overlay--closing' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`details-drawer${isClosing ? ' details-drawer--closing' : ''}`}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Dice-style header card ─────────────────────────────── */}
        <div className="drawer-job-header">
          {/* Row 1: Company + close + apply */}
          <div className="drawer-header-top">
            <div className="drawer-company-row">
              <div className="drawer-company-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="var(--border-color)" />
                  <path d="M6 18L12 6L18 18" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="drawer-company-name">{job.company || 'N/A'}</span>
            </div>
            <div className="drawer-header-actions">
              {/* Share — functional */}
              <button className="drawer-icon-btn" title="Share job link" onClick={handleShare}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
              </button>
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="drawer-apply-btn"
                onClick={e => e.stopPropagation()}
              >Apply Now</a>
              <button className="drawer-close-btn" onClick={handleClose} title="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>

          {/* Row 2: Job title */}
          <h1 className="drawer-job-title">{job.title || 'Job Title'}</h1>

          {/* Row 3: Location • Posted */}
          <div className="drawer-subtitle">
            {job.location && <span>{job.location}</span>}
            {job.location && job.posted_date && <span className="drawer-dot">•</span>}
            {job.posted_date && (
              <span>Posted {job.posted_date?.slice(0, 10)}</span>
            )}
            {job.experience_required && (
              <>
                <span className="drawer-dot">•</span>
                <span>{job.experience_required}</span>
              </>
            )}
          </div>

          {/* Row 4: Badges */}
          <div className="drawer-badges-row">
            {empBadges.map(b => (
              <span key={b} className="drawer-badge">{b}</span>
            ))}
            {job.workplace_type && job.workplace_type !== 'N/A' && (
              <span className={getWorkplaceBadgeClass(job.workplace_type)}>
                {job.workplace_type}
              </span>
            )}
            {job.salary && (
              <span className="drawer-badge badge-salary">{job.salary}</span>
            )}
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────────── */}
        <div className="drawer-content">
          {/* Skills */}
          {job.skills && (
            <div className="doc-section">
              <h3 className="doc-section-title">Skills</h3>
              <div className="skills-cloud">
                {job.skills.split(',').map(skill => (
                  <span key={skill.trim()} className="skill-chip">{skill.trim()}</span>
                ))}
              </div>
            </div>
          )}

          {job.skills && <div className="doc-divider" />}

          {/* Description — detect HTML anywhere, not just at start of string */}
          <div className="doc-section">
            <h3 className="doc-section-title">Job Description</h3>
            {job.loading ? (
              <div className="premium-skeleton">
                <div className="skeleton-line full"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-spacer"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line full"></div>
                <div className="skeleton-line short"></div>
                <div className="skeleton-spacer"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-line long"></div>
              </div>
            ) : containsHtml(job.description) ? (
              <div
                className="job-description-html content-fade-in"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            ) : (
              <div className="content-fade-in" style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {job.description || 'No description available.'}
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky Apply Now footer ─────────────────────────────── */}
        <div className="drawer-footer">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="drawer-apply-btn-full"
            onClick={e => e.stopPropagation()}
          >
            Apply Now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
});

const CandidateDetailsDrawer = React.memo(({ candidate, onClose, onRefresh }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeDocumentKey, setActiveDocumentKey] = useState(null);
  const [documentPreview, setDocumentPreview] = useState({ status: 'idle', objectUrl: null, blob: null, error: '' });
  const [documentDownloading, setDocumentDownloading] = useState(false);
  const [matchingState, setMatchingState] = useState({
    loading: false,
    running: false,
    error: '',
    jobs: [],
    matchRun: null,
  });

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh(candidate);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };
  const documentLinks = useMemo(() => {
    const timestamp = new Date().getTime();
    return [
      {
        key: 'resume',
        label: 'Resume',
        sourceUrl: candidate?.resume_url,
        // previewUrl: streams the blob via authenticated backend proxy
        previewUrl: candidate?.unique_id ? `${API_BASE_URL}/candidates/${candidate.unique_id}/documents/resume?t=${timestamp}` : null,
        // viewUrl: redirects to a public SAS URL — usable by Office Online
        viewUrl: candidate?.resume_url ? `${API_BASE_URL}${candidate.resume_url}` : null,
      },
      {
        key: 'passport',
        label: 'Passport',
        sourceUrl: candidate?.passport_url,
        previewUrl: candidate?.unique_id ? `${API_BASE_URL}/candidates/${candidate.unique_id}/documents/passport?t=${timestamp}` : null,
        viewUrl: candidate?.passport_url ? `${API_BASE_URL}${candidate.passport_url}` : null,
      },
      {
        key: 'work_authorization',
        label: 'Work Authorization',
        sourceUrl: candidate?.work_authorization_url,
        previewUrl: candidate?.unique_id ? `${API_BASE_URL}/candidates/${candidate.unique_id}/documents/work_authorization?t=${timestamp}` : null,
        viewUrl: candidate?.work_authorization_url ? `${API_BASE_URL}${candidate.work_authorization_url}` : null,
      },
      {
        key: 'id_proof',
        label: 'ID Proof',
        sourceUrl: candidate?.id_proof_url,
        previewUrl: candidate?.unique_id ? `${API_BASE_URL}/candidates/${candidate.unique_id}/documents/id_proof?t=${timestamp}` : null,
        viewUrl: candidate?.id_proof_url ? `${API_BASE_URL}${candidate.id_proof_url}` : null,
      }
    ].filter(doc => !!doc.sourceUrl);
  }, [candidate]);

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
  };

  useEffect(() => {
    if (!documentLinks.length) {
      setActiveDocumentKey(null);
      return;
    }

    if (!documentLinks.some(doc => doc.key === activeDocumentKey)) {
      setActiveDocumentKey(documentLinks[0].key);
    }
  }, [activeDocumentKey, documentLinks]);

  const activeDocument = useMemo(
    () => documentLinks.find(doc => doc.key === activeDocumentKey) || documentLinks[0] || null,
    [activeDocumentKey, documentLinks]
  );
  const activeDocumentPreviewKind = getDocumentPreviewKind(activeDocument?.sourceUrl || '');
  const activeDocumentViewerUrl = documentPreview.objectUrl || activeDocument?.previewUrl || activeDocument?.sourceUrl || '';

  const handleDocumentDownload = async () => {
    if (!activeDocument?.sourceUrl) return;

    setDocumentDownloading(true);
    const fileName = getDocumentFileNameFromUrl(
      activeDocument.sourceUrl,
      `${activeDocument.label.toLowerCase().replace(/\s+/g, '-')}`
    );

    try {
      const response = await fetch(activeDocument.sourceUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.warn(`Direct download failed, falling back to direct navigation:`, error);
      const link = document.createElement('a');
      link.href = activeDocument.sourceUrl;
      link.target = '_blank';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDocumentDownloading(false);
    }
  };

  const loadCandidateMatches = async (candidateId) => {
    if (!candidateId) return;
    setMatchingState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const response = await axios.get(`${API_BASE_URL}/candidates/${candidateId}/matches?limit=5`, {
        headers: { 'X-API-Key': API_KEY },
      });
      setMatchingState({
        loading: false,
        running: false,
        error: '',
        jobs: response.data?.jobs || [],
        matchRun: response.data?.match_run || null,
      });
    } catch (error) {
      setMatchingState((prev) => ({
        ...prev,
        loading: false,
        error: error.response?.data?.detail || 'Unable to load candidate matches.',
      }));
    }
  };

  const runCandidateMatching = async () => {
    if (!candidate?.unique_id) return;
    setMatchingState((prev) => ({ ...prev, running: true, error: '' }));
    try {
      const response = await axios.post(
        `${API_BASE_URL}/candidates/${candidate.unique_id}/matches/run`,
        {},
        { headers: { 'X-API-Key': API_KEY } }
      );
      const storedResults = response.data?.stored_results || {};
      setMatchingState({
        loading: false,
        running: false,
        error: '',
        jobs: storedResults.jobs || [],
        matchRun: storedResults.match_run || null,
      });
    } catch (error) {
      setMatchingState((prev) => ({
        ...prev,
        running: false,
        error: error.response?.data?.detail || 'Unable to run candidate matching.',
      }));
    }
  };

  useEffect(() => {
    if (!activeDocument?.previewUrl) {
      setDocumentPreview({ status: 'idle', objectUrl: null, blob: null, error: '' });
      return;
    }

    let cancelled = false;
    let localUrl = null;

    // Fetch blob for docx (needs docx-preview rendering), images (need auth proxy), and PDFs (blob URL makes #toolbar fragment work)
    const needsBlobFetch = activeDocumentPreviewKind === 'docx' || activeDocumentPreviewKind === 'image' || activeDocumentPreviewKind === 'pdf';

    if (needsBlobFetch) {
      setDocumentPreview({ status: 'loading', objectUrl: null, blob: null, error: '' });

      axios.get(activeDocument.previewUrl, {
        headers: { 'X-API-Key': API_KEY },
        responseType: 'blob'
      })
        .then((response) => {
          if (cancelled) return;
          localUrl = URL.createObjectURL(response.data);
          setDocumentPreview({ status: 'ready', objectUrl: localUrl, blob: response.data, error: '' });
        })
        .catch((error) => {
          if (cancelled) return;
          const errorMessage = error.response?.data?.detail || `Unable to preview ${activeDocument.label.toLowerCase()}.`;
          setDocumentPreview({ status: 'error', objectUrl: null, blob: null, error: errorMessage });
        });
    } else {
      // PDF and text: use backend proxy URL directly in <iframe> — no blob download needed
      setDocumentPreview({ status: 'ready', objectUrl: null, blob: null, error: '' });
    }

    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [activeDocument?.previewUrl, activeDocumentPreviewKind]);

  useEffect(() => {
    if (!candidate?.unique_id) {
      setMatchingState({ loading: false, running: false, error: '', jobs: [], matchRun: null });
      return;
    }
    loadCandidateMatches(candidate.unique_id);
  }, [candidate?.unique_id]);

  if (!candidate) return null;

  return (
    <div className={`drawer-overlay${isClosing ? ' drawer-overlay--closing' : ''}`} style={{ zIndex: 6000 }} onClick={handleClose}>
      <div className={`details-drawer candidate-drawer${isClosing ? ' details-drawer--closing' : ''}`} style={{ width: '950px' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-job-header">
          <div className="drawer-header-top">
            <div className="drawer-company-row">
              <div className="drawer-company-logo" style={{ background: '#eff6ff' }}>
                <Users size={20} color="#2563eb" />
              </div>
              <span className="drawer-company-name">Candidate Portfolio</span>
            </div>
            <div className="drawer-header-actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                className={`drawer-refresh-btn ${isRefreshing ? 'animate-spin' : ''}`}
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh latest data"
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={18} />
              </button>
              <button className="drawer-close-btn" onClick={handleClose} title="Close">
                <X size={18} />
              </button>
            </div>
          </div>
          <h1 className="drawer-job-title" style={{ marginTop: '12px' }}>{candidate.full_name}</h1>
          <div className="drawer-subtitle">
            <span>{candidate.unique_id}</span>
            <span className="drawer-dot">•</span>
            <span>{candidate.visa_status || 'Visa status not available'}</span>
          </div>
        </div>

        <div className="drawer-content">
          <div className="doc-section">
            <h3 className="doc-section-title">Candidate Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Mail size={18} color="var(--text-secondary)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Email</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>{candidate.email || '—'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Phone size={18} color="var(--text-secondary)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Contact</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>{candidate.contact || candidate.phone || '—'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Info size={18} color="var(--text-secondary)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Employment</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>{candidate.employment_type || '—'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Calendar size={18} color="var(--text-secondary)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Graduation Year</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>{candidate.graduation_year || '—'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <DollarSign size={18} color="var(--text-secondary)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Bill Rate</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>{candidate.bill_rate ? `$${candidate.bill_rate}` : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="doc-divider" />

          <div className="doc-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 className="doc-section-title" style={{ margin: 0 }}>Matching Results</h3>
              <button
                type="button"
                onClick={runCandidateMatching}
                disabled={matchingState.running || candidate.formatted_resume_status !== 'completed'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: matchingState.running ? '#c7d2fe' : '#4f46e5',
                  color: '#ffffff',
                  fontWeight: '700',
                  cursor: matchingState.running || candidate.formatted_resume_status !== 'completed' ? 'not-allowed' : 'pointer',
                  opacity: candidate.formatted_resume_status !== 'completed' ? 0.6 : 1,
                }}
              >
                {matchingState.running ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                {matchingState.running ? 'Running Matching...' : 'Run Matching'}
              </button>
            </div>

            <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Runs candidate-job matching using the formatted resume and latest scraped jobs.
            </p>

            {matchingState.matchRun && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
                <span style={{ padding: '8px 12px', borderRadius: '999px', background: '#eef2ff', color: '#4338ca', fontSize: '12px', fontWeight: '800' }}>
                  Match Run: {matchingState.matchRun.match_run_id}
                </span>
                {matchingState.matchRun.created_at && (
                  <span style={{ padding: '8px 12px', borderRadius: '999px', background: '#f8fafc', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '700' }}>
                    {new Date(matchingState.matchRun.created_at).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {matchingState.error && (
              <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', fontWeight: '600' }}>
                {matchingState.error}
              </div>
            )}

            {matchingState.loading ? (
              <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '700' }}>
                <RefreshCw size={14} className="animate-spin" />
                Loading latest match results...
              </div>
            ) : matchingState.jobs.length === 0 ? (
              <div style={{ marginTop: '18px', padding: '18px', borderRadius: '14px', background: '#f8fafc', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>
                No stored matches yet. Run the matcher to generate job recommendations for this candidate.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px', marginTop: '18px' }}>
                {matchingState.jobs.map((item) => (
                  <div key={`${item.job?.job_id}-${item.rank}`} style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', height: '28px', borderRadius: '999px', background: '#eef2ff', color: '#4338ca', fontWeight: '800', fontSize: '12px' }}>
                            #{item.rank}
                          </span>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{item.job?.title || 'Untitled role'}</div>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {item.job?.company_name || 'Unknown company'} {item.job?.location ? `• ${item.job.location}` : ''}
                        </div>
                        {item.summary && (
                          <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{item.summary}</p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Match Score</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#4338ca' }}>{item.match_score ?? 0}</div>
                        {item.job?.url && (
                          <a
                            href={item.job.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2563eb', fontSize: '12px', fontWeight: '700' }}
                          >
                            <ExternalLink size={12} />
                            Open Job
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="doc-divider" />

          <div className="doc-section">
            <h3 className="doc-section-title">Verified Skills</h3>
            <div className="skills-cloud" style={{ marginTop: '16px' }}>
              {(candidate.skill_set || candidate.skills || 'General Professional').split(',').map(s => (
                <span key={s.trim()} className="skill-chip">{s.trim()}</span>
              ))}
            </div>
          </div>

          <div className="doc-divider" />

          <div className="doc-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="doc-section-title" style={{ margin: 0 }}>Candidate Documents</h3>
              {activeDocument && (
                <a href={activeDocumentViewerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ExternalLink size={14} /> Open {activeDocument.label}
                </a>
              )}
            </div>
            {documentLinks.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                  {documentLinks.map(doc => (
                    <button
                      key={doc.key}
                      type="button"
                      onClick={() => setActiveDocumentKey(doc.key)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: activeDocument?.key === doc.key ? '#2563eb' : '#eff6ff',
                        color: activeDocument?.key === doc.key ? '#ffffff' : '#2563eb',
                        fontSize: '13px',
                        fontWeight: '700',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <FileText size={14} />
                      {doc.label}
                    </button>
                  ))}
                </div>
                <div style={{ height: '700px', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: '#e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                  {documentPreview.status === 'loading' ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#f8fafc', color: 'var(--text-secondary)', fontWeight: '700' }}>
                      <RefreshCw size={18} className="animate-spin" />
                      Loading document preview...
                    </div>
                  ) : documentPreview.status === 'error' ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#f8fafc', padding: '24px', textAlign: 'center' }}>
                      <AlertCircle size={28} color="#f97316" />
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '360px' }}>{documentPreview.error}</p>
                      {activeDocument && (
                        <a
                          href={activeDocument.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', fontWeight: '700', textDecoration: 'none' }}
                        >
                          <ExternalLink size={14} />
                          Open Original File
                        </a>
                      )}
                    </div>
                  ) : activeDocumentPreviewKind === 'image' ? (
                    <div style={{ height: '100%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                      {documentPreview.status === 'loading' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                          <RefreshCw size={18} className="animate-spin" /> Loading image...
                        </div>
                      ) : documentPreview.objectUrl ? (
                        <img
                          src={documentPreview.objectUrl}
                          alt={`${activeDocument?.label || 'Document'} preview`}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        />
                      ) : null}
                    </div>
                  ) : activeDocumentPreviewKind === 'docx' ? (
                    documentPreview.blob ? <DocxViewer blob={documentPreview.blob} filename={activeDocument?.label || 'Document.docx'} /> : null
                  ) : activeDocumentPreviewKind === 'pdf' ? (
                    documentPreview.objectUrl ? (
                      <iframe
                        src={`${documentPreview.objectUrl}#toolbar=0&navpanes=0&view=FitH`}
                        width="100%"
                        height="100%"
                        title={`${activeDocument?.label || 'Document'} Preview`}
                        style={{ border: 'none', display: 'block' }}
                      />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#f8fafc', color: 'var(--text-secondary)', fontWeight: '700' }}>
                        <RefreshCw size={18} className="animate-spin" /> Loading PDF...
                      </div>
                    )
                  ) : activeDocumentPreviewKind === 'text' ? (
                    <iframe
                      src={activeDocumentViewerUrl}
                      width="100%"
                      height="100%"
                      title={`${activeDocument?.label || 'Document'} Preview`}
                      style={{ border: 'none', display: 'block' }}
                    />
                  ) : (
                    /* Fallback for 'office' (non-docx) and 'binary' */
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', background: '#f8fafc', padding: '24px', textAlign: 'center' }}>
                      <div style={{ background: '#eff6ff', padding: '32px', borderRadius: '24px', color: '#2563eb' }}>
                        <FileSearch size={48} />
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Inline Preview Unavailable</h4>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                          {activeDocumentPreviewKind === 'office' 
                            ? `This Office format (${getDocumentExtensionFromUrl(activeDocument.sourceUrl)}) cannot be previewed directly.`
                            : "This file type requires an external application to view."}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={handleDocumentDownload}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: '#2563eb', color: '#fff', fontWeight: '700', border: 'none', cursor: 'pointer' }}
                        >
                          <Download size={18} /> Download to View
                        </button>
                        <a
                          href={activeDocument.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: '#fff', color: '#2563eb', fontWeight: '700', border: '1px solid #e2e8f0', textDecoration: 'none' }}
                        >
                          <ExternalLink size={18} /> Open Link
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '60px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1.5px dashed var(--border-color)' }}>
                <FileSearch size={40} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No documents available for this profile.</p>
              </div>
            )}
          </div>
        </div>

        <div className="drawer-footer">
          {activeDocument && (
            <button
              type="button"
              onClick={handleDocumentDownload}
              disabled={documentDownloading}
              className="drawer-apply-btn-full"
              style={{ background: '#2563eb', border: 'none', cursor: documentDownloading ? 'wait' : 'pointer' }}
            >
              {documentDownloading ? `Downloading ${activeDocument.label}...` : `Download ${activeDocument.label}`}
              <FileSearch size={18} style={{ marginLeft: '10px' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const ResumeProcessingDrawer = React.memo(({
  candidate,
  form,
  submitting,
  message,
  onChange,
  onSubmit,
  onClose,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [formattedResumeDownloading, setFormattedResumeDownloading] = useState(false);

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
  };

  const [formattedPreview, setFormattedPreview] = useState({ status: 'idle', objectUrl: null, blob: null, error: '' });

  useEffect(() => {
    if (!candidate?.unique_id || candidate.formatted_resume_status !== 'completed') {
      setFormattedPreview({ status: 'idle', objectUrl: null, blob: null, error: '' });
      return;
    }

    const previewKind = getDocumentPreviewKind(candidate.formatted_resume_url || '');
    const previewUrl = `${API_BASE_URL}/candidates/${candidate.unique_id}/documents/formatted_resume`;
    
    let cancelled = false;
    let localUrl = null;

    // Only fetch blob if it's a docx (formatted resumes are usually docx)
    if (previewKind === 'docx') {
      setFormattedPreview({ status: 'loading', objectUrl: null, blob: null, error: '' });

      axios.get(previewUrl, {
        headers: { 'X-API-Key': API_KEY },
        responseType: 'blob'
      })
        .then((response) => {
          if (cancelled) return;
          localUrl = URL.createObjectURL(response.data);
          setFormattedPreview({ status: 'ready', objectUrl: localUrl, blob: response.data, error: '' });
        })
        .catch((error) => {
          if (cancelled) return;
          setFormattedPreview({ status: 'error', objectUrl: null, blob: null, error: 'Unable to fetch formatted resume.' });
        });
    } else {
      // Use direct URL for PDF/other formats
      setFormattedPreview({ status: 'ready', objectUrl: null, blob: null, error: '' });
    }

    return () => { 
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [candidate?.unique_id, candidate?.formatted_resume_status]);

  if (!candidate) return null;

  const status = candidate.formatted_resume_status || 'not_started';
  const missingDetails = candidate.formatted_resume_missing_field_details || [];
  const missingPaths = missingDetails.flatMap(detail => detail.missing_paths || []);
  const showAcademicSection = missingPaths.some(path => path.startsWith('Academics'));
  const showExperienceSection = missingPaths.some(path => path.startsWith('Professional_Experience'));
  const showTechnicalSkills = missingPaths.some(path => path.startsWith('Technical_Skills'));
  const formattedPreviewKind = getDocumentPreviewKind(candidate.formatted_resume_url || '');
  const formattedPreviewUrl = candidate.formatted_resume_url || '';
  const isActionableError = status === 'needs_input';
  const canPreviewFormattedResume = status === 'completed' && candidate.formatted_resume_url;

  const handleFormattedResumeDownload = async () => {
    if (!candidate?.unique_id || !candidate?.formatted_resume_url) return;

    setFormattedResumeDownloading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/candidates/${candidate.unique_id}/documents/formatted_resume`,
        {
          headers: { 'X-API-Key': API_KEY },
          responseType: 'blob'
        }
      );
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = getDocumentFileNameFromUrl(
        candidate.formatted_resume_url,
        'formatted-resume.docx'
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Failed to download formatted resume:', error);
    } finally {
      setFormattedResumeDownloading(false);
    }
  };

  return (
    <div className={`drawer-overlay${isClosing ? ' drawer-overlay--closing' : ''}`} style={{ zIndex: 7000 }} onClick={handleClose}>
      <div className={`details-drawer candidate-drawer${isClosing ? ' details-drawer--closing' : ''}`} style={{ width: '950px' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-job-header">
          <div className="drawer-header-top">
            <div className="drawer-company-row">
              <div className="drawer-company-logo" style={{ background: '#eff6ff' }}>
                <FileText size={20} color="#2563eb" />
              </div>
              <span className="drawer-company-name">Resume Processing</span>
            </div>
            <div className="drawer-header-actions">
              <button className="drawer-close-btn" onClick={handleClose} title="Close">
                <X size={18} />
              </button>
            </div>
          </div>
          <h1 className="drawer-job-title" style={{ marginTop: '12px' }}>{candidate.full_name}</h1>
          <div className="drawer-subtitle">
            <span>{candidate.unique_id}</span>
            <span className="drawer-dot">•</span>
            <span>{candidate.email || 'No email available'}</span>
          </div>
        </div>

        <div className="drawer-content">
          {message && (
            <div style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '700',
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: message.type === 'success' ? '#16a34a' : '#dc2626',
              border: `1px solid ${message.type === 'success' ? '#dcfce7' : '#fecaca'}`
            }}>
              {message.text}
            </div>
          )}

          <div className="doc-section">
            <h3 className="doc-section-title">Processing Status</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '999px',
                background: status === 'completed' ? '#dcfce7' : status === 'processing' ? '#fef3c7' : status === 'not_started' ? '#f1f5f9' : '#fee2e2',
                color: status === 'completed' ? '#15803d' : status === 'processing' ? '#b45309' : status === 'not_started' ? '#64748b' : '#dc2626',
                fontSize: '13px',
                fontWeight: '800'
              }}>
                {status === 'completed' ? <CheckCircle2 size={14} /> : status === 'processing' ? <Clock size={14} /> : status === 'not_started' ? <History size={14} /> : <AlertCircle size={14} />}
                {status === 'completed' ? 'Formatted Resume Ready' : status === 'processing' ? 'Formatting In Progress' : status === 'not_started' ? 'Queued for Processing' : status === 'needs_input' ? 'Missing Required Details' : 'Formatting Failed'}
              </span>
              {candidate.formatted_resume_processed_at && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '999px',
                  background: '#f8fafc',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '700'
                }}>
                  <Calendar size={14} />
                  {new Date(candidate.formatted_resume_processed_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {canPreviewFormattedResume && (
            <>
              <div className="doc-divider" />
              <div className="doc-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="doc-section-title" style={{ margin: 0 }}>Formatted Resume</h3>
                  <a
                    href={formattedPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '13px', color: '#2563eb', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ExternalLink size={14} />
                    Open Resume
                  </a>
                </div>
                <div style={{ height: '850px', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                  {formattedPreview.status === 'loading' ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#f8fafc', color: 'var(--text-secondary)', fontWeight: '700' }}>
                      <RefreshCw size={18} className="animate-spin" />
                      Loading document preview...
                    </div>
                  ) : formattedPreview.status === 'error' ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#f8fafc', padding: '24px', textAlign: 'center' }}>
                      <AlertTriangle size={28} color="#f97316" />
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '360px' }}>{formattedPreview.error}</p>
                    </div>
                  ) : formattedPreviewKind === 'docx' ? (
                    formattedPreview.blob ? <DocxViewer blob={formattedPreview.blob} filename="Formatted_Resume.docx" url={formattedPreviewUrl} /> : null
                  ) : formattedPreviewKind === 'pdf' ? (
                    <iframe
                      src={`${API_BASE_URL}/candidates/${candidate.unique_id}/documents/formatted_resume#toolbar=0&navpanes=0&view=FitH`}
                      width="100%"
                      height="100%"
                      title="Formatted Resume Preview"
                      style={{ border: 'none', background: '#ffffff' }}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#f8fafc', padding: '24px', textAlign: 'center' }}>
                      <FileSearch size={28} color="#94a3b8" />
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Preview not available for this format.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {(isActionableError || (status === 'failed' && candidate.formatted_resume_error)) && (
            <>
              <div className="doc-divider" />
              <div className="doc-section">
                <h3 className="doc-section-title">Required Fixes</h3>
                {candidate.formatted_resume_error && (
                  <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', fontWeight: '600' }}>
                    {candidate.formatted_resume_error}
                  </div>
                )}
                {missingDetails.length > 0 && (
                  <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                    {missingDetails.map((detail) => (
                      <div key={`${detail.field}-${detail.message}`} style={{ padding: '14px 16px', borderRadius: '14px', background: '#fff7ed', border: '1px solid #fed7aa' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {detail.field}
                        </div>
                        <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#9a3412', lineHeight: '1.6' }}>{detail.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {isActionableError && form && (
                  <form onSubmit={onSubmit} style={{ display: 'grid', gap: '18px', marginTop: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {missingPaths.some(path => path === 'Name') && (
                        <div className="premium-form-group">
                          <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Candidate Name</label>
                          <input type="text" value={form.Name} onChange={e => onChange('Name', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                        </div>
                      )}
                      {missingPaths.some(path => path === 'Phone') && (
                        <div className="premium-form-group">
                          <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Phone</label>
                          <input type="text" value={form.Phone} onChange={e => onChange('Phone', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                        </div>
                      )}
                      {missingPaths.some(path => path === 'Email') && (
                        <div className="premium-form-group">
                          <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Email</label>
                          <input type="email" value={form.Email} onChange={e => onChange('Email', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                        </div>
                      )}
                    </div>

                    {missingPaths.some(path => path === 'Summary') && (
                      <div className="premium-form-group">
                        <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Professional Summary</label>
                        <textarea rows={4} value={form.Summary} onChange={e => onChange('Summary', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', resize: 'vertical' }} />
                      </div>
                    )}

                    {showAcademicSection && (
                      <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid var(--border-color)', background: '#f8fafc' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>Academic Details</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <input type="text" placeholder="Degree" value={form.AcademicDegree} onChange={e => onChange('AcademicDegree', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                          <input type="text" placeholder="Major" value={form.AcademicMajor} onChange={e => onChange('AcademicMajor', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                          <input type="text" placeholder="University" value={form.AcademicUniversity} onChange={e => onChange('AcademicUniversity', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                        </div>
                      </div>
                    )}

                    {showTechnicalSkills && (
                      <div className="premium-form-group">
                        <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Technical Skills</label>
                        <textarea rows={4} value={form.TechnicalSkills} onChange={e => onChange('TechnicalSkills', e.target.value)} placeholder="Example:\nLanguages: Python, Java\nCloud: AWS, Azure" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', resize: 'vertical' }} />
                      </div>
                    )}

                    {showExperienceSection && (
                      <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid var(--border-color)', background: '#f8fafc', display: 'grid', gap: '14px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>Professional Experience</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <input type="text" placeholder="Company" value={form.ExperienceCompany} onChange={e => onChange('ExperienceCompany', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                          <input type="text" placeholder="Location" value={form.ExperienceLocation} onChange={e => onChange('ExperienceLocation', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                          <input type="text" placeholder="Title" value={form.ExperienceTitle} onChange={e => onChange('ExperienceTitle', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                          <input type="text" placeholder="Dates of employment" value={form.ExperienceDates} onChange={e => onChange('ExperienceDates', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                        </div>
                        <textarea rows={4} placeholder="Project description" value={form.ExperienceDescription} onChange={e => onChange('ExperienceDescription', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', resize: 'vertical' }} />
                        <textarea rows={5} placeholder="Responsibilities (one per line)" value={form.ExperienceResponsibilities} onChange={e => onChange('ExperienceResponsibilities', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', resize: 'vertical' }} />
                        <textarea rows={3} placeholder="Environment (comma separated)" value={form.ExperienceEnvironment} onChange={e => onChange('ExperienceEnvironment', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', resize: 'vertical' }} />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: '14px',
                        border: 'none',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {submitting ? 'Submitting Missing Details...' : 'Submit Missing Details'}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        <div className="drawer-footer">
          {canPreviewFormattedResume && (
            <button
              type="button"
              onClick={handleFormattedResumeDownload}
              disabled={formattedResumeDownloading}
              className="drawer-apply-btn-full"
              style={{ background: '#2563eb', border: 'none', cursor: formattedResumeDownloading ? 'wait' : 'pointer' }}
            >
              {formattedResumeDownloading ? 'Downloading Resume...' : 'Download Resume'}
              <FileSearch size={18} style={{ marginLeft: '10px' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const App = () => {
  const [activeTab, setActiveTab] = useState('candidate-matching');
  const [stats, setStats] = useState({
    jobs_scraped_today: 0,
    new_jobs: 0,
    matched_candidates: 0,
    tailored_resumes: 0,
    total_jobs: 0
  });
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState({ status: 'idle' });
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState({
    name: 'Hr',
    email: 'hr@tabnerglobal.com'
  });
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState(null);
  const [deleteConfirmCandidate, setDeleteConfirmCandidate] = useState(null);

  // Candidates State
  const [candidates, setCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateTier, setCandidateTier] = useState('All Tiers');
  const [candidateSort, setCandidateSort] = useState('recent'); // 'recent' | 'alphabetical'
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidatesTotal, setCandidatesTotal] = useState(0);
  const [resumeProcessingFilter, setResumeProcessingFilter] = useState('pending');
  const [selectedProcessingCandidate, setSelectedProcessingCandidate] = useState(null);
  const [processingForm, setProcessingForm] = useState(null);
  const [processingSubmitting, setProcessingSubmitting] = useState(false);
  const [processingMsg, setProcessingMsg] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Custom Dropdown Open States
  const [openDropdown, setOpenDropdown] = useState(null); // 'location', 'company', 'vendor', 'source'
  const [filterCompany, setFilterCompany] = useState('All Companies');
  const [filterLocation, setFilterLocation] = useState('All Locations');
  const [filterVendor, setFilterVendor] = useState('All Vendors');
  const [filterBadge, setFilterBadge] = useState('All Badges');
  const [showType, setShowType] = useState('both');
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tablePage, setTablePage] = useState(1);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [filterData, setFilterData] = useState({ vendors: [], companies: [], locations: [] });
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [scraperLogs, setScraperLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [candidatePhoneNumber, setCandidatePhoneNumber] = useState('');
  const [editSelectedCountry, setEditSelectedCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [candidateForm, setCandidateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    contact: '',
    visaStatus: VISA_STATUS_OPTIONS[0],
    skillSet: '',
    relocation: RELOCATION_OPTIONS[0],
    graduationYear: '',
    employmentType: EMPLOYMENT_TYPE_OPTIONS[0],
    billRate: ''
  });
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    contact: '',
    visaStatus: VISA_STATUS_OPTIONS[0],
    skillSet: '',
    relocation: RELOCATION_OPTIONS[0],
    graduationYear: '',
    employmentType: EMPLOYMENT_TYPE_OPTIONS[0],
    billRate: ''
  });
  const [candidateResume, setCandidateResume] = useState(null);
  const [candidatePassport, setCandidatePassport] = useState(null);
  const [candidateWorkAuthorization, setCandidateWorkAuthorization] = useState(null);
  const [candidateIdProof, setCandidateIdProof] = useState(null);
  const [editResume, setEditResume] = useState(null);
  const [editPassport, setEditPassport] = useState(null);
  const [editWorkAuthorization, setEditWorkAuthorization] = useState(null);
  const [editIdProof, setEditIdProof] = useState(null);
  const [candidateMsg, setCandidateMsg] = useState(null);
  const [editMsg, setEditMsg] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Settings State ──
  const [scrapeSettings, setScrapeSettings] = useState(null);
  const [originalSettings, setOriginalSettings] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [clearMsg, setClearMsg] = useState(null);
  const [clearingData, setClearingData] = useState(false);
  const [clearSheets, setClearSheets] = useState({
    active_scraped: true,
    inactive_scraped: true,
    active_dice: false,
    inactive_dice: false
  });

  const [showTimePicker, setShowTimePicker] = useState(null); // null | 'schedule_time' | 'cleaner_schedule_time'
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [settingsSubTab, setSettingsSubTab] = useState('menu'); // 'menu' | 'scraper' | 'scheduler' | 'database'
  const [prevTab, setPrevTab] = useState('candidate-matching');

  // ── Database Management State ──
  const [dbTables, setDbTables] = useState([]);
  const [dbTableCounts, setDbTableCounts] = useState({});
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState({ records: [], columns: [], total: 0 });
  const [tableInfo, setTableInfo] = useState(null);
  const [dbTablePage, setDbTablePage] = useState(1);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMsg, setDbMsg] = useState(null);
  const dbCache = useRef({ tables: null, tableData: {} });

  // ── Sidebar open/close ──
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── New Candidate State ──
  const [showPerfWarning, setShowPerfWarning] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [autoCollapse, setAutoCollapse] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [timezone, setTimezone] = useState('UTC-5 (EST)');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [currency, setCurrency] = useState('USD ($)');
  const [language, setLanguage] = useState('English (US)');
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('sk-*************************' + API_KEY.slice(-4));
  const [theme, setTheme] = useState('light');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'error' | 'info' }

  // ── Toast Utility ──
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
  }, [accentColor]);

  const fileInputRef = React.useRef(null);

  // Consolidated Primary Startup Logic (<500ms requirement)
  // 1. One-time Application Bootstrap
  useEffect(() => {
    const initApp = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/init`, {
          headers: { 'X-API-Key': API_KEY }
        });
        const { status: s, stats: st, settings: cfg } = res.data;
        setStatus(s);
        setStats(st);
        setScrapeSettings(cfg);
        setOriginalSettings(JSON.parse(JSON.stringify(cfg)));
        setIsBackendConnected(true);
      } catch (err) {
        console.error('Core app initialization failed', err);
        setIsBackendConnected(false);
      }
    };
    initApp();
  }, []); // Strictly once on mount

  // 2. Conditional Status Polling
  useEffect(() => {
    const pollInterval = (status.status === 'running' || status.status === 'starting') ? 2000 : 20000;
    const interval = setInterval(() => {
      // Only poll status if a background process is active or we are on the monitor tab
      if (status.status === 'running' || status.status === 'starting' || activeTab === 'candidate-matching') {
        fetchStatus();
        fetchStats();
      }
    }, pollInterval);
    return () => clearInterval(interval);
  }, [status.status, activeTab]);

  // 3. Resume Processing Live Polling
  useEffect(() => {
    if (activeTab !== 'resume-review') return;

    // Poll every 10 seconds while on the resume review page to track background worker progress
    const interval = setInterval(() => {
      fetchCandidates(candidateSearch, candidateTier, candidatePage);
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab, candidateSearch, candidateTier, candidatePage]);

  // Monitor scrape completion to auto-refresh the Job Board
  const prevStatusRef = useRef(status.status);
  useEffect(() => {
    const wasRunning = prevStatusRef.current === 'running' || prevStatusRef.current === 'starting';
    const isIdle = status.status === 'idle';

    if (wasRunning && isIdle) {
      console.log("Scrape completed, auto-refreshing UI...");
      if (activeTab === 'job-board') {
        loadInitialJobs();
      }
      fetchStats();
    }
    prevStatusRef.current = status.status;
  }, [status.status, activeTab]);

  // Ensure Database Manager loads data when its tab is active
  useEffect(() => {
    if (activeTab === 'settings' && settingsSubTab === 'database') {
      fetchDbTables();
    }
  }, [activeTab, settingsSubTab]);

  useEffect(() => {
    if (activeTab === 'job-board') {
      fetchFilters();
      if (jobs.length === 0) loadInitialJobs();
    }
    if (activeTab === 'candidate-matching' || activeTab === 'new-candidate' || activeTab === 'resume-review') {
      fetchCandidates(candidateSearch, candidateTier, 1);
    }
    if (activeTab === 'settings' && !scrapeSettings) fetchSettings();
    if (activeTab === 'settings' && settingsSubTab === 'scheduler') fetchScraperLogs();
  }, [activeTab, settingsSubTab]);

  // Handle server-side filtering
  useEffect(() => {
    if (activeTab === 'job-board') {
      loadInitialJobs();
    }
  }, [searchQuery, filterCompany, filterLocation, filterVendor, showType]);

  const filteredJobs = useMemo(() => {
    // With server-side filtering, filteredJobs is just the jobs we have fetched
    // But we might still do some client-side sorting if needed.
    // For now, we return jobs as is because the backend did the work.
    return jobs;
  }, [jobs]);

  const uniqueLocations = useMemo(() => {
    // Merge server-provided filters with currently loaded ones to be safe
    const values = [...new Set([...filterData.locations, ...jobs.map(j => (j.location || '').trim()).filter(Boolean)])];
    return ['All Locations', ...values.sort()];
  }, [jobs, filterData.locations]);

  const uniqueCompanies = useMemo(() => {
    const values = [...new Set([...filterData.companies, ...jobs.map(j => (j.company || '').trim()).filter(Boolean)])];
    return ['All Companies', ...values.sort()];
  }, [jobs, filterData.companies]);

  const uniqueVendors = useMemo(() => {
    const values = [...new Set([...filterData.vendors, ...jobs.map(j => (j.vendor || '').trim()).filter(Boolean)])];
    return ['All Vendors', ...values.sort()];
  }, [jobs, filterData.vendors]);

  const uniqueBadges = useMemo(() => {
    const badges = [];
    jobs.forEach(j => {
      if (j.workplace_type) badges.push(j.workplace_type.trim());
      if (j.job_type) badges.push(j.job_type.trim());
    });
    return ['All Categories', ...[...new Set(badges)].sort()];
  }, [jobs]);

  const totalPages = Math.max(1, Math.ceil((filteredTotal || 1) / rowsPerPage));
  const safePage = Math.min(tablePage, totalPages);
  const start = (safePage - 1) * rowsPerPage;

  const pageJobs = useMemo(
    // In server-side pagination combined with appending, we only show the slice for the current page
    () => filteredJobs.slice(start, start + rowsPerPage),
    [filteredJobs, start, rowsPerPage]
  );

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchFilters = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/jobs/filters`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setFilterData(res.data);
    } catch (err) {
      console.error('Failed to fetch filter data', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/status`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setStatus(res.data);
      setIsBackendConnected(true);
    } catch (err) {
      console.error('Failed to fetch status', err);
      setIsBackendConnected(false);
    }
  };

  const fetchScraperLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/scraper/logs`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setScraperLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch scraper logs', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchCandidates = async (search = '', tier = 'All Tiers', page = 1, sort = candidateSort) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, sort_by: sort });
      if (search) params.append('search', search);

      const res = await axios.get(`${API_BASE_URL}/candidates?${params.toString()}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setCandidates(res.data.candidates || []);
      setCandidatesTotal(res.data.total || 0);
      setCandidatePage(res.data.page || 1);
    } catch (err) {
      console.error('Failed to fetch candidates', err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCandidate = async (candidate) => {
    if (!candidate) return;
    // Optimistically set what we already have
    setSelectedCandidate(candidate);

    // Load full details (resume content, etc) in background
    try {
      const res = await axios.get(`${API_BASE_URL}/candidates/${candidate.unique_id}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setSelectedCandidate(res.data);
    } catch (err) {
      console.error('Failed to load full candidate details:', err);
    }
  };

  // Legacy function kept for compatibility - redirects to main fetchCandidates

  const loadInitialJobs = () => {
    setJobs([]);
    setPage(1);
    fetchJobs(1, true);
  };

  const fetchJobs = async (pageToFetch = page, isInitial = false) => {
    setLoading(true);
    try {
      const targetPage = isInitial ? 1 : pageToFetch;

      const params = new URLSearchParams({
        page: targetPage,
        limit: 50 // Increased from 20 to load more jobs at once
      });

      if (searchQuery) params.append('search', searchQuery);
      if (filterCompany !== 'All Companies') params.append('company', filterCompany);
      if (filterLocation !== 'All Locations') params.append('location', filterLocation);
      if (filterVendor !== 'All Vendors') params.append('vendor', filterVendor);
      if (showType !== 'both') params.append('job_type', showType);

      const res = await axios.get(`${API_BASE_URL}/jobs?${params.toString()}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      if (isInitial) {
        setJobs(res.data.jobs || []);
        setFilteredTotal(res.data.total || 0);
        setPage(2);
        setTablePage(1);
      } else {
        setJobs(prev => {
          const newJobs = res.data.jobs || [];
          const existingIds = new Set(prev.map(j => j.serial_no));
          const filteredNew = newJobs.filter(j => !existingIds.has(j.serial_no));
          return [...prev, ...filteredNew];
        });
        setPage(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobDetail = async (job) => {
    // Show basic info from the list immediately to make the UI feel fast
    setSelectedJobDetail({ ...job, loading: true });

    try {
      const res = await axios.get(`${API_BASE_URL}/jobs/${job.serial_no}?job_type=${job.type}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      if (res.data.job) {
        setSelectedJobDetail({ ...res.data.job, loading: false });
      } else {
        setSelectedJobDetail({ ...job, loading: false });
      }
    } catch (err) {
      console.error('Failed to fetch job detail', err);
      // Fallback to what we already have if the detailed fetch fails
      setSelectedJobDetail({ ...job, loading: false });
    }
  };

  const triggerScrape = async () => {
    try {
      await axios.post(`${API_BASE_URL}/trigger`, {}, { headers: { 'X-API-Key': API_KEY } });
      fetchStatus();
    } catch (err) {
      console.error('Trigger scrape failed', err);
      alert('Failed to trigger scrape: ' + (err.response?.data?.detail || err.message));
    }
  };

  const stopScrape = async () => {
    try {
      await axios.post(`${API_BASE_URL}/stop`, {}, { headers: { 'x-api-key': API_KEY } });
      fetchStatus();
    } catch (err) {
      console.error('Stop failed', err);
    }
  };

  const hasUnsavedChanges = () => {
    if (!scrapeSettings || !originalSettings) return false;
    // Simple deep comparison via JSON.stringify
    return JSON.stringify(scrapeSettings) !== JSON.stringify(originalSettings);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    window.location.reload();
  };

  const handleTabChange = (newTab) => {
    if (activeTab === 'settings' && hasUnsavedChanges()) {
      setPendingTab(newTab);
      setShowUnsavedModal(true);
    } else {
      if (newTab === 'settings') {
        setSettingsSubTab('menu');
      }
      setPrevTab(activeTab);
      setActiveTab(newTab);
      if (autoCollapse) setSidebarOpen(false);
    }
  };

  const confirmDiscardChanges = () => {
    setScrapeSettings(JSON.parse(JSON.stringify(originalSettings)));
    if (pendingTab === 'settings-menu') {
      setSettingsSubTab('menu');
    } else {
      setActiveTab(pendingTab);
      setPrevTab(activeTab);
      if (autoCollapse) setSidebarOpen(false);
    }
    setShowUnsavedModal(false);
    setPendingTab(null);
  };

  const handleNotificationToggle = async (checked) => {
    if (checked) {
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        new Notification('Tabner HR', {
          body: '✓ Notifications enabled. You will receive alerts for matches and scraper tasks.',
          icon: 'https://tabnerglobal.com/images/logo8.png'
        });
      } else {
        alert("Notification permission denied. Please enable in browser settings.");
        setNotificationsEnabled(false);
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings`, { headers: { 'X-API-Key': API_KEY } });
      setScrapeSettings(res.data);
      setOriginalSettings(JSON.parse(JSON.stringify(res.data)));
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/settings`, scrapeSettings, { headers: { 'X-API-Key': API_KEY } });
      const newSettings = res.data.config;
      setScrapeSettings(newSettings);
      setOriginalSettings(newSettings);
      setSettingsMsg({ type: 'success', text: '✓ Settings saved — will apply on next scrape run.' });
    } catch (err) {
      setSettingsMsg({ type: 'error', text: 'Failed to save: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setSettingsSaving(false);
      setTimeout(() => setSettingsMsg(null), 4000);
    }
  };

  const clearData = async () => {
    const selected = Object.entries(clearSheets).filter(([, v]) => v).map(([k]) => k);
    if (selected.length === 0) {
      setClearMsg({ type: 'error', text: 'Please select at least one table to clear.' });
      return;
    }
    setShowClearConfirm(true);
  };

  const confirmClearData = async () => {
    setShowClearConfirm(false);
    setClearingData(true);
    setClearMsg(null);
    try {
      const clearPromises = [];
      if (clearSheets.active_scraped) clearPromises.push(axios.delete(`${API_BASE_URL}/db/tables/active_scraped_data`, { headers: { 'X-API-Key': API_KEY } }));
      if (clearSheets.inactive_scraped) clearPromises.push(axios.delete(`${API_BASE_URL}/db/tables/inactive_scraped_data`, { headers: { 'X-API-Key': API_KEY } }));
      if (clearSheets.active_dice) clearPromises.push(axios.delete(`${API_BASE_URL}/db/tables/active_dice_jobs`, { headers: { 'X-API-Key': API_KEY } }));
      if (clearSheets.inactive_dice) clearPromises.push(axios.delete(`${API_BASE_URL}/db/tables/inactive_dice_jobs`, { headers: { 'X-API-Key': API_KEY } }));

      await Promise.all(clearPromises);

      const clearedNames = [];
      if (clearSheets.active_scraped) clearedNames.push('Active Scraped');
      if (clearSheets.inactive_scraped) clearedNames.push('Inactive Scraped');
      if (clearSheets.active_dice) clearedNames.push('Active Dice Jobs');
      if (clearSheets.inactive_dice) clearedNames.push('Inactive Dice Jobs');

      setClearMsg({ type: 'success', text: `✓ ${clearedNames.join(', ')} cleared.` });
      fetchStats();
    } catch (err) {
      setClearMsg({ type: 'error', text: 'Failed to clear: ' + (err.response?.data?.message || err.message) });
    } finally {
      setClearingData(false);
      setTimeout(() => setClearMsg(null), 4000);
    }
  };


  const handleCandidateSubmit = async (e) => {
    e.preventDefault();
    if (!candidateResume) {
      alert("Please upload a resume first.");
      return;
    }
    setCandidateSubmitting(true);
    try {
      const contactValue = formatContactValue(selectedCountry, candidatePhoneNumber);
      const formData = new FormData();
      formData.append('first_name', candidateForm.firstName);
      formData.append('last_name', candidateForm.lastName);
      formData.append('email', candidateForm.email);
      formData.append('contact', contactValue);
      formData.append('visa_status', candidateForm.visaStatus);
      formData.append('skill_set', candidateForm.skillSet);
      formData.append('relocation', candidateForm.relocation);
      formData.append('graduation_year', candidateForm.graduationYear);
      formData.append('employment_type', candidateForm.employmentType);
      formData.append('bill_rate', candidateForm.billRate);
      formData.append('resume', candidateResume);
      if (candidatePassport) formData.append('passport', candidatePassport);
      if (candidateWorkAuthorization) formData.append('work_authorization', candidateWorkAuthorization);
      if (candidateIdProof) formData.append('id_proof', candidateIdProof);

      const res = await axios.post(`${API_BASE_URL}/candidates/upload`, formData, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.status === 'ok') {
        showToast("✓ Candidate registered successfully!");
        setCandidateMsg({ type: 'success', text: 'Candidate profile, resume, and supporting documents have been stored successfully.' });
        setCandidateForm({
          firstName: '',
          lastName: '',
          email: '',
          contact: '',
          visaStatus: VISA_STATUS_OPTIONS[0],
          skillSet: '',
          relocation: RELOCATION_OPTIONS[0],
          graduationYear: '',
          employmentType: EMPLOYMENT_TYPE_OPTIONS[0],
          billRate: ''
        });
        setSelectedCountry(DEFAULT_PHONE_COUNTRY);
        setCandidatePhoneNumber('');
        setCandidateResume(null);
        setCandidatePassport(null);
        setCandidateWorkAuthorization(null);
        setCandidateIdProof(null);
        setTimeout(() => setCandidateMsg(null), 5000);

        // Refresh local table and DB manager counts
        fetchCandidates('', 'All Tiers', 1);
        fetchDbTables();
      }
    } catch (err) {
      console.error("Candidate registration failed", err);
      const errMsg = err.response?.data?.detail || "Registration failed. Please check your storage credentials.";
      showToast("✕ Registration failed");
      setCandidateMsg({ type: 'error', text: errMsg });
    } finally {
      setCandidateSubmitting(false);
    }
  };

  // useEffect removed for unified fetchCandidates

  const fetchDbTables = async (force = false) => {
    if (!force && dbCache.current.tables) {
      setDbTables(dbCache.current.tables.tables || []);
      setDbTableCounts(dbCache.current.tables.counts || {});
      return;
    }
    setDbLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/db/tables`, { headers: { 'X-API-Key': API_KEY } });
      dbCache.current.tables = res.data;
      setDbTables(res.data.tables || []);
      setDbTableCounts(res.data.counts || {});
    } catch (err) {
      console.error('Failed to fetch DB tables', err);
    } finally {
      setDbLoading(false);
    }
  };

  const fetchTableData = async (tableName, page = 1, force = false) => {
    const cacheKey = `${tableName}_${page}`;
    if (!force && dbCache.current.tableData[cacheKey]) {
      setTableData(dbCache.current.tableData[cacheKey].data);
      setTableInfo(dbCache.current.tableData[cacheKey].info);
      setDbTablePage(page);
      return;
    }
    setDbLoading(true);
    try {
      const [dataRes, infoRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/db/tables/${tableName}?page=${page}&limit=20`, { headers: { 'X-API-Key': API_KEY } }),
        axios.get(`${API_BASE_URL}/db/tables/${tableName}/info`, { headers: { 'X-API-Key': API_KEY } })
      ]);
      dbCache.current.tableData[cacheKey] = { data: dataRes.data, info: infoRes.data };
      setTableData(dataRes.data);
      setTableInfo(infoRes.data);
      setDbTablePage(page);
    } catch (err) {
      console.error('Failed to fetch table data', err);
      setTableData({ records: [], columns: [], total: 0 });
      setTableInfo(null);
    } finally {
      setDbLoading(false);
    }
  };

  const deleteTableData = async (tableName) => {
    if (!confirm(`Are you sure you want to clear all data from ${tableName}?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/db/tables/${tableName}`, { headers: { 'X-API-Key': API_KEY } });
      
      // Invalidate cache for this table
      const newCache = { ...dbCache.current.tableData };
      Object.keys(newCache).forEach(key => {
        if (key.startsWith(`${tableName}_`)) delete newCache[key];
      });
      dbCache.current.tableData = newCache;
      dbCache.current.tables = null; // Also force refresh counts
      
      setDbMsg({ type: 'success', text: `✓ ${tableName} cleared successfully.` });
      fetchDbTables(true);
      if (selectedTable === tableName) {
        fetchTableData(tableName, 1, true);
      }
    } catch (err) {
      setDbMsg({ type: 'error', text: 'Failed to clear table: ' + (err.response?.data?.message || err.message) });
    }
    setTimeout(() => setDbMsg(null), 4000);
  };

  const getChartData = () => {
    const counts = jobs.reduce((acc, job) => {
      const type = job.workplace_type || 'Not Specified';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const order = ['On-site', 'Hybrid', 'Remote', 'Not Specified'];
    return order.map(name => ({
      name,
      jobs: counts[name] || 0
    }));
  };

  const renderCandidateMatching = () => {
    return (
      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card card-blue">
            <div className="stat-info">
              <span>Matched Candidates</span>
              <div className="stat-value">{stats.matched_candidates || 0}</div>
              <div className="stat-subtext">Generated today</div>
            </div>
            <div className="stat-icon"><Users size={24} /></div>
          </div>
          <div className="stat-card card-green">
            <div className="stat-info">
              <span>Match Quality Score</span>
              <div className="stat-value">0%</div>
              <div className="stat-subtext">Across active matches</div>
            </div>
            <div className="stat-icon"><TrendingUp size={24} /></div>
          </div>
          <div className="stat-card card-purple">
            <div className="stat-info">
              <span>Resumes Optimized</span>
              <div className="stat-value">0</div>
              <div className="stat-subtext">AI-enhanced</div>
            </div>
            <div className="stat-icon"><FileText size={24} /></div>
          </div>
          <div className="stat-card card-amber">
            <div className="stat-info">
              <span>Applications Submitted</span>
              <div className="stat-value">0</div>
              <div className="stat-subtext">Successfully delivered</div>
            </div>
            <div className="stat-icon"><CheckCircle size={24} /></div>
          </div>
        </div>

        <div className="dashboard-main-split">
          <div className="dashboard-left-col" style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="section-card candidate-pool-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="section-header" style={{ padding: '24px', margin: 0, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', overflow: 'hidden' }}>
                <div className="section-title" style={{ flexShrink: 0 }}>
                  <Layers size={20} color="#6366f1" />
                  <h3>Candidate Pool</h3>
                  <span className="badge" style={{ background: 'var(--border-color)', color: 'var(--text-secondary)', marginLeft: '8px' }}>{candidatesTotal || 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                  <button
                    className="jb-refresh-btn"
                    onClick={() => fetchCandidates(candidateSearch, candidateTier, candidatePage)}
                    title="Refresh Candidates"
                    style={{
                      background: 'var(--border-color)',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <div className="jb-search-wrap" style={{ maxWidth: '280px', width: '100%', margin: 0, position: 'relative', minWidth: '120px' }}>
                    <Search size={14} className="jb-search-icon" />
                    <input
                      type="text"
                      className="jb-search-input"
                      placeholder="Search candidate..."
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchCandidates(candidateSearch, candidateTier, 1)}
                      style={{ background: 'var(--border-color)', border: 'none', width: '100%', margin: 0, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
              {loading && candidates.length === 0 ? (
                <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 0' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Loading candidates...</div>
                </div>
              ) : candidates.length === 0 ? (
                <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0' }}>
                  <div style={{ color: '#cbd5e1', marginBottom: '16px' }}>
                    <Users size={64} strokeWidth={1.5} />
                  </div>
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '18px', fontWeight: '500' }}>Waiting for Talent Sync...</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>The matching engine is active. Please register or upload candidates to begin.</p>
                </div>
              ) : (
                <div className="candidate-table-scroll" style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
                  <table className="candidate-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Visa Status</th>
                        <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Skills</th>
                        <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Relocation</th>
                        <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Employment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((candidate) => (
                        <tr key={candidate.unique_id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => handleViewCandidate(candidate)}>
                          <td style={{ padding: '14px 8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{candidate.full_name}</td>
                          <td style={{ padding: '14px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{candidate.visa_status || '—'}</td>
                          <td style={{ padding: '14px 8px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.skill_set || candidate.skills || '—'}</td>
                          <td style={{ padding: '14px 8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>{candidate.relocation || '—'}</td>
                          <td style={{ padding: '14px 8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>{candidate.employment_type || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {candidatesTotal > 20 && (
                    <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0', gap: '12px' }}>
                      <button
                        className="pagination-btn"
                        onClick={() => fetchCandidates(candidateSearch, candidateTier, Math.max(1, candidatePage - 1))}
                        disabled={candidatePage === 1}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {candidatePage} of {Math.ceil(candidatesTotal / 20)}</span>
                      <button
                        className="pagination-btn"
                        onClick={() => fetchCandidates(candidateSearch, candidateTier, candidatePage + 1)}
                        disabled={candidatePage * 20 >= candidatesTotal}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <BarChart3 size={20} color="#6366f1" />
                  <h3>Priority Breakdown</h3>
                </div>
              </div>
              <div className="priority-chart-container" style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'High', candidates: 0, matches: 0 },
                      { name: 'Medium', candidates: 0, matches: 0 },
                      { name: 'Low', candidates: 0, matches: 0 },
                    ]}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} style={{ fontSize: '12px', fontWeight: '500' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="candidates" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} name="Candidates" />
                    <Bar dataKey="matches" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} name="Matches" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="dashboard-side-col" style={{ flex: 1, alignSelf: 'stretch' }}>
            <div className="section-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="section-title">
                  <Activity size={20} color="#6366f1" />
                  <h3>Recent Activity</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#10b981' }}>Live</span>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
                    animation: 'pulse 2s infinite'
                  }} />
                </div>
              </div>
              <div className="empty-activity" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Activity size={48} strokeWidth={1} style={{ opacity: 0.15, marginBottom: '16px' }} />
                  <p style={{ fontSize: '14px', fontWeight: '500' }}>No recent activity to show</p>
                  <p style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>System logs will appear here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderJobBoard = () => {
    const getWorkplaceBadgeClass = (wt) => {
      if (!wt) return 'type-badge';
      const v = wt.toLowerCase();
      if (v === 'remote') return 'remote-badge';
      if (v === 'hybrid') return 'hybrid-badge';
      if (v === 'on-site') return 'onsite-badge';
      return 'type-badge';
    };

    const resetTablePage = () => setTablePage(1);

    return (
      <div className="dashboard-content">

        {/* KPI Cards */}
        <div className="stats-grid jb-stats-grid">
          <div className="stat-card card-sky">
            <div className="stat-info">
              <span>Total Job Listings</span>
              <div className="stat-value">{stats?.total_jobs || filteredTotal || jobs.length}</div>
              <div className="stat-subtext">Across all sources</div>
            </div>
            <div className="stat-icon"><Briefcase size={24} /></div>
          </div>
          <div className="stat-card card-slate">
            <div className="stat-info">
              <span>Jobs Collected Today</span>
              <div className="stat-value">{stats?.jobs_scraped_today || 0}</div>
              <div className="stat-subtext">Updated in last 24 hrs</div>
            </div>
            <div className="stat-icon"><TrendingUp size={24} /></div>
          </div>
        </div>

        {/* ── Filter Card ── */}
        <div className="jb-filter-card">
          <div className="jb-filter-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
            Refine Results
          </div>
          <div className="jb-filter-row single-line">
            {/* Search */}
            <div className="jb-search-wrap">
              <Search size={14} className="jb-search-icon" />
              <input
                type="text"
                className="jb-search-input"
                placeholder="Search jobs..."
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); resetTablePage(); }}
              />
            </div>

            {/* Reusable Searchable Dropdown Helper */}
            {(() => {
              const renderDropdown = (id, currentVal, options, setVal, icon) => {
                const isOpen = openDropdown === id;
                return (
                  <div className={`jb-custom-select-wrap ${isOpen ? 'open' : ''}`} id={`dropdown-${id}`}>
                    <div className="jb-custom-select-trigger" onClick={() => setOpenDropdown(isOpen ? null : id)}>
                      <span className="jb-custom-select-val">{currentVal}</span>
                      <ChevronDown size={14} className={`jb-custom-select-arrow ${isOpen ? 'rotate' : ''}`} />
                    </div>
                    {isOpen && (
                      <div className="jb-custom-select-panel">
                        <div className="jb-panel-search">
                          <input
                            type="text"
                            placeholder="Type to filter..."
                            autoFocus
                            className="jb-panel-search-input"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const term = e.target.value.toLowerCase();
                              // We just use native filtering on the render below
                              e.target.dataset.filter = term;
                              const items = e.target.closest('.jb-custom-select-panel').querySelectorAll('.jb-panel-item');
                              items.forEach(item => {
                                const text = item.textContent.toLowerCase();
                                item.style.display = text.includes(term) ? 'flex' : 'none';
                              });
                            }}
                          />
                        </div>
                        <div className="jb-panel-list">
                          {options.map(opt => (
                            <div
                              key={opt}
                              className={`jb-panel-item ${opt === currentVal ? 'selected' : ''}`}
                              onClick={() => { setVal(opt); setOpenDropdown(null); resetTablePage(); }}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <>
                  {renderDropdown('location', filterLocation, uniqueLocations, setFilterLocation)}
                  {renderDropdown('company', filterCompany, uniqueCompanies, setFilterCompany)}
                  {renderDropdown('vendor', filterVendor, uniqueVendors, setFilterVendor)}
                  {renderDropdown('source', showType === 'both' ? 'All Sources' : showType === 'active' ? 'Active Only' : 'Inactive Only',
                    ['All Sources', 'Active Only', 'Inactive Only'],
                    (v) => setShowType(v === 'All Sources' ? 'both' : v === 'Active Only' ? 'active' : 'inactive')
                  )}
                </>
              );
            })()}

            {/* Refresh */}
            <button className="jb-refresh-btn" onClick={loadInitialJobs} title="Refresh Data">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="job-table-wrapper">
          {loading && jobs.length === 0 ? (
            <div className="jb-loading">Loading jobs…</div>
          ) : (filteredJobs.length === 0 && !loading) ? (
            <div className="empty-state">
              <Briefcase className="empty-state-icon" />
              <p>No jobs found matching your filters.</p>
              <button className="jb-clear-btn" onClick={() => {
                setSearchInput(''); setSearchQuery(''); setFilterCompany('All Companies');
                setFilterLocation('All Locations'); setFilterVendor('All Vendors');
                setFilterBadge('All Badges'); setShowType('both');
              }}>Clear Filters</button>
            </div>
          ) : (
            <>
              {/* Toolbar: count + rows-per-page + view toggle */}
              <div className="jb-table-toolbar">
                <div className="jb-rows-select">
                  <span className="jb-result-count">{filteredTotal} matching jobs</span>
                  <span style={{ color: '#cbd5e1', margin: '0 8px' }}>·</span>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Display:</label>
                  <select
                    className="pagination-select"
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setTablePage(1); }}
                    style={{ border: 'none', background: 'var(--border-color)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}
                  >
                    {[5, 10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                {/* Table / Cards toggle */}
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Table view"
                  >
                    {/* List icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    Table
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                    onClick={() => setViewMode('cards')}
                    title="Cards view"
                  >
                    {/* Grid icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    Cards
                  </button>
                </div>
              </div>

              {viewMode === 'table' ? (
                /* ── TABLE VIEW ── */
                <div className="job-table-scroll">
                  <table className="job-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 140 }}>Job Title</th>
                        <th style={{ minWidth: 100 }}>Company</th>
                        <th style={{ minWidth: 150 }}>Vendor</th>
                        <th style={{ minWidth: 80 }}>Location</th>
                        <th style={{ minWidth: 110 }}>Type</th>
                        <th style={{ minWidth: 70 }}>Posted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageJobs.map((job) => (
                        <tr key={job.id} onClick={() => { fetchJobDetail(job); }}>
                          <td>
                            <div className="jt-title" title={job.title}>{job.title || '—'}</div>
                          </td>
                          <td className="jt-company jt-clamp" title={job.company}>{job.company || '—'}</td>
                          <td className="jt-vendor jt-clamp" title={job.vendor}>{job.vendor || '—'}</td>
                          <td className="jt-location jt-clamp" title={job.location}>{job.location || '—'}</td>
                          <td>{job.job_type ? <span className="jt-badge type-badge jt-clamp" title={job.job_type}>{job.job_type}</span> : '—'}</td>
                          <td className="jt-date">{job.posted_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── CARDS VIEW ── */
                <div className="jb-cards-grid">
                  {pageJobs.map((job) => {
                    const initials = (job.company || '?').trim().slice(0, 2).toUpperCase();
                    const hues = [210, 250, 170, 30, 340, 190, 280];
                    const hue = hues[(job.company || '').charCodeAt(0) % hues.length];
                    return (
                      <div key={job.id} className="jb-card" onClick={() => { fetchJobDetail(job); }}>
                        {/* Card header */}
                        <div className="jb-card-header">
                          <div className="jb-card-avatar" style={{ background: `hsl(${hue},60%,92%)`, color: `hsl(${hue},60%,35%)` }}>
                            {initials}
                          </div>
                          <div className="jb-card-meta">
                            <div className="jb-card-company">{job.company || '—'}</div>
                            <div className="jb-card-vendor">{job.vendor || '—'}</div>
                            <div className="jb-card-date">{job.posted_date || '—'}</div>
                          </div>
                        </div>

                        {/* Title */}
                        <div className="jb-card-title">{job.title || '—'}</div>

                        {/* Badges row */}
                        <div className="jb-card-badges">
                          {job.job_type && (
                            <span className="jt-badge type-badge">{job.job_type}</span>
                          )}
                          {job.location && (
                            <span className="jb-card-location">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                              {job.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination — same for both views */}
              <div className="pagination-bar">
                <button
                  className="pagination-btn"
                  onClick={() => setTablePage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  ← Prev
                </button>
                <span className="pagination-count" style={{ margin: '0 12px' }}>Page {safePage} of {totalPages}</span>
                <button
                  className="pagination-btn"
                  onClick={() => {
                    const nextPage = safePage + 1;
                    // If we don't have enough jobs loaded to show the next page, fetch more from API
                    if (filteredJobs.length < nextPage * rowsPerPage && jobs.length < filteredTotal) {
                      fetchJobs(page);
                    }
                    setTablePage(nextPage);
                  }}
                  disabled={safePage === totalPages || loading}
                >
                  {loading && safePage * rowsPerPage >= jobs.length ? 'Loading...' : 'Next →'}
                </button>
              </div>
            </>
          )}
        </div>

        <JobDetailsDrawer job={selectedJobDetail} onClose={() => { setSelectedJobDetail(null); }} />
      </div>
    );
  };

  const handleOpenProcessingCandidate = async (candidate) => {
    setProcessingMsg(null);

    try {
      const res = await axios.get(`${API_BASE_URL}/candidates/${candidate.unique_id}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setSelectedProcessingCandidate(res.data);
      setProcessingForm(buildResumeProcessingForm(res.data));
    } catch (err) {
      console.error('Failed to load resume processing details:', err);
      setSelectedProcessingCandidate(candidate);
      setProcessingForm(buildResumeProcessingForm(candidate));
      setProcessingMsg({ type: 'error', text: 'Unable to load the latest resume processing details.' });
    }
  };

  const handleProcessingFieldChange = (field, value) => {
    setProcessingForm(prev => ({ ...(prev || {}), [field]: value }));
  };

  const handleResumeCompletionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProcessingCandidate) return;

    setProcessingSubmitting(true);
    setProcessingMsg(null);
    try {
      const payload = buildResumeCompletionPayload(processingForm || {});
      const res = await axios.post(
        `${API_BASE_URL}/candidates/${selectedProcessingCandidate.unique_id}/formatted-resume/complete`,
        payload,
        { headers: { 'X-API-Key': API_KEY } }
      );

      const updatedCandidate = res.data?.candidate;
      if (updatedCandidate) {
        setCandidates(prev => prev.map(candidate => (
          candidate.unique_id === updatedCandidate.unique_id ? updatedCandidate : candidate
        )));
        setSelectedProcessingCandidate(updatedCandidate);
        setProcessingForm(buildResumeProcessingForm(updatedCandidate));
      }

      setProcessingMsg({
        type: 'success',
        text: updatedCandidate?.formatted_resume_status === 'completed'
          ? 'Formatted resume generated successfully.'
          : 'Missing fields saved. Additional inputs are still required.'
      });
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to submit the missing resume details.';
      setProcessingMsg({ type: 'error', text: errorMessage });
    } finally {
      setProcessingSubmitting(false);
    }
  };

  const resumeProcessingCounts = useMemo(() => {
    return candidates.reduce((acc, candidate) => {
      const bucket = getResumeProcessingBucket(candidate);
      acc[bucket] += 1;
      return acc;
    }, { pending: 0, review: 0, resolved: 0 });
  }, [candidates]);

  const filteredResumeProcessingCandidates = useMemo(() => {
    return candidates.filter(candidate => getResumeProcessingBucket(candidate) === resumeProcessingFilter);
  }, [candidates, resumeProcessingFilter]);

  const renderResumeReview = () => (
    <div className="dashboard-content">
      <div className="tabs">
        <button type="button" className={`tab ${resumeProcessingFilter === 'pending' ? 'active' : ''}`} onClick={() => setResumeProcessingFilter('pending')}>
          <AlertCircle size={16} /> Pending Action <span className="badge">{resumeProcessingCounts.pending}</span>
        </button>
        <button type="button" className={`tab ${resumeProcessingFilter === 'review' ? 'active' : ''}`} onClick={() => setResumeProcessingFilter('review')}>
          <Clock size={16} /> In Review <span className="badge">{resumeProcessingCounts.review}</span>
        </button>
        <button type="button" className={`tab ${resumeProcessingFilter === 'resolved' ? 'active' : ''}`} onClick={() => setResumeProcessingFilter('resolved')}>
          <CheckCircle2 size={16} /> Resolved <span className="badge">{resumeProcessingCounts.resolved}</span>
        </button>
      </div>
      <div className="section-card" style={{ padding: filteredResumeProcessingCandidates.length ? '12px 20px 20px' : undefined }}>
        {filteredResumeProcessingCandidates.length === 0 ? (
          <div className="empty-state">
            <Inbox className="empty-state-icon" />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>All caught up</h3>
            <p>No resumes currently in this state.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="job-table" style={{ width: '100%', borderSpacing: '0 10px', borderCollapse: 'separate' }}>
              <thead>
                <tr style={{ background: 'transparent' }}>
                  <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visa</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Processing Status</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Formatted Resume</th>
                </tr>
              </thead>
              <tbody>
                {filteredResumeProcessingCandidates.map(candidate => {
                  const status = candidate.formatted_resume_status || 'not_started';
                  const actionLabel = status === 'completed' ? 'View Resume' : status === 'needs_input' ? 'Fix Errors' : status === 'failed' ? 'Retry' : 'Processing';
                  const actionBg = status === 'completed' ? '#eff6ff' : (status === 'needs_input' || status === 'failed') ? '#fee2e2' : status === 'processing' ? '#fef3c7' : '#f1f5f9';
                  const actionColor = status === 'completed' ? '#2563eb' : (status === 'needs_input' || status === 'failed') ? '#dc2626' : status === 'processing' ? '#b45309' : '#64748b';
                  const isActionable = status === 'completed' || status === 'needs_input' || status === 'failed';

                  return (
                    <tr key={candidate.unique_id} style={{ background: 'var(--card-bg)', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }} className="table-row-premium">
                      <td style={{ padding: '20px', borderRadius: '16px 0 0 16px' }}>
                        <div style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>{candidate.full_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: '500' }}>{candidate.unique_id}</div>
                      </td>
                      <td style={{ padding: '20px' }}>
                        <div style={{ display: 'grid', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} /> {candidate.email || '—'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> {candidate.contact || candidate.phone || '—'}</div>
                        </div>
                      </td>
                      <td style={{ padding: '20px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>{candidate.visa_status || '—'}</td>
                      <td style={{ padding: '20px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '999px', background: actionBg, color: actionColor, fontSize: '12px', fontWeight: '800' }}>
                          {status === 'completed' ? <CheckCircle2 size={14} /> : status === 'processing' ? <Clock size={14} /> : status === 'not_started' ? <History size={14} /> : <AlertCircle size={14} />}
                          {status === 'completed' ? 'Completed' : status === 'needs_input' ? 'Needs Input' : status === 'failed' ? 'Failed' : status === 'processing' ? 'Processing' : 'Queued'}
                        </div>
                      </td>
                      <td style={{ padding: '20px', textAlign: 'right', borderRadius: '0 16px 16px 0' }}>
                        <button
                          type="button"
                          disabled={!isActionable}
                          onClick={() => isActionable && handleOpenProcessingCandidate(candidate)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            border: 'none',
                            background: isActionable ? actionBg : '#e2e8f0',
                            color: isActionable ? actionColor : '#94a3b8',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: isActionable ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <FileText size={14} />
                          {actionLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderUnsavedChangesModal = () => {
    if (!showUnsavedModal) return null;

    return (
      <div className="modal-overlay" style={{ zIndex: 10001 }}>
        <div className="modal-content" style={{ maxWidth: '450px', padding: '32px', textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: 'var(--amber-light)',
            color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <AlertCircle size={32} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Unsaved Changes</h3>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
            You have modified settings that haven't been saved yet. Would you like to save them before leaving, or discard them?
          </p>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              className="modal-btn-primary"
              style={{ flex: 1, padding: '14px', background: 'var(--accent-color, #6366f1)' }}
              onClick={async () => {
                await saveSettings();
                setShowUnsavedModal(false);
                if (pendingTab) {
                  setActiveTab(pendingTab);
                  setPendingTab(null);
                }
              }}
            >
              Save Changes
            </button>
            <button
              className="modal-btn-danger"
              style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={confirmDiscardChanges}
            >
              <Trash2 size={16} />
              Discard Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleCandidateEdit = (c) => {
    const parsedContact = parseContactValue(c.contact || c.phone || '');
    setEditingCandidate(c);
    setEditSelectedCountry(parsedContact.country);
    setEditPhoneNumber(parsedContact.number);
    setEditForm({
      firstName: c.first_name || '',
      lastName: c.last_name || '',
      email: c.email,
      contact: c.contact || c.phone || '',
      visaStatus: c.visa_status || VISA_STATUS_OPTIONS[0],
      skillSet: c.skill_set || c.skills || '',
      relocation: c.relocation || RELOCATION_OPTIONS[0],
      graduationYear: c.graduation_year || '',
      employmentType: c.employment_type || EMPLOYMENT_TYPE_OPTIONS[0],
      billRate: c.bill_rate ?? ''
    });
  };

  const handleDeleteCandidate = async (uniqueId) => {
    setDeletingCandidateId(uniqueId);
    try {
      await axios.delete(`${API_BASE_URL}/candidates/${uniqueId}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      setDeleteConfirmCandidate(null);
      showToast('✓ Candidate deleted successfully', 'success');
      fetchCandidates(candidateSearch, candidateTier, candidatePage);
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.detail || 'Failed to delete candidate. Please try again.');
    } finally {
      setDeletingCandidateId(null);
    }
  };

  const handleUpdateCandidate = async (e) => {
    if (e) e.preventDefault();
    setCandidateSubmitting(true);
    const contactValue = formatContactValue(editSelectedCountry, editPhoneNumber);
    const formData = new FormData();
    formData.append('first_name', editForm.firstName);
    formData.append('last_name', editForm.lastName);
    formData.append('email', editForm.email);
    formData.append('contact', contactValue);
    formData.append('visa_status', editForm.visaStatus);
    formData.append('skill_set', editForm.skillSet);
    formData.append('relocation', editForm.relocation);
    formData.append('graduation_year', editForm.graduationYear);
    formData.append('employment_type', editForm.employmentType);
    formData.append('bill_rate', editForm.billRate);
    if (editResume) formData.append('resume', editResume);
    if (editPassport) formData.append('passport', editPassport);
    if (editWorkAuthorization) formData.append('work_authorization', editWorkAuthorization);
    if (editIdProof) formData.append('id_proof', editIdProof);

    if (!editingCandidate?.unique_id) {
      console.error('Missing Synchronization ID for candidate.');
      setEditMsg({ type: 'error', text: 'Synchronization failed: Missing internal candidate identifier. Please refresh the Hub.' });
      setCandidateSubmitting(false);
      return;
    }

    try {
      const updateUrl = `${API_BASE_URL}/candidates/${editingCandidate.serial_no}`;
      console.log(`[Diagnostic] Syncing portfolio for serial_no [${editingCandidate.serial_no}] via:`, updateUrl);

      await axios.put(updateUrl, formData, {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Refresh the background list immediately so the UI reflects changes as soon as modal closes
      fetchCandidates(candidateSearch, candidateTier, candidatePage);
      
      setEditMsg({ type: 'success', text: 'Intelligence Portfolio updated successfully!' });
      showToast('✓ Portfolio updated successfully', 'success');
      
      setTimeout(() => {
        setEditingCandidate(null);
        setEditSelectedCountry(DEFAULT_PHONE_COUNTRY);
        setEditPhoneNumber('');
        setEditResume(null);
        setEditPassport(null);
        setEditWorkAuthorization(null);
        setEditIdProof(null);
        setEditMsg(null);
      }, 2000);
    } catch (err) {
      console.error('Update failed:', err);
      const errorMsg = err.response?.data?.detail || 'Synchronization failed. Please verify connection.';
      setEditMsg({ type: 'error', text: errorMsg });
      setTimeout(() => setEditMsg(null), 5000);
    } finally {
      setCandidateSubmitting(false);
    }
  };

  const renderNewCandidate = () => {
    return (
      <div className="dashboard-content no-max-width" style={{ padding: '0 40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Streamlined Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '48px', padding: '0 12px'
        }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.04em' }}>Candidate Hub</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '8px 0 0 0', fontWeight: '500' }}>Add fresh talent to the matching pool.</p>
          </div>
          <button
            onClick={() => setShowCandidateModal(true)}
            className="btn-premium"
            style={{
              padding: '14px 28px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
              border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 12px 24px rgba(99, 102, 241, 0.25)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Users size={20} />
            View Candidates
          </button>
        </div>

        <div style={{ width: '100%' }}>
          <div className="registration-card section-card" style={{
            width: '100%', padding: '48px',
            borderRadius: '32px', background: 'var(--card-bg)', border: '1px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.05)'
          }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.03em' }}>Register New Candidate</h2>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Populate the matching pool with fresh talent profiles</p>
            </div>

            {candidateMsg && (
              <div className={`settings-msg ${candidateMsg.type}`} style={{
                marginBottom: '32px', padding: '16px 20px', borderRadius: '16px',
                display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '600',
                background: candidateMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color: candidateMsg.type === 'success' ? '#16a34a' : '#dc2626',
                border: `1px solid ${candidateMsg.type === 'success' ? '#dcfce7' : '#fee2e2'}`
              }}>
                {candidateMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{candidateMsg.text}</span>
              </div>
            )}

            <form className="premium-form" onSubmit={handleCandidateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    First Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.firstName}
                    onChange={e => setCandidateForm({ ...candidateForm, firstName: e.target.value })}
                  />
                </div>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Last Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.lastName}
                    onChange={e => setCandidateForm({ ...candidateForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.email}
                    onChange={e => setCandidateForm({ ...candidateForm, email: e.target.value })}
                  />
                </div>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Contact <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '12px' }}>
                    <select
                      value={selectedCountry.short}
                      style={{ width: '100%', padding: '16px 18px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                      onChange={e => {
                        const nextCountry = getCountryByShortCode(e.target.value);
                        setSelectedCountry(nextCountry);
                        setCandidateForm(prev => ({ ...prev, contact: formatContactValue(nextCountry, candidatePhoneNumber) }));
                      }}
                    >
                      {APP_COUNTRY_CODES.map(country => (
                        <option key={country.short} value={country.short}>
                          {country.short} ({country.code})
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder="Phone number"
                      style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                      value={candidatePhoneNumber}
                      onChange={e => {
                        const nextNumber = e.target.value;
                        setCandidatePhoneNumber(nextNumber);
                        setCandidateForm(prev => ({ ...prev, contact: formatContactValue(selectedCountry, nextNumber) }));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Visa Status <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.visaStatus}
                    onChange={e => setCandidateForm({ ...candidateForm, visaStatus: e.target.value })}
                  >
                    {VISA_STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Relocation <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.relocation}
                    onChange={e => setCandidateForm({ ...candidateForm, relocation: e.target.value })}
                  >
                    {RELOCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Graduation Year <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1950"
                    max="2100"
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.graduationYear}
                    onChange={e => setCandidateForm({ ...candidateForm, graduationYear: e.target.value })}
                  />
                </div>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Employment Type <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.employmentType}
                    onChange={e => setCandidateForm({ ...candidateForm, employmentType: e.target.value })}
                  >
                    {EMPLOYMENT_TYPE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="premium-form-group">
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bill Rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ex: 75"
                    style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box' }}
                    value={candidateForm.billRate}
                    onChange={e => setCandidateForm({ ...candidateForm, billRate: e.target.value })}
                  />
                </div>
              </div>

              <div className="premium-form-group">
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Skill Set <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: '500', background: '#fcfcfd', boxSizing: 'border-box', resize: 'vertical' }}
                  value={candidateForm.skillSet}
                  onChange={e => setCandidateForm({ ...candidateForm, skillSet: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '24px', alignItems: 'stretch' }}>
                {[
                  { id: 'resume-upload', label: 'Resume Portfolio', file: candidateResume, setter: setCandidateResume, required: true, accept: '.pdf,.doc,.docx', helper: 'Supports PDF, DOC, DOCX' },
                  { id: 'passport-upload', label: 'Passport', file: candidatePassport, setter: setCandidatePassport, required: false, accept: '', helper: 'Optional document upload' },
                  { id: 'work-auth-upload', label: 'Work Authorization', file: candidateWorkAuthorization, setter: setCandidateWorkAuthorization, required: false, accept: '', helper: 'Optional document upload' },
                  { id: 'id-proof-upload', label: 'ID Proof', file: candidateIdProof, setter: setCandidateIdProof, required: false, accept: '', helper: 'Optional document upload' }
                ].map(item => (
                  <div key={item.id} className="premium-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {item.label}{item.required && <span style={{ color: '#ef4444' }}> *</span>}
                    </label>
                    <div
                      onClick={() => document.getElementById(item.id).click()}
                      style={{
                        minHeight: '190px',
                        height: '100%',
                        padding: '24px',
                        border: '2px dashed var(--border-color)',
                        borderRadius: '20px',
                        background: item.file ? '#f0f9ff' : '#fcfcfd',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        borderColor: item.file ? '#7dd3fc' : 'var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ width: '48px', height: '48px', background: 'var(--card-bg)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', color: '#6366f1' }}>
                        <FileUp size={22} />
                      </div>
                      <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{item.file ? item.file.name : `Click to upload ${item.label.toLowerCase()}`}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>{item.helper}</p>
                      <input
                        id={item.id}
                        type="file"
                        accept={item.accept}
                        style={{ display: 'none' }}
                        onChange={(e) => item.setter(e.target.files[0] || null)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={candidateSubmitting}
                style={{
                  width: '100%', padding: '18px', background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800',
                  cursor: 'pointer', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.15)', transition: 'all 0.2s',
                  marginTop: '12px'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {candidateSubmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <RefreshCw size={20} className="animate-spin" />
                    Syncing Intelligence...
                  </div>
                ) : 'Register Candidate'}
              </button>
            </form>
          </div>
        </div>

        {/* Modals & Drawers */}
        {showCandidateModal && (
          <div className="modal-overlay" style={{ zIndex: 5000 }} onClick={() => setShowCandidateModal(false)}>
            <div className="modal-content" style={{ width: '95vw', maxWidth: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '32px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div className="section-header" style={{ padding: '32px 40px', borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={24} color="#2563eb" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Candidates Details</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, fontWeight: '500' }}>Viewing {candidatesTotal} matching profiles</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    className="jb-refresh-btn"
                    onClick={() => fetchCandidates(candidateSearch, candidateTier, candidatePage)}
                    title="Refresh Candidates"
                    style={{
                      background: 'var(--border-color)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button className="drawer-close-btn" style={{ background: 'var(--border-color)', borderRadius: '12px', padding: '10px' }} onClick={() => setShowCandidateModal(false)}><X size={20} /></button>
                </div>
              </div>

              {/* Modal Search and Sort Controls */}
              <div style={{ padding: '16px 40px', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div className="jb-search-wrap" style={{ maxWidth: '400px', width: '100%', margin: 0, position: 'relative' }}>
                  <Search size={16} className="jb-search-icon" style={{ left: '16px' }} />
                  <input
                    type="text"
                    className="jb-search-input"
                    placeholder="Search by name, email or skills..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchCandidates(candidateSearch, candidateTier, 1, candidateSort)}
                    style={{ paddingLeft: '44px', height: '44px', borderRadius: '12px', background: 'var(--card-bg)' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort By:</span>
                  <select
                    value={candidateSort}
                    onChange={(e) => {
                      const newSort = e.target.value;
                      setCandidateSort(newSort);
                      fetchCandidates(candidateSearch, candidateTier, 1, newSort);
                    }}
                    className="jb-select"
                    style={{ height: '44px', borderRadius: '12px', padding: '0 16px', minWidth: '160px' }}
                  >
                    <option value="recent">Recent Added</option>
                    <option value="alphabetical">Alphabetical (A-Z)</option>
                  </select>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                <table className="job-table" style={{ width: '100%', borderSpacing: '0 8px', borderCollapse: 'separate' }}>
                  <thead>
                    <tr style={{ background: 'transparent' }}>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identity</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Communication</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Documentation</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(c => (
                      <tr key={c.serial_no} style={{ background: 'var(--card-bg)', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }} className="table-row-premium">
                        <td style={{ padding: '20px', borderRadius: '16px 0 0 16px' }}>
                          <div style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>{c.full_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: '500' }}>{c.unique_id}</div>
                        </td>
                        <td style={{ padding: '20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}><Mail size={12} /> {c.email}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}><Phone size={12} /> {c.contact || c.phone}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}><Globe size={12} /> {c.visa_status || '—'}</div>
                          </div>
                        </td>
                        <td style={{ padding: '20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {(c.resume_url || c.passport_url || c.work_authorization_url || c.id_proof_url) && (
                              <button
                                className="view-resume-btn"
                                onClick={() => setSelectedCandidate(c)}
                                style={{
                                  background: '#eff6ff', color: '#2563eb', border: 'none',
                                  padding: '10px 18px', borderRadius: '12px', fontSize: '12px',
                                  fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px'
                                }}
                              >
                                <FileText size={14} /> View Documents
                              </button>
                            )}
                            {!c.resume_url && !c.passport_url && !c.work_authorization_url && !c.id_proof_url && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Not Available</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '20px', textAlign: 'right', borderRadius: '0 16px 16px 0' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleCandidateEdit(c)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                                background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px',
                                color: '#6366f1', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-color)'; e.currentTarget.style.color = '#ffffff'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.color = 'var(--accent-color)'; }}
                            >
                              <Edit size={14} />
                              Edit Profile
                            </button>
                            <button
                              onClick={() => setDeleteConfirmCandidate(c)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                                background: 'var(--card-bg)', border: '1px solid #fecaca', borderRadius: '12px',
                                color: '#dc2626', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#dc2626'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.borderColor = '#fecaca'; }}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {deleteConfirmCandidate && (
          <div className="modal-overlay" style={{ zIndex: 7000 }} onClick={() => setDeleteConfirmCandidate(null)}>
            <div className="modal-content" style={{ width: '480px', maxWidth: '90vw', padding: 0, borderRadius: '24px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '32px 32px 0', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', background: '#fef2f2', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#dc2626' }}>
                  <Trash2 size={28} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Delete Candidate Profile</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                  Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirmCandidate.full_name}</strong>? This will permanently remove their profile and all associated documents. This action cannot be undone.
                </p>
              </div>
              <div style={{ padding: '24px 32px 32px', display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setDeleteConfirmCandidate(null)}
                  style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#f8fafc', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
                >Cancel</button>
                <button
                  onClick={() => handleDeleteCandidate(deleteConfirmCandidate.unique_id)}
                  disabled={deletingCandidateId === deleteConfirmCandidate.unique_id}
                  style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', border: 'none', fontWeight: '800', fontSize: '14px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(220, 38, 38, 0.2)', transition: 'all 0.2s', opacity: deletingCandidateId === deleteConfirmCandidate.unique_id ? 0.7 : 1 }}
                >{deletingCandidateId === deleteConfirmCandidate.unique_id ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><RefreshCw size={16} className="animate-spin" /> Deleting...</span>
                ) : 'Delete Profile'}</button>
              </div>
            </div>
          </div>
        )}

        {editingCandidate && (
          <div className="modal-overlay" style={{ zIndex: 6000 }}>
            <div className="modal-content" style={{ width: '900px', maxWidth: '95vw', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '28px' }}>
              <div className="section-header" style={{ padding: '28px 32px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit size={20} color="#6366f1" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '-0.02em' }}>Edit Candidate Intelligence</h3>
                </div>
                <button className="drawer-close-btn" style={{ background: '#f8fafc' }} onClick={() => setEditingCandidate(null)}><X size={18} /></button>
              </div>
              <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>
                {editMsg && (
                  <div className={`settings-msg ${editMsg.type}`} style={{
                    marginBottom: '20px', padding: '12px 16px', borderRadius: '10px',
                    fontSize: '13px', fontWeight: '700',
                    background: editMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: editMsg.type === 'success' ? '#16a34a' : '#dc2626',
                    border: `1px solid ${editMsg.type === 'success' ? '#dcfce7' : '#fee2e2'}`
                  }}>
                    {editMsg.text}
                  </div>
                )}
                <form className="premium-form" onSubmit={handleUpdateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>First Name</label>
                      <input type="text" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
                    </div>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Last Name</label>
                      <input type="text" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Email</label>
                      <input type="email" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                    </div>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Contact</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: '10px' }}>
                        <select
                          style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                          value={editSelectedCountry.short}
                          onChange={e => {
                            const nextCountry = getCountryByShortCode(e.target.value);
                            setEditSelectedCountry(nextCountry);
                            setEditForm(prev => ({ ...prev, contact: formatContactValue(nextCountry, editPhoneNumber) }));
                          }}
                        >
                          {APP_COUNTRY_CODES.map(country => (
                            <option key={country.short} value={country.short}>
                              {country.short} ({country.code})
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          inputMode="tel"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                          value={editPhoneNumber}
                          onChange={e => {
                            const nextNumber = e.target.value;
                            setEditPhoneNumber(nextNumber);
                            setEditForm(prev => ({ ...prev, contact: formatContactValue(editSelectedCountry, nextNumber) }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Visa Status</label>
                      <select style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.visaStatus} onChange={e => setEditForm({ ...editForm, visaStatus: e.target.value })}>
                        {VISA_STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Relocation</label>
                      <select style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.relocation} onChange={e => setEditForm({ ...editForm, relocation: e.target.value })}>
                        {RELOCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Employment Type</label>
                      <select style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.employmentType} onChange={e => setEditForm({ ...editForm, employmentType: e.target.value })}>
                        {EMPLOYMENT_TYPE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Graduation Year</label>
                      <input type="number" min="1950" max="2100" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.graduationYear} onChange={e => setEditForm({ ...editForm, graduationYear: e.target.value })} />
                    </div>
                    <div className="premium-form-group">
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Bill Rate</label>
                      <input type="number" min="0" step="0.01" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }} value={editForm.billRate} onChange={e => setEditForm({ ...editForm, billRate: e.target.value })} />
                    </div>
                  </div>
                  <div className="premium-form-group">
                    <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Skill Set</label>
                    <textarea rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', resize: 'vertical' }} value={editForm.skillSet} onChange={e => setEditForm({ ...editForm, skillSet: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', alignItems: 'stretch' }}>
                    {[
                      { id: 'edit-resume-upload', label: 'Resume', file: editResume, setter: setEditResume, accept: '.pdf,.doc,.docx', helper: 'Optional: Keep empty to retain existing' },
                      { id: 'edit-passport-upload', label: 'Passport', file: editPassport, setter: setEditPassport, accept: '', helper: 'Optional document upload' },
                      { id: 'edit-work-auth-upload', label: 'Work Authorization', file: editWorkAuthorization, setter: setEditWorkAuthorization, accept: '', helper: 'Optional document upload' },
                      { id: 'edit-id-proof-upload', label: 'ID Proof', file: editIdProof, setter: setEditIdProof, accept: '', helper: 'Optional document upload' }
                    ].map(item => (
                      <div key={item.id} className="premium-form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>{item.label}</label>
                        <div
                          onClick={() => document.getElementById(item.id).click()}
                          style={{
                            minHeight: '168px',
                            height: '100%',
                            padding: '20px',
                            border: '2px dashed',
                            borderColor: item.file ? '#7dd3fc' : 'var(--border-color)',
                            borderRadius: '16px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: item.file ? '#f0f9ff' : '#fcfcfd',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <div style={{ width: '42px', height: '42px', background: 'var(--card-bg)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', color: '#6366f1' }}>
                            <FileUp size={20} />
                          </div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.file ? item.file.name : `Upload ${item.label.toLowerCase()}`}</p>
                          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>{item.helper}</p>
                          <input id={item.id} type="file" accept={item.accept} style={{ display: 'none' }} onChange={e => item.setter(e.target.files[0] || null)} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <button type="submit" className="btn-premium" style={{ flex: 2, padding: '16px', borderRadius: '14px', border: 'none', background: '#0f172a', color: 'white', fontWeight: '800', cursor: 'pointer' }}>Commit Updates</button>
                    <button type="button" className="modal-btn-danger" style={{ flex: 1, padding: '16px', borderRadius: '14px', background: '#f8fafc', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => setEditingCandidate(null)}>Ignore</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSettings = () => {
    const s = scrapeSettings || {};
    const update = (key, value) => {
      setScrapeSettings(prev => ({ ...(prev || {}), [key]: value }));
    };
    return (
      <div className="dashboard-content" style={{ maxWidth: '100%', margin: '0 40px' }}>
        <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {settingsSubTab !== 'menu' ? (
              <button
                onClick={() => {
                  if (hasUnsavedChanges()) {
                    setPendingTab('settings-menu'); // Special target
                    setShowUnsavedModal(true);
                  } else {
                    setSettingsSubTab('menu');
                  }
                }}
                style={{ width: '48px', height: '48px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', outline: 'none' }}
                title="Back to Settings Menu"
              >
                <ArrowLeft size={24} />
              </button>
            ) : (
              <div style={{ width: '48px', height: '48px', background: 'var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <Settings size={24} />
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>Application Settings</h2>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {settingsSubTab === 'menu' && 'Manage your application preferences'}
                {settingsSubTab === 'scraper' && 'Scraper Parameters'}
                {settingsSubTab === 'scheduler' && 'Automation Schedule'}
                {settingsSubTab === 'interface' && 'System Preferences'}
                {settingsSubTab === 'database' && 'Database Manager'}
              </span>
            </div>
          </div>

          <div className="settings-header-actions">
            {hasUnsavedChanges() && !settingsSaving && (
              <div className="unsaved-warning" style={{ marginRight: '16px' }}>
                <AlertCircle size={14} />
                Unsaved Changes
              </div>
            )}
            <button
              className={`settings-save-btn ${hasUnsavedChanges() ? 'pulse-btn' : ''}`}
              onClick={saveSettings}
              disabled={!hasUnsavedChanges() || settingsSaving}
            >
              <Save size={15} />
              {settingsSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="settings-grid">
          {settingsSubTab === 'menu' && (
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div
                className="settings-card"
                style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
                onClick={() => setSettingsSubTab('scraper')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(67, 137, 200, 0.1)', color: '#4389c8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Scraper Parameters</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Configure behavior, workers, limits</p>
                  </div>
                </div>
              </div>

              <div
                className="settings-card"
                style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
                onClick={() => setSettingsSubTab('scheduler')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'hsl(210,95%,92%)', color: 'hsl(210,90%,40%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Automation Schedule</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Daily scrape timers and triggers</p>
                  </div>
                </div>
              </div>

              <div
                className="settings-card"
                style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
                onClick={() => setSettingsSubTab('interface')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sliders size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>System Preferences</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Themes, regions, and interface behavior</p>
                  </div>
                </div>
              </div>

              <div
                className="settings-card"
                style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
                onClick={() => setSettingsSubTab('database')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'hsl(160,70%,94%)', color: 'hsl(160,60%,35%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Database Manager</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>View tables and wipe cached resources</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {settingsSubTab === 'scraper' && (
            <>
              {/* Scraper Vitals & Analytics */}
              <div className="settings-card full-width vitals-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: 'rgba(67, 137, 200, 0.1)', color: '#4389c8' }}>
                    <Activity size={18} className={status.status === 'running' ? 'animate-pulse' : ''} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="settings-card-title">Scraper Vitals & Analytics</div>
                      <div className="settings-card-desc">
                        {status.status === 'running' ? `Agents are currently: ${status.current_task}` : 'System is idle. Diagnostic data from last session available.'}
                      </div>
                    </div>
                    <div className="scheduler-health-badge" style={{ background: stats?.scheduler_next_run === 'Disabled' ? 'var(--border-color)' : '#f0fdf4', color: stats?.scheduler_next_run === 'Disabled' ? 'var(--text-secondary)' : '#15803d' }}>
                      <Clock size={12} />
                      <span>Next Run: {stats?.scheduler_next_run}</span>
                    </div>
                  </div>
                </div>

                {status.status === 'running' && (
                  <div className="scraper-progress-container" style={{ margin: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span>Progress</span>
                      <span>{status.progress}%</span>
                    </div>
                    <div className="progress-bar-bg" style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div className="progress-bar-fill" style={{
                        width: `${status.progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #4389c8, #3b82f6)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {status.current_task}
                    </div>
                  </div>
                )}

                <div className="vitals-dashboard">
                  <div className="vitals-grid">
                    {/* Performance Highlights */}
                    <div className="vitals-tile">
                      <div className="vitals-tile-lbl">Recently Scraped Active</div>
                      <div className="vitals-tile-val" style={{ color: '#10b981' }}>{status.last_active_count || 0}</div>
                    </div>
                    <div className="vitals-tile">
                      <div className="vitals-tile-lbl">Recently Scraped Inactive</div>
                      <div className="vitals-tile-val" style={{ color: '#4389c8' }}>{status.last_inactive_count || 0}</div>
                    </div>
                    <div className="vitals-tile lifetime">
                      <div className="vitals-tile-lbl">Total Jobs Active</div>
                      <div className="vitals-tile-val">{stats?.total_active || 0}</div>
                    </div>
                    <div className="vitals-tile lifetime">
                      <div className="vitals-tile-lbl">Total Jobs Inactive</div>
                      <div className="vitals-tile-val">{stats?.total_inactive || 0}</div>
                    </div>
                  </div>

                  <div className="vitals-footer-stats">
                    <span>Heartbeat: Optimal</span>
                    <span>•</span>
                    <span>Next Run: {stats?.scheduler_next_run || 'Unknown'}</span>
                    <span>•</span>
                    <span>Last Run: {status.last_run_at ? new Date(status.last_run_at * 1000).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Date Range Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: 'hsl(250,80%,95%)', color: 'hsl(250,70%,50%)' }}>
                    <Clock size={18} />
                  </div>
                  <div>
                    <div className="settings-card-title">Date Range</div>
                    <div className="settings-card-desc">How far back to look for new job postings</div>
                  </div>
                </div>
                <div className="settings-date-options">
                  {DATE_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`settings-date-option ${s.date_range === opt.value ? 'selected' : ''}`}
                      onClick={() => {
                        update('date_range', opt.value);
                        // Auto-suggest pages on selection
                        update('max_search_pages', suggestedPages[opt.value]);
                      }}
                    >
                      <div className="settings-date-radio">
                        <div className="settings-date-dot" />
                      </div>
                      <div>
                        <div className="settings-date-label">{opt.label}</div>
                        <div className="settings-date-hint">{opt.desc}</div>
                      </div>
                      {s.date_range === opt.value && (
                        <span className="settings-active-badge">Active</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Pagination Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: 'hsl(170,70%,94%)', color: 'hsl(170,60%,35%)' }}>
                    <Sliders size={18} />
                  </div>
                  <div>
                    <div className="settings-card-title">Max Search Pages</div>
                    <div className="settings-card-desc">Maximum pages to paginate per vendor URL (auto-adjusted by date range)</div>
                  </div>
                </div>
                <div className="settings-slider-row">
                  <input
                    type="range"
                    min={1} max={200} step={1}
                    value={s.max_search_pages}
                    onChange={e => update('max_search_pages', Number(e.target.value))}
                    className="settings-slider"
                  />
                  <span className="settings-slider-val">{s.max_search_pages}</span>
                </div>
                <div className="settings-hint-row">
                  <span>Suggested for <strong>{DATE_OPTIONS.find(o => o.value === s.date_range)?.label}</strong>: {suggestedPages[s.date_range]} pages</span>
                  <button
                    className="settings-suggest-btn"
                    onClick={() => update('max_search_pages', suggestedPages[s.date_range])}
                  >
                    <RotateCcw size={12} /> Use suggested
                  </button>
                </div>
              </div>

              {/* Performance Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: 'hsl(30,90%,94%)', color: 'hsl(30,75%,45%)' }}>
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div className="settings-card-title">Performance</div>
                    <div className="settings-card-desc">Thread count and network timeouts</div>
                  </div>
                </div>
                <div className="settings-fields">
                  <div className="performance-warning-toggle" style={{ marginBottom: '20px', padding: '12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning-text)' }}>
                        <AlertCircle size={16} />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>System Resource Warning</span>
                      </div>
                      <label className="switch" style={{ transform: 'scale(0.8)' }}>
                        <input
                          type="checkbox"
                          checked={showPerfWarning}
                          onChange={e => setShowPerfWarning(e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {showPerfWarning && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--warning-text)', lineHeight: '1.5', animation: 'fadeIn 0.2s ease' }}>
                        <strong>Warning:</strong> Adjusting performance parameters can significantly increase CPU and memory utilization. Multi-threaded scraping may lead to system instability or network IP throttling if configured incorrectly.
                      </p>
                    )}
                  </div>
                  <div className={clsx('settings-field', !showPerfWarning && 'disabled-field')} style={{ opacity: showPerfWarning ? 1 : 0.6, pointerEvents: showPerfWarning ? 'auto' : 'none', transition: 'all 0.2s' }}>
                    <label>Max Parallel Workers</label>
                    <div className="settings-number-wrap">
                      <input
                        type="number" min={1} max={10}
                        value={s.max_workers}
                        onChange={e => update('max_workers', Number(e.target.value))}
                        className="settings-number"
                        disabled={!showPerfWarning}
                      />
                      <span className="settings-unit">threads</span>
                    </div>
                    <p className="settings-field-hint">Higher = faster but may trigger rate limits. Recommended: 3</p>
                  </div>
                  <div className={clsx('settings-field', !showPerfWarning && 'disabled-field')} style={{ opacity: showPerfWarning ? 1 : 0.6, pointerEvents: showPerfWarning ? 'auto' : 'none', transition: 'all 0.2s' }}>
                    <label>Request Timeout</label>
                    <div className="settings-number-wrap">
                      <input
                        type="number" min={5} max={120}
                        value={s.request_timeout}
                        onChange={e => update('request_timeout', Number(e.target.value))}
                        className="settings-number"
                        disabled={!showPerfWarning}
                      />
                      <span className="settings-unit">seconds</span>
                    </div>
                    <p className="settings-field-hint">Per-request timeout. Default: 30s</p>
                  </div>
                  <div className={clsx('settings-field', !showPerfWarning && 'disabled-field')} style={{ opacity: showPerfWarning ? 1 : 0.6, pointerEvents: showPerfWarning ? 'auto' : 'none', transition: 'all 0.2s' }}>
                    <label>Scrape Cooldown</label>
                    <div className="settings-number-wrap">
                      <input
                        type="number" min={60} max={3600}
                        value={s.scrape_cooldown}
                        onChange={e => update('scrape_cooldown', Number(e.target.value))}
                        className="settings-number"
                        disabled={!showPerfWarning}
                      />
                      <span className="settings-unit">seconds</span>
                    </div>
                    <p className="settings-field-hint">Minimum time between manual triggers. Default: 300s</p>
                  </div>
                </div>
              </div>

              {/* Clear Scraped Data Card */}
              <div className="settings-card" style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)' }}>
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: 'var(--danger-border)', color: 'white' }}>
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <div className="settings-card-title">Clear Scraped Data</div>
                    <div className="settings-card-desc">Permanently delete job data from selected tables</div>
                  </div>
                </div>

                <div className="data-deletion-warning-toggle" style={{ marginBottom: '20px', padding: '12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger-text)' }}>
                      <AlertCircle size={16} />
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>Irreversible Action Warning</span>
                    </div>
                    <label className="switch" style={{ transform: 'scale(0.8)' }}>
                      <input
                        type="checkbox"
                        checked={showClearWarning}
                        onChange={e => setShowClearWarning(e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                  {showClearWarning && (
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--danger-text)', lineHeight: '1.5', animation: 'fadeIn 0.2s ease' }}>
                      <strong>Warning:</strong> Data deletion is permanent. Export necessary data before proceeding. This will purge all records from the selected tables in the PostgreSQL database.
                    </p>
                  )}
                </div>

                <div style={{ opacity: showClearWarning ? 1 : 0.5, pointerEvents: showClearWarning ? 'auto' : 'none', transition: 'all 0.2s' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scraped Data Tables</p>
                    <div className="settings-checkbox-group">
                      <label className="settings-checkbox-label">
                        <input
                          type="checkbox"
                          checked={clearSheets.active_scraped}
                          onChange={e => setClearSheets(prev => ({ ...prev, active_scraped: e.target.checked }))}
                          className="settings-checkbox"
                          disabled={!showClearWarning}
                        />
                        <span className="settings-checkbox-custom" />
                        Active Scraped
                      </label>
                      <label className="settings-checkbox-label">
                        <input
                          type="checkbox"
                          checked={clearSheets.inactive_scraped}
                          onChange={e => setClearSheets(prev => ({ ...prev, inactive_scraped: e.target.checked }))}
                          className="settings-checkbox"
                          disabled={!showClearWarning}
                        />
                        <span className="settings-checkbox-custom" />
                        Inactive Scraped
                      </label>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discovered Jobs Tables</p>
                    <div className="settings-checkbox-group">
                      <label className="settings-checkbox-label">
                        <input
                          type="checkbox"
                          checked={clearSheets.active_dice}
                          onChange={e => setClearSheets(prev => ({ ...prev, active_dice: e.target.checked }))}
                          className="settings-checkbox"
                          disabled={!showClearWarning}
                        />
                        <span className="settings-checkbox-custom" />
                        Active Dice Jobs
                      </label>
                      <label className="settings-checkbox-label">
                        <input
                          type="checkbox"
                          checked={clearSheets.inactive_dice}
                          onChange={e => setClearSheets(prev => ({ ...prev, inactive_dice: e.target.checked }))}
                          className="settings-checkbox"
                          disabled={!showClearWarning}
                        />
                        <span className="settings-checkbox-custom" />
                        Inactive Dice Jobs
                      </label>
                    </div>
                  </div>
                  {clearMsg && (
                    <div className={`settings-msg ${clearMsg.type}`} style={{ marginBottom: '12px' }}>{clearMsg.text}</div>
                  )}
                  <button
                    className="settings-danger-btn"
                    onClick={clearData}
                    disabled={clearingData || (!clearSheets.active_scraped && !clearSheets.inactive_scraped && !clearSheets.active_dice && !clearSheets.inactive_dice) || !showClearWarning}
                  >
                    <Trash2 size={14} />
                    {clearingData ? 'Clearing...' : 'Clear Selected'}
                  </button>
                </div>
              </div>
            </>
          )}

          {showClearConfirm && (
            <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <Trash2 size={20} />
                  <h3>Confirm Delete</h3>
                </div>
                <p className="modal-body">
                  This will permanently delete all job data from the selected sheet(s). This action cannot be undone.
                </p>
                <div className="modal-actions">
                  <button className="modal-btn-cancel" onClick={() => setShowClearConfirm(false)}>
                    Cancel
                  </button>
                  <button className="modal-btn-confirm" onClick={confirmClearData}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {settingsSubTab === 'scheduler' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Scraper Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: 'hsl(210,95%,92%)', color: 'hsl(210,90%,40%)' }}>
                    <Zap size={18} />
                  </div>
                  <div>
                    <div className="settings-card-title">Daily Scraper</div>
                    <div className="settings-card-desc">Automatically trigger a full job search</div>
                  </div>
                </div>
                <div className="settings-fields" style={{ marginTop: '16px' }}>
                  <div className={clsx('settings-field', !s.schedule_enabled && 'disabled-field')}>
                    <label>Run Time</label>
                    <div className="settings-input-group">
                      <div
                        className="settings-time-display"
                        onClick={() => s.schedule_enabled && setShowTimePicker('schedule_time')}
                        style={{ cursor: s.schedule_enabled ? 'pointer' : 'not-allowed' }}
                      >
                        <Clock size={24} color={s.schedule_enabled ? "var(--accent-color)" : "var(--text-secondary)"} />
                        <span className="time-val-big">{s.schedule_time || '08:30'}</span>
                        <span className="time-val-unit">24H Format</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Next: <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {status?.scraper?.next_run ? new Date(status.scraper.next_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                    <button 
                      className="settings-action-btn"
                      onClick={() => {
                        axios.post(`${API_BASE_URL}/trigger/scraper`, {}, { headers: { 'X-API-Key': API_KEY } })
                          .then(() => {
                            showToast('Scraper triggered!', 'success');
                            setTimeout(fetchStatus, 500);
                          });
                      }}
                      style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: 'none', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Run Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Cleaner Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: 'hsl(25,95%,92%)', color: 'hsl(25,90%,40%)' }}>
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <div className="settings-card-title">Job Cleaner</div>
                    <div className="settings-card-desc">Remove expired/dead jobs from database</div>
                  </div>
                </div>
                <div className="settings-fields" style={{ marginTop: '16px' }}>
                  <div className={clsx('settings-field', !s.schedule_enabled && 'disabled-field')}>
                    <label>Run Time</label>
                    <div className="settings-input-group">
                      <div
                        className="settings-time-display"
                        onClick={() => s.schedule_enabled && setShowTimePicker('cleaner_schedule_time')}
                        style={{ cursor: s.schedule_enabled ? 'pointer' : 'not-allowed' }}
                      >
                        <Clock size={24} color={s.schedule_enabled ? "#f97316" : "var(--text-secondary)"} />
                        <span className="time-val-big">{s.cleaner_schedule_time || '08:00'}</span>
                        <span className="time-val-unit">24H Format</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Next: <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {status?.cleaner?.next_run ? new Date(status.cleaner.next_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                    <button 
                      className="settings-action-btn"
                      onClick={() => {
                        axios.post(`${API_BASE_URL}/trigger/cleaner`, {}, { headers: { 'X-API-Key': API_KEY } })
                          .then(() => {
                            showToast('Cleaner triggered!', 'success');
                            setTimeout(fetchStatus, 500);
                          });
                      }}
                      style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', border: 'none', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Run Now
                    </button>
                  </div>

                  {status?.cleaner_progress?.status === 'running' && (
                    <div style={{ marginTop: '20px', padding: '14px', background: '#fffcf9', borderRadius: '14px', border: '1px solid #fed7aa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', fontWeight: '700' }}>
                        <span style={{ color: '#ea580c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }}></span>
                          Cleaning...
                        </span>
                        <span style={{ color: '#ea580c' }}>{status.cleaner_progress.percent}%</span>
                      </div>
                      <div style={{ height: '8px', background: '#ffedd5', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          background: 'linear-gradient(90deg, #f97316, #fb923c)', 
                          width: `${status.cleaner_progress.percent}%`,
                          transition: 'width 0.4s ease-out'
                        }} />
                      </div>
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        <div style={{ textAlign: 'center', borderRight: '1px solid #ffedd5' }}>
                          <div style={{ fontSize: '10px', color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Checked</div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#431407' }}>{status.cleaner_progress.current}</div>
                        </div>
                        <div style={{ textAlign: 'center', borderRight: '1px solid #ffedd5' }}>
                          <div style={{ fontSize: '10px', color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deleted</div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>{status.cleaner_progress.deleted}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dead</div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#f97316' }}>{status.cleaner_progress.dead}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-card full-width" style={{ gridColumn: 'span 2' }}>
                <div className="settings-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Global Automation Switch</label>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Master toggle to enable or disable all background tasks</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={s.schedule_enabled}
                      onChange={e => update('schedule_enabled', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}





          {settingsSubTab === 'interface' && (
            <>
              <div className="settings-card full-width">
                <div className="settings-card-header">
                  <div className="settings-card-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                    <Sliders size={18} />
                  </div>
                  <div>
                    <div className="settings-card-title">Theme Options</div>
                    <div className="settings-card-desc">Personalize the dashboard appearance</div>
                  </div>
                </div>
                <div className="settings-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="settings-field">
                    <label>App Mode</label>
                    <div className="theme-selector-grid" style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button
                        className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => setTheme('light')}
                        style={{ flex: 1, padding: '12px', borderRadius: '10px', border: theme === 'light' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)', background: 'var(--card-bg)', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Light Mode</div>
                      </button>
                      <button
                        className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => setTheme('dark')}
                        style={{ flex: 1, padding: '12px', borderRadius: '10px', border: theme === 'dark' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)', background: '#111', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>Dark Mode</div>
                      </button>
                    </div>
                  </div>
                  <div className="settings-field">
                    <label>Accent Color</label>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                      {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map(color => (
                        <div
                          key={color}
                          onClick={() => setAccentColor(color)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: color,
                            cursor: 'pointer',
                            border: accentColor === color ? '2px solid white' : 'none',
                            boxShadow: accentColor === color ? `0 0 0 2px ${color}` : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', alignItems: 'flex-start' }}>
                <div className="settings-card" style={{ width: '420px', flexShrink: 0 }}>
                  <div className="settings-card-header">
                    <div className="settings-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                      <Globe size={18} />
                    </div>
                    <div>
                      <div className="settings-card-title">Regional Settings</div>
                      <div className="settings-card-desc">Time zone and language preferences</div>
                    </div>
                  </div>
                  <div className="settings-fields" style={{ display: 'grid', gap: '20px' }}>
                    <div className="settings-field">
                      <label>System Time Zone</label>
                      <select value={timezone} onChange={e => setTimezone(e.target.value)} className="jb-select" style={{ width: '100%', marginTop: '8px' }}>
                        {['UTC-5 (EST)', 'UTC-8 (PST)', 'UTC+0 (GMT)', 'UTC+5:30 (IST)'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                    <div className="settings-field">
                      <label>Date Format</label>
                      <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className="jb-select" style={{ width: '100%', marginTop: '8px' }}>
                        {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map(df => <option key={df} value={df}>{df}</option>)}
                      </select>
                    </div>
                    <div className="settings-field">
                      <label>Application Language</label>
                      <select value={language} onChange={e => setLanguage(e.target.value)} className="jb-select" style={{ width: '100%', marginTop: '8px' }}>
                        {['English (US)', 'English (UK)', 'Spanish', 'French'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '32px', width: '680px', flexShrink: 0 }}>
                  <div className="settings-card" style={{ width: '56.2%' }}>
                    <div className="settings-card-header">
                      <div className="settings-card-icon" style={{ background: 'hsl(210,95%,92%)', color: 'hsl(210,90%,40%)' }}>
                        <LayoutDashboard size={18} />
                      </div>
                      <div>
                        <div className="settings-card-title">Sidebar Configuration</div>
                        <div className="settings-card-desc">Control menu behavior</div>
                      </div>
                    </div>
                    <div className="settings-fields" style={{ marginTop: '16px' }}>
                      <div className="settings-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ margin: 0 }}>Auto-collapse Sidebar</label>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={autoCollapse}
                            onChange={e => setAutoCollapse(e.target.checked)}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="settings-card" style={{ width: '56.2%' }}>
                    <div className="settings-card-header">
                      <div className="settings-card-icon" style={{ background: 'hsl(140,80%,95%)', color: 'hsl(140,70%,35%)' }}>
                        <Activity size={18} />
                      </div>
                      <div>
                        <div className="settings-card-title">Live Notifications</div>
                        <div className="settings-card-desc">Desktop alert settings</div>
                      </div>
                    </div>
                    <div className="settings-fields" style={{ marginTop: '16px' }}>
                      <div className="settings-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ margin: 0 }}>Browser Notifications</label>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={notificationsEnabled}
                            onChange={e => handleNotificationToggle(e.target.checked)}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {settingsSubTab === 'database' && (
            <div className="db-manager">
              {dbMsg && (
                <div className={`settings-msg ${dbMsg.type}`} style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px' }}>
                  {dbMsg.text}
                </div>
              )}

              {!selectedTable ? (
                <>
                  <div className="settings-card full-width">
                    <div className="settings-card-header">
                      <div className="settings-card-icon" style={{ background: 'hsl(160,70%,94%)', color: 'hsl(160,60%,35%)' }}>
                        <Layers size={18} />
                      </div>
                      <div>
                        <div className="settings-card-title">Database Tables</div>
                        <div className="settings-card-desc">View all tables in the PostgreSQL database</div>
                      </div>
                    </div>
                    <div className="db-tables-grid">
                      {dbLoading ? (
                        /* Skeleton Cards while loading tables */
                        [1, 2, 3, 4, 5, 6].map(i => (
                          <div key={i} className="db-table-card skeleton-card">
                            <div className="db-table-header" style={{ marginBottom: '16px' }}>
                              <div className="skeleton-line short" />
                            </div>
                            <div className="skeleton-line medium" style={{ marginBottom: '12px' }} />
                            <div className="skeleton-line full" style={{ marginBottom: '24px' }} />
                            <div className="db-table-count" style={{ borderTop: 'none' }}>
                              <div className="skeleton-line short" style={{ height: '32px' }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        dbTables.map(table => (
                          <div
                            key={table.name}
                            className="db-table-card"
                            onClick={() => { setSelectedTable(table.name); fetchTableData(table.name, 1); }}
                          >
                            <div className="db-table-header">
                              <span className="db-table-type" style={{
                                background: table.type === 'input' ? '#dbeafe' : table.type === 'discovery' ? '#fef3c7' : '#d1fae5',
                                color: table.type === 'input' ? '#1d4ed8' : table.type === 'discovery' ? '#b45309' : '#065f46'
                              }}>{table.type}</span>
                              <button
                                className="db-table-delete-btn"
                                onClick={(e) => { e.stopPropagation(); deleteTableData(table.name); }}
                                title="Clear table data"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <h4 className="db-table-name">{table.name}</h4>
                            <p className="db-table-desc">{table.description}</p>
                            <div className="db-table-count">
                              <span className="db-count-number">{dbTableCounts[table.name] || 0}</span>
                              <span className="db-count-label">rows</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="settings-card full-width">
                    <div className="settings-card-header" style={{ justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          className="settings-back-btn"
                          onClick={() => { setSelectedTable(null); setTableData({ records: [], columns: [], total: 0 }); setTableInfo(null); }}
                          style={{ padding: '8px 16px' }}
                        >
                          <ArrowLeft size={14} />
                          Back
                        </button>
                        <div>
                          <div className="settings-card-title">{selectedTable}</div>
                          <div className="settings-card-desc">{tableData.total} records · {tableInfo?.columns?.length || 0} columns</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="settings-copy-btn"
                          onClick={() => {
                            const cols = tableInfo?.columns?.map(c => c.name).join(', ');
                            navigator.clipboard.writeText(cols);
                            setDbMsg({ type: 'success', text: '✓ Column names copied!' });
                            setTimeout(() => setDbMsg(null), 2000);
                          }}
                        >
                          <Copy size={14} />
                          Copy Columns
                        </button>
                        <button
                          className="settings-danger-btn"
                          onClick={() => deleteTableData(selectedTable)}
                        >
                          <Trash2 size={14} />
                          Clear Table
                        </button>
                      </div>
                    </div>

                    {tableInfo && (
                      <div className="db-table-info-section">
                        <div className="db-table-info-row">
                          <div className="db-info-item">
                            <span className="db-info-label">Schema</span>
                            <span className="db-info-value">{tableInfo.schema}</span>
                          </div>
                          <div className="db-info-item">
                            <span className="db-info-label">Total Rows</span>
                            <span className="db-info-value">{tableInfo.row_count}</span>
                          </div>
                          <div className="db-info-item">
                            <span className="db-info-label">Columns</span>
                            <span className="db-info-value">{tableInfo.columns?.length || 0}</span>
                          </div>
                        </div>
                        <div className="db-columns-grid">
                          <div className="db-columns-header">
                            <span>Column Name</span>
                            <span>Type</span>
                            <span>Nullable</span>
                            <span>Key</span>
                          </div>
                          {tableInfo.columns?.map((col, idx) => (
                            <div key={idx} className="db-column-row">
                              <span className="db-col-name">
                                {col.name}
                                {col.primary_key && <span className="db-pk-badge">PK</span>}
                              </span>
                              <span className="db-col-type">
                                {col.type.replace('TEXT', 'text').replace('VARCHAR', 'varchar').replace('INTEGER', 'int').replace('BOOLEAN', 'bool').replace('TIMESTAMP', 'timestamp').replace('DATETIME', 'datetime').replace('DATE', 'date').toLowerCase()}
                              </span>
                              <span className={col.nullable ? 'db-col-nullable' : 'db-col-not-null'}>
                                {col.nullable ? 'YES' : 'NO'}
                              </span>
                              <span>
                                {col.primary_key ? <span className="db-key-pk">PRIMARY KEY</span> : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dbLoading ? (
                      <div className="db-loading-state">
                        <div className="db-skeleton-table">
                          <div className="db-skeleton-row" style={{ background: '#f8fafc' }}>
                            {[1, 2, 3, 4, 5].map(v => <div key={v} className="db-skeleton-cell skeleton-line" style={{ width: '15%' }}></div>)}
                          </div>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(row => (
                            <div key={row} className="db-skeleton-row">
                              {[1, 2, 3, 4, 5].map(col => <div key={col} className="db-skeleton-cell skeleton-line" style={{ width: '15%' }}></div>)}
                            </div>
                          ))}
                        </div>
                        <div className="db-loading-overlay">
                          <div className="jb-loading animate-spin" style={{ width: '40px', height: '40px', border: '3px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '16px' }}></div>
                          <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '18px' }}>Syncing Database Records...</p>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Please wait while we fetch the latest results.</p>
                        </div>
                      </div>
                    ) : tableData.records.length === 0 ? (
                      <div className="empty-state" style={{ padding: '60px', opacity: 0.6 }}>
                        <Database size={48} style={{ marginBottom: '16px', color: '#cbd5e1' }} />
                        <p>No records found in this table.</p>
                      </div>
                    ) : (
                      <>
                        <div className="db-table-scroll">
                          <table className="job-table">
                            <thead>
                              <tr>
                                {tableData.columns.map(col => (
                                  <th key={col}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.records.map((record, idx) => (
                                <tr key={idx}>
                                  {tableData.columns.map(col => (
                                    <td key={col}>
                                      {record[col] !== null && record[col] !== undefined ? (
                                        <span className="jt-clamp" style={{ maxWidth: '200px', display: 'inline-block' }}>
                                          {String(record[col]).length > 100
                                            ? String(record[col]).substring(0, 100) + '...'
                                            : String(record[col])}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="pagination-bar">
                          <button
                            className="pagination-btn"
                            onClick={() => fetchTableData(selectedTable, Math.max(1, dbTablePage - 1))}
                            disabled={dbTablePage === 1}
                          >
                            ← Prev
                          </button>
                          <span className="pagination-count">
                            Page {dbTablePage} of {Math.max(1, Math.ceil(tableData.total / 20))}
                          </span>
                          <button
                            className="pagination-btn"
                            onClick={() => fetchTableData(selectedTable, dbTablePage + 1)}
                            disabled={dbTablePage >= Math.ceil(tableData.total / 20)}
                          >
                            Next →
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfirmModal = (isOpen, title, message, onConfirm, onCancel, type = 'danger') => {
    if (!isOpen) return null;
    const isDanger = type === 'danger';

    return (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="premium-modal glass-morphism" style={{
          maxWidth: '400px', width: '100%', padding: '32px',
          textAlign: 'center', background: 'var(--card-bg)'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '22px',
              background: isDanger ? 'var(--danger-bg)' : 'var(--blue-light)',
              color: isDanger ? '#ef4444' : 'var(--blue-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              {isDanger ? <AlertTriangle size={32} /> : <HelpCircle size={32} />}
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>{title}</h3>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{message}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <button className="modal-btn-secondary" onClick={onCancel} style={{ padding: '14px', borderRadius: '12px' }}>Cancel</button>
            <button
              className={isDanger ? "modal-btn-danger" : "btn-premium"}
              onClick={onConfirm}
              style={{ padding: '14px', borderRadius: '12px' }}
            >
              {isDanger ? "Confirm" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderToast = () => {
    if (!toast) return null;
    const isError = toast.type === 'error';
    const isSuccess = toast.type === 'success';

    return (
      <div className="toast-container">
        <div className={`toast-content ${toast.type}`}>
          <div className="toast-icon-wrap" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: isSuccess ? 'rgba(16, 185, 129, 0.1)' : isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)'
          }}>
            {isSuccess && <CheckCircle size={20} style={{ color: '#10b981' }} />}
            {isError && <AlertCircle size={20} style={{ color: '#ef4444' }} />}
            {!isSuccess && !isError && <Info size={20} style={{ color: 'var(--blue-primary)' }} />}
          </div>
          <span style={{ letterSpacing: '-0.01em' }}>{toast.message}</span>
        </div>
      </div>
    );
  };

  if (!isBackendConnected) {
    return (
      <div className="layout-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--primary-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="jb-loading animate-spin" style={{ marginBottom: '20px', width: '40px', height: '40px', border: '3px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}></div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>TABNER HR OPERATIONS</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Connecting to intelligence engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      <header className="top-navbar">
        <div className="nav-left">
          <img
            src="https://tabnerglobal.com/images/logo8.png"
            alt="Tabner Logo"
            className="nav-logo"
          />
          <h1 className="nav-title">HR Operations</h1>
        </div>

        <div className="nav-right">
          <div className="user-profile">
            <div className="user-avatar">
              {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'HR'}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name || 'HR Admin'}</span>
              <span className="user-email">{user.email || 'admin@tabner.com'}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="app-container">

        {/* ── Open-tab arrow — shown when sidebar is closed ── */}
        {!sidebarOpen && (
          <button
            className="sidebar-open-tab"
            onClick={() => setSidebarOpen(true)}
            title="Open menu"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Sidebar */}
        <aside
          className={clsx("sidebar", !sidebarOpen && "collapsed")}
          style={{ width: sidebarOpen ? '20vw' : '84px', minWidth: sidebarOpen ? 180 : 84 }}
        >
          <div className="sidebar-header">
            {/* Logo space removed as it's now in the TopNavbar */}
          </div>

          {/* Middle Close Tab (when open) */}
          {sidebarOpen && (
            <button
              className="sidebar-close-tab"
              onClick={() => setSidebarOpen(false)}
              title="Close menu"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <nav className="nav-section">
            <p className="nav-label">Workspace</p>
            <div
              className={clsx('nav-item', activeTab === 'candidate-matching' && 'active')}
              onClick={() => handleTabChange('candidate-matching')}
            >
              <LayoutDashboard size={18} />
              <div className="nav-item-text">
                <h4>Talent Matching</h4>
                <p>AI-powered candidate matching</p>
              </div>
            </div>
            <div
              className={clsx('nav-item', activeTab === 'job-board' && 'active')}
              onClick={() => handleTabChange('job-board')}
            >
              <Briefcase size={18} />
              <div className="nav-item-text">
                <h4>Job Board</h4>
                <p>Live job data from all sources</p>
              </div>
            </div>
            <div
              className={clsx('nav-item', activeTab === 'resume-review' && 'active')}
              onClick={() => handleTabChange('resume-review')}
            >
              <FileText size={18} />
              <div className="nav-item-text">
                <h4>Resume Processing</h4>
                <p>Formatting &amp; optimization</p>
              </div>
            </div>
            <div
              className={clsx('nav-item', activeTab === 'new-candidate' && 'active')}
              onClick={() => handleTabChange('new-candidate')}
            >
              <UserPlus size={18} />
              <div className="nav-item-text">
                <h4>Candidate Hub</h4>
                <p>Register new profiles</p>
              </div>
            </div>
          </nav>

          <div className="sidebar-footer">
            {/* Scraper status moved to Job Board page header */}
          </div>

          <button
            className={clsx('sidebar-settings-btn', activeTab === 'settings' && 'active')}
            onClick={() => {
              if (activeTab === 'settings') {
                handleTabChange(prevTab);
              } else {
                handleTabChange('settings');
              }
            }}
            title="Application Settings"
          >
            <Settings size={18} />
            <span>Preferences</span>
          </button>

          {/* End sidebar */}
        </aside>

        {/* Main Content — left margin tracks sidebar width */}
        <main
          className="main-content"
          style={{ marginLeft: sidebarOpen ? '20vw' : '84px' }}
        >
          <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div>
              <h2>
                {activeTab === 'candidate-matching' && 'Talent Matching Dashboard'}
                {activeTab === 'job-board' && 'Job Board'}
                {activeTab === 'resume-review' && 'Resume Processing'}
                {activeTab === 'settings' && 'Settings'}
              </h2>
              <p>
                {activeTab === 'candidate-matching' && 'Analyze matches, optimize resumes, and streamline submissions.'}
                {activeTab === 'job-board' && 'Real-time job data from multiple sources'}
                {activeTab === 'resume-review' && 'Review formatted resumes, resolve missing fields, and publish completed documents.'}
                {activeTab === 'settings' && 'Manage application settings and preferences in one place.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>


              {activeTab === 'job-board' && (
                <div className="agent-status-header">
                  <div
                    className="status-header-info clickable"
                    onClick={() => { setActiveTab('settings'); setSettingsSubTab('scheduler'); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="status-indicator">
                      <span className={`dot ${status.status === 'running' ? 'active' : ''}`}></span>
                      {status.status === 'running' ? 'Working...' : 'Automation Status'}
                    </div>
                    <p className="status-desc-mini">
                      {status.status === 'running'
                        ? status.current_task
                        : stats?.scheduler_next_run === 'Disabled'
                          ? 'Scheduler Disabled'
                          : `Scheduled at ${stats?.scheduler_next_run || '9:00 AM'}`
                      }
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={clsx('scrape-btn-compact', status.status === 'running' && 'running')}
                      onClick={triggerScrape}
                      disabled={status.status === 'running' || status.status === 'starting'}
                    >
                      {status.status === 'running' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>{status.progress}%</span>
                        </div>
                      ) : 'Run Now'}
                    </button>

                    {(status.status === 'running' || status.status === 'starting') && (
                      <button
                        className="stop-btn-compact"
                        onClick={stopScrape}
                        title="Stop"
                      >
                        <Square size={14} fill="currentColor" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Job Board Stats — removed as they are now in the content grid */}
            </div>
          </header>

          {activeTab === 'candidate-matching' && renderCandidateMatching()}
          {activeTab === 'job-board' && renderJobBoard()}
          {activeTab === 'new-candidate' && renderNewCandidate()}
          {activeTab === 'resume-review' && renderResumeReview()}
          {activeTab === 'settings' && renderSettings()}

          {renderUnsavedChangesModal()}
          {renderConfirmModal(
            showLogoutModal,
            "Sign Out",
            "Are you sure you want to end your current session? You will be redirected to the landing page.",
            confirmLogout,
            () => setShowLogoutModal(false)
          )}

          <CandidateDetailsDrawer
            candidate={selectedCandidate}
            onRefresh={handleViewCandidate}
            onClose={() => setSelectedCandidate(null)}
            showToast={showToast}
          />
          <ResumeProcessingDrawer
            candidate={selectedProcessingCandidate}
            form={processingForm}
            submitting={processingSubmitting}
            message={processingMsg}
            onChange={handleProcessingFieldChange}
            onSubmit={handleResumeCompletionSubmit}
            onClose={() => {
              setSelectedProcessingCandidate(null);
              setProcessingForm(null);
              setProcessingMsg(null);
            }}
          />

          {showTimePicker && (
            <CustomTimePicker
              value={scrapeSettings?.[showTimePicker]}
              onChange={(val) => setScrapeSettings(prev => ({ ...prev, [showTimePicker]: val }))}
              onClose={() => setShowTimePicker(null)}
            />
          )}
          {renderToast()}
        </main>
      </div>
    </div>
  );
};


export default App;
