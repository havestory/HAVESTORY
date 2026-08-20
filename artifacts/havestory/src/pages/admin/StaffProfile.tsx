import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Briefcase, Phone, MapPin, GraduationCap, Award,
  Code2, Languages, BookOpen, Star, ExternalLink, Printer,
  Plus, Trash2, Save, ChevronDown, ChevronRight, Building2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGetSettings } from '@workspace/api-client-react';

// ─── types ──────────────────────────────────────────────────────────────────

interface StaffInfo {
  id: number;
  name: string;
  username: string;
  permissions: string[];
  active: boolean;
  last_login_at: string | null;
}

interface Education {
  qualification: string;
  institution: string;
  field: string;
  startDate: string;
  endDate: string;
  grade: string;
  description: string;
}

interface Experience {
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

interface Certification {
  name: string;
  issuer: string;
  date: string;
  credentialId: string;
}

interface Project {
  name: string;
  role: string;
  description: string;
  link: string;
}

interface Reference {
  name: string;
  position: string;
  company: string;
  phone: string;
  email: string;
}

interface Language {
  language: string;
  level: string;
}

interface Profile {
  personal: {
    displayName: string;
    preferredName: string;
    dateOfBirth: string;
    nationality: string;
    nicPassport: string;
    personalEmail: string;
    phone: string;
    altPhone: string;
    address: string;
  };
  employment: {
    employeeId: string;
    jobTitle: string;
    department: string;
    employmentType: string;
    joinedDate: string;
    workLocation: string;
    reportingTo: string;
    employmentStatus: string;
  };
  emergency: {
    name: string;
    relationship: string;
    phone: string;
    altPhone: string;
  };
  cv: {
    headline: string;
    professionalSummary: string;
    careerObjective: string;
    skills: string[];
    languages: Language[];
    education: Education[];
    experience: Experience[];
    certifications: Certification[];
    projects: Project[];
    references: Reference[];
    links: { linkedin: string; portfolio: string; github: string };
    interests: string[];
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function emptyProfile(): Profile {
  return {
    personal: { displayName: '', preferredName: '', dateOfBirth: '', nationality: '', nicPassport: '', personalEmail: '', phone: '', altPhone: '', address: '' },
    employment: { employeeId: '', jobTitle: '', department: '', employmentType: 'Full-time', joinedDate: '', workLocation: 'On-site', reportingTo: '', employmentStatus: 'Active' },
    emergency: { name: '', relationship: '', phone: '', altPhone: '' },
    cv: {
      headline: '', professionalSummary: '', careerObjective: '',
      skills: [], languages: [], education: [], experience: [],
      certifications: [], projects: [], references: [],
      links: { linkedin: '', portfolio: '', github: '' },
      interests: [],
    },
  };
}

function FormField({ label, value, onChange, multiline = false, type = 'text', className = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; type?: string; className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[80px]"
        />
      ) : (
        <Input type={type} value={value} onChange={e => onChange(e.target.value)} className="rounded-none" />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="rounded-none border border-border print:border-0 print:shadow-none">
      <CardHeader
        className="pb-3 cursor-pointer select-none print:cursor-default"
        onClick={() => setOpen(v => !v)}
      >
        <CardTitle className="font-serif text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground print:hidden" /> : <ChevronRight className="w-4 h-4 text-muted-foreground print:hidden" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

// ─── Print / CV View ─────────────────────────────────────────────────────────

function PrintView({ staff, profile, bizName }: { staff: StaffInfo; profile: Profile; bizName: string }) {
  return (
    <div className="hidden print:block font-sans text-[11px] leading-relaxed text-black">
      {/* Header */}
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{profile.personal.displayName || staff.name}</h1>
            {profile.cv.headline && <p className="text-sm text-gray-600 mt-0.5">{profile.cv.headline}</p>}
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>{bizName}</div>
            <div>Employee ID: {profile.employment.employeeId || '—'}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-600">
          {profile.personal.phone && <span>📞 {profile.personal.phone}</span>}
          {profile.personal.personalEmail && <span>✉ {profile.personal.personalEmail}</span>}
          {profile.cv.links.linkedin && <span>in {profile.cv.links.linkedin}</span>}
          {profile.cv.links.portfolio && <span>🌐 {profile.cv.links.portfolio}</span>}
        </div>
      </div>

      {/* Summary */}
      {profile.cv.professionalSummary && (
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">Professional Summary</h2>
          <p className="text-gray-700">{profile.cv.professionalSummary}</p>
        </div>
      )}

      {/* Employment */}
      <div className="mb-4">
        <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">Employment Details</h2>
        <div className="grid grid-cols-3 gap-2">
          <div><span className="text-gray-500">Job Title: </span>{profile.employment.jobTitle}</div>
          <div><span className="text-gray-500">Department: </span>{profile.employment.department}</div>
          <div><span className="text-gray-500">Type: </span>{profile.employment.employmentType}</div>
          <div><span className="text-gray-500">Joined: </span>{profile.employment.joinedDate}</div>
          <div><span className="text-gray-500">Status: </span>{profile.employment.employmentStatus}</div>
          <div><span className="text-gray-500">Reports To: </span>{profile.employment.reportingTo}</div>
        </div>
      </div>

      {/* Skills */}
      {profile.cv.skills.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">Skills</h2>
          <p>{profile.cv.skills.join(' · ')}</p>
        </div>
      )}

      {/* Experience */}
      {profile.cv.experience.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">Work Experience</h2>
          {profile.cv.experience.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between">
                <span className="font-semibold">{e.jobTitle}</span>
                <span className="text-gray-500">{e.startDate} – {e.current ? 'Present' : e.endDate}</span>
              </div>
              <div className="text-gray-600">{e.company}{e.location ? `, ${e.location}` : ''}</div>
              {e.description && <p className="text-gray-700 mt-0.5">{e.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {profile.cv.education.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">Education</h2>
          {profile.cv.education.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between">
                <span className="font-semibold">{e.qualification} in {e.field}</span>
                <span className="text-gray-500">{e.startDate} – {e.endDate}</span>
              </div>
              <div className="text-gray-600">{e.institution}{e.grade ? ` · ${e.grade}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {profile.cv.certifications.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">Certifications</h2>
          {profile.cv.certifications.map((c, i) => (
            <div key={i} className="flex justify-between">
              <span className="font-medium">{c.name} — {c.issuer}</span>
              <span className="text-gray-500">{c.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {profile.cv.languages.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">Languages</h2>
          <p>{profile.cv.languages.map(l => `${l.language} (${l.level})`).join(' · ')}</p>
        </div>
      )}

      {/* References */}
      {profile.cv.references.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-300 mb-1">References</h2>
          <div className="grid grid-cols-2 gap-3">
            {profile.cv.references.map((r, i) => (
              <div key={i}>
                <div className="font-semibold">{r.name}</div>
                <div className="text-gray-600">{r.position}{r.company ? `, ${r.company}` : ''}</div>
                {r.phone && <div>{r.phone}</div>}
                {r.email && <div>{r.email}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pt-3 border-t border-gray-300 text-center text-xs text-gray-400">
        Generated by {bizName} — Confidential
      </div>
    </div>
  );
}

// ─── Multi-entry helpers ──────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('');
  function add() {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); setInput(''); }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          className="rounded-none flex-1"
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" className="rounded-none" onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-1 bg-muted text-sm">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ml-1">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function StaffProfile() {
  const [, params] = useRoute('/admin/team/:id/profile');
  const staffId = Number(params?.id);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settingsData } = useGetSettings();
  const bizName = (settingsData as any)?.businessName || 'HAVESTORY';

  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, isError } = useQuery<{ staff: StaffInfo; profile: Profile | null }>({
    queryKey: ['staff-profile', staffId],
    queryFn: () => apiFetch(`/api/admin/staff/${staffId}/profile`),
    enabled: !!staffId,
  });

  useEffect(() => {
    if (data?.profile) {
      setProfile(data.profile);
    } else if (data && !data.profile) {
      setProfile(emptyProfile());
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (p: Profile) =>
      apiFetch(`/api/admin/staff/${staffId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      }),
    onSuccess: () => {
      toast({ title: 'Profile saved' });
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['staff-profile', staffId] });
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  function update(section: keyof Profile, field: string, value: any) {
    setProfile(prev => ({ ...prev, [section]: { ...(prev[section] as any), [field]: value } }));
    setDirty(true);
  }

  function updateCv(field: string, value: any) {
    setProfile(prev => ({ ...prev, cv: { ...prev.cv, [field]: value } }));
    setDirty(true);
  }

  function addExp() {
    updateCv('experience', [...profile.cv.experience, { jobTitle: '', company: '', location: '', startDate: '', endDate: '', current: false, description: '' }]);
  }
  function addEdu() {
    updateCv('education', [...profile.cv.education, { qualification: '', institution: '', field: '', startDate: '', endDate: '', grade: '', description: '' }]);
  }
  function addCert() {
    updateCv('certifications', [...profile.cv.certifications, { name: '', issuer: '', date: '', credentialId: '' }]);
  }
  function addProject() {
    updateCv('projects', [...profile.cv.projects, { name: '', role: '', description: '', link: '' }]);
  }
  function addRef() {
    updateCv('references', [...profile.cv.references, { name: '', position: '', company: '', phone: '', email: '' }]);
  }
  function addLang() {
    updateCv('languages', [...profile.cv.languages, { language: '', level: '' }]);
  }

  if (!staffId || isNaN(staffId)) {
    return <div className="text-center py-12 text-muted-foreground">Invalid staff ID.</div>;
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-destructive">
        <AlertCircle className="w-4 h-4" />
        <span>Could not load staff profile.</span>
      </div>
    );
  }

  const staff = data!.staff;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Print Layout */}
      <PrintView staff={staff} profile={profile} bizName={bizName} />

      {/* Page Header */}
      <div className="flex justify-between items-start print:hidden">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {staff.name} — Profile
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">@{staff.username}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-none gap-1.5 text-xs uppercase tracking-wider"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5" /> Print CV
          </Button>
          <Button
            onClick={() => save.mutate(profile)}
            disabled={!dirty || save.isPending}
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs uppercase tracking-wider px-5"
          >
            <Save className="w-3.5 h-3.5" /> {save.isPending ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>
      </div>

      {/* Personal Information */}
      <Section title="Personal Information" icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Display Name" value={profile.personal.displayName} onChange={v => update('personal', 'displayName', v)} />
          <FormField label="Preferred Name" value={profile.personal.preferredName} onChange={v => update('personal', 'preferredName', v)} />
          <FormField label="Date of Birth" value={profile.personal.dateOfBirth} onChange={v => update('personal', 'dateOfBirth', v)} type="date" />
          <FormField label="Nationality" value={profile.personal.nationality} onChange={v => update('personal', 'nationality', v)} />
          <FormField label="NIC / Passport" value={profile.personal.nicPassport} onChange={v => update('personal', 'nicPassport', v)} />
          <FormField label="Personal Email" value={profile.personal.personalEmail} onChange={v => update('personal', 'personalEmail', v)} type="email" />
          <FormField label="Phone" value={profile.personal.phone} onChange={v => update('personal', 'phone', v)} />
          <FormField label="Alt. Phone" value={profile.personal.altPhone} onChange={v => update('personal', 'altPhone', v)} />
          <FormField label="Address" value={profile.personal.address} onChange={v => update('personal', 'address', v)} multiline className="sm:col-span-2" />
        </div>
      </Section>

      {/* Emergency Contact */}
      <Section title="Emergency Contact" icon={Phone}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Contact Name" value={profile.emergency.name} onChange={v => update('emergency', 'name', v)} />
          <FormField label="Relationship" value={profile.emergency.relationship} onChange={v => update('emergency', 'relationship', v)} />
          <FormField label="Phone" value={profile.emergency.phone} onChange={v => update('emergency', 'phone', v)} />
          <FormField label="Alt. Phone" value={profile.emergency.altPhone} onChange={v => update('emergency', 'altPhone', v)} />
        </div>
      </Section>

      {/* Employment */}
      <Section title="Employment Information" icon={Briefcase}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Employee ID" value={profile.employment.employeeId} onChange={v => update('employment', 'employeeId', v)} />
          <FormField label="Job Title" value={profile.employment.jobTitle} onChange={v => update('employment', 'jobTitle', v)} />
          <FormField label="Department" value={profile.employment.department} onChange={v => update('employment', 'department', v)} />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Employment Type</Label>
            <Select value={profile.employment.employmentType} onValueChange={v => update('employment', 'employmentType', v)}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                {['Full-time', 'Part-time', 'Contract', 'Intern', 'Freelance'].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormField label="Joined Date" value={profile.employment.joinedDate} onChange={v => update('employment', 'joinedDate', v)} type="date" />
          <FormField label="Work Location" value={profile.employment.workLocation} onChange={v => update('employment', 'workLocation', v)} />
          <FormField label="Reporting To" value={profile.employment.reportingTo} onChange={v => update('employment', 'reportingTo', v)} />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Employment Status</Label>
            <Select value={profile.employment.employmentStatus} onValueChange={v => update('employment', 'employmentStatus', v)}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                {['Active', 'On Leave', 'Probation', 'Resigned', 'Terminated'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* Professional Summary */}
      <Section title="Professional Profile" icon={Star}>
        <div className="space-y-4">
          <FormField label="Headline" value={profile.cv.headline} onChange={v => updateCv('headline', v)} />
          <FormField label="Professional Summary" value={profile.cv.professionalSummary} onChange={v => updateCv('professionalSummary', v)} multiline />
          <FormField label="Career Objective" value={profile.cv.careerObjective} onChange={v => updateCv('careerObjective', v)} multiline />
        </div>
      </Section>

      {/* Skills & Languages */}
      <Section title="Skills & Languages" icon={Code2}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Skills</Label>
            <TagInput tags={profile.cv.skills} onChange={v => updateCv('skills', v)} placeholder="Type a skill and press Enter" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Interests / Hobbies</Label>
            <TagInput tags={profile.cv.interests} onChange={v => updateCv('interests', v)} placeholder="Type an interest and press Enter" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Languages</Label>
              <Button type="button" variant="outline" size="sm" className="rounded-none h-7 text-xs gap-1" onClick={addLang}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {profile.cv.languages.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input value={l.language} onChange={e => { const n = [...profile.cv.languages]; n[i] = { ...n[i], language: e.target.value }; updateCv('languages', n); }} className="rounded-none" placeholder="Language" />
                <Select value={l.level} onValueChange={v => { const n = [...profile.cv.languages]; n[i] = { ...n[i], level: v }; updateCv('languages', n); }}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    {['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'].map(lv => (
                      <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" className="rounded-none h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => updateCv('languages', profile.cv.languages.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Education */}
      <Section title="Education" icon={GraduationCap}>
        <div className="space-y-4">
          {profile.cv.education.map((e, i) => (
            <div key={i} className="p-3 border border-border space-y-3 relative">
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute top-2 right-2 h-7 w-7 rounded-none text-muted-foreground hover:text-destructive"
                onClick={() => updateCv('education', profile.cv.education.filter((_, j) => j !== i))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Qualification" value={e.qualification} onChange={v => { const n = [...profile.cv.education]; n[i] = { ...n[i], qualification: v }; updateCv('education', n); }} />
                <FormField label="Institution" value={e.institution} onChange={v => { const n = [...profile.cv.education]; n[i] = { ...n[i], institution: v }; updateCv('education', n); }} />
                <FormField label="Field of Study" value={e.field} onChange={v => { const n = [...profile.cv.education]; n[i] = { ...n[i], field: v }; updateCv('education', n); }} />
                <FormField label="Grade / GPA" value={e.grade} onChange={v => { const n = [...profile.cv.education]; n[i] = { ...n[i], grade: v }; updateCv('education', n); }} />
                <FormField label="Start Date" value={e.startDate} onChange={v => { const n = [...profile.cv.education]; n[i] = { ...n[i], startDate: v }; updateCv('education', n); }} />
                <FormField label="End Date" value={e.endDate} onChange={v => { const n = [...profile.cv.education]; n[i] = { ...n[i], endDate: v }; updateCv('education', n); }} />
              </div>
              <FormField label="Notes" value={e.description} onChange={v => { const n = [...profile.cv.education]; n[i] = { ...n[i], description: v }; updateCv('education', n); }} multiline />
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-none gap-1.5 text-xs uppercase tracking-wider w-full" onClick={addEdu}>
            <Plus className="w-3.5 h-3.5" /> Add Education
          </Button>
        </div>
      </Section>

      {/* Experience */}
      <Section title="Work Experience" icon={Building2}>
        <div className="space-y-4">
          {profile.cv.experience.map((e, i) => (
            <div key={i} className="p-3 border border-border space-y-3 relative">
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute top-2 right-2 h-7 w-7 rounded-none text-muted-foreground hover:text-destructive"
                onClick={() => updateCv('experience', profile.cv.experience.filter((_, j) => j !== i))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Job Title" value={e.jobTitle} onChange={v => { const n = [...profile.cv.experience]; n[i] = { ...n[i], jobTitle: v }; updateCv('experience', n); }} />
                <FormField label="Company" value={e.company} onChange={v => { const n = [...profile.cv.experience]; n[i] = { ...n[i], company: v }; updateCv('experience', n); }} />
                <FormField label="Location" value={e.location} onChange={v => { const n = [...profile.cv.experience]; n[i] = { ...n[i], location: v }; updateCv('experience', n); }} />
                <div className="flex items-end gap-3">
                  <FormField label="Start Date" value={e.startDate} onChange={v => { const n = [...profile.cv.experience]; n[i] = { ...n[i], startDate: v }; updateCv('experience', n); }} className="flex-1" />
                  <div className="flex items-center gap-2 pb-1">
                    <input type="checkbox" id={`cur-${i}`} checked={e.current} onChange={ev => { const n = [...profile.cv.experience]; n[i] = { ...n[i], current: ev.target.checked }; updateCv('experience', n); }} />
                    <Label htmlFor={`cur-${i}`} className="text-xs cursor-pointer">Current</Label>
                  </div>
                </div>
                {!e.current && (
                  <FormField label="End Date" value={e.endDate} onChange={v => { const n = [...profile.cv.experience]; n[i] = { ...n[i], endDate: v }; updateCv('experience', n); }} />
                )}
              </div>
              <FormField label="Description" value={e.description} onChange={v => { const n = [...profile.cv.experience]; n[i] = { ...n[i], description: v }; updateCv('experience', n); }} multiline />
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-none gap-1.5 text-xs uppercase tracking-wider w-full" onClick={addExp}>
            <Plus className="w-3.5 h-3.5" /> Add Experience
          </Button>
        </div>
      </Section>

      {/* Certifications */}
      <Section title="Certifications" icon={Award} defaultOpen={false}>
        <div className="space-y-3">
          {profile.cv.certifications.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start p-2 border border-border">
              <FormField label="Name" value={c.name} onChange={v => { const n = [...profile.cv.certifications]; n[i] = { ...n[i], name: v }; updateCv('certifications', n); }} />
              <FormField label="Issuer" value={c.issuer} onChange={v => { const n = [...profile.cv.certifications]; n[i] = { ...n[i], issuer: v }; updateCv('certifications', n); }} />
              <FormField label="Date" value={c.date} onChange={v => { const n = [...profile.cv.certifications]; n[i] = { ...n[i], date: v }; updateCv('certifications', n); }} />
              <Button type="button" variant="ghost" size="icon" className="rounded-none h-9 w-9 mt-6 text-muted-foreground hover:text-destructive" onClick={() => updateCv('certifications', profile.cv.certifications.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-none gap-1.5 text-xs uppercase tracking-wider w-full" onClick={addCert}>
            <Plus className="w-3.5 h-3.5" /> Add Certification
          </Button>
        </div>
      </Section>

      {/* Projects */}
      <Section title="Projects" icon={Code2} defaultOpen={false}>
        <div className="space-y-4">
          {profile.cv.projects.map((p, i) => (
            <div key={i} className="p-3 border border-border space-y-3 relative">
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute top-2 right-2 h-7 w-7 rounded-none text-muted-foreground hover:text-destructive"
                onClick={() => updateCv('projects', profile.cv.projects.filter((_, j) => j !== i))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Project Name" value={p.name} onChange={v => { const n = [...profile.cv.projects]; n[i] = { ...n[i], name: v }; updateCv('projects', n); }} />
                <FormField label="Your Role" value={p.role} onChange={v => { const n = [...profile.cv.projects]; n[i] = { ...n[i], role: v }; updateCv('projects', n); }} />
                <FormField label="Link (optional)" value={p.link} onChange={v => { const n = [...profile.cv.projects]; n[i] = { ...n[i], link: v }; updateCv('projects', n); }} className="sm:col-span-2" />
              </div>
              <FormField label="Description" value={p.description} onChange={v => { const n = [...profile.cv.projects]; n[i] = { ...n[i], description: v }; updateCv('projects', n); }} multiline />
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-none gap-1.5 text-xs uppercase tracking-wider w-full" onClick={addProject}>
            <Plus className="w-3.5 h-3.5" /> Add Project
          </Button>
        </div>
      </Section>

      {/* References */}
      <Section title="References" icon={BookOpen} defaultOpen={false}>
        <div className="space-y-3">
          {profile.cv.references.map((r, i) => (
            <div key={i} className="p-3 border border-border space-y-3 relative">
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute top-2 right-2 h-7 w-7 rounded-none text-muted-foreground hover:text-destructive"
                onClick={() => updateCv('references', profile.cv.references.filter((_, j) => j !== i))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Name" value={r.name} onChange={v => { const n = [...profile.cv.references]; n[i] = { ...n[i], name: v }; updateCv('references', n); }} />
                <FormField label="Position" value={r.position} onChange={v => { const n = [...profile.cv.references]; n[i] = { ...n[i], position: v }; updateCv('references', n); }} />
                <FormField label="Company" value={r.company} onChange={v => { const n = [...profile.cv.references]; n[i] = { ...n[i], company: v }; updateCv('references', n); }} />
                <FormField label="Phone" value={r.phone} onChange={v => { const n = [...profile.cv.references]; n[i] = { ...n[i], phone: v }; updateCv('references', n); }} />
                <FormField label="Email" value={r.email} onChange={v => { const n = [...profile.cv.references]; n[i] = { ...n[i], email: v }; updateCv('references', n); }} className="sm:col-span-2" />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-none gap-1.5 text-xs uppercase tracking-wider w-full" onClick={addRef}>
            <Plus className="w-3.5 h-3.5" /> Add Reference
          </Button>
        </div>
      </Section>

      {/* Online Profiles */}
      <Section title="Online Profiles" icon={ExternalLink} defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="LinkedIn" value={profile.cv.links.linkedin} onChange={v => { setProfile(p => ({ ...p, cv: { ...p.cv, links: { ...p.cv.links, linkedin: v } } })); setDirty(true); }} />
          <FormField label="Portfolio" value={profile.cv.links.portfolio} onChange={v => { setProfile(p => ({ ...p, cv: { ...p.cv, links: { ...p.cv.links, portfolio: v } } })); setDirty(true); }} />
          <FormField label="GitHub" value={profile.cv.links.github} onChange={v => { setProfile(p => ({ ...p, cv: { ...p.cv, links: { ...p.cv.links, github: v } } })); setDirty(true); }} />
        </div>
      </Section>

      {/* Bottom save */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-end print:hidden">
          <Button
            onClick={() => save.mutate(profile)}
            disabled={save.isPending}
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg gap-1.5 text-xs uppercase tracking-widest px-8 h-10"
          >
            <Save className="w-3.5 h-3.5" /> {save.isPending ? 'Saving…' : 'Save All Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
